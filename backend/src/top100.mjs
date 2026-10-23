import {EDITION} from './edition.mjs';
import {fail} from './security.mjs';
export const CATEGORIES=['won','financing','gain','reincarnation'];
export function category(value='won'){if(!CATEGORIES.includes(value))fail(400,'INVALID_BOARD','請選擇有效的線上排行榜分類。');return value;}
const empty=()=>Object.fromEntries(['life','free'].map(m=>[m,Object.fromEntries(CATEGORIES.map(c=>[c,{items:[],entry:null}]))]));
const ordering='b.value DESC,b.gain_cents DESC,b.trades,b.submitted_at,b.tie_id';
export async function topSnapshot(env,playerId=null,{mode=null,board=null,owners=false,entryOnly=false}={}){
 const boards=empty(),clauses=[],args=[];if(mode){clauses.push('b.mode=?');args.push(mode);}if(board){clauses.push('b.category=?');args.push(board);}const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
 // Every partition is bounded to 100 by write-time maintenance. No run-history ranking.
 const rows=(await env.DB.prepare(`SELECT b.*,p.nickname,p.avatar_id,p.avatar_character,r.outcome,r.finish_status,r.score,r.equity_cents,r.benchmark_cents,r.drawdown_bps,r.gain_cents run_gain_cents,r.loss_cents,r.highlights,r.margin_summary,r.financing,r.start_date,r.early_settlement_date,r.date_jumps,
 ROW_NUMBER() OVER(PARTITION BY b.mode,b.category ORDER BY ${ordering}) rank
 FROM sf_leaderboard_top100 b JOIN sf_players p ON p.id=b.player_id LEFT JOIN sf_runs r ON r.id=b.run_id${where} ORDER BY b.mode,b.category,${ordering}`).bind(...args).all()).results;
 for(const row of rows){const own=!!playerId&&row.player_id===playerId,base={...(owners?{_owner:row.player_id}:{}),rank:row.rank,mode:row.mode,nickname:row.nickname,avatarId:row.avatar_id,avatarCharacter:row.avatar_character,isOwn:own,value:row.value,runId:row.run_id},item=row.category==='reincarnation'?{...base,completedCount:row.value,lastCompletedAt:row.submitted_at}:{...base,outcome:row.outcome,finishStatus:row.finish_status||row.outcome,score:row.score,equityCents:row.equity_cents,benchmarkCents:row.benchmark_cents,trades:row.trades,drawdownBps:row.drawdown_bps,gainCents:row.run_gain_cents,lossCents:row.loss_cents,highlights:JSON.parse(row.highlights||'{}'),margin:JSON.parse(row.margin_summary||'{}'),financing:row.financing?'margin':'cash',submittedAt:row.submitted_at,startDate:row.start_date||EDITION.start,earlySettlementDate:row.early_settlement_date,dateJumps:JSON.parse(row.date_jumps||'[]')};const b=boards[row.mode][row.category];if(!entryOnly||own)b.items.push(item);if(own)b.entry=item;}
 return boards;
}
export function personalize(boards,playerId,profile=null){for(const mode of ['life','free'])for(const c of CATEGORIES){const b=boards[mode][c];b.items=b.items.map(({_owner,...item})=>({...item,isOwn:!!playerId&&_owner===playerId,...(playerId&&_owner===playerId&&profile?{nickname:profile.nickname,avatarId:profile.avatarId,avatarCharacter:profile.avatarCharacter}:{})}));b.entry=b.items.find(x=>x.isOwn)||null;}return boards;}

export async function scoreReceipt(env,run,playerId){
 const boards=await topSnapshot(env,playerId,{mode:run.mode,entryOnly:true});
 const hydrate=receipt=>({...receipt,rank:boards[run.mode].won.entry?.runId===run.id?boards[run.mode].won.entry:null,notifications:(receipt.notifications||[]).flatMap(n=>{const current=boards[run.mode][n.category]?.entry;return current&&(n.category==='reincarnation'||current.runId===run.id)?[{...n,rank:current.rank}]:[];})});
 if(run.upload_receipt)return hydrate(JSON.parse(run.upload_receipt));
 const completion=await env.DB.prepare('SELECT board_before FROM sf_life_completions WHERE session_id=?').bind(run.session_id).first();
 const before=new Map([...JSON.parse(run.board_before||'[]'),...JSON.parse(completion?.board_before||'[]')].map(x=>[x.category,x]));
 const history=(await env.DB.prepare('SELECT upload_receipt FROM sf_runs WHERE player_id=? AND id<>? AND upload_receipt IS NOT NULL').bind(playerId,run.id).all()).results.flatMap(r=>JSON.parse(r.upload_receipt).notifications||[]),notifications=[];
 for(const c of CATEGORIES){const next=boards[run.mode][c].entry,old=before.get(c);if(!next||(c!=='reincarnation'&&next.runId!==run.id)||c==='reincarnation'&&old&&next.value<=old.value)continue;
  const known=history.some(n=>n.mode===run.mode&&n.category===c),kind=old||known?'best':'first';
  notifications.push({category:c,mode:run.mode,kind,rank:next.rank,previousRank:old?.rank??null,equityCents:run.equity_cents,value:next.value});
 }
 const receipt={submitted:true,runId:run.id,submittedAt:run.submitted_at,notifications,verification:'basic'};
 await env.DB.prepare('UPDATE sf_runs SET upload_receipt=? WHERE id=? AND player_id=? AND upload_receipt IS NULL').bind(JSON.stringify(receipt),run.id,playerId).run();
 const saved=await env.DB.prepare('SELECT upload_receipt FROM sf_runs WHERE id=?').bind(run.id).first();return hydrate(JSON.parse(saved.upload_receipt));
}
