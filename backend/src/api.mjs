import {readAnnouncement,publishAnnouncement} from './announcements.mjs';
import {readUpdates,saveUpdate,deleteUpdate} from './update-announcements.mjs';
import {quoteList,quoteBoards,createQuote,likeQuote,quotesAdmin} from './quotes.mjs';
import {START_BENCHMARKS} from './start-benchmarks.mjs';
import {communityAdmin,publicPolls,lifeCounts,vote} from './community.mjs';
import {validateSharedRecord} from './shares.mjs';
import {EDITION} from './edition.mjs';
import {adminIdentity,adminLogin,adminLogout} from './admin-auth.mjs';
import {ApiError,fail,nowSeconds,randomToken,hash,hmac,readJson,exactKeys,integer,text,nickname,uuid,player,rate,ipKey} from './security.mjs';
export {EDITION};
const METRICS=['alpha','gain','loss'];
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const all=async q=>(await q.all()).results;
const mode=v=>{if(!['life','free'].includes(v))fail(400,'INVALID_MODE','請選擇有效的遊戲模式。');return v;};
const finance=v=>{v=v||'cash';if(!['cash','margin'].includes(v))fail(400,'INVALID_FINANCING','排行榜交易方式不正確。');return v;};
const supportedEditions=[EDITION.id,...(EDITION.compatibleEditionIds||[])];
const editionFor=(m,f='cash',id=EDITION.id)=>id+':'+EDITION.rulesets[mode(m)]+(finance(f)==='margin'?':margin-v1':'');
const scoreValue=(r,metric)=>metric==='alpha'?r.score:metric==='gain'?r.gain_cents:-(r.loss_cents??0);
function bestInsert(env,runId,metric){const value=metric==='alpha'?'score':metric==='gain'?'gain_cents':'-loss_cents';return stmt(env,`INSERT INTO sf_best_scores(player_id,edition,metric,run_id,value,drawdown_bps,trades,submitted_at)
 SELECT player_id,edition,?,id,${value},drawdown_bps,trades,submitted_at FROM sf_runs WHERE id=? AND hidden=0 ${metric==='alpha'?'':metric==='gain'?'AND gain_cents>0':'AND loss_cents<0'}
 ON CONFLICT(player_id,edition,metric) DO UPDATE SET run_id=excluded.run_id,value=excluded.value,drawdown_bps=excluded.drawdown_bps,trades=excluded.trades,submitted_at=excluded.submitted_at
 WHERE excluded.value>sf_best_scores.value OR (excluded.value=sf_best_scores.value AND (excluded.drawdown_bps<sf_best_scores.drawdown_bps OR (excluded.drawdown_bps=sf_best_scores.drawdown_bps AND excluded.trades<sf_best_scores.trades)))`,metric,runId);}
const order='b.value DESC,b.drawdown_bps ASC,b.trades ASC,b.submitted_at ASC,b.run_id ASC';
function publicRow(row){return {startDate:row.start_date||EDITION.start,earlySettlementDate:row.early_settlement_date||null,dateJumps:JSON.parse(row.date_jumps||'[]'),avatarCharacter:row.avatar_character==='xiaoxiaojiu'?'xiaoxiaojiu':'xiaojiu',avatarId:row.avatar_id||1,financing:row.financing===1?'margin':'cash',margin:JSON.parse(row.margin_summary||'{}'),rank:row.rank,runId:row.id,nickname:row.nickname,outcome:row.outcome,mode:row.mode,score:row.score,equityCents:row.equity_cents,benchmarkCents:row.benchmark_cents,drawdownBps:row.drawdown_bps,trades:row.trades,gainCents:row.gain_cents,lossCents:row.loss_cents,highlights:JSON.parse(row.highlights),submittedAt:row.submitted_at};}
// Legacy financing editions remain intact; both are ranked together from source runs.
function boardOutcome(url){const v=url.searchParams.get('outcome')||(url.searchParams.get('metric')==='loss'?'lost':'won');if(!['won','lost'].includes(v))fail(400,'INVALID_OUTCOME','請選擇贏過大盤或未贏大盤。');if(url.searchParams.has('financing'))finance(url.searchParams.get('financing'));return v;}
// One snapshot query ranks all four boards and includes the caller even below 100.
async function boardSnapshot(env,playerId=null){
 const family=m=>supportedEditions.flatMap(id=>[editionFor(m,'cash',id),editionFor(m,'margin',id)]),life=family('life'),free=family('free'),slots=life.map(()=>'?').join(',');
 const tie="equity_cents DESC,CASE WHEN outcome='lost' THEN COALESCE(-loss_cents,0) ELSE COALESCE(gain_cents,0) END DESC,trades ASC,submitted_at ASC,id ASC";
 const rows=await all(stmt(env,`WITH candidates AS (
  SELECT r.*,ROW_NUMBER() OVER(PARTITION BY mode,outcome,player_id ORDER BY ${tie}) AS player_best FROM sf_runs r
  WHERE hidden=0 AND outcome IN ('won','lost') AND
   ((mode='life' AND edition IN (${slots})) OR (mode='free' AND edition IN (${slots})))
 ), ranked AS (
  SELECT *,ROW_NUMBER() OVER(PARTITION BY mode,outcome ORDER BY ${tie}) AS rank FROM candidates WHERE player_best=1
 ) SELECT * FROM ranked WHERE rank<=100 OR player_id=? ORDER BY mode,outcome,rank`,...life,...free,playerId));
 const boards={life:{won:{items:[],entry:null},lost:{items:[],entry:null}},free:{won:{items:[],entry:null},lost:{items:[],entry:null}}};
 for(const row of rows){const b=boards[row.mode][row.outcome],item=publicRow(row);if(row.rank<=100)b.items.push(item);if(playerId&&row.player_id===playerId)b.entry=item;}
 return boards;
}
async function ranking(env,m,outcome='won',playerId=null){
 const editions=supportedEditions.flatMap(id=>[editionFor(m,'cash',id),editionFor(m,'margin',id)]),slots=editions.map(()=>'?').join(',');if(!['won','lost'].includes(outcome))fail(400,'INVALID_OUTCOME','排行榜分類不正確。');
 const tie='equity_cents DESC,'+(outcome==='lost'?'COALESCE(-loss_cents,0)':'COALESCE(gain_cents,0)')+' DESC,trades ASC,submitted_at ASC,id ASC';
 const rows=await all(stmt(env,`WITH candidates AS (
  SELECT r.*,ROW_NUMBER() OVER(PARTITION BY player_id ORDER BY ${tie}) AS player_best FROM sf_runs r
  WHERE edition IN (${slots}) AND mode=? AND outcome=? AND hidden=0
 ), ranked AS (SELECT *,ROW_NUMBER() OVER(ORDER BY ${tie}) AS rank FROM candidates WHERE player_best=1)
 SELECT * FROM ranked ${playerId?'WHERE player_id=?':'ORDER BY rank LIMIT 100'}`,...editions,m,outcome,...(playerId?[playerId]:[])));
 return playerId?(rows[0]?publicRow(rows[0]):null):rows.map(publicRow);
}
function highlight(raw,sign){if(raw===null)return null;if(!raw||typeof raw!=='object'||Array.isArray(raw))fail(400,'INVALID_HIGHLIGHT','交易高光不正確。');exactKeys(raw,['symbol','date','qty','priceCents','pnlCents','costBasisCents']);if(raw.costBasisCents!==undefined){integer(raw.costBasisCents,1,EDITION.maxEquityCents,'交易成本');const proceeds=raw.costBasisCents+raw.pnlCents;if(!Number.isSafeInteger(proceeds)||proceeds<0||proceeds>raw.priceCents*raw.qty)fail(400,'INVALID_HIGHLIGHT','交易成本與損益不一致。');}if(!EDITION.symbols.some(s=>s.id===raw.symbol)||typeof raw.date!=='string'||raw.date<EDITION.start||raw.date>EDITION.datasetEnd||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date))fail(400,'INVALID_HIGHLIGHT','高光的標的或日期不正確。');integer(raw.qty,1,100000000*4,'高光股數');integer(raw.priceCents,1,100000000,'高光價格');integer(raw.pnlCents,-EDITION.maxEquityCents,EDITION.maxEquityCents,'高光損益');if(raw.pnlCents*sign<=0)fail(400,'INVALID_HIGHLIGHT','高光損益方向不正確。');return raw;}
function marginSummary(raw){
 if(raw===undefined)return null;if(!raw||typeof raw!=='object'||Array.isArray(raw))fail(400,'INVALID_MARGIN','融資紀錄不正確。');
 exactKeys(raw,['totalBorrowedCents','totalInterestCents','interestPaidCents','totalTopupsCents','liquidations','principalCents','interestCents','collateralCents']);
 for(const k of ['totalBorrowedCents','totalInterestCents','interestPaidCents','totalTopupsCents','principalCents','interestCents','collateralCents'])integer(raw[k],0,EDITION.maxEquityCents,'融資金額');integer(raw.liquidations,0,EDITION.sessions*4,'斷頭次數');
 if(raw.totalBorrowedCents<=0||raw.principalCents>raw.totalBorrowedCents||raw.interestPaidCents>raw.totalInterestCents||raw.collateralCents>raw.totalTopupsCents||raw.interestCents!==raw.totalInterestCents-raw.interestPaidCents||(!raw.principalCents&&(raw.interestCents||raw.collateralCents)))fail(400,'INVALID_MARGIN','融資借款與利息紀錄不一致。');return raw;
}
function privateStats(body,session,now){
 const playTimeMs=body.playTimeMs??null;if(playTimeMs!==null)integer(playTimeMs,0,Math.max(0,now-session.created_at+60)*1000,'遊玩時長');if(body.playTimePartial!==undefined&&typeof body.playTimePartial!=='boolean')fail(400,'INVALID_STATS','遊玩時長紀錄不正確。');
 const skillUses=body.skillUses??null;if(skillUses!==null){if(typeof skillUses!=='object'||Array.isArray(skillUses))fail(400,'INVALID_STATS','技能次數不正確。');exactKeys(skillUses,['mother','vip','divination','calendar']);if(skillUses.calendar!==undefined)integer(skillUses.calendar,0,5,'日期跳躍次數');integer(skillUses.mother,0,1000000,'媽媽10塊次數');integer(skillUses.vip,0,EDITION.sessions*3,'VIP次數');integer(skillUses.divination,0,3,'奇門遁甲次數');}return {playTimeMs,playTimePartial:body.playTimePartial===true?1:0,skillUses};
}
function journey(body,session){
 const startDate=body.startDate??EDITION.start,meta=START_BENCHMARKS[startDate],earlySettlementDate=body.earlySettlementDate??null;
 if(!meta||startDate!==(session.start_date||EDITION.start)||(body.customStartDate!=null&&body.customStartDate!==startDate)||(startDate!==EDITION.start&&body.customStartDate!==startDate)||earlySettlementDate!==null&&(!START_BENCHMARKS[earlySettlementDate]||earlySettlementDate<startDate))fail(400,'INVALID_JOURNEY','起始日期或提前結算日期不正確。');
 const dateJumps=body.dateJumps??[];if(!Array.isArray(dateJumps)||dateJumps.length>5)fail(400,'INVALID_JOURNEY','日期跳躍紀錄不正確。');for(let i=0;i<dateJumps.length;i++){const j=dateJumps[i];if(!j||typeof j!=='object'||Array.isArray(j))fail(400,'INVALID_JOURNEY','日期跳躍格式不正確。');exactKeys(j,['from','to']);if(!START_BENCHMARKS[j.from]||!START_BENCHMARKS[j.to]||j.from<startDate||j.to<=j.from||j.to>body.date||i&&j.from<dateJumps[i-1].to)fail(400,'INVALID_JOURNEY','日期跳躍範圍不正確。');}return {startDate,earlySettlementDate,dateJumps,...meta};
}
export function validateScore(body,session,now){
 exactKeys(body,['sessionId','sessionToken','nickname','editionId','mode','outcome','date','sessions','score','equityCents','benchmarkCents','drawdownBps','trades','buyTrades','sellTrades','maxGain','maxLoss','margin','playTimeMs','playTimePartial','skillUses','avatarId','avatarCharacter','startDate','customStartDate','earlySettlementDate','dateJumps']);
 const dates=journey(body,session);
 if(!supportedEditions.includes(body.editionId)||session.mode!==body.mode||!(session.edition===editionFor(body.mode,'cash',body.editionId)||body.editionId===EDITION.id&&supportedEditions.some(id=>session.edition===editionFor(body.mode,'cash',id))))fail(400,'EDITION_MISMATCH','這輪的模式或行情版本不相容。');
 if(body.date!==EDITION.datasetEnd||body.sessions!==dates.sessions)fail(400,'INCOMPLETE_RUN','只有走到行情終點的完整輪次可以提交。');
 const equity=integer(body.equityCents,1,EDITION.maxEquityCents,'總資產'),benchmark=integer(body.benchmarkCents,1,Number.MAX_SAFE_INTEGER,'0050 基準');if(benchmark!==dates.benchmarkCents)fail(400,'BENCHMARK_MISMATCH','0050 基準不符合這個資料版本。');
 const score=integer(body.score,Math.round((1-benchmark)/10000),Math.round((EDITION.maxEquityCents-benchmark)/10000),'分數');if(score!==Math.round((equity-benchmark)/10000))fail(400,'SCORE_MISMATCH','分數與總資產不一致。');
 const outcome=equity>benchmark?'won':'lost';if(body.outcome!==outcome)fail(400,'OUTCOME_MISMATCH','結局與資產不一致。');
 integer(body.drawdownBps,0,10000,'最大回撤');const trades=integer(body.trades,0,EDITION.maxTrades*(body.margin?2:1),'交易次數');integer(body.buyTrades,0,trades,'買進次數');integer(body.sellTrades,0,trades,'賣出次數');if(body.buyTrades+body.sellTrades!==trades)fail(400,'TRADE_MISMATCH','交易次數不一致。');
 const margin=marginSummary(body.margin);if(margin&&(!body.buyTrades||(margin.interestPaidCents||margin.liquidations)&&!body.sellTrades))fail(400,'INVALID_MARGIN','融資紀錄與成交次數不一致。');
 const maxGain=highlight(body.maxGain,1),maxLoss=highlight(body.maxLoss,-1);if([maxGain,maxLoss].some(t=>t&&t.date<dates.startDate))fail(400,'INVALID_HIGHLIGHT','交易高光不能早於本輪起始日期。');if((maxGain||maxLoss)&&!body.sellTrades)fail(400,'TRADE_MISMATCH','沒有賣出就不會有已實現交易高光。');
 if(!trades&&equity>EDITION.initialCents)fail(400,'TRADE_MISMATCH','沒有成交的資產不能增加。');
 if(now-session.created_at<EDITION.minDurationSeconds[body.mode])fail(400,'TOO_FAST','這輪遊玩時長過短，請稍後再提交。',{retryAfter:EDITION.minDurationSeconds[body.mode]-(now-session.created_at)});
 if(body.avatarCharacter!==undefined&&!['xiaojiu','xiaoxiaojiu'].includes(body.avatarCharacter))fail(400,'INVALID_AVATAR','角色頭像不正確。');
 return {startDate:dates.startDate,earlySettlementDate:dates.earlySettlementDate,dateJumps:dates.dateJumps,avatarCharacter:body.avatarCharacter??'xiaojiu',avatarId:integer(body.avatarId??1,1,10,'心情頭像'),...privateStats(body,session,now),nickname:nickname(body.nickname),outcome,score,equityCents:equity,benchmarkCents:benchmark,drawdownBps:body.drawdownBps,trades,gainCents:maxGain?.pnlCents??null,lossCents:maxLoss?.pnlCents??null,highlights:{maxGain,maxLoss},financing:margin?1:0,marginSummary:margin||{}};
}
async function submit(request,env,body,now,ip){
 const playerId=await player(request,env);await rate(env,'score-ip:'+ip,30,3600,now);await rate(env,'score-player:'+playerId,12,3600,now);
 uuid(body.sessionId);if(typeof body.sessionToken!=='string'||!/^[a-f0-9]{64}$/.test(body.sessionToken))fail(401,'SESSION_INVALID','這輪沒有有效的線上 Session。');
 const tokenHash=await hash(body.sessionToken),session=await stmt(env,'SELECT * FROM sf_sessions WHERE id=? AND player_id=? AND token_hash=?',body.sessionId,playerId,tokenHash).first();if(!session)fail(401,'SESSION_INVALID','這輪沒有有效的線上 Session。');
 if(session.used_at!==null){const prior=await stmt(env,'SELECT outcome FROM sf_runs WHERE session_id=?',session.id).first();fail(409,'SESSION_USED','這輪已提交過成績。',{receipt:{rank:await ranking(env,session.mode,prior?.outcome||'won',playerId),submitted:true}});}
 if(session.expires_at<=now)fail(410,'SESSION_EXPIRED','這輪的線上 Session 已到期，本機紀錄仍會保留。');
 const r=validateScore(body,session,now),id=crypto.randomUUID(),profile=await stmt(env,'SELECT nickname FROM sf_players WHERE id=?',playerId).first();
 if(profile?.nickname&&profile.nickname!==r.nickname)fail(409,'NICKNAME_LOCKED','暱稱在第一次成功提交後即固定，無法修改。',{nickname:profile.nickname});
 const nameTaken=()=>fail(409,'NICKNAME_TAKEN','這個暱稱已有人使用，請換一個暱稱。');
 if(!profile?.nickname&&await stmt(env,'SELECT 1 FROM sf_players WHERE nickname IS NOT NULL AND lower(trim(nickname))=lower(trim(?)) AND id<>? LIMIT 1',r.nickname,playerId).first())nameTaken();
 let results;try{results=await env.DB.batch([
  stmt(env,'UPDATE sf_sessions SET used_at=?,submission_id=? WHERE id=? AND player_id=? AND token_hash=? AND used_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM sf_players p WHERE p.id=sf_sessions.player_id AND (p.nickname IS NULL OR p.nickname=?))',now,id,session.id,playerId,tokenHash,now,r.nickname),
  stmt(env,'UPDATE sf_players SET nickname=? WHERE id=? AND nickname IS NULL AND EXISTS (SELECT 1 FROM sf_sessions WHERE id=? AND submission_id=?)',r.nickname,playerId,session.id,id),
  stmt(env,`INSERT INTO sf_runs(id,session_id,player_id,edition,mode,nickname,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,gain_cents,loss_cents,highlights,submitted_at,financing,margin_summary,play_time_ms,play_time_partial,skill_uses,avatar_id,avatar_character,start_date,early_settlement_date,date_jumps)
   SELECT ?,id,player_id,?,mode,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM sf_sessions WHERE id=? AND submission_id=?`,id,editionFor(body.mode,r.financing?'margin':'cash',body.editionId),r.nickname,r.outcome,r.score,r.equityCents,r.benchmarkCents,r.drawdownBps,r.trades,r.gainCents,r.lossCents,JSON.stringify(r.highlights),now,r.financing,JSON.stringify(r.marginSummary),r.playTimeMs,r.playTimePartial,r.skillUses===null?null:JSON.stringify(r.skillUses),r.avatarId,r.avatarCharacter,r.startDate,r.earlySettlementDate,JSON.stringify(r.dateJumps),session.id,id),
  stmt(env,"INSERT OR IGNORE INTO sf_life_completions(session_id,player_id,outcome,created_at) SELECT session_id,player_id,outcome,submitted_at FROM sf_runs WHERE id=? AND mode='life'",id),
   ...METRICS.map(metric=>bestInsert(env,id,metric))
 ]);}catch(error){
  // The database trigger closes the race after the precheck. D1 rolls back
  // the whole batch, so a rejected nickname never consumes the game session.
  if([error?.message,error?.cause?.message].some(message=>typeof message==='string'&&message.includes('SF_NICKNAME_TAKEN')))nameTaken();
  throw error;
 }
 if(!results[2].meta.changes){const current=await stmt(env,'SELECT nickname FROM sf_players WHERE id=?',playerId).first();if(current?.nickname&&current.nickname!==r.nickname)fail(409,'NICKNAME_LOCKED','暱稱在第一次成功提交後即固定，無法修改。',{nickname:current.nickname});fail(409,'SESSION_USED','這輪已提交過成績。');}
 return {submitted:true,runId:id,nickname:r.nickname,rank:await ranking(env,session.mode,r.outcome,playerId),verification:'basic'};
}
async function feedback(request,env,body,now,ip){
 exactKeys(body,['requestId','kind','title','body','steps','version','context','website']);const playerId=await player(request,env),requestId=uuid(body.requestId);
 const existing=await stmt(env,'SELECT id FROM sf_feedback WHERE player_id=? AND request_id=?',playerId,requestId).first();if(existing)return {received:true,id:existing.id};
 await rate(env,'feedback-ip:'+ip,15,3600,now);await rate(env,'feedback-player:'+playerId,5,3600,now);if(body.website)fail(400,'INVALID_FORM','表單內容不正確。');
 if(!['wish','problem'].includes(body.kind))fail(400,'INVALID_KIND','請選擇許願或問題回報。');
 const title=text(body.title,2,80,'標題'),description=text(body.body,5,2000,'內容',true),steps=text(body.steps??'',0,1000,'重現步驟',true),version=text(body.version,1,24,'版本');let date=null,m=null;
 if(body.context!==null&&body.context!==undefined){exactKeys(body.context,['date','mode']);date=body.context.date;m=mode(body.context.mode);if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'2020-01-01'||date>EDITION.datasetEnd)fail(400,'INVALID_DATE','遊戲日期不正確。');}
 const id=crypto.randomUUID();await stmt(env,'INSERT INTO sf_feedback(id,player_id,request_id,kind,title,body,steps,version,game_date,mode,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',id,playerId,requestId,body.kind,title,description,steps,version,date,m,now,now).run();return {received:true,id};
}
function originAllowed(request,env){const origin=request.headers.get('origin');return origin&&(env.ALLOWED_ORIGINS||'').split(',').includes(origin);}
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function adminResponse(content,type){return new Response(content,{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'Referrer-Policy':'same-origin'}});}
async function admin(request,env,url,body,now,assets){
 if(request.method==='GET'&&['/admin','/admin/'].includes(url.pathname))return adminResponse(assets.html,'text/html');
 if(request.method==='GET'&&url.pathname==='/admin/style.css')return adminResponse(assets.css,'text/css');
 if(request.method==='GET'&&url.pathname==='/admin/app.js')return adminResponse(assets.js,'text/javascript');
 if(request.method==='POST'&&url.pathname==='/admin/api/login'){const r=await adminLogin(request,env,body,now);return json({username:r.username},200,{'Set-Cookie':r.cookie});}
 const actor=await adminIdentity(request,env,now);const quotesResponse=await quotesAdmin(request,env,url,body,now,actor);if(quotesResponse)return quotesResponse;const communityResponse=await communityAdmin(request,env,url,body,now,actor);if(communityResponse)return communityResponse;
 if(request.method==='GET'&&url.pathname==='/admin/api/me')return json({username:actor});
 if(request.method==='POST'&&url.pathname==='/admin/api/logout')return json({loggedOut:true},200,{'Set-Cookie':await adminLogout(request,env)});
 if(request.method==='GET'&&url.pathname==='/admin/api/announcement')return json({announcement:await readAnnouncement(env)});
 if(request.method==='POST'&&url.pathname==='/admin/api/announcement')return json({published:true,announcement:await publishAnnouncement(env,body,actor)});
 if(request.method==='GET'&&url.pathname==='/admin/api/updates')return json({items:await readUpdates(env)});
 if(request.method==='POST'&&url.pathname==='/admin/api/updates')return json({item:await saveUpdate(env,body,actor)});
 if(request.method==='POST'&&/^\/admin\/api\/updates\/[a-zA-Z0-9_.-]+(?:\/delete)?$/.test(url.pathname)){
  const deleting=url.pathname.endsWith('/delete'),id=url.pathname.split('/').at(deleting?-2:-1);
  return json(deleting?await deleteUpdate(env,body,actor,id):{item:await saveUpdate(env,body,actor,id)});
 }
  if(request.method==='GET'&&url.pathname==='/admin/api/overview'){
  const count=await stmt(env,"SELECT (SELECT COUNT(*) FROM sf_feedback WHERE status='new') AS unread,(SELECT COUNT(*) FROM sf_feedback) AS feedback,(SELECT COUNT(*) FROM sf_runs WHERE hidden=0) AS runs,(SELECT COUNT(*) FROM sf_players) AS players").first();return json({actor,...count,edition:EDITION});
 }
   if(request.method==='GET'&&url.pathname==='/admin/api/feedback'){
   const filter=url.searchParams.get('status')||'new';if(!['all','new','read','planned','done','closed','ignored'].includes(filter))fail(400,'INVALID_STATUS','狀態不正確。');
   const page=integer(Number(url.searchParams.get('page')||0),0,10000,'頁數'),where=filter==='all'?'':filter==='ignored'?' WHERE not_handled=1':' WHERE status=? AND not_handled=0',args=['all','ignored'].includes(filter)?[]:[filter];
   const rows=await all(stmt(env,"SELECT id,kind,title,body,steps,version,game_date,mode,CASE WHEN not_handled=1 THEN 'ignored' ELSE status END AS status,admin_note,created_at,updated_at FROM sf_feedback"+where+' ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?',...args,page*50));
   const counts={all:0,new:0,read:0,planned:0,done:0,closed:0,ignored:0};for(const r of await all(stmt(env,"SELECT CASE WHEN not_handled=1 THEN 'ignored' ELSE status END AS status,COUNT(*) AS n FROM sf_feedback GROUP BY CASE WHEN not_handled=1 THEN 'ignored' ELSE status END"))){counts[r.status]=r.n;counts.all+=r.n;}
   return json({items:rows.slice(0,50),hasMore:rows.length>50,page,counts});
  }
  if(request.method==='POST'&&/^\/admin\/api\/feedback\/[a-zA-Z0-9_-]+$/.test(url.pathname)){
   exactKeys(body,['status','note']);const id=url.pathname.split('/').at(-1);if(!['new','read','planned','done','closed','ignored'].includes(body.status))fail(400,'INVALID_STATUS','狀態不正確。');const note=text(body.note??'',0,2000,'管理筆記',true);
   const r=await env.DB.batch([stmt(env,'UPDATE sf_feedback SET status=?,not_handled=?,admin_note=?,updated_at=? WHERE id=?',body.status==='ignored'?'closed':body.status,body.status==='ignored'?1:0,note,now,id),stmt(env,'INSERT INTO sf_admin_audit(id,actor,action,target_id,created_at) VALUES (?,?,?,?,?)',crypto.randomUUID(),actor,'feedback-status',id,now)]);if(!r[0].meta.changes)fail(404,'NOT_FOUND','找不到這則回報。');return json({updated:true});
  }
  if(request.method==='GET'&&url.pathname==='/admin/api/runs'){
   const page=integer(Number(url.searchParams.get('page')||0),0,10000,'頁數'),q=text(url.searchParams.get('q')||'',0,80,'查詢文字'),id=text(url.searchParams.get('id')||'',0,80,'成績編號'),state=url.searchParams.get('status')||'all',m=url.searchParams.get('mode')||'all',f=url.searchParams.get('financing')||'all',sort=url.searchParams.get('sort')||'latest';
   const sorts={latest:'submitted_at DESC,id DESC',score:'score DESC,submitted_at DESC,id DESC',equity:'equity_cents DESC,id DESC',duration:'play_time_ms DESC,id DESC',trades:'trades DESC,id DESC',gain:'gain_cents DESC,id DESC',loss:'loss_cents ASC NULLS LAST,id DESC'};
   if(!['all','active','revoked'].includes(state)||!['all','life','free'].includes(m)||!['all','cash','margin'].includes(f)||!Object.hasOwn(sorts,sort))fail(400,'INVALID_FILTER','查詢條件不正確。');
   const clauses=[],args=[];if(q){clauses.push("nickname LIKE ? ESCAPE '\\'");args.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%');}if(id){clauses.push('id=?');args.push(id);}if(state!=='all'){clauses.push('hidden=?');args.push(state==='revoked'?1:0);}if(m!=='all'){clauses.push('mode=?');args.push(m);}if(f!=='all'){clauses.push('financing=?');args.push(f==='margin'?1:0);}const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
   const rows=await all(stmt(env,'SELECT id,nickname,mode,outcome,score,equity_cents,benchmark_cents,gain_cents,loss_cents,highlights,drawdown_bps,trades,hidden,moderation_note,submitted_at,financing,margin_summary,play_time_ms,play_time_partial,skill_uses,avatar_id,avatar_character,start_date,early_settlement_date,date_jumps FROM sf_runs'+where+' ORDER BY '+sorts[sort]+' LIMIT 51 OFFSET ?',...args,page*50));
   const count=await stmt(env,'SELECT COUNT(*) AS n FROM sf_runs'+where,...args).first();return json({items:rows.slice(0,50),hasMore:rows.length>50,page,total:count.n});
  }
  if(request.method==='POST'&&/^\/admin\/api\/runs\/[a-zA-Z0-9_-]+\/(hide|restore)$/.test(url.pathname)){
   exactKeys(body,['note']);const id=url.pathname.split('/').at(-2),hidden=url.pathname.endsWith('/hide')?1:0,note=text(body.note,2,500,hidden?'註銷原因':'恢復原因');const row=await stmt(env,'SELECT player_id,edition FROM sf_runs WHERE id=?',id).first();if(!row)fail(404,'NOT_FOUND','找不到這筆成績。');
   const queries=[stmt(env,'UPDATE sf_runs SET hidden=?,moderation_note=? WHERE id=?',hidden,note,id),stmt(env,'DELETE FROM sf_best_scores WHERE player_id=? AND edition=?',row.player_id,row.edition)];
   for(const metric of METRICS){const value=metric==='alpha'?'score':metric==='gain'?'gain_cents':'-loss_cents';queries.push(stmt(env,'INSERT INTO sf_best_scores(player_id,edition,metric,run_id,value,drawdown_bps,trades,submitted_at) SELECT player_id,edition,?,id,'+value+',drawdown_bps,trades,submitted_at FROM sf_runs WHERE player_id=? AND edition=? AND hidden=0 '+(metric==='alpha'?'':metric==='gain'?'AND gain_cents>0':'AND loss_cents<0')+' ORDER BY '+value+' DESC,drawdown_bps,trades,submitted_at,id LIMIT 1',metric,row.player_id,row.edition));}
   queries.push(stmt(env,'INSERT INTO sf_admin_audit(id,actor,action,target_id,created_at) VALUES (?,?,?,?,?)',crypto.randomUUID(),actor,hidden?'revoke-run':'restore-run',id,now));await env.DB.batch(queries);return json({hidden:!!hidden});
  }
fail(404,'NOT_FOUND','找不到這個後台功能。');
}
export async function handle(request,env,ctx={},assets={}){
 const url=new URL(request.url),isAdmin=url.pathname==='/admin'||url.pathname.startsWith('/admin/'),now=nowSeconds();let cors={};
 try{
  if(isAdmin){if(request.method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('x-admin-action')!=='1'))fail(403,'ORIGIN_DENIED','無法確認後台操作來源。');const body=request.method==='POST'?await readJson(request,32768):null;return await admin(request,env,url,body,now,assets);}
  const allowed=originAllowed(request,env);if(allowed)cors={'Access-Control-Allow-Origin':request.headers.get('origin'),'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Access-Control-Expose-Headers':'Retry-After'};
  if(request.headers.has('origin')&&!allowed)fail(403,'ORIGIN_DENIED','這個網站無法使用遊戲 API。');
  if(request.method==='OPTIONS'){if(!allowed)fail(403,'ORIGIN_DENIED','來源不在允許清單。');return new Response(null,{status:204,headers:cors});}
  if(request.method==='GET'&&url.pathname==='/health')return json({ok:true,version:'0.16.17'},200,cors);
  if(request.method==='GET'&&url.pathname==='/v1/config')return json({edition:EDITION,verification:'basic',feedbackEnabled:true},200,cors);
  if(!env.DB)fail(503,'NOT_CONFIGURED','資料庫尚未完成設定。');
  const ip=await ipKey(request,env);
   if(request.method==='GET'&&url.pathname==='/v1/quote-boards'){await rate(env,'read:'+ip,120,60,now);return json(await quoteBoards(request,env),200,cors);}
   if(request.method==='GET'&&url.pathname==='/v1/quotes'){await rate(env,'read:'+ip,120,60,now);return json(await quoteList(request,env,url.searchParams.get('tab')||'popular'),200,cors);}
   if(request.method==='GET'&&url.pathname==='/v1/community'){await rate(env,'read:'+ip,120,60,now);return json({completions:await lifeCounts(env),poll:(await publicPolls(request,env,{activeOnly:true}))[0]||null},200,cors);}
   if(request.method==='GET'&&url.pathname==='/v1/polls'){await rate(env,'read:'+ip,120,60,now);const page=integer(Number(url.searchParams.get('page')||0),0,10000,'頁數'),items=await publicPolls(request,env,{page});return json({items:items.slice(0,50),hasMore:items.length>50,page},200,cors);}
  if(request.method==='GET'&&/^\/v1\/shares\/[a-zA-Z0-9_-]+$/.test(url.pathname)){await rate(env,'read:'+ip,120,60,now);const id=uuid(url.pathname.split('/').at(-1)),r=await stmt(env,'SELECT id,record_json,created_at FROM sf_shared_records WHERE id=?',id).first();if(!r)fail(404,'SHARE_NOT_FOUND','找不到這份分享紀錄，請確認連結是否完整。');return json({id:r.id,record:JSON.parse(r.record_json),createdAt:r.created_at},200,cors);}
   if(request.method==='GET'&&url.pathname==='/v1/announcement'){await rate(env,'read:'+ip,120,60,now);const [announcement,updates]=await Promise.all([readAnnouncement(env),readUpdates(env)]);return json({announcement,updates},200,cors);}
  if(request.method==='GET'&&url.pathname==='/v1/profile'){await rate(env,'read:'+ip,120,60,now);const p=await player(request,env),profile=await stmt(env,'SELECT nickname FROM sf_players WHERE id=?',p).first();return json({nickname:profile?.nickname||null},200,cors);}
  if(request.method==='GET'&&url.pathname==='/v1/boards'){
   await rate(env,'read:'+ip,120,60,now);const p=request.headers.has('authorization')?await player(request,env):null;
   return json({edition:EDITION.id,boards:await boardSnapshot(env,p),verification:'basic',generatedAt:now},200,cors);
  }
   if(request.method==='GET'&&url.pathname==='/v1/leaderboard'){
   await rate(env,'read:'+ip,120,60,now);const m=mode(url.searchParams.get('mode')||'life'),outcome=boardOutcome(url);return json({mode:m,outcome,edition:EDITION.id,items:await ranking(env,m,outcome),verification:'basic'},200,cors);
  }
  if(request.method==='GET'&&url.pathname==='/v1/rank'){await rate(env,'read:'+ip,120,60,now);const p=await player(request,env),m=mode(url.searchParams.get('mode')||'life'),outcome=boardOutcome(url);return json({entry:await ranking(env,m,outcome,p)},200,cors);}
  if(request.method!=='POST')fail(404,'NOT_FOUND','找不到這個 API。');if(!allowed)fail(403,'ORIGIN_DENIED','來源不在允許清單。');
  const body=await readJson(request);
  let response;
  if(url.pathname==='/v1/players'){
   exactKeys(body,[]);await rate(env,'players:'+ip,100,86400,now);const token=randomToken(),id=crypto.randomUUID();await stmt(env,'INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)',id,await hash(token),now).run();response={playerId:id,playerToken:token};
  }else if(url.pathname==='/v1/sessions'){
   exactKeys(body,['runId','mode','editionId','startDay','startDate']);const startDate=body.startDate??EDITION.start,startMeta=START_BENCHMARKS[startDate];if(!supportedEditions.includes(body.editionId))fail(400,'EDITION_MISMATCH','請重新整理以載入目前的排行版本。');if(!startMeta||body.startDay!==startMeta.index-1)fail(400,'RUN_ALREADY_STARTED','已開始的舊輪次不能補建線上 Session。');const p=await player(request,env),m=mode(body.mode),run=uuid(body.runId),requestedEdition=editionFor(m,'cash',body.editionId);await rate(env,'session-player:'+p,20,3600,now);await rate(env,'session-ip:'+ip,200,86400,now);
   const token=await hmac(env.RATE_LIMIT_SECRET,'session:'+p+':'+run+':'+requestedEdition),id=crypto.randomUUID(),expiresAt=now+EDITION.sessionTtlSeconds;await stmt(env,'INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at,start_date) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(player_id,run_id,edition) DO NOTHING',id,p,run,await hash(token),m,requestedEdition,now,expiresAt,startDate).run();
   const saved=await stmt(env,'SELECT id,created_at,expires_at,start_date FROM sf_sessions WHERE player_id=? AND run_id=? AND edition=?',p,run,requestedEdition).first();if((saved.start_date||EDITION.start)!==startDate)fail(409,'SESSION_START_MISMATCH','這輪已使用另一個起始日期建立 Session。');response={sessionId:saved.id,sessionToken:token,createdAt:saved.created_at,expiresAt:saved.expires_at,mode:m,editionId:body.editionId};
  }else if(url.pathname==='/v1/quotes'){response=await createQuote(request,env,body,now,ip);
  }else if(/^\/v1\/quotes\/[a-zA-Z0-9_-]+\/like$/.test(url.pathname)){response=await likeQuote(request,env,url.pathname.split('/').at(-2),body,now,ip);
  }else if(/^\/v1\/polls\/[a-zA-Z0-9_-]+\/vote$/.test(url.pathname)){response=await vote(request,env,url.pathname.split('/').at(-2),body,now,ip);
   }else if(url.pathname==='/v1/completions'){
    const who=await player(request,env);uuid(body.sessionId);if(typeof body.sessionToken!=='string'||!/^[a-f0-9]{64}$/.test(body.sessionToken))fail(401,'SESSION_INVALID','沒有有效的遊戲 Session。');const session=await stmt(env,'SELECT * FROM sf_sessions WHERE id=? AND player_id=? AND token_hash=?',body.sessionId,who,await hash(body.sessionToken)).first();if(!session||session.mode!=='life'||body.mode!=='life')fail(400,'INVALID_COMPLETION','只累計完整人生模式。');const prior=await stmt(env,'SELECT session_id FROM sf_life_completions WHERE session_id=?',session.id).first();if(prior)return json({counted:true,completions:await lifeCounts(env)},200,cors);if(session.expires_at<=now)fail(410,'SESSION_EXPIRED','遊戲 Session 已到期。');await rate(env,'completion:'+who,20,3600,now);const r=validateScore(body,session,now);await stmt(env,'INSERT OR IGNORE INTO sf_life_completions(session_id,player_id,outcome,created_at) VALUES (?,?,?,?)',session.id,who,r.outcome,now).run();response={counted:true,completions:await lifeCounts(env)};
   }else if(url.pathname==='/v1/shares'){
    exactKeys(body,['requestId','record']);const p=await player(request,env),requestId=uuid(body.requestId),record=validateSharedRecord(body.record);const prior=await stmt(env,'SELECT id,created_at FROM sf_shared_records WHERE player_id=? AND request_id=?',p,requestId).first();if(prior)return json({id:prior.id,createdAt:prior.created_at},200,cors);
    await rate(env,'share-player:'+p,20,3600,now);await rate(env,'share-ip:'+ip,100,3600,now);const id=crypto.randomUUID();await stmt(env,'INSERT INTO sf_shared_records(id,player_id,request_id,record_json,created_at) VALUES (?,?,?,?,?) ON CONFLICT(player_id,request_id) DO NOTHING',id,p,requestId,JSON.stringify(record),now).run();const saved=await stmt(env,'SELECT id,created_at FROM sf_shared_records WHERE player_id=? AND request_id=?',p,requestId).first();response={id:saved.id,createdAt:saved.created_at};
   }else if(url.pathname==='/v1/scores')response=await submit(request,env,body,now,ip);
  else if(url.pathname==='/v1/feedback')response=await feedback(request,env,body,now,ip);
  else fail(404,'NOT_FOUND','找不到這個 API。');
  // Bounded cleanup avoids accumulating expired rate buckets without cron jobs.
  if(ctx.waitUntil&&Math.random()<.05)ctx.waitUntil(stmt(env,'DELETE FROM sf_rate_limits WHERE bucket IN (SELECT bucket FROM sf_rate_limits WHERE expires_at<? LIMIT 100)',now).run().catch(()=>{}));
  return json(response,200,cors);
 }catch(e){if(e instanceof ApiError)return json({error:{code:e.code,message:e.message,...e.extra}},e.status,{...cors,...(e.extra.retryAfter?{'Retry-After':String(e.extra.retryAfter)}:{})});return json({error:{code:'SERVICE_ERROR',message:'服務暫時無法使用，請稍後再試。'}},500,cors);}
}
