import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={window:{},setTimeout,clearTimeout};vm.createContext(c);for(const f of ['data/market.js','js/engine.js','js/playback.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const m=c.TaiguEngine.createMarket(c.window.TAIGU_DATA),copy=x=>JSON.parse(JSON.stringify(x)),fresh=()=>{const s=m.fresh('free',false,{mother:5,calendar:5});s.opening=false;m.next(s);return s;},to=(s,index)=>{while(s.day<index)assert.equal(m.next(s),true);};
test('mother repayment reminders occur once at exactly 20, 10, 5 and 1 actual trading sessions before repayment',()=>{
 const s=fresh(),loan=m.borrowMother(s,100000),due=m.data.calendar.findIndex(d=>d>=loan.due),hits=[];
 while(s.day<due){for(const n of m.motherReminders(s)){hits.push(n.days);assert.equal(n.amount,100000);assert.equal(n.paymentDate,loan.due);const before={cash:s.cash,equity:m.equity(s),remaining:s.skills.loans[0].remaining};m.acknowledgeMotherReminders(s);assert.equal(s.cash,before.cash);assert.equal(m.equity(s),before.equity);assert.equal(s.skills.loans[0].remaining,before.remaining);assert.equal(m.motherReminders(s).length,0);}m.next(s);}
 assert.deepEqual(hits,[20,10,5,1]);assert.equal(s.skills.loans[0].remaining,0);assert.equal(m.motherReminders(s).length,0);assert.equal(s.log.filter(l=>l.type==='mother-reminder').length,4);
});
test('same-day borrowing shows the combined amount and different due dates retain independent reminder stages',()=>{
 const s=fresh(),a=m.borrowMother(s,100000);m.borrowMother(s,50000);m.next(s);const b=m.borrowMother(s,200000),first=m.data.calendar.findIndex(d=>d>=a.due);to(s,first-20);
 const one=m.acknowledgeMotherReminders(s);assert.equal(one.length,1);assert.equal(one[0].amount,150000);assert.equal(one[0].due,a.due);m.next(s);const two=m.motherReminders(s);assert.equal(two.length,1);assert.equal(two[0].due,b.due);assert.equal(two[0].amount,200000);
});
test('save/reload, repeated rendering and late legacy saves do not replay old reminder stages',()=>{
 const s=fresh(),loan=m.borrowMother(s,100000),due=m.data.calendar.findIndex(d=>d>=loan.due);to(s,due-8);assert.equal(m.motherReminders(s)[0].threshold,10);m.acknowledgeMotherReminders(s);const restored=m.validate(copy(s));assert.equal(m.motherReminders(restored).length,0);assert.deepEqual(Array.from(restored.skills.loans[0].reminded),[20,10]);to(restored,due-5);assert.equal(m.motherReminders(restored)[0].days,5);
 for(const reminded of [[20,20],[7],'20',[20,10,5,1,1]]){const bad=copy(s);bad.skills.loans[0].reminded=reminded;assert.throws(()=>m.validate(bad),/還款提醒/);}
});
test('a non-trading contractual due date uses the next actual trading session and skips holidays when counting',()=>{
 const s=fresh();to(s,m.data.calendar.indexOf('2020-01-06'));const loan=m.borrowMother(s,100000);assert.equal(loan.due,'2020-07-06');
 const dates=['2020-01-03','2020-01-06','2020-06-25','2020-06-29','2020-06-30','2020-07-01','2020-07-02','2020-07-03','2020-07-06'],d=copy(m.data);d.calendar=dates;d.start=dates[0];d.end=dates.at(-1);d.target=d.end;for(const inst of Object.values(d.instruments)){inst.rows=[['2019-12-31',100,100,100,100,100],...dates.map(date=>[date,100,100,100,100,100])];inst.dividends=[];inst.splits=[];inst.stockDividends=[];inst.capitalActions=[];}
 const local=c.TaiguEngine.createMarket(d),x=local.fresh('free',false,{mother:1});x.opening=false;local.next(x);const borrowed=local.borrowMother(x,100000);assert.equal(borrowed.due,'2020-07-03');
 // Remove the contractual Friday from the simulated exchange calendar to represent a holiday.
 const calendar=d.calendar.filter(day=>day!=='2020-07-03'),holidayMarket=c.TaiguEngine.createMarket({...d,calendar}),y=holidayMarket.fresh('free',false,{mother:1});y.opening=false;holidayMarket.next(y);holidayMarket.borrowMother(y,100000);const n=holidayMarket.motherReminders(y)[0];assert.equal(n.due,'2020-07-03');assert.equal(n.paymentDate,'2020-07-06');assert.equal(n.days,calendar.length-1-y.day);
});
test('continuous playback stops at a reminder instead of running through its date',async()=>{
 const s=fresh(),loan=m.borrowMother(s,100000),due=m.data.calendar.findIndex(d=>d>=loan.due);to(s,due-22);const runner=new c.TaiguPlayback.Runner(),moved=await runner.run({limit:50,step:()=>m.next(s),paint:async()=>{},shouldStop:()=>m.motherReminders(s).length>0,interval:()=>0});assert.equal(moved,2);assert.equal(s.day,due-20);
});
test('ending the round early ignores repaid loans, while a late loan warns before automatic end-of-round repayment',()=>{
 const s=fresh();to(s,m.data.calendar.length-6);m.borrowMother(s,100000);const n=m.acknowledgeMotherReminders(s)[0];assert.equal(n.days,5);assert.equal(n.settlement,true);assert.equal(n.paymentDate,m.data.end);m.fastForward(s,{unlocked:true});assert.equal(s.skills.loans[0].remaining,0);assert.equal(m.motherReminders(s).length,0);
});
test('date jumps show only the most urgent crossed stage, without replaying all skipped reminders',()=>{
 const s=fresh(),loan=m.borrowMother(s,100000),due=m.data.calendar.findIndex(d=>d>=loan.due);m.jumpDate(s,m.data.calendar[due-3]);const n=m.acknowledgeMotherReminders(s);assert.equal(n.length,1);assert.equal(n[0].days,3);assert.equal(n[0].threshold,5);assert.equal(m.motherReminders(s).length,0);to(s,due-1);assert.equal(m.motherReminders(s)[0].days,1);
});
