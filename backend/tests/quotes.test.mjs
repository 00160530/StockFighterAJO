import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,EDITION} from '../src/api.mjs';
import {database} from './db.mjs';
import {hash} from '../src/security.mjs';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const origin='https://player.github.io',base='https://api.example.test';
function setup(){
 const DB=database(),env={DB,RATE_LIMIT_SECRET:'test-only-quotes',ALLOWED_ORIGINS:origin};
 async function call(path,body=null,token=null,{cookie='',source=origin,header=true}={}){
  const r=await handle(new Request(base+path,{method:body?'POST':'GET',headers:{Origin:source,'Content-Type':'application/json',...(header?{'X-Admin-Action':'1'}:{}),...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
  assert.notEqual(r.status,500,DB.errors.join('\n'));return {status:r.status,data:await r.json()};
 }
 async function who(){return (await call('/v1/players',{})).data;}
 async function complete(p,{mode='life',outcome='lost',upload=true,name}={}){
  name??=DB.db.prepare('SELECT nickname FROM sf_players WHERE id=?').get(p.playerId).nickname||'股友'+p.playerId.slice(0,12);
  const session=(await call('/v1/sessions',{runId:crypto.randomUUID(),mode,editionId:EDITION.id,startDay:-1},p.playerToken)).data;
  DB.db.prepare('UPDATE sf_sessions SET created_at=created_at-180 WHERE id=?').run(session.sessionId);
  const equity=outcome==='won'?600000000:100000000,body={...session,editionId:EDITION.id,mode,outcome,date:EDITION.datasetEnd,sessions:EDITION.sessions,equityCents:equity,benchmarkCents:EDITION.benchmarkCents,score:Math.round((equity-EDITION.benchmarkCents)/10000),drawdownBps:0,trades:outcome==='won'?2:0,buyTrades:outcome==='won'?1:0,sellTrades:outcome==='won'?1:0,maxGain:null,maxLoss:null,nickname:name};
  delete body.createdAt;delete body.expiresAt;
  const result=await call(mode==='life'?'/v1/completions':'/v1/scores',body,p.playerToken);assert.equal(result.status,200,JSON.stringify(result.data));if(mode==='life'&&upload){const score=await call('/v1/scores',body,p.playerToken);assert.equal(score.status,200,JSON.stringify(score.data));}return session;
 }
 async function admin(){const token='f'.repeat(64);DB.db.prepare('INSERT INTO sf_admin_credentials VALUES (?,?,?,?,?)').run('quote-owner','00','00',100000,1);DB.db.prepare('INSERT INTO sf_admin_sessions VALUES (?,?,?,?)').run(await hash(token),'quote-owner',1,9999999999);return {cookie:'sf_admin='+token,source:base};}
 return {DB,env,call,who,complete,admin};
}
test('only an uploaded valid life score qualifies, including a losing game; completion alone does not qualify',async()=>{
 const a=setup(),p=await a.who();assert.equal((await a.call('/v1/quotes',{text:'股友金句'})).status,401);
 assert.equal((await a.call('/v1/quotes',{text:'股友金句'},p.playerToken)).data.error.code,'LIFE_REQUIRED');
 await a.complete(p,{mode:'free',outcome:'won'});assert.equal((await a.call('/v1/quotes',{text:'自由模式不能留言'},p.playerToken)).status,403);
 await a.complete(p,{upload:false});assert.equal((await a.call('/v1/quote-boards',null,p.playerToken)).data.self.eligible,false);assert.equal((await a.call('/v1/quotes',{text:'只有結算還不能留言'},p.playerToken)).data.error.message,'上傳排行榜後才可留言喔。');
 await a.complete(p);const view=(await a.call('/v1/quotes?tab=latest',null,p.playerToken)).data;assert.equal(view.self.eligible,true);
 assert.equal((await a.call('/v1/quotes',{text:'買進群創，身心受創'},p.playerToken)).status,200);
 const self=(await a.call('/v1/quotes',null,p.playerToken)).data.self;assert.equal(self.submitted,true);assert.equal(self.body,'買進群創，身心受創');
 const publicView=(await a.call('/v1/quotes')).data;assert.equal(publicView.self.submitted,false);for(const key of ['player_id','token_hash','sessionToken','playerToken','moderation_note'])assert.ok(!(key in publicView.items[0]));
});
test('revoked life scores do not grant eligibility; existing revoked quotes still consume the quota',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);
 a.DB.db.prepare('UPDATE sf_runs SET hidden=1 WHERE player_id=?').run(p.playerId);
 for(const route of ['/v1/quotes','/v1/quote-boards'])assert.equal((await a.call(route,null,p.playerToken)).data.self.eligible,false);
 assert.equal((await a.call('/v1/quotes',{text:'被註銷後'},p.playerToken)).status,403);
 a.DB.db.prepare('UPDATE sf_runs SET hidden=0 WHERE player_id=?').run(p.playerId);
 assert.equal((await a.call('/v1/quotes',{text:'原本留言'},p.playerToken)).status,200);
 a.DB.db.prepare('UPDATE sf_stock_quotes SET hidden=1 WHERE player_id=?').run(p.playerId);
 a.DB.db.prepare('UPDATE sf_runs SET hidden=1 WHERE player_id=?').run(p.playerId);
 const self=(await a.call('/v1/quote-boards',null,p.playerToken)).data.self;assert.equal(self.submitted,true);assert.equal(self.hidden,true);assert.equal(self.eligible,false);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quotes WHERE player_id=?').get(p.playerId).n,1);
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
test('quote creation pauses rate limiting while origin and ban checks remain enforced',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);assert.equal((await a.call('/v1/quotes',{text:'一句'},p.playerToken,{source:'https://evil.test'})).status,403);
 const id=(await a.call('/v1/quotes',{text:'一句'},p.playerToken)).data.id;for(let i=0;i<9;i++)await a.call('/v1/quotes',{text:'一句'},p.playerToken);
 assert.equal((await a.call('/v1/quotes',{text:'一句'},p.playerToken)).status,200);a.DB.db.prepare('UPDATE sf_players SET banned=1 WHERE id=?').run(p.playerId);assert.equal((await a.call('/v1/quotes')).data.items.length,0);assert.equal((await a.call('/v1/quotes',null,p.playerToken)).status,401);const fan=await a.who();assert.equal((await a.call('/v1/quotes/'+id+'/like',{liked:true},fan.playerToken)).status,404);
});

test('quote authors support both characters and ten moods, preserve immutable author fields and reuse a locked leaderboard name',async()=>{
 const a=setup(),p=await a.who();await a.complete(p,{name:'金句股友'});
 for(const change of [{nickname:'A'},{nickname:'<script>'},{avatarId:0},{avatarId:11},{avatarId:1.5},{avatarCharacter:'fake'},{avatarCharacter:null}])assert.equal((await a.call('/v1/quotes',{text:'安全金句',nickname:'金句股友',avatarId:10,avatarCharacter:'xiaoxiaojiu',...change},p.playerToken)).status,400);
 const body={text:'安全金句',nickname:'金句股友',avatarId:10,avatarCharacter:'xiaoxiaojiu'};assert.equal((await a.call('/v1/quotes',body,p.playerToken)).status,200);const row=(await a.call('/v1/quotes')).data.items[0];assert.equal(row.nickname,body.nickname);assert.equal(row.avatarId,10);assert.equal(row.avatarCharacter,'xiaoxiaojiu');assert.ok(row.createdAt>0);
 assert.equal((await a.call('/v1/quotes',{...body,avatarId:1},p.playerToken)).status,409);assert.equal((await a.call('/v1/quotes',body,p.playerToken)).status,200);
 const locked=await a.who();await a.complete(locked,{outcome:'won'});a.DB.db.prepare('UPDATE sf_players SET nickname=? WHERE id=?').run('排行榜股友',locked.playerId);
 assert.equal((await a.call('/v1/quotes',{text:'另一句',nickname:'改個名字'},locked.playerToken)).data.error.code,'NICKNAME_LOCKED');assert.equal((await a.call('/v1/quotes',null,locked.playerToken)).data.self.nickname,'排行榜股友');assert.equal((await a.call('/v1/quotes',{text:'另一句'},locked.playerToken)).status,200);
 assert.equal(a.DB.db.prepare('SELECT nickname FROM sf_stock_quotes WHERE player_id=?').get(locked.playerId).nickname,'排行榜股友');
});

test('the bounded snapshot matches each individual tab, hides private fields and includes only the current player’s like state',async()=>{
 const a=setup(),fan=await a.who();for(let i=0;i<65;i++){const id='snapshot-'+String(i).padStart(3,'0');a.DB.db.prepare('INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)').run(id,id,1);a.DB.db.prepare('INSERT INTO sf_stock_quotes(id,player_id,body,nickname,avatar_id,avatar_character,featured,featured_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,id,'第'+i+'句','股友'+i,i%10+1,i%2?'xiaoxiaojiu':'xiaojiu',i%2,i,i,1);}
 a.DB.db.exec("UPDATE sf_stock_quotes SET hidden=1 WHERE id='snapshot-064';UPDATE sf_players SET banned=1 WHERE id='snapshot-063'");await a.call('/v1/quotes/snapshot-001/like',{liked:true},fan.playerToken);
 const snap=(await a.call('/v1/quote-boards',null,fan.playerToken)).data;
 for(const tab of ['popular','latest','featured']){const single=(await a.call('/v1/quotes?tab='+tab,null,fan.playerToken)).data;assert.deepEqual(snap.tabs[tab].items,single.items);assert.deepEqual(snap.self,single.self);assert.ok(snap.tabs[tab].items.length<=50);for(const row of snap.tabs[tab].items)for(const k of ['player_id','featured_at','popular_rank','token_hash'])assert.ok(!(k in row));}
 assert.equal(snap.tabs.popular.items[0].liked,1);assert.equal((await a.call('/v1/quote-boards')).data.tabs.popular.items[0].liked,0);
});

test('admin content and nickname filters are literal partial matches with featured/status filters, safe sorting and matching totals',async()=>{
 const a=setup(),admin=await a.admin();for(let i=0;i<55;i++){const id='filter-'+String(i).padStart(3,'0');a.DB.db.prepare('INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)').run(id,id,1);a.DB.db.prepare('INSERT INTO sf_stock_quotes(id,player_id,body,nickname,featured,hidden,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(id,id,i===0?'保留%_文字':i%2?'紀律重要':'風險重要',i===0?'測試_百分%':'測試股友'+i,i%3===0?1:0,i===0?1:0,i,i);}
 const read=async params=>(await a.call('/admin/api/quotes?'+new URLSearchParams(params),null,null,admin)).data;
 const first=await read({});assert.equal(first.items.length,50);assert.equal(first.total,55);assert.equal(first.hasMore,true);assert.equal((await read({page:1})).items.length,5);
 assert.equal((await read({q:'%_'})).total,1);assert.equal((await read({nickname:'_百分%'})).total,1);assert.equal((await read({nickname:"' OR 1=1 --"})).total,0);
 const filtered=await read({q:'紀律',nickname:'股友',featured:'yes',status:'active',sort:'oldest'});assert.ok(filtered.items.length>0);assert.ok(filtered.items.every(r=>r.body.includes('紀律')&&r.nickname.includes('股友')&&r.featured===1&&r.hidden===0));assert.equal(filtered.total,filtered.items.length);
 a.DB.db.exec("INSERT INTO sf_stock_quote_likes VALUES ('filter-001','filter-002',1)");assert.equal((await read({sort:'likes'})).items[0].id,'filter-001');assert.equal((await read({sort:'oldest'})).items[0].id,'filter-000');assert.equal((await read({status:'revoked'})).total,1);
 for(const params of [{sort:'likes; DROP TABLE sf_players'},{status:'invalid'},{featured:'invalid'}])assert.equal((await a.call('/admin/api/quotes?'+new URLSearchParams(params),null,null,admin)).status,400);
});

test('author migration keeps existing quote text, status, likes and dates while recovering a prior nickname',()=>{
 const db=new DatabaseSync(':memory:'),dir=new URL('../migrations/',import.meta.url);for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.sql')&&n<'0016').sort())db.exec(fs.readFileSync(new URL(name,dir),'utf8'));
 db.prepare('INSERT INTO sf_players(id,token_hash,created_at,nickname) VALUES (?,?,?,?)').run('old-author','hash',1,'原本股友');db.prepare('INSERT INTO sf_stock_quotes(id,player_id,body,hidden,featured,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('old-quote','old-author','原本的金句',1,0,22,33);db.prepare('INSERT INTO sf_stock_quote_likes VALUES (?,?,?)').run('old-quote','old-author',23);
 db.exec(fs.readFileSync(new URL('0016_quote_authors.sql',dir),'utf8'));const r=db.prepare('SELECT * FROM sf_stock_quotes').get();assert.equal(r.body,'原本的金句');assert.equal(r.hidden,1);assert.equal(r.created_at,22);assert.equal(r.updated_at,33);assert.equal(r.nickname,'原本股友');assert.equal(r.avatar_id,1);assert.equal(r.avatar_character,'xiaojiu');assert.equal(db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_likes').get().n,1);db.close();
});

test('private self quote ID identifies only the authenticated author, including revoked quotes, without relying on text or nickname',async()=>{
 const a=setup(),first=await a.who(),second=await a.who(),fan=await a.who();
 for(const p of [first,second]){await a.complete(p);assert.equal((await a.call('/v1/quotes',{text:'一樣的金句'},p.playerToken)).status,200);}
 const own=a.DB.db.prepare('SELECT id FROM sf_stock_quotes WHERE player_id=?').get(first.playerId).id;
 for(const route of ['/v1/quotes','/v1/quote-boards']){
  assert.equal((await a.call(route,null,first.playerToken)).data.self.quoteId,own);
  assert.notEqual((await a.call(route,null,second.playerToken)).data.self.quoteId,own);
  assert.equal((await a.call(route,null,fan.playerToken)).data.self.quoteId,undefined);
  assert.equal((await a.call(route)).data.self.quoteId,undefined);
 }
 a.DB.db.prepare('UPDATE sf_stock_quotes SET hidden=1 WHERE id=?').run(own);
 const snap=(await a.call('/v1/quote-boards',null,first.playerToken)).data;assert.equal(snap.self.quoteId,own);assert.equal(snap.self.hidden,true);assert.ok(!snap.tabs.latest.items.some(q=>q.id===own));
});

test('only an authenticated same-origin administrator can permanently delete a quote and its likes to release that player’s slot',async()=>{
 const a=setup(),p=await a.who(),other=await a.who();a.DB.db.exec('PRAGMA foreign_keys=ON');
 for(const who of [p,other])await a.complete(who);
 const id=(await a.call('/v1/quotes',{text:'測試後可刪除'},p.playerToken)).data.id,kept=(await a.call('/v1/quotes',{text:'保留另一筆'},other.playerToken)).data.id,path='/admin/api/quotes/'+id+'/delete',admin=await a.admin();
 await a.call('/v1/quotes/'+id+'/like',{liked:true},other.playerToken);
 assert.equal((await a.call(path,{confirm:true},null,{source:base})).status,401);
 assert.equal((await a.call(path,{confirm:true},null,{...admin,source:'https://evil.test'})).status,403);
 assert.equal((await a.call(path,{confirm:true},null,{...admin,header:false})).status,403);
 for(const body of [{},{confirm:false},{confirm:'true'},{confirm:true,playerId:other.playerId}])assert.equal((await a.call(path,body,null,admin)).status,400);
 assert.equal((await a.call(path,{confirm:true},null,admin)).data.deleted,true);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quotes WHERE id=?').get(id).n,0);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_likes WHERE quote_id=?').get(id).n,0);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quotes WHERE id=?').get(kept).n,1);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_players WHERE id=?').get(p.playerId).n,1);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_runs WHERE player_id=?').get(p.playerId).n,1);
 assert.equal(a.DB.db.prepare("SELECT COUNT(*) n FROM sf_admin_audit WHERE action='quote-delete' AND target_id=?").get(id).n,1);
 const self=(await a.call('/v1/quote-boards',null,p.playerToken)).data.self;assert.equal(self.submitted,false);assert.equal(self.quoteId,undefined);assert.equal(self.eligible,true);
 assert.equal((await a.call('/v1/quotes/'+id+'/like',{liked:true},other.playerToken)).status,404);
 const next=await a.call('/v1/quotes',{text:'這次重新留言'},p.playerToken);assert.equal(next.status,200);assert.notEqual(next.data.id,id);
 assert.equal((await a.call(path,{confirm:true},null,admin)).status,404);
});

test('deleting a revoked quote releases its slot, but never restores revoked leaderboard eligibility; audit failure rolls back deletion and likes',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);const id=(await a.call('/v1/quotes',{text:'原本測試金句'},p.playerToken)).data.id,admin=await a.admin();
 await a.call('/v1/quotes/'+id+'/like',{liked:true},p.playerToken);await a.call('/admin/api/quotes/'+id+'/hide',{note:'測試註銷'},null,admin);
 a.DB.db.exec("CREATE TRIGGER reject_quote_delete_audit BEFORE INSERT ON sf_admin_audit WHEN NEW.action='quote-delete' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END");
 const response=await handle(new Request(base+'/admin/api/quotes/'+id+'/delete',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Admin-Action':'1',Cookie:admin.cookie},body:JSON.stringify({confirm:true})}),a.env);
 assert.equal(response.status,500);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quotes WHERE id=?').get(id).n,1);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_likes WHERE quote_id=?').get(id).n,1);
 a.DB.db.exec('DROP TRIGGER reject_quote_delete_audit');a.DB.errors.length=0;
 a.DB.db.prepare('UPDATE sf_runs SET hidden=1 WHERE player_id=?').run(p.playerId);
 assert.equal((await a.call('/admin/api/quotes/'+id+'/delete',{confirm:true},null,admin)).status,200);
 const self=(await a.call('/v1/quote-boards',null,p.playerToken)).data.self;assert.equal(self.submitted,false);assert.equal(self.eligible,false);assert.equal((await a.call('/v1/quotes',{text:'不符資格'},p.playerToken)).status,403);
});
test('editing archives prior text and avatar for administrators while boards show the current version with likes reset',async()=>{
 const a=setup(),p=await a.who(),fan=await a.who();await a.complete(p,{name:'修改股友'});const admin=await a.admin(),id=(await a.call('/v1/quotes',{text:'舊金句',avatarId:2,avatarCharacter:'xiaojiu'},p.playerToken)).data.id;
 await a.call('/v1/quotes/'+id+'/like',{liked:true},fan.playerToken);await a.call('/admin/api/quotes/'+id+'/feature',{featured:true},null,admin);
 const before=(await a.call('/v1/quote-boards',null,p.playerToken)).data.self;assert.equal(before.revision,1);assert.equal(before.avatarId,2);
 const edit={text:'新金句',revision:1,confirmResetLikes:true,avatarId:7,avatarCharacter:'xiaoxiaojiu'},path='/v1/quotes/'+id+'/edit';
 assert.equal((await a.call(path,edit,p.playerToken)).status,200);
 for(const route of ['/v1/quotes','/v1/quote-boards']){const d=(await a.call(route,null,p.playerToken)).data,rows=d.items||d.tabs.latest.items;assert.equal(rows.length,1);assert.equal(rows[0].body,'新金句');assert.equal(rows[0].id,id);assert.equal(rows[0].likes,0);assert.equal(rows[0].featured,0);assert.equal(d.self.revision,2);assert.equal(d.self.avatarCharacter,'xiaoxiaojiu');assert.equal(d.self.avatarId,7);assert.equal(d.self.nickname,'修改股友');}
 const rows=(await a.call('/admin/api/quotes',null,null,admin)).data;assert.equal(rows.total,2);const old=rows.items.find(r=>r.status==='modified'),current=rows.items.find(r=>r.status==='active');assert.equal(old.body,'舊金句');assert.equal(old.avatar_id,2);assert.equal(old.featured,1);assert.equal(old.likes,1);assert.equal(old.quote_id,id);assert.equal(current.body,'新金句');assert.equal(current.revision,2);
 const read=async params=>(await a.call('/admin/api/quotes?'+new URLSearchParams(params),null,null,admin)).data;
 assert.equal((await read({status:'modified',q:'舊',nickname:'修改',featured:'yes',sort:'updated'})).total,1);assert.equal((await read({status:'active'})).total,1);assert.equal((await read({status:'revoked'})).total,0);
 await a.call('/v1/quotes/'+id+'/like',{liked:true},fan.playerToken);assert.equal((await a.call(path,edit,p.playerToken)).status,200);assert.equal((await read({status:'modified'})).total,1);assert.equal((await a.call('/v1/quotes')).data.items[0].likes,1); // retry never clears new votes
 assert.equal((await a.call(path,{...edit,text:'再修改',revision:2},p.playerToken)).status,200);assert.equal((await read({status:'modified'})).total,2);
 assert.equal((await a.call('/admin/api/quotes/'+id+'/delete',{confirm:true},null,admin)).status,200);assert.equal((await read({})).total,0);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_revisions').get().n,0);
});

test('quote edits reject other identities, invalid data, stale revisions and revoked quotes without creating history',async()=>{
 const a=setup(),p=await a.who(),other=await a.who();await a.complete(p);const id=(await a.call('/v1/quotes',{text:'原文'},p.playerToken)).data.id,path='/v1/quotes/'+id+'/edit',edit={text:'修改',revision:1,confirmResetLikes:true,avatarId:1,avatarCharacter:'xiaojiu'};
 assert.equal((await a.call(path,edit)).status,401);assert.equal((await a.call(path,edit,other.playerToken)).status,404);assert.equal((await a.call(path,edit,p.playerToken,{source:'https://evil.test'})).status,403);
 for(const changes of [{text:'😀'.repeat(26)},{text:'換\n行'},{text:''},{revision:0},{revision:undefined},{avatarId:11},{avatarCharacter:'fake'},{nickname:'偽造'}])assert.equal((await a.call(path,{...edit,...changes},p.playerToken)).status,400);
 assert.equal((await a.call(path,{...edit,revision:2},p.playerToken)).data.error.code,'QUOTE_CHANGED');
 const admin=await a.admin();await a.call('/admin/api/quotes/'+id+'/hide',{note:'測試註銷'},null,admin);
 const revoked=await a.call(path,edit,p.playerToken);assert.equal(revoked.data.error.code,'QUOTE_REVOKED');assert.equal(revoked.data.error.message,'你的金句已被管理員註銷。');assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_revisions').get().n,0);
});

test('simultaneous edits cannot overwrite each other and an admin revocation between read and write prevents replacement',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);const id=(await a.call('/v1/quotes',{text:'原文'},p.playerToken)).data.id,path='/v1/quotes/'+id+'/edit',edit={text:'修改甲',revision:1,confirmResetLikes:true,avatarId:1,avatarCharacter:'xiaojiu'};
 const results=await Promise.all([a.call(path,edit,p.playerToken),a.call(path,{...edit,text:'修改乙'},p.playerToken)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_revisions').get().n,1);
 const prepare=a.DB.prepare;a.DB.prepare=sql=>{const statement=prepare(sql);if(!sql.startsWith('UPDATE sf_stock_quotes SET body='))return statement;const bind=statement.bind;statement.bind=(...args)=>{const bound=bind(...args),run=bound.run;bound.run=async()=>{a.DB.db.prepare('UPDATE sf_stock_quotes SET hidden=1 WHERE id=?').run(id);return run();};return bound;};return statement;};
 const r=await a.call(path,{...edit,text:'不能蓋過註銷',revision:2},p.playerToken);assert.equal(r.data.error.code,'QUOTE_REVOKED');assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_revisions').get().n,1);assert.notEqual(a.DB.db.prepare('SELECT body FROM sf_stock_quotes WHERE id=?').get(id).body,'不能蓋過註銷');
});

test('a failed history insert rolls back the edit, and the additive migration preserves existing quotes and likes',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);const id=(await a.call('/v1/quotes',{text:'原文'},p.playerToken)).data.id;
 a.DB.db.exec("CREATE TRIGGER fail_quote_history BEFORE INSERT ON sf_stock_quote_revisions BEGIN SELECT RAISE(ABORT,'test failure'); END;");
 const r=await handle(new Request(base+'/v1/quotes/'+id+'/edit',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+p.playerToken},body:JSON.stringify({text:'不能半套更新',revision:1,confirmResetLikes:true,avatarId:1,avatarCharacter:'xiaojiu'})}),a.env);assert.equal(r.status,500);const saved=a.DB.db.prepare('SELECT body,revision FROM sf_stock_quotes').get();assert.equal(saved.body,'原文');assert.equal(saved.revision,1);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_revisions').get().n,0);
 const DB=database({beforeMigration(db,name){if(!name.startsWith('0021'))return;db.prepare('INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)').run('legacy','legacy',1);db.prepare('INSERT INTO sf_stock_quotes(id,player_id,body,hidden,featured,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('legacy-quote','legacy','既有金句',1,0,2,3);db.prepare('INSERT INTO sf_stock_quote_likes VALUES (?,?,?)').run('legacy-quote','legacy',4);}});assert.equal(DB.db.prepare('SELECT body,revision,hidden FROM sf_stock_quotes').get().body,'既有金句');assert.equal(DB.db.prepare('SELECT revision FROM sf_stock_quotes').get().revision,1);assert.equal(DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_likes').get().n,1);assert.equal(DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_revisions').get().n,0);
});

test('quote edits require explicit reset confirmation, reset avatar-only edits and allow former fans to like the new version',async()=>{
 const a=setup(),p=await a.who(),fan=await a.who();await a.complete(p);const id=(await a.call('/v1/quotes',{text:'原金句'},p.playerToken)).data.id,path='/v1/quotes/'+id+'/edit',edit={text:'新金句',revision:1,avatarId:1,avatarCharacter:'xiaojiu'};
 await a.call('/v1/quotes/'+id+'/like',{liked:true},fan.playerToken);
 for(const confirmResetLikes of [undefined,false,'true',1]){const r=await a.call(path,{...edit,confirmResetLikes},p.playerToken);assert.equal(r.data.error.code,'QUOTE_EDIT_CONFIRMATION_REQUIRED');assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_revisions').get().n,0);assert.equal((await a.call('/v1/quotes')).data.items[0].body,'原金句');assert.equal((await a.call('/v1/quotes')).data.items[0].likes,1);}
 assert.equal((await a.call(path,{...edit,confirmResetLikes:true},p.playerToken)).status,200);const after=(await a.call('/v1/quotes',null,fan.playerToken)).data.items[0];assert.equal(after.likes,0);assert.equal(after.liked,0);assert.equal(a.DB.db.prepare('SELECT likes FROM sf_stock_quote_revisions WHERE quote_id=? AND revision=1').get(id).likes,1);
 assert.equal((await a.call('/v1/quotes/'+id+'/like',{liked:true},fan.playerToken)).data.likes,1);
 assert.equal((await a.call(path,{...edit,text:'過期修改',confirmResetLikes:true},p.playerToken)).data.error.code,'QUOTE_CHANGED');assert.equal((await a.call('/v1/quotes')).data.items[0].likes,1);
 assert.equal((await a.call(path,{...edit,revision:2,avatarId:2,confirmResetLikes:true},p.playerToken)).status,200);assert.equal((await a.call('/v1/quotes')).data.items[0].likes,0);assert.equal(a.DB.db.prepare('SELECT likes FROM sf_stock_quote_revisions WHERE quote_id=? AND revision=2').get(id).likes,1);
});

test('a like reset failure rolls back the edited text, revision and history together with votes',async()=>{
 const a=setup(),p=await a.who();await a.complete(p);const id=(await a.call('/v1/quotes',{text:'原金句'},p.playerToken)).data.id;await a.call('/v1/quotes/'+id+'/like',{liked:true},p.playerToken);
 a.DB.db.exec("CREATE TRIGGER fail_quote_like_reset BEFORE DELETE ON sf_stock_quote_likes BEGIN SELECT RAISE(ABORT,'test reset failure'); END;");
 const r=await handle(new Request(base+'/v1/quotes/'+id+'/edit',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+p.playerToken},body:JSON.stringify({text:'不應儲存',revision:1,avatarId:1,avatarCharacter:'xiaojiu',confirmResetLikes:true})}),a.env);assert.equal(r.status,500);const saved=a.DB.db.prepare('SELECT body,revision FROM sf_stock_quotes WHERE id=?').get(id);assert.equal(saved.body,'原金句');assert.equal(saved.revision,1);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_likes WHERE quote_id=?').get(id).n,1);assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_revisions WHERE quote_id=?').get(id).n,0);
});
