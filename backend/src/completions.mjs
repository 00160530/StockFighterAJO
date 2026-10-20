import {EDITION} from './edition.mjs';
import {START_BENCHMARKS} from './start-benchmarks.mjs';
import {exactKeys,fail,integer} from './security.mjs';

// Completion statistics are independent of leaderboard eligibility. Bankruptcy
// is a completed loss, including cash insolvency with positive net assets.
export function validateCompletion(body,session,now,validateScore){
 if(body.outcome!=='bankrupt'){const {cashCents,...score}=body;integer(cashCents,0,EDITION.maxEquityCents,'現金');return validateScore(score,session,now);}
 exactKeys(body,['sessionId','sessionToken','editionId','mode','outcome','date','startDate','customStartDate','earlySettlementDate','dateJumps','sessions','equityCents','benchmarkCents','cashCents']);
 const editions=[EDITION.id,...(EDITION.compatibleEditionIds||[])],start=body.startDate??EDITION.start,begin=START_BENCHMARKS[start],end=START_BENCHMARKS[body.date];
 if(!editions.includes(body.editionId)||!['life','free'].includes(body.mode)||session.mode!==body.mode||!editions.some(id=>session.edition===id+':'+EDITION.rulesets[body.mode])||!(session.edition.startsWith(body.editionId+':')||body.editionId===EDITION.id))fail(400,'EDITION_MISMATCH','這輪的模式或行情版本不相容。');
 if(!begin||!end||start!==(session.start_date||EDITION.start)||(body.customStartDate!=null&&body.customStartDate!==start)||(start!==EDITION.start&&body.customStartDate!==start)||end.index<begin.index||body.sessions!==end.index-begin.index+1)fail(400,'INVALID_COMPLETION','遊戲日期或交易日數不正確。');
 const early=body.earlySettlementDate??null;if(early!==null&&(!START_BENCHMARKS[early]||early<start||early>body.date))fail(400,'INVALID_COMPLETION','提前結算日期不正確。');
 const jumps=body.dateJumps??[];if(!Array.isArray(jumps)||jumps.length>5)fail(400,'INVALID_COMPLETION','日期跳躍紀錄不正確。');
 for(let i=0;i<jumps.length;i++){const j=jumps[i];if(!j||typeof j!=='object'||Array.isArray(j))fail(400,'INVALID_COMPLETION','日期跳躍紀錄不正確。');exactKeys(j,['from','to']);if(!START_BENCHMARKS[j.from]||!START_BENCHMARKS[j.to]||j.from<start||j.to<=j.from||j.to>body.date||i&&j.from<jumps[i-1].to)fail(400,'INVALID_COMPLETION','日期跳躍範圍不正確。');}
 const equity=integer(body.equityCents,-EDITION.maxEquityCents,EDITION.maxEquityCents,'總資產'),cash=integer(body.cashCents,-EDITION.maxEquityCents,EDITION.maxEquityCents,'現金'),benchmark=integer(body.benchmarkCents,1,Number.MAX_SAFE_INTEGER,'0050 基準');
 if(equity>0&&cash>=0)fail(400,'INVALID_COMPLETION','破產結局與資產不一致。');
 return {outcome:'lost'};
}
