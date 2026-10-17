(function(root){
'use strict';
const TRACKS={
 menu:{title:'韭菜盆栽的午後',mood:'輕鬆選單',bpm:86,src:'assets/audio/menu.wav'},
 walk:{title:'小韭今天也要上班',mood:'輕鬆行進',bpm:108,src:'assets/audio/walk.wav'},
 panic:{title:'綠到看不見未來',mood:'恐慌事件',bpm:128,src:'assets/audio/panic.wav'},
 fomo:{title:'怎麼又沒上車',mood:'FOMO 事件',bpm:136,src:'assets/audio/fomo.wav'}
};
function modeFor(screen,event){return screen==='title'?'menu':['panic','fomo'].includes(event?.music)?event.music:'walk';}
class Player{
 constructor(onchange=()=>{}){
  this.onchange=onchange;this.mode='menu';this.enabled=true;this.volume=.35;this.unlocked=false;this.hidden=false;this.blocked=false;this.error=false;this.nodes=new Map();this.frame=null;this.epoch=0;
  try{const p=JSON.parse(localStorage.getItem('taigu-warrior.audio.v1')||'null');if(p){this.enabled=p.enabled!==false;if(Number.isFinite(p.volume))this.volume=Math.min(1,Math.max(0,p.volume));}}catch{}
 }
 persist(){try{localStorage.setItem('taigu-warrior.audio.v1',JSON.stringify({enabled:this.enabled,volume:this.volume}));}catch{}}
 node(mode){if(!this.nodes.has(mode)){
  const audio=new Audio(TRACKS[mode].src);audio.loop=true;audio.preload='auto';audio.volume=0;audio.dataset.musicMode=mode;audio.setAttribute('aria-hidden','true');document.body.append(audio);
  const item={audio,gain:0};audio.addEventListener('error',()=>{if(this.mode===mode){this.error=true;this.onchange(this.info());}});this.nodes.set(mode,item);
 }return this.nodes.get(mode);}
 info(){const n=this.nodes.get(this.mode);return {mode:this.mode,...TRACKS[this.mode],enabled:this.enabled,volume:this.volume,unlocked:this.unlocked,hidden:this.hidden,blocked:this.blocked,error:this.error,playing:!!n&&!n.audio.paused&&!this.hidden&&this.enabled&&this.volume>0};}
 unlock(){this.unlocked=true;this.blocked=false;this.sync();}
 setMode(mode){if(!TRACKS[mode])return;if(this.mode===mode){this.onchange(this.info());return;}this.mode=mode;this.error=false;this.sync();}
 setEnabled(enabled){this.enabled=!!enabled;this.persist();this.sync();}
 setVolume(value){this.volume=Math.min(1,Math.max(0,Number(value)||0));for(const n of this.nodes.values())n.audio.volume=n.gain*this.volume;this.persist();if(this.enabled&&this.volume>0)this.sync();else this.onchange(this.info());}
 setHidden(hidden){this.hidden=hidden;if(hidden){this.epoch++;cancelAnimationFrame(this.frame);for(const n of this.nodes.values()){n.gain=0;n.audio.volume=0;n.audio.pause();}this.context?.suspend().catch(()=>{});this.onchange(this.info());}else this.sync();}
 sync(){
  const epoch=++this.epoch;cancelAnimationFrame(this.frame);
  const active=this.enabled&&this.unlocked&&!this.hidden&&this.volume>0;
  const target=active?this.node(this.mode):null;
  this.blocked=false;
  if(target){
   const play=target.audio.play();
   if(play?.then)play.then(()=>{if(epoch!==this.epoch){if(this.nodes.get(this.mode)!==target||!this.enabled||this.hidden)target.audio.pause();return;}this.onchange(this.info());}).catch(e=>{if(epoch===this.epoch){this.blocked=e?.name==='NotAllowedError';this.error=!this.blocked&&e?.name!=='AbortError';this.onchange(this.info());}});
  }
  const from=new Map([...this.nodes].map(([key,n])=>[key,n.gain]));const started=performance.now();
  const step=now=>{if(epoch!==this.epoch)return;const t=Math.min(1,(now-started)/650);for(const[key,n]of this.nodes){const desired=n===target?1:0;n.gain=from.get(key)+(desired-from.get(key))*t;n.audio.volume=Math.min(1,Math.max(0,n.gain*this.volume));if(t===1&&n!==target)n.audio.pause();}if(t<1)this.frame=requestAnimationFrame(step);else this.onchange(this.info());};
  this.frame=requestAnimationFrame(step);this.onchange(this.info());
 }
 sfx(kind='click'){if(!this.enabled||this.volume===0||!this.unlocked||this.hidden)return;try{
  this.context??=new(root.AudioContext||root.webkitAudioContext)();this.context.resume().catch(()=>{});
  const fx={'support-hit':{type:'triangle',from:880,to:320,duration:.09,level:.08},'support-break':{type:'sawtooth',from:180,to:42,duration:.5,level:.10},'support-start':{type:'triangle',from:260,to:800,duration:.22,level:.07}}[kind]||{type:'sine',from:kind==='trade'?660:kind==='next'?440:540,duration:.1,level:.07};
  const t=this.context.currentTime;if(kind==='support-hit'&&this.lastSupportHit!==undefined&&t-this.lastSupportHit<.035)return;if(kind==='support-hit')this.lastSupportHit=t;const osc=this.context.createOscillator(),gain=this.context.createGain();osc.connect(gain);gain.connect(this.context.destination);osc.type=fx.type;osc.frequency.setValueAtTime(fx.from,t);if(fx.to)osc.frequency.exponentialRampToValueAtTime(fx.to,t+fx.duration);gain.gain.setValueAtTime(this.volume*fx.level,t);gain.gain.exponentialRampToValueAtTime(.0001,t+fx.duration);osc.start(t);osc.stop(t+fx.duration+.01);
 }catch{}}
}
root.TaiguMusic={TRACKS,modeFor,Player};
})(globalThis);
