import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/records.js',import.meta.url),'utf8'),c);const R=c.TaiguRecords;
function run(id,at,extra={}){return{id,at,date:'2024-01-03',mode:'life',reason:'completed',status:'lost',equity:1200000,benchmark:1600000,cash:100000,returnPct:20,alpha:-40,maxDrawdown:10,trades:2,fees:100,tax:0,spent:0,choices:5,sessions:976,...extra};}
test('history lists both modes and all outcomes by most recent play, not largest assets or game date',()=>{
 const old=run('old','2026-10-01T00:00:00Z',{equity:9000000,status:'won',date:'2026-10-16'}),newer=run('new','2026-10-03T00:00:00Z',{status:'playing',reason:'restarted',date:'2020-01-03'}),free=run('free','2026-10-02T00:00:00Z',{mode:'free',status:'bankrupt'}),book={runs:[old,newer,free]};
 assert.deepEqual(Array.from(R.history(book),r=>r.id),['new','free','old']);assert.deepEqual(Array.from(R.history(book,[],'life'),r=>r.id),['new','old']);assert.deepEqual(Array.from(R.history(book,[],'free'),r=>r.id),['free']);assert.equal(book.runs[0],old);
});
test('current and saved snapshots deduplicate by run ID and a resumed older checkpoint cannot erase a completed result',()=>{
 const completed=run('same','2026-10-01T00:00:00Z'),current=run('same','2026-10-03T00:00:00Z',{status:'playing',reason:'current'}),paused=run('paused','2026-10-01T00:00:00Z',{status:'playing',reason:'current'}),advanced={...paused,at:'2026-10-03T00:00:00Z',equity:1400000};
 const rows=R.history({runs:[completed,paused]},[current,advanced,advanced]);assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id==='same').status,'lost');assert.equal(rows.find(r=>r.id==='paused').equity,1400000);
});
test('invalid snapshots are ignored, history keeps the latest 100 and opening history never calls cloud services',()=>{
 const book={runs:Array.from({length:100},(_,i)=>run('r'+i,new Date(Date.UTC(2026,0,1,0,0,i)).toISOString()))},current=run('current','2026-10-18T00:00:00Z');const rows=R.history(book,[null,{id:'corrupt'},current]);assert.equal(rows.length,100);assert.equal(rows[0].id,'current');assert.equal(rows.some(r=>r.id==='r0'),false);assert.equal(R.history(null).length,0);
 const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8'),start=app.indexOf('function showRunHistory('),end=app.indexOf('function showRunStats(',start);const body=app.slice(start,end);assert.ok(!/\bonline\.|\bfetch\(|communityHome\.|showOnlineSubmit\(/.test(body));
});
test('an unchanged autosave timestamp cannot replace the last actually played record after reload',()=>{
 const paused=run('paused','2026-10-01T00:00:00Z',{status:'playing',reason:'current'}),latest=run('latest','2026-10-02T00:00:00Z',{mode:'free',equity:2345678}),autosave={...paused,at:'2026-10-18T00:00:00Z'};
 const rows=R.history({runs:[paused,latest]},[autosave]);assert.equal(rows[0].id,'latest');assert.equal(rows[1].at,paused.at);
});
