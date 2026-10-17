(function(root){
'use strict';
const COLORS={ink:'#63778a',grid:'#e5edf3',up:'#d45b70',down:'#268d8c',ma5:'#bc7a24',ma20:'#3385c0',ma60:'#9269bf',foreign:'#308caa',trust:'#8971c4',dealer:'#77899e'};
const compact=n=>Math.abs(n)>=1e8?(n/1e8).toFixed(1)+'億':Math.abs(n)>=1e4?(n/1e4).toFixed(1)+'萬':Math.round(n).toLocaleString('zh-TW');
class MarketChart{
 constructor(canvas,tooltip,market){this.el=canvas;this.tip=tooltip;this.market=market;this.ctx=canvas.getContext('2d');this.range=120;this.offset=0;this.hover=null;this.ma=true;this.adjust=false;this.drag=null;
  this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(canvas.parentElement);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.range=Math.max(20,Math.min(300,Math.round(this.range*(e.deltaY>0?1.15:.85))));this.hover=null;this.draw();},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.drag={x:e.clientX,offset:this.offset};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect();if(this.drag){const step=this.plotWidth/this.n;this.offset=Math.max(0,Math.min(Math.max(0,this.all.length-this.range),this.drag.offset+Math.round((e.clientX-this.drag.x)/step)));this.hover=null;this.tip.hidden=true;this.draw();}else{this.hover=e.clientX-rect.left;this.draw();}});
  canvas.addEventListener('pointerup',()=>{this.drag=null;canvas.style.cursor='crosshair';});canvas.addEventListener('pointercancel',()=>{this.drag=null;});
  canvas.addEventListener('pointerleave',()=>{if(!this.drag){this.hover=null;this.tip.hidden=true;this.draw();}});
 }
 update(state,id,reset=false){this.state=state;this.id=id;if(reset)this.offset=0;this.hover=null;this.tip.hidden=true;this.draw();}
 setRange(n){this.range=n;this.offset=0;this.hover=null;this.draw();}
 draw(){
  if(!this.state)return;const canvas=this.el,ctx=this.ctx,rect=canvas.parentElement.getBoundingClientRect();if(!rect.width||!rect.height)return;const w=Math.max(200,rect.width-15),h=rect.height;
  const dpr=root.devicePixelRatio||1;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.font='10px Consolas, monospace';ctx.textBaseline='middle';
  const inst=this.market.data.instruments[this.id],asof=this.market.date(this.state),raw=this.market.visibleRows(this.state,this.id);
  this.all=raw.map(r=>r.slice());if(this.adjust)for(const sp of inst.splits||[])if(sp.date<=asof)for(const r of this.all)if(r[0]<sp.date){for(let j=1;j<=4;j++)r[j]/=sp.ratio;r[5]*=sp.ratio;}
  const all=this.all;if(!all.length)return;const end=Math.max(1,all.length-this.offset),start=Math.max(0,end-this.range),rows=all.slice(start,end),n=rows.length;
  this.n=n;const left=8,right=57,pw=w-left-right;this.plotWidth=pw;const step=pw/n;const top=12,pBottom=h*.565,vTop=h*.61,vBottom=h*.745,cTop=h*.80,cBottom=h-26;
  const averages={};for(const period of [5,20,60]){let sum=0;averages[period]=all.map((r,i)=>{sum+=r[4];if(i>=period)sum-=all[i-period][4];return i>=period-1?sum/period:null;});}
  const relevant=rows.flatMap(r=>[r[2],r[3]]);if(this.ma)for(const period of [5,20,60])for(let i=start;i<end;i++)if(averages[period][i]!=null)relevant.push(averages[period][i]);
  let hi=Math.max(...relevant),lo=Math.min(...relevant),span=hi-lo||hi*.01;hi+=span*.08;lo-=span*.08;span=hi-lo;
  const y=p=>pBottom-(p-lo)/span*(pBottom-top),x=i=>left+(i+.5)*step;
  ctx.strokeStyle=COLORS.grid;ctx.lineWidth=1;ctx.fillStyle=COLORS.ink;ctx.textAlign='left';for(let i=0;i<5;i++){const p=hi-span*i/4,yy=y(p);ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.fillText(p.toFixed(this.id==='TAIEX'?0:2),w-right+8,yy);}
  const labelCount=w<500?3:5;for(let i=0;i<labelCount;i++){const idx=Math.floor(i*(n-1)/(labelCount-1)),xx=x(idx);ctx.strokeStyle=COLORS.grid;ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,cBottom);ctx.stroke();ctx.textAlign='center';ctx.fillStyle=COLORS.ink;ctx.fillText(rows[idx][0].slice(2).replaceAll('-','/'),xx,h-10);}
  for(let i=0;i<n;i++){const r=rows[i],up=r[4]>=r[1],color=up?COLORS.up:COLORS.down;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x(i),y(r[2]));ctx.lineTo(x(i),y(r[3]));ctx.stroke();const width=Math.max(1,Math.min(9,step*.62)),body=Math.max(1,Math.abs(y(r[1])-y(r[4])));ctx.fillRect(x(i)-width/2,Math.min(y(r[1]),y(r[4])),width,body);}
  if(this.ma)for(const period of [5,20,60]){ctx.strokeStyle=COLORS['ma'+period];ctx.lineWidth=1.2;ctx.beginPath();let begun=false;for(let i=0;i<n;i++){const a=averages[period][start+i];if(a===null)continue;if(!begun){ctx.moveTo(x(i),y(a));begun=true;}else ctx.lineTo(x(i),y(a));}ctx.stroke();}ctx.lineWidth=1;
  const last=rows.at(-1);ctx.strokeStyle=last[4]>=last[1]?COLORS.up:COLORS.down;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(left,y(last[4]));ctx.lineTo(w-right,y(last[4]));ctx.stroke();ctx.setLineDash([]);
  const volumeMax=Math.max(1,...rows.map(r=>r[5]));for(let i=0;i<n;i++){ctx.fillStyle=rows[i][4]>=rows[i][1]?'#e2a0ad':'#86c5c3';const vh=rows[i][5]/volumeMax*(vBottom-vTop-9);ctx.fillRect(x(i)-Math.max(1,step*.58)/2,vBottom-vh,Math.max(1,step*.58),vh);}
  ctx.fillStyle=COLORS.ink;ctx.textAlign='left';ctx.fillText('成交量（股）',left,vTop-7);ctx.fillText(compact(volumeMax),w-right+5,vTop+5);ctx.strokeStyle=COLORS.grid;ctx.beginPath();ctx.moveTo(left,vBottom);ctx.lineTo(w-right,vBottom);ctx.stroke();
  const cutoff=this.market.chipCutoff(this.state),keys=['foreign','trust','dealer'];const chipRows=rows.map(r=>r[0]<=cutoff?inst.chips[r[0]]:null),chipMax=Math.max(1,...chipRows.flatMap(c=>c?keys.map(k=>Math.abs(c[k])):[]));const mid=(cTop+cBottom)/2;
  ctx.fillStyle=COLORS.ink;ctx.fillText(`法人買賣超（${inst.chipUnit||'股'}）· 延後一日`,left,cTop-7);ctx.fillText(compact(chipMax),w-right+5,cTop+7);ctx.fillText('0',w-right+5,mid);ctx.strokeStyle='#e3e9de';ctx.beginPath();ctx.moveTo(left,mid);ctx.lineTo(w-right,mid);ctx.stroke();
  for(let i=0;i<n;i++){const c=chipRows[i];if(!c)continue;const bw=Math.max(.65,Math.min(3,step*.22));for(let k=0;k<3;k++){const v=c[keys[k]]||0,bh=v/chipMax*((cBottom-cTop)/2-5);ctx.fillStyle=COLORS[keys[k]];ctx.fillRect(x(i)+(k-1)*bw-bw/2,bh>0?mid-bh:mid,bw*.9,Math.max(.5,Math.abs(bh)));}}
  const effectiveSplits=(inst.splits||[]).filter(sp=>sp.date<=asof);for(const sp of effectiveSplits){const i=rows.findIndex(r=>r[0]===sp.date);if(i>=0){ctx.strokeStyle='#c4b58d';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(x(i),top);ctx.lineTo(x(i),pBottom);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#a7976f';ctx.textAlign='left';ctx.fillText('1 拆 '+sp.ratio,Math.min(x(i)+4,w-right-45),top+10);}}
  let selected=n-1;if(this.hover!==null){selected=Math.max(0,Math.min(n-1,Math.floor((this.hover-left)/step)));const xx=x(selected);ctx.strokeStyle='#9dad97';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,cBottom);ctx.stroke();ctx.setLineDash([]);const r=rows[selected],c=chipRows[selected];
   this.tip.innerHTML=`<strong>${r[0]}</strong><br>開 ${r[1].toFixed(2)}　高 ${r[2].toFixed(2)}<br>低 ${r[3].toFixed(2)}　收 ${r[4].toFixed(2)}<br>成交量 ${compact(r[5])} 股<br>${c?'外資 '+compact(c.foreign)+' / 投信 '+compact(c.trust)+'<br>自營商 '+compact(c.dealer)+' '+(inst.chipUnit||'股'):r[0]>cutoff?'法人：下一交易日可見':'法人：此日資料缺漏'}`;
   this.tip.style.left=(xx>pw*.5?15:Math.min(w-205,xx+20))+'px';this.tip.hidden=false;
  }
  const r=rows[selected];document.getElementById('ohlcLine').textContent=`${r[0]}　開 ${r[1].toFixed(2)}　高 ${r[2].toFixed(2)}　低 ${r[3].toFixed(2)}　收 ${r[4].toFixed(2)}`;
  for(const period of [5,20,60])document.getElementById('ma'+period).textContent=averages[period][start+selected]?.toFixed(2)||'—';
 }
}
root.TaiguChart=MarketChart;
})(globalThis);
