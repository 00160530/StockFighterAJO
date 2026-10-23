import test from 'node:test';import assert from 'node:assert/strict';import {database} from './db.mjs';import {EDITION} from '../src/edition.mjs';import {boardSnapshot,scoreReceipt} from '../src/boards.mjs';import {boardSnapshot as original} from './fixtures/boards-v01631.mjs';import {listPlayers} from '../src/players.mjs';
import fs from 'node:fs';import {leaderboardMigration} from '../tools/leaderboard-schema.mjs';
const edition=mode=>EDITION.id+':'+EDITION.rulesets[mode];
function player(DB,id){DB.db.prepare('INSERT INTO sf_players(id,token_hash,nickname,created_at) VALUES (?,?,?,1)').run(id,id,'股友'+id);return id;}
function run(DB,p,id,{mode='life',value=700000000,gain=100000,borrow=20000000,hidden=0,time=100}={}){DB.db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,1,9999999999)').run(id,p,id,id,mode,edition(mode));DB.db.prepare("INSERT INTO sf_runs(id,session_id,player_id,edition,mode,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,gain_cents,highlights,submitted_at,margin_summary,hidden) VALUES (?,?,?,?,?,'won',1,?,?,1,2,?,'{}',?,?,?)").run(id,id,p,edition(mode),mode,value,EDITION.benchmarkCents,gain,time,JSON.stringify({totalBorrowedCents:borrow}),hidden);return DB.db.prepare('SELECT * FROM sf_runs WHERE id=?').get(id);}
function complete(DB,p,id,time=100){DB.db.prepare("INSERT OR IGNORE INTO sf_life_completions(session_id,player_id,outcome,created_at) VALUES (?,?,'won',?)").run(id,p,time);}
async function same(DB){const old=await original({DB}),current=await boardSnapshot({DB});assert.deepEqual(current,old);for(const r of DB.db.prepare('SELECT mode,category,COUNT(*) n FROM sf_leaderboard_top100 GROUP BY mode,category').all())assert.ok(r.n<=100);}

test('bounded boards exactly match historic ranking while insertions, revocation, restoration, player visibility and deletion repair membership',async()=>{
 const DB=database();for(let i=0;i<110;i++){const p=player(DB,'p-'+String(i).padStart(3,'0'));const r=run(DB,p,'r-'+i,{value:700000000+i,gain:1000+i,borrow:10000+i,time:100+i});complete(DB,p,r.id,100+i);}await same(DB);
 const first=DB.db.prepare("SELECT run_id FROM sf_leaderboard_top100 WHERE category='won' ORDER BY value DESC LIMIT 1").get().run_id;
 DB.db.prepare('UPDATE sf_runs SET hidden=1 WHERE id=?').run(first);await same(DB);DB.db.prepare('UPDATE sf_runs SET hidden=0 WHERE id=?').run(first);await same(DB);
 DB.db.prepare("UPDATE sf_players SET banned=1 WHERE id='p-109'").run();await same(DB);DB.db.prepare("UPDATE sf_players SET banned=0 WHERE id='p-109'").run();await same(DB);
 DB.db.prepare("UPDATE sf_players SET nickname=NULL WHERE id='p-108'").run();await same(DB);DB.db.prepare("UPDATE sf_players SET nickname='回來的玩家' WHERE id='p-108'").run();await same(DB);
 const replacement=run(DB,'p-109','replace-109',{value:900000000,gain:300000,borrow:50000000,time:500});await same(DB);DB.db.prepare('UPDATE sf_runs SET hidden=1 WHERE id=?').run(replacement.id);await same(DB);
 DB.db.prepare('DELETE FROM sf_runs WHERE id=?').run(first);await same(DB);DB.db.prepare("DELETE FROM sf_life_completions WHERE session_id='r-108'").run();await same(DB);
});

test('the current run ID, not the player or old winning record, controls settlement score awards',async()=>{
 const DB=database(),p=player(DB,'mine'),first=run(DB,p,'first',{value:800000000,gain:200000,borrow:30000000});complete(DB,p,first.id);const award=await scoreReceipt({DB},DB.db.prepare('SELECT * FROM sf_runs WHERE id=?').get(first.id),p);assert.ok(award.notifications.some(n=>n.category==='won'));
 const weaker=run(DB,p,'weaker',{value:700000000,gain:100000,borrow:20000000,time:101});complete(DB,p,weaker.id,101);const receipt=await scoreReceipt({DB},weaker,p);assert.equal(receipt.rank,null);assert.ok(!receipt.notifications.some(n=>['won','gain','financing'].includes(n.category)));assert.equal(DB.db.prepare("SELECT run_id FROM sf_leaderboard_top100 WHERE category='won'").get().run_id,first.id);
 const better=run(DB,p,'better',{value:900000000,gain:300000,borrow:40000000,time:102});complete(DB,p,better.id,102);const next=await scoreReceipt({DB},better,p);assert.equal(next.runId,'better');assert.equal(next.rank.runId,'better');assert.ok(next.notifications.filter(n=>n.category!=='reincarnation').every(n=>n.kind==='best'));
});

test('completion counters are persisted on players, mode-specific and duplicate-safe, and player listing does not join completion counts',async()=>{
 const DB=database(),p=player(DB,'counter');run(DB,p,'life-1');run(DB,p,'free-1',{mode:'free'});complete(DB,p,'life-1',100);complete(DB,p,'life-1',100);complete(DB,p,'free-1',200);const row=DB.db.prepare('SELECT life_completed_count,free_completed_count FROM sf_players WHERE id=?').get(p);assert.equal(row.life_completed_count,1);assert.equal(row.free_completed_count,1);
 const queries=[],prepare=DB.prepare;DB.prepare=sql=>{queries.push(sql);return prepare(sql);};const d=await listPlayers({DB},new URLSearchParams(),{snapshot:true});assert.equal(d.items[0].life_completed_count,1);assert.ok(!queries.some(q=>q.includes('JOIN sf_sessions')));
});

test('one-time backfill preserves raw records, reconstructs past counters and builds at most 100 per partition',async()=>{
 const DB=database({beforeMigration(db,name){if(!name.startsWith('0027'))return;db.prepare("INSERT INTO sf_players(id,token_hash,nickname,created_at) VALUES ('old','old','歷史玩家',1)").run();db.prepare("INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES ('old-run','old','old-run','old-run','life',?,1,9999999999)").run(edition('life'));db.prepare("INSERT INTO sf_runs(id,session_id,player_id,edition,mode,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,highlights,submitted_at) VALUES ('old-run','old-run','old',?,'life','won',1,800000000,?,1,2,'{}',100)").run(edition('life'),EDITION.benchmarkCents);db.prepare("INSERT INTO sf_life_completions(session_id,player_id,outcome,created_at) VALUES ('old-run','old','won',100)").run();}});
 assert.equal(DB.db.prepare("SELECT life_completed_count FROM sf_players WHERE id='old'").get().life_completed_count,1);assert.equal(DB.db.prepare("SELECT COUNT(*) n FROM sf_runs WHERE id='old-run'").get().n,1);await same(DB);
});

test('public board SQL reads only bounded membership and indexed row IDs, never groups raw historical runs or counts completions',async()=>{
 const DB=database(),p=player(DB,'reader');run(DB,p,'read-run');complete(DB,p,'read-run');const queries=[],prepare=DB.prepare;DB.prepare=sql=>{queries.push(sql);return prepare(sql);};await boardSnapshot({DB},p,null,{mode:'life',board:'won'});assert.equal(queries.length,1);assert.ok(queries[0].includes('FROM sf_leaderboard_top100'));assert.ok(!/PARTITION BY.*player_id|sf_life_completions|sf_sessions|WITH eligible/i.test(queries[0]));
});

test('migration scopes match the current edition and generated triggers stay within the SQL statement limit',()=>{
 assert.equal(fs.readFileSync(new URL('../migrations/0027_bounded_leaderboards.sql',import.meta.url),'utf8'),leaderboardMigration());
 const DB=database();for(const row of DB.db.prepare("SELECT sql FROM sqlite_schema WHERE type='trigger' AND name LIKE 'sf_top100_%'").all())assert.ok(Buffer.byteLength(row.sql)<100000);
});

test('identical values preserve ties at the hundredth place and remain independent across modes',async()=>{
 const DB=database();for(let i=100;i>=0;i--){const p=player(DB,'tie-'+String(i).padStart(3,'0')),r=run(DB,p,'tie-run-'+String(i).padStart(3,'0'),{value:700000000,gain:10000,borrow:100000,time:100});complete(DB,p,r.id);}
 const p='tie-100';run(DB,p,'free-tie',{mode:'free'});complete(DB,p,'free-tie');await same(DB);
 const b=await boardSnapshot({DB},p,null,{mode:'life',board:'won'});assert.equal(b.life.won.items.length,100);assert.equal(b.life.won.entry,null);assert.equal(b.life.won.items[99].runId,'tie-run-099');
});
