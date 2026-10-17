(function(root){
'use strict';
const VERSION=1, INITIAL=1000000;
const money=n=>Math.round(n*100)/100;
const fee=n=>Math.max(20,Math.round(n*.001425));
function createMarket(data){
 const maps=Object.fromEntries(Object.entries(data.instruments).map(([k,v])=>[k,new Map(v.rows.map(r=>[r[0],r]))]));
 const date=s=>s.day<0?'2019-12-31':data.calendar[s.day];
 const bar=(id,d)=>maps[id]?.get(d)||null;
 function latest(id,d){const rows=data.instruments[id]?.rows||[];for(let i=rows.length-1;i>=0;i--)if(rows[i][0]<=d)return rows[i];return null;}
 const account=()=>({cash:INITIAL,holdings:{},receivables:[]});
 function record(s,type,text,extra={}){s.log.push({date:date(s),type,text,...extra});}
 function equity(a,d){let v=a.cash+a.receivables.reduce((n,r)=>n+r.amount,0);for(const [id,h]of Object.entries(a.holdings))v+=h.qty*(latest(id,d)?.[4]||0);return money(v);}
 function affordable(cash,price){let q=Math.floor(cash/price);while(q>0&&money(q*price+fee(q*price))>cash)q--;return q;}
 function fill(a,id,side,qty,price){
  if(!Number.isSafeInteger(qty)||qty<1||!Number.isFinite(price)||price<=0)throw Error('交易數量或價格不正確');
  const value=money(qty*price),commission=fee(value),tax=side==='sell'?Math.floor(value*(id==='0050'?.001:.003)):0;
  const h=a.holdings[id]||{qty:0,cost:0};let costBasis,realizedPnl;
  if(side==='buy'){
   const total=money(value+commission);if(total>a.cash)throw Error('開盤價格變動，現金不足，委託未成交');
   a.cash=money(a.cash-total);h.qty+=qty;h.cost=money(h.cost+total);a.holdings[id]=h;
  }else if(side==='sell'){
   if(qty>h.qty)throw Error('持股不足，委託未成交');
   const remainingCost=money(h.cost*(h.qty-qty)/h.qty);costBasis=money(h.cost-remainingCost);realizedPnl=money(value-commission-tax-costBasis);
   a.cash=money(a.cash+value-commission-tax);h.cost=remainingCost;h.qty-=qty;
   if(!h.qty)delete a.holdings[id];
  }else throw Error('未知交易方向');
  return {id,side,qty,price,value,fee:commission,tax,...(side==='sell'?{costBasis,realizedPnl}:{})};
 }
 function corporate(a,d,cb){
  for(const [id,inst] of Object.entries(data.instruments)){
   for(const sp of inst.splits||[])if(sp.date===d&&a.holdings[id]){a.holdings[id].qty*=sp.ratio;cb?.('split',`${inst.name} 1 拆 ${sp.ratio}，持股自動換發`);}
   for(const div of inst.dividends||[])if(div.ex===d&&a.holdings[id]){
    const amount=money(a.holdings[id].qty*div.amount);
    if(!div.pay||div.pay<div.ex)throw Error(`${id} 股利發放日期缺漏`);
    a.receivables.push({id,ex:div.ex,pay:div.pay,amount});cb?.('dividend',`${inst.name} 除息，應收股利 ${amount.toLocaleString('zh-TW')} 元`);
   }
  }
  let paid=0;a.receivables=a.receivables.filter(r=>{if(r.pay<=d){a.cash=money(a.cash+r.amount);paid+=r.amount;return false;}return true;});
  if(paid)cb?.('dividend',`股利入帳 ${money(paid).toLocaleString('zh-TW')} 元`);return paid;
 }
 function fresh(mode='free'){if(!['life','free'].includes(mode))throw Error('未知遊戲模式');return {version:VERSION,mode,...(mode==='life'?{life:{until:-1,openedAt:-1,anchorId:null,windows:0}}:{}),datasetEnd:data.end,day:-1,...account(),benchmark:account(),orders:[],log:[],seen:[],activeEvent:null,stress:24,spent:0,history:[{date:'2019-12-31',player:INITIAL,benchmark:INITIAL}],status:'playing',opening:true};}
 const canTrade=s=>s.status==='playing'&&!s.opening&&!s.activeEvent&&!s.supportGames?.some(g=>g.choice==='pending')&&(s.mode!=='life'||(s.day>=0&&s.day<=s.life.until));
 function openWindow(s,id){if(s.mode!=='life')return;const until=Math.min(s.day+2,data.calendar.length-1);if(s.life.anchorId!==id)s.life.windows++;s.life={...s.life,openedAt:s.day,until:Math.max(s.life.until,until),anchorId:id};}
 function migrateLegacy(s){if(s.mode!==undefined)return s;s.mode='life';s.life={until:Math.min(s.day+2,data.calendar.length-1),openedAt:s.day,anchorId:'legacy-resume',windows:1,eligibleForUnlock:s.status==='playing'};return s;}
 function queue(s,id,side,qty,sizeMode='fixed'){
  if(s.status!=='playing')throw Error('本次冒險已結束');
  if(s.activeEvent)throw Error('請先完成眼前的劇情選擇');
  if(s.mode==='life'&&!canTrade(s))throw Error('人生模式須在事件開放的三個交易日內下委託');
  if(s.day>=data.calendar.length-1)throw Error('已無下一個交易日');
  if(!data.instruments[id]?.tradable)throw Error('大盤指數僅供觀察，不能直接買賣');
  if(!['buy','sell'].includes(side)||!Number.isSafeInteger(qty)||qty<1||qty>100000000)throw Error('請輸入正整數股數');
  if(!['fixed','all'].includes(sizeMode))throw Error('委託數量模式不正確');
  if(s.orders.some(o=>o.id===id))throw Error('同一標的已有委託，請先取消');
  if(s.day>=0&&!bar(id,date(s)))throw Error('本標的今日暫停交易');
  if(side==='sell'&&qty>(s.holdings[id]?.qty||0))throw Error('可賣股數不足');
  const order={id,side,qty,submitted:date(s),...(sizeMode==='all'?{sizeMode}:{})};s.orders.push(order);record(s,'order',`${sizeMode==='all'?'全部':''}${side==='buy'?'買進':'賣出'}委託 ${id} ${sizeMode==='all'?'約 ':''}${qty.toLocaleString()} 股，次日開盤撮合`,order);return order;
 }
 function cancel(s,id){const n=s.orders.length;s.orders=s.orders.filter(o=>o.id!==id);if(n!==s.orders.length)record(s,'cancel',`取消 ${id} 委託`);}
 function finish(s){const v=equity(s,date(s)),b=equity(s.benchmark,date(s));if(v<=0)s.status='bankrupt';else if(s.day===data.calendar.length-1)s.status=data.end<data.target?'awaiting-data':v>b?'won':'lost';}
 function next(s){
  if(s.status!=='playing')return false;if(s.activeEvent)throw Error('請先完成劇情選擇');if(s.supportGames?.some(g=>g.choice==='pending'))throw Error('請先完成支撐線事件選擇');
  if(s.day>=data.calendar.length-1){finish(s);return false;}
  s.day++;const d=date(s);corporate(s,d,(type,t)=>record(s,type,t));
  const paid=corporate(s.benchmark,d);
  if(s.day===0||paid>0||s.benchmark.reinvest){const r=bar('0050',d);if(r){const q=affordable(s.benchmark.cash,r[1]);if(q>0)fill(s.benchmark,'0050','buy',q,r[1]);s.benchmark.reinvest=false;}else s.benchmark.reinvest=true;}
  const pending=s.orders;s.orders=[];
  for(const o of pending){const r=bar(o.id,d);if(!r){record(s,'rejected',`${o.id} 暫停交易，委託取消`,o);continue;}
   try{const qty=o.sizeMode==='all'?(o.side==='buy'?affordable(s.cash,r[1]):s.holdings[o.id]?.qty||0):o.qty;
    if(qty<1)throw Error(o.side==='buy'?'現金不足以買進一股，委託未成交':'已無可賣持股，委託未成交');
    const trade=fill(s,o.id,o.side,qty,r[1]);record(s,'fill',`${o.side==='buy'?'買進':'賣出'} ${o.id} ${trade.qty.toLocaleString()} 股 @ ${r[1].toFixed(2)}`,{...trade,...(o.sizeMode==='all'?{sizeMode:'all'}:{})});}
   catch(e){record(s,'rejected',`${o.id}：${e.message}`,o);}
  }
  s.stress=Math.max(0,Math.min(100,s.stress-1));
  s.history.push({date:d,player:equity(s,d),benchmark:equity(s.benchmark,d)});finish(s);return true;
 }
 function spend(s,amount){if(!Number.isFinite(amount)||amount<0||amount>s.cash)throw Error('現金不足，請先保留生活費');s.cash=money(s.cash-amount);s.spent=money(s.spent+amount);if(s.history.at(-1)?.date===date(s))s.history.at(-1).player=equity(s,date(s));finish(s);}
 function choose(s,event,choice){if(s.activeEvent!==event.id)throw Error('劇情狀態不符');if(!event.choices.includes(choice))throw Error('未知的劇情選項');if(choice.cost)spend(s,choice.cost);s.stress=Math.max(0,Math.min(100,s.stress+(choice.stress||0)));s.seen.push(event.id);s.activeEvent=null;record(s,'story',`${event.title}／${choice.label}${choice.cost?'（支出 '+choice.cost+' 元）':''}`);}
 function trigger(s,events){if(s.activeEvent||s.status!=='playing'||s.opening)return;const d=date(s);const e=events.find(e=>!s.seen.includes(e.id)&&(e.exact?e.date===d:e.date<=d)&&(!e.until||d<=e.until)&&(!e.when||e.when(s)));if(e){s.activeEvent=e.id;openWindow(s,e.id);}}
 function validate(raw){
  if(raw?.supportGames!==undefined&&(!Array.isArray(raw.supportGames)||raw.supportGames.length>100||!raw.supportGames.every((g,i,a)=>g&&data.instruments[g.id]?.tradable&&data.calendar.includes(g.date)&&g.date<=date(raw)&&Number.isSafeInteger(g.taps)&&g.taps>=0&&g.taps<=10000&&typeof g.finished==='boolean'&&(!i||g.date>a[i-1].date)&&(g.choice===undefined||['pending','use','decline'].includes(g.choice))&&(g.choice!=='pending'||(!g.finished&&g.taps===0&&g.date===date(raw)&&i===a.length-1&&raw.mode==='life'&&raw.status==='playing'&&raw.holdings?.[g.id]))&&(g.choice!=='decline'||(g.finished&&g.taps===0)))))throw Error('存檔支撐線紀錄不正確');
  if(raw?.tutorialPending!==undefined&&typeof raw.tutorialPending!=='boolean')throw Error('存檔教學狀態不正確');
  if(!raw||raw.version!==VERSION||raw.datasetEnd!==data.end)throw Error('存檔版本或資料範圍不相容');
  if(raw.mode!==undefined&&!['life','free'].includes(raw.mode))throw Error('存檔模式不正確');
  if(raw.mode==='life'){const l=raw.life;if(!l||!Number.isInteger(l.until)||!Number.isInteger(l.openedAt)||l.openedAt< -1||l.openedAt>raw.day||l.until< -1||l.until>=data.calendar.length||l.until>raw.day+2||!Number.isSafeInteger(l.windows)||l.windows<0||!(l.anchorId===null||typeof l.anchorId==='string'))throw Error('存檔操作期不正確');}
  if(raw.chats!==undefined&&(!Array.isArray(raw.chats)||raw.chats.length>250||!raw.chats.every(c=>c&&typeof c.id==='string'&&typeof c.eventId==='string'&&typeof c.date==='string'&&c.date<=date(raw)&&typeof c.title==='string'&&Array.isArray(c.messages)&&c.messages.length<=12&&c.messages.every(m=>m&&typeof m.speaker==='string'&&typeof m.text==='string'&&m.text.length<=500)&&Array.isArray(c.replies)&&c.replies.length<=4&&c.replies.every(r=>typeof r==='string')&&(c.reply===null||c.replies.includes(c.reply)))))throw Error('存檔群組紀錄不正確');
  if(!Number.isInteger(raw.day)||raw.day< -1||raw.day>=data.calendar.length)throw Error('存檔日期不正確');
  if(!['playing','won','lost','bankrupt','awaiting-data'].includes(raw.status))throw Error('存檔狀態不正確');
  function checkAccount(a){if(!a||!Number.isFinite(a.cash)||a.cash<0||!a.holdings||typeof a.holdings!=='object'||Array.isArray(a.holdings)||!Array.isArray(a.receivables))throw Error('存檔資產不正確');
   for(const[id,h]of Object.entries(a.holdings))if(!data.instruments[id]?.tradable||!Number.isSafeInteger(h.qty)||h.qty<=0||!Number.isFinite(h.cost)||h.cost<0)throw Error('存檔持股不正確');
   for(const r of a.receivables)if(!data.instruments[r.id]||!Number.isFinite(r.amount)||r.amount<0||!/^\d{4}-\d{2}-\d{2}$/.test(r.pay))throw Error('存檔股利不正確');}
  checkAccount(raw);checkAccount(raw.benchmark);
  for(const key of ['log','orders','seen','history'])if(!Array.isArray(raw[key]))throw Error('存檔紀錄不正確');
  if(!raw.log.every(l=>l&&typeof l.date==='string'&&typeof l.type==='string'&&typeof l.text==='string')||!raw.seen.every(id=>typeof id==='string'))throw Error('存檔紀錄內容不正確');
  if(raw.orders.length>4||!raw.orders.every(o=>data.instruments[o.id]?.tradable&&['buy','sell'].includes(o.side)&&Number.isSafeInteger(o.qty)&&o.qty>0&&o.qty<=100000000)||new Set(raw.orders.map(o=>o.id)).size!==raw.orders.length)throw Error('存檔委託不正確');
  if(!raw.orders.every(o=>o.sizeMode===undefined||o.sizeMode==='all'))throw Error('存檔委託模式不正確');
  if(!Number.isFinite(raw.stress)||raw.stress<0||raw.stress>100||!Number.isFinite(raw.spent)||raw.spent<0||typeof raw.opening!=='boolean'||!(raw.activeEvent===null||typeof raw.activeEvent==='string'))throw Error('存檔劇情不正確');
  if(!raw.history.every(h=>h&&typeof h.date==='string'&&Number.isFinite(h.player)&&Number.isFinite(h.benchmark))||raw.history.length!==raw.day+2)throw Error('存檔績效不正確');
  return JSON.parse(JSON.stringify(raw));
 }
 function visibleRows(s,id){return data.instruments[id].rows.filter(r=>r[0]<=date(s));}
 function chipCutoff(s){return s.day<=0?'2019-12-31':data.calendar[s.day-1];}
 return {data,date,bar,latest,equity,affordable,fresh,queue,cancel,next,choose,trigger,validate,visibleRows,chipCutoff,record,finish,spend,canTrade,openWindow,migrateLegacy};
}
root.TaiguEngine={createMarket,fee,money,INITIAL,VERSION};
})(globalThis);
