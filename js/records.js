(function(root){
'use strict';
const TERMINAL=['won','lost','bankrupt'];
const money=n=>Math.round(n*100)/100;
function tradeStats(data,log){
 const holdings={},sales=[];let buys=0,sells=0,fees=0,tax=0,complete=true,splitIndex=0,lastDate='';
 const splits=Object.entries(data.instruments).flatMap(([id,inst])=>(inst.splits||[]).map(sp=>({...sp,id}))).sort((a,b)=>a.date.localeCompare(b.date));
 for(const l of log){
  if(l.type!=='fill')continue;
  if(!data.instruments[l.id]?.tradable||!['buy','sell'].includes(l.side)||!Number.isSafeInteger(l.qty)||l.qty<1||!['price','value','fee','tax'].every(k=>Number.isFinite(l[k])&&l[k]>=0)||l.price<=0||!/^\d{4}-\d{2}-\d{2}$/.test(l.date)||l.date<lastDate){complete=false;continue;}
  lastDate=l.date;while(splitIndex<splits.length&&splits[splitIndex].date<=l.date){const sp=splits[splitIndex++];if(holdings[sp.id])holdings[sp.id].qty*=sp.ratio;}
  fees+=l.fee;tax+=l.tax;const h=holdings[l.id]||{qty:0,cost:0};
  if(l.side==='buy'){buys++;h.qty+=l.qty;h.cost=money(h.cost+l.value+l.fee);holdings[l.id]=h;}
  else{sells++;if(l.qty>h.qty){complete=false;continue;}
   const remainingCost=money(h.cost*(h.qty-l.qty)/h.qty),costBasis=money(h.cost-remainingCost),proceeds=money(l.value-l.fee-l.tax),pnl=money(proceeds-costBasis);
   sales.push({id:l.id,date:l.date,qty:l.qty,price:l.price,costBasis,proceeds,pnl,returnPct:costBasis?pnl/costBasis*100:0});h.qty-=l.qty;h.cost=remainingCost;if(!h.qty)delete holdings[l.id];
  }
 }
 const maxGain=sales.filter(s=>s.pnl>0).reduce((best,s)=>!best||s.pnl>best.pnl?s:best,null),maxLoss=sales.filter(s=>s.pnl<0).reduce((worst,s)=>!worst||s.pnl<worst.pnl?s:worst,null);
 return {statsVersion:1,statsComplete:complete,trades:buys+sells,buyTrades:buys,sellTrades:sells,fees:money(fees),tax:money(tax),wins:sales.filter(s=>s.pnl>0).length,losses:sales.filter(s=>s.pnl<0).length,realizedPnl:complete?money(sales.reduce((n,s)=>n+s.pnl,0)):null,maxGain:complete?maxGain:null,maxLoss:complete?maxLoss:null};
}
function snapshot(market,s,reason='current',now=new Date().toISOString()){
 const mode=s.life?.eligibleForUnlock===false?'free':s.mode||'free',date=market.date(s),equity=market.equity(s,date),benchmark=market.equity(s.benchmark,date),log=s.log||[];
 let peak=1000000,drawdown=0;for(const h of s.history){peak=Math.max(peak,h.player);drawdown=Math.max(drawdown,(peak-h.player)/peak*100);}
 return {id:s.runId,at:now,date:s.day<0?'2020-01-01':date,status:s.status,reason,mode,ruleset:mode==='life'?'tw-life-v1':'tw-v1',datasetEnd:market.data.end,sessions:s.day+1,equity,benchmark,cash:s.cash,returnPct:(equity/1e6-1)*100,alpha:(equity-benchmark)/1e6*100,maxDrawdown:drawdown,...tradeStats(market.data,log),spent:s.spent,choices:s.seen.length};
}
function validStats(r){return r.statsVersion===undefined||(r.statsVersion===1&&typeof r.statsComplete==='boolean'&&['buyTrades','sellTrades','wins','losses'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)&&(r.realizedPnl===null||Number.isFinite(r.realizedPnl))&&['maxGain','maxLoss'].every(k=>r[k]===null||(r[k]&&typeof r[k].id==='string'&&typeof r[k].date==='string'&&['qty','price','costBasis','proceeds','pnl','returnPct'].every(f=>Number.isFinite(r[k][f])))));}
function valid(r){return !!r&&typeof r.id==='string'&&r.id.length<=120&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&typeof r.at==='string'&&['playing','won','lost','bankrupt','awaiting-data'].includes(r.status)&&['current','completed','restarted'].includes(r.reason)&&['equity','benchmark','cash','returnPct','alpha','maxDrawdown','trades','fees','tax','spent','choices','sessions'].every(k=>Number.isFinite(r[k]))&&validStats(r);}
function normalize(value){return {version:1,runs:Array.isArray(value?.runs)?value.runs.filter(valid).slice(-100):[]};}
function best(book,mode=null){return book.runs.filter(r=>TERMINAL.includes(r.status)&&(!mode||(r.mode||'free')===mode)).slice().sort((a,b)=>b.alpha-a.alpha||b.equity-a.equity)[0]||null;}
function upsert(book,run){if(!valid(run))throw Error('遊玩數據格式不正確');let runs=normalize(book).runs.filter(r=>r.id!==run.id);runs.push(run);const keep=[best({runs}),best({runs},'life'),best({runs},'free')].filter(Boolean);if(runs.length>100){runs=runs.slice(-97);for(const r of keep)if(!runs.some(x=>x.id===r.id))runs.unshift(r);}return {version:1,runs};}
function leaderboard(book,metric='alpha',edition=null){
 const selectors={alpha:r=>r.alpha,gain:r=>r.statsComplete&&r.maxGain?r.maxGain.pnl:null,loss:r=>r.statsComplete&&r.maxLoss?r.maxLoss.pnl:null};
 if(!selectors[metric])throw Error('未知排行榜');
 return normalize(book).runs.filter(r=>['won','lost'].includes(r.status)&&(!edition||(r.ruleset===edition.ruleset&&r.datasetEnd===edition.datasetEnd))&&Number.isFinite(selectors[metric](r))).slice().sort((a,b)=>(metric==='loss'?selectors[metric](a)-selectors[metric](b):selectors[metric](b)-selectors[metric](a))||a.maxDrawdown-b.maxDrawdown||a.trades-b.trades||a.at.localeCompare(b.at)).slice(0,20);
}
root.TaiguRecords={snapshot,normalize,best,upsert,valid,tradeStats,leaderboard};
})(globalThis);
