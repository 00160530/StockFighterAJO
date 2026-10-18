import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={};vm.createContext(c);for(const f of ['engine','events','records'])vm.runInContext(fs.readFileSync(new URL('../js/'+f+'.js',import.meta.url),'utf8'),c);
const dates=['2020-01-02','2020-01-03','2020-01-06','2020-01-07','2020-01-08','2020-01-09','2020-01-10','2020-01-13'];
test('130 to 166 percent recovery defers liquidation and retains notice, then a later breach gets one day to top up',()=>{const f=fixture([100,75,80,85,90,75,70,70]);f.queue('buy');f.m.next(f.s);f.m.next(f.s);assert.ok(f.s.margin.call);f.m.acknowledgeMargin(f.s);f.m.next(f.s);f.m.next(f.s);assert.ok(f.s.margin.call.deferred);assert.equal(f.s.margin.call.disposeDay,undefined);assert.equal(f.s.margin.liquidations,0);f.m.next(f.s);assert.ok(f.s.margin.call);assert.equal(f.m.marginInfo(f.s).maintenance,150);f.m.next(f.s);assert.equal(f.s.margin.call.disposeDay,f.s.day+1);assert.equal(f.s.margin.liquidations,0);assert.doesNotThrow(()=>f.m.validate(JSON.parse(JSON.stringify(f.s))));f.m.acknowledgeMargin(f.s);f.m.next(f.s);assert.equal(f.s.margin.liquidations,1);});
test('166 percent recovery cancels notice and a due opening at 130 percent prevents sale without using future close',()=>{const f=fixture([100,75,75,75,100,100,100,100]);f.queue('buy');f.m.next(f.s);while(f.s.day<3){if(f.m.marginNeedsAction(f.s))f.m.acknowledgeMargin(f.s);f.m.next(f.s);}assert.equal(f.s.margin.call.disposeDay,4);f.m.acknowledgeMargin(f.s);f.m.next(f.s);assert.equal(f.s.margin.liquidations,0);assert.equal(f.s.margin.call,null);const g=fixture([100,75,75,75,70,70,70,70],[100,75,75,75,80,80,80,80]);g.queue('buy');g.m.next(g.s);while(g.s.day<3){if(g.m.marginNeedsAction(g.s))g.m.acknowledgeMargin(g.s);g.m.next(g.s);}g.m.acknowledgeMargin(g.s);g.m.next(g.s);assert.equal(g.s.margin.liquidations,0);assert.equal(g.s.margin.call.disposeDay,5,'open recovery defers but a new closing breach schedules next session');});
function fixture(prices=[100,90,81,75,70,65,60,50],opens=prices,mode='free'){
 const inst=(id,ps)=>({name:id,tradable:true,rows:[['2019-12-31',100,100,100,100,1000],...dates.map((d,i)=>[d,opens===prices?ps[i]:id==='2330'?opens[i]:ps[i],Math.max(ps[i],opens[i]),Math.min(ps[i],opens[i]),ps[i],1000])],dividends:[],splits:[],chips:{}});
 const data={start:dates[0],end:dates.at(-1),target:dates.at(-1),calendar:dates,instruments:{'0050':inst('0050',dates.map(()=>100)),'2330':inst('2330',prices)}},m=c.TaiguEngine.createMarket(data),s=m.fresh(mode,true);s.opening=false;
 if(mode==='life')m.next(s);const queue=(side,qty=1000,financing='margin',size='fixed')=>{if(mode==='life')m.openWindow(s,'test-'+s.day);m.queue(s,'2330',side,qty,size,financing);};
 return {m,s,data,queue};
}
test('margin is locked by default; completed life loses unlock margin, only a win unlocks free, bankruptcy does not unlock',()=>{
 const {m}=fixture();const locked=m.fresh();locked.opening=false;assert.throws(()=>m.queue(locked,'2330','buy',1,'fixed','margin'));
 const lost={mode:'life',status:'lost',runId:'first'},p=c.TaiguEvents.progression(null,lost);assert.equal(p.marginUnlocked,true);assert.equal(p.freeUnlocked,true);
 const won=c.TaiguEvents.progression(null,{...lost,status:'won'});assert.equal(won.freeUnlocked,true);assert.equal(won.marginUnlocked,true);
 assert.equal(c.TaiguEvents.progression(null,{...lost,status:'bankrupt'}).marginUnlocked,false);assert.equal(c.TaiguEvents.progression(p).marginUnlocked,true);
 assert.equal(c.TaiguEvents.progression(null,{...lost,life:{eligibleForUnlock:false}}).marginUnlocked,false);
});
test('next-open margin buy funds 40 percent plus fees, deducts principal and interest from equity, and ratio follows 166.67 → 150 → 135',()=>{
 const {m,s,queue}=fixture();queue('buy');m.next(s);const i=m.marginInfo(s);assert.equal(i.principal,60000);assert.equal(s.cash,959857);assert.equal(i.interest,10.27);assert.ok(Math.abs(i.maintenance-166.6666667)<1e-6);assert.equal(m.equity(s,m.date(s)),999846.73);
 m.next(s);assert.equal(m.marginInfo(s).maintenance,150);m.next(s);assert.equal(m.marginInfo(s).maintenance,135);assert.equal(m.marginInfo(s).totalBorrowed,60000);
});
test('annual 6.25 percent simple interest accrues calendar days including weekends and is repaid on sale without double charge',()=>{
 const {m,s,queue}=fixture(dates.map(()=>100));queue('buy');m.next(s);m.next(s);queue('sell');m.next(s);assert.equal(s.margin.interestPaid,51.36);assert.equal(s.margin.totalInterest,51.36);assert.equal(m.marginInfo(s).principal,0);assert.equal(m.marginInfo(s).interest,0);assert.equal(s.cash,999362.64);
});
test('three trading-day call choices precede fourth-day OPEN liquidation in both modes, even when life trade window is closed',()=>{
 for(const mode of ['life','free']){const {m,s,queue}=fixture([100,100,81,75,70,65,60,50],undefined,mode);queue('buy');while(!s.margin.call)m.next(s);assert.equal(s.margin.call.startedDay,3);for(let day=3;day<=5;day++){assert.equal(s.day,day);assert.equal(m.marginNeedsAction(s),true);assert.throws(()=>m.next(s));m.acknowledgeMargin(s);m.next(s);}const sale=s.log.find(l=>l.forced&&l.financing==='margin');assert.equal(sale.date,dates[6]);assert.equal(sale.price,60);assert.equal(s.margin.liquidations,1);assert.equal(s.margin.call,null);assert.equal(m.available(s,'2330','margin'),0);}
});
test('topup uses existing cash, preserves equity, partial topup retains call, sufficient topup clears and collateral releases on final sale',()=>{
 const {m,s,queue}=fixture();queue('buy');for(let i=0;i<4;i++)m.next(s);const before=m.equity(s,m.date(s)),cash=s.cash;assert.equal(m.marginInfo(s).requiredTopup,25000);m.topupMargin(s,1000);assert.equal(s.cash,cash-1000);assert.equal(m.equity(s,m.date(s)),before);assert.ok(s.margin.call);m.topupMargin(s,24000);assert.equal(s.margin.call,null);assert.ok(m.marginInfo(s).maintenance>=166.66666);assert.equal(s.margin.totalTopups,25000);queue('sell');m.next(s);assert.equal(s.margin.collateral,0);assert.equal(m.marginInfo(s).principal,0);
});
test('fourth-day gap can cause negative cash bankruptcy and persistent debt achievement without granting a completion unlock',()=>{
 const prices=[100,90,81,75,70,65,30,30],{m,s,queue}=fixture(prices,prices);queue('buy',20000);for(let i=0;i<4;i++)m.next(s);for(let i=0;i<3;i++){m.acknowledgeMargin(s);m.next(s);}assert.equal(s.status,'bankrupt');assert.equal(s.bankruptcyReason,'margin-debt');assert.ok(s.cash<0);assert.equal(s.margin.liquidations,1);assert.equal(c.TaiguEvents.progression(null,s).marginDebtAchievement,true);assert.equal(c.TaiguEvents.progression(null,s).marginUnlocked,false);assert.doesNotThrow(()=>m.validate(JSON.parse(JSON.stringify(s))));
});
test('cash and margin holdings sell independently; highlights include allocated interest and records separate financing editions',()=>{
 const {m,s,queue}=fixture(dates.map(()=>100));queue('buy');m.next(s);queue('buy',500,'cash');m.next(s);queue('sell',250,'cash');m.next(s);assert.equal(m.available(s,'2330'),250);assert.equal(m.available(s,'2330','margin'),1000);queue('sell',500);m.next(s);
 const sale=s.log.at(-1),stats=c.TaiguRecords.tradeStats(m.data,s.log);assert.equal(stats.statsComplete,true);assert.equal(stats.trades,4);assert.ok(sale.interestPaid>0);assert.equal(stats.maxLoss.pnl,sale.realizedPnl);const snap=c.TaiguRecords.snapshot(m,s);assert.equal(snap.margin.totalBorrowed,60000);assert.equal(snap.financing,'margin');assert.ok(snap.ruleset.endsWith(':margin-v1'));// Financing metadata remains available even though public boards are unified.
assert.equal(c.TaiguRecords.inventory(m,s).rows[0].marginQty,500);
});
test('all margin uses actual next-open affordability and cancelled or rejected orders never count as borrowing',()=>{
 const {m,s,queue}=fixture(dates.map(()=>100));queue('buy',1,'margin','all');m.cancel(s,'2330');m.next(s);assert.equal(s.margin.totalBorrowed,0);queue('buy',100000000);m.next(s);assert.equal(s.margin.totalBorrowed,0);queue('buy',1,'margin','all');m.next(s);assert.ok(s.cash>=0);assert.ok(s.cash<100);assert.ok(s.margin.totalBorrowed>1000000);
});
test('margin split, dividends and suspended liquidation preserve principal, and pending calls survive save reload',()=>{
 const {m,s,data,queue}=fixture(dates.map(()=>100));data.instruments['2330'].splits=[{date:dates[2],ratio:4}];data.instruments['2330'].dividends=[{ex:dates[1],pay:dates[3],amount:1}];queue('buy');m.next(s);m.next(s);assert.equal(s.receivables[0].amount,1000);m.next(s);assert.equal(s.margin.positions['2330'].qty,4000);assert.equal(s.margin.positions['2330'].principal,60000);assert.equal(s.holdings['2330'].qty,4000);assert.doesNotThrow(()=>m.validate(JSON.parse(JSON.stringify(s))));
 const f=fixture();f.queue('buy');for(let i=0;i<4;i++)f.m.next(f.s);const restored=f.m.validate(JSON.parse(JSON.stringify(f.s)));assert.equal(f.m.marginNeedsAction(restored),true);assert.throws(()=>f.m.validate({...restored,margin:{...restored.margin,collateral:-1}}));assert.throws(()=>f.m.validate({...restored,orders:[{id:'2330',side:'sell',qty:1,financing:'fake'}]}));
});
