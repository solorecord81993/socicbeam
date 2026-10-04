import {Decoder} from './codec.js';
class Receiver extends AudioWorkletProcessor {
 constructor(){super();this.muted=true;this.clock=0;this.samples=0;this.sum=0;this.peak=0;this.clipped=0;this.input=false;
 this.port.onmessage=e=>{const d=e.data;if(d.config){this.decoder=new Decoder(sampleRate,d.ms,d.low,d.high,p=>this.port.postMessage({packet:p}),detail=>this.port.postMessage({bad:true,detail}),event=>this.port.postMessage({event}));}if(d.muted!==undefined){this.muted=d.muted;this.decoder?.reset();}};}
 process(inputs,outputs){const x=inputs[0]?.[0],n=outputs[0]?.[0]?.length||128;this.clock+=n;
 if(x){this.input=true;for(const v of x){this.sum+=v*v;this.peak=Math.max(this.peak,Math.abs(v));if(Math.abs(v)>=.99)this.clipped++;}this.samples+=x.length;if(!this.muted&&this.decoder)this.decoder.push(x);}
 if(this.clock>=sampleRate){this.port.postMessage({telemetry:{input:this.input,rmsDbfs:10*Math.log10(Math.max(1e-12,this.sum/Math.max(1,this.samples))),peakDbfs:20*Math.log10(Math.max(1e-6,this.peak)),clipped:this.clipped,muted:this.muted,decoderReady:!!this.decoder,pendingFrame:this.decoder?.pending!==null&&!!this.decoder}});this.clock=0;this.samples=0;this.sum=0;this.peak=0;this.clipped=0;this.input=false;}
 for(const o of outputs)for(const c of o)c.fill(0);return true;}
}
registerProcessor('sonic-receiver',Receiver);
