import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './db.mjs';
import {handle} from '../src/api.mjs';
import {hash} from '../src/security.mjs';
const base='https://api.example.test',origin='https://player.github.io',adminToken='a'.repeat(64),playerToken='b'.repeat(64);
async function setup(DB=database()){
 DB.db.prepare('INSERT INTO sf_admin_credentials VALUES (?,?,?,?,?)').run('owner','00','00',100000,1);
 DB.db.prepare('INSERT INTO sf_admin_sessions VALUES (?,?,?,?)').run(await hash(adminToken),'owner',1,9999999999);
 const env={DB,RATE_LIMIT_SECRET:'players-test-only',ALLOWED_ORIGINS:origin};
 async function call(path,body=null,{admin=true,token}={}){
  const r=await handle(new Request(base+path,{method:body?'POST':'GET',headers:{Origin:path.startsWith('/admin')?base:origin,'Content-Type':'application/json',...(admin?{Cookie:'sf_admin='+adminToken}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
  assert.notEqual(r.status,500,DB.errors.join('\n'));return {status:r.status,data:await r.json()};
 }
 return {DB,call};
}
function seedPlayer(DB,id,name=null,created=100,lastSeen=null){DB.db.prepare('INSERT INTO sf_players(id,token_hash,nickname,created_at,last_seen_at) VALUES (?,?,?,?,?)').run(id,'hash-'+id,name,created,lastSeen);}
function seedUpload(DB,player,id,hidden=0){
 DB.db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run(id,player,id,'session-'+id,'life','test-edition',1,9999999999);
 DB.db.prepare('INSERT INTO sf_runs(id,session_id,player_id,edition,mode,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,highlights,submitted_at,hidden) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,id,player,'test-edition','life','lost',-1,1,2,0,0,'{}',200,hidden);
}
test('admin lists every anonymous identity including unnamed zero-upload and banned players; all uploaded runs count once',async()=>{
 const a=await setup();for(let i=0;i<52;i++)seedPlayer(a.DB,'player-'+String(i).padStart(3,'0'),i===51?'有暱稱':null,100,i===51?200:null);
 a.DB.db.prepare('UPDATE sf_players SET banned=1 WHERE id=?').run('player-050');
 seedUpload(a.DB,'player-051','upload-one');seedUpload(a.DB,'player-051','upload-two',1);
 // An unsubmitted session must not be counted as an upload.
 a.DB.db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run('pending','player-051','pending','pending','life','test-edition',1,9999999999);
 const first=(await a.call('/admin/api/players')).data,second=(await a.call('/admin/api/players?page=1')).data;
 assert.equal(first.total,52);assert.equal(first.items.length,50);assert.equal(first.hasMore,true);assert.equal(second.items.length,2);assert.equal(second.hasMore,false);
 const all=[...first.items,...second.items];assert.equal(new Set(all.map(x=>x.id)).size,52);assert.equal(first.items[0].upload_count,2);assert.equal(all.filter(x=>x.upload_count===0).length,51);assert.equal(all.filter(x=>x.nickname===null).length,51);assert.ok(all.some(x=>x.id==='player-050'));
 for(const row of all)assert.deepEqual(Object.keys(row).sort(),['avatar_character','avatar_id','created_at','free_completed_count','id','last_seen_at','life_completed_count','longest_play_time_ms','nickname','upload_count']);
 assert.deepEqual((await a.call('/admin/api/players')).data,first);
});
test('player filters escape wildcard text, combine conditions, and sort by uploads, time or nickname',async()=>{
 const a=await setup();seedPlayer(a.DB,'p-special_%','測試_%',100,300);seedPlayer(a.DB,'p-other','Alpha',200,400);seedPlayer(a.DB,'p-empty',null,300);
 seedUpload(a.DB,'p-special_%','one');seedUpload(a.DB,'p-special_%','two',1);
 const query=async s=>(await a.call('/admin/api/players?'+s)).data;
 assert.deepEqual((await query('q='+encodeURIComponent('_%'))).items.map(x=>x.id),['p-special_%']);
 assert.equal((await query('id='+encodeURIComponent('_%'))).total,1);assert.equal((await query('q=alpha')).total,1);
 assert.deepEqual((await query('named=no&uploads=no')).items.map(x=>x.id),['p-empty']);assert.equal((await query('named=no&uploads=yes')).total,0);
 assert.equal((await query('named=yes')).total,2);assert.equal((await query('uploads=no')).total,2);
 for(const [sort,first] of [['uploads','p-special_%'],['newest','p-empty'],['oldest','p-special_%'],['nickname','p-other'],['online','p-other']])assert.equal((await query('sort='+sort)).items[0].id,first);
 assert.equal((await query('page=9')).items.length,0);
});
test('player query requires an admin session and validates filter inputs without changing records',async()=>{
 const a=await setup();seedPlayer(a.DB,'p-private','測試玩家');
 assert.equal((await a.call('/admin/api/players',null,{admin:false})).status,401);
 for(const s of ['page=-1','page=0.5','page=10001','named=bad','uploads=bad','sort=created_at;DROP TABLE sf_players','q='+('a'.repeat(81)),'id='+('a'.repeat(121))])assert.equal((await a.call('/admin/api/players?'+s)).status,400);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_players').get().n,1);
});
test('registration records connection time; authenticated reads refresh once per ten minutes without regressing or accepting invalid identities',async t=>{
 let now=1800000000;t.mock.method(Date,'now',()=>now*1000);const a=await setup();
 const p=(await a.call('/v1/players',{}, {admin:false})).data;
 const seen=()=>a.DB.db.prepare('SELECT created_at,last_seen_at FROM sf_players WHERE id=?').get(p.playerId);
 assert.equal(seen().created_at,now);assert.equal(seen().last_seen_at,now);
 now+=60;assert.equal((await a.call('/v1/community',null,{admin:false,token:p.playerToken})).status,200);assert.equal(seen().last_seen_at,now-60);
 now+=539;await a.call('/v1/profile',null,{admin:false,token:p.playerToken});assert.equal(seen().last_seen_at,now-599);
 now++;await a.call('/v1/community',null,{admin:false,token:p.playerToken});assert.equal(seen().last_seen_at,now);
 now-=100;await a.call('/v1/profile',null,{admin:false,token:p.playerToken});assert.equal(seen().last_seen_at,now+100);
 now+=900;assert.equal((await a.call('/v1/profile',null,{admin:false,token:playerToken})).status,401);assert.equal(seen().last_seen_at,now-800);
 a.DB.db.prepare('UPDATE sf_players SET banned=1 WHERE id=?').run(p.playerId);assert.equal((await a.call('/v1/profile',null,{admin:false,token:p.playerToken})).status,401);assert.equal(seen().last_seen_at,now-800);
});
test('additive migration keeps historical identities and creation times; last online stays unknown until reconnection',async()=>{
 const DB=database({beforeMigration(db,name){if(name.startsWith('0020_'))db.prepare('INSERT INTO sf_players(id,token_hash,nickname,created_at) VALUES (?,?,?,?)').run('old-player','old-hash','原玩家',123);}});
 const a=await setup(DB),row=(await a.call('/admin/api/players')).data.items[0];
 assert.equal(row.id,'old-player');assert.equal(row.nickname,'原玩家');assert.equal(row.created_at,123);assert.equal(row.last_seen_at,null);assert.equal(row.upload_count,0);
 DB.db.prepare('UPDATE sf_players SET token_hash=? WHERE id=?').run(await hash(playerToken),'old-player');await a.call('/v1/profile',null,{admin:false,token:playerToken});
 const updated=DB.db.prepare('SELECT created_at,last_seen_at FROM sf_players WHERE id=?').get('old-player');assert.equal(updated.created_at,123);assert.ok(updated.last_seen_at>123);
});

test('admin opens each player count as paginated date-time records, including hidden uploads and non-uploaded completions',async()=>{
 const a=await setup(),id=crypto.randomUUID(),other=crypto.randomUUID();seedPlayer(a.DB,id,'紀錄玩家');seedPlayer(a.DB,other,null);
 seedUpload(a.DB,id,'uploaded-first');seedUpload(a.DB,id,'uploaded-hidden',1);seedUpload(a.DB,other,'other-upload');
 for(let i=0;i<52;i++){const session=crypto.randomUUID(),mode=i===51?'free':'life';a.DB.db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run(session,id,session,session,mode,'test-edition',1,9999999999);a.DB.db.prepare('INSERT INTO sf_life_completions(session_id,player_id,outcome,created_at) VALUES (?,?,?,?)').run(session,id,i%2?'won':'lost',1000+i);}
 const path='/admin/api/players/'+id+'/activity',read=async query=>(await a.call(path+'?'+query)).data;
 const life=await read('kind=life'),page2=await read('kind=life&page=1');assert.equal(life.total,51);assert.equal(life.items.length,50);assert.equal(life.hasMore,true);assert.equal(page2.items.length,1);assert.equal(page2.hasMore,false);assert.equal(life.items[0].recorded_at,1050);assert.equal(page2.items[0].recorded_at,1000);assert.equal(new Set([...life.items,...page2.items].map(x=>x.id)).size,51);
 const free=await read('kind=free');assert.equal(free.total,1);assert.equal(free.items[0].recorded_at,1051);assert.equal(free.items[0].mode,'free');
 const uploads=await read('kind=uploads');assert.equal(uploads.total,2);assert.ok(uploads.items.some(r=>r.id==='uploaded-hidden'));assert.ok(!uploads.items.some(r=>r.id==='other-upload'));assert.equal(uploads.items[0].recorded_at,200);
 for(const row of [...life.items,...free.items,...uploads.items])assert.deepEqual(Object.keys(row).sort(),['id','mode','outcome','play_time_ms','play_time_partial','recorded_at']);assert.deepEqual(Object.keys(life.player).sort(),['id','nickname']);
 assert.equal((await a.call(path,null,{admin:false})).status,401);
 for(const query of ['kind=bad','kind=life&page=-1','kind=free&page=0.5','kind=uploads&page=10001'])assert.equal((await a.call(path+'?'+query)).status,400);
 assert.equal((await a.call('/admin/api/players/short/activity')).status,400);assert.equal((await a.call('/admin/api/players/'+crypto.randomUUID()+'/activity')).status,404);
 assert.equal((await a.call('/admin/api/players/'+other+'/activity?kind=life')).data.total,0);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_life_completions').get().n,52);
});

test('player sorting uses each mode completion count and the longest recorded single game, with unknown durations last',async()=>{
 const a=await setup();for(const id of ['most-life','most-free','longest','unknown','zero'])seedPlayer(a.DB,id,null,100);
 function completed(player,mode,ms){const id=crypto.randomUUID();a.DB.db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run(id,player,id,id,mode,'test-edition',1,9999999999);a.DB.db.prepare('INSERT INTO sf_life_completions(session_id,player_id,outcome,created_at,play_time_ms,play_time_partial) VALUES (?,?,?,?,?,?)').run(id,player,'lost',100,ms,ms===null?null:0);}
 for(let i=0;i<3;i++)completed('most-life','life',i===0?20000:null);for(let i=0;i<4;i++)completed('most-free','free',10000);completed('longest','life',90000);completed('longest','free',30000);completed('zero','free',0);completed('unknown','life',null);
 for(const [sort,first] of [['life_completed','most-life'],['free_completed','most-free'],['duration','longest']]){const d=(await a.call('/admin/api/players?sort='+sort)).data;assert.equal(d.items[0].id,first);assert.equal(new Set(d.items.map(r=>r.id)).size,5);}
 const rows=(await a.call('/admin/api/players?sort=duration')).data.items;assert.equal(rows[0].longest_play_time_ms,90000);assert.equal(rows[0].life_completed_count,1);assert.equal(rows[0].free_completed_count,1);assert.ok(rows.findIndex(r=>r.id==='zero')<rows.findIndex(r=>r.id==='unknown'));assert.equal(rows.at(-1).longest_play_time_ms,null);
 const id=crypto.randomUUID();seedPlayer(a.DB,id);completed(id,'life',123456);const activity=(await a.call('/admin/api/players/'+id+'/activity?kind=life')).data;assert.equal(activity.items[0].play_time_ms,123456);assert.equal(activity.items[0].play_time_partial,0);assert.equal((await a.call('/admin/api/players/'+id+'/activity?kind=life',null,{admin:false})).status,401);
});

 test('admin player avatars come from the profile even when no score has ever been uploaded',async()=>{
 const a=await setup();seedPlayer(a.DB,'avatar-profile','頭像股友');seedPlayer(a.DB,'avatar-default');
 a.DB.db.prepare('UPDATE sf_players SET avatar_id=4,avatar_character=? WHERE id=?').run('xiaoxiaojiu','avatar-profile');
 const rows=(await a.call('/admin/api/players')).data.items,chosen=rows.find(r=>r.id==='avatar-profile'),fallback=rows.find(r=>r.id==='avatar-default');
 assert.equal(chosen.avatar_id,4);assert.equal(chosen.avatar_character,'xiaoxiaojiu');assert.equal(chosen.upload_count,0);assert.equal(fallback.avatar_id,1);assert.equal(fallback.avatar_character,'xiaojiu');assert.equal(chosen.token_hash,undefined);
 });
