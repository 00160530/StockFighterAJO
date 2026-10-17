import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={window:{}};vm.createContext(c);
for(const f of ['data/market.js','js/engine.js','js/theatre.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const T=c.TaiguTheatre,m=c.TaiguEngine.createMarket(c.window.TAIGU_DATA),t=T.create(m);
const copy=x=>JSON.parse(JSON.stringify(x));
function small(prices=[100,96,90],split=[]){
 const dates=prices.map((_,i)=>'2020-01-'+String(i+2).padStart(2,'0')),data={calendar:dates,instruments:{'0050':{name:'台灣50',tradable:true,splits:split,rows:prices.map((p,i)=>[dates[i],p+2,p+3,p-2,p,100])}}};
 const market={data,date:s=>dates[s.day],visibleRows:(s,id)=>data.instruments[id].rows.filter(r=>r[0]<=dates[s.day]),latest:(id,d)=>data.instruments[id].rows.filter(r=>r[0]<=d).at(-1),record:(s,type,text,extra)=>s.log.push({date:dates[s.day],type,text,...extra})};
 const state={day:prices.length-1,mode:'life',status:'playing',opening:false,holdings:{'0050':{qty:100,cost:10000}},log:[{date:dates[0],type:'fill',id:'0050',side:'buy',qty:100,price:100}]};return {data,s:state,t:T.create(market)};
}
test('theatre compares latest actual buy, resets a closed position, and keeps strict 5% boundaries',()=>{
 const {s,t}=small([100,105,106]);assert.equal(t.reaction(s,'0050').title,'台股，簡單！');s.day=1;assert.equal(t.reaction(s,'0050').kind,'watch');
 s.log.push({date:'2020-01-03',type:'fill',id:'0050',side:'buy',qty:100,price:120});s.holdings['0050']={qty:200,cost:22000};s.day=2;assert.equal(t.reaction(s,'0050').title,'獲利去哪裡了？');assert.equal(t.position(s,'0050').entry,120);
 s.log.push({date:'2020-01-03',type:'fill',id:'0050',side:'sell',qty:200,price:105},{date:'2020-01-04',type:'fill',id:'0050',side:'buy',qty:100,price:106});assert.equal(t.position(s,'0050').firstBuy,'2020-01-04');
 const b=small([100,95,94]);b.s.day=1;assert.equal(b.t.reaction(b.s,'0050').kind,'watch');b.s.day=2;assert.equal(b.t.reaction(b.s,'0050').kind,'panic');
});
test('split-adjusted entry/rows only use splits and fills known at current date',()=>{
 const {s,t}=small([100,104,26],[{date:'2020-01-04',ratio:4}]);s.day=1;s.log.push({type:'fill',id:'0050',side:'buy',date:'2020-01-04',qty:1,price:999});assert.equal(t.position(s,'0050').entry,100);assert.equal(t.adjustedRows(s,'0050')[0][4],100);
 s.log.pop();s.day=2;s.holdings['0050'].qty=400;assert.equal(t.position(s,'0050').entry,25);assert.equal(t.reaction(s,'0050').kind,'watch');assert.equal(t.adjustedRows(s,'0050')[0][4],25);assert.equal(t.supportCandidate(s,'0050'),null);
});
test('cash-only falling watchlist uses serious expression and index selection falls back to 0050',()=>{
 const {s,t}=small();s.holdings={};assert.equal(t.reaction(s,'TAIEX').title,'現在買入一定爆賺');assert.equal(t.reaction(s,'0050').emotion,'serious');s.day=1;assert.equal(t.reaction(s,'0050').kind,'cash');assert.equal(t.supportCandidate(s,'0050'),null);
});
test('support requires two material consecutive falls, ownership throughout, life mode and cooldown',()=>{
 const {s,t}=small();assert.equal(t.supportCandidate(s,'0050').date,'2020-01-04');s.mode='free';assert.equal(t.supportCandidate(s,'0050'),null);s.mode='life';
 s.log[0].date='2020-01-03';assert.equal(t.supportCandidate(s,'0050'),null);s.log[0].date='2020-01-02';s.supportGames=[{id:'0050',date:'2020-01-04',taps:0,finished:false}];assert.equal(t.supportCandidate(s,'0050'),null);
 for(const prices of [[100,99,90],[100,96,94],[100,104,90]]){const b=small(prices);assert.equal(b.t.supportCandidate(b.s,'0050'),null);}
 const suspended=small();suspended.data.instruments['0050'].rows.splice(1,1);assert.equal(suspended.t.supportCandidate(suspended.s,'0050'),null);
});
test('real historical crash triggers; completed/pending records survive validation without economic effects',()=>{
 const s=m.fresh('life');s.opening=false;m.next(s);m.openWindow(s,'test');m.queue(s,'2330','buy',100);while(m.date(s)<'2022-10-11')m.next(s);
 const candidate=t.supportCandidate(s,'0050');assert.equal(candidate.id,'2330');assert.ok(candidate.rows.every(r=>r[0]<=m.date(s)));const before=copy(s);const row=t.begin(s,candidate);assert.equal(m.validate(copy(s)).supportGames[0].finished,false);assert.equal(t.supportCandidate(s,'2330'),null);t.finish(s,row,37);assert.equal(m.validate(copy(s)).supportGames[0].taps,37);
 const after=copy(s);delete after.supportGames;after.log.pop();assert.deepEqual(after,before);assert.equal(s.log.at(-1).type,'minigame');
 for(const g of [{...row,date:'2099-01-01'},{...row,taps:-1},{...row,id:'TAIEX'},{...row,finished:1}])assert.throws(()=>m.validate({...s,supportGames:[g]}),/支撐線/);
 assert.throws(()=>m.validate({...s,supportGames:[row,row]}),/支撐線/);
 while(s.day<m.data.calendar.indexOf('2024-08-05'))m.next(s);assert.equal(t.supportCandidate(s,'2330').date,'2024-08-05');
});
test('click energy temporarily lifts candle but cannot escape actual OHLC or change final close',()=>{
 const row=['2024-08-05',900,918,790,815];assert.equal(T.visualPrice(0,row,100),900);assert.ok(T.visualPrice(5000,row,90)>T.visualPrice(5000,row,0));
 for(let ms=0;ms<10000;ms+=37)for(const energy of [0,50,100]){const p=T.visualPrice(ms,row,energy);assert.ok(p>=790&&p<=900);}
 assert.equal(T.phase(7200),'break');assert.equal(T.visualPrice(8600,row,100),815);assert.equal(T.visualPrice(99999,row,100),815);
});
test('homepage uses all five user quotes once per shuffle and never repeats at cycle boundary',()=>{
 const next=T.quips(()=>0),texts=[];for(let i=0;i<50;i++)texts.push(next().text);
 for(let i=0;i<50;i+=5)assert.equal(new Set(texts.slice(i,i+5)).size,5);assert.ok(texts.every((v,i)=>!i||v!==texts[i-1]));
 assert.ok(texts.includes('股票就是買低賣高，台股，簡單！'));assert.ok(texts.includes('別人恐懼我貪婪，別人小虧我破產'));assert.equal(T.titleQuotes.length,5);
});
test('support sounds obey shared mute, volume, hidden-tab and rapid-hit limits',()=>{
 const tones=[];class AudioContext{constructor(){this.currentTime=1;}resume(){return Promise.resolve();}createGain(){const n={gain:{setValueAtTime:v=>n.level=v,exponentialRampToValueAtTime(){}},connect(){}};this.lastGain=n;return n;}createOscillator(){const n={frequency:{setValueAtTime:v=>n.from=v,exponentialRampToValueAtTime:v=>n.to=v},connect:g=>n.gain=g,start:()=>tones.push(n),stop(){}};return n;}}
 const a={AudioContext,localStorage:{getItem:()=>null}};vm.createContext(a);vm.runInContext(fs.readFileSync(new URL('../js/music.js',import.meta.url),'utf8'),a);const p=new a.TaiguMusic.Player();p.sfx('support-hit');assert.equal(tones.length,0);p.unlocked=true;p.volume=.2;p.sfx('support-hit');assert.equal(tones.length,1);assert.equal(tones[0].type,'triangle');assert.equal(tones[0].gain.level,.016);p.sfx('support-hit');assert.equal(tones.length,1);p.context.currentTime+=.04;p.sfx('support-hit');assert.equal(tones.length,2);p.sfx('support-break');assert.equal(tones.at(-1).to,42);
 p.hidden=true;p.sfx('support-break');p.hidden=false;p.enabled=false;p.sfx('support-start');p.enabled=true;p.volume=0;p.sfx('support-hit');assert.equal(tones.length,3);
});
