import {EDITION} from './edition.mjs';
import {fail} from './security.mjs';
export const CATEGORIES=['won','financing','gain','reincarnation'];
export function category(value='won'){
 if(!CATEGORIES.includes(value))fail(400,'INVALID_BOARD','請選擇有效的線上排行榜分類。');return value;
}
const supported=[EDITION.id,...(EDITION.compatibleEditionIds||[])];
const emptyBoards=()=>Object.fromEntries(['life','free'].map(m=>[m,Object.fromEntries(CATEGORIES.map(c=>[c,{items:[],entry:null}]))]));
const family=m=>supported.flatMap(id=>[id+':'+EDITION.rulesets[m],id+':'+EDITION.rulesets[m]+':margin-v1']);
export async function boardSnapshot(env,playerId=null,before=null,{mode=null,board=null,entryOnly=false,owners=false}={}){
 const life=family('life'),free=family('free'),slots=life.map(()=>'?').join(',');
 if(entryOnly&&playerId&&mode&&board){
  const filter=board==='won'?"AND outcome='won'":board==='financing'?"AND json_extract(margin_summary,'$.totalBorrowedCents')>0":board==='gain'?'AND gain_cents>0':'';
  const found=board==='reincarnation'?await env.DB.prepare('SELECT 1 FROM sf_life_completions c CROSS JOIN sf_sessions s ON s.id=c.session_id WHERE c.player_id=? AND s.mode=? LIMIT 1').bind(playerId,mode).first():await env.DB.prepare(`SELECT 1 FROM sf_runs WHERE player_id=? AND mode=? AND edition IN (${slots}) AND hidden=0 ${filter} LIMIT 1`).bind(playerId,mode,...family(mode)).first();
  if(!found)return emptyBoards();
 }
 const selected=CATEGORIES.filter(c=>!board||c===board),measures=[];
 if(selected.includes('won'))measures.push("SELECT *, 'won' AS category,equity_cents AS value FROM eligible WHERE outcome='won'");
 if(selected.includes('financing'))measures.push("SELECT *, 'financing' AS category,CAST(json_extract(margin_summary,'$.totalBorrowedCents') AS INTEGER) AS value FROM eligible WHERE json_extract(margin_summary,'$.totalBorrowedCents')>0");
 if(selected.includes('gain'))measures.push("SELECT *, 'gain' AS category,gain_cents AS value FROM eligible WHERE gain_cents>0");
 const rows=measures.length?(await env.DB.prepare(`WITH eligible AS (
  SELECT r.*,p.nickname,p.avatar_id,p.avatar_character FROM sf_runs r JOIN sf_players p ON p.id=r.player_id
  WHERE r.hidden=0 AND p.banned=0 AND p.nickname IS NOT NULL
   ${mode?`AND r.mode=? AND r.edition IN (${slots})`:`AND ((r.mode='life' AND r.edition IN (${slots})) OR (r.mode='free' AND r.edition IN (${slots})))`}
   ${before?'AND r.rowid<(SELECT rowid FROM sf_runs WHERE id=?)':''}
 ), measures AS (
  ${measures.join(' UNION ALL ')}
 ), best AS (
  SELECT *,ROW_NUMBER() OVER(PARTITION BY mode,category,player_id ORDER BY value DESC,COALESCE(gain_cents,0) DESC,trades,submitted_at,id) AS personal FROM measures
 ), ranked AS (
  SELECT *,ROW_NUMBER() OVER(PARTITION BY mode,category ORDER BY value DESC,COALESCE(gain_cents,0) DESC,trades,submitted_at,id) AS rank FROM best WHERE personal=1
 ) SELECT * FROM ranked WHERE ${entryOnly?'player_id=?':'rank<=100 OR player_id=?'} ORDER BY mode,category,rank`).bind(...(mode?[mode,...family(mode)]:[...life,...free]),...(before?[before.id]:[]),playerId).all()).results:[];
 const boards=emptyBoards();
 for(const row of rows){
  const item={...(owners?{_owner:row.player_id}:{}),rank:row.rank,runId:row.id,nickname:row.nickname,avatarId:row.avatar_id,avatarCharacter:row.avatar_character,isOwn:!!playerId&&row.player_id===playerId,
   outcome:row.outcome,finishStatus:row.finish_status||row.outcome,mode:row.mode,score:row.score,equityCents:row.equity_cents,benchmarkCents:row.benchmark_cents,trades:row.trades,drawdownBps:row.drawdown_bps,
   gainCents:row.gain_cents,lossCents:row.loss_cents,highlights:JSON.parse(row.highlights),margin:JSON.parse(row.margin_summary),financing:row.financing?'margin':'cash',value:row.value,submittedAt:row.submitted_at,
   startDate:row.start_date||EDITION.start,earlySettlementDate:row.early_settlement_date,dateJumps:JSON.parse(row.date_jumps||'[]')};
  const b=boards[row.mode][row.category];if(row.rank<=100)b.items.push(item);if(item.isOwn)b.entry=item;
 }
 const cycles=selected.includes('reincarnation')?(await env.DB.prepare(`WITH counts AS (
  SELECT c.player_id,s.mode,p.nickname,p.avatar_id,p.avatar_character,COUNT(*) value,MAX(c.created_at) last_completed
  FROM sf_life_completions c CROSS JOIN sf_sessions s ON s.id=c.session_id JOIN sf_players p ON p.id=c.player_id
  WHERE p.banned=0 AND p.nickname IS NOT NULL ${mode?'AND s.mode=?':''} ${before?'AND c.session_id<>? AND c.rowid<(SELECT rowid FROM sf_life_completions WHERE session_id=?)':''}
  GROUP BY c.player_id,s.mode
 ), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY mode ORDER BY value DESC,last_completed,player_id) rank FROM counts)
 SELECT * FROM ranked WHERE ${entryOnly?'player_id=?':'rank<=100 OR player_id=?'} ORDER BY mode,rank`).bind(...(mode?[mode]:[]),...(before?[before.session_id,before.session_id]:[]),playerId).all()).results:[];
 for(const r of cycles){const item={...(owners?{_owner:r.player_id}:{}),rank:r.rank,mode:r.mode,nickname:r.nickname,avatarId:r.avatar_id,avatarCharacter:r.avatar_character,isOwn:!!playerId&&r.player_id===playerId,value:r.value,completedCount:r.value,lastCompletedAt:r.last_completed,runId:null};const b=boards[r.mode].reincarnation;if(r.rank<=100)b.items.push(item);if(item.isOwn)b.entry=item;}
 return boards;
}
export async function scoreReceipt(env,run,playerId){
 const hydrate=(receipt,boards)=>({...receipt,rank:boards[run.mode].won.entry,notifications:(receipt.notifications||[]).flatMap(n=>{const current=boards[run.mode][n.category].entry;return current&&current.rank<=100&&(n.category==='reincarnation'||current.runId===run.id)?[{...n,rank:current.rank}]:[];})});
 if(run.upload_receipt)return hydrate(JSON.parse(run.upload_receipt),await boardSnapshot(env,playerId,null,{mode:run.mode,entryOnly:true}));
 const before=await boardSnapshot(env,playerId,run,{mode:run.mode,entryOnly:true}),after=await boardSnapshot(env,playerId,null,{mode:run.mode,entryOnly:true}),notifications=[];
 const history=(await env.DB.prepare('SELECT upload_receipt FROM sf_runs WHERE player_id=? AND id<>? AND upload_receipt IS NOT NULL').bind(playerId,run.id).all()).results.flatMap(r=>JSON.parse(r.upload_receipt).notifications||[]);
 for(const category of CATEGORIES){const old=before[run.mode][category].entry,next=after[run.mode][category].entry;
  if(!next||next.rank>100||(category!=='reincarnation'&&next.runId!==run.id))continue;
  const first=!(old&&old.rank<=100)&&!history.some(n=>n.mode===run.mode&&n.category===category),improved=!!old&&(next.value>old.value||next.value===old.value&&category!=='reincarnation'&&next.runId!==old.runId);
  if(first||improved)notifications.push({category,mode:run.mode,kind:first?'first':'best',rank:next.rank,previousRank:old?.rank??null,equityCents:run.equity_cents,value:next.value});
 }
 // Store only immutable score/notification metadata. Names and avatars always
 // come from the canonical player join, including recovered receipts.
 const receipt={submitted:true,runId:run.id,submittedAt:run.submitted_at,notifications,verification:'basic'};
 await env.DB.prepare('UPDATE sf_runs SET upload_receipt=? WHERE id=? AND player_id=? AND upload_receipt IS NULL').bind(JSON.stringify(receipt),run.id,playerId).run();
 const saved=await env.DB.prepare('SELECT upload_receipt FROM sf_runs WHERE id=?').bind(run.id).first();return hydrate(JSON.parse(saved.upload_receipt),after);
}
