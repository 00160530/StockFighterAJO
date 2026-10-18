import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readConfig,publicConfig,serializeConfig} from '../../tools/deployment-config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const c={window:{}};vm.createContext(c);
for(const p of ['data/market.js','js/engine.js','js/story.js','data/news.js','data/group.js','js/events.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),c);
const data=c.window.TAIGU_DATA,market=c.TaiguEngine.createMarket(data),s=market.fresh('free');s.opening=false;
while(s.status==='playing')market.next(s);
const benchmarkCents=Math.round(market.equity(s.benchmark,market.date(s))*100);
const datasetId=crypto.createHash('sha256').update(JSON.stringify({calendar:data.calendar,instruments:data.instruments})).digest('hex');
const compatibleEditionIds=(data.legacyDatasets||[]).filter(v=>{
 const instruments=Object.fromEntries(Object.entries(data.instruments).filter(([id])=>v.instrumentIds.includes(id)));
 return v.datasetEnd===data.end&&crypto.createHash('sha256').update(JSON.stringify({calendar:data.calendar,instruments})).digest('hex')===v.datasetId;
}).map(v=>v.editionId);
let bound=1e6;
// An intentionally generous, frictionless daily switching bound includes dividends,
// overnight moves, intraday moves, suspended holdings and splits; no real strategy
// with fees and next-open orders can exceed it.
for(const date of data.calendar){let overnight=1,intraday=1;
 for(const [id,i] of Object.entries(data.instruments)){if(!i.tradable)continue;const r=market.bar(id,date);if(!r)continue;const ix=i.rows.findIndex(x=>x[0]===date),prev=i.rows[ix-1];if(!prev)continue;const split=(i.splits||[]).filter(x=>x.date===date).reduce((n,x)=>n*x.ratio,1),div=(i.dividends||[]).filter(x=>x.ex===date).reduce((n,x)=>n+x.amount,0);
 const stockFactor=(i.stockDividends||[]).filter(x=>x.ex===date).reduce((n,x)=>n*(1+x.ratio),1),capital=(i.capitalActions||[]).find(x=>x.date===date);
 overnight=Math.max(overnight,(r[1]*split*stockFactor*(capital?.ratio||1)+div+(capital?.cashPerOldShare||0))/prev[4]);intraday=Math.max(intraday,r[4]/r[1]);}
 bound*=overnight*intraday;if(bound*100>=Number.MAX_SAFE_INTEGER){bound=Number.MAX_SAFE_INTEGER/100;break;}
}
const edition={compatibleEditionIds,id:'tw-2020-'+data.end+'-'+datasetId.slice(0,16),datasetId,datasetEnd:data.end,start:data.start,sessions:data.calendar.length,benchmarkCents,initialCents:100000000,maxEquityCents:Math.min(Number.MAX_SAFE_INTEGER,Math.ceil(bound*100)),maxTrades:data.calendar.length*Object.values(data.instruments).filter(i=>i.tradable).length,symbols:Object.entries(data.instruments).filter(([,i])=>i.tradable).map(([id,i])=>({id,name:i.name})),rulesets:{life:'tw-life-v1',free:'tw-v1'},minDurationSeconds:{life:120,free:10},sessionTtlSeconds:30*86400};
fs.mkdirSync(path.join(root,'backend/src'),{recursive:true});fs.writeFileSync(path.join(root,'backend/src/edition.mjs'),'// Generated from the shipped market and existing engine.\nexport const EDITION='+JSON.stringify(edition,null,2)+';\n');
// Same engine, same opening fees, dividends and splits for each permitted start.
const starts={};for(let i=0;i<data.calendar.length;i++){
 const date=data.calendar[i],run=market.fresh('free',false,null,{startDate:date,unlocked:true});
 while(run.status==='playing')market.next(run);
 starts[date]={index:i,sessions:data.calendar.length-i,benchmarkCents:Math.round(market.equity(run.benchmark,market.date(run))*100)};
}
fs.writeFileSync(path.join(root,'backend/src/start-benchmarks.mjs'),'// Generated using the existing daily engine; do not hand edit.\nexport const START_BENCHMARKS='+JSON.stringify(starts)+';\n');
const configPath=path.join(root,'data/online-config.js');
const config=publicConfig({...readConfig(configPath),editionId:edition.id,datasetId,compatibleEditionIds});
// Preserve source API choice; private/env settings only enter deployment artifacts.
fs.writeFileSync(configPath,serializeConfig(config));
console.log(JSON.stringify(edition));
