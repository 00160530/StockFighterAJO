(function(root){
'use strict';
const COOLDOWN=30,threshold=.08;
function create(market){
 const data=market.data;
 function adjustedRows(s,id){const d=market.date(s),splits=(data.instruments[id]?.splits||[]).filter(sp=>sp.date<=d);return market.visibleRows(s,id).map(raw=>{const r=raw.slice();for(const sp of splits)if(r[0]<sp.date)for(let k=1;k<=4;k++)r[k]/=sp.ratio;return r;});}
 function position(s,id){
  const h=s.holdings[id];if(!h)return null;const d=market.date(s),trades=s.log.filter(l=>l.type==='fill'&&l.id===id&&l.date<=d);let firstBuy=null,lastBuy=null,qty=0,si=0;const splits=(data.instruments[id].splits||[]).filter(sp=>sp.date<=d).slice().sort((a,b)=>a.date.localeCompare(b.date));
  for(const t of trades){while(si<splits.length&&splits[si].date<=t.date)qty*=splits[si++].ratio;if(t.side==='buy'){if(qty===0)firstBuy=t.date;lastBuy=t;qty+=t.qty;}else{qty=Math.max(0,qty-t.qty);if(!qty){firstBuy=null;lastBuy=null;}}}
  let entry=lastBuy?.price||h.cost/h.qty;for(const sp of splits)if(lastBuy&&lastBuy.date<sp.date)entry/=sp.ratio;
  const price=market.latest(id,d)?.[4]||0;return {id,name:data.instruments[id].name,price,entry,firstBuy,lastBuy:lastBuy?.date||null,returnPct:entry>0?(price/entry-1)*100:0,basis:lastBuy?'最近買進':'含費均價'};
 }
 function holding(s,selected){return position(s,selected)||Object.keys(s.holdings).map(id=>position(s,id)).sort((a,b)=>(b.lastBuy||'').localeCompare(a.lastBuy||''))[0]||null;}
 function reaction(s,selected){
  const h=holding(s,selected);if(h){const tag=h.id+' '+h.name+' · '+h.basis+' '+h.entry.toFixed(2)+' → '+h.price.toFixed(2)+' · '+(h.returnPct>=0?'+':'')+h.returnPct.toFixed(2)+'%';
   if(h.price>h.entry*1.05)return {...h,kind:'smug',emotion:4,title:'台股，簡單！',text:'我就知道這次有做功課……應該不是剛好遇到行情吧？',tag};
   if(h.price<h.entry*.95)return {...h,kind:'panic',emotion:2,title:'獲利去哪裡了？',text:'剛剛不是還好好的嗎？我只是去倒杯水，怎麼連心情都一起跳空了。',tag};
   return {...h,kind:'watch',emotion:0,title:h.returnPct>=0?'先讓它走一下，我有在看。':'我只是暫時，還沒被市場理解。',text:'股價每天都在換表情。我先看看這段走勢，再想下一次事件要怎麼做。',tag};
  }
  const id=data.instruments[selected]?.tradable?selected:'0050',rows=adjustedRows(s,id),r=rows.at(-1),a=rows.at(-2),b=rows.at(-3),fall=r&&a&&b&&r[4]<a[4]&&a[4]<b[4]&&r[4]/b[4]-1<=-.02,tag='空手觀察 · '+id+' '+data.instruments[id].name+(r?' · 現價 '+r[4].toFixed(2):'');
  if(fall)return {id,kind:'serious',emotion:'serious',title:'現在買入一定爆賺',text:'別人看到下跌，我看到機會。嗯……這句話上一輪好像也講過。',tag};
  return {id,kind:'cash',emotion:0,title:'錢還在口袋，手卻有點癢。',text:['今天先看，不急著證明自己。','少買一張，會不會就少了一次財富自由？','群組又貼獲利圖了。我的現金也還好好的。'][Math.max(0,s.day)%3],tag};
 }
 function supportCandidate(s,selected){
  if(s.mode!=='life'||s.day<2||s.status!=='playing'||s.opening)return null;const played=s.supportGames||[],last=played.at(-1);if(last&&s.day-data.calendar.indexOf(last.date)<COOLDOWN)return null;
  const ids=[selected,...Object.keys(s.holdings)].filter((id,i,a)=>s.holdings[id]&&a.indexOf(id)===i),expected=data.calendar.slice(s.day-2,s.day+1);
  for(const id of ids){const p=position(s,id),rows=adjustedRows(s,id),tail=rows.slice(-3);if(tail.length!==3||tail.some((r,i)=>r[0]!==expected[i])||!p.firstBuy||p.firstBuy>tail[0][0])continue;
   const [a,b,c]=tail,one=b[4]/a[4]-1,two=c[4]/b[4]-1,drop=c[4]/a[4]-1;if(one<=-.02&&two<=-.02&&drop<=-threshold&&c[4]<c[1])return {id,name:p.name,date:market.date(s),drop,rows:rows.slice(-24).map(r=>r.slice()),entry:p.entry};
  }return null;
 }
 function begin(s,candidate){const row={id:candidate.id,date:candidate.date,taps:0,finished:false};(s.supportGames??=[]).push(row);return row;}
 function finish(s,row,taps){row.taps=Math.max(0,Math.min(10000,Math.floor(taps)||0));row.finished=true;market.record(s,'minigame','手指支撐線！／'+row.id+'／連點 '+row.taps+' 次，支撐還是破了。',{id:row.id,taps:row.taps});}
 return {adjustedRows,position,holding,reaction,supportCandidate,begin,finish};
}
const duration={zoom:1200,play:6000,break:900,settle:500},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function phase(ms){return ms<duration.zoom?'zoom':ms<duration.zoom+duration.play?'play':ms<duration.zoom+duration.play+duration.break?'break':'result';}
function visualPrice(ms,row,energy=0,breakStart=null){const open=row[1],low=row[3],close=row[4],range=open-low;if(ms<duration.zoom)return open;const play=(ms-duration.zoom)/duration.play;if(play<1)return clamp(open-range*.82*play+range*.36*clamp(energy,0,100)/100,low,open);const t=(ms-duration.zoom-duration.play)/duration.break;if(t<1)return (breakStart??(open-range*.82))+(low-(breakStart??(open-range*.82)))*(1-Math.pow(1-t,3));const settle=clamp((ms-duration.zoom-duration.play-duration.break)/duration.settle,0,1);return low+(close-low)*settle;}
const titleQuotes=[{text:'股票就是買低賣高，台股，簡單！',emotion:4},{text:'一張不賣，奇蹟自來',emotion:1},{text:'別人恐懼我貪婪，別人小虧我破產',emotion:2},{text:'本多終勝',emotion:4},{text:'這次不一樣',emotion:'serious'}];
function quips(random=Math.random){let pool=[],last=null;return ()=>{if(!pool.length){pool=titleQuotes.slice();for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}if(pool.at(-1)===last)[pool[0],pool[pool.length-1]]=[pool.at(-1),pool[0]];}last=pool.pop();return last;};}
root.TaiguTheatre={create,COOLDOWN,duration,phase,visualPrice,titleQuotes,quips};
})(globalThis);
