(function(root){
'use strict';
const FIELDS=['startDate','earlySettlementDate','dateJumps','date','type','text','id','side','qty','price','value','fee','tax','costBasis','realizedPnl','sizeMode','financing','borrowed','repaid','interestPaid','forced'];
const LOG_FIELDS=[...FIELDS.slice(3),'amount','cashChange','collateralReleased'];
const context=r=>JSON.stringify([r.id,r.mode||'free',r.status,r.date,r.startDate||'2020-01-02',r.earlySettlementDate||'',r.dateJumps||[],r.equity,r.trades,r.fees,r.tax,r.spent,r.choices]);
function capture(record,state){
 const stateDate=state?.day<0?'2020-01-01':state?.history?.at(-1)?.date;
 if(!record||record.id!==state?.runId||record.status!==state.status||stateDate&&record.date!==stateDate||!Array.isArray(state.log)||record.operationCount!==undefined&&record.operationCount!==state.log.length)throw Error('操作明細與遊玩紀錄不符。');
 return {version:1,id:record.id,mode:record.mode,status:record.status,date:record.date,startDate:record.startDate||'2020-01-02',earlySettlementDate:record.earlySettlementDate||'',dateJumps:(record.dateJumps||[]).map(j=>({from:j.from,to:j.to})),context:context(record),log:state.log.map(row=>Object.fromEntries(LOG_FIELDS.filter(k=>['string','number','boolean'].includes(typeof row[k])).map(k=>[k,row[k]])))};
}
function matches(entry,record){return entry?.version===1&&entry.id===record.id&&entry.context===context(record)&&Array.isArray(entry.log)&&(record.operationCount===undefined||entry.log.length===record.operationCount);}
function cell(value){let s=String(value??'');if(typeof value!=='number'&&/^[\s\u0000-\u001f]*[=+@-]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function csv(entry){if(entry?.version!==1||!Array.isArray(entry.log))throw Error('沒有這一輪的操作明細。');return '\ufeff'+[FIELDS,...entry.log.map(row=>FIELDS.map(k=>k==='startDate'?entry.startDate:k==='earlySettlementDate'?entry.earlySettlementDate:k==='dateJumps'?JSON.stringify(entry.dateJumps):row[k]))].map(row=>row.map(cell).join(',')).join('\r\n');}
function filename(entry){const id=String(entry.id).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,12)||'record';return '台股戰士-操作紀錄-'+(entry.mode==='life'?'人生模式':'自由模式')+'-'+entry.date+'-'+id+'.csv';}
class BrowserDB{
 constructor(indexedDB){this.indexedDB=indexedDB;this.opening=null;}
 open(){if(this.opening)return this.opening;this.opening=new Promise((resolve,reject)=>{
  if(!this.indexedDB){reject(Error('瀏覽器無法保存操作明細。'));return;}
  const request=this.indexedDB.open('taigu-warrior.operations',1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('runs'))request.result.createObjectStore('runs',{keyPath:'id'});};
  request.onerror=()=>reject(request.error||Error('操作明細資料庫無法開啟。'));request.onblocked=()=>reject(Error('操作明細資料庫正在其他分頁使用，請關閉其他分頁後重試。'));
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.opening=null;};resolve(db);};
 }).catch(error=>{this.opening=null;throw error;});return this.opening;}
 async transact(mode,action){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction('runs',mode),store=tx.objectStore('runs');let result;tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error||Error('操作明細儲存失敗。'));action(store,value=>{result=value;});});}
 get(id){return this.transact('readonly',(store,done)=>{const r=store.get(id);r.onsuccess=()=>done(r.result||null);});}
 put(entry){return this.transact('readwrite',store=>store.put(entry));}
 clear(){return this.indexedDB?this.transact('readwrite',store=>store.clear()):Promise.resolve();}
 prune(ids){const keep=new Set(ids);return this.transact('readwrite',store=>{const r=store.openKeyCursor();r.onsuccess=()=>{const c=r.result;if(!c)return;if(!keep.has(c.key))store.delete(c.key);c.continue();};});}
}
class Store{
 constructor({indexedDB=root.indexedDB,backend=null}={}){this.backend=backend||new BrowserDB(indexedDB);this.pending=Promise.resolve();}
 queue(action){const result=this.pending.then(action);this.pending=result.catch(()=>{});return result;}
 save(entry){const copy=JSON.parse(JSON.stringify(entry));return this.queue(()=>this.backend.put(copy));}
 async get(record){await this.pending;const entry=await this.backend.get(record.id);return matches(entry,record)?entry:null;}
 recover(record,state){const entry=capture(record,state);return this.queue(async()=>{const existing=await this.backend.get(record.id);if(!matches(existing,record))await this.backend.put(entry);});}
 prune(ids){return this.queue(()=>this.backend.prune(ids));}
 clear(){return this.queue(()=>this.backend.clear());}
}
root.TaiguOperationLogs={FIELDS,capture,matches,csv,filename,Store};
})(globalThis);
