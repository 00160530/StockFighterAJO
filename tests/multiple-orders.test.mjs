import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/engine.js',import.meta.url),'utf8'),c);
const dates=['2020-01-02','2020-01-03','2020-01-06','2020-01-07','2020-01-08'],rows=['2019-12-31',...dates].map(d=>[d,100,100,100,100,1000]),inst=()=>({name:'測試股',tradable:true,rows,dividends:[],splits:[],chips:{}}),data={start:dates[0],end:dates.at(-1),target:dates.at(-1),calendar:dates,instruments:{'0050':inst(),'2330':inst()}},m=c.TaiguEngine.createMarket(data),copy=x=>JSON.parse(JSON.stringify(x));
const fresh=(margin=false,skills=null)=>{const s=m.fresh('free',margin,skills);s.opening=false;return s;};
test('same-stock buys execute separately in submission order and each pays its own fee',()=>{
 const s=fresh(),orders=[100,200,300].map(q=>m.queue(s,'0050','buy',q));assert.equal(new Set(orders.map(o=>o.orderId)).size,3);assert.equal(s.cash,1000000);m.next(s);
 const fills=s.log.filter(l=>l.type==='fill');assert.deepEqual(Array.from(fills,t=>t.orderId),orders.map(o=>o.orderId));assert.equal(s.holdings['0050'].qty,600);assert.equal(s.cash,1000000-orders.reduce((n,o)=>n+o.qty*100+c.TaiguEngine.fee(o.qty*100),0));assert.equal(s.orders.length,0);
});
test('a rejected middle buy neither consumes cash nor prevents a later affordable same-stock buy',()=>{
 const s=fresh();s.cash=1000;const a=m.queue(s,'0050','buy',4),b=m.queue(s,'0050','buy',6),d=m.queue(s,'0050','buy',2);m.next(s);
 assert.deepEqual(Array.from(s.log.filter(l=>l.type==='fill'),l=>l.orderId),[a.orderId,d.orderId]);assert.equal(s.log.find(l=>l.type==='rejected').orderId,b.orderId);assert.equal(s.cash,360);assert.equal(s.holdings['0050'].qty,6);
});
test('multiple sells cannot oversell shared holdings and a failed sell leaves later orders intact',()=>{
 const s=fresh();s.holdings['0050']={qty:1000,cost:100000};[600,500,400].forEach(q=>m.queue(s,'0050','sell',q));m.next(s);
 assert.deepEqual(Array.from(s.log.filter(l=>l.type==='fill'),l=>l.qty),[600,400]);assert.equal(s.log.filter(l=>l.type==='rejected').length,1);assert.equal(s.holdings['0050'],undefined);assert.ok(s.cash>1000000);assert.doesNotThrow(()=>m.validate(copy(s)));
});
test('same-stock cash and margin orders preserve separate positions, loans and sell availability',()=>{
 const s=fresh(true);m.queue(s,'0050','buy',100);m.queue(s,'0050','buy',200,'fixed','margin');m.queue(s,'0050','buy',300,'fixed','margin');m.next(s);
 assert.equal(s.holdings['0050'].qty,600);assert.equal(s.margin.positions['0050'].qty,500);assert.equal(s.margin.positions['0050'].principal,30000);assert.equal(m.available(s,'0050'),100);
 m.queue(s,'0050','sell',50);m.queue(s,'0050','sell',100,'fixed','margin');m.queue(s,'0050','sell',400,'fixed','margin');m.next(s);
 assert.equal(s.holdings['0050'].qty,50);assert.equal(s.margin.positions['0050'],undefined);assert.equal(m.skillInfo(s).debt,0);assert.equal(s.log.filter(l=>l.type==='fill').length,6);assert.doesNotThrow(()=>m.validate(copy(s)));
});
test('more than four same-stock pending orders survive reload and cancelling one preserves the others',()=>{
 const s=fresh(),orders=Array.from({length:6},(_,i)=>m.queue(s,'0050','buy',i+1)),saved=copy(s),restored=m.validate(saved);assert.deepEqual(copy(restored),saved);
 m.cancel(restored,orders[2].orderId);assert.deepEqual(Array.from(restored.orders,o=>o.orderId),orders.filter((_,i)=>i!==2).map(o=>o.orderId));const added=m.queue(restored,'0050','buy',10);assert.ok(!orders.some(o=>o.orderId===added.orderId));
 assert.throws(()=>m.validate({...saved,orders:[saved.orders[0],{...saved.orders[1],orderId:saved.orders[0].orderId}]}));assert.throws(()=>m.validate({...saved,orders:[{...saved.orders[0],orderId:'bad-id'}]}));
});
test('old pending orders without order IDs still load, cancel independently and accept additional same-stock orders',()=>{
 const s=fresh();m.queue(s,'0050','buy',10);m.queue(s,'2330','buy',10);for(const o of s.orders)delete o.orderId;const old=m.validate(copy(s)),added=m.queue(old,'0050','buy',20);m.cancel(old,added.orderId);assert.equal(old.orders.length,2);m.cancel(old,'0050');assert.equal(old.orders.length,1);assert.equal(old.orders[0].id,'2330');m.next(old);assert.equal(old.holdings['2330'].qty,10);
});
test('repeated all orders recalculate against remaining cash or holdings without duplicate spending or selling',()=>{
 const s=fresh();s.cash=1000;m.queue(s,'0050','buy',9,'all');m.queue(s,'0050','buy',9,'all');m.next(s);assert.equal(s.holdings['0050'].qty,9);assert.equal(s.cash,80);assert.equal(s.log.filter(l=>l.type==='rejected').length,1);
 m.queue(s,'0050','sell',9,'all');m.queue(s,'0050','sell',9,'all');m.next(s);assert.equal(s.holdings['0050'],undefined);assert.equal(s.log.filter(l=>l.type==='fill').length,2);assert.equal(s.log.filter(l=>l.type==='rejected').length,2);
});
test('date jumps and early settlement cancel every individual pending order for the same stock',()=>{
 for(const action of ['jump','remote']){const s=fresh(false,{calendar:2});m.next(s);const orders=[m.queue(s,'0050','buy',10),m.queue(s,'0050','buy',20)];if(action==='jump')m.jumpDate(s,dates[2]);else m.fastForward(s,{unlocked:true});assert.equal(s.orders.length,0);assert.equal(s.log.filter(l=>l.type==='fill').length,0);assert.deepEqual(Array.from(s.log.filter(l=>l.type==='cancel'),l=>l.orderId),orders.map(o=>o.orderId));assert.doesNotThrow(()=>m.validate(copy(s)));}
});
test('pending-order capacity is consistent between submission and saved-state validation',()=>{
 const s=fresh();for(let i=0;i<100;i++)m.queue(s,'0050','buy',1);assert.doesNotThrow(()=>m.validate(copy(s)));const before=copy(s);assert.throws(()=>m.queue(s,'0050','buy',1));assert.deepEqual(copy(s),before);assert.throws(()=>m.validate({...copy(s),orders:[...s.orders,{...s.orders[0],orderId:'order-100000'}]}));
});
