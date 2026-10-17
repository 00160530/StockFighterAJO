import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={window:{}};vm.createContext(c);
for(const f of ['data/market.js','js/engine.js','js/theatre.js'])vm.runInContext(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const T=c.TaiguTheatre,m=c.TaiguEngine.createMarket(c.window.TAIGU_DATA),t=T.create(m);
const copy=x=>JSON.parse(JSON.stringify(x));
function small(prices=[100,96,90],split=[],id='0050'){
 const dates=prices.map((_,i)=>'2020-01-'+String(i+2).padStart(2,'0')),data={calendar:dates,instruments:{[id]:{name:id==='0050'?'台灣50':'台積電',tradable:true,splits:split,rows:prices.map((p,i)=>[dates[i],p+2,p+3,p-2,p,100])}}};
 data.instruments.TAIEX={name:'加權指數',tradable:false,rows:dates.map((d,i)=>[d,100,101,i===dates.length-1?96:98,i===dates.length-1?97:100]),chips:Object.fromEntries(dates.map(d=>[d,{foreign:-120e8,trust:20e8,dealer:-10e8}]))};
 const market={data,date:s=>dates[s.day],chipCutoff:s=>dates[s.day-1],visibleRows:(s,id)=>data.instruments[id].rows.filter(r=>r[0]<=dates[s.day]),latest:(id,d)=>data.instruments[id].rows.filter(r=>r[0]<=d).at(-1),record:(s,type,text,extra)=>s.log.push({date:dates[s.day],type,text,...extra})};
 const state={day:prices.length-1,mode:'life',status:'playing',opening:false,holdings:{[id]:{qty:100,cost:10000}},log:[{date:dates[0],type:'fill',id,side:'buy',qty:100,price:100}]};return {data,s:state,t:T.create(market)};
}
test('position preserves latest actual buy and resets a closed holding cycle',()=>{
 const {s,t}=small([100,105,106]);assert.equal(t.position(s,'0050').entry,100);
 s.log.push({date:'2020-01-03',type:'fill',id:'0050',side:'buy',qty:100,price:120});s.holdings['0050']={qty:200,cost:22000};s.day=2;assert.equal(t.position(s,'0050').entry,120);
 s.log.push({date:'2020-01-03',type:'fill',id:'0050',side:'sell',qty:200,price:105},{date:'2020-01-04',type:'fill',id:'0050',side:'buy',qty:100,price:106});assert.equal(t.position(s,'0050').firstBuy,'2020-01-04');
});
test('split-adjusted entry/rows only use splits and fills known at current date',()=>{
 const {s,t}=small([100,104,26],[{date:'2020-01-04',ratio:4}]);s.day=1;s.log.push({type:'fill',id:'0050',side:'buy',date:'2020-01-04',qty:1,price:999});assert.equal(t.position(s,'0050').entry,100);assert.equal(t.adjustedRows(s,'0050')[0][4],100);
 s.log.pop();s.day=2;s.holdings['0050'].qty=400;assert.equal(t.position(s,'0050').entry,25);assert.equal(t.reaction(s,'0050').kind,'watch');assert.equal(t.adjustedRows(s,'0050')[0][4],25);assert.equal(t.supportCandidate(s,'0050'),null);
});
test('five consecutive index down sessions give serious cash mood regardless of selected stock',()=>{
 const {data,s,t}=small([100,110,120,130,140,150]);data.instruments.TAIEX.rows.forEach((r,i)=>r[4]=100-i);s.holdings={};assert.equal(t.reaction(s,'TAIEX').kind,'serious');assert.equal(t.reaction(s,'0050').emotion,'serious');s.day=4;assert.equal(t.reaction(s,'0050').kind,'cash');assert.equal(t.supportCandidate(s,'0050'),null);
});
test('support requires market selloff, a held falling stock, life mode and cooldown',()=>{
 const {s,t}=small();assert.equal(t.supportCandidate(s,'0050').date,'2020-01-04');s.mode='free';assert.equal(t.supportCandidate(s,'0050'),null);s.mode='life';
 s.log[0].date='2020-01-04';assert.equal(t.supportCandidate(s,'0050'),null);s.log[0].date='2020-01-02';s.supportGames=[{id:'0050',date:'2020-01-04',taps:0,finished:false}];assert.equal(t.supportCandidate(s,'0050'),null);
 for(const prices of [[100,96,97],[100,96,96]]){const b=small(prices);assert.equal(b.t.supportCandidate(b.s,'0050'),null);}
 const suspended=small();suspended.data.instruments['0050'].rows.splice(1,1);assert.equal(suspended.t.supportCandidate(suspended.s,'0050'),null);
});
test('in-game dialogue rotates within the matching mood, preserves user quotes and stays stable on redraw',()=>{
 const seen=[];
 for(const [prices,kind] of [[[100,110,111,112,113,114,115,116,117],'smug'],[[100,90,89,88,87,86,85,84,83],'panic'],[[100,96,92,88,84,80,76,72,68],'serious']]){
  const h=small(prices);h.data.instruments.TAIEX.rows.forEach((r,i)=>r[4]=prices[i]);if(kind==='serious')h.s.holdings={};
  const titles=[];for(let day=5;day<9;day++){h.s.day=day;const before=JSON.stringify(h.s),a=h.t.reaction(h.s,'0050'),b=h.t.reaction(h.s,'0050');assert.equal(a.kind,kind);assert.equal(a.title,b.title);assert.equal(JSON.stringify(h.s),before);titles.push(a.title);seen.push(a.title+' '+a.text);}
  assert.equal(new Set(titles.slice(0,3)).size,3);
 }
 const all=seen.join('\n');for(const q of T.titleQuotes)assert.ok(all.includes(q.text),q.text);
 assert.ok(all.includes('獲利去哪裡了？'));assert.ok(all.includes('現在買入一定爆賺'));
});
test('index streak needs five daily moves, flats and reversals reset it, and no future close or holding profit controls mood',()=>{
 const h=small([100,80,70,60,50,40,30,20]);h.data.instruments.TAIEX.rows.forEach((r,i)=>r[4]=100+i);h.s.day=4;assert.equal(h.t.reaction(h.s,'0050').kind,'watch');h.s.day=5;assert.equal(h.t.marketTrend(h.s).streak,5);assert.equal(h.t.reaction(h.s,'0050').kind,'smug','losing stock does not override rising index');
 h.s.holdings={};assert.equal(h.t.reaction(h.s,'0050').kind,'fomo');h.s.holdings={'0050':{qty:100,cost:1}};h.data.instruments.TAIEX.rows.forEach((r,i)=>r[4]=100-i);assert.equal(h.t.reaction(h.s,'0050').kind,'panic','profitable holding does not override falling index');
 h.data.instruments.TAIEX.rows[4][4]=97;assert.equal(h.t.marketTrend(h.s).streak,1,'flat breaks the chain');assert.equal(h.t.reaction(h.s,'0050').kind,'watch');
 h.data.instruments.TAIEX.rows[4][4]=98;assert.equal(h.t.marketTrend(h.s).streak,1,'opposite move breaks the chain');
 h.data.instruments.TAIEX.rows.forEach((r,i)=>r[4]=100+i);const before=JSON.stringify(h.t.reaction(h.s,'0050'));h.data.instruments.TAIEX.rows[6][4]=1;h.data.instruments.TAIEX.rows[7][4]=1;assert.equal(JSON.stringify(h.t.reaction(h.s,'0050')),before,'future data never alters current mood');
});
test('published previous-day institutional sum and today index drop govern trigger without future chip leakage',()=>{
 const b=small([100,101,100.9]),inst=b.data.instruments.TAIEX;assert.ok(b.t.supportCandidate(b.s,'0050'),'small holding loss is enough; no two-day stock threshold');
 inst.chips['2020-01-04']={foreign:999e8,trust:999e8,dealer:999e8};assert.equal(b.t.supportCandidate(b.s,'0050').chipDate,'2020-01-03');
 inst.chips['2020-01-03']={foreign:-200e8,trust:100e8,dealer:1};assert.equal(b.t.supportCandidate(b.s,'0050'),null,'all three institutions must be summed');
 inst.chips['2020-01-03']={foreign:-100e8,trust:0,dealer:0};assert.ok(b.t.supportCandidate(b.s,'0050'),'exactly 100億 counts');
 inst.rows.at(-1)[4]=98;assert.ok(b.t.supportCandidate(b.s,'0050'),'exactly 2% counts');inst.rows.at(-1)[4]=98.00001;assert.equal(b.t.supportCandidate(b.s,'0050'),null);
 inst.rows.at(-1)[4]=97;delete inst.chips['2020-01-03'].dealer;assert.equal(b.t.supportCandidate(b.s,'0050'),null,'missing institutional data is not zero');delete inst.chips['2020-01-03'];assert.equal(b.t.supportCandidate(b.s,'0050'),null,'must not substitute today chips');
 const bull=small();bull.data.instruments['0050'].rows.at(-1)[1]=89;assert.equal(bull.t.supportCandidate(bull.s,'0050'),null);
});
test('buy-and-hold 0050 encounters institutional selloff offers with 30-session gaps and no split trigger',()=>{
 const s=m.fresh('life');s.opening=false;m.next(s);m.openWindow(s,'test');m.queue(s,'0050','buy',1000);const games=[];
 while(s.status==='playing'){m.next(s);const g=t.supportCandidate(s,'0050');if(g){games.push(g);t.decide(s,t.begin(s,g),false);}}
 assert.ok(games.length>2&&games.length<50);assert.ok(games.some(g=>g.drop>-.02),'0050 need not fall 2% itself');
 assert.ok(games.every((g,i)=>g.chipDate<g.date&&g.marketDrop<=-.02+1e-10&&(!i||m.data.calendar.indexOf(g.date)-m.data.calendar.indexOf(games[i-1].date)>=30)));assert.ok(games.every(g=>g.date!=='2025-06-18'));assert.equal(m.validate(copy(s)).supportGames.length,games.length);
});
test('real historical crash triggers; completed/pending records survive validation without economic effects',()=>{
 const s=m.fresh('life');s.opening=false;m.next(s);m.openWindow(s,'test');m.queue(s,'2330','buy',100);while(m.date(s)<'2024-08-05')m.next(s);
 const candidate=t.supportCandidate(s,'0050');assert.equal(candidate.id,'2330');assert.ok(candidate.rows.every(r=>r[0]<=m.date(s)));const before=copy(s);const row=t.begin(s,candidate);assert.equal(m.validate(copy(s)).supportGames[0].finished,false);assert.equal(t.supportCandidate(s,'2330'),null);assert.throws(()=>t.finish(s,row,37),/尚未選擇/);t.decide(s,row,true);t.finish(s,row,37);assert.equal(m.validate(copy(s)).supportGames[0].taps,37);
 const after=copy(s);delete after.supportGames;after.log.pop();after.log.pop();assert.deepEqual(after,before);assert.equal(s.log.at(-1).type,'minigame');
 for(const g of [{...row,date:'2099-01-01'},{...row,taps:-1},{...row,id:'TAIEX'},{...row,finished:1}])assert.throws(()=>m.validate({...s,supportGames:[g]}),/支撐線/);
 assert.throws(()=>m.validate({...s,supportGames:[row,row]}),/支撐線/);
});
test('pending offer resumes after save/reload, declining logs choice, has no economic effect and never starts a game',()=>{
 const s=m.fresh('life');s.opening=false;m.next(s);m.openWindow(s,'test');m.queue(s,'0050','buy',1000);while(m.date(s)<'2024-08-05')m.next(s);const before=copy(s),g=t.supportCandidate(s,'0050'),row=t.begin(s,g);assert.ok(t.pending(m.validate(copy(s))));assert.throws(()=>m.next(s),/支撐線事件/);assert.equal(m.canTrade(s),false);
 t.decide(s,row,false);assert.equal(t.pending(s),null);assert.equal(row.choice,'decline');assert.equal(row.taps,0);assert.equal(row.finished,true);assert.throws(()=>t.finish(s,row,8),/尚未選擇/);assert.throws(()=>t.decide(s,row,true),/已選擇/);assert.equal(s.log.at(-1).type,'minigame-choice');assert.equal(m.validate(copy(s)).supportGames[0].choice,'decline');const after=copy(s);delete after.supportGames;after.log.pop();assert.deepEqual(after,before);
 for(const change of [{choice:'bad'},{choice:'pending',finished:true},{choice:'decline',taps:1},{choice:'pending',date:'2020-01-03',finished:false}])assert.throws(()=>m.validate({...s,supportGames:[{...row,...change}]}),/支撐線/);
 const legacy={...row};delete legacy.choice;assert.equal(m.validate({...s,supportGames:[legacy]}).supportGames[0].finished,true);
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
test('ETF and stock candles reach the horizontal finger, hold above it, then accelerate through to the actual low',()=>{
 for(const row of [['2020-03-09',86.8,86.8,85.6,85.85],['2024-08-05',900,918,790,815]]){
  const contact=row[1]-(row[1]-row[3])*.73;assert.equal(T.visualPrice(2880,row,100),contact,'contact precedes click lift');assert.equal(T.visualPrice(5000,row,0),contact);assert.ok(Math.abs((.19+(row[1]-contact)/(row[1]-row[3])*.67)-.6791)<1e-10,'same screen contact for small and large price ranges');
  assert.ok(T.visualPrice(5000,row,100)>contact);const early=T.visualPrice(7425,row,0,contact),late=T.visualPrice(7875,row,0,contact);assert.ok(contact-early<early-late,'fall accelerates after support breaks');assert.equal(T.visualPrice(8100,row,100,contact),row[3]);assert.equal(T.visualPrice(8600,row,100,contact),row[4]);
 }
});
test('support sounds obey shared mute, volume, hidden-tab and rapid-hit limits',()=>{
 const tones=[];class AudioContext{constructor(){this.currentTime=1;}resume(){return Promise.resolve();}createGain(){const n={gain:{setValueAtTime:v=>n.level=v,exponentialRampToValueAtTime(){}},connect(){}};this.lastGain=n;return n;}createOscillator(){const n={frequency:{setValueAtTime:v=>n.from=v,exponentialRampToValueAtTime:v=>n.to=v},connect:g=>n.gain=g,start:()=>tones.push(n),stop(){}};return n;}}
 const a={AudioContext,localStorage:{getItem:()=>null}};vm.createContext(a);vm.runInContext(fs.readFileSync(new URL('../js/music.js',import.meta.url),'utf8'),a);const p=new a.TaiguMusic.Player();p.sfx('support-hit');assert.equal(tones.length,0);p.unlocked=true;p.volume=.2;p.sfx('support-hit');assert.equal(tones.length,1);assert.equal(tones[0].type,'triangle');assert.equal(tones[0].gain.level,.016);p.sfx('support-hit');assert.equal(tones.length,1);p.context.currentTime+=.04;p.sfx('support-hit');assert.equal(tones.length,2);p.sfx('support-break');assert.equal(tones.at(-1).to,42);
 p.hidden=true;p.sfx('support-break');p.hidden=false;p.enabled=false;p.sfx('support-start');p.enabled=true;p.volume=0;p.sfx('support-hit');assert.equal(tones.length,3);
});
