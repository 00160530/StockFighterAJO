import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={window:{},setTimeout,clearTimeout};vm.createContext(c);for(const f of ['data/market.js','js/engine.js','js/story.js','js/playback.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);const m=c.TaiguEngine.createMarket(c.window.TAIGU_DATA),fresh=mode=>{const s=m.fresh(mode);s.opening=false;m.next(s);return s;},copy=x=>JSON.parse(JSON.stringify(x));
const choices=[{label:'付費選項',cost:5000,stress:5},{label:'免費選項',stress:-3}],event=(id,index)=>({id,date:m.data.calendar[index],choices});
test('free mode can trade and leave an unchosen event without applying a choice or spending story money',()=>{
 const s=fresh('free'),e=event('optional',0);m.trigger(s,[e]);const stress=s.stress;assert.equal(m.canTrade(s),true);m.queue(s,'0050','buy',100);m.next(s);assert.equal(s.activeEvent,null);assert.ok(s.seen.includes(e.id));assert.equal(s.spent,0);assert.equal(s.stress,Math.max(0,stress-1));assert.equal(s.log.filter(l=>l.type==='story').length,0);assert.equal(s.log.filter(l=>l.type==='story-skip').length,1);assert.equal(s.holdings['0050'].qty,100);m.trigger(s,[e]);assert.equal(s.activeEvent,null);
});
test('free players can still choose an event and its cost and stress apply exactly once',()=>{
 const s=fresh('free'),e=event('chosen',0);m.trigger(s,[e]);const cash=s.cash,stress=s.stress;m.choose(s,e,e.choices[0]);assert.equal(s.cash,cash-5000);assert.equal(s.spent,5000);assert.equal(s.stress,stress+5);m.next(s);assert.equal(s.log.filter(l=>l.type==='story').length,1);assert.equal(s.log.filter(l=>l.type==='story-skip').length,0);
});
test('continuous free playback still stops on each event and a new advance skips only the previous unchosen event',async()=>{
 const s=m.fresh('free');s.opening=false;const events=[event('first',0),event('second',2)],runner=new c.TaiguPlayback.Runner(),run=()=>runner.run({limit:30,step:()=>{if(!m.next(s))return false;m.trigger(s,events);return true;},paint:async()=>{},shouldStop:()=>!!s.activeEvent||s.status!=='playing',interval:()=>0});assert.equal(await run(),1);assert.equal(s.activeEvent,'first');assert.equal(await run(),2);assert.equal(s.activeEvent,'second');assert.equal(s.day,2);assert.ok(s.seen.includes('first'));assert.ok(!s.seen.includes('second'));
});
test('life mode continues to require a choice and invalid progression never silently skips its event',()=>{
 const s=fresh('life');m.trigger(s,[event('required',0)]);const before=copy(s);assert.equal(m.canTrade(s),false);assert.throws(()=>m.queue(s,'0050','buy',100),/劇情選擇/);assert.throws(()=>m.next(s),/劇情選擇/);assert.deepEqual(copy(s),before);
});
test('old free saves with an unchosen event can resume; blocked trading never marks the event skipped',()=>{
 const s=fresh('free');m.trigger(s,[event('restored',0)]);const restored=m.validate(copy(s));assert.equal(m.next(restored),true);assert.ok(restored.seen.includes('restored'));assert.equal(restored.activeEvent,null);
 const blocked=fresh('free');m.trigger(blocked,[event('not-skipped',0)]);blocked.supportGames=[{choice:'pending'}];const before=copy(blocked);assert.throws(()=>m.next(blocked),/支撐線/);assert.deepEqual(copy(blocked),before);
});
