(function(root){'use strict';
const CHARACTERS=Object.freeze([
 Object.freeze({id:'xiaojiu',name:'小韭',description:'小小韭的哥哥',sheet:'assets/xiaojiu-expressions.png?v=0.14.2',serious:'assets/xiaojiu-serious.webp?v=0.14.2',moods:'assets/xiaojiu-moods-flat-1-10.webp?v=0.14.2',intro:'assets/intro/'}),
 Object.freeze({id:'xiaoxiaojiu',name:'小小韭',description:'小韭的妹妹',sheet:'assets/characters/xiaoxiaojiu/expressions.webp?v=0.16.0',serious:'assets/characters/xiaoxiaojiu/serious.webp?v=0.16.0',moods:'assets/characters/xiaoxiaojiu/moods.webp?v=0.16.0',intro:'assets/characters/xiaoxiaojiu/intro/'})
]);
const get=id=>CHARACTERS.find(c=>c.id===id)||CHARACTERS[0];
function profile(raw){const valid=CHARACTERS.some(c=>c.id===raw?.selected);return {selected:valid?raw.selected:'xiaojiu',chosen:valid&&raw.chosen===true};}
function choose(raw,id){if(!CHARACTERS.some(c=>c.id===id))throw Error('請選擇有效的角色。');return {...profile(raw),selected:id,chosen:true};}
function intro(id,path){const match=/^assets\/intro\/(cg-0[1-6]\.webp)$/.exec(path);return match?get(id).intro+match[1]+'?v=0.14.2':path;}
// Keep native short-tap clicks; only a completed or cancelled touch suppresses its click.
function bindTitleInteraction(element,{click,enter,leave}){
 let touch=null,timer=null,blockTouchClick=false;
 const clearHold=()=>{if(timer!==null){root.clearTimeout(timer);timer=null;}};
 const release=id=>{if(element.hasPointerCapture?.(id))element.releasePointerCapture(id);};
 const cancelTouch=()=>{if(!touch)return;const id=touch.id;clearHold();touch=null;blockTouchClick=true;release(id);};
 const handlers={
  pointerenter:e=>{if(e.pointerType!=='touch')enter();},
  pointerleave:e=>{if(e.pointerType==='touch')cancelTouch();else leave();},
  pointerdown:e=>{
   if(e.pointerType!=='touch'){cancelTouch();blockTouchClick=false;return;}
   if(e.isPrimary===false||touch){cancelTouch();blockTouchClick=true;return;}
   blockTouchClick=false;touch={id:e.pointerId,x:e.clientX,y:e.clientY,fired:false,cancelled:false};
   try{element.setPointerCapture?.(e.pointerId);}catch{}
   timer=root.setTimeout(()=>{timer=null;if(!touch||touch.cancelled)return;touch.fired=true;blockTouchClick=true;enter();},200);
  },
  pointermove:e=>{if(!touch||e.pointerId!==touch.id)return;if(Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>12){touch.cancelled=true;blockTouchClick=true;clearHold();}},
  pointerup:e=>{
   if(!touch||e.pointerId!==touch.id)return;
   const previous=touch;clearHold();touch=null;blockTouchClick=previous.fired||previous.cancelled;
   if(blockTouchClick)e.preventDefault();release(previous.id);
  },
  pointercancel:e=>{if(touch&&e.pointerId===touch.id)cancelTouch();},
  lostpointercapture:e=>{if(touch&&e.pointerId===touch.id)cancelTouch();},
  contextmenu:e=>{if(touch||e.pointerType==='touch'||blockTouchClick&&!e.pointerType)e.preventDefault();},
  selectstart:e=>{if(touch)e.preventDefault();},
  keydown:e=>{if(e.key==='Enter'||e.key===' '||e.key==='Spacebar')blockTouchClick=false;}
 };
 for(const [type,handler]of Object.entries(handlers))element.addEventListener(type,handler);
 // Safari may label a touch-generated click as mouse: trust the completed gesture instead.
 const onClick=e=>{if(blockTouchClick){e.preventDefault();e.stopImmediatePropagation();return;}click(e);};
 element.onclick=onClick;
 const onVisibility=()=>{if(root.document.hidden)cancelTouch();};
 root.addEventListener?.('blur',cancelTouch);root.document?.addEventListener('visibilitychange',onVisibility);
 return ()=>{cancelTouch();for(const [type,handler]of Object.entries(handlers))element.removeEventListener(type,handler);if(element.onclick===onClick)element.onclick=null;root.removeEventListener?.('blur',cancelTouch);root.document?.removeEventListener('visibilitychange',onVisibility);};
}
root.TaiguCharacters={CHARACTERS,get,profile,choose,intro,bindTitleInteraction};
})(globalThis);
