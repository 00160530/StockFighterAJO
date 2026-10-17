import {exactKeys,fail,integer} from './security.mjs';
import {EDITION} from './edition.mjs';
const amounts=['equity','benchmark','cash','returnPct','alpha','maxDrawdown','fees','tax','spent','realizedPnl'];
const counts=['sessions','trades','choices','buyTrades','sellTrades'];
const marginFields=['totalBorrowed','totalInterest','interestPaid','totalTopups','liquidations','principal','interest','collateral'];
function number(v,name,max=1e14){if(!Number.isFinite(v)||Math.abs(v)>max)fail(400,'INVALID_SHARE',name+'格式不正確。');return v;}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<EDITION.start||v>EDITION.datasetEnd||!Number.isFinite(new Date(v+'T00:00:00Z').getTime())||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail(400,'INVALID_SHARE','紀錄日期不正確。');return v;}
function object(v){if(!v||typeof v!=='object'||Array.isArray(v))fail(400,'INVALID_SHARE','分享資料格式不正確。');return v;}
function highlight(v){if(v===null)return null;object(v);exactKeys(v,['id','date','qty','price','costBasis','proceeds','pnl','returnPct']);if(!EDITION.symbols.some(s=>s.id===v.id))fail(400,'INVALID_SHARE','交易標的不正確。');const result={id:v.id,date:date(v.date),qty:integer(v.qty,1,1000000000,'股數')};for(const k of ['price','costBasis','proceeds','pnl','returnPct'])result[k]=number(v[k],k);return result;}
// An immutable display snapshot. Sharing never creates or modifies a leaderboard score.
export function validateSharedRecord(raw){object(raw);exactKeys(raw,['schema','mode','status','date','financing',...amounts,...counts,'playTimeMs','playTimePartial','skillUses','margin','maxGain','maxLoss','statsVersion','statsComplete']);
 if(raw.schema!==1||!['life','free'].includes(raw.mode)||!['won','lost','bankrupt'].includes(raw.status)||!['cash','margin'].includes(raw.financing)||typeof raw.playTimePartial!=='boolean'||typeof raw.statsComplete!=='boolean'||raw.statsVersion!==1)fail(400,'INVALID_SHARE','請分享已結算的遊玩紀錄。');
 const r={schema:1,mode:raw.mode,status:raw.status,date:date(raw.date),financing:raw.financing,statsVersion:1,statsComplete:raw.statsComplete};
 for(const k of amounts)r[k]=k==='realizedPnl'&&raw[k]===null?null:number(raw[k],k);
 for(const k of counts)r[k]=integer(raw[k],0,k==='sessions'?EDITION.sessions:k==='choices'?10000:EDITION.maxTrades,k);
 r.playTimeMs=raw.playTimeMs===null?null:integer(raw.playTimeMs,0,10*365*86400000,'遊玩時長');r.playTimePartial=raw.playTimePartial;
 if(raw.skillUses===null)r.skillUses=null;else{object(raw.skillUses);exactKeys(raw.skillUses,['mother','vip','divination']);r.skillUses={};for(const k of ['mother','vip','divination'])r.skillUses[k]=integer(raw.skillUses[k],0,k==='divination'?3:100000,'技能次數');}
 object(raw.margin);exactKeys(raw.margin,marginFields);r.margin={};for(const k of marginFields){r.margin[k]=number(raw.margin[k],k);if(r.margin[k]<0)fail(400,'INVALID_SHARE','融資紀錄不正確。');}
 r.maxGain=highlight(raw.maxGain);r.maxLoss=highlight(raw.maxLoss);return r;
}
