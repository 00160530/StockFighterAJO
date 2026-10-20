import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './db.mjs';
import {handle,EDITION} from '../src/api.mjs';
import {listPlayers} from '../src/players.mjs';
import fs from 'node:fs';

function setup(DB=database()){
 const env={DB,RATE_LIMIT_SECRET:'completion-test-only',ALLOWED_ORIGINS:'https://player.github.io'};
 const call=async(path,body,who)=>{const r=await handle(new Request('https://api.example.test'+path,{method:body?'POST':'GET',headers:{Origin:env.ALLOWED_ORIGINS,'Content-Type':'application/json',...(who?{Authorization:'Bearer '+who.playerToken}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);const data=await r.json();assert.notEqual(r.status,500,DB.errors.join('\n'));return {status:r.status,data};};
 const start=async(mode,who)=>{who??=(await call('/v1/players',{})).data;const s=(await call('/v1/sessions',{runId:crypto.randomUUID(),mode,editionId:EDITION.id,startDay:-1},who)).data;DB.db.prepare('UPDATE sf_sessions SET created_at=created_at-180 WHERE id=?').run(s.sessionId);return {who,s};};
 return {DB,env,call,start};
}
function bankrupt(s,extra={}){return {sessionId:s.sessionId,sessionToken:s.sessionToken,editionId:EDITION.id,mode:s.mode,outcome:'bankrupt',date:'2020-01-03',startDate:EDITION.start,customStartDate:null,earlySettlementDate:null,dateJumps:[],sessions:2,equityCents:0,benchmarkCents:100000000,cashCents:0,...extra};}
function score(s,outcome='won'){const equity=outcome==='won'?600000000:100000000;return {sessionId:s.sessionId,sessionToken:s.sessionToken,editionId:EDITION.id,mode:s.mode,nickname:'測試小韭',outcome,date:EDITION.datasetEnd,sessions:EDITION.sessions,equityCents:equity,benchmarkCents:EDITION.benchmarkCents,cashCents:100,score:Math.round((equity-EDITION.benchmarkCents)/10000),drawdownBps:100,trades:2,buyTrades:1,sellTrades:1,maxGain:null,maxLoss:null};}

test('both modes count completed wins, losses, early settlement and insolvency once per player without an upload',async()=>{
 const a=setup(),first=await a.start('life'),who=first.who;
 assert.equal((await a.call('/v1/completions',score(first.s),who)).status,200);
 const free=await a.start('free',who),early={...score(free.s,'lost'),earlySettlementDate:'2022-01-03'};
 assert.equal((await a.call('/v1/completions',early,who)).status,200);
 for(const mode of ['life','free']){const {s}=await a.start(mode,who),body=bankrupt(s,mode==='free'?{equityCents:50000000,cashCents:-100}:{});a.DB.db.prepare('UPDATE sf_sessions SET created_at=? WHERE id=?').run(Math.floor(Date.now()/1000),s.sessionId);
  const results=await Promise.all([a.call('/v1/completions',body,who),a.call('/v1/completions',body,who)]);assert.ok(results.every(r=>r.status===200));
  assert.equal((await a.call('/v1/scores',body,who)).status,400);
 }
 assert.deepEqual((await a.call('/v1/community')).data.completions,{total:4,wins:1});
 const row=(await listPlayers(a.env,new URLSearchParams())).items[0];assert.equal(row.life_completed_count,2);assert.equal(row.free_completed_count,2);assert.equal(row.upload_count,0);assert.equal(row.nickname,null);
 const second=await a.start('free');await a.call('/v1/completions',bankrupt(second.s),second.who);
 const rows=(await listPlayers(a.env,new URLSearchParams())).items;assert.equal(rows.find(r=>r.id===who.playerId).life_completed_count,2);assert.equal(rows.find(r=>r.id===second.who.playerId).free_completed_count,1);
 // A later leaderboard submission fills no duplicate completion and preserves its time.
 const before=a.DB.db.prepare('SELECT created_at FROM sf_life_completions WHERE session_id=?').get(first.s.sessionId).created_at;
 const upload=await a.call('/v1/scores',(({cashCents,...rest})=>rest)(score(first.s)),who);assert.equal(upload.status,200);assert.ok(upload.data.submittedAt>0);
 const duplicate=await a.call('/v1/scores',(({cashCents,...rest})=>rest)(score(first.s)),who);assert.equal(duplicate.data.error.receipt.submittedAt,upload.data.submittedAt);
 a.DB.db.exec('UPDATE sf_runs SET hidden=1');assert.deepEqual((await a.call('/v1/community')).data.completions,{total:5,wins:1});assert.equal(a.DB.db.prepare('SELECT created_at FROM sf_life_completions WHERE session_id=?').get(first.s.sessionId).created_at,before);
});

test('completion validation rejects fake bankruptcy, unfinished dates, wrong identities and expired sessions without consuming scores',async()=>{
 const a=setup(),{who,s}=await a.start('free'),other=(await a.call('/v1/players',{})).data;
 for(const change of [{equityCents:1,cashCents:0},{sessions:3},{date:'2020-01-04'},{date:'2019-12-31'},{mode:'life'},{outcome:'playing'},{cashCents:0.5},{dateJumps:[{from:'2020-01-03',to:'2020-01-02'}]},{earlySettlementDate:'2026-10-16'},{equityCents:NaN}])assert.equal((await a.call('/v1/completions',bankrupt(s,change),who)).status,400,JSON.stringify(change));
 assert.equal((await a.call('/v1/completions',bankrupt(s),other)).status,400);
 a.DB.db.prepare('UPDATE sf_sessions SET created_at=1,expires_at=2 WHERE id=?').run(s.sessionId);assert.equal((await a.call('/v1/completions',bankrupt(s),who)).status,410);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_life_completions').get().n,0);assert.equal(a.DB.db.prepare('SELECT used_at FROM sf_sessions WHERE id=?').get(s.sessionId).used_at,null);
 const normal=await a.start('life',who);assert.equal((await a.call('/v1/completions',{...score(normal.s),trades:0},who)).status,400);
});

test('legacy upload date lookup returns only requested local run IDs owned by the authenticated identity, even if moderated',async()=>{
 const a=setup(),first=await a.start('life'),other=await a.start('free');
 const upload=await a.call('/v1/scores',(({cashCents,...rest})=>rest)(score(first.s)),first.who);assert.equal(upload.status,200);
 const localId=a.DB.db.prepare('SELECT run_id FROM sf_sessions WHERE id=?').get(first.s.sessionId).run_id,foreignId=a.DB.db.prepare('SELECT run_id FROM sf_sessions WHERE id=?').get(other.s.sessionId).run_id;
 a.DB.db.exec('UPDATE sf_runs SET hidden=1');const result=await a.call('/v1/upload-dates',{runIds:[localId,foreignId,'missing-id']},first.who);assert.equal(result.status,200);assert.deepEqual(result.data,{dates:{[localId]:upload.data.submittedAt}});
 assert.deepEqual((await a.call('/v1/upload-dates',{runIds:[localId]},other.who)).data,{dates:{}});
 assert.equal((await a.call('/v1/upload-dates',{runIds:[localId]})).status,401);
 for(const runIds of [[],Array(101).fill(localId),['bad'],[localId,null]])assert.equal((await a.call('/v1/upload-dates',{runIds},first.who)).status,400);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_runs').get().n,1);
});

test('backfill migration preserves completions, player data, moderation and offsets; rerunning does not duplicate',()=>{
 const DB=database({beforeMigration(db,name){if(!name.startsWith('0022_'))return;db.exec("INSERT INTO sf_players(id,token_hash,nickname,created_at) VALUES ('p','private-token','原玩家',123); INSERT INTO sf_community_counters VALUES (1,9,2,10)");
  for(const [id,mode,hidden] of [['life','life',0],['free','free',1]]){db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,\'p\',?,?,?,\'old\',1,9999999999)').run(id,id,id,mode);db.prepare("INSERT INTO sf_runs(id,session_id,player_id,edition,mode,nickname,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,highlights,submitted_at,hidden) VALUES (?,?,'p','old',?,'原玩家','lost',-1,1,2,0,0,'{}',77,?)").run(id,id,mode,hidden);}
  db.exec("INSERT INTO sf_life_completions VALUES ('life','p','lost',55)");
 }});
 DB.db.exec(fs.readFileSync(new URL('../migrations/0022_all_mode_completions.sql',import.meta.url),'utf8'));
 assert.equal(DB.db.prepare('SELECT COUNT(*) n FROM sf_life_completions').get().n,2);assert.equal(DB.db.prepare("SELECT created_at FROM sf_life_completions WHERE session_id='life'").get().created_at,55);assert.equal(DB.db.prepare("SELECT created_at FROM sf_life_completions WHERE session_id='free'").get().created_at,77);
 assert.equal(DB.db.prepare('SELECT total_adjustment FROM sf_community_counters').get().total_adjustment,9);assert.equal(DB.db.prepare("SELECT hidden FROM sf_runs WHERE id='free'").get().hidden,1);assert.equal(DB.db.prepare('SELECT nickname FROM sf_players').get().nickname,'原玩家');
});
