(function(root){
'use strict';
const TRADE_HEADERS=['成交日','商品','買賣','數量','成交價','價金','手續費','交易稅','應付金額','應收金額','融資金額','保證金','融資利息'];
const DIVIDEND_HEADERS=['除權息日','配息入帳日','配股入帳日','商品','持有數量','股利','配股數量'];
const money=n=>Math.round(n*100)/100,number=n=>typeof n==='number'&&Number.isFinite(n)?n:null;
const product=(data,id)=>id+' '+(data.instruments[id]?.name||'');
function amountInText(row){const match=String(row.text||'').match(/^補繳融資保證金 ([\d,.]+) 元$/);return number(row.amount)??(match?Number(match[1].replaceAll(',','')):null);}
function transactions(entry,data){
 const rows=[];let legacyCollateral=false;
 for(const r of entry.log){
  if(r.type==='margin-topup'||r.type==='skill-vip'){
   const amount=r.type==='margin-topup'?amountInText(r):number(r.amount);legacyCollateral=true;
   rows.push({values:[r.date,'融資帳戶',r.type==='margin-topup'?'補繳保證金':'VIP代墊',null,null,null,0,0,r.type==='margin-topup'?amount:0,0,null,amount,null],note:r.type==='skill-vip'?'VIP借款轉入擔保金，不是股票融資買進。':amount===null?'舊紀錄未保留補繳金額。':''});continue;
  }
  if(r.type!=='fill')continue;
  const margin=r.financing==='margin',buy=r.side==='buy',value=number(r.value),fee=number(r.fee),tax=number(r.tax),principal=margin?number(buy?r.borrowed:r.repaid):0,interest=margin&&!buy?number(r.interestPaid):0;
  // Older archives without collateral metadata must not imply a known cash settlement.
  const released=number(r.collateralReleased)??(margin&&!buy&&legacyCollateral?null:0);
  let delta=number(r.cashChange);
  if(delta===null&&[value,fee,tax,principal,interest,released].every(n=>n!==null))delta=money(buy?-(value+fee-principal):value-fee-tax-principal-interest+released);
  rows.push({values:[r.date,product(data,r.id),(margin?'資':'現')+(buy?'買':'賣'),r.qty,r.price,value,fee,tax,delta===null?null:Math.max(0,-delta),delta===null?null:Math.max(0,delta),principal,released===null?null:released?-released:0,interest],note:[r.forced?'強制賣出':'',released===null?'舊紀錄缺少保證金退還明細，應收付金額留白。':''].filter(Boolean).join('；')});
 }
 return rows;
}
function dividends(entry,data){
 const holdings=new Map(),claims=[],rows=[],byDate=new Map(),calendar=data.calendar.filter(d=>d>=(entry.startDate||data.start)&&d<=entry.date);let epoch=0;
 const position=id=>{if(!holdings.has(id))holdings.set(id,{cash:0,margin:0,active:false,epoch:0,principal:0});return holdings.get(id);};
 for(const r of entry.log){if(!byDate.has(r.date))byDate.set(r.date,[]);byDate.get(r.date).push(r);}
 const add=(id,ex,qty)=>{let row=rows.find(r=>r.id===id&&r.ex===ex&&r.qty===qty);if(!row){row={id,ex,qty,cashPay:null,stockPay:null,amount:0,stockQty:0};rows.push(row);}return row;};
 for(const d of calendar){
  for(const [id,inst]of Object.entries(data.instruments)){
   const p=position(id);if(!p.cash&&!p.margin)continue;
   for(const div of inst.stockDividends||[])if(div.ex===d){const rawCash=p.cash*div.ratio,rawMargin=p.margin*div.ratio,cash=Math.floor(rawCash+1e-8),margin=Math.floor(rawMargin+1e-8),row=add(id,d,p.cash+p.margin);row.stockPay=div.pay;row.stockQty+=cash+margin;claims.push({kind:'stock',id,pay:div.pay,cash,margin,epoch:p.epoch});const fractionCash=Math.floor(Math.max(0,rawCash-cash)*div.fractionPrice+1e-8)+Math.floor(Math.max(0,rawMargin-margin)*div.fractionPrice+1e-8);if(fractionCash)rows.push({id,ex:d,qty:p.cash+p.margin,cashPay:div.pay,stockPay:null,amount:fractionCash,stockQty:0,fraction:true});}
   for(const action of inst.capitalActions||[])if(action.date===d){const oldMargin=p.margin;p.cash=Math.floor(p.cash*action.ratio+1e-8);p.margin=Math.floor(p.margin*action.ratio+1e-8);claims.push({kind:'capital',id,pay:action.pay,amount:money(oldMargin*action.cashPerOldShare+Math.floor(Math.max(0,oldMargin*action.ratio-p.margin)*action.fractionPrice+1e-8)),epoch:p.epoch});}
   for(const split of inst.splits||[])if(split.date===d){p.cash*=split.ratio;p.margin*=split.ratio;}
   for(const div of inst.dividends||[])if(div.ex===d){const row=add(id,d,p.cash+p.margin);row.cashPay=div.pay;row.amount=money(row.amount+money((p.cash+p.margin)*div.amount));}
  }
  for(let i=0;i<claims.length;){const claim=claims[i];if(claim.pay>d){i++;continue;}claims.splice(i,1);const p=position(claim.id);
   if(claim.kind==='stock'){if(p.active&&p.epoch===claim.epoch){p.cash+=claim.cash;p.margin+=claim.margin;}else p.cash+=claim.cash+claim.margin;}
   else if(p.active&&p.epoch===claim.epoch){p.principal=money(p.principal-(p.margin?Math.min(p.principal,claim.amount):p.principal));if(!p.principal){p.cash+=p.margin;p.margin=0;p.active=false;}}
  }
  for(const r of byDate.get(d)||[])if(r.type==='fill'){
   const p=position(r.id),margin=r.financing==='margin';
   if(r.side==='buy'){if(margin){if(!p.active){p.active=true;p.epoch=++epoch;}p.margin+=r.qty;p.principal=money(p.principal+(r.borrowed||0));}else p.cash+=r.qty;}
   else if(margin){p.margin-=r.qty;p.principal=money(p.principal-(r.repaid||0));if(!p.margin){p.active=false;p.principal=0;}}else p.cash-=r.qty;
  }
 }
 const payDate=pay=>pay?(data.calendar.find(d=>d>=pay)||pay):null;
 return rows.sort((a,b)=>a.ex.localeCompare(b.ex)||a.id.localeCompare(b.id)).map(r=>{const cashPay=payDate(r.cashPay),stockPay=payDate(r.stockPay);return {values:[r.ex,cashPay,stockPay,product(data,r.id),r.qty,r.amount,r.stockQty],note:(r.fraction?'畸零股折現；':'')+'截至 '+entry.date+'；'+(cashPay?'現金'+(r.fraction?'折現款':'股利')+(cashPay<=entry.date?'已入帳':'尚未入帳')+'。':'')+(stockPay?'股票股利'+(stockPay<=entry.date?'已入帳':'尚未入帳')+'。':'')};});
}
const asDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(value+'T00:00:00Z'):value??null;
function sheet(workbook,name,headers,widths,{totals=false,dateColumns=[],priceColumns=[],textColumns=[]}={}){
 const s=workbook.addWorksheet(name,{views:[{state:'frozen',xSplit:name==='交易紀錄'?2:0,ySplit:totals?2:1}],properties:{defaultRowHeight:20}});
 s.columns=widths.map(width=>({width}));s.addRow(headers);if(totals)s.addRow(['合計']);
 headers.forEach((_,i)=>{s.getColumn(i+1).numFmt=dateColumns.includes(i+1)?'yyyy/mm/dd':priceColumns.includes(i+1)?'0.00':textColumns.includes(i+1)?'@':'#,##0;[Red]-#,##0;0';});
 s.getRow(1).height=25;s.getRow(1).eachCell(c=>{c.font={name:'Microsoft JhengHei',size:11,bold:true,color:{argb:'FF365E46'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F5F1'}};c.alignment={vertical:'middle',horizontal:'center'};});
 return s;
}
function populate(s,rows,dateColumns){const noteColumn=s.getRow(1).cellCount+2;for(const row of rows){const r=s.addRow(row.values.map((v,i)=>dateColumns.includes(i+1)?asDate(v):v??null));if(row.note){s.getCell(1,noteColumn).value='備註';s.getColumn(noteColumn).width=100;r.getCell(noteColumn).value=row.note;}r.eachCell(c=>{c.font={name:'Microsoft JhengHei',size:11};c.alignment={vertical:'middle',horizontal:typeof c.value==='number'?'right':'left'};c.border={bottom:{style:'hair',color:{argb:'FFE1EAE4'}}};});}}
function totals(s,columns){for(const col of columns){const cell=s.getCell(2,col),values=[];let missing=false;for(let r=3;r<=s.rowCount;r++){const v=s.getCell(r,col).value;if(typeof v==='number')values.push(v);else if(s.name==='交易紀錄'&&[9,10].includes(col))missing=true;}cell.value=missing?'資料不足':values.length?{formula:'SUM('+s.getCell(3,col).address+':'+s.getCell(s.rowCount,col).address+')',result:money(values.reduce((a,b)=>a+b,0))}:0;}s.getRow(2).eachCell(c=>{c.font={name:'Microsoft JhengHei',size:11,bold:true};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF8FAF8'}};});}
function build(entry,data,ExcelJS=root.ExcelJS){
 if(!ExcelJS?.Workbook)throw Error('Excel匯出元件未能載入，請重新整理後再試。');if(entry?.version!==1||!Array.isArray(entry.log))throw Error('沒有這一輪的操作明細。');
 const workbook=new ExcelJS.Workbook();workbook.creator='台股戰士';workbook.title='台股戰士對帳單';workbook.subject=(entry.mode==='life'?'人生模式':'自由模式')+' · '+entry.startDate+' 至 '+entry.date;workbook.calcProperties.fullCalcOnLoad=true;
 const trade=sheet(workbook,'交易紀錄',TRADE_HEADERS,[14,24,15,15,13,19,13,13,19,19,19,17,15],{totals:true,dateColumns:[1],priceColumns:[5],textColumns:[2,3]});populate(trade,transactions(entry,data),[1]);totals(trade,[4,6,7,8,9,10]);trade.getCell('O1').value='備註';trade.getColumn(15).width=100;trade.getCell('O2').value='融資金額：資買為借入，資賣為償還本金。保證金：正值為補繳，負值為退還；已計入應收付金額。';
 const div=sheet(workbook,'除權息紀錄',DIVIDEND_HEADERS,[15,17,17,24,17,19,17],{totals:true,dateColumns:[1,2,3],textColumns:[4]});populate(div,dividends(entry,data),[1,2,3]);totals(div,[6]);
 const fields=root.TaiguOperationLogs.FIELDS,raw=sheet(workbook,'操作紀錄',fields,fields.map(k=>k==='text'?76:['startDate','earlySettlementDate','date'].includes(k)?16:k==='dateJumps'?40:18),{dateColumns:[1,2,4],priceColumns:[10],textColumns:[3,5,6,7,8,16,17]});
 populate(raw,entry.log.map(r=>({values:fields.map(k=>k==='startDate'?entry.startDate:k==='earlySettlementDate'?entry.earlySettlementDate:k==='dateJumps'?JSON.stringify(entry.dateJumps||[]):r[k])})),[1,2,4]);raw.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,raw.rowCount),column:fields.length}};
 return workbook;
}
function filename(entry){const id=String(entry.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,12)||'record';return '台股戰士-對帳單-'+(entry.mode==='life'?'人生模式':'自由模式')+'-'+entry.date+'-'+id+'.xlsx';}
root.TaiguStatements={TRADE_HEADERS,DIVIDEND_HEADERS,transactions,dividends,build,filename};
})(globalThis);
