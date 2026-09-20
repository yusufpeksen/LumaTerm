// Characters are acknowledged only after xterm has parsed them. Pause the
// producer at a high watermark, never on individual interactive keystrokes.
class OutputFlow {
  constructor(deliver, pause, resume, {high=512*1024,low=128*1024}={}) {
    this.deliver=deliver;this.pause=pause;this.resume=resume;this.high=high;this.low=low;
    this.pending=0;this.sent=0;this.queue=[];this.attached=false;this.paused=false;this.closed=false;
  }
  push(data){
    if(this.closed)return;
    this.queue.push(data);this.pending+=data.length;
    if(this.pending>=this.high&&!this.paused){this.paused=true;this.pause();}
    if(this.attached&&!this.tick)this.tick=setImmediate(()=>{this.tick=null;this.flush();});
  }
  attach(){if(this.closed)return;this.attached=true;this.flush();}
  flush(){if(this.closed||!this.attached||!this.queue.length)return;const data=this.queue.join('');this.queue=[];this.sent+=data.length;this.deliver(data);}
  acknowledge(count){
    if(!Number.isSafeInteger(count)||count<=0)return;
    count=Math.min(count,this.sent);this.sent-=count;this.pending-=count;
    if(this.paused&&this.pending<=this.low){this.paused=false;this.resume();}
  }
  close(){this.closed=true;clearImmediate(this.tick);this.queue=[];}
}
module.exports={OutputFlow};
