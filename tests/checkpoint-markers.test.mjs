import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={window:{}};vm.createContext(c);for(const f of ['data/market.js','js/engine.js','js/chart-events.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const copy=x=>JSON.parse(JSON.stringify(x));
function sample(end){const d=copy(c.window.TAIGU_DATA);d.calendar=d.calendar.slice(0,end);d.end=d.calendar.at(-1);d.target=d.calendar[4];for(const i of Object.values(d.instruments)){i.rows=i.rows.filter(r=>r[0]<=d.end);i.chips=Object.fromEntries(Object.entries(i.chips||{}).filter(([date])=>date<=d.end));}return d;}
test('completed checkpoint resumes after append-only market extension without repeating trades or altering balances',()=>{
 const old=c.TaiguEngine.createMarket(sample(6)),s=old.fresh();s.opening=false;old.next(s);old.queue(s,'0050','buy',1000);while(s.status==='playing')old.next(s);s.runId='finished-original';assert.ok(['won','lost'].includes(s.status));const saved=copy(s),next=c.TaiguEngine.createMarket(sample(8)),r=next.validate(saved);
 assert.equal(r.status,'playing');assert.equal(r.day,s.day);assert.equal(r.datasetEnd,next.data.end);for(const k of ['cash','holdings','receivables','benchmark','orders','history','log'])assert.deepEqual(copy(r[k]),copy(s[k]));assert.equal(r.parentRunId,'finished-original');assert.equal(r.runId,undefined);assert.equal(old.validate(saved).status,s.status);assert.equal(JSON.stringify(saved),JSON.stringify(s));next.next(r);assert.equal(r.day,s.day+1);assert.equal(r.log.filter(x=>x.type==='fill').length,1);
});
test('extension rejects a rewritten past or unverified old dataset while current legacy saves can acquire a checkpoint',()=>{
 const old=c.TaiguEngine.createMarket(sample(6)),s=old.fresh();s.opening=false;old.next(s);const legacy=copy(s);delete legacy.datasetPrefix;assert.ok(old.validate(legacy));old.stamp(legacy);assert.ok(c.TaiguEngine.createMarket(sample(8)).validate(legacy));
 const noProof=copy(s);delete noProof.datasetPrefix;assert.throws(()=>c.TaiguEngine.createMarket(sample(8)).validate(noProof),/不相容/);
 const rewritten=sample(8);rewritten.instruments['0050'].rows[0][4]+=.01;assert.throws(()=>c.TaiguEngine.createMarket(rewritten).validate(copy(s)),/不相容/);
 const shorter=c.TaiguEngine.createMarket(sample(4));assert.throws(()=>shorter.validate(copy(s)),/不相容/);
 const failed=old.fresh();old.spend(failed,1e6);assert.equal(c.TaiguEngine.createMarket(sample(8)).validate(copy(failed)).status,'bankrupt');
});
test('event annotations use actual triggered dates, combine same day events and never reveal future or untriggered headlines',()=>{
 const events=[{id:'signal',type:'signal',date:'2020-01-20',title:'技術訊號',text:'已發生'},{id:'news',type:'news',date:'2020-02-03',title:'重大新聞',text:'新聞內容'},{id:'future',type:'news',date:'2021-01-01',title:'未來事件'}],s={log:[{date:'2020-02-03',type:'story',text:'技術訊號／確認'}],activeEvent:'news',supportGames:[{date:'2020-02-03',choice:'decline'},{date:'2021-01-01',choice:'use'}]},before=JSON.stringify(s),groups=c.TaiguChartEvents.collect(s,events,'2020-02-03');
 assert.equal(groups.length,1);assert.equal(groups[0].date,'2020-02-03');assert.equal(groups[0].entries.length,3);assert.ok(groups[0].entries.every(x=>x.title!=='未來事件'));assert.equal(JSON.stringify(s),before);
});
test('dense marker layout limits full labels and merges nearby markers while keeping every event inspectable',()=>{
 const rows=Array.from({length:30},(_,i)=>['d'+i,100,102,98,101]),groups=rows.map(r=>({date:r[0],entries:[{date:r[0],title:r[0],category:'新聞'}]})),marks=c.TaiguChartEvents.layout(groups,rows,i=>10+i*9,()=>60,400,150);
 assert.ok(marks.length<groups.length);assert.equal(marks.reduce((n,m)=>n+m.entries.length,0),30);assert.ok(marks.filter(m=>m.full).length<=4);assert.ok(marks.every(m=>m.left>=4&&m.top>=6));
});
