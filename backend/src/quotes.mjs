import {exactKeys,fail,integer,text,uuid,player,rate,nickname} from './security.mjs';
const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const all=async s=>(await s.all()).results;
const likes='(SELECT COUNT(*) FROM sf_stock_quote_likes l WHERE l.quote_id=q.id)';
const eligibleSQL="SELECT 1 FROM sf_runs WHERE player_id=? AND mode='life' AND outcome IN ('won','lost') AND hidden=0 LIMIT 1";
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function quoteList(request,env,tab){
 const sorts={popular:'likes DESC,q.created_at DESC,q.id DESC',latest:'q.created_at DESC,q.id DESC',featured:'q.featured_at DESC,q.created_at DESC,q.id DESC'};
 if(!Object.hasOwn(sorts,tab))fail(400,'INVALID_TAB','請選擇有效的金句頁籤。');
 const who=request.headers.has('authorization')?await player(request,env):null;
 const items=await all(q(env,`SELECT q.id,q.body,q.nickname,q.avatar_id AS avatarId,q.avatar_character AS avatarCharacter,q.created_at AS createdAt,q.featured,${likes} AS likes,EXISTS(SELECT 1 FROM sf_stock_quote_likes l WHERE l.quote_id=q.id AND l.player_id=?) AS liked FROM sf_stock_quotes q JOIN sf_players p ON p.id=q.player_id WHERE q.hidden=0 AND p.banned=0 ${tab==='featured'?'AND q.featured=1':''} ORDER BY ${sorts[tab]} LIMIT 50`,who));
 const own=who?await q(env,'SELECT id,body,hidden FROM sf_stock_quotes WHERE player_id=?',who).first():null;
 const profile=who?await q(env,'SELECT nickname FROM sf_players WHERE id=?',who).first():null;
 return {items,self:{nickname:profile?.nickname||'',eligible:!!(who&&await q(env,eligibleSQL,who).first()),submitted:!!own,...(own?{quoteId:own.id,body:own.body,hidden:!!own.hidden}:{})}};
}
export async function quoteBoards(request,env){
 const who=request.headers.has('authorization')?await player(request,env):null;
 const rows=await all(q(env,`WITH base AS (
 SELECT q.id,q.body,q.nickname,q.avatar_id AS avatarId,q.avatar_character AS avatarCharacter,q.created_at AS createdAt,q.featured,q.featured_at,${likes} AS likes,EXISTS(SELECT 1 FROM sf_stock_quote_likes l WHERE l.quote_id=q.id AND l.player_id=?) AS liked
 FROM sf_stock_quotes q JOIN sf_players p ON p.id=q.player_id WHERE q.hidden=0 AND p.banned=0
 ), ranked AS (SELECT *,ROW_NUMBER() OVER(ORDER BY likes DESC,createdAt DESC,id DESC) AS popular_rank,ROW_NUMBER() OVER(ORDER BY createdAt DESC,id DESC) AS latest_rank,ROW_NUMBER() OVER(PARTITION BY featured ORDER BY featured_at DESC,createdAt DESC,id DESC) AS featured_rank FROM base)
 SELECT * FROM ranked WHERE popular_rank<=50 OR latest_rank<=50 OR (featured=1 AND featured_rank<=50)`,who));
 const tabs={};for(const tab of ['popular','latest','featured'])tabs[tab]={items:rows.filter(r=>(tab!=='featured'||r.featured)&&r[tab+'_rank']<=50).sort((a,b)=>a[tab+'_rank']-b[tab+'_rank']).map(({id,body,nickname,avatarId,avatarCharacter,createdAt,featured,likes,liked})=>({id,body,nickname,avatarId,avatarCharacter,createdAt,featured,likes,liked}))};
 const own=who?await q(env,'SELECT id,body,hidden FROM sf_stock_quotes WHERE player_id=?',who).first():null,profile=who?await q(env,'SELECT nickname FROM sf_players WHERE id=?',who).first():null;
 return {tabs,self:{nickname:profile?.nickname||'',eligible:!!(who&&await q(env,eligibleSQL,who).first()),submitted:!!own,...(own?{quoteId:own.id,body:own.body,hidden:!!own.hidden}:{})}};
}
export async function createQuote(request,env,body,now,ip){
 exactKeys(body,['text','nickname','avatarId','avatarCharacter']);const content=text(body.text,1,25,'金句'),who=await player(request,env);
 const profile=await q(env,'SELECT nickname FROM sf_players WHERE id=?',who).first(),name=body.nickname===undefined?(profile?.nickname||'匿名股友'):nickname(body.nickname),avatarId=integer(body.avatarId===undefined?1:body.avatarId,1,10,'心情頭像'),avatarCharacter=body.avatarCharacter===undefined?'xiaojiu':body.avatarCharacter;
 if(!['xiaojiu','xiaoxiaojiu'].includes(avatarCharacter))fail(400,'INVALID_AVATAR','角色頭像不正確。');
 if(profile?.nickname&&name!==profile.nickname)fail(409,'NICKNAME_LOCKED','請沿用這個匿名身分的排行榜暱稱。',{nickname:profile.nickname});
 await rate(env,'quote-player:'+who,10,3600,now);await rate(env,'quote-ip:'+ip,30,3600,now);
 if(!await q(env,eligibleSQL,who).first())fail(403,'LIFE_REQUIRED','上傳排行榜後才可留言喔。');
 // The permanent unique player key also covers revoked quotes and concurrent requests.
 await q(env,`INSERT INTO sf_stock_quotes(id,player_id,body,created_at,updated_at,nickname,avatar_id,avatar_character) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(player_id) DO NOTHING`,crypto.randomUUID(),who,content,now,now,name,avatarId,avatarCharacter).run();
 const saved=await q(env,'SELECT id,body,nickname,avatar_id,avatar_character FROM sf_stock_quotes WHERE player_id=?',who).first();
 if(saved.body!==content||body.nickname!==undefined&&saved.nickname!==name||body.avatarId!==undefined&&saved.avatar_id!==avatarId||body.avatarCharacter!==undefined&&saved.avatar_character!==avatarCharacter)fail(409,'QUOTE_ALREADY_SUBMITTED','每個匿名玩家只能留下一句金句，註銷後也不能重新留言。');
 return {submitted:true,id:saved.id};
}
export async function likeQuote(request,env,id,body,now,ip){
 exactKeys(body,['liked']);uuid(id);if(typeof body.liked!=='boolean')fail(400,'INVALID_LIKE','按讚狀態不正確。');const who=await player(request,env);
 await rate(env,'quote-like-player:'+who,120,3600,now);await rate(env,'quote-like-ip:'+ip,600,3600,now);
 const active="SELECT q.id FROM sf_stock_quotes q JOIN sf_players p ON p.id=q.player_id WHERE q.id=? AND q.hidden=0 AND p.banned=0";
 if(!await q(env,active,id).first())fail(404,'QUOTE_NOT_FOUND','這句金句已無法查看。');
 if(body.liked)await q(env,'INSERT INTO sf_stock_quote_likes(quote_id,player_id,created_at) SELECT id,?,? FROM ('+active+') WHERE 1 ON CONFLICT(quote_id,player_id) DO NOTHING',who,now,id).run();
 else await q(env,'DELETE FROM sf_stock_quote_likes WHERE quote_id=? AND player_id=?',id,who).run();
 return {liked:body.liked,likes:(await q(env,'SELECT COUNT(*) AS n FROM sf_stock_quote_likes WHERE quote_id=?',id).first()).n};
}
export async function quotesAdmin(request,env,url,body,now,actor){
 if(request.method==='GET'&&url.pathname==='/admin/api/quotes'){
  const page=integer(Number(url.searchParams.get('page')||0),0,10000,'頁數'),search=text(url.searchParams.get('q')||'',0,80,'金句查詢'),name=text(url.searchParams.get('nickname')||'',0,80,'暱稱查詢'),featured=url.searchParams.get('featured')||'all',state=url.searchParams.get('status')||'all',sort=url.searchParams.get('sort')||'latest';
  const sorts={latest:'q.created_at DESC,q.id DESC',oldest:'q.created_at ASC,q.id ASC',likes:'likes DESC,q.created_at DESC,q.id DESC',likes_asc:'likes ASC,q.created_at DESC,q.id DESC',nickname:'q.nickname COLLATE NOCASE ASC,q.created_at DESC,q.id DESC',updated:'q.updated_at DESC,q.id DESC'};
  if(!['all','yes','no'].includes(featured)||!['all','active','revoked'].includes(state)||!Object.hasOwn(sorts,sort))fail(400,'INVALID_FILTER','金句查詢條件不正確。');
  const clauses=[],args=[],pattern=value=>'%'+value.replace(/[\\%_]/g,'\\$&')+'%';
  if(search){clauses.push("q.body LIKE ? ESCAPE '\\'");args.push(pattern(search));}if(name){clauses.push("q.nickname LIKE ? ESCAPE '\\'");args.push(pattern(name));}
  if(featured!=='all'){clauses.push('q.featured=?');args.push(featured==='yes'?1:0);}if(state!=='all'){clauses.push('q.hidden=?');args.push(state==='revoked'?1:0);}const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
  const rows=await all(q(env,`SELECT q.*,${likes} AS likes FROM sf_stock_quotes q`+where+' ORDER BY '+sorts[sort]+' LIMIT 51 OFFSET ?',...args,page*50)),total=(await q(env,'SELECT COUNT(*) AS n FROM sf_stock_quotes q'+where,...args).first()).n;
  return json({items:rows.slice(0,50),hasMore:rows.length>50,page,total});
 }
 if(request.method==='POST'&&/^\/admin\/api\/quotes\/[a-zA-Z0-9_-]+\/delete$/.test(url.pathname)){
  exactKeys(body,['confirm']);if(body.confirm!==true)fail(400,'DELETE_CONFIRMATION_REQUIRED','請確認永久刪除金句並釋放留言名額。');
  const id=uuid(url.pathname.split('/').at(-2));if(!await q(env,'SELECT id FROM sf_stock_quotes WHERE id=?',id).first())fail(404,'QUOTE_NOT_FOUND','找不到這句金句。');
  await env.DB.batch([
   q(env,'DELETE FROM sf_stock_quote_likes WHERE quote_id=?',id),
   q(env,'DELETE FROM sf_stock_quotes WHERE id=?',id),
   q(env,'INSERT INTO sf_admin_audit(id,actor,action,target_id,created_at) VALUES (?,?,?,?,?)',crypto.randomUUID(),actor,'quote-delete',id,now)
  ]);
  return json({deleted:true});
 }
 if(request.method==='POST'&&/^\/admin\/api\/quotes\/[a-zA-Z0-9_-]+\/(hide|restore|feature)$/.test(url.pathname)){
  const id=uuid(url.pathname.split('/').at(-2)),action=url.pathname.split('/').at(-1);
  const old=await q(env,'SELECT hidden FROM sf_stock_quotes WHERE id=?',id).first();if(!old)fail(404,'QUOTE_NOT_FOUND','找不到這句金句。');
  let change,note='';
  if(action==='feature'){
   exactKeys(body,['featured']);if(typeof body.featured!=='boolean')fail(400,'INVALID_FEATURE','精選狀態不正確。');
   if(old.hidden)fail(409,'QUOTE_REVOKED','已註銷的金句不能設為精選。');
   change=q(env,'UPDATE sf_stock_quotes SET featured=?,featured_at=?,updated_at=? WHERE id=? AND hidden=0',+body.featured,body.featured?now:null,now,id);
  }else{
   exactKeys(body,['note']);note=text(body.note,2,500,'處理原因');
   change=action==='hide'?q(env,'UPDATE sf_stock_quotes SET hidden=1,featured=0,featured_at=NULL,moderation_note=?,updated_at=? WHERE id=?',note,now,id):q(env,'UPDATE sf_stock_quotes SET hidden=0,moderation_note=?,updated_at=? WHERE id=?',note,now,id);
  }
  await env.DB.batch([change,q(env,'INSERT INTO sf_admin_audit(id,actor,action,target_id,created_at) VALUES (?,?,?,?,?)',crypto.randomUUID(),actor,'quote-'+action+(action==='feature'?(body.featured?'-on':'-off'):''),id,now)]);
  return json({saved:true});
 }
 return null;
}
