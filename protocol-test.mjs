import vm from 'node:vm';import fs from 'node:fs';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';import {frame,encode,Decoder} from './dist/codec.js';
const source=fs.readFileSync('dist/app.js','utf8').replace(/^import[^\n]*\n/,'');
function peer(role,live=true){const els=new Map();function el(id){if(!els.has(id))els.set(id,{value:({low:'20000',high:'21500',speed:'10',gain:'10',role,volume:'25%',direction:'A → B',distance:'30',device:role,scanRange:'20000',scanWidth:'1000',scanStep:'250',scanRepeats:'1'})[id]||'',style:{},dataset:{},attributes:{},classList:{toggle(){}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},files:[],disabled:false,children:[],textContent:'',innerHTML:'',addEventListener(){},replaceChildren(...x){this.children=x;},append(...x){this.children.push(...x);},getContext(){return null;},clientWidth:0,clientHeight:0});return els.get(id);}
 const context={frame,encode,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Uint16Array,Float32Array,Blob,URL,performance,setTimeout:(fn,ms)=>setTimeout(fn,ms*.1),clearTimeout,requestAnimationFrame(){},cancelAnimationFrame(){},console,navigator:{userAgent:'synthetic protocol test'},localStorage:{getItem(){return null;},setItem(){}},document:{getElementById:el,querySelectorAll(){return[];},addEventListener(){},createElement:()=>({...el('dummy'),append(){},click(){}})},window:{addEventListener(){}},devicePixelRatio:1};vm.createContext(context);vm.runInContext(source+`\n globalThis.test={diagSnapshot,diagLog,handleReceiverMessage,diagnosticsText,run,onPacket,frame,config,quickAction,chooseQuickRole,ui(id){return $(id);},setStart(fn){start=fn;},scanAll,scanBands,scanSummary,scanResult:()=>scanResult,rxScan:()=>rxScan,setControl(id,value){$(id).value=value;},setup(){ctx={sampleRate:48000,close(){}};stream={getTracks:()=>[]};started=true;receiver={port:{postMessage(){}}};listening=true;},setSend(fn){sendFrame=fn;},history(){return history;},received(){return $('received');}};`,context);if(live)context.test.setup();return context.test;}
const a=peer('tx'),b=peer('rx');let drop=true,ackCount=0;
function deliver(bytes,target,sender){let packet;const from=sender.config(),to=target.config();const pcm=encode(bytes,48000,from.ms,from.low,from.high,.1),pad=new Float32Array(pcm.length+4800);pad.set(pcm);const d=new Decoder(48000,to.ms,to.low,to.high,p=>packet=p);for(let i=0;i<pad.length;i+=128)d.push(pad.subarray(i,i+128));assert.ok(packet);target.onPacket(packet);}
a.setSend(async bytes=>{deliver(bytes,b,a);});b.setSend(async bytes=>{ackCount++;if(drop){drop=false;return;}deliver(bytes,a,b);});
await a.run('benchmark');const r=a.history().at(-1);assert.equal(r.success,3);assert.equal(r.retries,1);assert.equal(r.bytes,96);assert.ok(r.goodputBps>0);assert.equal(r.complete,true);
await a.run('text',new TextEncoder().encode('hello เสียง'),true);const file=a.history().at(-1);assert.equal(file.complete,true);assert.ok(file.goodputBps>0);assert.equal(b.received().hidden,false);
// Duplicate frames must get ACKed, while final content remains single.
const before=b.received().children.length;assert.equal(before,3);assert.ok(ackCount>=7);
console.log('Protocol checks passed: dropped ACK triggers retry, duplicates re-ACKed, benchmark goodput counts unique bytes, metadata/chunks/final SHA-256 handshake, received text.');

// Matched audio-only band negotiation, measure all planned windows, return to control.
assert.equal(a.scanBands(20000,21750,1000,500).at(-1).high,21750);
assert.equal(a.scanSummary({measurements:[]}),null);
assert.equal(a.scanSummary({measurements:[{goodputBps:0,success:0,attempted:2}]}).mean,0);
a.setControl('scanRange','20000');a.setControl('scanWidth','1000');a.setControl('scanStep','500');a.setControl('scanRepeats','1');
await a.scanAll();const survey=a.scanResult();assert.equal(survey.complete,true,survey.error);assert.equal(survey.bands.length,5);assert.ok(survey.bands.every(b=>b.measurements.length===1&&b.measurements[0].success===2));assert.equal(a.config().low,20000);assert.equal(a.config().high,21500);assert.equal(b.config().high,21500);assert.equal(b.rxScan(),null);
console.log('Frequency scan checks passed: all five planned windows negotiate over control audio, both peers retune together, 2 payload ACKs per window, return to control, untested distinct from measured zero.');

// The two visible primary actions complete the whole setup, with no extra mic/tab click.
const sender=peer('tx',false),listener=peer('rx',false);let senderOpens=0,listenerOpens=0;
sender.setStart(async()=>{senderOpens++;sender.setup();});listener.setStart(async()=>{listenerOpens++;listener.setup();});
sender.setSend(async bytes=>deliver(bytes,listener,sender));listener.setSend(async bytes=>deliver(bytes,sender,listener));
await listener.quickAction();assert.equal(listenerOpens,1);assert.equal(listener.ui('quickTitle').textContent,'Ready to receive');assert.equal(listener.ui('quickStart').disabled,false);assert.equal(listener.ui('quickButtonText').textContent,'Stop receiving');assert.equal(listener.config().high,21000);assert.equal(listener.config().ms,40);
await sender.quickAction();assert.equal(senderOpens,1);assert.equal(sender.scanResult().complete,true);assert.equal(sender.ui('quickTitle').textContent,'Test complete');assert.equal(listener.ui('quickTitle').textContent,'Test received');assert.equal(sender.ui('quickStart').disabled,false);assert.equal(sender.ui('quickButtonText').textContent,'Test again');
const denied=peer('rx',false);denied.setStart(async()=>{throw Object.assign(new Error('permission denied'),{name:'NotAllowedError'});});await denied.quickAction();assert.equal(denied.ui('quickTitle').textContent,'Microphone permission needed');assert.equal(denied.ui('quickStart').disabled,false);assert.equal(denied.ui('quickButtonText').textContent,'Try again');
const alone=peer('tx',false);alone.setStart(async()=>alone.setup());alone.setSend(async()=>{});await alone.quickAction();assert.equal(alone.ui('quickTitle').textContent,'Receiver not found');assert.equal(alone.ui('quickStart').disabled,false);
console.log('Quick-start checks passed: receiver one press opens mic and waits; sender one press opens mic and scans all bands; completion reaches both devices; permission/absent-peer errors show an enabled retry action.');

// Toggle the same primary button while receiving, sending, and opening audio.
await listener.quickAction();assert.equal(listener.ui('quickTitle').textContent,'Stopped');assert.equal(listener.ui('quickButtonText').textContent,'Start receiving');assert.equal(listener.ui('quickStart').disabled,false);
await listener.quickAction();assert.equal(listenerOpens,2);assert.equal(listener.ui('quickButtonText').textContent,'Stop receiving');
const interrupted=peer('tx',false);interrupted.setStart(async()=>interrupted.setup());let enterSend;const entered=new Promise(resolve=>enterSend=resolve);let releaseSend;const sending=new Promise(resolve=>releaseSend=resolve);
interrupted.setSend(async()=>{enterSend();await sending;});const running=interrupted.quickAction();await entered;
assert.equal(interrupted.ui('quickStart').disabled,false);assert.equal(interrupted.ui('quickButtonText').textContent,'Stop sending');
await interrupted.quickAction();assert.equal(interrupted.ui('quickTitle').textContent,'Stopped');assert.equal(interrupted.ui('quickStart').disabled,true);releaseSend();await running;
assert.equal(interrupted.ui('quickStart').disabled,false);assert.equal(interrupted.ui('quickButtonText').textContent,'Start test');assert.equal(interrupted.ui('quickTitle').textContent,'Stopped');assert.equal(interrupted.ui('quickProgress').hidden,true);
interrupted.chooseQuickRole('rx');interrupted.setStart(async()=>interrupted.setup());await interrupted.quickAction();assert.equal(interrupted.ui('quickButtonText').textContent,'Stop receiving');await interrupted.quickAction();
const opening=peer('rx',false);let releaseOpen;opening.setStart(()=>new Promise(resolve=>releaseOpen=resolve));const pendingOpen=opening.quickAction();assert.equal(opening.ui('quickButtonText').textContent,'Stop receiving');await opening.quickAction();releaseOpen();await pendingOpen;
assert.equal(opening.ui('quickTitle').textContent,'Stopped');assert.equal(opening.ui('quickButtonText').textContent,'Start receiving');assert.equal(opening.ui('quickStart').disabled,false);
console.log('Start/stop toggle checks passed: receiver stop/restart, sender interruption during transmit, no stale completion or progress, and cancellation during microphone opening.');

// Receiver diagnostics distinguish valid reception from locally played ACKs.
assert.ok(b.diagSnapshot().counters.bytes>=96);assert.ok(b.diagSnapshot().counters.ackPlayed>0);assert.ok(b.diagSnapshot().events.some(e=>e.event==='ACK_PLAYED'));
assert.ok(alone.diagSnapshot().counters.ackTimeouts>=3);assert.ok(alone.diagSnapshot().events.some(e=>e.event==='ACK_TIMEOUT'));
const brokenAck=peer('rx');brokenAck.setSend(async()=>{throw Error('speaker playback failed');});
await assert.rejects(()=>brokenAck.onPacket({type:1,session:77,seq:2,payload:[1,2,3],crc:123}),/speaker playback failed/);
assert.equal(brokenAck.diagSnapshot().counters.ackPlayed,0);assert.equal(brokenAck.diagSnapshot().counters.ackErrors,1);assert.equal(brokenAck.ui('rxBytes').textContent,3);assert.match(brokenAck.ui('rxAckStatus').textContent,/failed/);
assert.ok(brokenAck.diagSnapshot().events.some(e=>e.event==='ACK_ERROR'));assert.match(brokenAck.ui('rxLast').textContent,/Test payload/);
brokenAck.handleReceiverMessage({bad:true,detail:{reason:'crc-mismatch'}});assert.equal(brokenAck.diagSnapshot().counters.invalid,1);assert.match(brokenAck.ui('rxAckStatus').textContent,/No ACK/);
brokenAck.handleReceiverMessage({event:{kind:'preamble',quality:.9}});assert.equal(brokenAck.diagSnapshot().counters.preambles,1);
brokenAck.handleReceiverMessage({telemetry:{input:true,rmsDbfs:-35,peakDbfs:-20,clipped:0,muted:false,decoderReady:true}});assert.match(brokenAck.ui('rxMic').textContent,/-35.0 dBFS/);
assert.equal(JSON.parse(brokenAck.diagnosticsText()).build,'0.5-receiver-log');assert.ok(!brokenAck.diagnosticsText().includes('"payload":'));
for(let i=0;i<260;i++)brokenAck.diagLog('BOUNDED_TEST',{i});assert.equal(brokenAck.diagSnapshot().events.length,250);
console.log('Diagnostics checks passed: decoded data visible, ACK played separate from failures, sender timeouts, CRC rejection, preamble/input telemetry, payload-free bounded export.');
