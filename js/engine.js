(function(root){
'use strict';
const VERSION=1, INITIAL=1000000, MARGIN={loanRatio:.6,annualRate:.0625,minimum:130,restore:166};
const money=n=>Math.round(n*100)/100;
const fee=n=>Math.max(20,Math.round(n*.001425));
function createMarket(data){
 const maps=Object.fromEntries(Object.entries(data.instruments).map(([k,v])=>[k,new Map(v.rows.map(r=>[r[0],r]))]));
 const date=s=>s.day<0?'2019-12-31':data.calendar[s.day];
 const bar=(id,d)=>maps[id]?.get(d)||null;
 function latest(id,d){const rows=data.instruments[id]?.rows||[];for(let i=rows.length-1;i>=0;i--)if(rows[i][0]<=d)return rows[i];return null;}
 const stamps=new Map();
 function datasetStamp(end){if(stamps.has(end))return stamps.get(end);const parts=[data.calendar.filter(d=>d<=end)];for(const id of Object.keys(data.instruments).sort()){const i=data.instruments[id];parts.push([id,i.rows.filter(r=>r[0]<=end),(i.splits||[]).filter(x=>x.date<=end),(i.dividends||[]).filter(x=>x.ex<=end),Object.keys(i.chips||{}).filter(d=>d<=end).sort().map(d=>[d,i.chips[d]])]);}const text=JSON.stringify(parts);let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}const stamp=(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');stamps.set(end,stamp);return stamp;}
 function stamp(s){s.datasetPrefix=datasetStamp(s.datasetEnd);return s;}
 const account=()=>({cash:INITIAL,holdings:{},receivables:[]});
 function record(s,type,text,extra={}){s.log.push({date:date(s),type,text,...extra});}
 function equity(a,d){let v=a.cash+a.receivables.reduce((n,r)=>n+r.amount,0);for(const [id,h]of Object.entries(a.holdings))v+=h.qty*(latest(id,d)?.[4]||0);if(a.margin)v+=a.margin.collateral-Object.values(a.margin.positions).reduce((n,p)=>n+p.principal+p.interest,0);if(a.skills)v-=(a.skills.loans||[]).reduce((n,l)=>n+l.remaining,0);return money(v);}
 function affordable(cash,price){let q=Math.floor(cash/price);while(q>0&&money(q*price+fee(q*price))>cash)q--;return q;}
 function fill(a,id,side,qty,price){
  if(!Number.isSafeInteger(qty)||qty<1||!Number.isFinite(price)||price<=0)throw Error('交易數量或價格不正確');
  const value=money(qty*price),commission=fee(value),tax=side==='sell'?Math.floor(value*(id==='0050'?.001:.003)):0;
  const h=a.holdings[id]||{qty:0,cost:0};let costBasis,realizedPnl;
  if(side==='buy'){
   const total=money(value+commission);if(total>a.cash)throw Error('開盤價格變動，現金不足，委託未成交');
   a.cash=money(a.cash-total);h.qty+=qty;h.cost=money(h.cost+total);a.holdings[id]=h;
  }else if(side==='sell'){
   const credit=a.margin?.positions[id],cashQty=h.qty-(credit?.qty||0),cashCost=money(h.cost-(credit?.cost||0));
   if(qty>cashQty)throw Error('現股持股不足，請切換融資賣出');
   const remainingCost=money(cashCost*(cashQty-qty)/cashQty);costBasis=money(cashCost-remainingCost);realizedPnl=money(value-commission-tax-costBasis);
   a.cash=money(a.cash+value-commission-tax);h.cost=money(remainingCost+(credit?.cost||0));h.qty-=qty;
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
 const startIndex=s=>data.calendar.indexOf(s.startDate||data.calendar[0]);
 const beforeStart=s=>s.day<startIndex(s);
 const sessions=s=>Math.max(0,s.day-startIndex(s)+1);
 function fresh(mode='free',marginEnabled=false,skillLevels=null,options={}){if(!['life','free'].includes(mode))throw Error('未知遊戲模式');const custom=options.startDate!=null,index=custom?data.calendar.indexOf(options.startDate):0;if(index<0||custom&&(!options.unlocked||mode==='life'&&!options.lifeCompleted))throw Error('自訂日期須先解鎖技能，人生模式還須完成一輪');const s={version:VERSION,mode,...(mode==='life'?{life:{until:-1,openedAt:-1,anchorId:null,windows:0}}:{}),startDate:data.calendar[index],...(custom?{customStartDate:data.calendar[index]}:{}),datasetEnd:data.end,datasetPrefix:datasetStamp(data.end),playTimeMs:0,playTimePartial:false,day:index-1,...account(),benchmark:account(),orders:[],log:[],seen:[],activeEvent:null,stress:24,spent:0,history:[{date:index?data.calendar[index-1]:'2019-12-31',player:INITIAL,benchmark:INITIAL}],status:'playing',opening:!custom};if(marginEnabled)enableMargin(s);if(skillLevels)enableSkills(s,skillLevels);if(custom)record(s,'custom-start','自訂起始日期：'+s.startDate,{startDate:s.startDate});return s;}
 function enableSkills(s,levels={}){if(s.status==='playing'&&!s.skills){const selected={};for(const[id,max]of Object.entries({mother:5,vip:5,divination:3,calendar:5})){if(!Number.isInteger(levels[id]??0)||(levels[id]??0)<0||(levels[id]??0)>max)throw Error('技能等級不正確');selected[id]=levels[id]||0;}s.skills={version:1,levels:selected,motherUsed:0,vipUsed:0,calendarUsed:0,totalRepaid:0,forecasts:[],loans:[]};}return s.skills;}
 function skillInfo(s){const k=s.skills;return {levels:k?.levels||{mother:0,vip:0,divination:0},calendarRemaining:Math.max(0,(k?.levels.calendar||0)-(k?.calendarUsed||0)),motherUsed:k?.motherUsed||0,vipUsed:k?.vipUsed||0,totalRepaid:k?.totalRepaid||0,motherRemaining:Math.max(0,(k?.levels.mother||0)*200000-(k?.motherUsed||0)),vipRemaining:Math.max(0,(k?.levels.vip||0)*200000-(k?.vipUsed||0)),divinationRemaining:Math.max(0,(k?.levels.divination||0)-(k?.forecasts.length||0)),debt:money((k?.loans||[]).reduce((n,l)=>n+l.remaining,0))};}
 function skillReady(s){if(s.status!=='playing'||s.opening||s.day<0||!s.skills)throw Error('現在不能使用技能');}
 function sixMonthsLater(d){const date=new Date(d+'T00:00:00Z'),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+6);const year=date.getUTCFullYear(),month=date.getUTCMonth(),last=new Date(Date.UTC(year,month+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));return date.toISOString().slice(0,10);}
 function addSkillLoan(s,kind,amount,due){const prior=s.skills.loans.find(l=>l.kind===kind&&l.date===date(s)&&l.due===due);if(prior){prior.principal=money(prior.principal+amount);prior.remaining=money(prior.remaining+amount);}else s.skills.loans.push({kind,date:date(s),due,principal:amount,remaining:amount});}
 function borrowMother(s,amount){skillReady(s);const i=skillInfo(s);if(!Number.isFinite(amount)||amount<1||money(amount)!==amount||amount>i.motherRemaining)throw Error('借款超過媽媽10塊的剩餘額度，或金額不正確');const due=sixMonthsLater(date(s));s.cash=money(s.cash+amount);s.skills.motherUsed=money(s.skills.motherUsed+amount);addSkillLoan(s,'mother',amount,due);record(s,'skill-loan','媽媽10塊：借到 '+amount.toLocaleString('zh-TW')+' 元，'+due+' 到期還款',{amount,due});return {amount,due};}
 function useVIP(s){skillReady(s);const i=skillInfo(s),m=marginInfo(s);if(!m.call)throw Error('只有追繳期間可以使用VIP代墊');if(m.requiredTopup<=0||m.requiredTopup>i.vipRemaining)throw Error('VIP剩餘額度不足以補到約 166.67%');const amount=m.requiredTopup;s.skills.vipUsed=money(s.skills.vipUsed+amount);addSkillLoan(s,'vip',amount,'settlement');s.margin.collateral=money(s.margin.collateral+amount);s.margin.totalTopups=money(s.margin.totalTopups+amount);record(s,'skill-vip','林北VIP拉：「我認識你們老闆！」券商代墊 '+amount.toLocaleString('zh-TW')+' 元保證金',{amount});marginCheck(s);return amount;}
 function divine(s,id){skillReady(s);if(!data.instruments[id]||skillInfo(s).divinationRemaining<1)throw Error('奇門遁甲次數已用完，或標的不正確');const future=data.calendar.slice(s.day+1,s.day+11);if(!future.length)throw Error('已無可預測的交易日');let previous=latest(id,date(s))?.[4],up=0,down=0,flat=0,suspended=0;for(const d of future){for(const sp of data.instruments[id].splits||[])if(sp.date===d)previous/=sp.ratio;const r=bar(id,d);if(!r){flat++;suspended++;continue;}if(r[4]>previous+1e-8)up++;else if(r[4]<previous-1e-8)down++;else flat++;previous=r[4];}const result={date:date(s),id,days:future.length,up,down,flat,suspended};s.skills.forecasts.push(result);record(s,'skill-divination','奇門遁甲：'+id+' 未來 '+result.days+' 個交易日，上漲 '+up+' 日、下跌 '+down+' 日、平盤 '+flat+' 日');return result;}
 function sellForSkillDebt(s,needed,atClose){for(const[id,h]of Object.entries(s.holdings)){const r=bar(id,date(s)),cashQty=available(s,id);if(!r||!cashQty||s.cash>=needed)continue;const price=r[atClose?4:1],proceeds=q=>money(q*price-fee(money(q*price))-Math.floor(money(q*price)*(id==='0050'?.001:.003)));let lo=1,hi=cashQty;if(proceeds(hi)>=needed-s.cash)while(lo<hi){const q=Math.floor((lo+hi)/2);if(proceeds(q)>=needed-s.cash)hi=q;else lo=q+1;}else lo=hi;const t=fill(s,id,'sell',lo,price);record(s,'fill','技能借款到期：出售現股 '+id+' 還款',{...t,forced:true});}
  if(s.cash<needed)for(const[id,p]of Object.entries(s.margin?.positions||{})){const r=bar(id,date(s));if(!r)continue;const t=marginFill(s,id,'sell',p.qty,r[atClose?4:1],true);record(s,'fill','技能借款到期：出售融資持股 '+id+' 還款',t);if(s.cash>=needed)break;}
 }
 function repaySkillLoans(s,all=false,atClose=false){if(!s.skills)return;const due=s.skills.loans.filter(l=>l.remaining>0&&(all||(l.kind==='mother'&&l.due<=date(s))||(l.kind==='vip'&&!Object.keys(s.margin?.positions||{}).length)));if(!due.length)return;const needed=money(due.reduce((n,l)=>n+l.remaining,0));if(s.cash<needed)sellForSkillDebt(s,needed,atClose);for(const l of due){const amount=l.remaining;l.remaining=0;s.cash=money(s.cash-amount);s.skills.totalRepaid=money(s.skills.totalRepaid+amount);record(s,'skill-repay',(l.kind==='mother'?'媽媽10塊':'VIP代墊')+'：'+(all?'本輪結算':'到期')+'還款 '+amount.toLocaleString('zh-TW')+' 元',{amount,kind:l.kind});if(s.cash<0&&!s.bankruptcyReason)s.bankruptcyReason=l.kind==='mother'?'mother-debt':'margin-debt';}}
 function enableMargin(s){if(s.status==='playing'&&!s.margin)s.margin={version:1,enabled:true,positions:{},collateral:0,totalBorrowed:0,totalInterest:0,interestPaid:0,totalTopups:0,liquidations:0,call:null};return s.margin;}
 function marginInfo(s,d=date(s)){const m=s.margin,positions=Object.entries(m?.positions||{}),principal=money(positions.reduce((n,[,p])=>n+p.principal,0)),interest=money(positions.reduce((n,[,p])=>n+p.interest,0)),value=money(positions.reduce((n,[id,p])=>n+p.qty*(latest(id,d)?.[4]||0),0)),collateral=m?.collateral||0;return {enabled:!!m?.enabled,principal,interest,value,collateral,maintenance:principal?(value+collateral)/principal*100:null,requiredTopup:principal?Math.max(0,Math.ceil((principal/.6-value-collateral)*100-1e-6)/100):0,call:m?.call||null,totalBorrowed:m?.totalBorrowed||0,totalInterest:m?.totalInterest||0,interestPaid:m?.interestPaid||0,totalTopups:m?.totalTopups||0,liquidations:m?.liquidations||0};}
 function available(s,id,financing='cash'){return financing==='margin'?(s.margin?.positions[id]?.qty||0):(s.holdings[id]?.qty||0)-(s.margin?.positions[id]?.qty||0);}
 function marginAffordable(cash,price){if(!Number.isFinite(cash)||cash<=0||!Number.isFinite(price)||price<=0)return 0;let lo=0,hi=Math.min(100000000,Math.floor(cash/(price*.4)));while(lo<hi){const q=Math.ceil((lo+hi)/2),value=money(q*price),own=money(value-money(value*.6)+fee(value));if(own<=cash)lo=q;else hi=q-1;}return lo;}
 function marginFill(s,id,side,qty,price,forced=false){
  const m=s.margin;if(!m?.enabled)throw Error('融資尚未解鎖');if(!Number.isSafeInteger(qty)||qty<1||!Number.isFinite(price)||price<=0)throw Error('融資數量或價格不正確');
  const value=money(qty*price),commission=fee(value),tax=side==='sell'?Math.floor(value*(id==='0050'?.001:.003)):0,h=s.holdings[id]||{qty:0,cost:0},p=m.positions[id]||{qty:0,cost:0,principal:0,interest:0};let costBasis,realizedPnl,borrowed=0,repaid=0,interestPaid=0;
  if(side==='buy'){if(m.call)throw Error('追繳期間不能新增融資');borrowed=money(value*.6);const own=money(value-borrowed+commission);if(own>s.cash)throw Error('開盤價格變動，融資自備款不足，委託未成交');s.cash=money(s.cash-own);h.qty+=qty;h.cost=money(h.cost+value+commission);p.qty+=qty;p.cost=money(p.cost+value+commission);p.principal=money(p.principal+borrowed);const firstDay=money(borrowed*MARGIN.annualRate/365);p.interest=money(p.interest+firstDay);m.totalInterest=money(m.totalInterest+firstDay);m.totalBorrowed=money(m.totalBorrowed+borrowed);s.holdings[id]=h;m.positions[id]=p;
  }else if(side==='sell'){if(qty>p.qty)throw Error('融資持股不足');const ratio=qty/p.qty,stockCost=qty===p.qty?p.cost:money(p.cost*ratio);repaid=qty===p.qty?p.principal:money(p.principal*ratio);interestPaid=qty===p.qty?p.interest:money(p.interest*ratio);costBasis=money(stockCost+interestPaid);realizedPnl=money(value-commission-tax-costBasis);s.cash=money(s.cash+value-commission-tax-repaid-interestPaid);h.qty-=qty;h.cost=money(h.cost-stockCost);p.qty-=qty;p.cost=money(p.cost-stockCost);p.principal=money(p.principal-repaid);p.interest=money(p.interest-interestPaid);m.interestPaid=money(m.interestPaid+interestPaid);if(!p.qty)delete m.positions[id];if(!h.qty)delete s.holdings[id];if(!Object.keys(m.positions).length){s.cash=money(s.cash+m.collateral);m.collateral=0;m.call=null;}
  }else throw Error('未知交易方向');
  return {id,side,qty,price,value,fee:commission,tax,financing:'margin',borrowed,repaid,interestPaid,...(forced?{forced:true}:{}),...(side==='sell'?{costBasis,realizedPnl}:{})};
 }
 function accrueMargin(s,previous){if(!s.margin)return;const days=Math.max(1,Math.round((Date.parse(date(s))-Date.parse(previous))/86400000));for(const p of Object.values(s.margin.positions)){const interest=money(p.principal*MARGIN.annualRate*days/365);p.interest=money(p.interest+interest);s.margin.totalInterest=money(s.margin.totalInterest+interest);}}
 function marginCheck(s){const m=s.margin;if(!m)return;const info=marginInfo(s),call=m.call;
  if(!info.principal||info.maintenance+1e-8>=MARGIN.restore||call&&Number.isFinite(call.noticeTopup)&&call.paidTopup+1e-8>=call.noticeTopup){if(call)record(s,'margin-cleared','融資追繳解除，維持率達 166% 或已繳足通知差額');m.call=null;return;}
  if(!call){if(info.maintenance<MARGIN.minimum){m.call={startedDay:s.day,ackDay:-1,noticeTopup:info.requiredTopup,paidTopup:0,deferred:false};record(s,'margin-call','維持率 '+info.maintenance.toFixed(2)+'%，收到融資追繳令；兩個交易日內補繳，期滿仍低於 130% 才於次日處分');}return;}
  if(s.day-call.startedDay>=2){if(info.maintenance+1e-8>=MARGIN.minimum){if(!call.deferred)record(s,'margin-deferred','維持率回升至 130% 以上，暫不處分；追繳紀錄仍保留');call.deferred=true;delete call.disposeDay;}else call.disposeDay=s.day+1;}
 }
 function marginNeedsAction(s){const c=s.margin?.call;return s.status==='playing'&&!!c&&marginInfo(s).maintenance<MARGIN.minimum&&c.ackDay!==s.day;}
 function acknowledgeMargin(s){if(!marginNeedsAction(s))throw Error('目前沒有待處理的追繳通知');s.margin.call.ackDay=s.day;record(s,'margin-response','追繳第 '+(s.day-s.margin.call.startedDay+1)+' 天：暫不補繳，繼續觀察；回升至 130% 可暫緩處分');}
 function topupMargin(s,amount){if(s.status!=='playing'||!s.margin?.call)throw Error('目前沒有融資追繳令');if(!Number.isFinite(amount)||amount<=0||money(amount)!==amount||amount>s.cash)throw Error('補繳金額須為可用現金內的正數，最多兩位小數');s.cash=money(s.cash-amount);s.margin.collateral=money(s.margin.collateral+amount);s.margin.totalTopups=money(s.margin.totalTopups+amount);s.margin.call.paidTopup=money((s.margin.call.paidTopup||0)+amount);record(s,'margin-topup','補繳融資保證金 '+amount.toLocaleString('zh-TW')+' 元');marginCheck(s);return marginInfo(s);}
 function liquidateMargin(s,atClose=false){const m=s.margin;if(!m||!Object.keys(m.positions).length)return;let sold=false;for(const[id,p]of Object.entries(m.positions)){const r=bar(id,date(s));if(!r){record(s,'margin-suspended',id+' 暫停交易，融資處分順延至可交易日');continue;}const t=marginFill(s,id,'sell',p.qty,r[atClose?4:1],true);record(s,'fill','融資斷頭：強制賣出 '+id+' '+t.qty.toLocaleString()+' 股',t);s.orders=s.orders.filter(o=>o.id!==id);sold=true;}if(sold)m.liquidations++;
  if(s.cash<0)for(const[id,h]of Object.entries(s.holdings)){const q=available(s,id),r=bar(id,date(s));if(!q||!r)continue;const t=fill(s,id,'sell',q,r[atClose?4:1]);record(s,'fill','融資清償：出售現股 '+id+' 補還款差額',{...t,forced:true});if(s.cash>=0)break;}
 }
 const canTrade=s=>s.status==='playing'&&!s.opening&&!s.activeEvent&&!s.supportGames?.some(g=>g.choice==='pending')&&(s.mode!=='life'||(!beforeStart(s)&&s.day<=s.life.until));
 function openWindow(s,id){if(s.mode!=='life')return;const until=Math.min(s.day+2,data.calendar.length-1);if(s.life.anchorId!==id)s.life.windows++;s.life={...s.life,openedAt:s.day,until:Math.max(s.life.until,until),anchorId:id};}
 function migrateLegacy(s){if(s.mode!==undefined)return s;s.mode='life';s.life={until:Math.min(s.day+2,data.calendar.length-1),openedAt:s.day,anchorId:'legacy-resume',windows:1,eligibleForUnlock:s.status==='playing'};return s;}
 function queue(s,id,side,qty,sizeMode='fixed',financing='cash'){
  if(s.status!=='playing')throw Error('本次冒險已結束');
  if(s.activeEvent)throw Error('請先完成眼前的劇情選擇');if(marginNeedsAction(s))throw Error('請先處理今天的融資追繳通知');
  if(s.mode==='life'&&!canTrade(s))throw Error('人生模式須在事件開放的三個交易日內下委託');
  if(s.day>=data.calendar.length-1)throw Error('已無下一個交易日');
  if(!data.instruments[id]?.tradable)throw Error('大盤指數僅供觀察，不能直接買賣');
  if(!['buy','sell'].includes(side)||!Number.isSafeInteger(qty)||qty<1||qty>100000000)throw Error('請輸入正整數股數');
  if(!['fixed','all'].includes(sizeMode))throw Error('委託數量模式不正確');
  if(!['cash','margin'].includes(financing)||financing==='margin'&&!s.margin?.enabled)throw Error('融資尚未解鎖或交易方式不正確');
  if(financing==='margin'&&side==='buy'&&s.margin.call)throw Error('請先解除追繳，再新增融資');
  if(s.orders.some(o=>o.id===id))throw Error('同一標的已有委託，請先取消');
  if(s.day>=0&&!beforeStart(s)&&!bar(id,date(s)))throw Error('本標的今日暫停交易');
  if(side==='sell'&&qty>available(s,id,financing))throw Error('可賣股數不足，請確認現股／融資');
  const order={id,side,qty,submitted:date(s),...(financing==='margin'?{financing}:{}),...(sizeMode==='all'?{sizeMode}:{})};s.orders.push(order);record(s,'order',`${sizeMode==='all'?'全部':''}${side==='buy'?'買進':'賣出'}委託 ${id} ${sizeMode==='all'?'約 ':''}${qty.toLocaleString()} 股，次日開盤撮合`,order);return order;
 }
 function cancel(s,id){const n=s.orders.length;s.orders=s.orders.filter(o=>o.id!==id);if(n!==s.orders.length)record(s,'cancel',`取消 ${id} 委託`);}
 function finish(s){if(s.day===data.calendar.length-1||equity(s,date(s))<=0||s.cash<0){if((equity(s,date(s))<=0||s.cash<0)&&s.margin?.totalBorrowed>0&&!s.bankruptcyReason)s.bankruptcyReason='margin-debt';repaySkillLoans(s,true,true);}const v=equity(s,date(s)),b=equity(s.benchmark,date(s));if(v<=0||s.cash<0){if(s.margin?.totalBorrowed>0){liquidateMargin(s,true);s.bankruptcyReason??='margin-debt';s.margin.call=null;}s.orders=[];s.status='bankrupt';}else if(s.day===data.calendar.length-1)s.status=data.end<data.target?'awaiting-data':v>b?'won':'lost';}
 function next(s){
  if(s.status!=='playing')return false;if(s.activeEvent)throw Error('請先完成劇情選擇');if(marginNeedsAction(s))throw Error('請先處理今天的融資追繳通知');if(s.supportGames?.some(g=>g.choice==='pending'))throw Error('請先完成支撐線事件選擇');
  if(s.day>=data.calendar.length-1){finish(s);return false;}
  const previous=date(s);s.day++;const d=date(s);accrueMargin(s,previous);corporate(s,d,(type,t)=>record(s,type,t));if(s.margin)for(const[id,p]of Object.entries(s.margin.positions))for(const sp of data.instruments[id].splits||[])if(sp.date===d)p.qty*=sp.ratio;
  const call=s.margin?.call;if(call&&((call.disposeDay!==undefined&&s.day>=call.disposeDay)||(call.disposeDay===undefined&&!call.deferred&&s.day-call.startedDay>=3))){const info=marginInfo(s),openValue=Object.entries(s.margin.positions).reduce((n,[id,p])=>n+p.qty*(bar(id,d)?.[1]??latest(id,previous)?.[4]??0),0),openMaintenance=info.principal?(openValue+info.collateral)/info.principal*100:Infinity;
   if(openMaintenance+1e-8>=MARGIN.minimum){call.deferred=true;delete call.disposeDay;record(s,'margin-deferred','處分前維持率回到 130% 以上，暫緩處分、保留追繳紀錄');}else {for(const o of s.orders.filter(o=>o.financing==='margin'))record(s,'cancel','融資斷頭處分日，取消 '+o.id+' 融資委託',o);s.orders=s.orders.filter(o=>o.financing!=='margin');liquidateMargin(s);}}
  repaySkillLoans(s);
  const paid=corporate(s.benchmark,d);
  if(s.day===startIndex(s)||paid>0||s.benchmark.reinvest){const r=bar('0050',d);if(r){const q=affordable(s.benchmark.cash,r[1]);if(q>0)fill(s.benchmark,'0050','buy',q,r[1]);s.benchmark.reinvest=false;}else s.benchmark.reinvest=true;}
  const pending=s.orders;s.orders=[];
  for(const o of pending){const r=bar(o.id,d);if(!r){record(s,'rejected',`${o.id} 暫停交易，委託取消`,o);continue;}
   try{const qty=o.sizeMode==='all'?(o.side==='buy'?(o.financing==='margin'?marginAffordable(s.cash,r[1]):affordable(s.cash,r[1])):available(s,o.id,o.financing)):o.qty;
    if(qty<1)throw Error(o.side==='buy'?'現金不足以買進一股，委託未成交':'已無可賣持股，委託未成交');
    const trade=o.financing==='margin'?marginFill(s,o.id,o.side,qty,r[1]):fill(s,o.id,o.side,qty,r[1]);record(s,'fill',`${o.side==='buy'?'買進':'賣出'} ${o.id} ${trade.qty.toLocaleString()} 股 @ ${r[1].toFixed(2)}`,{...trade,...(o.sizeMode==='all'?{sizeMode:'all'}:{})});}
   catch(e){record(s,'rejected',`${o.id}：${e.message}`,o);}
  }
  if(s.customStartDate&&s.mode==='life'&&s.day===startIndex(s))openWindow(s,'custom-start');
  s.stress=Math.max(0,Math.min(100,s.stress-1));
  repaySkillLoans(s);marginCheck(s);finish(s);s.history.push({date:d,player:equity(s,d),benchmark:equity(s.benchmark,d)});return true;
 }
 function spend(s,amount){if(!Number.isFinite(amount)||amount<0||amount>s.cash)throw Error('現金不足，請先保留生活費');s.cash=money(s.cash-amount);s.spent=money(s.spent+amount);if(s.history.at(-1)?.date===date(s))s.history.at(-1).player=equity(s,date(s));finish(s);}
 function choose(s,event,choice){if(s.activeEvent!==event.id)throw Error('劇情狀態不符');if(!event.choices.includes(choice))throw Error('未知的劇情選項');if(choice.cost)spend(s,choice.cost);s.stress=Math.max(0,Math.min(100,s.stress+(choice.stress||0)));s.seen.push(event.id);s.activeEvent=null;record(s,'story',`${event.title}／${choice.label}${choice.cost?'（支出 '+choice.cost+' 元）':''}`);}
 function trigger(s,events){if(s.activeEvent||s.status!=='playing'||s.opening)return;const d=date(s);const e=events.find(e=>!s.seen.includes(e.id)&&(e.exact?e.date===d:e.date<=d)&&(!e.until||d<=e.until)&&(!e.when||e.when(s)));if(e){s.activeEvent=e.id;openWindow(s,e.id);}}
 function jumpDate(s,target,{lifeCompleted=false}={}){
  skillReady(s);const index=data.calendar.indexOf(target);if(s.mode==='life'&&!lifeCompleted)throw Error('人生模式須完成一輪後才能跳日期');if(skillInfo(s).calendarRemaining<1)throw Error('本輪日期跳躍次數已用完');if(index<=s.day||index<0)throw Error('請選擇目前日期之後的交易日');
  const draft=JSON.parse(JSON.stringify(s)),from=date(s);draft.activeEvent=null;for(const g of draft.supportGames||[])if(g.choice==='pending'){g.choice='decline';g.finished=true;}for(const o of [...draft.orders])cancel(draft,o.id);
  draft.skills.calendarUsed=(draft.skills.calendarUsed||0)+1;while(draft.status==='playing'&&draft.day<index){if(marginNeedsAction(draft))acknowledgeMargin(draft);if(!next(draft))throw Error('日期跳躍未完成');}
  (draft.dateJumps??=[]).push({from,to:date(draft)});record(draft,'skill-calendar','日期跳躍：'+from+' → '+date(draft),{from,to:date(draft),target});if(draft.mode==='life'&&draft.status==='playing')openWindow(draft,'jump-'+draft.skills.calendarUsed);
  for(const key of Object.keys(s))delete s[key];Object.assign(s,draft);return s;
 }
 function fastForward(s,{unlocked=false,lifeCompleted=false}={}){
  if(!unlocked||s.mode==='life'&&!lifeCompleted)throw Error('請先解鎖人生遙控器；人生模式須完成一輪後使用');
  if(s.status!=='playing'||s.opening||beforeStart(s)||s.day>=data.calendar.length-1)throw Error('目前無法提前結算');
  // Work on a copy: an error must never leave a half-fast-forwarded save.
  const draft=JSON.parse(JSON.stringify(s));draft.earlySettlementDate=date(s);draft.activeEvent=null;
  for(const g of draft.supportGames||[])if(g.choice==='pending'){g.choice='decline';g.finished=true;}
  for(const o of [...draft.orders])cancel(draft,o.id);
  record(draft,'early-settlement','按下人生遙控器，從 '+draft.earlySettlementDate+' 快轉；未成交委託取消，略過劇情，持股依規則結算');
  while(draft.status==='playing'&&draft.day<data.calendar.length-1){if(marginNeedsAction(draft))acknowledgeMargin(draft);if(!next(draft))throw Error('無法繼續快轉');}
  for(const key of Object.keys(s))delete s[key];Object.assign(s,draft);return s;
 }
 function validate(raw){
  const begin=raw?.startDate===undefined?0:data.calendar.indexOf(raw.startDate);
  if(begin<0||raw?.customStartDate!==undefined&&raw.customStartDate!==raw.startDate||begin>0&&!raw.customStartDate||raw?.earlySettlementDate!==undefined&&(!data.calendar.includes(raw.earlySettlementDate)||raw.earlySettlementDate<(raw.startDate||data.start)||raw.earlySettlementDate>date(raw)))throw Error('存檔起始或提前結算日期不正確');
  if(raw?.dateJumps!==undefined&&(!Array.isArray(raw.dateJumps)||raw.dateJumps.length>5||raw.dateJumps.some((j,i,a)=>!j||!data.calendar.includes(j.from)||!data.calendar.includes(j.to)||j.from<(raw.startDate||data.start)||j.to<=j.from||j.to>date(raw)||i&&j.from<a[i-1].to)))throw Error('存檔日期跳躍紀錄不正確');
  if(raw?.playTimeMs!==undefined&&(!Number.isSafeInteger(raw.playTimeMs)||raw.playTimeMs<0)||raw?.playTimePartial!==undefined&&typeof raw.playTimePartial!=='boolean')throw Error('存檔遊玩時長不正確');
  if(raw?.supportGames!==undefined&&(!Array.isArray(raw.supportGames)||raw.supportGames.length>100||!raw.supportGames.every((g,i,a)=>g&&data.instruments[g.id]?.tradable&&data.calendar.includes(g.date)&&g.date<=date(raw)&&Number.isSafeInteger(g.taps)&&g.taps>=0&&g.taps<=10000&&typeof g.finished==='boolean'&&(!i||g.date>a[i-1].date)&&(g.choice===undefined||['pending','use','decline'].includes(g.choice))&&(g.choice!=='pending'||(!g.finished&&g.taps===0&&g.date===date(raw)&&i===a.length-1&&raw.mode==='life'&&raw.status==='playing'&&raw.holdings?.[g.id]))&&(g.choice!=='decline'||(g.finished&&g.taps===0)))))throw Error('存檔支撐線紀錄不正確');
  if(raw?.tutorialPending!==undefined&&typeof raw.tutorialPending!=='boolean')throw Error('存檔教學狀態不正確');
  if(!raw||raw.version!==VERSION)throw Error('存檔版本或資料範圍不相容');
  const extended=typeof raw.datasetEnd==='string'&&raw.datasetEnd<data.end&&data.calendar.includes(raw.datasetEnd),same=raw.datasetEnd===data.end;
  if(!same&&!extended)throw Error('存檔版本或資料範圍不相容');
  if(extended&&(!raw.datasetPrefix||raw.datasetPrefix!==datasetStamp(raw.datasetEnd)))throw Error('舊存檔與已追加的歷史資料不相容');
  if(same&&raw.datasetPrefix!==undefined&&raw.datasetPrefix!==datasetStamp(raw.datasetEnd))throw Error('存檔歷史資料已變更');
  if(raw.mode!==undefined&&!['life','free'].includes(raw.mode))throw Error('存檔模式不正確');
  if(raw.mode==='life'){const l=raw.life;if(!l||!Number.isInteger(l.until)||!Number.isInteger(l.openedAt)||l.openedAt< -1||l.openedAt>raw.day||l.until< -1||l.until>=data.calendar.length||l.until>raw.day+2||!Number.isSafeInteger(l.windows)||l.windows<0||!(l.anchorId===null||typeof l.anchorId==='string'))throw Error('存檔操作期不正確');}
  if(raw.chats!==undefined&&(!Array.isArray(raw.chats)||raw.chats.length>250||!raw.chats.every(c=>c&&typeof c.id==='string'&&typeof c.eventId==='string'&&typeof c.date==='string'&&c.date<=date(raw)&&typeof c.title==='string'&&Array.isArray(c.messages)&&c.messages.length<=12&&c.messages.every(m=>m&&typeof m.speaker==='string'&&typeof m.text==='string'&&m.text.length<=500)&&Array.isArray(c.replies)&&c.replies.length<=4&&c.replies.every(r=>typeof r==='string')&&(c.reply===null||c.replies.includes(c.reply)))))throw Error('存檔群組紀錄不正確');
  if(!Number.isInteger(raw.day)||raw.day<begin-1||raw.day>=data.calendar.length)throw Error('存檔日期不正確');
  if(!['playing','won','lost','bankrupt','awaiting-data'].includes(raw.status))throw Error('存檔狀態不正確');
  function checkAccount(a){if(!a||!Number.isFinite(a.cash)||(a.cash<0&&!(a===raw&&raw.status==='bankrupt'&&(['margin-debt','mother-debt'].includes(raw.bankruptcyReason))&&(raw.margin?.totalBorrowed>0||raw.skills?.motherUsed>0||raw.skills?.vipUsed>0)))||!a.holdings||typeof a.holdings!=='object'||Array.isArray(a.holdings)||!Array.isArray(a.receivables))throw Error('存檔資產不正確');
   for(const[id,h]of Object.entries(a.holdings))if(!data.instruments[id]?.tradable||!Number.isSafeInteger(h.qty)||h.qty<=0||!Number.isFinite(h.cost)||h.cost<0)throw Error('存檔持股不正確');
   for(const r of a.receivables)if(!data.instruments[r.id]||!Number.isFinite(r.amount)||r.amount<0||!/^\d{4}-\d{2}-\d{2}$/.test(r.pay))throw Error('存檔股利不正確');}
  checkAccount(raw);checkAccount(raw.benchmark);
  if(raw.margin!==undefined){const m=raw.margin;if(!m||m.version!==1||m.enabled!==true||!m.positions||typeof m.positions!=='object'||Array.isArray(m.positions)||!['collateral','totalBorrowed','totalInterest','interestPaid','totalTopups'].every(k=>Number.isFinite(m[k])&&m[k]>=0)||!Number.isSafeInteger(m.liquidations)||m.liquidations<0||m.interestPaid>m.totalInterest+.01)throw Error('存檔融資帳戶不正確');for(const[id,p]of Object.entries(m.positions))if(!raw.holdings[id]||!Number.isSafeInteger(p.qty)||p.qty<=0||p.qty>raw.holdings[id].qty||!['cost','principal','interest'].every(k=>Number.isFinite(p[k])&&p[k]>=0)||p.principal<=0||p.cost>raw.holdings[id].cost+.01)throw Error('存檔融資持股不正確');if(m.call!==null&&(!m.call||!Number.isInteger(m.call.startedDay)||m.call.startedDay<0||m.call.startedDay>raw.day||!Number.isInteger(m.call.ackDay)||m.call.ackDay< -1||m.call.ackDay>raw.day||!Object.keys(m.positions).length))throw Error('存檔追繳令不正確');}
  const call=raw.margin?.call;if(call&&((call.deferred!==undefined&&typeof call.deferred!=='boolean')||(call.disposeDay!==undefined&&(!Number.isInteger(call.disposeDay)||call.disposeDay<call.startedDay||call.disposeDay>raw.day+1))||(call.noticeTopup!==undefined&&(!Number.isFinite(call.noticeTopup)||call.noticeTopup<0))||(call.paidTopup!==undefined&&(!Number.isFinite(call.paidTopup)||call.paidTopup<0))))throw Error('存檔追繳期限不正確');
  if(raw.bankruptcyReason!==undefined&&!['margin-debt','mother-debt'].includes(raw.bankruptcyReason))throw Error('存檔結局原因不正確');
  if(raw.skills?.levels?.calendar!==undefined&&(!Number.isInteger(raw.skills.levels.calendar)||raw.skills.levels.calendar<0||raw.skills.levels.calendar>5||!Number.isInteger(raw.skills.calendarUsed)||raw.skills.calendarUsed<0||raw.skills.calendarUsed>raw.skills.levels.calendar||(raw.dateJumps?.length||0)!==raw.skills.calendarUsed))throw Error('存檔日期跳躍次數不正確');
  if(raw.skills!==undefined){const k=raw.skills;if(!k||k.version!==1||!k.levels||!Object.entries({mother:5,vip:5,divination:3}).every(([id,max])=>Number.isInteger(k.levels[id])&&k.levels[id]>=0&&k.levels[id]<=max)||!['motherUsed','vipUsed','totalRepaid'].every(id=>Number.isFinite(k[id])&&k[id]>=0)||k.motherUsed>k.levels.mother*200000||k.vipUsed>k.levels.vip*200000||k.totalRepaid>k.motherUsed+k.vipUsed+.01||!Array.isArray(k.loans)||k.loans.length>5000||!k.loans.every(l=>l&&['mother','vip'].includes(l.kind)&&typeof l.date==='string'&&l.date<=date(raw)&&typeof l.due==='string'&&(l.kind==='vip'?l.due==='settlement':l.due===sixMonthsLater(l.date))&&Number.isFinite(l.principal)&&l.principal>0&&Number.isFinite(l.remaining)&&l.remaining>=0&&l.remaining<=l.principal)||!Array.isArray(k.forecasts)||k.forecasts.length>k.levels.divination||!k.forecasts.every(f=>f&&data.instruments[f.id]&&typeof f.date==='string'&&f.date<=date(raw)&&['days','up','down','flat','suspended'].every(id=>Number.isInteger(f[id])&&f[id]>=0)&&f.days>=1&&f.days<=10&&f.up+f.down+f.flat===f.days&&f.suspended<=f.flat))throw Error('存檔技能與借款紀錄不正確');const borrowed=money(k.loans.reduce((n,l)=>n+l.principal,0)),remaining=money(k.loans.reduce((n,l)=>n+l.remaining,0));if(Math.abs(borrowed-k.motherUsed-k.vipUsed)>.01||Math.abs(borrowed-remaining-k.totalRepaid)>.01)throw Error('存檔技能借還款不一致');}
  for(const key of ['log','orders','seen','history'])if(!Array.isArray(raw[key]))throw Error('存檔紀錄不正確');
  if(!raw.log.every(l=>l&&typeof l.date==='string'&&typeof l.type==='string'&&typeof l.text==='string')||!raw.seen.every(id=>typeof id==='string'))throw Error('存檔紀錄內容不正確');
  if(raw.orders.length>4||!raw.orders.every(o=>data.instruments[o.id]?.tradable&&['buy','sell'].includes(o.side)&&Number.isSafeInteger(o.qty)&&o.qty>0&&o.qty<=100000000)||new Set(raw.orders.map(o=>o.id)).size!==raw.orders.length)throw Error('存檔委託不正確');
  if(!raw.orders.every(o=>o.sizeMode===undefined||o.sizeMode==='all'))throw Error('存檔委託模式不正確');
  if(!raw.orders.every(o=>o.financing===undefined||o.financing==='margin'&&raw.margin?.enabled))throw Error('存檔融資委託不正確');
  if(!Number.isFinite(raw.stress)||raw.stress<0||raw.stress>100||!Number.isFinite(raw.spent)||raw.spent<0||typeof raw.opening!=='boolean'||!(raw.activeEvent===null||typeof raw.activeEvent==='string'))throw Error('存檔劇情不正確');
  if(!raw.history.every(h=>h&&typeof h.date==='string'&&Number.isFinite(h.player)&&Number.isFinite(h.benchmark))||raw.history.length!==raw.day-begin+2)throw Error('存檔績效不正確');
  if(raw.customStartDate&&raw.history.some((h,i)=>h.date!==(i===0?(begin?data.calendar[begin-1]:'2019-12-31'):data.calendar[begin+i-1])))throw Error('自訂輪次的交易日順序不正確');
  const result=JSON.parse(JSON.stringify(raw));
  if(extended){if(raw.history.some((h,i)=>h.date!==(i===0?(begin?data.calendar[begin-1]:'2019-12-31'):data.calendar[begin+i-1])))throw Error('存檔交易日順序不相容');result.datasetEnd=data.end;result.datasetPrefix=datasetStamp(data.end);if(['won','lost','awaiting-data'].includes(raw.status)&&raw.day===data.calendar.indexOf(raw.datasetEnd)){result.extendedFrom={date:raw.datasetEnd,status:raw.status};if(raw.runId){result.rewardRootId=raw.rewardRootId||raw.runId;result.parentRunId=raw.runId;delete result.runId;}result.status='playing';if(result.mode==='life')openWindow(result,'extended-'+raw.datasetEnd);}}
  return result;
 }
 function visibleRows(s,id){return data.instruments[id].rows.filter(r=>r[0]<=date(s));}
 function chipCutoff(s){return s.day<=0?'2019-12-31':data.calendar[s.day-1];}
 return {data,date,bar,latest,startIndex,beforeStart,sessions,fastForward,jumpDate,datasetStamp,stamp,equity,affordable,fresh,queue,cancel,next,choose,trigger,validate,visibleRows,chipCutoff,record,finish,spend,canTrade,openWindow,migrateLegacy,enableMargin,enableSkills,skillInfo,borrowMother,useVIP,divine,marginInfo,marginAffordable,available,topupMargin,marginNeedsAction,acknowledgeMargin};
}
root.TaiguEngine={createMarket,fee,money,INITIAL,VERSION,MARGIN};
})(globalThis);
