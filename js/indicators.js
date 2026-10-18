(function(root){
'use strict';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function mean(values,period){let sum=0,count=0;return values.map((v,i)=>{if(finite(v)){sum+=v;count++;}if(i>=period&&finite(values[i-period])){sum-=values[i-period];count--;}return i>=period-1&&count===period?sum/period:null;});}
function smooth(values,period,wilder=false){let sum=0,count=0,previous=null;const alpha=wilder?1/period:2/(period+1);return values.map(v=>{if(!finite(v)){sum=0;count=0;previous=null;return null;}if(previous===null){sum+=v;count++;if(count<period)return null;previous=sum/period;}else previous+=alpha*(v-previous);return previous;});}
const line=(name,color,values)=>({name,color,values,type:'line'});
const DEFINITIONS=[
 {id:'chips',label:'法人買賣超',parameters:'外資／投信／自營商 · 延後一個交易日'},
 {id:'volume',label:'成交量',parameters:'每日成交股數'},
 {id:'kdj',label:'KD／J',parameters:'9 日 · K、D 各平滑 3 日'},
 {id:'macd',label:'MACD',parameters:'EMA 12、26 · 訊號 9 · 柱狀為 2×差值'},
 {id:'rsi',label:'RSI',parameters:'6、12 日 · Wilder 平滑'},
 {id:'bias',label:'乖離率',parameters:'6、12、24 日'},
 {id:'williams',label:'威廉指標',parameters:'%R 14 日 · 範圍 −100～0'},
 {id:'bbi',label:'多空指標乖離',parameters:'BBI：3、6、12、24 日均線平均'},
 {id:'cdp',label:'CDP',parameters:'前一交易日計算 · AH、NH、CDP、NL、AL'},
 {id:'dmi',label:'動向指標 DMI',parameters:'14 日 · +DI、−DI、ADX'}
];
function calculate(rows,id){
 const definition=DEFINITIONS.find(d=>d.id===id);if(!definition||id==='chips')return null;
 const close=rows.map(r=>r[4]),series=[];let guides=[],domain=null,unit='';
 if(id==='volume'){series.push({name:'成交量',color:'#86c5c3',type:'volume',values:rows.map(r=>r[5])});unit='股';domain=[0,null];}
 if(id==='kdj'){
  let k=50,d=50;const ks=[],ds=[],js=[];
  rows.forEach((r,i)=>{if(i<8){ks.push(null);ds.push(null);js.push(null);return;}const window=rows.slice(i-8,i+1),hi=Math.max(...window.map(v=>v[2])),lo=Math.min(...window.map(v=>v[3])),rsv=hi===lo?50:(r[4]-lo)/(hi-lo)*100;k=(2*k+rsv)/3;d=(2*d+k)/3;ks.push(k);ds.push(d);js.push(3*k-2*d);});
  series.push(line('K9','#bc7a24',ks),line('D9','#3385c0',ds),line('J9','#9269bf',js));guides=[20,80];domain=[0,100];
 }
 if(id==='macd'){
  const fast=smooth(close,12),slow=smooth(close,26),dif=close.map((_,i)=>finite(fast[i])&&finite(slow[i])?fast[i]-slow[i]:null),signal=smooth(dif,9);
  series.push(line('DIF','#9269bf',dif),line('訊號','#3385c0',signal),{name:'MACD',color:'#d45b70',type:'histogram',values:dif.map((v,i)=>finite(v)&&finite(signal[i])?2*(v-signal[i]):null)});guides=[0];
 }
 if(id==='rsi'){
  const gains=close.map((v,i)=>i?Math.max(0,v-close[i-1]):null),losses=close.map((v,i)=>i?Math.max(0,close[i-1]-v):null);
  for(const [p,color]of [[6,'#bc7a24'],[12,'#9269bf']]){const up=smooth(gains,p,true),down=smooth(losses,p,true);series.push(line('RSI'+p,color,close.map((_,i)=>!finite(up[i])?null:up[i]===0&&down[i]===0?50:down[i]===0?100:100-100/(1+up[i]/down[i]))));}guides=[30,70];domain=[0,100];
 }
 if(id==='bias'){
  for(const [p,color]of [[6,'#bc7a24'],[12,'#3385c0'],[24,'#9269bf']]){const avg=mean(close,p);series.push(line('BIAS'+p,color,close.map((v,i)=>finite(avg[i])&&avg[i]!==0?(v/avg[i]-1)*100:null)));}guides=[0];unit='%';
 }
 if(id==='williams'){
  series.push(line('%R14','#9269bf',rows.map((r,i)=>{if(i<13)return null;const window=rows.slice(i-13,i+1),hi=Math.max(...window.map(v=>v[2])),lo=Math.min(...window.map(v=>v[3]));return hi===lo?-50:-100*(hi-r[4])/(hi-lo);})));guides=[-80,-20];domain=[-100,0];
 }
 if(id==='bbi'){
  const averages=[3,6,12,24].map(p=>mean(close,p));series.push(line('BBI乖離','#9269bf',close.map((v,i)=>{const a=averages.map(x=>x[i]);if(!a.every(finite))return null;const bbi=a.reduce((n,x)=>n+x,0)/4;return bbi?(v/bbi-1)*100:null;})));guides=[0];unit='%';
 }
 if(id==='cdp'){
  const levels=rows.map((r,i)=>{if(!i)return null;const previous=rows[i-1],hi=previous[2],lo=previous[3],cdp=(hi+lo+2*previous[4])/4;return [cdp+hi-lo,2*cdp-lo,cdp,2*cdp-hi,cdp-hi+lo];});
  ['AH','NH','CDP','NL','AL'].forEach((name,k)=>series.push(line(name,['#d45b70','#bc7a24','#9269bf','#3385c0','#268d8c'][k],levels.map(v=>v?.[k]??null))));
 }
 if(id==='dmi'){
  const tr=[],plus=[],minus=[];rows.forEach((r,i)=>{if(!i){tr.push(null);plus.push(null);minus.push(null);return;}const p=rows[i-1],up=r[2]-p[2],down=p[3]-r[3];tr.push(Math.max(r[2]-r[3],Math.abs(r[2]-p[4]),Math.abs(r[3]-p[4])));plus.push(up>down&&up>0?up:0);minus.push(down>up&&down>0?down:0);});
  const atr=smooth(tr,14,true),pdm=smooth(plus,14,true),mdm=smooth(minus,14,true),pdi=atr.map((v,i)=>!finite(v)?null:v?100*pdm[i]/v:0),mdi=atr.map((v,i)=>!finite(v)?null:v?100*mdm[i]/v:0),dx=pdi.map((v,i)=>!finite(v)?null:v+mdi[i]?100*Math.abs(v-mdi[i])/(v+mdi[i]):0);
  series.push(line('+DI','#d45b70',pdi),line('−DI','#268d8c',mdi),line('ADX','#9269bf',smooth(dx,14,true)));guides=[20,40];domain=[0,100];
 }
 return {...definition,series,guides,domain,unit};
}
root.TaiguIndicators={DEFINITIONS,mean,smooth,calculate};
})(globalThis);
