(function(root){
'use strict';
const COOLDOWN=30,SUPPORT_RULE={marketDrop:.02,institutionalSell:100e8};
// Inclusive thresholds tolerate only floating-point roundoff, not a smaller fall.
const fellAtLeast=(change,threshold)=>change<=-threshold+1e-10;
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
 function supportContext(s,id){
  if(s.mode!=='life'||s.day<1||s.status!=='playing'||s.opening||!s.holdings[id])return null;
  const date=market.date(s),previous=data.calendar[s.day-1],chipDate=market.chipCutoff(s),chips=data.instruments.TAIEX?.chips?.[chipDate];
  if(chipDate!==previous||!chips||!['foreign','trust','dealer'].every(k=>Number.isFinite(chips[k])))return null;
  const institutionalNet=chips.foreign+chips.trust+chips.dealer,index=market.visibleRows(s,'TAIEX').slice(-2);
  if(index.length!==2||index[0][0]!==previous||index[1][0]!==date)return null;const marketDrop=index[1][4]/index[0][4]-1;
  if(!fellAtLeast(marketDrop,SUPPORT_RULE.marketDrop)||institutionalNet> -SUPPORT_RULE.institutionalSell)return null;
  const p=position(s,id),rows=adjustedRows(s,id),a=rows.at(-2),b=rows.at(-1);
  if(!a||a[0]!==previous||b[0]!==date||!p.firstBuy||p.firstBuy>previous||b[4]>=a[4]||b[4]>=b[1])return null;
  return {id,name:p.name,date,drop:b[4]/a[4]-1,marketDrop,chipDate,institutionalNet,rows:rows.slice(-24).map(r=>r.slice()),entry:p.entry};
 }
 function supportCandidate(s,selected){
  const last=s.supportGames?.at(-1);if(last&&s.day-data.calendar.indexOf(last.date)<COOLDOWN)return null;
  for(const id of [selected,...Object.keys(s.holdings)].filter((id,i,a)=>s.holdings[id]&&a.indexOf(id)===i)){const candidate=supportContext(s,id);if(candidate)return candidate;}return null;
 }
 function begin(s,candidate){const row={id:candidate.id,date:candidate.date,taps:0,finished:false,choice:'pending'};(s.supportGames??=[]).push(row);return row;}
 function decide(s,row,use){if(row.choice!=='pending'||row.finished)throw Error('支撐線事件已選擇');row.choice=use?'use':'decline';market.record(s,'minigame-choice','賣壓來了！／'+row.id+'／'+(use?'沒辦法，只好使出那招了！手指支撐線！':'讓它跌吧。'),{id:row.id,choice:row.choice});if(!use)row.finished=true;}
 function pending(s){const row=s.supportGames?.at(-1);if(row?.choice!=='pending'||row.finished||row.date!==market.date(s))return null;const candidate=supportContext(s,row.id);return candidate?{row,candidate}:null;}
 function finish(s,row,taps){if(row.choice!==undefined&&row.choice!=='use')throw Error('尚未選擇使用手指支撐線');row.taps=Math.max(0,Math.min(10000,Math.floor(taps)||0));row.finished=true;market.record(s,'minigame','手指支撐線！／'+row.id+'／連點 '+row.taps+' 次，支撐還是破了。',{id:row.id,taps:row.taps});}
 return {adjustedRows,position,holding,reaction,supportCandidate,begin,decide,pending,finish};
}
const duration={zoom:1200,play:6000,break:900,settle:500},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function phase(ms){return ms<duration.zoom?'zoom':ms<duration.zoom+duration.play?'play':ms<duration.zoom+duration.play+duration.break?'break':'result';}
function visualPrice(ms,row,energy=0,breakStart=null){const open=row[1],low=row[3],close=row[4],range=open-low;if(ms<duration.zoom)return open;const play=(ms-duration.zoom)/duration.play;if(play<1){const fall=clamp(play/.28,0,1),fallEase=1-Math.pow(1-fall,3),lift=.12*clamp(energy,0,100)/100*clamp((play-.28)/.12,0,1);return clamp(open-range*Math.max(0,.73*fallEase-lift),low,open);}const t=(ms-duration.zoom-duration.play)/duration.break;if(t<1){const from=breakStart??(open-range*.73);return from+(low-from)*t*t;}const settle=clamp((ms-duration.zoom-duration.play-duration.break)/duration.settle,0,1);return low+(close-low)*settle;}
const titleQuotes=[{text:'股票就是買低賣高，台股，簡單！',emotion:4},{text:'一張不賣，奇蹟自來',emotion:1},{text:'別人恐懼我貪婪，別人小虧我破產',emotion:2},{text:'本多終勝',emotion:4},{text:'這次不一樣',emotion:'serious'}];
function quips(random=Math.random){let pool=[],last=null;return ()=>{if(!pool.length){pool=titleQuotes.slice();for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}if(pool.at(-1)===last)[pool[0],pool[pool.length-1]]=[pool.at(-1),pool[0]];}last=pool.pop();return last;};}
root.TaiguTheatre={create,COOLDOWN,SUPPORT_RULE,duration,phase,visualPrice,titleQuotes,quips};
})(globalThis);
