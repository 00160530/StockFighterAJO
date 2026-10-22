import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,EDITION} from '../src/api.mjs';
import {rate} from '../src/security.mjs';
import {database} from './db.mjs';

test('stage-one rate remains awaitable and performs no database access even past former limits',async()=>{
 const env={get DB(){assert.fail('Paused rate() must not access D1');}};
 for(let i=0;i<125;i++)assert.equal(await rate(env,'read:test',120,60,1000),undefined);
 assert.equal(await rate(undefined,'admin-login:test',10,900,1000),undefined);
});

test('API flows preserve old rate rows and schema without rate SQL or background cleanup',async t=>{
 const raw=database(),origin='https://player.github.io',base='https://api.example.test';
 raw.db.prepare('INSERT INTO sf_rate_limits(bucket,count,expires_at) VALUES (?,?,?)').run('expired-fixture',12,1);
 raw.db.prepare('INSERT INTO sf_rate_limits(bucket,count,expires_at) VALUES (?,?,?)').run('active-fixture',99,9999999999);
 const rows=()=>raw.db.prepare('SELECT * FROM sf_rate_limits ORDER BY bucket').all(),schema=()=>raw.db.prepare("SELECT type,name,sql FROM sqlite_master WHERE tbl_name='sf_rate_limits' ORDER BY type,name").all(),beforeRows=rows(),beforeSchema=schema(),attempts=[],background=[];
 const env={DB:{...raw,prepare(sql){if(/\bsf_rate_limits\b/i.test(sql)){attempts.push(sql);assert.fail('API accessed rate table: '+sql);}return raw.prepare(sql);}},RATE_LIMIT_SECRET:'stage-one-test-secret',ALLOWED_ORIGINS:origin};
 // The former cleanup branch must be exercised deterministically if reintroduced.
 t.mock.method(Math,'random',()=>0);
 const call=async(path,body=null,who=null)=>{
  const response=await handle(new Request(base+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(who?{Authorization:'Bearer '+who.playerToken}:{})},...(body?{body:JSON.stringify(body)}:{})}),env,{waitUntil:p=>background.push(p)});
  const data=await response.json();assert.notEqual(response.status,500,JSON.stringify(data));return {status:response.status,data};
 };
 const who=(await call('/v1/players',{})).data,other=(await call('/v1/players',{})).data;
 assert.ok(who.playerId&&who.playerToken);
 assert.equal((await call('/v1/profile')).status,401);
 assert.equal((await call('/v1/profile',{nickname:'限流暫停驗證',avatarId:4,avatarCharacter:'xiaoxiaojiu'},who)).status,200);
 assert.equal((await call('/v1/profile',null,who)).data.nickname,'限流暫停驗證');
 const s=(await call('/v1/sessions',{runId:crypto.randomUUID(),mode:'life',editionId:EDITION.id,startDay:-1},who)).data;
 const score={sessionId:s.sessionId,sessionToken:s.sessionToken,editionId:EDITION.id,mode:'life',outcome:'won',date:EDITION.datasetEnd,sessions:EDITION.sessions,score:Math.round((600000000-EDITION.benchmarkCents)/10000),equityCents:600000000,benchmarkCents:EDITION.benchmarkCents,drawdownBps:100,trades:2,buyTrades:1,sellTrades:1,maxGain:null,maxLoss:null};
 assert.equal((await call('/v1/scores',score)).status,401);
 assert.equal((await call('/v1/scores',score,other)).status,401);
 const early=await call('/v1/scores',score,who);assert.equal(early.status,400);assert.equal(early.data.error.code,'TOO_FAST');
 raw.db.prepare('UPDATE sf_sessions SET created_at=created_at-180 WHERE id=?').run(s.sessionId);
 assert.equal((await call('/v1/scores',score,who)).status,200);
 const duplicate=await call('/v1/scores',score,who);assert.equal(duplicate.status,409);assert.equal(duplicate.data.error.code,'SESSION_USED');
 assert.equal((await call('/v1/completions',score,who)).status,200);
 assert.equal(raw.db.prepare('SELECT COUNT(*) n FROM sf_runs').get().n,1);
 assert.equal(raw.db.prepare('SELECT COUNT(*) n FROM sf_life_completions').get().n,1);
 const quote=await call('/v1/quotes',{text:'紀錄交易慢慢進步',avatarId:2,avatarCharacter:'xiaojiu'},who);assert.equal(quote.status,200);
 const id=quote.data.id;assert.equal((await call('/v1/quotes/'+id+'/like',{liked:true},other)).data.likes,1);
 assert.equal((await call('/v1/quotes/'+id+'/like',{liked:true},other)).data.likes,1);
 assert.equal((await call('/v1/quotes/'+id+'/edit',{text:'紀律比猜漲跌重要',revision:1,avatarId:3,avatarCharacter:'xiaoxiaojiu',confirmResetLikes:true},who)).status,200);
 assert.equal((await call('/v1/quotes/'+id+'/like',{liked:false},other)).data.likes,0);
 assert.equal((await call('/v1/quotes',null,who)).data.items[0].body,'紀律比猜漲跌重要');
 for(const path of ['/health','/v1/config','/v1/boards','/v1/leaderboard','/v1/community','/v1/polls','/v1/announcement','/v1/quote-boards','/v1/rank'])assert.equal((await call(path,null,who)).status,200,path);
 for(let i=0;i<6;i++)assert.equal((await call('/v1/feedback',{requestId:crypto.randomUUID(),kind:'wish',title:'增加劇情',body:'希望有更多群組故事。',version:'0.16.31',context:null},who)).status,200);
 await Promise.all(background);assert.equal(background.length,0);assert.deepEqual(attempts,[]);assert.deepEqual(rows(),beforeRows);assert.deepEqual(schema(),beforeSchema);
});
