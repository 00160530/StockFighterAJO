(function(root){
'use strict';
const valid=n=>Number.isSafeInteger(n)&&n>=0;
class Clock{
 constructor(now=()=>performance.now()){this.now=now;this.state=null;this.active=false;this.last=this.now();this.remainder=0;}
 sync(state,active){const now=this.now(),elapsed=Math.max(0,now-this.last);if(this.active&&this.state){const total=elapsed+this.remainder,whole=Math.floor(total);this.state.playTimeMs+=whole;this.remainder=total-whole;}if(state!==this.state)this.remainder=0;this.state=state;if(state&&!valid(state.playTimeMs)){state.playTimeMs=0;state.playTimePartial=true;}this.active=!!(active&&state?.status==='playing');this.last=now;return state?.playTimeMs??null;}
}
function format(ms){if(!valid(ms))return '尚無紀錄';const seconds=Math.floor(ms/1000),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return (h?h+' 小時 ':'')+(m?m+' 分 ':'')+s+' 秒';}
root.TaiguPlaytime={Clock,format,valid};
})(globalThis);
