import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './db.mjs';import {handle,EDITION} from '../src/api.mjs';
import {boardSnapshot,scoreReceipt,CATEGORIES} from '../src/boards.mjs';
import {boardSnapshot as originalSnapshot} from './fixtures/boards-v01631.mjs';
import {hash} from '../src/security.mjs';
import {publicData,invalidatePublic} from '../src/public-cache.mjs';
const origin='https://player.github.io',base='https://api.example.test';
export function memoryCache(){const rows=new Map();return {rows,puts:0,async match(r){return rows.get(r.url)?.clone();},async put(r,response){this.puts++;rows.set(r.url,response.clone());},async delete(r){return rows.delete(r.url);}};}
function setup(){const DB=database(),queries=[],prepare=DB.prepare;DB.prepare=sql=>{queries.push(sql);return prepare(sql);};const cache=memoryCache(),env={DB,PUBLIC_CACHE:cache,RATE_LIMIT_SECRET:'cache-tests',ALLOWED_ORIGINS:origin+',https://second.github.io'};
 const call=async(path,token=null,body=null,extra={})=>{const response=await handle(new Request(base+path,{method:body?'POST':'GET',headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})}),env);return {status:response.status,data:await response.json(),headers:response.headers};};
 const who=async(name)=>{const p=(await call('/v1/players',null,{})).data;assert.equal((await call('/v1/profile',p.playerToken,{nickname:name})).status,200);return p;};
 return {DB,queries,cache,env,call,who};
}
function seed(DB,pid,i,mode='life',j=0){const id='run-'+i+'-'+j,sid='session-'+i+'-'+j,edition=(j%3===0?(EDITION.compatibleEditionIds?.[0]||EDITION.id):EDITION.id)+':'+EDITION.rulesets[mode]+(j%2?':margin-v1':'');
 DB.db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,1,9999999999)').run(sid,pid,id,sid,mode,edition);
 DB.db.prepare('INSERT INTO sf_runs(id,session_id,player_id,edition,mode,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,gain_cents,highlights,submitted_at,margin_summary,hidden) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,sid,pid,edition,mode,i%4?'won':'lost',1,600000000+(i%7)*10000,EDITION.benchmarkCents,i%100,10+(j%2),i%5?100000+(i%3)*1000:null,'{}',100+i+(j%2),JSON.stringify({totalBorrowedCents:i%3?1000*(i%11):0}),i%19===0?1:0);
 DB.db.prepare("INSERT INTO sf_life_completions(session_id,player_id,outcome,created_at) VALUES (?,?,'lost',?)").run(sid,pid,100+i+j);
 return DB.db.prepare('SELECT * FROM sf_runs WHERE id=?').get(id);
}

test('scoped queries preserve the shipped ranking, all tie breakers, editions, hidden/banned filters',async()=>{
 const a=setup();for(let i=0;i<125;i++){const id='seed-player-'+i;a.DB.db.prepare('INSERT INTO sf_players(id,token_hash,created_at,nickname,banned) VALUES (?,?,1,?,?)').run(id,id,i%23===0?null:'股友'+i,i%29===0?1:0);for(let j=0;j<4;j++)seed(a.DB,id,i,j%2?'free':'life',j);}
 for(const before of [null]){
  const original=await originalSnapshot(a.env,'seed-player-124',before),all=await boardSnapshot(a.env,'seed-player-124',before);for(const mode of ['life','free'])for(const category of CATEGORIES)if(original[mode][category].entry?.rank>100)original[mode][category].entry=null;assert.deepEqual(all,original);
  for(const mode of ['life','free'])for(const board of CATEGORIES){const scoped=await boardSnapshot(a.env,'seed-player-124',before,{mode,board});assert.deepEqual(scoped[mode][board],original[mode][board]);const own=await boardSnapshot(a.env,'seed-player-124',before,{mode,board,entryOnly:true});assert.deepEqual(own[mode][board].entry,original[mode][board].entry);}
 }
});

test('two players share public top 100 cache but get live scoped entries and their own current profile without identity leakage',async()=>{
 const a=setup(),p=await a.who('快取甲'),q=await a.who('快取乙');seed(a.DB,p.playerId,1);seed(a.DB,q.playerId,2);const url='/v1/boards?mode=life&category=won';
 const first=await a.call(url,p.playerToken);assert.equal(first.status,200);assert.equal(first.headers.get('X-SF-Public-Cache'),'MISS');
 a.queries.length=0;const second=await a.call(url,q.playerToken);assert.equal(second.headers.get('X-SF-Public-Cache'),'HIT');assert.equal(a.queries.filter(s=>s.includes('FROM sf_leaderboard_top100')).length,0);assert.ok(!a.queries.some(s=>s.startsWith('WITH counts')));
 assert.equal(first.data.boards.life.won.entry.nickname,'快取甲');assert.equal(second.data.boards.life.won.entry.nickname,'快取乙');assert.equal(second.data.boards.life.won.items.filter(r=>r.isOwn).length,1);
 assert.ok(second.data.boards.life.won.items.find(r=>r.isOwn).nickname==='快取乙');assert.ok(!JSON.stringify(second.data).includes('_owner'));assert.ok(!JSON.stringify(second.data).includes(q.playerId));
 await a.call('/v1/profile',q.playerToken,{avatarId:8,avatarCharacter:'xiaoxiaojiu'});const edited=await a.call(url,q.playerToken);assert.equal(edited.data.boards.life.won.entry.avatarId,8);assert.equal(edited.data.boards.life.won.items.find(r=>r.isOwn).avatarId,8);
 a.queries.length=0;const anonymous=await a.call(url);assert.equal(anonymous.data.boards.life.won.entry,null);assert.ok(anonymous.data.boards.life.won.items.every(r=>!r.isOwn));assert.equal(a.queries.length,0);
 assert.equal((await a.call(url,'invalid')).status,401);assert.equal((await a.call(url,null,null,{Origin:'https://forbidden.test'})).status,403);
 const another=await a.call(url,null,null,{Origin:'https://second.github.io'});assert.equal(another.headers.get('Access-Control-Allow-Origin'),'https://second.github.io');
});

test('players outside the public top 100 have no entry and do not trigger a private ranking query',async()=>{
 const a=setup(),p=await a.who('榜外本人');seed(a.DB,p.playerId,999);for(let i=0;i<110;i++){const id='above-'+i;a.DB.db.prepare('INSERT INTO sf_players(id,token_hash,nickname,created_at) VALUES (?,?,?,1)').run(id,id,'高分'+i);const r=seed(a.DB,id,i+1000);a.DB.db.prepare("UPDATE sf_runs SET equity_cents=900000000,outcome='won',hidden=0 WHERE id=?").run(r.id);}
 a.DB.db.prepare('UPDATE sf_runs SET equity_cents=600000000,hidden=0 WHERE player_id=?').run(p.playerId);
 await a.call('/v1/boards');const mine=await a.call('/v1/boards?mode=life&category=won',p.playerToken);assert.equal(mine.data.boards.life.won.entry,null);assert.equal(mine.data.boards.life.won.items.length,100);assert.ok(mine.data.boards.life.won.items.every(r=>!r.isOwn));
});

test('cached home totals and public poll counts never cache myChoice; vote changes stay private and current',async()=>{
 const a=setup(),p=await a.who('投票甲'),q=await a.who('投票乙');a.DB.db.prepare("INSERT INTO sf_polls(id,question,active,visible,created_at,updated_at) VALUES ('poll-cache-001','測試',1,1,1,1)").run();
 await a.call('/v1/polls/poll-cache-001/vote',p.playerToken,{choice:'yes'});await a.call('/v1/polls/poll-cache-001/vote',q.playerToken,{choice:'no'});
 const one=await a.call('/v1/community',p.playerToken);assert.equal(one.data.poll.myChoice,'yes');a.queries.length=0;
 const two=await a.call('/v1/community',q.playerToken);assert.equal(two.data.poll.myChoice,'no');assert.ok(!a.queries.some(q=>q.startsWith('WITH base')||q.includes('SELECT p.id,p.question')));
 await a.call('/v1/polls/poll-cache-001/vote',p.playerToken,{choice:'no'});assert.equal((await a.call('/v1/community',p.playerToken)).data.poll.myChoice,'no');assert.equal((await a.call('/v1/community')).data.poll.myChoice,null);
 const pArchive=await a.call('/v1/polls',p.playerToken),qArchive=await a.call('/v1/polls',q.playerToken);assert.equal(pArchive.data.items[0].myChoice,'no');assert.equal(qArchive.data.items[0].myChoice,'no');
});

test('warm public announcements execute zero SQL, expire at 30 seconds, and edits/deletions can invalidate cached values',async t=>{
 let now=1800000000000;t.mock.method(Date,'now',()=>now);const a=setup();await a.call('/v1/announcement');a.queries.length=0;assert.equal((await a.call('/v1/announcement')).headers.get('X-SF-Public-Cache'),'HIT');assert.equal(a.queries.length,0);
 a.DB.db.prepare("INSERT INTO sf_update_announcements(id,version,release_date,title,summary,details,updated_at,updated_by) VALUES ('manual','test','2026-10-22','新公告','摘要','[]',1,'owner')").run();now+=29999;assert.equal((await a.call('/v1/announcement')).data.updates.length,0);now++;assert.equal((await a.call('/v1/announcement')).data.updates.length,1);
 a.DB.db.prepare("UPDATE sf_update_announcements SET deleted=1 WHERE id='manual'").run();await invalidatePublic(a.env);assert.deepEqual((await a.call('/v1/announcement')).data.updates,[]);
});

test('cache failures degrade to database reads, errors are not cached, concurrent misses coalesce and invalidation prevents stale puts',async()=>{
 const a=setup(),request=new Request(base+'/v1/announcement');let calls=0;
 await assert.rejects(publicData(request,a.env,'failure',async()=>{calls++;throw Error('database unavailable');}));assert.equal((await publicData(request,a.env,'failure',async()=>{calls++;return 'recovered';})).data,'recovered');assert.equal(calls,2);
 let release;const pending=publicData(request,a.env,'pending',()=>new Promise(resolve=>release=resolve));await new Promise(resolve=>setImmediate(resolve));await invalidatePublic(a.env);release('old');await pending;assert.equal((await publicData(request,a.env,'pending',async()=>'new')).data,'new');
 const broken={...a.env,PUBLIC_CACHE:{async match(){throw Error('down');},async put(){throw Error('down');}}};assert.equal((await publicData(request,broken,'broken',async()=>'ok')).data,'ok');
 let loads=0;const reads=await Promise.all(Array.from({length:5},()=>publicData(request,a.env,'coalesced',async()=>{loads++;await new Promise(resolve=>setImmediate(resolve));return {value:1};})));assert.equal(loads,1);reads[0].data.value=99;assert.equal(reads[1].data.value,1);
});

test('successful admin edits and deletions invalidate the local public cache while rejected writes leave it intact',async()=>{
 const a=setup(),token='a'.repeat(64),headers={Origin:base,'X-Admin-Action':'1',Cookie:'sf_admin='+token};
 a.DB.db.prepare('INSERT INTO sf_admin_credentials VALUES (?,?,?,?,?)').run('owner','00','00',100000,1);a.DB.db.prepare('INSERT INTO sf_admin_sessions VALUES (?,?,?,?)').run(await hash(token),'owner',1,9999999999);
 await a.call('/v1/announcement');const content={version:'0.16.32',date:'2026-10-22',title:'後台新增',summary:'手動公告',details:['保留修改']};
 const created=await a.call('/admin/api/updates',null,content,headers);assert.equal(created.status,200);const id=created.data.item.id;
 let feed=await a.call('/v1/announcement');assert.equal(feed.data.updates[0].title,content.title);assert.equal(feed.headers.get('X-SF-Public-Cache'),'MISS');
 assert.equal((await a.call('/admin/api/updates/'+id,null,{...content,title:'即時修改',revision:1},headers)).status,200);assert.equal((await a.call('/v1/announcement')).data.updates[0].title,'即時修改');
 assert.equal((await a.call('/admin/api/updates/'+id+'/delete',null,{confirm:false,revision:2},headers)).status,400);assert.equal((await a.call('/v1/announcement')).headers.get('X-SF-Public-Cache'),'HIT');
 assert.equal((await a.call('/admin/api/updates/'+id+'/delete',null,{confirm:true,revision:2},headers)).status,200);assert.deepEqual((await a.call('/v1/announcement')).data.updates,[]);
 await a.call('/v1/community');assert.equal((await a.call('/admin/api/community-counts',null,{total:123,wins:45},headers)).status,200);assert.deepEqual((await a.call('/v1/community')).data.completions,{total:123,wins:45});
});

test('settlement receipts bypass warm cache, read only the run mode and retain immutable notifications on retries',async()=>{
 const a=setup(),p=await a.who('結算即時');await a.call('/v1/boards');const run=seed(a.DB,p.playerId,5);a.queries.length=0;const receipt=await scoreReceipt(a.env,run,p.playerId);assert.ok(receipt.notifications.some(n=>n.category==='won'));assert.equal(a.queries.filter(q=>q.includes('FROM sf_leaderboard_top100 b JOIN')).length,1);assert.ok(a.queries.find(q=>q.includes('FROM sf_leaderboard_top100 b JOIN')).includes('b.mode=?'));
 assert.equal((await a.call('/v1/boards?mode=life&category=won',p.playerToken)).data.boards.life.won.entry.runId,run.id);
 const saved=a.DB.db.prepare('SELECT * FROM sf_runs WHERE id=?').get(run.id);assert.deepEqual((await scoreReceipt(a.env,saved,p.playerId)).notifications,receipt.notifications);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_runs').get().n,1);
});
