import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/about-plaques.js',import.meta.url),'utf8'),context={};vm.createContext(context);vm.runInContext(source,context);const {World,layout,vertices,overlap,markup}=context.TaiguAboutPlaques;
function inside(world){for(const b of world.bodies)for(const p of vertices(b)){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=-.1&&p.x<=world.width+.1&&p.y>=-.1&&p.y<=world.height+.1,'plaque escaped the play area');}}
test('first activation tilts around its hanger, second detaches, and replacing it restores the repeatable interaction',()=>{
 const w=new World(600,1),b=w.bodies[0];assert.equal(w.active,false);w.activate(0);assert.equal(b.state,'tilted');for(let i=0;i<120;i++)w.step(1/60);assert.ok(Math.abs(b.angle)>.15);assert.ok(Math.abs(b.x-b.home.x)>3);assert.equal(w.active,false);
 w.activate(0);assert.equal(b.state,'free');const y=b.y;for(let i=0;i<10;i++)w.step(1/60);assert.ok(b.y>y);assert.ok(b.angle!==b.target);
 w.grab(0);w.move(0,b.home.x+8,b.home.y+8);assert.equal(w.nearHome(0),true);assert.equal(w.release(0),true);assert.equal(b.state,'hung');assert.equal(b.angle,0);assert.equal(b.x,b.home.x);w.activate(0);assert.equal(b.state,'tilted');
});
test('falling rotated plaques collide with the floor, lose energy and come to rest inside all four boundaries',()=>{
 const w=new World(440,1,{bucket:false}),b=w.bodies[0];w.activate(0);w.activate(0);b.angle=.4;b.omega=2;b.vx=400;b.vy=-400;const start=b.omega;
 for(let i=0;i<900;i++){w.step(1/60);inside(w);}assert.notEqual(b.omega,start);assert.equal(b.sleeping,true);assert.equal(w.active,false);
 b.sleeping=false;b.x=w.width-1;b.vx=1000;w.step(1);inside(w);
});
test('separate wooden bodies exchange collision impulses including rotation rather than passing through each other',()=>{
 const w=new World(600,2),[a,b]=w.bodies;for(const p of [a,b])p.state='free';Object.assign(a,{x:220,y:200,vx:180,angle:0});Object.assign(b,{x:265,y:200,vx:-180,angle:0});w.step(1/120);
 assert.ok(a.vx<0);assert.ok(b.vx>0);assert.ok(!overlap(a,b)||overlap(a,b).depth<.2);
 const angular=new World(450,1),p=angular.bodies[0];Object.assign(p,{state:'free',angle:.35,x:200,y:angular.height-20,vy:400});angular.step(1/120);assert.ok(Math.abs(p.omega)>.1);inside(angular);
});
test('all ten detached moods stay contained under collisions and a responsive resize keeps every home usable',()=>{
 const w=new World(600);for(const b of w.bodies){w.activate(b.id);w.activate(b.id);}for(let i=0;i<600;i++){w.step(1/60);inside(w);}
 assert.equal(w.active,false);w.resize(280);assert.equal(w.bodies.length,10);inside(w);for(const b of w.bodies){w.grab(b.id);w.move(b.id,b.home.x,b.home.y);assert.equal(w.release(b.id),true);}assert.equal(w.active,false);
 for(const width of [240,320,390,600]){const g=layout(width);assert.equal(g.homes.length,10);for(const home of g.homes)assert.ok(home.x-g.w/2>=0&&home.x+g.w/2<=g.width&&home.y-g.h/2>=0&&home.y+g.h/2<g.height);}
});

test('picking up a supporting plaque wakes a sleeping stack so the other plaques can fall again',()=>{
 const w=new World(600),[upper,lower]=w.bodies;for(const b of [upper,lower])Object.assign(b,{state:'free',sleeping:true,x:300,angle:0});lower.y=w.height-lower.h/2;upper.y=lower.y-lower.h;const y=upper.y;
 w.grab(lower.id);w.move(lower.id,550,100);assert.equal(upper.sleeping,false);for(let i=0;i<120;i++)w.step(1/60);assert.ok(upper.y>y+20);inside(w);
});
test('dragging is bounded, dropping away from a home continues falling and cancellation never teleports a plaque home',()=>{
 const w=new World(300,1),b=w.bodies[0];w.grab(0);w.move(0,-10000,10000,1e6,1e6);inside(w);assert.equal(w.release(0),false);assert.equal(b.state,'free');assert.ok(Math.abs(b.vx)<=1000&&Math.abs(b.vy)<=1000);
 w.grab(0);w.move(0,b.home.x,b.home.y);assert.equal(w.release(0,{cancelled:true}),false);assert.equal(b.state,'free');assert.equal(b.vx,0);assert.equal(b.vy,0);w.resetAll();assert.equal(w.active,false);
});
test('markup reuses the selected hero mood assets and provides ten distinct matching drop targets without changing images',()=>{
 const names=Array.from({length:10},(_,i)=>'心情'+i),calls=[],html=markup({character:{id:'xiaoxiaojiu',name:'小小韭'},names,avatar:(id,hero)=>{calls.push({id,hero});return '<svg data-mood="'+id+'"></svg>';},esc:s=>String(s)});
 assert.equal(calls.length,10);assert.ok(calls.every(c=>c.hero==='xiaoxiaojiu'));assert.equal((html.match(/data-home=/g)||[]).length,10);assert.equal((html.match(/data-plaque=/g)||[]).length,10);assert.ok(html.includes('小小韭的互動心情木牌'));assert.ok(html.includes('虛線框'));
});

class Target{
 constructor(){this.handlers={};}
 addEventListener(type,fn){(this.handlers[type]??=new Set()).add(fn);}
 removeEventListener(type,fn){this.handlers[type]?.delete(fn);}
 emit(type,event={}){const e={button:0,isPrimary:true,pointerId:1,timeStamp:10,preventDefault(){this.defaultPrevented=true;},...event};for(const fn of this.handlers[type]||[])fn(e);return e;}
}
function scene(options={}){
 const frames=new Map(),timers=new Map(),host=new Target(),doc=new Target();doc.hidden=false;let frameId=0,timerId=0,observer;doc.createElement=()=>{const node=new Target();return Object.assign(node,{style:{setProperty(key,value){this[key]=value;}},setAttribute(key,value){this[key]=value;},remove(){this.removed=true;}});};
 const sandbox={setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),addEventListener:host.addEventListener.bind(host),removeEventListener:host.removeEventListener.bind(host),requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}}};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const stage={style:{},children:[],append(node){this.children.push(node);},remove(){this.removed=true;},getBoundingClientRect:()=>({left:50,top:80,width:600,height:500})},status={},reset=new Target(),bucket={style:{},classList:{toggle(name,value){this[name]=value;}}};
 const cards=Array.from({length:10},(_,i)=>{const c=new Target();Object.assign(c,{dataset:{name:'心情'+i},style:{},setAttribute(key,value){this[key]=value;},capture:null,setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;}});return c;});
 const homes=cards.map(()=>({style:{},classList:{toggle(){}}})),lookup={'.about-plaque-stage':stage,'.about-plaque-bucket':bucket,'.about-plaques-status':status,'.about-plaques-reset':reset},element={isConnected:true,ownerDocument:doc,style:{},parentElement:new Target(),getBoundingClientRect:()=>({left:72,top:380,width:556,height:90}),querySelector:key=>lookup[key],querySelectorAll:key=>key==='[data-plaque]'?cards:homes},dialog={open:true,append(){}};
 const controller=new sandbox.TaiguAboutPlaques.Scene({element,dialog,...options});return {controller,timers,cards,homes,frames,reset,host,doc,status,observer,dialog,point:(b,extra={})=>({clientX:b.x+50,clientY:b.y+80,...extra})};
}
test('pointer drag and its following compatibility click do not count as another tap, while the next tap works',()=>{
 const s=scene(),b=s.controller.world.bodies[0],card=s.cards[0];card.emit('click');assert.equal(b.state,'tilted');card.emit('click');assert.equal(b.state,'free');
 card.emit('pointerdown',s.point(b));card.emit('pointermove',s.point({x:b.home.x+35,y:b.home.y+20},{timeStamp:30}));card.emit('pointermove',s.point(b.home,{timeStamp:45}));card.emit('pointerup',s.point(b.home,{timeStamp:50}));assert.equal(b.state,'hung');const suppressed=card.emit('click',{pointerType:'mouse'});assert.equal(suppressed.defaultPrevented,true);assert.equal(b.state,'hung');
 card.emit('pointerdown',s.point(b));card.emit('pointerup',s.point(b));card.emit('click');assert.equal(b.state,'tilted');s.controller.destroy();
});
test('cancel, hidden page, keyboard reset and closing release captures and dispose animation, resize and event resources',()=>{
 const s=scene(),b=s.controller.world.bodies[0],card=s.cards[0];card.emit('pointerdown',s.point(b));card.emit('pointermove',s.point({x:b.x+90,y:b.y+100},{timeStamp:30}));assert.equal(b.state,'drag');card.emit('pointercancel',{timeStamp:40});assert.equal(b.state,'free');assert.equal(card.capture,null);assert.equal(card.emit('click').defaultPrevented,true);
 card.emit('keydown',{key:'r'});assert.equal(b.state,'hung');card.emit('keydown',{key:'Enter'});card.emit('click');assert.equal(b.state,'tilted');assert.ok(s.frames.size>0);
 s.doc.hidden=true;s.doc.emit('visibilitychange');assert.equal(s.frames.size,0);s.doc.hidden=false;s.doc.emit('visibilitychange');assert.ok(s.frames.size>0);
 card.emit('keydown',{key:'r'});assert.equal(b.state,'hung');s.controller.destroy();assert.equal(s.frames.size,0);assert.equal(s.observer.disconnected,true);assert.equal(s.controller.listeners.length,0);assert.equal(card.handlers.pointerdown.size,0);assert.equal(s.doc.handlers.visibilitychange.size,0);s.controller.destroy();
});

test('ten plaques share a single row and use the full dialog dimensions as their boundaries',()=>{
 for(const width of [240,320,600,1200]){const g=layout(width,10,{height:650,homeTop:400,homeLeft:16,homeWidth:width-32});assert.equal(g.height,650);assert.equal(new Set(g.homes.map(p=>p.y)).size,1);assert.ok(g.w<=52);}
 const s=scene();assert.equal(s.controller.world.height,500);const b=s.controller.world.bodies[0];s.controller.world.grab(0);s.controller.world.move(0,300,40);assert.ok(b.y<b.home.y-200);s.controller.destroy();assert.equal(s.controller.stage.removed,true);
});
test('a drop can use any slot and swaps occupied slots without overlapping hung plaques',()=>{
 const w=new World(600),a=w.bodies[0],b=w.bodies[9],old=a.slot;w.grab(a.id);w.move(a.id,b.home.x,b.home.y);assert.equal(w.targetHome(a.id),9);assert.equal(w.release(a.id),true);assert.equal(a.slot,9);assert.equal(b.slot,old);assert.equal(b.x,w.geometry.homes[old].x);assert.equal(a.state,'hung');assert.equal(new Set(w.bodies.map(p=>p.slot)).size,10);
 w.resize(320);assert.equal(a.home,w.geometry.homes[9]);assert.equal(b.home,w.geometry.homes[old]);inside(w);
});
test('snap range is 30 percent larger and chooses the nearest slot',()=>{
 const w=new World(600),b=w.bodies[0],home=b.home,radius=Math.max(25,b.w*.48);w.grab(0);w.move(0,home.x,home.y+radius*1.29);assert.equal(w.targetHome(0),0);w.move(0,home.x,home.y+radius*1.31);assert.equal(w.targetHome(0),-1);
});

function memoryStorage(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}
test('closing and reopening preserves fallen positions, tilted angles and swapped slots on the same Taiwan day',()=>{
 const storage=memoryStorage(),now=()=>Date.parse('2026-10-19T15:59:00Z'),a=scene({storage,now}),w=a.controller.world;
 w.grab(2);w.move(2,w.bodies[9].home.x,w.bodies[9].home.y);w.release(2);w.activate(0);w.activate(1);w.activate(1);for(let i=0;i<600;i++)w.step(1/60);const saved=w.snapshot();a.controller.destroy();assert.equal(a.timers.size,0);
 const b=scene({storage,now});assert.deepEqual(JSON.parse(JSON.stringify(b.controller.world.snapshot())),JSON.parse(JSON.stringify(saved)));assert.equal(b.controller.world.bodies[1].state,'free');assert.equal(b.controller.world.bodies[0].state,'tilted');assert.equal(b.controller.world.bodies[2].slot,9);b.controller.destroy();
});
test('the next Taiwan midnight resets the open dialog and all original slot positions, and the next opening stays reset',()=>{
 const storage=memoryStorage();let clock=Date.parse('2026-10-19T15:59:59Z');const a=scene({storage,now:()=>clock}),w=a.controller.world;w.grab(0);w.move(0,w.bodies[9].home.x,w.bodies[9].home.y);w.release(0);w.activate(1);w.activate(1);
 assert.equal([...a.timers.values()][0].ms,1000);clock=Date.parse('2026-10-19T16:00:00Z');const timer=[...a.timers.values()][0];a.timers.clear();timer.fn();
 for(const b of a.controller.world.bodies){assert.equal(b.slot,b.id);assert.equal(b.state,'hung');assert.equal(b.x,b.home.x);assert.equal(b.y,b.home.y);assert.equal(b.angle,0);}a.controller.destroy();
 const next=scene({storage,now:()=>clock});assert.ok(next.controller.world.bodies.every(b=>b.state==='hung'&&b.slot===b.id));next.controller.destroy();assert.equal(context.TaiguAboutPlaques.dayKey(clock-1),'2026-10-19');assert.equal(context.TaiguAboutPlaques.dayKey(clock),'2026-10-20');
});
test('closing during a drag releases capture and restores a safe free body; resizing still contains saved bodies',()=>{
 const storage=memoryStorage(),now=()=>Date.parse('2026-10-19T08:00:00Z'),a=scene({storage,now}),body=a.controller.world.bodies[0],card=a.cards[0];card.emit('pointerdown',a.point(body));card.emit('pointermove',a.point({x:300,y:100},{timeStamp:30}));a.controller.destroy();assert.equal(card.capture,null);
 const b=scene({storage,now});assert.equal(b.controller.world.bodies[0].state,'free');assert.ok(b.frames.size>0);const small=new World(240,10,{height:350});assert.equal(small.restore(b.controller.world.snapshot()),true);inside(small);b.controller.destroy();
});
test('invalid saved layouts are ignored, and unavailable storage falls back to the current page memory',()=>{
 const clean=new World(600),bad=clean.snapshot();bad.bodies[1].slot=0;assert.equal(clean.restore(bad),false);bad.width=Infinity;assert.equal(clean.restore(bad),false);
 const a=scene({storage:{getItem:()=>'{broken json',setItem(){}},now:()=>Date.parse('2026-10-19T08:00:00Z')});assert.ok(a.controller.world.bodies.every(b=>b.state==='hung'));a.controller.destroy();
 const world=new World(600);world.activate(3);const store=new context.TaiguAboutPlaques.DailyState({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},now:()=>Date.parse('2026-10-19T08:00:00Z')});assert.doesNotThrow(()=>store.save(world));const restored=new World(600);assert.equal(store.load(restored),true);assert.equal(restored.bodies[3].state,'tilted');
});

test('reopening after midnight discards the previous day layout even when the dialog stayed closed overnight',()=>{
 const storage=memoryStorage();let clock=Date.parse('2026-10-19T15:59:59Z');const old=scene({storage,now:()=>clock});old.controller.world.activate(0);old.controller.world.hang(1,9);old.controller.destroy();clock+=1000;
 const next=scene({storage,now:()=>clock});assert.ok(next.controller.world.bodies.every(b=>b.state==='hung'&&b.slot===b.id&&b.angle===0));next.controller.destroy();
});

test('the bucket fits to the right of all ten plaques on desktop and narrow layouts',()=>{
 for(const width of [240,320,600,1200]){const g=layout(width),last=g.homes.at(-1),bucket=g.bucket;assert.ok(bucket.x-bucket.w/2>last.x+g.w/2);assert.ok(bucket.x+bucket.w/2<=g.width);assert.ok(g.w>0);}
});
test('dropping in the bucket returns the plaque to its current assigned slot exactly once',()=>{
 const w=new World(600),b=w.bodies[0],bucket=w.geometry.bucket;w.hang(0,7);w.grab(0);w.move(0,bucket.x,bucket.y);assert.equal(w.inBucket(0),true);assert.equal(w.release(0),true);assert.equal(b.state,'hung');assert.equal(b.slot,7);assert.equal(b.x,b.home.x);assert.equal(b.angle,0);assert.deepEqual(Array.from(w.takeReturns(),r=>({...r})),[{id:0,points:1}]);w.step(.05);assert.equal(w.takeReturns().length,0);
 const miss=w.bodies[1];w.grab(1);w.move(1,bucket.x,bucket.y+bucket.h);assert.equal(w.release(1),false);assert.equal(miss.state,'free');assert.equal(w.takeReturns().length,0);
});
test('fast thrown plaques are caught when crossing the bucket, while passing beside it is not a hit',()=>{
 const w=new World(600,1),b=w.bodies[0],bucket=w.geometry.bucket;Object.assign(b,{state:'free',x:bucket.x,y:bucket.y-bucket.h/2-5,vy:1200,vx:0});w.step(.05);assert.equal(b.state,'hung');assert.deepEqual(Array.from(w.takeReturns(),r=>({...r})),[{id:0,points:1}]);
 Object.assign(b,{state:'free',sleeping:false,x:bucket.x+bucket.w,y:bucket.y-bucket.h/2-5,vy:1200,vx:0});w.step(.05);assert.equal(b.state,'free');assert.equal(w.takeReturns().length,0);
});
test('bucket scoring appears at varying positions, prevents a following click, persists and cleans up on close',()=>{
 const storage=memoryStorage(),s=scene({storage}),w=s.controller.world,card=s.cards[0];
 const drop=()=>{const b=w.bodies[0],bucket=w.geometry.bucket;card.emit('pointerdown',s.point(b));card.emit('pointermove',s.point(bucket,{timeStamp:30}));card.emit('pointerup',s.point(bucket,{timeStamp:40}));};drop();assert.equal(w.bodies[0].state,'hung');assert.equal(card.emit('click').defaultPrevented,true);assert.equal(s.controller.effects.size,1);assert.match(s.status.textContent,/收納桶.*\+1/);const first=[...s.controller.effects][0].node;assert.equal(first.textContent,'+1');first.emit('animationend');assert.equal(first.removed,true);assert.equal(s.controller.effects.size,0);
 drop();assert.equal(s.controller.effects.size,1);const second=[...s.controller.effects][0].node;s.controller.destroy();assert.equal(second.removed,true);assert.equal(s.timers.size,0);const reopened=scene({storage});assert.equal(reopened.controller.world.bodies[0].state,'hung');assert.equal(reopened.controller.effects.size,0);reopened.controller.destroy();
 const bucket=layout(600,10,{homeTop:180}).bucket,position=context.TaiguAboutPlaques.scorePosition,a=position(bucket,600,300,()=>.1),b=position(bucket,600,300,()=>.9);assert.notEqual(a.x,b.x);assert.notEqual(a.y,b.y);assert.ok(a.x>=20&&b.x<=580);assert.ok(a.y>=54&&b.y<=285);
});

test('score text stays entirely above the bucket, including the animation scale and tight top boundaries',()=>{
 const position=context.TaiguAboutPlaques.scorePosition;
 for(const top of [1,16,60,180,400])for(const r of [0,.1,.5,.9,1]){
  const bucket={x:550,y:top+28,w:52,h:56},p=position(bucket,600,500,()=>r);
  assert.ok(p.y>=0);assert.ok(p.y+p.size*1.3<=top+1e-8);assert.ok(p.size<=23);
 }
});

test('throw distance awards 1–3 points proportionally on narrow and wide dialogs',()=>{
 const points=context.TaiguAboutPlaques.throwPoints,bucket={x:0,y:0};
 for(const width of [240,600,1200])for(const [ratio,expected] of [[0,1],[.249,1],[.25,2],[.549,2],[.55,3],[2,3]])assert.equal(points({x:width*ratio,y:0},bucket,width),expected);
 assert.equal(points({x:0,y:300},bucket,600),2);
});

test('near, medium and far releases retain their award until impact, then reset for the next drop',()=>{
 for(const [distance,points] of [[80,1],[200,2],[400,3]]){
  const w=new World(600,10,{homeTop:180,height:500}),b=w.bodies[0],bucket=w.geometry.bucket;
  w.grab(0);w.move(0,bucket.x-distance,bucket.y-80,700,-100);w.release(0);assert.equal(b.bucketPoints,points);assert.equal(w.takeReturns().length,0);
  Object.assign(b,{x:bucket.x,y:bucket.y-bucket.h/2-4,vy:1200,vx:0});w.step(.02);
  assert.deepEqual(Array.from(w.takeReturns(),r=>({...r})),[{id:0,points}]);assert.equal(b.bucketPoints,1);w.step(.05);assert.equal(w.takeReturns().length,0);
  w.grab(0);w.move(0,bucket.x,bucket.y);w.release(0);assert.equal(w.takeReturns()[0].points,1);
 }
});

test('pending throw points survive reopening and resizing; cancelled or fresh drags clear the previous award',()=>{
 const w=new World(600,10,{homeTop:180,height:500}),bucket=w.geometry.bucket;w.grab(0);w.move(0,40,100);w.release(0);assert.equal(w.bodies[0].bucketPoints,3);
 const restored=new World(600,10,{homeTop:180,height:500});assert.equal(restored.restore(w.snapshot()),true);assert.equal(restored.bodies[0].bucketPoints,3);restored.resize(300,10,{homeTop:90,height:300});assert.equal(restored.bodies[0].bucketPoints,3);
 restored.grab(0);assert.equal(restored.bodies[0].bucketPoints,1);restored.move(0,25,40);restored.release(0,{cancelled:true});assert.equal(restored.bodies[0].bucketPoints,1);assert.equal(restored.takeReturns().length,0);
 const legacy=w.snapshot();delete legacy.bodies[0].bucketPoints;assert.equal(restored.restore(legacy),true);assert.equal(restored.bodies[0].bucketPoints,1);
});
