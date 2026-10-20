import {fail,integer,text,uuid} from './security.mjs';

// Called only after admin authentication. Never return player/session credentials.
export async function listPlayers(env,params){
 const page=integer(Number(params.get('page')||0),0,10000,'頁數');
 const query=text(params.get('q')||'',0,80,'暱稱'),id=text(params.get('id')||'',0,120,'匿名玩家編號');
 const named=params.get('named')||'all',uploads=params.get('uploads')||'all',sort=params.get('sort')||'online';
 const sorts={online:'p.last_seen_at DESC NULLS LAST,p.id DESC',newest:'p.created_at DESC,p.id DESC',oldest:'p.created_at,p.id',uploads:'upload_count DESC,p.created_at DESC,p.id DESC',life_completed:'life_completed_count DESC,p.created_at DESC,p.id DESC',free_completed:'free_completed_count DESC,p.created_at DESC,p.id DESC',duration:'longest_play_time_ms DESC NULLS LAST,p.created_at DESC,p.id DESC',nickname:'p.nickname COLLATE NOCASE ASC NULLS LAST,p.id'};
 if(!['all','yes','no'].includes(named)||!['all','yes','no'].includes(uploads)||!Object.hasOwn(sorts,sort))fail(400,'INVALID_FILTER','查詢條件不正確。');
 const clauses=[],args=[],like=value=>'%'+value.replace(/[\\%_]/g,'\\$&')+'%';
 if(query){clauses.push("p.nickname LIKE ? ESCAPE '\\'");args.push(like(query));}
 if(id){clauses.push("p.id LIKE ? ESCAPE '\\'");args.push(like(id));}
 if(named!=='all')clauses.push(named==='yes'?"p.nickname IS NOT NULL AND p.nickname<>''":"(p.nickname IS NULL OR p.nickname='')");
 if(uploads!=='all')clauses.push((uploads==='no'?'NOT ':'')+'EXISTS (SELECT 1 FROM sf_runs r WHERE r.player_id=p.id)');
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 const rows=(await env.DB.prepare('SELECT p.id,p.nickname,p.created_at,p.last_seen_at,(SELECT COUNT(*) FROM sf_runs r WHERE r.player_id=p.id) AS upload_count,(SELECT COUNT(*) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=p.id AND s.mode=\'life\') AS life_completed_count,(SELECT COUNT(*) FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=p.id AND s.mode=\'free\') AS free_completed_count,(SELECT MAX(c.play_time_ms) FROM sf_life_completions c WHERE c.player_id=p.id) AS longest_play_time_ms FROM sf_players p'+where+' ORDER BY '+sorts[sort]+' LIMIT 51 OFFSET ?').bind(...args,page*50).all()).results;
 const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM sf_players p'+where).bind(...args).first();
 return {items:rows.slice(0,50),hasMore:rows.length>50,page,total:count.n};
}

export async function playerActivity(env,id,params){
 uuid(id);const kind=params.get('kind')||'uploads',page=integer(Number(params.get('page')||0),0,10000,'頁數');
 if(!['uploads','life','free'].includes(kind))fail(400,'INVALID_FILTER','紀錄類型不正確。');
 const player=await env.DB.prepare('SELECT id,nickname FROM sf_players WHERE id=?').bind(id).first();if(!player)fail(404,'PLAYER_NOT_FOUND','找不到這位玩家。');
 const uploads=kind==='uploads',from=uploads?'sf_runs r':'sf_life_completions r JOIN sf_sessions s ON s.id=r.session_id',where=' WHERE r.player_id=?'+(uploads?'':' AND s.mode=?'),args=uploads?[id]:[id,kind];
 const rows=(await env.DB.prepare('SELECT '+(uploads?'r.id,r.mode,r.submitted_at':'r.session_id AS id,s.mode,r.created_at')+' AS recorded_at,r.outcome,r.play_time_ms,r.play_time_partial FROM '+from+where+' ORDER BY recorded_at DESC,id DESC LIMIT 51 OFFSET ?').bind(...args,page*50).all()).results;
 const count=await env.DB.prepare('SELECT COUNT(*) n FROM '+from+where).bind(...args).first();
 return {player,kind,page,total:count.n,hasMore:rows.length>50,items:rows.slice(0,50)};
}
