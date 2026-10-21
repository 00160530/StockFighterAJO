import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {database} from './db.mjs';import {handle,EDITION} from '../src/api.mjs';
function setup(){const DB=database(),origin='https://player.github.io',env={DB,ALLOWED_ORIGINS:origin,RATE_LIMIT_SECRET:'profile-tests'};
 const call=async(path,body,who)=>{DB.db.exec('DELETE FROM sf_rate_limits');const r=await handle(new Request('https://api.test'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(who?{Authorization:'Bearer '+who.playerToken}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);const data=await r.json();assert.notEqual(r.status,500,DB.errors.join('\n'));return {status:r.status,data};};
 const player=async(name)=>{const who=(await call('/v1/players',{})).data;if(name)assert.equal((await call('/v1/profile',{nickname:name,avatarId:3,avatarCharacter:'xiaoxiaojiu'},who)).status,200);return who;};
 const start=async(who,mode='life')=>{const r=await call('/v1/sessions',{runId:crypto.randomUUID(),mode,editionId:EDITION.id,startDay:-1},who);DB.db.prepare('UPDATE sf_sessions SET created_at=created_at-180 WHERE id=?').run(r.data.sessionId);return r.data;};
 return {DB,call,player,start};
}
function score(s,equity=600000000){return {sessionId:s.sessionId,sessionToken:s.sessionToken,editionId:EDITION.id,mode:s.mode,outcome:equity>EDITION.benchmarkCents?'won':'lost',date:EDITION.datasetEnd,sessions:EDITION.sessions,score:Math.round((equity-EDITION.benchmarkCents)/10000),equityCents:equity,benchmarkCents:EDITION.benchmarkCents,drawdownBps:100,trades:2,buyTrades:1,sellTrades:1,maxGain:{symbol:'0050',date:'2021-01-04',qty:1000,priceCents:12000,pnlCents:100000},maxLoss:null};}
test('profile owns identity and avatars; name is unique and locked before play; quote avatars stay independent',async()=>{
 const a=setup(),p=await a.player(),q=await a.player('別的玩家');assert.equal((await a.call('/v1/profile',null,p)).data.nickname,null);
 assert.equal((await a.call('/v1/profile',{nickname:'別的玩家'},p)).status,409);
 assert.equal((await a.call('/v1/profile',{nickname:'新的玩家',avatarId:7,avatarCharacter:'xiaoxiaojiu'},p)).status,200);
 assert.equal((await a.call('/v1/profile',{nickname:'新名字'},p)).data.error.code,'NICKNAME_LOCKED');
 assert.equal((await a.call('/v1/profile',{avatarId:11},p)).status,400);assert.equal((await a.call('/v1/profile',{avatarCharacter:'fake'},p)).status,400);
 const s=await a.start(p);assert.equal((await a.call('/v1/scores',score(s),p)).status,200);
 assert.equal((await a.call('/v1/quotes',{text:'先學停損再學停利',avatarId:4,avatarCharacter:'xiaojiu'},p)).status,200);
 assert.equal((await a.call('/v1/profile',{avatarId:2,avatarCharacter:'xiaojiu'},p)).status,200);
 const row=(await a.call('/v1/boards',null,p)).data.boards.life.won.items[0];assert.equal(row.isOwn,true);assert.equal(row.avatarId,2);assert.equal(row.nickname,'新的玩家');
 const quote=(await a.call('/v1/quotes',null,p)).data.items[0];assert.equal(quote.avatarId,4);assert.equal(quote.avatarCharacter,'xiaojiu');
 assert.ok(!a.DB.db.prepare('PRAGMA table_info(sf_runs)').all().some(c=>['nickname','avatar_id','avatar_character'].includes(c.name)));
 assert.equal((await a.call('/v1/profile',{avatarId:2})).status,401);
});
test('rankings distinguish profit, cumulative borrowing and completions, exclude zero values and keep modes separate',async()=>{
 const a=setup(),p=await a.player('榜單甲'),q=await a.player('榜單乙');
 const s=await a.start(p),b=score(s,100000000);b.margin={totalBorrowedCents:900000000,totalInterestCents:0,interestPaidCents:0,totalTopupsCents:0,liquidations:0,principalCents:0,interestCents:0,collateralCents:0};
 const response=await a.call('/v1/scores',b,p);assert.equal(response.status,200);assert.ok(response.data.notifications.some(n=>n.category==='financing'));assert.ok(!response.data.notifications.some(n=>n.category==='won'));
 const second=await a.start(p);assert.equal((await a.call('/v1/scores',score(second,700000000),p)).status,200);
 const other=await a.start(q);assert.equal((await a.call('/v1/scores',{...score(other),maxGain:{...score(other).maxGain,pnlCents:200000}},q)).status,200);
 const snapshot=(await a.call('/v1/boards',null,p)).data.boards;
 assert.deepEqual(Object.keys(snapshot.life).sort(),['financing','gain','reincarnation','won']);assert.equal(snapshot.life.financing.items[0].value,900000000);assert.equal(snapshot.life.financing.items.length,1);
 assert.equal(snapshot.life.gain.items[0].nickname,'榜單乙');assert.equal(snapshot.life.reincarnation.items[0].value,2);assert.equal(snapshot.free.reincarnation.items.length,0);
 assert.equal((await a.call('/v1/leaderboard?outcome=lost')).status,400);assert.equal(a.DB.db.prepare("SELECT COUNT(*) n FROM sf_runs WHERE outcome='lost'").get().n,1);
 assert.equal((await a.call('/v1/scores',b,p)).status,409);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_life_completions').get().n,3);
});
test('bankruptcy stores exact negative assets as a loss, counts once and never enters the winning board',async()=>{
 const a=setup(),p=await a.player('破產測試'),s=await a.start(p),b={...score(s,-100),outcome:'bankrupt',date:EDITION.start,sessions:1,cashCents:-100,maxGain:null};
 assert.equal((await a.call('/v1/scores',b,p)).status,200);assert.equal((await a.call('/v1/scores',b,p)).status,409);
 const row=a.DB.db.prepare('SELECT * FROM sf_runs').get();assert.equal(row.equity_cents,-100);assert.equal(row.outcome,'lost');assert.equal(row.finish_status,'bankrupt');
 const snapshot=(await a.call('/v1/boards',null,p)).data.boards;assert.equal(snapshot.life.won.items.length,0);assert.equal(snapshot.life.reincarnation.entry.value,1);assert.deepEqual((await a.call('/v1/community')).data.completions,{total:1,wins:0});
});
test('only a first top-100 entry or a higher personal best receives a winning-board award; receipts are recoverable',async()=>{
 const a=setup(),p=await a.player('通知測試');let s=await a.start(p),r=await a.call('/v1/scores',score(s),p);
 assert.equal(r.data.notifications.find(n=>n.category==='won').kind,'first');
 const duplicate=await a.call('/v1/scores',score(s),p);assert.equal(duplicate.status,409);assert.deepEqual(duplicate.data.error.receipt.notifications,r.data.notifications);
 const receiptText=a.DB.db.prepare('SELECT upload_receipt FROM sf_runs').get().upload_receipt;assert.ok(!/nickname|avatar/.test(receiptText));
 s=await a.start(p);r=await a.call('/v1/scores',score(s,580000000),p);assert.ok(!r.data.notifications.some(n=>n.category==='won'));
 s=await a.start(p);r=await a.call('/v1/scores',score(s,700000000),p);assert.equal(r.data.notifications.find(n=>n.category==='won').kind,'best');
 assert.equal(r.data.notifications.find(n=>n.category==='won').equityCents,700000000);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_life_completions').get().n,3);
 s=await a.start(p);const tied=score(s,700000000);tied.maxGain.pnlCents=200000;r=await a.call('/v1/scores',tied,p);assert.equal(r.data.notifications.find(n=>n.category==='won').kind,'best');
});
test('players below 100 receive their real position without an award or any other player marked as themselves',async()=>{
 const a=setup(),p=await a.player('榜外玩家'),edition=EDITION.id+':'+EDITION.rulesets.life;
 for(let i=0;i<101;i++){
  const id='top-'+i;a.DB.db.prepare('INSERT INTO sf_players(id,token_hash,nickname,created_at) VALUES (?,?,?,1)').run(id,id,'榜上股友'+i);
  for(let j=0;j<2;j++){const sid=id+'-'+j;a.DB.db.prepare("INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,'life',?,1,9999999999)").run(sid,id,sid,sid,edition);a.DB.db.prepare("INSERT INTO sf_life_completions VALUES (?,?,'won',1,NULL,NULL)").run(sid,id);}
  a.DB.db.prepare("INSERT INTO sf_runs(id,session_id,player_id,edition,mode,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,gain_cents,highlights,submitted_at) VALUES (?,?,?,?,'life','won',0,800000000,?,0,0,200000,'{}',1)").run(id,id+'-0',id,edition,EDITION.benchmarkCents);
 }
 const s=await a.start(p),r=await a.call('/v1/scores',score(s),p);assert.equal(r.status,200);assert.deepEqual(r.data.notifications,[]);
 const b=(await a.call('/v1/boards',null,p)).data.boards.life;for(const category of ['won','gain','reincarnation']){assert.equal(b[category].items.length,100);assert.equal(b[category].entry.rank,102);assert.ok(b[category].items.every(row=>!row.isOwn));assert.equal(b[category].entry.isOwn,true);}
});
test('a rank-query failure after the committed score recovers on retry without a second score or completion',async()=>{
 const a=setup(),p=await a.player('恢復測試'),s=await a.start(p),prepare=a.DB.prepare;let failed=false;
 a.DB.prepare=sql=>{const q=prepare(sql);if(!sql.startsWith('WITH eligible'))return q;return {...q,bind(...args){const bound=q.bind(...args);return {...bound,async all(){if(!failed){failed=true;throw Error('temporary ranking read failure');}return bound.all();}};}};};
 const res=await handle(new Request('https://api.test/v1/scores',{method:'POST',headers:{Origin:'https://player.github.io','Content-Type':'application/json',Authorization:'Bearer '+p.playerToken},body:JSON.stringify(score(s))}),{DB:a.DB,RATE_LIMIT_SECRET:'profile-tests',ALLOWED_ORIGINS:'https://player.github.io'});assert.equal(res.status,500);
 a.DB.prepare=prepare;assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_runs').get().n,1);
 const retry=await a.call('/v1/scores',score(s),p);assert.equal(retry.status,409);assert.equal(retry.data.error.receipt.submitted,true);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_life_completions').get().n,1);
});
test('migration preserves IDs, data, foreign keys and quote snapshots, using the latest visible run avatar',()=>{
 const db=new DatabaseSync(':memory:'),dir=new URL('../migrations/',import.meta.url),names=fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).sort();
 db.exec('PRAGMA foreign_keys=ON');for(const n of names.filter(n=>n<'0024'))db.exec(fs.readFileSync(new URL(n,dir),'utf8'));
 db.exec("INSERT INTO sf_players(id,token_hash,created_at,nickname) VALUES ('p','h',1,'歷史玩家');");
 for(const [id,time,hidden,avatar]of [['old',1,0,3],['latest',2,0,7],['hidden',3,1,9]]){
  db.prepare("INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,'p',?,?,'life','old',1,100)").run(id,id,id);
  db.prepare("INSERT INTO sf_runs(id,session_id,player_id,edition,mode,nickname,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,highlights,submitted_at,hidden,avatar_id,avatar_character) VALUES (?,?,'p','old','life','原暱稱','lost',0,100,100,0,0,'{}',?, ?,?,'xiaoxiaojiu')").run(id,id,time,hidden,avatar);
 }
 db.exec("INSERT INTO sf_best_scores VALUES ('p','old','alpha','old',0,0,0,1);INSERT INTO sf_stock_quotes(id,player_id,body,nickname,avatar_id,avatar_character,created_at,updated_at) VALUES ('quote','p','舊金句','歷史玩家',5,'xiaojiu',1,1)");
 const before=db.prepare('SELECT id,session_id,equity_cents,hidden FROM sf_runs ORDER BY id').all(),quote=db.prepare('SELECT * FROM sf_stock_quotes').get();
 for(const n of names.filter(n=>n>='0024')){db.exec('BEGIN');db.exec(fs.readFileSync(new URL(n,dir),'utf8'));db.exec('COMMIT');}
 assert.deepEqual(db.prepare('SELECT id,session_id,equity_cents,hidden FROM sf_runs ORDER BY id').all(),before);assert.equal(db.prepare('SELECT avatar_id FROM sf_players').get().avatar_id,7);assert.deepEqual(db.prepare('SELECT * FROM sf_stock_quotes').get(),quote);assert.equal(db.prepare('SELECT COUNT(*) n FROM sf_best_scores').get().n,1);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.close();
});

test('character names are reserved and use the exact duplicate nickname response without saving profile fields',async()=>{
 const a=setup(),p=await a.player();await a.player('已存在的股友');
 const duplicate=await a.call('/v1/profile',{nickname:'已存在的股友'},p);
 for(const name of ['小韭','小小韭',' 小韭 ','　小小韭　']){
  const result=await a.call('/v1/profile',{nickname:name,avatarId:7,avatarCharacter:'xiaoxiaojiu'},p);
  assert.equal(result.status,duplicate.status);assert.deepEqual(result.data.error,duplicate.data.error);
  assert.deepEqual((await a.call('/v1/profile',null,p)).data,{nickname:null,avatarId:1,avatarCharacter:'xiaojiu'});
 }
 assert.equal((await a.call('/v1/profile',{nickname:'小韭股友'},p)).status,200);
 const legacy=await a.player(),session=await a.start(legacy);
 assert.equal((await a.call('/v1/scores',{...score(session),nickname:'小小韭'},legacy)).data.error.code,'NICKNAME_TAKEN');
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_runs WHERE player_id=?').get(legacy.playerId).n,0);
});
