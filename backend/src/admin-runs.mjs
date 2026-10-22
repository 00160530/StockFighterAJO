import {fail,integer,text,nowSeconds} from './security.mjs';
import {validDeviceFilter} from './device.mjs';
export const MAX_EXPORT_ROWS=10000;
export async function listRuns(env,params,{exporting=false}={}){
 const page=integer(Number(params.get('page')||0),0,10000,'頁數'),q=text(params.get('q')||'',0,80,'查詢文字'),id=text(params.get('id')||'',0,80,'成績編號'),playerId=text(params.get('playerId')||'',0,120,'匿名玩家編號'),state=params.get('status')||'all',mode=params.get('mode')||'all',finance=params.get('financing')||'all',device=params.get('device')||'all',sort=params.get('sort')||'latest';
 const sorts={financing_total:"COALESCE(CAST(json_extract(margin_summary,'$.totalBorrowedCents') AS INTEGER),0) DESC,submitted_at DESC,id DESC",latest:'submitted_at DESC,id DESC',score:'score DESC,submitted_at DESC,id DESC',equity:'equity_cents DESC,id DESC',duration:'play_time_ms DESC,id DESC',trades:'trades DESC,id DESC',gain:'gain_cents DESC,id DESC',loss:'loss_cents ASC NULLS LAST,id DESC'};
 if(!['all','active','revoked'].includes(state)||!['all','life','free'].includes(mode)||!['all','cash','margin'].includes(finance)||!validDeviceFilter(device)||!Object.hasOwn(sorts,sort))fail(400,'INVALID_FILTER','查詢條件不正確。');
 const clauses=[],args=[],like=v=>'%'+v.replace(/[\\%_]/g,'\\$&')+'%';
 if(q){clauses.push("nickname LIKE ? ESCAPE '\\'");args.push(like(q));}if(id){clauses.push('id=?');args.push(id);}if(playerId){clauses.push("player_id LIKE ? ESCAPE '\\'");args.push(like(playerId));}if(state!=='all'){clauses.push('hidden=?');args.push(state==='revoked'?1:0);}if(mode!=='all'){clauses.push('mode=?');args.push(mode);}if(finance!=='all'){clauses.push('financing=?');args.push(finance==='margin'?1:0);}if(device!=='all'){clauses.push('device_type=?');args.push(device);}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'',from=' FROM (SELECT r.*,p.nickname,p.avatar_id,p.avatar_character FROM sf_runs r JOIN sf_players p ON p.id=r.player_id)',size=exporting?MAX_EXPORT_ROWS:50;
 const fields='id,player_id,device_type,nickname,mode,outcome,score,equity_cents,benchmark_cents,gain_cents,loss_cents,highlights,drawdown_bps,trades,hidden,moderation_note,submitted_at,financing,margin_summary,play_time_ms,play_time_partial,skill_uses,avatar_id,avatar_character,start_date,early_settlement_date,date_jumps';
 const rows=(await env.DB.prepare('SELECT '+fields+from+where+' ORDER BY '+sorts[sort]+' LIMIT ? OFFSET ?').bind(...args,size+1,exporting?0:page*size).all()).results;
 if(exporting){if(rows.length>MAX_EXPORT_ROWS)fail(413,'EXPORT_TOO_LARGE','一次最多匯出 10,000 筆，請縮小篩選條件後再試。');return {items:rows,total:rows.length,exportedAt:nowSeconds()};}
 const count=await env.DB.prepare('SELECT COUNT(*) AS n'+from+where).bind(...args).first();return {items:rows.slice(0,size),hasMore:rows.length>size,page,total:count.n};
}
