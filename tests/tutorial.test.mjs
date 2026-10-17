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
