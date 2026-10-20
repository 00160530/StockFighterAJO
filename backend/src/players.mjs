import {fail,integer,text} from './security.mjs';

// Called only after admin authentication. Never return player/session credentials.
export async function listPlayers(env,params){
 const page=integer(Number(params.get('page')||0),0,10000,'頁數');
 const query=text(params.get('q')||'',0,80,'暱稱'),id=text(params.get('id')||'',0,120,'匿名玩家編號');
 const named=params.get('named')||'all',uploads=params.get('uploads')||'all',sort=params.get('sort')||'online';
 const sorts={online:'p.last_seen_at DESC NULLS LAST,p.id DESC',newest:'p.created_at DESC,p.id DESC',oldest:'p.created_at,p.id',uploads:'upload_count DESC,p.created_at DESC,p.id DESC',nickname:'p.nickname COLLATE NOCASE ASC NULLS LAST,p.id'};
 if(!['all','yes','no'].includes(named)||!['all','yes','no'].includes(uploads)||!Object.hasOwn(sorts,sort))fail(400,'INVALID_FILTER','查詢條件不正確。');
 const clauses=[],args=[],like=value=>'%'+value.replace(/[\\%_]/g,'\\$&')+'%';
 if(query){clauses.push("p.nickname LIKE ? ESCAPE '\\'");args.push(like(query));}
 if(id){clauses.push("p.id LIKE ? ESCAPE '\\'");args.push(like(id));}
 if(named!=='all')clauses.push(named==='yes'?"p.nickname IS NOT NULL AND p.nickname<>''":"(p.nickname IS NULL OR p.nickname='')");
 if(uploads!=='all')clauses.push((uploads==='no'?'NOT ':'')+'EXISTS (SELECT 1 FROM sf_runs r WHERE r.player_id=p.id)');
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 const rows=(await env.DB.prepare('SELECT p.id,p.nickname,p.created_at,p.last_seen_at,(SELECT COUNT(*) FROM sf_runs r WHERE r.player_id=p.id) AS upload_count FROM sf_players p'+where+' ORDER BY '+sorts[sort]+' LIMIT 51 OFFSET ?').bind(...args,page*50).all()).results;
 const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM sf_players p'+where).bind(...args).first();
 return {items:rows.slice(0,50),hasMore:rows.length>50,page,total:count.n};
}
