// Frozen shipped ranking implementation; equivalence oracle for the query optimization.
import {EDITION} from '../../src/edition.mjs';
import {fail} from '../../src/security.mjs';
export const CATEGORIES=['won','financing','gain','reincarnation'];
export function category(value='won'){
 if(!CATEGORIES.includes(value))fail(400,'INVALID_BOARD','請選擇有效的線上排行榜分類。');return value;
}
const supported=[EDITION.id,...(EDITION.compatibleEditionIds||[])];
const family=m=>supported.flatMap(id=>[id+':'+EDITION.rulesets[m],id+':'+EDITION.rulesets[m]+':margin-v1']);
export async function boardSnapshot(env,playerId=null,before=null){
 const life=family('life'),free=family('free'),slots=life.map(()=>'?').join(',');
 const rows=(await env.DB.prepare(`WITH eligible AS (
  SELECT r.*,p.nickname,p.avatar_id,p.avatar_character FROM sf_runs r JOIN sf_players p ON p.id=r.player_id
  WHERE r.hidden=0 AND p.banned=0 AND p.nickname IS NOT NULL
   AND ((r.mode='life' AND r.edition IN (${slots})) OR (r.mode='free' AND r.edition IN (${slots})))
   ${before?'AND r.rowid<(SELECT rowid FROM sf_runs WHERE id=?)':''}
 ), measures AS (
  SELECT *, 'won' AS category,equity_cents AS value FROM eligible WHERE outcome='won'
  UNION ALL SELECT *, 'financing',CAST(json_extract(margin_summary,'$.totalBorrowedCents') AS INTEGER) FROM eligible WHERE json_extract(margin_summary,'$.totalBorrowedCents')>0
  UNION ALL SELECT *, 'gain',gain_cents FROM eligible WHERE gain_cents>0
 ), best AS (
  SELECT *,ROW_NUMBER() OVER(PARTITION BY mode,category,player_id ORDER BY value DESC,COALESCE(gain_cents,0) DESC,trades,submitted_at,id) AS personal FROM measures
 ), ranked AS (
  SELECT *,ROW_NUMBER() OVER(PARTITION BY mode,category ORDER BY value DESC,COALESCE(gain_cents,0) DESC,trades,submitted_at,id) AS rank FROM best WHERE personal=1
 ) SELECT * FROM ranked WHERE rank<=100 OR player_id=? ORDER BY mode,category,rank`).bind(...life,...free,...(before?[before.id]:[]),playerId).all()).results;
 const boards=Object.fromEntries(['life','free'].map(m=>[m,Object.fromEntries(CATEGORIES.map(c=>[c,{items:[],entry:null}]))]));
 for(const row of rows){
  const item={rank:row.rank,runId:row.id,nickname:row.nickname,avatarId:row.avatar_id,avatarCharacter:row.avatar_character,isOwn:!!playerId&&row.player_id===playerId,
   outcome:row.outcome,finishStatus:row.finish_status||row.outcome,mode:row.mode,score:row.score,equityCents:row.equity_cents,benchmarkCents:row.benchmark_cents,trades:row.trades,drawdownBps:row.drawdown_bps,
   gainCents:row.gain_cents,lossCents:row.loss_cents,highlights:JSON.parse(row.highlights),margin:JSON.parse(row.margin_summary),financing:row.financing?'margin':'cash',value:row.value,submittedAt:row.submitted_at,
   startDate:row.start_date||EDITION.start,earlySettlementDate:row.early_settlement_date,dateJumps:JSON.parse(row.date_jumps||'[]')};
  const b=boards[row.mode][row.category];if(row.rank<=100)b.items.push(item);if(item.isOwn)b.entry=item;
 }
 const cycles=(await env.DB.prepare(`WITH counts AS (
  SELECT c.player_id,s.mode,p.nickname,p.avatar_id,p.avatar_character,COUNT(*) value,MAX(c.created_at) last_completed
  FROM sf_life_completions c JOIN sf_sessions s ON s.id=c.session_id JOIN sf_players p ON p.id=c.player_id
  WHERE p.banned=0 AND p.nickname IS NOT NULL ${before?'AND c.session_id<>? AND c.rowid<(SELECT rowid FROM sf_life_completions WHERE session_id=?)':''}
  GROUP BY c.player_id,s.mode
 ), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY mode ORDER BY value DESC,last_completed,player_id) rank FROM counts)
 SELECT * FROM ranked WHERE rank<=100 OR player_id=? ORDER BY mode,rank`).bind(...(before?[before.session_id,before.session_id]:[]),playerId).all()).results;
 for(const r of cycles){const item={rank:r.rank,mode:r.mode,nickname:r.nickname,avatarId:r.avatar_id,avatarCharacter:r.avatar_character,isOwn:!!playerId&&r.player_id===playerId,value:r.value,completedCount:r.value,lastCompletedAt:r.last_completed,runId:null};const b=boards[r.mode].reincarnation;if(r.rank<=100)b.items.push(item);if(item.isOwn)b.entry=item;}
 return boards;
}
