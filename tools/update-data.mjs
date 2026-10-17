import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const end=process.argv[2]||'2026-10-16';
if(!/^\d{4}-\d{2}-\d{2}$/.test(end)) throw Error('Use YYYY-MM-DD');
const sources=[];
async function api(dataset,id){
 const url=new URL('https://api.finmindtrade.com/api/v4/data');
 Object.entries({dataset,data_id:id,start_date:'2019-10-01',end_date:end}).forEach(([k,v])=>url.searchParams.set(k,v));
 const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${r.status} ${url}`);
 const j=await r.json();if(j.status!==200||!Array.isArray(j.data))throw Error(JSON.stringify(j).slice(0,300));
 sources.push({dataset,id,url:String(url),records:j.data.length});return j.data;
}
const symbols=[['0050','元大台灣50','ETF'],['2330','台積電','半導體'],['2317','鴻海','電子代工'],['2454','聯發科','IC 設計']];
const instruments={};
for(const [id,name,sector] of symbols){
 const prices=await api('TaiwanStockPrice',id);
 const chips=await api('TaiwanStockInstitutionalInvestorsBuySell',id);
 const divs=await api('TaiwanStockDividend',id);
 const byDate={};for(const c of chips){const o=byDate[c.date]??={foreign:0,trust:0,dealer:0};const net=c.buy-c.sell;
 if(c.name==='Foreign_Investor'||c.name==='Foreign_Dealer_Self')o.foreign+=net;
 else if(c.name==='Investment_Trust')o.trust+=net;
 else if(c.name.startsWith('Dealer'))o.dealer+=net;}
 const dividends=divs.map(d=>({ex:d.CashExDividendTradingDate,pay:d.CashDividendPaymentDate,amount:(d.CashEarningsDistribution||0)+(d.CashStatutorySurplus||0)})).filter(d=>d.amount>0&&d.ex>='2020-01-01'&&d.ex<=end);
 const stockDividends=divs.filter(d=>(d.StockEarningsDistribution||0)+(d.StockStatutorySurplus||0)>0&&d.StockExDividendTradingDate>='2020-01-01'&&d.StockExDividendTradingDate<=end);
 if(stockDividends.length)throw Error(`Stock dividend requires explicit handling: ${id} ${JSON.stringify(stockDividends)}`);
 instruments[id]={id,name,sector,tradable:true,unit:'股',rows:prices.map(p=>[p.date,p.open,p.max,p.min,p.close,p.Trading_Volume,p.Trading_money]),chips:byDate,dividends,splits:id==='0050'?[{date:'2025-06-18',ratio:4}]:[]};
 console.log(id,prices.length,'bars',chips.length,'chip records',dividends.length,'dividends');
}
const indexPrices=await api('TaiwanStockPrice','TAIEX');
const indexChips=await api('TaiwanStockTotalInstitutionalInvestors','TAIEX');
const indexByDate={};for(const c of indexChips){const o=indexByDate[c.date]??={foreign:0,trust:0,dealer:0};const n=c.buy-c.sell;if(c.name==='Foreign_Investor'||c.name==='Foreign_Dealer_Self')o.foreign+=n;else if(c.name==='Investment_Trust')o.trust+=n;else if(c.name.startsWith('Dealer'))o.dealer+=n;}
const rows=indexPrices.map(p=>[p.date,p.open,p.max,p.min,p.close,p.Trading_Volume,p.Trading_money]);
instruments.TAIEX={id:'TAIEX',name:'加權指數',sector:'大盤',tradable:false,unit:'股',chipUnit:'元',rows,chips:indexByDate,dividends:[],splits:[]};
// Keep only trading dates shared by every instrument; reject silent coverage holes.
const calendar=rows.map(r=>r[0]).filter(d=>d>='2020-01-02');
const missing=[];for(const [id,inst] of Object.entries(instruments)){const dates=new Set(inst.rows.map(r=>r[0]));for(const d of calendar)if(!dates.has(d)){
 // 0050 suspension dates are absent from the base calendar, not fabricated bars.
 if(id==='0050'&&d>='2025-06-11'&&d<='2025-06-17')continue;
 missing.push([id,d]);}}
if(missing.length)throw Error(`Coverage mismatch: ${JSON.stringify(missing.slice(0,20))}`);
const data={version:1,generatedAt:new Date().toISOString(),start:'2020-01-02',end:calendar.at(-1),target:'2026-10-16',calendar,instruments,sources,notes:['原始成交價，不使用後見調整價。','0050 分割期間無可交易報價時以最近收盤估值；分割恢復交易日換股。','法人按遊戲規則延後一個交易日顯示。','大盤法人為金額（元），個股法人為股數。']};
await fs.mkdir(path.join(root,'data'),{recursive:true});
await fs.writeFile(path.join(root,'data/market.js'),'window.TAIGU_DATA = '+JSON.stringify(data)+';\n');
await fs.writeFile(path.join(root,'data/provenance.json'),JSON.stringify({...data,instruments:undefined,calendar:undefined},null,2));
console.log(`Saved ${calendar.length} sessions through ${data.end}`);
