(function(root){
'use strict';
const COOLDOWN=30,SUPPORT_RULE={marketDrop:.02,institutionalSell:100e8};
// Inclusive thresholds tolerate only floating-point roundoff, not a smaller fall.
const fellAtLeast=(change,threshold)=>change<=-threshold+1e-10;
const reactionLines={
 "smug": [
  {
   "title": "台股，簡單！",
   "text": "股票就是買低賣高，台股，簡單！我是不是終於找到財富自由的捷徑了？"
  },
  {
   "title": "本多終勝",
   "text": "本金如果再多一點，這個獲利數字後面就能再多一個零……先別急著算退休日期。"
  },
  {
   "title": "這次不一樣",
   "text": "這次有做功課，這次有抓到行情，這次應該真的輪到我了吧！"
  }
 ],
 "panic": [
  {
   "title": "獲利去哪裡了？",
   "text": "剛剛不是還好好的嗎？我只是去倒杯水，怎麼連心情都一起跳空了。"
  },
  {
   "title": "一張不賣，奇蹟自來",
   "text": "嘴上說長期投資，手卻一直在按重新整理。奇蹟，今天有排到我的號碼嗎？"
  },
  {
   "title": "別人恐懼我貪婪，別人小虧我破產",
   "text": "群組叫大家冷靜。我也想冷靜，可是我的持股比冷氣還綠。"
  }
 ],
 "serious": [
  {
   "title": "現在買入一定爆賺",
   "text": "別人看到下跌，我看到機會。嗯……這句話上一輪好像也講過。"
  },
  {
   "title": "這次不一樣",
   "text": "空手看它一路跌，感覺自己已經贏了。等等，我還沒買，怎麼連獲利都算好了？"
  },
  {
   "title": "股票就是買低賣高，台股，簡單！",
   "text": "現在價格比較低，所以只剩下「之後會漲」這個小問題還沒解決。"
  }
 ]
};
const reactionLine=(kind,day)=>reactionLines[kind][Math.max(0,Math.floor(day))%reactionLines[kind].length];
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
 function marketTrend(s){
  const rows=market.visibleRows(s,'TAIEX'),last=rows.at(-1),previous=rows.at(-2);let direction=0,streak=0;
  for(let i=rows.length-1;i>0;i--){const sign=Math.sign(rows[i][4]-rows[i-1][4]);if(!sign||direction&&sign!==direction)break;direction=sign;streak++;}
  const windowReturn=rows.length>=6?(last[4]/rows.at(-6)[4]-1)*100:null;
  return {direction,streak,windowReturn,price:last?.[4]??null,dailyChange:last&&previous?last[4]-previous[4]:0};
 }
 function reaction(s,selected){
  const trend=marketTrend(s),held=Object.values(s.holdings).some(h=>h.qty>0),direction=trend.direction>0?'上漲':trend.direction<0?'下跌':'平盤';
  const tag='加權指數 · '+(trend.streak?'連續 '+trend.streak+' 個交易日'+direction:'尚無連續漲跌')+(trend.windowReturn===null?'':' · 近 5 日 '+(trend.windowReturn>=0?'+':'')+trend.windowReturn.toFixed(2)+'%'),base={id:'TAIEX',...trend,tag};
  if(trend.streak>=5&&trend.direction<0)return {...base,kind:held?'panic':'serious',emotion:held?2:'serious',...reactionLine(held?'panic':'serious',s.day)};
  if(trend.streak>=5&&trend.direction>0){if(held)return {...base,kind:'smug',emotion:4,...reactionLine('smug',s.day)};return {...base,kind:'fomo',emotion:2,title:'怎麼又沒上車？',text:['大盤連漲五天，群組又在貼獲利圖。我的現金很安全，心情就不好說了。','股票就是買低賣高……可是我連低點的車門都沒摸到。','這次不一樣？每次我還沒上車，行情就開始不一樣。'][Math.max(0,s.day)%3]};}
  if(held)return {...base,kind:'watch',emotion:0,title:'大盤還在拉鋸，先看一下。',text:'一下紅、一下綠，還沒走出連續五天的方向。先把下單的手收回來。'};
  return {...base,kind:'cash',emotion:0,title:'錢還在口袋，手卻有點癢。',text:['今天先看，不急著證明自己。','少買一張，會不會就少了一次財富自由？','群組又貼獲利圖了。我的現金也還好好的。'][Math.max(0,s.day)%3]};
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
 return {adjustedRows,position,holding,marketTrend,reaction,supportCandidate,begin,decide,pending,finish};
}
const duration={zoom:1200,play:6000,break:900,settle:500},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function phase(ms){return ms<duration.zoom?'zoom':ms<duration.zoom+duration.play?'play':ms<duration.zoom+duration.play+duration.break?'break':'result';}
function visualPrice(ms,row,energy=0,breakStart=null){const open=row[1],low=row[3],close=row[4],range=open-low;if(ms<duration.zoom)return open;const play=(ms-duration.zoom)/duration.play;if(play<1){const fall=clamp(play/.28,0,1),fallEase=1-Math.pow(1-fall,3),lift=.12*clamp(energy,0,100)/100*clamp((play-.28)/.12,0,1);return clamp(open-range*Math.max(0,.73*fallEase-lift),low,open);}const t=(ms-duration.zoom-duration.play)/duration.break;if(t<1){const from=breakStart??(open-range*.73);return from+(low-from)*t*t;}const settle=clamp((ms-duration.zoom-duration.play-duration.break)/duration.settle,0,1);return low+(close-low)*settle;}
const titleQuotes=[{text:'股票就是買低賣高，台股，簡單！',emotion:4},{text:'一張不賣，奇蹟自來',emotion:1},{text:'別人恐懼我貪婪，別人小虧我破產',emotion:2},{text:'本多終勝',emotion:4},{text:'這次不一樣',emotion:'serious'}];
function quips(random=Math.random){let pool=[],last=null;return ()=>{if(!pool.length){pool=titleQuotes.slice();for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}if(pool.at(-1)===last)[pool[0],pool[pool.length-1]]=[pool.at(-1),pool[0]];}last=pool.pop();return last;};}
root.TaiguTheatre={create,COOLDOWN,SUPPORT_RULE,duration,phase,visualPrice,titleQuotes,quips,reactionLines};
})(globalThis);
