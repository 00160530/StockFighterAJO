import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/tutorial.js',import.meta.url),'utf8'),c);const T=c.TaiguTutorial;
const opening=mode=>({mode,status:'playing',opening:true,day:-1});
test('life and free each receive onboarding after the prologue, with independent completion',()=>{
 let p=T.profile(null);for(const mode of ['life','free']){const s=opening(mode);assert.equal(T.needs(s,p),false);s.opening=false;assert.equal(T.needs(s,p),true);p=T.complete(p,mode);assert.equal(T.needs(s,p),false);}
 assert.equal(p.life,true);assert.equal(p.free,true);assert.equal(T.profile(JSON.parse(JSON.stringify(p))).free,true);assert.throws(()=>T.complete(p,'other'));
});
test('finishing one mode does not suppress the other mode, invalid completion data cannot bypass onboarding',()=>{
 const s={...opening('free'),opening:false};assert.equal(T.needs(s,T.complete(null,'life')),true);
 for(const p of [null,{}, {version:1,free:'true'}, {version:0,free:true}])assert.equal(T.needs(s,p),true);
});
test('unfinished tutorial survives saved-state roundtrip while older in-progress runs are not interrupted',()=>{
 const fresh={...opening('life'),opening:false,tutorialPending:true};assert.equal(T.needs(JSON.parse(JSON.stringify(fresh)),null),true);
 const playing={...fresh,day:42};assert.equal(T.needs(playing,null),true);delete playing.tutorialPending;assert.equal(T.needs(playing,null),false);assert.equal(T.needs({...fresh,status:'won'},null),false);
});
test('free tutorial covers differences without replaying common life instructions',()=>{
 const life=T.stepsFor('life'),free=T.stepsFor('free');assert.equal(life.length,9);assert.equal(free.length,3);assert.equal(new Set(life.map(s=>s.id)).size,life.length);
 assert.ok(free.some(s=>s.text.includes('每個交易日')));assert.ok(free.some(s=>s.text.includes('5 日或 20 日')));assert.ok(free.some(s=>s.text.includes('獨立成績')));assert.ok(!free.some(s=>s.target==='.chart-panel'||s.target==='#inventoryBtn'));assert.throws(()=>T.stepsFor('unknown'));
});
test('coach card avoids the focused area when space exists, on desktop and mobile',()=>{
 const cases=[{v:{width:1280,height:620},r:{x:3,y:3,width:1274,height:75},c:{width:356,height:295}},{v:{width:1280,height:620},r:{x:170,y:84,width:760,height:305},c:{width:300,height:300}},{v:{width:390,height:844},r:{x:6,y:6,width:378,height:350},c:{width:356,height:260}}];
 for(const {r,v,c}of cases){const p=T.placeCard(r,v,c);assert.ok(p.x>=12&&p.y>=12);assert.ok(p.x+c.width<=v.width-12&&p.y+c.height<=v.height-12);const overlap=Math.max(0,Math.min(p.x+c.width,r.x+r.width)-Math.max(p.x,r.x))*Math.max(0,Math.min(p.y+c.height,r.y+r.height)-Math.max(p.y,r.y));assert.equal(overlap,0);}
});

test('post-life home guide is offered to both new and legacy completers once, independently of mode tutorials',()=>{
 for(const raw of [null,{version:1,life:true,free:true},{version:1,life:false}]){assert.equal(T.needsHome({freeUnlocked:false},raw),false);assert.equal(T.needsHome({freeUnlocked:true},raw),true);const seen=T.complete(raw,'home');assert.equal(T.needsHome({freeUnlocked:true},JSON.parse(JSON.stringify(seen))),false);assert.equal(seen.life,T.profile(raw).life);assert.equal(seen.free,T.profile(raw).free);}
 const steps=T.stepsFor('home');assert.equal(steps.length,8);assert.ok(steps[0].title.includes('恭喜'));assert.deepEqual(Array.from(steps.slice(1),s=>s.target),['#titleCharacter','#menuStart','#menuSkills','#menuRankings','.title-records','.home-community','.community-links']);assert.ok(steps[0].text.includes('真正的冒險'));assert.ok(steps[5].text.includes('匯出對帳單'));assert.ok(steps[7].text.includes('彩蛋'));
});

test('title entry starts and persists the home guide once, waits for other dialogs and never starts it inside a game',()=>{
 const source=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8'),start=source.indexOf('function tryHomeTutorial('),end=source.indexOf('function tutorialLocked',start);let starts=0,writes=0,modal=false;const ctx={screen:'title',incomingShare:null,shareLoading:false,progression:{freeUnlocked:true},tutorialProfile:{version:1,life:true},KEY:'test',TaiguTutorial:T,tutorial:{active:false,start(mode){assert.equal(mode,'home');starts++;}},playback:{stop(){}},document:{querySelector(){return modal?{}:null;}},writeStorage(key,p){assert.equal(key,'test.tutorial');assert.equal(p.home,true);writes++;}};vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
 ctx.screen='game';assert.equal(ctx.tryHomeTutorial(),false);ctx.screen='title';modal=true;assert.equal(ctx.tryHomeTutorial(),false);modal=false;assert.equal(ctx.tryHomeTutorial(),true);assert.equal(starts,1);assert.equal(writes,1);assert.equal(ctx.tryHomeTutorial(),false);assert.equal(ctx.tryHomeTutorial(true),true);assert.equal(starts,2);
});

test('home guide scrolls every step to its target at mobile width, keeps game state independent and restores scroll on exit',()=>{
 const scrolls=[],elements=new Map(),nodes=new Map(),element=()=>({style:{},hidden:false,disabled:false,textContent:'',setAttribute(){},focus(){},getBoundingClientRect(){return {width:356,height:280};}}),dialog={style:{},dataset:{},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}},ctx={innerHeight:844,scrollX:0,scrollY:120,addEventListener(){},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},scrollTo(v){scrolls.push({restore:v});},document:{documentElement:{clientWidth:390},activeElement:null,querySelector(selector){if(!elements.has(selector))elements.set(selector,{getBoundingClientRect(){return {left:20,top:300,right:370,bottom:400,width:350,height:100};},scrollIntoView(options){scrolls.push({selector,options});}});return elements.get(selector);}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../js/tutorial.js',import.meta.url),'utf8'),ctx);let ended=false;const tour=new ctx.TaiguTutorial.Tour({dialog,onEnd:()=>ended=true});tour.start('home');for(let i=0;i<8;i++)tour.move(1);assert.equal(tour.active,false);assert.equal(ended,true);assert.equal(scrolls.filter(x=>x.selector).length,8);assert.ok(scrolls.filter(x=>x.selector).every(x=>x.options.block==='center'&&x.options.behavior==='instant'));assert.equal(dialog.dataset.mode,'home');assert.equal(scrolls.at(-1).restore.top,120);
});
