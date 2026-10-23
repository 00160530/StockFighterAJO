import {fail,integer,text,uuid,nowSeconds} from './security.mjs';
import {adminCount,readAdminOverview} from './admin-counts.mjs';
import {validDeviceFilter} from './device.mjs';
import {MAX_EXPORT_ROWS} from './admin-runs.mjs';

// Called only after admin authentication. Never return player/session credentials.
export async function listPlayers(env,params,options={}){
 if(options.snapshot){const items=(await env.DB.prepare('SELECT p.id,p.nickname,p.avatar_id,p.avatar_character,p.created_at,p.last_seen_at,p.last_device_type,p.life_completed_count,p.free_completed_count,(SELECT COUNT(*) FROM sf_runs r WHERE r.player_id=p.id) upload_count,(SELECT MAX(c.play_time_ms) FROM sf_life_completions c WHERE c.player_id=p.id) longest_play_time_ms FROM sf_players p').all()).results;return {items,total:items.length,fetchedAt:nowSeconds()};}
 const page=integer(Number(params.get('page')||0),0,10000,'頁數');
 const query=text(params.get('q')||'',0,80,'暱稱'),id=text(params.get('id')||'',0,120,'匿名玩家編號');
 const named=params.get('named')||'all',uploads=params.get('uploads')||'all',sort=params.get('sort')||'online',device=params.get('device')||'all',exporting=options.exporting===true,size=exporting?MAX_EXPORT_ROWS:50;
 const sorts={online:'p.last_seen_at DESC NULLS LAST,p.id DESC',newest:'p.created_at DESC,p.id DESC',oldest:'p.created_at,p.id',uploads:'upload_count DESC,p.created_at DESC,p.id DESC',life_completed:'life_completed_count DESC,p.created_at DESC,p.id DESC',free_completed:'free_completed_count DESC,p.created_at DESC,p.id DESC',duration:'longest_play_time_ms DESC NULLS LAST,p.created_at DESC,p.id DESC',nickname:'p.nickname COLLATE NOCASE ASC NULLS LAST,p.id'};
 if(!['all','yes','no'].includes(named)||!['all','yes','no'].includes(uploads)||!validDeviceFilter(device)||!Object.hasOwn(sorts,sort))fail(400,'INVALID_FILTER','查詢條件不正確。');
 const clauses=[],args=[],like=value=>'%'+value.replace(/[\\%_]/g,'\\$&')+'%';
 if(query){clauses.push("p.nickname LIKE ? ESCAPE '\\'");args.push(like(query));}
 if(id){clauses.push("p.id LIKE ? ESCAPE '\\'");args.push(like(id));}
 if(named!=='all')clauses.push(named==='yes'?"p.nickname IS NOT NULL AND p.nickname<>''":"(p.nickname IS NULL OR p.nickname='')");
 if(uploads!=='all')clauses.push((uploads==='no'?'NOT ':'')+'EXISTS (SELECT 1 FROM sf_runs r WHERE r.player_id=p.id)');
 if(device!=='all'){clauses.push('p.last_device_type=?');args.push(device);}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 const fields='p.id,p.nickname,p.avatar_id,p.avatar_character,p.created_at,p.last_seen_at,p.last_device_type,p.life_completed_count,p.free_completed_count';
 const stats={upload_count:'(SELECT COUNT(*) FROM sf_runs r WHERE r.player_id=p.id)',life_completed_count:'p.life_completed_count',free_completed_count:'p.free_completed_count',longest_play_time_ms:'(SELECT MAX(c.play_time_ms) FROM sf_life_completions c WHERE c.player_id=p.id)'};
 const metric={uploads:'upload_count',life_completed:'life_completed_count',free_completed:'free_completed_count',duration:'longest_play_time_ms'}[sort],defer=!!metric;
 // Preserve indexed simple sorts. Other sorts calculate only their ordering value before LIMIT.
 const stored=new Set(['life_completed_count','free_completed_count']);
 const limit=' LIMIT '+(size+1)+' OFFSET ?',pageSql='SELECT '+fields+(metric&&!stored.has(metric)?','+stats[metric]+' AS '+metric:'')+' FROM sf_players p'+where+' ORDER BY '+sorts[sort]+limit;
 const sql=(defer?'WITH page AS MATERIALIZED ('+pageSql+') ':'')+'SELECT '+fields+','+Object.entries(stats).filter(([key])=>!stored.has(key)).map(([key,value])=>(defer&&metric===key?'p.'+key:value)+' AS '+key).join(',')+' FROM '+(defer?'page':'sf_players')+' p'+(defer?'':where)+' ORDER BY '+sorts[sort]+(defer?'':limit);
 const rows=(await env.DB.prepare(sql).bind(...args,exporting?0:page*size).all()).results;
 if(exporting){if(rows.length>MAX_EXPORT_ROWS)fail(413,'EXPORT_TOO_LARGE','一次最多匯出 10,000 筆，請縮小篩選條件後再試。');return {items:rows,total:rows.length,exportedAt:nowSeconds()};}
 const count=!clauses.length&&options.request?{n:(await readAdminOverview(env,options)).players}:await adminCount(env,'players-total:'+JSON.stringify([query,id,named,uploads,device]),()=>env.DB.prepare('SELECT COUNT(*) AS n FROM sf_players p'+where).bind(...args).first(),options);
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
