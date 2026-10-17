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
const editionFor=(m,f='cash')=>EDITION.id+':'+EDITION.rulesets[mode(m)]+(finance(f)==='margin'?':margin-v1':'');
const scoreValue=(r,metric)=>metric==='alpha'?r.score:metric==='gain'?r.gain_cents:-(r.loss_cents??0);
function bestInsert(env,runId,metric){const value=metric==='alpha'?'score':metric==='gain'?'gain_cents':'-loss_cents';return stmt(env,`INSERT INTO sf_best_scores(player_id,edition,metric,run_id,value,drawdown_bps,trades,submitted_at)
 SELECT player_id,edition,?,id,${value},drawdown_bps,trades,submitted_at FROM sf_runs WHERE id=? AND hidden=0 ${metric==='alpha'?'':metric==='gain'?'AND gain_cents>0':'AND loss_cents<0'}
 ON CONFLICT(player_id,edition,metric) DO UPDATE SET run_id=excluded.run_id,value=excluded.value,drawdown_bps=excluded.drawdown_bps,trades=excluded.trades,submitted_at=excluded.submitted_at
 WHERE excluded.value>sf_best_scores.value OR (excluded.value=sf_best_scores.value AND (excluded.drawdown_bps<sf_best_scores.drawdown_bps OR (excluded.drawdown_bps=sf_best_scores.drawdown_bps AND excluded.trades<sf_best_scores.trades)))`,metric,runId);}
const order='b.value DESC,b.drawdown_bps ASC,b.trades ASC,b.submitted_at ASC,b.run_id ASC';
function publicRow(row){return {avatarId:row.avatar_id||1,financing:row.financing===1?'margin':'cash',margin:JSON.parse(row.margin_summary||'{}'),rank:row.rank,runId:row.id,nickname:row.nickname,outcome:row.outcome,mode:row.mode,score:row.score,equityCents:row.equity_cents,benchmarkCents:row.benchmark_cents,drawdownBps:row.drawdown_bps,trades:row.trades,gainCents:row.gain_cents,lossCents:row.loss_cents,highlights:JSON.parse(row.highlights),submittedAt:row.submitted_at};}
async function ranking(env,m,metric,playerId=null,financing='cash'){
 const edition=editionFor(m,financing);if(!METRICS.includes(metric))fail(400,'INVALID_METRIC','排行榜類型不正確。');
 if(playerId){const row=await stmt(env,`SELECT b.*,r.id,r.nickname,r.outcome,r.mode,r.score,r.equity_cents,r.benchmark_cents,r.gain_cents,r.loss_cents,r.highlights,r.financing,r.margin_summary,r.avatar_id FROM sf_best_scores b JOIN sf_runs r ON r.id=b.run_id WHERE b.player_id=? AND b.edition=? AND b.metric=? AND r.hidden=0`,playerId,edition,metric).first();if(!row)return null;
  const count=await stmt(env,`SELECT COUNT(*) AS n FROM sf_best_scores b JOIN sf_runs r ON r.id=b.run_id WHERE b.edition=? AND b.metric=? AND r.hidden=0 AND (b.value>? OR (b.value=? AND (b.drawdown_bps<? OR (b.drawdown_bps=? AND (b.trades<? OR (b.trades=? AND (b.submitted_at<? OR (b.submitted_at=? AND b.run_id<?))))))))`,edition,metric,row.value,row.value,row.drawdown_bps,row.drawdown_bps,row.trades,row.trades,row.submitted_at,row.submitted_at,row.run_id).first();return publicRow({...row,rank:count.n+1});
 }
 const rows=await all(stmt(env,`SELECT r.*,b.value FROM sf_best_scores b JOIN sf_runs r ON r.id=b.run_id WHERE b.edition=? AND b.metric=? AND r.hidden=0 ORDER BY ${order} LIMIT 100`,edition,metric));return rows.map((r,i)=>publicRow({...r,rank:i+1}));
}
function highlight(raw,sign){if(raw===null)return null;if(!raw||typeof raw!=='object'||Array.isArray(raw))fail(400,'INVALID_HIGHLIGHT','交易高光不正確。');exactKeys(raw,['symbol','date','qty','priceCents','pnlCents']);if(!EDITION.symbols.some(s=>s.id===raw.symbol)||typeof raw.date!=='string'||raw.date<EDITION.start||raw.date>EDITION.datasetEnd||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date))fail(400,'INVALID_HIGHLIGHT','高光的標的或日期不正確。');integer(raw.qty,1,100000000*4,'高光股數');integer(raw.priceCents,1,100000000,'高光價格');integer(raw.pnlCents,-EDITION.maxEquityCents,EDITION.maxEquityCents,'高光損益');if(raw.pnlCents*sign<=0)fail(400,'INVALID_HIGHLIGHT','高光損益方向不正確。');return raw;}
function marginSummary(raw){
 if(raw===undefined)return null;if(!raw||typeof raw!=='object'||Array.isArray(raw))fail(400,'INVALID_MARGIN','融資紀錄不正確。');
 exactKeys(raw,['totalBorrowedCents','totalInterestCents','interestPaidCents','totalTopupsCents','liquidations','principalCents','interestCents','collateralCents']);
 for(const k of ['totalBorrowedCents','totalInterestCents','interestPaidCents','totalTopupsCents','principalCents','interestCents','collateralCents'])integer(raw[k],0,EDITION.maxEquityCents,'融資金額');integer(raw.liquidations,0,EDITION.sessions*4,'斷頭次數');
 if(raw.totalBorrowedCents<=0||raw.principalCents>raw.totalBorrowedCents||raw.interestPaidCents>raw.totalInterestCents||raw.collateralCents>raw.totalTopupsCents||raw.interestCents!==raw.totalInterestCents-raw.interestPaidCents||(!raw.principalCents&&(raw.interestCents||raw.collateralCents)))fail(400,'INVALID_MARGIN','融資借款與利息紀錄不一致。');return raw;
}
function privateStats(body,session,now){
 const playTimeMs=body.playTimeMs??null;if(playTimeMs!==null)integer(playTimeMs,0,Math.max(0,now-session.created_at+60)*1000,'遊玩時長');if(body.playTimePartial!==undefined&&typeof body.playTimePartial!=='boolean')fail(400,'INVALID_STATS','遊玩時長紀錄不正確。');
 const skillUses=body.skillUses??null;if(skillUses!==null){if(typeof skillUses!=='object'||Array.isArray(skillUses))fail(400,'INVALID_STATS','技能次數不正確。');exactKeys(skillUses,['mother','vip','divination']);integer(skillUses.mother,0,1000000,'媽媽10塊次數');integer(skillUses.vip,0,EDITION.sessions*3,'VIP次數');integer(skillUses.divination,0,3,'奇門遁甲次數');}return {playTimeMs,playTimePartial:body.playTimePartial===true?1:0,skillUses};
}
export function validateScore(body,session,now){
 exactKeys(body,['sessionId','sessionToken','nickname','editionId','mode','outcome','date','sessions','score','equityCents','benchmarkCents','drawdownBps','trades','buyTrades','sellTrades','maxGain','maxLoss','margin','playTimeMs','playTimePartial','skillUses','avatarId']);
 if(body.editionId!==EDITION.id||session.edition!==editionFor(body.mode)||session.mode!==body.mode)fail(400,'EDITION_MISMATCH','這輪的模式或行情版本不相容。');
 if(body.date!==EDITION.datasetEnd||body.sessions!==EDITION.sessions)fail(400,'INCOMPLETE_RUN','只有走到行情終點的完整輪次可以提交。');
 const equity=integer(body.equityCents,1,EDITION.maxEquityCents,'總資產'),benchmark=integer(body.benchmarkCents,1,Number.MAX_SAFE_INTEGER,'0050 基準');if(benchmark!==EDITION.benchmarkCents)fail(400,'BENCHMARK_MISMATCH','0050 基準不符合這個資料版本。');
 const score=integer(body.score,Math.round((1-benchmark)/10000),Math.round((EDITION.maxEquityCents-benchmark)/10000),'分數');if(score!==Math.round((equity-benchmark)/10000))fail(400,'SCORE_MISMATCH','分數與總資產不一致。');
 const outcome=equity>benchmark?'won':'lost';if(body.outcome!==outcome)fail(400,'OUTCOME_MISMATCH','結局與資產不一致。');
 integer(body.drawdownBps,0,10000,'最大回撤');const trades=integer(body.trades,0,EDITION.maxTrades*(body.margin?2:1),'交易次數');integer(body.buyTrades,0,trades,'買進次數');integer(body.sellTrades,0,trades,'賣出次數');if(body.buyTrades+body.sellTrades!==trades)fail(400,'TRADE_MISMATCH','交易次數不一致。');
 const margin=marginSummary(body.margin);if(margin&&(!body.buyTrades||(margin.interestPaidCents||margin.liquidations)&&!body.sellTrades))fail(400,'INVALID_MARGIN','融資紀錄與成交次數不一致。');
 const maxGain=highlight(body.maxGain,1),maxLoss=highlight(body.maxLoss,-1);if((maxGain||maxLoss)&&!body.sellTrades)fail(400,'TRADE_MISMATCH','沒有賣出就不會有已實現交易高光。');
 if(!trades&&equity>EDITION.initialCents)fail(400,'TRADE_MISMATCH','沒有成交的資產不能增加。');
 if(now-session.created_at<EDITION.minDurationSeconds[body.mode])fail(400,'TOO_FAST','這輪遊玩時長過短，請稍後再提交。',{retryAfter:EDITION.minDurationSeconds[body.mode]-(now-session.created_at)});
 return {avatarId:integer(body.avatarId??1,1,10,'心情頭像'),...privateStats(body,session,now),nickname:nickname(body.nickname),outcome,score,equityCents:equity,benchmarkCents:benchmark,drawdownBps:body.drawdownBps,trades,gainCents:maxGain?.pnlCents??null,lossCents:maxLoss?.pnlCents??null,highlights:{maxGain,maxLoss},financing:margin?1:0,marginSummary:margin||{}};
}
async function submit(request,env,body,now,ip){
 const playerId=await player(request,env);await rate(env,'score-ip:'+ip,30,3600,now);await rate(env,'score-player:'+playerId,12,3600,now);
 uuid(body.sessionId);if(typeof body.sessionToken!=='string'||!/^[a-f0-9]{64}$/.test(body.sessionToken))fail(401,'SESSION_INVALID','這輪沒有有效的線上 Session。');
 const tokenHash=await hash(body.sessionToken),session=await stmt(env,'SELECT * FROM sf_sessions WHERE id=? AND player_id=? AND token_hash=?',body.sessionId,playerId,tokenHash).first();if(!session)fail(401,'SESSION_INVALID','這輪沒有有效的線上 Session。');
 if(session.used_at!==null){const prior=await stmt(env,'SELECT financing FROM sf_runs WHERE session_id=?',session.id).first();fail(409,'SESSION_USED','這輪已提交過成績。',{receipt:{rank:await ranking(env,session.mode,'alpha',playerId,prior?.financing?'margin':'cash'),submitted:true}});}
 if(session.expires_at<=now)fail(410,'SESSION_EXPIRED','這輪的線上 Session 已到期，本機紀錄仍會保留。');
 const r=validateScore(body,session,now),id=crypto.randomUUID();
 const results=await env.DB.batch([
  stmt(env,'UPDATE sf_sessions SET used_at=?,submission_id=? WHERE id=? AND player_id=? AND token_hash=? AND used_at IS NULL AND expires_at>?',now,id,session.id,playerId,tokenHash,now),
  stmt(env,`INSERT INTO sf_runs(id,session_id,player_id,edition,mode,nickname,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,gain_cents,loss_cents,highlights,submitted_at,financing,margin_summary,play_time_ms,play_time_partial,skill_uses,avatar_id)
   SELECT ?,id,player_id,edition || ?,mode,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? FROM sf_sessions WHERE id=? AND submission_id=?`,id,r.financing?':margin-v1':'',r.nickname,r.outcome,r.score,r.equityCents,r.benchmarkCents,r.drawdownBps,r.trades,r.gainCents,r.lossCents,JSON.stringify(r.highlights),now,r.financing,JSON.stringify(r.marginSummary),r.playTimeMs,r.playTimePartial,r.skillUses===null?null:JSON.stringify(r.skillUses),r.avatarId,session.id,id),
  ...METRICS.map(metric=>bestInsert(env,id,metric))
 ]);
 if(!results[1].meta.changes)fail(409,'SESSION_USED','這輪已提交過成績。');
 return {submitted:true,runId:id,rank:await ranking(env,session.mode,'alpha',playerId,r.financing?'margin':'cash'),verification:'basic'};
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
 const actor=await adminIdentity(request,env,now);
 if(request.method==='GET'&&url.pathname==='/admin/api/me')return json({username:actor});
 if(request.method==='POST'&&url.pathname==='/admin/api/logout')return json({loggedOut:true},200,{'Set-Cookie':await adminLogout(request,env)});
 if(request.method==='GET'&&url.pathname==='/admin/api/announcement'){const row=await stmt(env,'SELECT title,body,published_at FROM sf_announcement WHERE id=1').first();return json({announcement:row?{title:row.title,body:row.body,publishedAt:row.published_at}:null});}
  if(request.method==='POST'&&url.pathname==='/admin/api/announcement'){exactKeys(body,['title','body']);const title=text(body.title,1,60,'公告標題'),content=text(body.body,1,2000,'公告內容',true),at=Date.now();const row=await stmt(env,'INSERT INTO sf_announcement(id,title,body,published_at,updated_by) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,published_at=MAX(sf_announcement.published_at+1,excluded.published_at),updated_by=excluded.updated_by RETURNING title,body,published_at',title,content,at,actor).first();return json({published:true,announcement:{title:row.title,body:row.body,publishedAt:row.published_at}});}
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
   const sorts={latest:'submitted_at DESC,id DESC',score:'score DESC,submitted_at DESC,id DESC',equity:'equity_cents DESC,id DESC',duration:'play_time_ms DESC,id DESC',trades:'trades DESC,id DESC'};
   if(!['all','active','revoked'].includes(state)||!['all','life','free'].includes(m)||!['all','cash','margin'].includes(f)||!Object.hasOwn(sorts,sort))fail(400,'INVALID_FILTER','查詢條件不正確。');
   const clauses=[],args=[];if(q){clauses.push("nickname LIKE ? ESCAPE '\\'");args.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%');}if(id){clauses.push('id=?');args.push(id);}if(state!=='all'){clauses.push('hidden=?');args.push(state==='revoked'?1:0);}if(m!=='all'){clauses.push('mode=?');args.push(m);}if(f!=='all'){clauses.push('financing=?');args.push(f==='margin'?1:0);}const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
   const rows=await all(stmt(env,'SELECT id,nickname,mode,outcome,score,equity_cents,drawdown_bps,trades,hidden,moderation_note,submitted_at,financing,margin_summary,play_time_ms,play_time_partial,skill_uses,avatar_id FROM sf_runs'+where+' ORDER BY '+sorts[sort]+' LIMIT 51 OFFSET ?',...args,page*50));
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
  if(isAdmin){if(request.method!=='GET'&&(request.headers.get('origin')!==url.origin||request.headers.get('x-admin-action')!=='1'))fail(403,'ORIGIN_DENIED','無法確認後台操作來源。');const body=request.method==='POST'?await readJson(request):null;return await admin(request,env,url,body,now,assets);}
  const allowed=originAllowed(request,env);if(allowed)cors={'Access-Control-Allow-Origin':request.headers.get('origin'),'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Access-Control-Expose-Headers':'Retry-After'};
  if(request.headers.has('origin')&&!allowed)fail(403,'ORIGIN_DENIED','這個網站無法使用遊戲 API。');
  if(request.method==='OPTIONS'){if(!allowed)fail(403,'ORIGIN_DENIED','來源不在允許清單。');return new Response(null,{status:204,headers:cors});}
  if(request.method==='GET'&&url.pathname==='/health')return json({ok:true,version:'0.12.0'},200,cors);
  if(request.method==='GET'&&url.pathname==='/v1/config')return json({edition:EDITION,verification:'basic',feedbackEnabled:true},200,cors);
  if(!env.DB)fail(503,'NOT_CONFIGURED','資料庫尚未完成設定。');
  const ip=await ipKey(request,env);
  if(request.method==='GET'&&/^\/v1\/shares\/[a-zA-Z0-9_-]+$/.test(url.pathname)){await rate(env,'read:'+ip,120,60,now);const id=uuid(url.pathname.split('/').at(-1)),r=await stmt(env,'SELECT id,record_json,created_at FROM sf_shared_records WHERE id=?',id).first();if(!r)fail(404,'SHARE_NOT_FOUND','找不到這份分享紀錄，請確認連結是否完整。');return json({id:r.id,record:JSON.parse(r.record_json),createdAt:r.created_at},200,cors);}
   if(request.method==='GET'&&url.pathname==='/v1/announcement'){await rate(env,'read:'+ip,120,60,now);const row=await stmt(env,'SELECT title,body,published_at FROM sf_announcement WHERE id=1').first();return json({announcement:row?{title:row.title,body:row.body,publishedAt:row.published_at}:null},200,cors);}
   if(request.method==='GET'&&url.pathname==='/v1/leaderboard'){
   await rate(env,'read:'+ip,120,60,now);const m=mode(url.searchParams.get('mode')||'life'),metric=url.searchParams.get('metric')||'alpha',f=finance(url.searchParams.get('financing'));return json({mode:m,metric,financing:f,edition:EDITION.id,items:await ranking(env,m,metric,null,f),verification:'basic'},200,cors);
  }
  if(request.method==='GET'&&url.pathname==='/v1/rank'){await rate(env,'read:'+ip,120,60,now);const p=await player(request,env),m=mode(url.searchParams.get('mode')||'life'),metric=url.searchParams.get('metric')||'alpha';return json({entry:await ranking(env,m,metric,p,finance(url.searchParams.get('financing')))},200,cors);}
  if(request.method!=='POST')fail(404,'NOT_FOUND','找不到這個 API。');if(!allowed)fail(403,'ORIGIN_DENIED','來源不在允許清單。');
  const body=await readJson(request);
  let response;
  if(url.pathname==='/v1/players'){
   exactKeys(body,[]);await rate(env,'players:'+ip,100,86400,now);const token=randomToken(),id=crypto.randomUUID();await stmt(env,'INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)',id,await hash(token),now).run();response={playerId:id,playerToken:token};
  }else if(url.pathname==='/v1/sessions'){
   exactKeys(body,['runId','mode','editionId','startDay']);if(body.editionId!==EDITION.id)fail(400,'EDITION_MISMATCH','請重新整理以載入目前的排行版本。');if(body.startDay!==-1)fail(400,'RUN_ALREADY_STARTED','已開始的舊輪次不能補建線上 Session。');const p=await player(request,env),m=mode(body.mode),run=uuid(body.runId);await rate(env,'session-player:'+p,20,3600,now);await rate(env,'session-ip:'+ip,200,86400,now);
   const token=await hmac(env.RATE_LIMIT_SECRET,'session:'+p+':'+run+':'+editionFor(m)),id=crypto.randomUUID(),expiresAt=now+EDITION.sessionTtlSeconds;await stmt(env,'INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(player_id,run_id,edition) DO NOTHING',id,p,run,await hash(token),m,editionFor(m),now,expiresAt).run();
   const saved=await stmt(env,'SELECT id,created_at,expires_at FROM sf_sessions WHERE player_id=? AND run_id=? AND edition=?',p,run,editionFor(m)).first();response={sessionId:saved.id,sessionToken:token,createdAt:saved.created_at,expiresAt:saved.expires_at,mode:m,editionId:EDITION.id};
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
