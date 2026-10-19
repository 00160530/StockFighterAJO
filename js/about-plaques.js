(function(root){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
const axes=b=>[{x:Math.cos(b.angle),y:Math.sin(b.angle)},{x:-Math.sin(b.angle),y:Math.cos(b.angle)}];
function vertices(b){const [u,v]=axes(b);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:b.x+u.x*x*b.w/2+v.x*y*b.h/2,y:b.y+u.y*x*b.w/2+v.y*y*b.h/2}));}
function overlap(a,b){
 const aa=axes(a),bb=axes(b),delta={x:b.x-a.x,y:b.y-a.y};let depth=Infinity,normal=null;
 for(const n of [...aa,...bb]){const ra=Math.abs(dot(n,aa[0]))*a.w/2+Math.abs(dot(n,aa[1]))*a.h/2,rb=Math.abs(dot(n,bb[0]))*b.w/2+Math.abs(dot(n,bb[1]))*b.h/2,d=dot(delta,n),p=ra+rb-Math.abs(d);if(p<=0)return null;if(p<depth){depth=p;normal={x:n.x*(d<0?-1:1),y:n.y*(d<0?-1:1)};}}
 return {depth,normal};
}
function contact(a,b){
 let polygon=vertices(a);const clip=vertices(b);
 for(let i=0;i<4&&polygon.length;i++){const start=clip[i],end=clip[(i+1)%4],edge={x:end.x-start.x,y:end.y-start.y},side=p=>cross(edge,{x:p.x-start.x,y:p.y-start.y}),input=polygon;polygon=[];
  for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],dp=side(p),dq=side(q),inside=dp>=-1e-7,next=dq>=-1e-7;if(inside)polygon.push(p);if(inside!==next){const t=dp/(dp-dq);polygon.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}
 }
 return polygon.length?{x:polygon.reduce((s,p)=>s+p.x,0)/polygon.length,y:polygon.reduce((s,p)=>s+p.y,0)/polygon.length}:{x:(a.x+b.x)/2,y:(a.y+b.y)/2};
}
const inverseMass=b=>b.state==='free'&&!b.sleeping?1:0,inverseInertia=b=>inverseMass(b)*12/(b.w*b.w+b.h*b.h);
function impulse(b,j,r){if(!inverseMass(b))return;b.vx+=j.x;b.vy+=j.y;b.omega+=cross(r,j)*inverseInertia(b);}
function collide(a,b){
 const hit=overlap(a,b);if(!hit)return;const impact=Math.hypot(a.vx-b.vx,a.vy-b.vy)+Math.abs(a.omega)*a.w/2+Math.abs(b.omega)*b.w/2;
 for(const body of [a,b])if(body.sleeping&&(impact>35||hit.depth>2)){body.sleeping=false;body.rest=0;}
 const ma=inverseMass(a),mb=inverseMass(b);if(!(ma+mb))return;
 const n=hit.normal,p=contact(a,b),ra={x:p.x-a.x,y:p.y-a.y},rb={x:p.x-b.x,y:p.y-b.y};
 const relative=()=>({x:b.vx-b.omega*rb.y-a.vx+a.omega*ra.y,y:b.vy+b.omega*rb.x-a.vy-a.omega*ra.x});
 const velocity=dot(relative(),n);
 if(ma)a.contact=true;if(mb)b.contact=true;
 if(velocity<0){
  const amount=-(1+(velocity<-45?.3:0))*velocity/(ma+mb+cross(ra,n)**2*inverseInertia(a)+cross(rb,n)**2*inverseInertia(b));
  impulse(a,{x:-n.x*amount,y:-n.y*amount},ra);impulse(b,{x:n.x*amount,y:n.y*amount},rb);
  const tangent={x:-n.y,y:n.x},friction=clamp(-dot(relative(),tangent)/(ma+mb+cross(ra,tangent)**2*inverseInertia(a)+cross(rb,tangent)**2*inverseInertia(b)),-amount*.5,amount*.5);
  impulse(a,{x:-tangent.x*friction,y:-tangent.y*friction},ra);impulse(b,{x:tangent.x*friction,y:tangent.y*friction},rb);
 }
 const correction=Math.max(0,hit.depth-.06)*.8/(ma+mb);if(ma){a.x-=n.x*correction;a.y-=n.y*correction;}if(mb){b.x+=n.x*correction;b.y+=n.y*correction;}
}
function layout(width,count=10,options={}){const w=Math.max(180,width),rowWidth=options.homeWidth||w,gap=Math.min(6,rowWidth/100),bucketWidth=options.bucket===false?0:Math.min(52,Math.max(24,rowWidth*.085)),bucketGap=bucketWidth?12:0,size=Math.min(44,(rowWidth-24-gap*(count-1)-bucketWidth-bucketGap)/count),height=size,groupWidth=count*size+gap*(count-1)+bucketWidth+bucketGap,left=(options.homeLeft||0)+(rowWidth-groupWidth)/2,top=options.homeTop??22;
 return {width:w,height:options.height||Math.max(300,height+160),w:size,h:height,homes:Array.from({length:count},(_,i)=>({x:left+size/2+i*(size+gap),y:top+height/2})),bucket:bucketWidth?{x:left+groupWidth-bucketWidth/2,y:top+height/2,w:bucketWidth,h:Math.max(30,height+12)}:null};
}
function segmentInRect(from,to,rect){let enter=0,leave=1;for(const axis of ['x','y']){const delta=to[axis]-from[axis],low=rect[axis+'1'],high=rect[axis+'2'];if(Math.abs(delta)<1e-8){if(from[axis]<low||from[axis]>high)return false;}else {const a=(low-from[axis])/delta,b=(high-from[axis])/delta;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));if(enter>leave)return false;}}return true;}
function scorePosition(bucket,width,height,random=Math.random){const top=Math.max(0,Math.min(height,bucket.y-bucket.h/2)),size=Math.min(23,top/1.3),ceiling=Math.max(0,top-size*1.3);return {x:clamp(bucket.x+(random()-.5)*bucket.w*1.5,20,width-20),y:clamp(ceiling-random()*bucket.h,0,ceiling),size,drift:(random()-.5)*36};}
// Lock the award at release; normalize distance to the dialog width, not dragged path length.
function throwPoints(from,bucket,width){if(!bucket)return 1;const distance=Math.hypot(from.x-bucket.x,from.y-bucket.y)/Math.max(1,width);return distance>=.55?3:distance>=.25?2:1;}

class World{
 constructor(width,count=10,options={}){this.bodies=[];this.returns=[];this.resize(width,count,options);}
 resize(width,count=this.bodies.length,options={}){const previous={width:this.width,height:this.height},geometry=layout(width,count,options);Object.assign(this,{width:geometry.width,height:geometry.height,geometry});
  this.bodies=geometry.homes.map((initialHome,id)=>{const old=this.bodies[id],home=geometry.homes[old?.slot??id];if(!old)return {id,slot:id,home,w:geometry.w,h:geometry.h,x:home.x,y:home.y,angle:0,vx:0,vy:0,omega:0,state:'hung',rest:0,sleeping:false};
   old.home=home;old.w=geometry.w;old.h=geometry.h;if(old.state==='hung'||old.state==='tilted')this.pose(old);else {old.x*=geometry.width/previous.width;old.y*=geometry.height/previous.height;old.sleeping=false;this.contain(old);}return old;});
  const t=1000,wall=(x,y,w,h)=>({x,y,w,h,angle:0,vx:0,vy:0,omega:0,state:'wall'});this.walls=[wall(-t/2,this.height/2,t,this.height+t*2),wall(this.width+t/2,this.height/2,t,this.height+t*2),wall(this.width/2,-t/2,this.width+t*2,t),wall(this.width/2,this.height+t/2,this.width+t*2,t)];
 }
 pose(b){b.x=b.home.x-Math.sin(b.angle)*b.h/2;b.y=b.home.y-b.h/2+Math.cos(b.angle)*b.h/2;}
 wake(){for(const b of this.bodies)if(b.state==='free'){b.sleeping=false;b.rest=0;}}
 activate(id){const b=this.bodies[id];if(!b||b.state==='drag')return;if(b.state==='hung'){this.wake();b.state='tilted';b.target=(id%2?1:-1)*.2;b.omega=b.target*5;b.sleeping=false;}else if(b.state==='tilted'){this.wake();b.state='free';b.vx=(id%2?1:-1)*34;b.vy=14;b.omega+=(id%2?1:-1)*1.4;b.rest=0;b.sleeping=false;}}
 reset(id){const b=this.bodies[id];if(!b)return;this.wake();Object.assign(b,{state:'hung',x:b.home.x,y:b.home.y,angle:0,vx:0,vy:0,omega:0,rest:0,sleeping:false,target:0,bucketPoints:1});}
 resetAll(){for(const b of this.bodies)this.reset(b.id);}
 contain(b){const c=Math.abs(Math.cos(b.angle)),s=Math.abs(Math.sin(b.angle)),ex=c*b.w/2+s*b.h/2,ey=s*b.w/2+c*b.h/2;b.x=clamp(b.x,ex,this.width-ex);b.y=clamp(b.y,ey,this.height-ey);}
 grab(id){const b=this.bodies[id];if(!b)return;this.wake();b.state='drag';b.vx=0;b.vy=0;b.omega=0;b.rest=0;b.sleeping=false;b.dragTime=0;b.bucketPoints=1;}
 move(id,x,y,vx=0,vy=0){const b=this.bodies[id];if(!b||b.state!=='drag')return;b.x=x;b.y=y;b.vx=clamp(vx,-1000,1000);b.vy=clamp(vy,-1000,1000);b.dragTime=.06;this.contain(b);}
 targetHome(id){const b=this.bodies[id];if(!b)return -1;let target=-1,distance=Infinity;this.geometry.homes.forEach((home,slot)=>{const d=Math.hypot(b.x-home.x,b.y-home.y);if(d<distance){distance=d;target=slot;}});return distance<Math.max(25,b.w*.48)*1.3?target:-1;}
 nearHome(id){return this.targetHome(id)>=0;}
 hang(id,slot){const b=this.bodies[id],other=this.bodies.find(p=>p.id!==id&&p.slot===slot);if(other){other.slot=b.slot;other.home=this.geometry.homes[other.slot];if(other.state==='hung'||other.state==='tilted')this.reset(other.id);}b.slot=slot;b.home=this.geometry.homes[slot];this.reset(id);}
 inBucket(id,from=null){const b=this.bodies[id],bucket=this.geometry.bucket;if(!b||!bucket)return false;return segmentInRect(from||b,b,{x1:bucket.x-bucket.w*.42,x2:bucket.x+bucket.w*.42,y1:bucket.y-bucket.h*.4,y2:bucket.y+bucket.h*.46});}
 collect(id){const b=this.bodies[id];if(!b||!['free','drag'].includes(b.state))return false;const points=b.bucketPoints||1;this.reset(id);this.returns.push({id,points});return true;}
 takeReturns(){return this.returns.splice(0);}
 release(id,{cancelled=false}={}){const b=this.bodies[id];if(!b||b.state!=='drag')return false;if(!cancelled&&this.inBucket(id)){this.collect(id);return true;}const slot=this.targetHome(id);if(!cancelled&&slot>=0){this.hang(id,slot);return true;}b.bucketPoints=cancelled?1:throwPoints(b,this.geometry.bucket,this.width);b.state='free';if(cancelled)b.vx=b.vy=0;else b.vy=clamp(b.vy,-650,1000);b.omega=clamp(b.vx/150,-5,5);return false;}
 step(dt){let left=Math.min(Math.max(dt,0),.05);while(left>1e-8){const h=Math.min(left,1/120);left-=h;
  for(const b of this.bodies){b.contact=false;if(b.state==='tilted'){const acceleration=(b.target-b.angle)*65-b.omega*11;b.omega+=acceleration*h;b.angle+=b.omega*h;if(Math.abs(b.target-b.angle)<.0003&&Math.abs(b.omega)<.001){b.angle=b.target;b.omega=0;}this.pose(b);}else if(b.state==='drag'){b.dragTime-=h;if(b.dragTime<=0)b.vx=b.vy=0;}else if(b.state==='free'&&!b.sleeping){const from={x:b.x,y:b.y};b.vy=clamp(b.vy+900*h,-1200,1200);b.vx*=Math.exp(-.12*h);b.omega*=Math.exp(-.3*h);b.x+=b.vx*h;b.y+=b.vy*h;b.angle+=b.omega*h;if(this.inBucket(b.id,from))this.collect(b.id);}}
  for(let iteration=0;iteration<6;iteration++){for(const b of this.bodies)if(b.state==='free')for(const wall of this.walls)collide(b,wall);for(let i=0;i<this.bodies.length;i++)for(let j=i+1;j<this.bodies.length;j++)if(this.bodies[i].state==='free'||this.bodies[j].state==='free')collide(this.bodies[i],this.bodies[j]);}
  for(const b of this.bodies)if(b.state==='free'&&!b.sleeping){this.contain(b);if(b.contact&&Math.hypot(b.vx,b.vy)<40&&Math.abs(b.omega)<1){b.vx*=.8;b.vy*=.8;b.omega*=.72;}if(b.contact&&Math.hypot(b.vx,b.vy)<14&&Math.abs(b.omega)<.25){b.rest+=h;if(b.rest>.65){b.sleeping=true;b.vx=b.vy=b.omega=0;}}else b.rest=0;}
 }}
 snapshot(){return {width:this.width,height:this.height,bodies:this.bodies.map(b=>({slot:b.slot,x:b.x,y:b.y,angle:b.angle,vx:b.state==='drag'?0:b.vx,vy:b.state==='drag'?0:b.vy,omega:b.state==='drag'?0:b.omega,state:b.state==='drag'?'free':b.state,sleeping:b.sleeping===true,target:b.target||0,rest:b.rest||0,bucketPoints:b.bucketPoints||1}))};}
 restore(saved){const entries=saved?.bodies;if(!(Number.isFinite(saved?.width)&&saved.width>0&&Number.isFinite(saved?.height)&&saved.height>0)||!Array.isArray(entries)||entries.length!==this.bodies.length)return false;
  const slots=new Set();for(const entry of entries){if(!entry||!Number.isInteger(entry.slot)||entry.slot<0||entry.slot>=entries.length||slots.has(entry.slot)||!['hung','tilted','free'].includes(entry.state)||!['x','y','angle','vx','vy','omega','target','rest'].every(key=>Number.isFinite(entry[key])))return false;slots.add(entry.slot);}
  const sameSize=Math.abs(saved.width-this.width)<.5&&Math.abs(saved.height-this.height)<.5;
  entries.forEach((entry,id)=>{const b=this.bodies[id];Object.assign(b,{slot:entry.slot,home:this.geometry.homes[entry.slot],x:entry.x*this.width/saved.width,y:entry.y*this.height/saved.height,angle:entry.angle%(Math.PI*2),vx:clamp(entry.vx,-1200,1200),vy:clamp(entry.vy,-1200,1200),omega:clamp(entry.omega,-20,20),state:entry.state,sleeping:entry.sleeping===true&&sameSize,target:clamp(entry.target,-.3,.3),rest:clamp(entry.rest,0,1),bucketPoints:Number.isInteger(entry.bucketPoints)&&entry.bucketPoints>=1&&entry.bucketPoints<=3?entry.bucketPoints:1});if(b.state==='hung'||b.state==='tilted')this.pose(b);else this.contain(b);});return true;
 }
 get active(){return this.bodies.some(b=>b.state==='drag'||b.state==='free'&&!b.sleeping||b.state==='tilted'&&(Math.abs(b.angle-b.target)>.0003||Math.abs(b.omega)>.001));}
}
const STORAGE_KEY='taigu-warrior.v1.aboutPlaques',DAY_MS=86400000,TAIPEI_OFFSET=8*60*60*1000;
let remembered=null;
const dayKey=(now=Date.now())=>new Date(now+TAIPEI_OFFSET).toISOString().slice(0,10);
class DailyState{
 constructor({storage,now=Date.now}={}){this.now=now;if(storage!==undefined)this.storage=storage;else try{this.storage=root.localStorage;}catch{this.storage=null;}}
 load(world){try{const record=remembered||JSON.parse(this.storage?.getItem(STORAGE_KEY)||'null');if(record?.version!==1||record.day!==dayKey(this.now()))return false;const restored=world.restore(record.world);if(restored)remembered=record;return restored;}catch{return false;}}
 save(world){remembered={version:1,day:dayKey(this.now()),world:world.snapshot()};try{this.storage?.setItem(STORAGE_KEY,JSON.stringify(remembered));}catch{}return remembered;}
}
function markup({character,names,avatar,esc}){return '<section id="aboutPlaques" class="about-plaques"><div class="about-plaque-stage" role="group" aria-label="'+esc(character.name)+'的互動心情木牌">'+names.map((name,id)=>'<div class="about-plaque-home" data-home="'+id+'" aria-hidden="true"></div><button type="button" class="about-plaque" data-plaque="'+id+'" data-name="'+esc(name)+'" aria-label="'+esc(name)+'木牌，點一下歪掉，再點一下掉落，可拖回任意虛線框掛好">'+avatar(id+1,character.id)+'</button>').join('')+'<div class="about-plaque-bucket" role="img" aria-label="收納桶：把木牌丟進來，自動掛回"><img src="assets/about-leek-bucket.webp?v=0.16.14" alt="" width="1254" height="1254" draggable="false"></div></div><p class="about-plaques-status sr-only" role="status" aria-live="polite"></p></section>';}
class Scene{
 constructor({element,dialog,storage,now=Date.now,random=Math.random}){this.random=random;this.effects=new Set();this.now=now;this.day=dayKey(now());this.persistence=new DailyState({storage,now});this.dailyTimer=null;this.element=element;this.dialog=dialog;this.stage=element.querySelector('.about-plaque-stage');this.bucket=element.querySelector('.about-plaque-bucket');this.cards=[...element.querySelectorAll('[data-plaque]')];this.homes=[...element.querySelectorAll('[data-home]')];this.status=element.querySelector('.about-plaques-status');this.doc=element.ownerDocument;this.listeners=[];this.frame=null;this.pointer=null;this.last=0;this.dead=false;this.dialog.append(this.stage);this.content=element.parentElement;const geometry=this.measure();this.world=new World(geometry.width,this.cards.length,geometry);this.persistence.load(this.world);
  this.cards.forEach((card,id)=>{this.on(card,'pointerdown',e=>this.down(e,id));this.on(card,'pointermove',e=>this.movePointer(e));this.on(card,'pointerup',e=>this.endPointer(e));this.on(card,'pointercancel',e=>this.endPointer(e,true));this.on(card,'lostpointercapture',e=>{if(this.pointer?.id===e.pointerId)this.endPointer(e,true);});this.on(card,'click',e=>{if(card.blockClick){e.preventDefault();return;}this.world.activate(id);this.announce(id);this.render();this.request();});this.on(card,'keydown',e=>{if(e.key==='Enter'||e.key===' ')card.blockClick=false;if(e.key.toLowerCase()==='r'||e.key==='Home'){e.preventDefault();this.world.reset(id);this.announce(id);this.render();this.request();}});this.on(card,'contextmenu',e=>e.preventDefault());this.on(card,'dragstart',e=>e.preventDefault());});
  const resize=()=>{if(this.dead)return;this.checkDay();const geometry=this.measure();if(geometry.width<1||JSON.stringify(geometry)===this.geometryKey)return;this.geometryKey=JSON.stringify(geometry);this.cancelPointer();this.world.resize(geometry.width,this.cards.length,geometry);this.render();this.request();};this.geometryKey=JSON.stringify(geometry);if(root.ResizeObserver){this.observer=new root.ResizeObserver(resize);this.observer.observe(this.dialog);this.observer.observe(this.element);}else this.on(root,'resize',resize);this.on(this.content,'scroll',resize);
  this.on(this.doc,'visibilitychange',()=>{if(this.doc.hidden){this.cancelPointer();this.save();this.stop();}else {this.checkDay();this.request();}});this.on(root,'blur',()=>{this.cancelPointer();this.save();});this.on(root,'focus',()=>{this.checkDay();this.request();});this.on(root,'pagehide',()=>{this.cancelPointer();this.save();});this.render();this.save();this.scheduleDaily();this.request();
 }
 checkDay(){const next=dayKey(this.now());if(next===this.day)return false;this.cancelPointer();this.stop();this.day=next;const geometry=JSON.parse(this.geometryKey);this.world=new World(geometry.width,this.cards.length,geometry);this.render();this.persistence.save(this.world);return true;}
 save(){this.checkDay();this.persistence.save(this.world);}
 scheduleDaily(){if(!root.setTimeout)return;if(this.dailyTimer!==null)root.clearTimeout(this.dailyTimer);const now=this.now(),next=(Math.floor((now+TAIPEI_OFFSET)/DAY_MS)+1)*DAY_MS-TAIPEI_OFFSET;this.dailyTimer=root.setTimeout(()=>{this.dailyTimer=null;if(!this.dead){this.checkDay();this.scheduleDaily();}},Math.max(1,next-now));}
 measure(){const row=this.element.getBoundingClientRect();const preview=layout(row.width,this.cards.length);this.element.style.height=(Math.max(preview.h,preview.bucket?.h||0)+24)+'px';const area=this.stage.getBoundingClientRect(),home=this.element.getBoundingClientRect();return {width:area.width,height:area.height,homeWidth:home.width,homeLeft:home.left-area.left,homeTop:home.top-area.top+10};}
 on(target,type,handler){target.addEventListener(type,handler);this.listeners.push(()=>target.removeEventListener(type,handler));}
 point(e){const rect=this.stage.getBoundingClientRect();return {x:(e.clientX-rect.left)*this.world.width/rect.width,y:(e.clientY-rect.top)*this.world.height/rect.height};}
 down(e,id){if(e.isPrimary===false||e.button!==0||this.pointer)return;const p=this.point(e),b=this.world.bodies[id],card=this.cards[id];card.blockClick=false;this.pointer={id:e.pointerId,body:id,card,start:p,last:p,time:e.timeStamp,dx:p.x-b.x,dy:p.y-b.y,dragging:false};try{card.setPointerCapture(e.pointerId);}catch{}}
 movePointer(e){const p=this.pointer;if(!p||p.id!==e.pointerId)return;const next=this.point(e);if(!p.dragging&&Math.hypot(next.x-p.start.x,next.y-p.start.y)>6){p.dragging=true;p.card.blockClick=true;this.world.grab(p.body);}
  if(p.dragging){e.preventDefault();const dt=Math.max(8,e.timeStamp-p.time)/1000;this.world.move(p.body,next.x-p.dx,next.y-p.dy,(next.x-p.last.x)/dt,(next.y-p.last.y)/dt);this.render();this.request();}p.last=next;p.time=e.timeStamp;
 }
 endPointer(e,cancelled=false){const p=this.pointer;if(!p||p.id!==e.pointerId)return;this.pointer=null;if(p.dragging){e.preventDefault();const b=this.world.bodies[p.body];if(e.timeStamp-p.time>90)b.vx=b.vy=0;this.world.release(p.body,{cancelled});if(!this.flushReturns())this.announce(p.body);}if(p.dragging||cancelled)p.card.blockClick=true;try{if(p.card.hasPointerCapture(e.pointerId))p.card.releasePointerCapture(e.pointerId);}catch{}this.render();this.request();}
 cancelPointer(){if(this.pointer)this.endPointer({pointerId:this.pointer.id,timeStamp:Infinity,preventDefault(){}},true);}
 announce(id){this.save();const b=this.world.bodies[id],name=this.cards[id].dataset.name;this.status.textContent=b.state==='hung'?name+'木牌掛好了，可以再點一次。':b.state==='tilted'?name+'木牌歪掉了，再點一下就會掉下來。':name+'木牌掉下來了，拖回任意虛線框就能掛好。';}
 flushReturns(){const returns=this.world.takeReturns();for(const {id,points} of returns){this.popScore(points);this.status.textContent=this.cards[id].dataset.name+'木牌投入收納桶，已自動掛回，+'+points+'。';}if(returns.length)this.save();return returns.length;}
 popScore(points=1){const bucket=this.world.geometry.bucket;if(!bucket)return;const point=scorePosition(bucket,this.world.width,this.world.height,this.random),node=this.doc.createElement('span');node.className='about-bucket-score';node.textContent='+'+points;node.setAttribute('aria-hidden','true');node.style.left=point.x+'px';node.style.top=point.y+'px';node.style.fontSize=point.size+'px';node.style.setProperty('--score-drift',point.drift+'px');const effect={node,timer:null},finish=()=>{if(effect.timer!==null)root.clearTimeout(effect.timer);node.remove();this.effects.delete(effect);};node.addEventListener('animationend',finish,{once:true});this.effects.add(effect);this.stage.append(node);if(root.setTimeout)effect.timer=root.setTimeout(finish,1400);}
 render(){const dragging=this.world.bodies.find(b=>b.state==='drag'),target=dragging&&!this.world.inBucket(dragging.id)?this.world.targetHome(dragging.id):-1,bucket=this.world.geometry.bucket;if(bucket&&this.bucket){this.bucket.style.cssText='left:'+(bucket.x-bucket.w/2)+'px;top:'+(bucket.y-bucket.h/2)+'px;width:'+bucket.w+'px;height:'+bucket.h+'px';this.bucket.classList.toggle('is-target',!!dragging&&this.world.inBucket(dragging.id));}for(const b of this.world.bodies){const card=this.cards[b.id];card.style.width=b.w+'px';card.style.height=b.h+'px';card.style.transform='translate('+(b.x-b.w/2)+'px,'+(b.y-b.h/2)+'px) rotate('+b.angle+'rad)';card.dataset.state=b.state;card.style.zIndex=b.state==='drag'?'30':b.state==='free'?'10':'2';card.setAttribute('aria-label',card.dataset.name+'木牌，'+(b.state==='hung'?'已掛好，點一下歪掉':b.state==='tilted'?'歪掉了，再點一下掉落':'已掉落，可拖回任意格子或按 R 鍵掛回'));}this.world.geometry.homes.forEach((home,slot)=>{const node=this.homes[slot],g=this.world.geometry;node.style.cssText='left:'+(home.x-g.w/2)+'px;top:'+(home.y-g.h/2)+'px;width:'+g.w+'px;height:'+g.h+'px';node.classList.toggle('is-target',target===slot);});}

 request(){if(this.dead||this.frame!==null||this.doc.hidden||!this.world.active)return;this.frame=root.requestAnimationFrame(time=>{this.frame=null;if(this.dead||!this.element.isConnected||!this.dialog.open)return;const dt=this.last?Math.min(.05,(time-this.last)/1000):1/60;this.last=time;this.world.step(dt);this.flushReturns();this.render();if(this.world.active)this.request();else {this.last=0;this.save();}});}
 stop(){if(this.frame!==null)root.cancelAnimationFrame(this.frame);this.frame=null;this.last=0;}
 destroy(){if(this.dead)return;this.dead=true;this.cancelPointer();this.save();this.stop();if(this.dailyTimer!==null)root.clearTimeout(this.dailyTimer);this.dailyTimer=null;for(const effect of this.effects){if(effect.timer!==null)root.clearTimeout(effect.timer);effect.node.remove();}this.effects.clear();this.observer?.disconnect();this.stage.remove();for(const off of this.listeners)off();this.listeners=[];}
}
root.TaiguAboutPlaques={World,Scene,DailyState,dayKey,markup,layout,scorePosition,throwPoints,vertices,overlap};
})(globalThis);
