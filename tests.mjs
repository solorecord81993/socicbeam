import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {crc16,frame,encode,Decoder} from './dist/codec.js';
assert.equal(crc16(new TextEncoder().encode('123456789')),0x29b1,'CRC reference vector');
let count=0;
function test(sr,ms,noise=0,offset=0,rateError=0,payloadSize=32){const payload=Uint8Array.from({length:payloadSize},(_,i)=>(i*73+19)&255),bytes=frame(1,0x3691,7,payload),signal=encode(bytes,sr,ms,20000,21500,.1),rx=[];const out=new Float32Array(offset+Math.ceil(signal.length*(1+rateError))+Math.ceil(sr*.3));let random=72;for(let i=0;i<out.length;i++){const p=(i-offset)/(1+rateError);random=(1664525*random+1013904223)>>>0;const a=Math.floor(p),frac=p-a;out[i]=(a>=0&&a+1<signal.length?signal[a]*(1-frac)+signal[a+1]*frac:0)+noise*(random/4294967296-.5);}const d=new Decoder(sr,ms,20000,21500,p=>rx.push(p));for(let i=0;i<out.length;i+=128)d.push(out.subarray(i,i+128));assert.equal(rx.length,1,`decoded ${sr}/${ms} noise=${noise} offset=${offset} drift=${rateError}`);assert.deepEqual(rx[0].payload,Array.from(payload));assert.equal(rx[0].session,0x3691);count++;}
test(48000,10,0,0);test(44100,40,0,0);
for(const sr of [44100,48000])for(const ms of [10,20,40,80])test(sr,ms,.005,Math.round(sr*.037));
test(48000,40,.01,419,0.0001);test(48000,40,.002,300,0,96);
// A flipped payload symbol must fail CRC, not appear as verified data.
{const b=frame(1,99,0,new Uint8Array([8,3,7]));b[5]^=1;const pcm=encode(b,48000,20,20000,21500),got=[];const d=new Decoder(48000,20,20000,21500,p=>got.push(p));const padded=new Float32Array(pcm.length+4800);padded.set(pcm);for(let i=0;i<padded.length;i+=128)d.push(padded.subarray(i,i+128));assert.equal(got.length,0);count++;}
// Silence/noise must not create packets.
{const d=new Decoder(44100,10,20000,21500,()=>assert.fail('false packet'));for(let i=0;i<1000;i++)d.push(new Float32Array(128));count++;}
console.log(`${count} modem checks passed: CRC vector, 44.1/48kHz, all four rates, noise, unaligned start, slight clock drift, max payload, corrupt-frame rejection, silence.`);

// Decoder events report sync and validation failures without accepting corrupt data.
{const b=frame(1,99,0,new Uint8Array([8,3,7]));b[5]^=1;const pcm=encode(b,48000,20,20000,21500),events=[],errors=[];const d=new Decoder(48000,20,20000,21500,()=>assert.fail('corrupt frame accepted'),e=>errors.push(e),e=>events.push(e));const padded=new Float32Array(pcm.length+4800);padded.set(pcm);for(let i=0;i<padded.length;i+=128)d.push(padded.subarray(i,i+128));assert.ok(events.some(e=>e.kind==='preamble'));assert.ok(errors.some(e=>e.reason==='crc-mismatch'));}
console.log('Decoder diagnostics passed: preamble detection and CRC failure reason.');

// Exercise the actual worklet bridge: absent input, telemetry and decoded events.
{let Worklet;const messages=[];const context={Decoder,sampleRate:48000,AudioWorkletProcessor:class{constructor(){this.port={postMessage:m=>messages.push(m)};}},registerProcessor:(name,cls)=>Worklet=cls,Float32Array,Math};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/receiver.js','utf8').replace(/^import[^\n]*\n/,''),context);const w=new Worklet(),output=[[new Float32Array(128)]];for(let i=0;i<375;i++)w.process([],output);assert.ok(messages.some(m=>m.telemetry&&!m.telemetry.input));w.port.onmessage({data:{config:true,ms:10,low:20000,high:21500}});w.port.onmessage({data:{muted:false}});const pcm=encode(frame(1,42,3,new Uint8Array([1,2,3])),48000,10,20000,21500),padded=new Float32Array(pcm.length+48000);padded.set(pcm);for(let i=0;i<padded.length;i+=128)w.process([[padded.subarray(i,i+128)]],output);assert.ok(messages.some(m=>m.event?.kind==='preamble'));assert.ok(messages.some(m=>m.packet?.seq===3));assert.ok(messages.some(m=>m.telemetry?.input&&Number.isFinite(m.telemetry.rmsDbfs)&&!m.telemetry.muted));assert.ok(output[0][0].every(v=>v===0));}
console.log('AudioWorklet bridge passed: missing input, finite level telemetry, preamble/frame events, silent output.');
