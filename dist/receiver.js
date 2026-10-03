import {Decoder} from './codec.js';
class Receiver extends AudioWorkletProcessor {
 constructor(){super();this.muted=true;this.port.onmessage=e=>{const d=e.data;if(d.config){this.decoder=new Decoder(sampleRate,d.ms,d.low,d.high,p=>this.port.postMessage({packet:p}),()=>this.port.postMessage({bad:true}));}if(d.muted!==undefined){this.muted=d.muted;this.decoder?.reset();}};}
 process(inputs,outputs){const x=inputs[0]?.[0];if(x&&!this.muted&&this.decoder)this.decoder.push(x);for(const o of outputs)for(const c of o)c.fill(0);return true;}
}
registerProcessor('sonic-receiver',Receiver);
