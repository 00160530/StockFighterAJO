(function(root){
'use strict';
const COLORS={ink:'#758079',grid:'#e8eeea',up:'#d45b70',down:'#268d8c',ma5:'#bc7a24',ma20:'#3385c0',ma60:'#9269bf',foreign:'#308caa',trust:'#8971c4',dealer:'#77899e'};
const compact=n=>Math.abs(n)>=1e8?(n/1e8).toFixed(1)+'億':Math.abs(n)>=1e4?(n/1e4).toFixed(1)+'萬':Math.round(n).toLocaleString('zh-TW');
// Presentation-only copy. The historical row and game state never change.
function fallingBar(row,progress){const t=Math.max(0,Math.min(1,progress)),p=Math.pow(t,1.65),r=row.slice();for(const k of [2,3,4])r[k]=row[1]+(row[k]-row[1])*p;r[5]=row[5]*p;return r;}
class MarketChart{
 constructor(canvas,tooltip,market){this.el=canvas;this.tip=tooltip;this.market=market;this.ctx=canvas.getContext('2d');this.range=120;this.offset=0;this.hover=null;this.hoverY=null;this.ma=true;this.adjust=true;this.drag=null;this.indicator='volume';
  this.events=[];this.showEvents=true;this.markerLayer=document.createElement('div');this.markerLayer.className='chart-event-layer';canvas.parentElement.append(this.markerLayer);
  this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas.parentElement);this.indicatorBar=canvas.parentElement.querySelector('.chart-foot');if(this.indicatorBar){this.resize.observe(this.indicatorBar);this.indicatorBar.addEventListener('pointerenter',()=>{this.hover=null;this.tip.hidden=true;this.draw();});}
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.range=Math.max(20,Math.min(300,Math.round(this.range*(e.deltaY>0?1.15:.85))));this.hover=null;this.draw();},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.drag={x:e.clientX,offset:this.offset};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();if(this.drag){const step=this.plotWidth/this.n;this.offset=Math.max(0,Math.min(Math.max(0,this.all.length-this.range),this.drag.offset+Math.round((e.clientX-this.drag.x)/step)));this.hover=null;this.tip.hidden=true;this.draw();}else{this.hover=e.clientX-rect.left;this.hoverY=e.clientY-rect.top;this.draw();}});
  canvas.addEventListener('pointerup',()=>{this.drag=null;canvas.style.cursor='crosshair';});canvas.addEventListener('pointercancel',()=>{this.drag=null;});
  canvas.addEventListener('pointerleave',()=>{if(!this.drag){this.hover=null;this.tip.hidden=true;this.draw();}});
 }
 update(state,id,reset=false){this.state=state;this.id=id;if(reset)this.offset=0;this.hover=null;this.tip.hidden=true;this.draw();}
 renderMarkers(rows,x,y,w,bottom){
  this.markerLayer.replaceChildren();this.markerLayer.hidden=!this.showEvents||!!this.fall;if(this.markerLayer.hidden||!root.TaiguChartEvents)return;
  const groups=root.TaiguChartEvents.collect(this.state,this.events,this.market.date(this.state)),marks=root.TaiguChartEvents.layout(groups,rows,x,y,w,bottom);
  for(const mark of marks){const b=document.createElement('button');b.type='button';b.className='chart-event-marker'+(mark.full?'':' compact');b.textContent=mark.full?mark.label:mark.entries.length>1?mark.entries.length:'•';b.style.left=mark.left+'px';b.style.top=mark.top+'px';b.style.setProperty('--stem',mark.stem+'px');b.style.setProperty('--anchor',mark.anchor+'px');b.title=mark.date+' · '+mark.entries.map(e=>e.title).join('／');b.setAttribute('aria-label',b.title);b.onclick=()=>this.onAnnotation?.(mark);this.markerLayer.append(b);}
 }
 setRange(n){this.range=n;this.offset=0;this.hover=null;this.draw();}
 setIndicator(id){if(!root.TaiguIndicators.DEFINITIONS.some(d=>d.id===id))return;this.indicator=id;this.hover=null;this.tip.hidden=true;this.draw();}
 beginFall(context){this.fall={id:context.id,date:context.date,progress:0};this.fallSpot=null;this.hover=null;this.tip.hidden=true;}
 setFall(progress){if(!this.fall)return;this.fall.progress=Math.max(0,Math.min(1,progress));this.hover=null;this.draw();}
 endFall(){this.fall=null;this.fallSpot=null;this.draw();}
 getFallSpot(){if(!this.fallSpot)return null;const r=this.el.getBoundingClientRect(),s=this.fallSpot;return {...s,x:r.left+s.x,top:r.top+s.top,bottom:r.top+s.bottom};}
 draw(){
  if(!this.state)return;const canvas=this.el,ctx=this.ctx,rect=canvas.parentElement.getBoundingClientRect();if(!rect.width||!rect.height)return;const w=Math.max(200,rect.width-15),h=rect.height;
  const dpr=root.devicePixelRatio||1;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.font='10px Consolas, monospace';ctx.textBaseline='middle';
  const inst=this.market.data.instruments[this.id],asof=this.market.date(this.state),raw=this.market.visibleRows(this.state,this.id);
  this.all=raw.map(r=>r.slice());if(this.adjust){const actions=[...(inst.splits||[]),...(inst.stockDividends||[]).map(d=>({date:d.ex,ratio:1+d.ratio})),...(inst.capitalActions||[])].filter(a=>a.date<=asof).sort((a,b)=>a.date.localeCompare(b.date));for(const action of actions)for(const r of this.all)if(r[0]<action.date){for(let j=1;j<=4;j++)r[j]=(r[j]-(action.cashPerOldShare||0))/action.ratio;r[5]*=action.ratio;}}
  const all=this.all;if(!all.length)return;const end=Math.max(1,all.length-this.offset),start=Math.max(0,end-this.range),realRows=all.slice(start,end),fall=this.fall?.id===this.id&&this.fall.date===asof?this.fall:null,rows=realRows.map(r=>fall&&r[0]===fall.date?fallingBar(r,fall.progress):r),n=rows.length;
  this.n=n;const left=8,right=57,pw=w-left-right;this.plotWidth=pw;const step=pw/n;const top=12,barHeight=this.indicatorBar?.getBoundingClientRect().height||0,cBottom=h-23,plotHeight=Math.max(16,cBottom-top-barHeight-12),pBottom=top+plotHeight*.66,cTop=pBottom+barHeight+12;if(this.indicatorBar)this.indicatorBar.style.top=(pBottom+6)+'px';
  const averages={};for(const period of [5,20,60]){let sum=0;averages[period]=all.map((r,i)=>{sum+=r[4];if(i>=period)sum-=all[i-period][4];return i>=period-1?sum/period:null;});}
  const relevant=realRows.flatMap(r=>[r[2],r[3]]);if(this.ma)for(const period of [5,20,60])for(let i=start;i<end;i++)if(averages[period][i]!=null)relevant.push(averages[period][i]);
  let hi=Math.max(...relevant),lo=Math.min(...relevant),span=hi-lo||hi*.01;hi+=span*.08;lo-=span*.08;span=hi-lo;
  const y=p=>pBottom-(p-lo)/span*(pBottom-top),x=i=>left+(i+.5)*step;
  const priceLabels=h<180?3:5;ctx.strokeStyle=COLORS.grid;ctx.lineWidth=1;ctx.fillStyle=COLORS.ink;ctx.textAlign='left';for(let i=0;i<priceLabels;i++){const p=hi-span*i/(priceLabels-1),yy=y(p);ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.fillText(p.toFixed(this.id==='TAIEX'?0:2),w-right+8,yy);}
  const labelCount=w<500?3:5;for(let i=0;i<labelCount;i++){const idx=Math.floor(i*(n-1)/(labelCount-1)),xx=x(idx);ctx.strokeStyle=COLORS.grid;ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,cBottom);ctx.stroke();ctx.textAlign='center';ctx.fillStyle=COLORS.ink;ctx.fillText(rows[idx][0].slice(2).replaceAll('-','/'),xx,h-10);}
  this.fallSpot=null;if(fall){ctx.save();ctx.beginPath();ctx.rect(left,top,pw,pBottom-top);ctx.clip();}
  for(let i=0;i<n;i++){const r=rows[i],focused=fall&&r[0]===fall.date,up=focused?false:r[4]>=r[1],color=up?COLORS.up:COLORS.down;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x(i),y(r[2]));ctx.lineTo(x(i),y(r[3]));ctx.stroke();const width=Math.max(1,Math.min(9,step*.62)),body=Math.max(1,Math.abs(y(r[1])-y(r[4])));if(focused){ctx.shadowColor='#60d9b7';ctx.shadowBlur=12*fall.progress;this.fallSpot={x:x(i),top:y(r[2]),bottom:y(r[3]),width,price:r[4],date:r[0]};}ctx.fillRect(x(i)-width/2,Math.min(y(r[1]),y(r[4])),width,body);ctx.shadowBlur=0;}
  if(this.ma)for(const period of [5,20,60]){ctx.strokeStyle=COLORS['ma'+period];ctx.lineWidth=1.2;ctx.beginPath();let begun=false;for(let i=0;i<n;i++){const a=averages[period][start+i];if(a===null)continue;if(!begun){ctx.moveTo(x(i),y(a));begun=true;}else ctx.lineTo(x(i),y(a));}ctx.stroke();}ctx.lineWidth=1;
  const last=rows.at(-1);ctx.strokeStyle=last[4]>=last[1]?COLORS.up:COLORS.down;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(left,y(last[4]));ctx.lineTo(w-right,y(last[4]));ctx.stroke();ctx.setLineDash([]);
  if(fall)ctx.restore();
  const cutoff=this.market.chipCutoff(this.state),keys=['foreign','trust','dealer'],chipRows=rows.map(r=>r[0]<=cutoff?inst.chips[r[0]]:null);
  let auxiliary;if(this.indicator==='chips')auxiliary={label:'法人買賣超 · 延後一日',unit:inst.chipUnit||'股',guides:[0],series:keys.map((key,k)=>({name:['外資','投信','自營商'][k],color:COLORS[key],type:'group',values:chipRows.map(c=>c&&Number.isFinite(c[key])?c[key]:null)}))};
  else{const cacheKey=this.id+'|'+asof+'|'+this.adjust+'|'+this.indicator;if(this.indicatorCache?.key!==cacheKey)this.indicatorCache={key:cacheKey,data:root.TaiguIndicators.calculate(all,this.indicator)};const full=this.indicatorCache.data;auxiliary={...full,series:full.series.map(s=>({...s,values:s.values.slice(start,end)}))};}
  const numbers=auxiliary.series.flatMap(s=>s.values.filter(Number.isFinite)),histogram=auxiliary.series.some(s=>s.type!=='line');let auxLo=Math.min(...numbers,auxiliary.domain?.[0]??Infinity),auxHi=Math.max(...numbers,auxiliary.domain?.[1]??-Infinity);
  if(!numbers.length){auxLo=0;auxHi=1;}if(histogram){auxLo=Math.min(0,auxLo);auxHi=Math.max(0,auxHi);}if(auxLo===auxHi){const pad=Math.abs(auxLo)*.05||1;auxLo-=pad;auxHi+=pad;}else if(!auxiliary.domain){const pad=(auxHi-auxLo)*.1;auxLo-=pad;auxHi+=pad;}
  const auxY=v=>cBottom-(v-auxLo)/(auxHi-auxLo)*(cBottom-cTop),auxFormat=v=>this.indicator==='chips'||this.indicator==='volume'?compact(v):v.toFixed(2)+(auxiliary.unit||'');
  ctx.fillStyle=COLORS.ink;ctx.textAlign='left';
  for(const v of [auxHi,(auxLo+auxHi)/2,auxLo]){const yy=auxY(v);ctx.strokeStyle=COLORS.grid;ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.fillText(auxFormat(v),w-right+5,yy);}
  for(const v of auxiliary.guides||[])if(v>=auxLo&&v<=auxHi){ctx.strokeStyle='#b6c9bd';ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(left,auxY(v));ctx.lineTo(w-right,auxY(v));ctx.stroke();ctx.setLineDash([]);}
  ctx.save();ctx.beginPath();ctx.rect(left,cTop,pw,Math.max(1,cBottom-cTop));ctx.clip();
  auxiliary.series.forEach((s,k)=>{ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=1.3;if(s.type==='line'){ctx.beginPath();let begun=false;for(let i=0;i<n;i++){const v=s.values[i];if(!Number.isFinite(v)){begun=false;continue;}if(!begun){ctx.moveTo(x(i),auxY(v));begun=true;}else ctx.lineTo(x(i),auxY(v));}ctx.stroke();}
   else for(let i=0;i<n;i++){const v=s.values[i];if(!Number.isFinite(v))continue;const bw=s.type==='group'?Math.max(.6,Math.min(3,step*.22)):Math.max(1,step*.58),xx=x(i)+(s.type==='group'?(k-1)*bw:0);if(s.type==='volume')ctx.fillStyle=rows[i][4]>=rows[i][1]?'#e2a0ad':'#86c5c3';else if(s.type==='histogram')ctx.fillStyle=v>=0?COLORS.up:COLORS.down;const base=auxY(0);ctx.fillRect(xx-bw/2,Math.min(base,auxY(v)),bw*.9,Math.max(.5,Math.abs(auxY(v)-base)));}});
  ctx.restore();ctx.lineWidth=1;
  const effectiveSplits=(inst.splits||[]).filter(sp=>sp.date<=asof);for(const sp of effectiveSplits){const i=rows.findIndex(r=>r[0]===sp.date);if(i>=0){ctx.strokeStyle='#c4b58d';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(x(i),top);ctx.lineTo(x(i),pBottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#a7976f';ctx.textAlign='left';ctx.fillText('1 拆 '+sp.ratio,Math.min(x(i)+4,w-right-45),top+10);}}
  let selected=n-1;if(this.hover!==null){selected=Math.max(0,Math.min(n-1,Math.floor((this.hover-left)/step)));const xx=x(selected);ctx.strokeStyle='#9dad97';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,cBottom);ctx.stroke();ctx.setLineDash([]);const r=rows[selected],c=chipRows[selected];
   const auxText=auxiliary.series.map(s=>s.name+' '+(Number.isFinite(s.values[selected])?auxFormat(s.values[selected]):'—')).join(' / ');
   this.tip.innerHTML=`<strong>${r[0]}</strong><br>開 ${r[1].toFixed(2)}　高 ${r[2].toFixed(2)}<br>低 ${r[3].toFixed(2)}　收 ${r[4].toFixed(2)}<br>成交量 ${compact(r[5])} 股<br>${this.indicator==='chips'?(c?auxText:r[0]>cutoff?'法人：下一交易日可見':'法人：此日資料缺漏'):auxText}`;
   const yy=this.hoverY;if(yy>=top&&yy<=pBottom||yy>=cTop&&yy<=cBottom){ctx.strokeStyle='#9dad97';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.setLineDash([]);const value=yy<=pBottom?lo+(pBottom-yy)/(pBottom-top)*span:auxLo+(cBottom-yy)/(cBottom-cTop)*(auxHi-auxLo);ctx.fillStyle='#3d5f4b';ctx.fillRect(w-right,yy-8,right,16);ctx.fillStyle='#fff';ctx.textAlign='left';ctx.fillText(yy<=pBottom?value.toFixed(this.id==='TAIEX'?0:2):auxFormat(value),w-right+3,yy);}
   this.tip.style.left=(xx>pw*.5?15:Math.min(w-205,xx+20))+'px';this.tip.hidden=false;
  }
  const r=rows[selected];document.getElementById('ohlcLine').textContent=`${r[0]}　開 ${r[1].toFixed(2)}　高 ${r[2].toFixed(2)}　低 ${r[3].toFixed(2)}　收 ${r[4].toFixed(2)}`;
  let legendIndex=selected;if(this.indicator==='chips'&&this.hover===null)while(legendIndex>0&&!chipRows[legendIndex])legendIndex--;
  const legend=document.getElementById('indicatorValues');if(legend){legend.innerHTML=auxiliary.series.map(s=>'<span style="color:'+s.color+'">'+s.name+' <b>'+(Number.isFinite(s.values[legendIndex])?auxFormat(s.values[legendIndex]):'—')+'</b></span>').join('');legend.setAttribute('aria-label',rows[legendIndex][0]+' '+auxiliary.label);legend.title=rows[legendIndex][0]+' '+legend.textContent;}
  const note=document.getElementById('chipNote');if(note&&this.indicator!=='chips')note.textContent=root.TaiguIndicators.DEFINITIONS.find(d=>d.id===this.indicator).parameters;else if(note)note.textContent='法人截至 '+cutoff.replaceAll('-','/')+' · '+(inst.chipUnit==='元'?'大盤金額':'買賣超股數');if(note){note.title=note.textContent;const picker=document.getElementById('indicatorSelect');if(picker)picker.title=note.textContent;}
  for(const period of [5,20,60])document.getElementById('ma'+period).textContent=averages[period][start+selected]?.toFixed(2)||'—';
  this.renderMarkers(realRows,x,y,w,pBottom);
 }
}
root.TaiguChart=MarketChart;
MarketChart.fallingBar=fallingBar;
})(globalThis);
