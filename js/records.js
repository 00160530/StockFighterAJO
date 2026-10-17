(function(root){
'use strict';
const TERMINAL=['won','lost','bankrupt'];
function snapshot(market,s,reason='current',now=new Date().toISOString()){
 const date=market.date(s),equity=market.equity(s,date),benchmark=market.equity(s.benchmark,date),log=s.log||[];
 let peak=1000000,drawdown=0;for(const h of s.history){peak=Math.max(peak,h.player);drawdown=Math.max(drawdown,(peak-h.player)/peak*100);}
 return {id:s.runId,at:now,date:s.day<0?'2020-01-01':date,status:s.status,reason,sessions:s.day+1,equity,benchmark,cash:s.cash,returnPct:(equity/1e6-1)*100,alpha:(equity-benchmark)/1e6*100,maxDrawdown:drawdown,trades:log.filter(l=>l.type==='fill').length,fees:log.filter(l=>l.type==='fill').reduce((n,l)=>n+(l.fee||0),0),tax:log.filter(l=>l.type==='fill').reduce((n,l)=>n+(l.tax||0),0),spent:s.spent,choices:s.seen.length};
}
function valid(r){return !!r&&typeof r.id==='string'&&r.id.length<=120&&typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&typeof r.at==='string'&&['playing','won','lost','bankrupt','awaiting-data'].includes(r.status)&&['current','completed','restarted'].includes(r.reason)&&['equity','benchmark','cash','returnPct','alpha','maxDrawdown','trades','fees','tax','spent','choices','sessions'].every(k=>Number.isFinite(r[k]));}
function normalize(value){return {version:1,runs:Array.isArray(value?.runs)?value.runs.filter(valid).slice(-100):[]};}
function best(book){return book.runs.filter(r=>TERMINAL.includes(r.status)).slice().sort((a,b)=>b.alpha-a.alpha||b.equity-a.equity)[0]||null;}
function upsert(book,run){if(!valid(run))throw Error('遊玩數據格式不正確');let runs=normalize(book).runs.filter(r=>r.id!==run.id);runs.push(run);const strongest=best({runs});if(runs.length>100){runs=runs.slice(-99);if(strongest&&!runs.some(r=>r.id===strongest.id))runs.unshift(strongest);}return {version:1,runs};}
root.TaiguRecords={snapshot,normalize,best,upsert,valid};
})(globalThis);
