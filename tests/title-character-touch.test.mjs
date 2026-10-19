import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/characters.js',import.meta.url),'utf8');
class Events{
 constructor(){this.listeners=new Map();this.captured=new Set();this.hidden=false;}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 setPointerCapture(id){this.captured.add(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){this.captured.delete(id);this.emit('lostpointercapture',{pointerId:id});}
 emit(type,props={}){const e={type,pointerId:1,isPrimary:true,clientX:20,clientY:20,detail:1,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...props};for(const fn of this.listeners.get(type)||[]){fn(e);if(e.stopped)break;}if(type==='click'&&!e.stopped)this.onclick?.(e);return e;}
}
function setup(){
 const globalEvents=new Events(),document=new Events(),element=new Events(),pending=new Map(),calls=[];let now=0,next=0;
 const ctx={document,addEventListener:globalEvents.addEventListener.bind(globalEvents),removeEventListener:globalEvents.removeEventListener.bind(globalEvents),setTimeout:(fn,ms)=>{const id=++next;pending.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>pending.delete(id)};
 vm.createContext(ctx);vm.runInContext(source,ctx);const dispose=ctx.TaiguCharacters.bindTitleInteraction(element,{enter:()=>calls.push('enter'),leave:()=>calls.push('leave'),click:()=>calls.push('click')});
 const tick=ms=>{const end=now+ms;for(;;){const ready=[...pending].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!ready)break;now=ready[1].at;pending.delete(ready[0]);ready[1].fn();}now=end;};
 const touch=(type,extra={})=>element.emit(type,{pointerType:'touch',...extra});return {element,touch,tick,calls,pending,document,globalEvents,dispose};
}
test('desktop hover, leave, native click and keyboard activation keep their original callbacks',()=>{
 const a=setup();a.element.emit('pointerenter',{pointerType:'mouse'});a.element.emit('pointerleave',{pointerType:'mouse'});const down=a.element.emit('pointerdown',{pointerType:'mouse'});const click=a.element.emit('click',{pointerType:'mouse'});a.element.emit('click',{detail:0});
 assert.deepEqual(a.calls,['enter','leave','click','click']);assert.equal(down.defaultPrevented,false);assert.equal(click.defaultPrevented,false);assert.equal(a.pending.size,0);assert.equal(a.element.emit('contextmenu',{pointerType:'mouse'}).defaultPrevented,false);
});
test('a short touch clears its hold timer and uses exactly one native click without a hover action',()=>{
 const a=setup();a.touch('pointerenter');a.touch('pointerdown');a.tick(399);const up=a.touch('pointerup');a.touch('pointerleave');a.touch('click');a.tick(1000);
 assert.deepEqual(a.calls,['click']);assert.equal(up.defaultPrevented,false);assert.equal(a.pending.size,0);
});
test('400ms hold calls the shared hover action once; release and touch leave keep its state and suppress generated clicks',()=>{
 const a=setup();a.touch('pointerdown');a.tick(399);assert.deepEqual(a.calls,[]);a.tick(1);assert.deepEqual(a.calls,['enter']);a.tick(800);assert.equal(a.touch('pointerup').defaultPrevented,true);a.touch('pointerleave');
 assert.equal(a.touch('click').defaultPrevented,true);assert.equal(a.element.emit('click',{detail:1}).defaultPrevented,true);assert.deepEqual(a.calls,['enter']);
 a.touch('pointerdown');a.tick(30);a.touch('pointerup');a.touch('click');assert.deepEqual(a.calls,['enter','click']);
});
test('cancel, leaving the target, capture loss and dragging cancel unfinished holds and never turn into a short-tap click',()=>{
 for(const cancel of [a=>a.touch('pointercancel'),a=>a.touch('pointerleave'),a=>a.touch('lostpointercapture'),a=>a.touch('pointermove',{clientX:40})]){
  const a=setup();a.touch('pointerdown');a.tick(250);cancel(a);a.tick(500);a.touch('pointerup');a.touch('click');assert.deepEqual(a.calls,[]);assert.equal(a.pending.size,0);
 }
});
test('cancelling after a successful hold never resets the character or allows the compatibility click',()=>{
 const a=setup();a.touch('pointerdown');a.tick(400);a.touch('pointercancel');a.touch('pointerleave');a.touch('click');assert.deepEqual(a.calls,['enter']);
});
test('touch context menus and selection are blocked while mouse context menus and later desktop clicks still work',()=>{
 const a=setup();a.touch('pointerdown');assert.equal(a.touch('contextmenu').defaultPrevented,true);assert.equal(a.element.emit('selectstart').defaultPrevented,true);a.tick(400);a.touch('pointerup');assert.equal(a.element.emit('contextmenu').defaultPrevented,true);
 a.element.emit('pointerdown',{pointerType:'mouse'});assert.equal(a.element.emit('contextmenu',{pointerType:'mouse'}).defaultPrevented,false);a.element.emit('click');assert.deepEqual(a.calls,['enter','click']);
});
test('backgrounding, window blur, multi-touch and disposal clear pending timers',()=>{
 for(const cancel of [a=>a.globalEvents.emit('blur'),a=>{a.document.hidden=true;a.document.emit('visibilitychange');},a=>a.touch('pointerdown',{pointerId:2,isPrimary:false}),a=>a.dispose()]){
  const a=setup();a.touch('pointerdown');a.tick(100);cancel(a);a.tick(500);assert.deepEqual(a.calls,[]);assert.equal(a.pending.size,0);
 }
});
test('a completed touch does not swallow keyboard clicks or start hold timers for pen input',()=>{
 const a=setup();a.touch('pointerdown');a.tick(400);a.touch('pointerup');a.element.emit('click',{detail:0});a.element.emit('pointerdown',{pointerType:'pen'});a.tick(800);a.element.emit('pointerenter',{pointerType:'pen'});a.element.emit('pointerleave',{pointerType:'pen'});a.element.emit('click',{pointerType:'pen'});assert.deepEqual(a.calls,['enter','click','enter','leave','click']);assert.equal(a.pending.size,0);
});
