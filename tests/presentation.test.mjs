import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={window:{},setTimeout,clearTimeout};vm.createContext(c);
for(const f of ['data/market.js','js/engine.js','js/records.js','js/playback.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const market=c.TaiguEngine.createMarket(c.window.TAIGU_DATA),R=c.TaiguRecords;
test('playback paints every session in order and stops at event without processing future days',async()=>{
 const p=new c.TaiguPlayback.Runner(),frames=[];let day=0,speed=300;const intervals=[];p.wait=async ms=>{intervals.push(ms);speed=100;};
 const moved=await p.run({limit:100,step:()=>{day++;return true;},paint:()=>frames.push(day),shouldStop:()=>day===4,interval:()=>speed});
 assert.equal(moved,4);assert.deepEqual(frames,[1,2,3,4]);assert.deepEqual(intervals,[300,100,100]);assert.equal(p.running,false);
});
test('pause cancels a waiting timer immediately and resume does not skip or double-process a date',async()=>{
 const p=new c.TaiguPlayback.Runner(),frames=[];let day=0;let frameReady;const firstFrame=new Promise(r=>frameReady=r);
 const config={limit:10,step:()=>{day++;return true;},paint:()=>{frames.push(day);frameReady();},shouldStop:()=>day===3,interval:()=>10000};
 const run=p.run(config);await firstFrame;p.stop();assert.equal(await run,1);assert.equal(day,1);assert.equal(p.running,false);
 config.interval=()=>0;assert.equal(await p.run(config),2);assert.deepEqual(frames,[1,2,3]);
});
test('daily playback retains next-open orders, all valuation points and corporate actions',async()=>{
 const s=market.fresh('life');s.opening=false;market.next(s);market.openWindow(s,'test');market.queue(s,'0050','buy',100);s.life.until=s.day-1;
 const frames=[],p=new c.TaiguPlayback.Runner();p.wait=async()=>{};
 await p.run({limit:market.data.calendar.length,step:()=>market.next(s),paint:()=>frames.push(market.date(s)),shouldStop:()=>market.date(s)==='2025-06-18',interval:()=>0});
 assert.equal(s.log.find(l=>l.type==='fill').date,'2020-01-03');assert.equal(s.holdings['0050'].qty,400);assert.ok(s.log.some(l=>l.type==='dividend'));assert.equal(s.history.length,s.day+2);
 assert.deepEqual(frames,Array.from(market.data.calendar.slice(1,s.day+1)));
});
test('inventory uses current holdings and known prices, weighted costs and dates of the current holding cycle',()=>{
 const s=market.fresh();s.opening=false;market.next(s);market.queue(s,'2330','buy',100);market.next(s);market.queue(s,'2330','buy',100);market.next(s);market.queue(s,'2330','sell',50);market.next(s);
 const v=R.inventory(market,s),r=v.rows[0];assert.equal(r.qty,150);assert.equal(r.firstBuy,'2020-01-03');assert.equal(r.lastBuy,'2020-01-06');assert.equal(r.price,market.bar('2330',market.date(s))[4]);assert.equal(r.cost,s.holdings['2330'].cost);assert.equal(r.average,r.cost/150);assert.equal(r.pnl,Math.round((r.price*150-r.cost)*100)/100);assert.equal(r.trades.length,3);assert.equal(v.equity,Math.round((v.cash+v.value+v.receivable)*100)/100);
 market.queue(s,'2330','sell',150);market.next(s);assert.equal(R.inventory(market,s).rows.length,0);market.queue(s,'2330','buy',10);market.next(s);assert.equal(R.inventory(market,s).rows[0].firstBuy,market.date(s));
});
test('inventory follows split and suspension without pretending old prices are current',()=>{
 const s=market.fresh();s.opening=false;while(market.date(s)<'2025-06-09')market.next(s);market.queue(s,'0050','buy',100);market.next(s);const cost=s.holdings['0050'].cost;
 while(market.date(s)<'2025-06-17')market.next(s);let r=R.inventory(market,s).rows[0];assert.ok(r.priceDate<market.date(s));assert.equal(r.cost,cost);market.next(s);r=R.inventory(market,s).rows[0];assert.equal(r.qty,400);assert.equal(r.average,cost/400);assert.equal(r.firstBuy,'2025-06-10');assert.equal(r.priceDate,'2025-06-18');
});
test('mode-specific ranking keeps gains and losses isolated as well as the main score',()=>{
 const s=market.fresh('life');s.opening=false;s.runId='life';s.status='won';const a=R.snapshot(market,s,'completed');Object.assign(a,{maxGain:{id:'2330',date:'2020-01-03',qty:1,price:100,costBasis:50,proceeds:100,pnl:50,returnPct:100},maxLoss:{id:'2330',date:'2020-01-03',qty:1,price:20,costBasis:50,proceeds:20,pnl:-30,returnPct:-60}});const b={...a,id:'free',mode:'free',ruleset:'tw-v1',alpha:999},book={runs:[a,b]};
 for(const [ruleset,id]of [['tw-life-v1','life'],['tw-v1','free']]){assert.deepEqual(Array.from(R.leaderboard(book,'won',{ruleset,datasetEnd:market.data.end}),r=>r.id),[id]);assert.equal(R.leaderboard(book,'lost',{ruleset,datasetEnd:market.data.end}).length,0);}
});
