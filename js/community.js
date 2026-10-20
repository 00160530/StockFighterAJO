(function(root){
'use strict';
const VERSION='0.16.5';
function latest(items){return (Array.isArray(items)?items:[]).filter(a=>a&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&typeof a.summary==='string').slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.version).localeCompare(String(a.version),undefined,{numeric:true}))[0]||null;}
// Mobile WebKit can lose a long transformed/masked text layer. Move the native
// scroll position instead, leaving desktop CSS animation and hover intact.
function mountTicker(track){
 const viewport=track?.parentElement,doc=root.document;
 if(!viewport||!doc||!root.matchMedia||!root.requestAnimationFrame)return {refresh(){},destroy(){}};
 const touch=root.matchMedia('(hover: none), (pointer: coarse)'),reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
 let frame=0,last=null,position=0,distance=0,destroyed=false,pageActive=true,intersecting=true;
 const cleanups=[];
 function listen(target,event,callback){target.addEventListener(event,callback);cleanups.push(()=>target.removeEventListener(event,callback));}
 function media(query){if(query.addEventListener)listen(query,'change',refresh);else if(query.addListener){query.addListener(refresh);cleanups.push(()=>query.removeListener(refresh));}}
 function stop(){if(frame)root.cancelAnimationFrame(frame);frame=0;last=null;}
 function moving(){return !destroyed&&touch.matches&&!reduced.matches&&!doc.hidden&&pageActive&&intersecting&&distance>0;}
 function tick(time){
  frame=0;if(!moving()){last=null;return;}
  // Ignore suspension time so returning from a browser tab/dialog never jumps.
  if(last!==null&&!viewport.matches(':focus-visible')){
   position=(position+Math.min(64,Math.max(0,time-last))*.032)%distance;
   viewport.scrollLeft=position;
  }
  last=time;frame=root.requestAnimationFrame(tick);
 }
 function refresh(){
  if(destroyed)return;stop();
  if(touch.matches)viewport.dataset.mobileTicker='true';else delete viewport.dataset.mobileTicker;
  const copies=Array.from(track.children);
  for(const copy of copies)copy.style.minWidth=touch.matches&&!reduced.matches?viewport.clientWidth+'px':'';
  distance=touch.matches&&!reduced.matches&&copies.length>=2?copies[0].getBoundingClientRect().width:0;
  position=distance>0?position%distance:0;viewport.scrollLeft=position;
  if(moving())frame=root.requestAnimationFrame(tick);
 }
 media(touch);media(reduced);
 listen(root,'resize',refresh);listen(root,'orientationchange',refresh);
 listen(root,'pageshow',()=>{pageActive=true;refresh();});listen(root,'pagehide',()=>{pageActive=false;stop();});
 listen(doc,'visibilitychange',refresh);
 // Online announcements replace both spans; remeasure without a cached width.
 const observer=root.MutationObserver?new root.MutationObserver(refresh):null;observer?.observe(track,{childList:true,characterData:true,subtree:true});
 const visibility=root.IntersectionObserver?new root.IntersectionObserver(entries=>{intersecting=entries[0]?.isIntersecting!==false;refresh();}):null;visibility?.observe(viewport);
 doc.fonts?.ready.then(refresh).catch(()=>{});refresh();
 return {refresh,destroy(){destroyed=true;stop();observer?.disconnect();visibility?.disconnect();for(const cleanup of cleanups)cleanup();delete viewport.dataset.mobileTicker;for(const copy of track.children)copy.style.minWidth='';viewport.scrollLeft=0;}};
}
const api={VERSION,latest,mountTicker};
root.TaiguCommunity=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
