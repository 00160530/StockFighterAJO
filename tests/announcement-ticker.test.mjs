import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/community.js',import.meta.url),'utf8');
function target(extra={}){const events=new Map();return {...extra,addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener(name,fn){events.get(name)?.delete(fn);},emit(name){for(const fn of events.get(name)||[])fn();}};}
function setup({mobile=true,reduce=false}={}){
 const frames=new Map(),touch=target({matches:mobile}),reduced=target({matches:reduce}),doc=target({hidden:false}),viewport={dataset:{},clientWidth:240,scrollLeft:0,focused:false,matches(){return this.focused;}};
 let width=600,mutation,intersection,seq=0;
 const copy=()=>({style:{},getBoundingClientRect:()=>({width:Math.max(width,viewport.clientWidth)})});
 const track={parentElement:viewport,children:[copy(),copy()]};
 const root=target({document:doc,matchMedia:q=>q.includes('reduced-motion')?reduced:touch,requestAnimationFrame(fn){frames.set(++seq,fn);return seq;},cancelAnimationFrame(id){frames.delete(id);},MutationObserver:class{constructor(fn){mutation=fn;}observe(){}disconnect(){mutation=null;}},IntersectionObserver:class{constructor(fn){intersection=fn;}observe(){}disconnect(){intersection=null;}}});
 const context={window:root};vm.createContext(context);vm.runInContext(source,context);const controller=root.TaiguCommunity.mountTicker(track);
 return {root,doc,touch,reduced,viewport,track,controller,frames,setWidth(n){width=n;},mutate(){mutation();},intersect(yes){intersection([{isIntersecting:yes}]);},step(time){const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time);}};
}
test('touch ticker scrolls continuously across the copy boundary instead of moving a long CSS layer',()=>{
 const a=setup();assert.equal(a.viewport.dataset.mobileTicker,'true');assert.equal(a.frames.size,1);a.step(0);
 for(let i=1;i<=400;i++){a.step(i*50);assert.ok(a.viewport.scrollLeft>=0&&a.viewport.scrollLeft<600);}
 assert.ok(Math.abs(a.viewport.scrollLeft-40)<.001);assert.equal(a.track.children[0].style.minWidth,'240px');
});
test('desktop keeps native CSS animation; changing primary input activates and removes the mobile driver',()=>{
 const a=setup({mobile:false});assert.equal(a.frames.size,0);assert.equal(a.viewport.dataset.mobileTicker,undefined);assert.equal(a.track.children[0].style.minWidth,'');
 a.touch.matches=true;a.touch.emit('change');a.step(0);a.step(50);assert.ok(a.viewport.scrollLeft>0);
 a.touch.matches=false;a.touch.emit('change');assert.equal(a.frames.size,0);assert.equal(a.viewport.scrollLeft,0);assert.equal(a.viewport.dataset.mobileTicker,undefined);
});
test('visibility and page restoration resume without counting suspended time or accumulating animation loops',()=>{
 const a=setup();a.step(0);a.step(50);const before=a.viewport.scrollLeft;
 a.doc.hidden=true;a.doc.emit('visibilitychange');assert.equal(a.frames.size,0);
 a.doc.hidden=false;a.doc.emit('visibilitychange');a.step(100000);assert.equal(a.viewport.scrollLeft,before);a.step(100050);assert.ok(a.viewport.scrollLeft>before);assert.equal(a.frames.size,1);
 a.root.emit('pagehide');assert.equal(a.frames.size,0);a.root.emit('pageshow');a.root.emit('pageshow');assert.equal(a.frames.size,1);
 a.intersect(false);assert.equal(a.frames.size,0);a.intersect(true);assert.equal(a.frames.size,1);
});
test('fresh announcement spans and viewport changes remeasure the loop; keyboard focus pauses without a sticky touch pause',()=>{
 const a=setup();a.step(0);a.step(50);a.viewport.focused=true;a.step(100);assert.equal(a.viewport.scrollLeft,1.6);
 a.viewport.focused=false;a.step(150);assert.equal(a.viewport.scrollLeft,3.2);
 a.setWidth(700);a.track.children=a.track.children.map(c=>({...c,style:{}}));a.mutate();assert.equal(a.frames.size,1);a.viewport.clientWidth=320;a.root.emit('resize');assert.equal(a.track.children[0].style.minWidth,'320px');assert.equal(a.frames.size,1);
 a.root.emit('orientationchange');assert.equal(a.frames.size,1);a.step(100000);assert.equal(a.viewport.scrollLeft,3.2);
});
test('reduced motion shows stationary text, and cleanup cancels future updates',()=>{
 const a=setup({reduce:true});assert.equal(a.frames.size,0);assert.equal(a.track.children[0].style.minWidth,'');
 a.reduced.matches=false;a.reduced.emit('change');assert.equal(a.frames.size,1);a.step(0);a.step(50);
 a.reduced.matches=true;a.reduced.emit('change');assert.equal(a.frames.size,0);assert.equal(a.viewport.scrollLeft,0);
 a.controller.destroy();a.reduced.matches=false;a.root.emit('pageshow');a.controller.refresh();assert.equal(a.frames.size,0);assert.equal(a.viewport.dataset.mobileTicker,undefined);
});
