(function(root){
'use strict';
const TERMINAL=['won','lost','bankrupt'];
const money=n=>Math.round(n*100)/100;
function tradeStats(data,log){
 const holdings={},sales=[];let buys=0,sells=0,fees=0,tax=0,complete=true,splitIndex=0,lastDate='';
 const splits=Object.entries(data.instruments).flatMap(([id,inst])=>(inst.splits||[]).map(sp=>({...sp,id}))).sort((a,b)=>a.date.localeCompare(b.date));
 for(const l of log){
  if(l.type==='position-adjust'){
   if(!data.instruments[l.id]?.tradable||!['cashQty','marginQty'].every(k=>Number.isSafeInteger(l[k])&&l[k]>=0)||!['cashCost','marginCost'].every(k=>Number.isFinite(l[k])&&l[k]>=0)){complete=false;continue;}
   for(const [key,qty,cost]of [[l.id,l.cashQty,l.cashCost],[l.id+':margin',l.marginQty,l.marginCost]]){if(qty)holdings[key]={qty,cost};else delete holdings[key];}continue;
  }
  if(l.type!=='fill')continue;
  if(!data.instruments[l.id]?.tradable||!['buy','sell'].includes(l.side)||!Number.isSafeInteger(l.qty)||l.qty<1||!['price','value','fee','tax'].every(k=>Number.isFinite(l[k])&&l[k]>=0)||l.price<=0||!/^\d{4}-\d{2}-\d{2}$/.test(l.date)||l.date<lastDate){complete=false;continue;}
  lastDate=l.date;while(splitIndex<splits.length&&splits[splitIndex].date<=l.date){const sp=splits[splitIndex++];for(const key of [sp.id,sp.id+':margin'])if(holdings[key])holdings[key].qty*=sp.ratio;}
  fees+=l.fee;tax+=l.tax;const key=l.id+(l.financing==='margin'?':margin':''),h=holdings[key]||{qty:0,cost:0};
  if(l.side==='buy'){buys++;h.qty+=l.qty;h.cost=money(h.cost+l.value+l.fee);holdings[key]=h;}
  else{sells++;if(l.qty>h.qty){complete=false;continue;}
   const remainingCost=money(h.cost*(h.qty-l.qty)/h.qty),costBasis=money(h.cost-remainingCost+(l.financing==='margin'?(l.interestPaid||0):0)),proceeds=money(l.value-l.fee-l.tax),pnl=money(proceeds-costBasis);
   sales.push({id:l.id,date:l.date,qty:l.qty,price:l.price,costBasis,proceeds,pnl,returnPct:costBasis?pnl/costBasis*100:0,...(l.financing==='margin'?{financing:'margin',interestPaid:l.interestPaid||0}:{})});h.qty-=l.qty;h.cost=remainingCost;if(!h.qty)delete holdings[key];
  }
 }
 const maxGain=sales.filter(s=>s.pnl>0).reduce((best,s)=>!best||s.pnl>best.pnl?s:best,null),maxLoss=sales.filter(s=>s.pnl<0).reduce((worst,s)=>!worst||s.pnl<worst.pnl?s:worst,null);
 return {statsVersion:1,statsComplete:complete,trades:buys+sells,buyTrades:buys,sellTrades:sells,fees:money(fees),tax:money(tax),wins:sales.filter(s=>s.pnl>0).length,losses:sales.filter(s=>s.pnl<0).length,realizedPnl:complete?money(sales.reduce((n,s)=>n+s.pnl,0)):null,maxGain:complete?maxGain:null,maxLoss:complete?maxLoss:null};
}
function snapshot(market,s,reason='current',now=new Date().toISOString()){
 const mode=s.life?.eligibleForUnlock===false?'free':s.mode||'free',date=market.date(s),equity=market.equity(s,date),benchmark=market.equity(s.benchmark,date),log=s.log||[];
 let peak=1000000,drawdown=0;for(const h of s.history){peak=Math.max(peak,h.player);drawdown=Math.max(drawdown,(peak-h.player)/peak*100);}
 const margin=market.marginInfo(s),financing=margin.totalBorrowed>0?'margin':'cash';
 const skillUses={mother:log.filter(l=>l.type==='skill-loan').length,vip:log.filter(l=>l.type==='skill-vip').length,divination:log.filter(l=>l.type==='skill-divination').length,...(s.skills?.calendarUsed?{calendar:s.skills.calendarUsed}:{})};
 return {id:s.runId,rewardRootId:s.rewardRootId||s.runId,playTimeMs:Number.isSafeInteger(s.playTimeMs)&&s.playTimeMs>=0?s.playTimeMs:null,playTimePartial:s.playTimePartial===true,skillUses,at:now,date:s.day<0?'2020-01-01':date,status:s.status,reason,mode,ruleset:(mode==='life'?'tw-life-v1':'tw-v1')+(financing==='margin'?':margin-v1':''),startDate:s.startDate||market.data.start,customStartDate:s.customStartDate||null,earlySettlementDate:s.earlySettlementDate||null,...(s.dateJumps?.length?{dateJumps:s.dateJumps.map(j=>({...j}))}:{}),datasetEnd:market.data.end,sessions:market.sessions(s),equity,benchmark,cash:s.cash,returnPct:(equity/1e6-1)*100,alpha:(equity-benchmark)/1e6*100,maxDrawdown:drawdown,...tradeStats(market.data,log),spent:s.spent,choices:log.filter(l=>l.type==='story').length,financing,margin:{totalBorrowed:margin.totalBorrowed,totalInterest:margin.totalInterest,interestPaid:margin.interestPaid,totalTopups:margin.totalTopups,liquidations:margin.liquidations,principal:margin.principal,interest:margin.interest,collateral:margin.collateral},bankruptcyReason:s.bankruptcyReason||null};
}
function inventory(market,s){
 const date=market.date(s),rows=Object.entries(s.holdings).map(([id,h])=>{
  const inst=market.data.instruments[id],priceBar=market.latest(id,date),price=priceBar?.[4]||0,value=money(price*h.qty),pnl=money(value-h.cost);
  const trades=s.log.filter(l=>l.type==='fill'&&l.id===id&&l.date<=date),splits=(inst.splits||[]).filter(sp=>sp.date<=date).slice().sort((a,b)=>a.date.localeCompare(b.date));let qty=0,firstBuy=null,lastBuy=null,si=0;
  for(const t of s.log.filter(l=>l.id===id&&l.date<=date&&['fill','position-adjust'].includes(l.type))){while(si<splits.length&&splits[si].date<=t.date)qty*=splits[si++].ratio;if(t.type==='position-adjust'){const adjusted=t.cashQty+t.marginQty;if(!qty&&adjusted)firstBuy=t.date;qty=adjusted;if(!qty){firstBuy=null;lastBuy=null;}}else if(t.side==='buy'){if(!qty)firstBuy=t.date;lastBuy=t.date;qty+=t.qty;}else{qty-=t.qty;if(qty<=0){qty=0;firstBuy=null;lastBuy=null;}}}
  const credit=s.margin?.positions[id];return {id,name:inst.name,qty:h.qty,cost:h.cost,average:h.cost/h.qty,price,priceDate:priceBar?.[0],value,pnl,returnPct:h.cost?pnl/h.cost*100:0,firstBuy,lastBuy,trades,marginQty:credit?.qty||0,cashQty:h.qty-(credit?.qty||0),principal:credit?.principal||0,interest:credit?.interest||0};
 });
 const cost=money(rows.reduce((n,r)=>n+r.cost,0)),value=money(rows.reduce((n,r)=>n+r.value,0)),pnl=money(value-cost),receivable=money(market.receivableValue(s,date));
 return {date,rows,cost,value,pnl,returnPct:cost?pnl/cost*100:0,cash:s.cash,receivable,equity:market.equity(s,date)};
}
function validJourney(r){const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;return (r?.dateJumps===undefined||Array.isArray(r.dateJumps)&&r.dateJumps.length<=5&&r.dateJumps.every((j,i,a)=>j&&iso(j.from)&&iso(j.to)&&j.from>=(r.startDate||'2020-01-02')&&j.to>j.from&&j.to<=r.date&&(!i||j.from>=a[i-1].to)))&&(r?.startDate===undefined||iso(r.startDate))&&(r?.customStartDate==null||iso(r.customStartDate)&&r.customStartDate===r.startDate)&&(r?.earlySettlementDate==null||iso(r.earlySettlementDate)&&r.earlySettlementDate>=(r.startDate||'2020-01-02')&&r.earlySettlementDate<=r.date);}
function validStats(r){return r.statsVersion===undefined||(r.statsVersion===1&&typeof r.statsComplete==='boolean'&&['buyTrades','sellTrades','wins','losses'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)&&(r.realizedPnl===null||Number.isFinite(r.realizedPnl))&&['maxGain','maxLoss'].every(k=>r[k]===null||(r[k]&&typeof r[k].id==='string'&&typeof r[k].date==='string'&&['qty','price','costBasis','proceeds','pnl','returnPct'].every(f=>Number.isFinite(r[k][f])))));}
function valid(r){return validJourney(r)&&!!r&&typeof r.id==='string'&&r.id.length<=120&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&typeof r.at==='string'&&['playing','won','lost','bankrupt','awaiting-data'].includes(r.status)&&['current','completed','restarted'].includes(r.reason)&&['equity','benchmark','cash','returnPct','alpha','maxDrawdown','trades','fees','tax','spent','choices','sessions'].every(k=>Number.isFinite(r[k]))&&validStats(r)&&(r.playTimeMs===undefined||r.playTimeMs===null||Number.isSafeInteger(r.playTimeMs)&&r.playTimeMs>=0)&&(r.playTimePartial===undefined||typeof r.playTimePartial==='boolean')&&(r.skillUses===undefined||r.skillUses&&['mother','vip','divination'].every(k=>Number.isSafeInteger(r.skillUses[k])&&r.skillUses[k]>=0));}
function normalize(value){return {version:1,runs:Array.isArray(value?.runs)?value.runs.filter(valid).slice(-100):[]};}
function history(book,snapshots=[],mode='all'){
 const runs=new Map(normalize(book).runs.map(r=>[r.id,r]));
 for(const r of snapshots){if(!valid(r))continue;const old=runs.get(r.id),closed=x=>TERMINAL.includes(x.status);if(old&&Object.keys({...old,...r}).filter(k=>k!=='at').every(k=>JSON.stringify(old[k])===JSON.stringify(r[k])))continue;if(!old||closed(r)&&!closed(old)||closed(r)===closed(old)&&Date.parse(r.at)>=Date.parse(old.at))runs.set(r.id,r);}
 return [...runs.values()].sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||a.id.localeCompare(b.id)).slice(0,100).filter(r=>mode==='all'||(r.mode||'free')===mode);
}
function best(book,mode=null){return book.runs.filter(r=>TERMINAL.includes(r.status)&&(!mode||(r.mode||'free')===mode)).slice().sort((a,b)=>b.alpha-a.alpha||b.equity-a.equity)[0]||null;}
function upsert(book,run){if(!valid(run))throw Error('遊玩數據格式不正確');let runs=normalize(book).runs.filter(r=>r.id!==run.id);runs.push(run);const keep=[best({runs}),best({runs},'life'),best({runs},'free')].filter(Boolean);if(runs.length>100){runs=runs.slice(-97);for(const r of keep)if(!runs.some(x=>x.id===r.id))runs.unshift(r);}return {version:1,runs};}
function leaderboard(book,outcome='won',edition=null){
 if(!['won','lost'].includes(outcome))throw Error('未知排行榜');
 return normalize(book).runs.filter(r=>r.status===outcome&&(!edition||(r.ruleset?.replace(/:margin-v1$/,'')===edition.ruleset.replace(/:margin-v1$/,'')&&r.datasetEnd===edition.datasetEnd))).slice().sort((a,b)=>b.equity-a.equity||(outcome==='lost'?(a.maxLoss?.pnl||0)-(b.maxLoss?.pnl||0):(b.maxGain?.pnl||0)-(a.maxGain?.pnl||0))||a.trades-b.trades||a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).slice(0,100);
}
root.TaiguRecords={snapshot,normalize,best,upsert,valid,history,tradeStats,leaderboard,inventory};
})(globalThis);
