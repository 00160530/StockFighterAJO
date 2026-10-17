(function(root){
'use strict';
// Every step is painted before another date can be processed. Stopping wakes a
// pending timer, so pausing never advances an extra unseen trading session.
class Runner{
 constructor(){this.running=false;this.stopped=false;this.wake=null;}
 stop(){this.stopped=true;this.wake?.();}
 wait(ms){return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);this.wake=null;resolve();},timer=setTimeout(finish,ms);this.wake=finish;if(this.stopped)finish();});}
 async run({limit,step,paint,shouldStop,interval}){
  if(this.running)throw Error('日期正在播放');this.running=true;this.stopped=false;let moved=0;
  try{for(let i=0;i<limit&&!this.stopped;i++){if(!step())break;moved++;await paint();if(this.stopped||shouldStop())break;await this.wait(Math.max(0,Number(interval())||0));}return moved;}
  finally{this.running=false;this.wake=null;}
 }
}
root.TaiguPlayback={Runner};
})(globalThis);
