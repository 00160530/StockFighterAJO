import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,EDITION} from '../src/api.mjs';
import {database} from './db.mjs';
import {hash} from '../src/security.mjs';
const origin='https://player.github.io',base='https://api.example.test';
function setup(){
 const DB=database(),env={DB,RATE_LIMIT_SECRET:'test-only-quotes',ALLOWED_ORIGINS:origin};
 async function call(path,body=null,token=null,{cookie='',source=origin,header=true}={}){
  const r=await handle(new Request(base+path,{method:body?'POST':'GET',headers:{Origin:source,'Content-Type':'application/json',...(header?{'X-Admin-Action':'1'}:{}),...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
  assert.notEqual(r.status,500,DB.errors.join('\n'));return {status:r.status,data:await r.json()};
 }
 async function who(){return (await call('/v1/players',{})).data;}
 async function complete(p,{mode='life',outcome='lost'}={}){
  const session=(await call('/v1/sessions',{runId:crypto.randomUUID(),mode,editionId:EDITION.id,startDay:-1},p.playerToken)).data;
  DB.db.prepare('UPDATE sf_sessions SET created_at=created_at-180 WHERE id=?').run(session.sessionId);
  const equity=outcome==='won'?600000000:100000000,body={...session,editionId:EDITION.id,mode,outcome,date:EDITION.datasetEnd,sessions:EDITION.sessions,equityCents:equity,benchmarkCents:EDITION.benchmarkCents,score:Math.round((equity-EDITION.benchmarkCents)/10000),drawdownBps:0,trades:outcome==='won'?2:0,buyTrades:outcome==='won'?1:0,sellTrades:outcome==='won'?1:0,maxGain:null,maxLoss:null,nickname:'金句小韭'};
  delete body.createdAt;delete body.expiresAt;
  const result=await call(mode==='life'?'/v1/completions':'/v1/scores',body,p.playerToken);assert.equal(result.status,200,JSON.stringify(result.data));return session;
 }
 async function admin(){const token='f'.repeat(64);DB.db.prepare('INSERT INTO sf_admin_credentials VALUES (?,?,?,?,?)').run('quote-owner','00','00',100000,1);DB.db.prepare('INSERT INTO sf_admin_sessions VALUES (?,?,?,?)').run(await hash(token),'quote-owner',1,9999999999);return {cookie:'sf_admin='+token,source:base};}
 return {DB,env,call,who,complete,admin};
}
test('only a server-verified completed life game qualifies, including a completed losing game',async()=>{
 const a=setup(),p=await a.who();assert.equal((await a.call('/v1/quotes',{text:'股友金句'})).status,401);
 assert.equal((await a.call('/v1/quotes',{text:'股友金句'},p.playerToken)).data.error.code,'LIFE_REQUIRED');
 await a.complete(p,{mode:'free',outcome:'won'});assert.equal((await a.call('/v1/quotes',{text:'自由模式不能留言'},p.playerToken)).status,403);
 await a.complete(p);const view=(await a.call('/v1/quotes?tab=latest',null,p.playerToken)).data;assert.equal(view.self.eligible,true);
 assert.equal((await a.call('/v1/quotes',{text:'買進群創，身心受創'},p.playerToken)).status,200);
 const self=(await a.call('/v1/quotes',null,p.playerToken)).data.self;assert.equal(self.submitted,true);assert.equal(self.body,'買進群創，身心受創');
 const publicView=(await a.call('/v1/quotes')).data;assert.equal(publicView.self.submitted,false);for(const key of ['player_id','token_hash','sessionToken','playerToken','moderation_note'])assert.ok(!(key in publicView.items[0]));
});
test('quotes accept 25 Unicode code points, normalize whitespace and reject malformed or excessive text before writing',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);
 for(const body of [{text:''},{text:' '},{text:'韭'.repeat(26)},{text:'😀'.repeat(26)},{text:'換\n行'},{text:'藏\u200b字'},{text:2},{text:'一句',hidden:0}])assert.equal((await a.call('/v1/quotes',body,p.playerToken)).status,400,JSON.stringify(body));
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quotes').get().n,0);
 assert.equal((await a.call('/v1/quotes',{text:'  '+'😀'.repeat(25)+'  '},p.playerToken)).status,200);assert.equal([...a.DB.db.prepare('SELECT body FROM sf_stock_quotes').get().body].length,25);
});
test('the permanent player constraint resolves concurrent different submissions and retries cannot replace text',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);const result=await Promise.all(['第一句','第二句'].map(text=>a.call('/v1/quotes',{text},p.playerToken)));assert.deepEqual(result.map(r=>r.status).sort(),[200,409]);
 const saved=a.DB.db.prepare('SELECT id,body FROM sf_stock_quotes').get();assert.equal((await a.call('/v1/quotes',{text:saved.body},p.playerToken)).data.id,saved.id);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quotes').get().n,1);
});
test('likes are authenticated, retry-safe and one per anonymous identity; any player can like or undo',async()=>{
 const a=setup(),author=await a.who(),fan=await a.who();await a.complete(author);const id=(await a.call('/v1/quotes',{text:'先活下來'},author.playerToken)).data.id,path='/v1/quotes/'+id+'/like';
 assert.equal((await a.call(path,{liked:true})).status,401);assert.equal((await a.call(path,{liked:'true'},fan.playerToken)).status,400);
 const r=await Promise.all([a.call(path,{liked:true},fan.playerToken),a.call(path,{liked:true},fan.playerToken)]);assert.ok(r.every(x=>x.status===200));assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_likes').get().n,1);
 assert.equal((await a.call('/v1/quotes',null,fan.playerToken)).data.items[0].liked,1);assert.equal((await a.call('/v1/quotes')).data.items[0].liked,0);
 assert.equal((await a.call(path,{liked:false},fan.playerToken)).data.likes,0);assert.equal((await a.call(path,{liked:false},fan.playerToken)).data.likes,0);
 assert.equal((await a.call(path,{liked:true},fan.playerToken)).data.likes,1);assert.equal((await a.call(path,{liked:true},author.playerToken)).data.likes,2);
});
test('all lists cap at 50, popularity uses likes, latest uses dates and featured excludes revoked or banned authors',async()=>{
 const a=setup();for(let i=0;i<60;i++){const id='quote-seed-'+String(i).padStart(2,'0');a.DB.db.prepare('INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)').run(id,id,1);a.DB.db.prepare('INSERT INTO sf_stock_quotes(id,player_id,body,featured,featured_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id,id,'第'+i+'句',1,i,i,1);}
 a.DB.db.exec("INSERT INTO sf_stock_quote_likes VALUES ('quote-seed-00','quote-seed-59',1)");
 assert.equal((await a.call('/v1/quotes?tab=popular')).data.items[0].id,'quote-seed-00');assert.equal((await a.call('/v1/quotes?tab=latest')).data.items[0].id,'quote-seed-59');
 a.DB.db.exec("UPDATE sf_stock_quotes SET hidden=1 WHERE id='quote-seed-59';UPDATE sf_players SET banned=1 WHERE id='quote-seed-58'");
 for(const tab of ['popular','latest','featured']){const view=await a.call('/v1/quotes?tab='+tab);assert.equal(view.data.items.length,50);assert.ok(!view.data.items.some(x=>['quote-seed-59','quote-seed-58'].includes(x.id)));}
 assert.equal((await a.call('/v1/quotes?tab=featured')).data.items[0].id,'quote-seed-57');assert.equal((await a.call('/v1/quotes?tab=invalid')).status,400);
});
test('admin requires login and same-origin protection; revoke preserves quota, likes and audit, and featured can be removed or restored',async()=>{
 const a=setup(),p=await a.who(),fan=await a.who();await a.complete(p);const id=(await a.call('/v1/quotes',{text:'波動不是生活費'},p.playerToken)).data.id,admin=await a.admin(),path='/admin/api/quotes/'+id;
 assert.equal((await a.call('/admin/api/quotes')).status,401);assert.equal((await a.call(path+'/feature',{featured:true},null,{source:base})).status,401);assert.equal((await a.call(path+'/feature',{featured:true},null,{...admin,source:'https://evil.test'})).status,403);assert.equal((await a.call(path+'/feature',{featured:true},null,{...admin,header:false})).status,403);
 assert.equal((await a.call(path+'/feature',{featured:true},null,admin)).status,200);assert.equal((await a.call('/v1/quotes?tab=featured')).data.items.length,1);
 assert.equal((await a.call(path+'/feature',{featured:false},null,admin)).status,200);assert.equal((await a.call('/v1/quotes?tab=featured')).data.items.length,0);
 await a.call('/v1/quotes/'+id+'/like',{liked:true},fan.playerToken);assert.equal((await a.call(path+'/hide',{note:'不當留言'},null,admin)).status,200);
 for(const tab of ['latest','popular','featured'])assert.equal((await a.call('/v1/quotes?tab='+tab)).data.items.length,0);
 assert.equal((await a.call('/v1/quotes/'+id+'/like',{liked:true},fan.playerToken)).status,404);assert.equal((await a.call(path+'/feature',{featured:true},null,admin)).status,409);
 assert.equal((await a.call('/v1/quotes',{text:'換一句再來'},p.playerToken)).status,409);assert.equal((await a.call('/v1/quotes',null,p.playerToken)).data.self.hidden,true);
 const list=(await a.call('/admin/api/quotes',null,null,admin)).data.items;assert.equal(list[0].moderation_note,'不當留言');assert.equal(list[0].likes,1);assert.equal(list[0].featured,0);
 assert.equal((await a.call(path+'/restore',{note:'誤判恢復'},null,admin)).status,200);assert.equal((await a.call('/v1/quotes')).data.items[0].likes,1);assert.equal(a.DB.db.prepare("SELECT COUNT(*) n FROM sf_admin_audit WHERE action LIKE 'quote-%'").get().n,4);
});
test('quote creation and likes retain existing origin, ban and rate protections',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);assert.equal((await a.call('/v1/quotes',{text:'一句'},p.playerToken,{source:'https://evil.test'})).status,403);
 const id=(await a.call('/v1/quotes',{text:'一句'},p.playerToken)).data.id;for(let i=0;i<9;i++)await a.call('/v1/quotes',{text:'一句'},p.playerToken);
 assert.equal((await a.call('/v1/quotes',{text:'一句'},p.playerToken)).status,429);a.DB.db.prepare('UPDATE sf_players SET banned=1 WHERE id=?').run(p.playerId);assert.equal((await a.call('/v1/quotes')).data.items.length,0);assert.equal((await a.call('/v1/quotes',null,p.playerToken)).status,401);const fan=await a.who();assert.equal((await a.call('/v1/quotes/'+id+'/like',{liked:true},fan.playerToken)).status,404);
});
