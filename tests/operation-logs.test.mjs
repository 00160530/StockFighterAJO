import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('../js/operation-logs.js',import.meta.url),'utf8'),ctx);const L=ctx.TaiguOperationLogs;
const clone=x=>JSON.parse(JSON.stringify(x));
function example(id='round-a',text='買進 0050'){
 const log=[{date:'2020-01-02',type:'order',text:'買進委託',id:'0050',side:'buy',qty:100},{date:'2020-01-03',type:'fill',text,id:'0050',side:'buy',qty:100,price:97.65,value:9765,fee:20,tax:0,playerToken:'private'}];
 const record={id,mode:'life',status:'lost',date:'2020-01-03',startDate:'2020-01-02',earlySettlementDate:'2020-01-03',operationCount:log.length,equity:1000000,trades:1,fees:20,tax:0,spent:0,choices:0,dateJumps:[]},state={runId:id,status:'lost',day:1,history:[{date:record.date}],log,playerToken:'private'};
 return {record,state,entry:L.capture(record,state)};
}
function backend(){const rows=new Map();return {rows,async put(entry){rows.set(entry.id,clone(entry));},async get(id){return clone(rows.get(id)||null);},async clear(){rows.clear();},async prune(ids){for(const id of rows.keys())if(!ids.includes(id))rows.delete(id);}};}
test('export captures this run only and stays immutable after the game or summary changes',()=>{
 const {record,state,entry}=example();state.log[1].text='已經變更';state.log.push({text:'另一個操作'});record.dateJumps.push({from:'2020-01-02',to:'2020-01-03'});
 assert.equal(entry.log.length,2);assert.equal(entry.log[1].text,'買進 0050');assert.equal(entry.dateJumps.length,0);assert.ok(!JSON.stringify(entry).includes('private'));
 assert.throws(()=>L.capture({...record,id:'another'},state),/不符/);assert.throws(()=>L.capture({...record,status:'playing'},state),/不符/);assert.throws(()=>L.capture(record,state),/不符/);
 const b=example();assert.throws(()=>L.capture({...b.record,date:'2020-01-04'},b.state),/不符/);
});
test('CSV preserves rows, monetary precision, negative numbers and escaped multiline text without formula execution',()=>{
 const {entry}=example('abc',' =HYPERLINK("bad")\n第二行,逗號');entry.log[1].realizedPnl=-123.45;
 const csv=L.csv(entry);assert.ok(csv.startsWith('\ufeff"startDate","earlySettlementDate","dateJumps","date"'));assert.ok(csv.includes('"\' =HYPERLINK(""bad"")\n第二行,逗號"'));assert.ok(csv.includes('"-123.45"'));assert.ok(!csv.includes('"\'-123.45"'));assert.ok(csv.includes('"97.65"'));
 assert.equal(L.filename(entry),'台股戰士-操作紀錄-人生模式-2020-01-03-abc.csv');assert.ok(!L.filename({...entry,id:'../../bad?/name'}).includes('/'));
});
test('separate run archives survive reopening and reject a different date, status, or operation count',async()=>{
 const db=backend(),store=new L.Store({backend:db}),a=example(),b=example('round-b','第二輪成交');await store.save(a.entry);await store.save(b.entry);
 const reopened=new L.Store({backend:db});assert.equal((await reopened.get(a.record)).log[1].text,'買進 0050');assert.equal((await reopened.get(b.record)).log[1].text,'第二輪成交');
 for(const changes of [{id:'missing'},{date:'2020-02-01'},{status:'playing'},{operationCount:99},{equity:1}])assert.equal(await reopened.get({...a.record,...changes}),null);
 const copy=await reopened.get(a.record);copy.log[1].text='修改讀取結果';assert.equal((await reopened.get(a.record)).log[1].text,'買進 0050');
});
test('legacy summary alone is not fabricated; a matching full save recovers its actual operations',async()=>{
 const db=backend(),store=new L.Store({backend:db}),a=example();const legacy={...a.record};delete legacy.operationCount;
 assert.equal(await store.get(legacy),null);await store.recover(legacy,a.state);assert.equal((await store.get(legacy)).log.length,2);
 assert.throws(()=>store.recover({...legacy,id:'other'},a.state),/不符/);
});
test('ordered writes, recovery and pruning retain the newest accepted snapshot; clearing waits for pending writes',async()=>{
 const db=backend(),store=new L.Store({backend:db}),a=example(),b=example('round-b');const saved=store.save(a.entry);a.entry.log[1].text='排程後修改';await saved;assert.equal((await store.get(a.record)).log[1].text,'買進 0050');
 const next={...a.record,date:'2020-01-06',operationCount:3},nextState={...a.state,history:[{date:next.date}],log:[...a.state.log,{date:next.date,type:'cancel',text:'取消第三筆'}]};await store.save(L.capture(next,nextState));assert.equal(await store.get(a.record),null);assert.equal((await store.get(next)).log.length,3);
 await store.save(b.entry);await store.prune([next.id]);assert.equal(await store.get(b.record),null);assert.ok(await store.get(next));
 const writing=store.save(b.entry),clearing=store.clear();await Promise.all([writing,clearing]);assert.equal(db.rows.size,0);
});
test('a failed archive write does not poison later writes or clearing',async()=>{
 const db=backend(),put=db.put;let first=true;db.put=async entry=>{if(first){first=false;throw Error('quota');}return put(entry);};const store=new L.Store({backend:db}),a=example();
 await assert.rejects(store.save(a.entry),/quota/);assert.equal(await store.get(a.record),null);await store.save(a.entry);assert.ok(await store.get(a.record));await store.clear();assert.equal(db.rows.size,0);
 const unsupported=new L.Store({indexedDB:null});await unsupported.clear();
});
