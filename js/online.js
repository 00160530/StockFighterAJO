(function(root){
'use strict';
function deviceType(nav=root.navigator){const ua=nav?.userAgent||'';if(/iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i.test(ua)||/Macintosh/i.test(ua)&&Number(nav?.maxTouchPoints)>1)return 'tablet';if(/iPhone|iPod|Android.*Mobile|Windows Phone|Mobi/i.test(ua)||nav?.userAgentData?.mobile===true)return 'mobile';if(/Windows NT|Macintosh|Mac OS X|X11|CrOS|Linux/i.test(ua))return 'desktop';return 'unknown';}

const KEY='taigu-warrior.v1.online';
const BOARD_CACHE_MS=5*60*1000;
function completionPayload(r,session,config){const cents=n=>Math.round(n*100);if(r.status!=='bankrupt')return {...payload(r,session,config),cashCents:cents(r.cash)};return {sessionId:session.sessionId,sessionToken:session.sessionToken,editionId:config.editionId,mode:r.mode,outcome:r.status,playTimeMs:r.playTimeMs??null,playTimePartial:r.playTimePartial===true,date:r.date,startDate:r.startDate,customStartDate:r.customStartDate??null,earlySettlementDate:r.earlySettlementDate??null,dateJumps:r.dateJumps??[],sessions:r.sessions,equityCents:cents(r.equity),benchmarkCents:cents(r.benchmark),cashCents:r.cash<0?Math.min(-1,cents(r.cash)):cents(r.cash)};}
class CloudError extends Error{constructor(message,code='NETWORK_ERROR',extra={}){super(message);Object.assign(this,{code,...extra});}}
function payload(r,session,config){const cents=n=>Math.round(n*100),highlight=t=>t?{symbol:t.id,date:t.date,qty:t.qty,priceCents:cents(t.price),pnlCents:cents(t.pnl),...(Number.isFinite(t.costBasis)&&t.costBasis>0?{costBasisCents:cents(t.costBasis)}:{})}:null;const equityCents=cents(r.equity),benchmarkCents=cents(r.benchmark);return {sessionId:session.sessionId,sessionToken:session.sessionToken,...(r.status==='bankrupt'?{cashCents:r.cash<0?Math.min(-1,cents(r.cash)):cents(r.cash)}:{}),editionId:config.editionId,mode:r.mode,playTimeMs:r.playTimeMs??null,playTimePartial:r.playTimePartial===true,skillUses:r.skillUses??null,startDate:r.startDate,customStartDate:r.customStartDate??null,earlySettlementDate:r.earlySettlementDate??null,...(r.dateJumps?.length?{dateJumps:r.dateJumps.map(j=>({...j}))}:{}),outcome:r.status,date:r.date,sessions:r.sessions,score:Math.round((equityCents-benchmarkCents)/10000),equityCents,benchmarkCents,drawdownBps:Math.round(r.maxDrawdown*100),trades:r.trades,buyTrades:r.buyTrades,sellTrades:r.sellTrades,maxGain:r.statsComplete?highlight(r.maxGain):null,maxLoss:r.statsComplete?highlight(r.maxLoss):null,...(r.margin?.totalBorrowed>0?{margin:{totalBorrowedCents:cents(r.margin.totalBorrowed),totalInterestCents:cents(r.margin.totalInterest),interestPaidCents:cents(r.margin.interestPaid),totalTopupsCents:cents(r.margin.totalTopups),liquidations:r.margin.liquidations,principalCents:cents(r.margin.principal),interestCents:cents(r.margin.interest),collateralCents:cents(r.margin.collateral)}}:{})};}
class Client{
 constructor({config,storage,fetcher=root.fetch?.bind(root),now=()=>Date.now()}){this.config=config;this.storage=storage;this.fetcher=fetcher;this.now=now;this.starting=new Map();this.completing=new Map();this.submitting=new Map();this.profileSynced=false;this.registering=null;this.boardCache=null;this.boardPending=null;this.scopedBoards=new Map();this.scopedBoardPending=new Map();this.boardGeneration=0;this.quoteGeneration=0;this.quoteCache=null;this.quotePending=null;}
 get enabled(){const base=this.config?.apiBase||'',local=['127.0.0.1','localhost','[::1]'].includes(root.location?.hostname);return /^https:\/\//.test(base)||(local&&/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::[0-9]{1,5})?(?:\/|$)/.test(base));}
 read(){try{const a=JSON.parse(this.storage.getItem(KEY)||'null');return a&&a.version===1&&a.sessions&&a.receipts?a:{version:1,sessions:{},receipts:{},player:null};}catch{return {version:1,sessions:{},receipts:{},player:null};}}
 write(a){try{this.storage.setItem(KEY,JSON.stringify(a));}catch{throw new CloudError('瀏覽器無法保留匿名身分，這輪仍可繼續本機遊玩。','STORAGE_UNAVAILABLE');}}
 async request(path,body,token){if(!this.enabled)throw new CloudError('線上服務尚未設定。','NOT_CONFIGURED');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await this.fetcher(this.config.apiBase+path,{method:body?'POST':'GET',headers:{...((token||path==='/v1/players')?{'X-SF-Device':deviceType()}:{}),...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,credentials:'omit'});let data;try{data=await response.json();}catch{throw new CloudError('服務回應異常，請稍後再試。');}if(!response.ok)throw new CloudError(data.error?.message||'線上服務暫時無法使用。',data.error?.code||'SERVICE_ERROR',data.error||{});return data;}catch(e){if(e instanceof CloudError)throw e;throw new CloudError('目前連不上線上服務，本機遊戲仍可繼續。');}finally{clearTimeout(timer);}}
 async identity(){const saved=this.read().player;if(saved?.playerToken)return saved;if(this.registering)return this.registering;this.registering=(async()=>{const data=await this.request('/v1/players',{}),a=this.read();a.player={playerId:data.playerId,playerToken:data.playerToken};this.write(a);return a.player;})().finally(()=>this.registering=null);return this.registering;}
 applyProfile(profile,token){
  const avatarId=profile.avatarId??1,avatarCharacter=profile.avatarCharacter??'xiaojiu';
  if(profile.nickname!==null&&typeof profile.nickname!=='string'||!Number.isInteger(avatarId)||avatarId<1||avatarId>10||!['xiaojiu','xiaoxiaojiu'].includes(avatarCharacter))throw new CloudError('玩家資料不完整，請重新連線。');
  const a=this.read();if(a.player?.playerToken!==token)throw new CloudError('匿名身分已變更，請重新確認。','IDENTITY_CHANGED');
  const changed=a.nickname!==(profile.nickname||'')||a.avatarId!==avatarId||a.avatarCharacter!==avatarCharacter;
  a.nickname=profile.nickname||'';if(profile.nickname)a.lockedNickname=profile.nickname;else delete a.lockedNickname;
  a.avatarId=avatarId;a.avatarCharacter=avatarCharacter;this.write(a);this.profileSynced=true;if(changed)this.invalidateBoards();return {...profile,avatarId,avatarCharacter};
 }
 async syncIdentity(){if(!this.enabled||!this.read().player?.playerToken)return null;return this.profile({force:true});}
 async profile({force=false}={}){const p=await this.identity();if(this.profilePending?.token===p.playerToken&&(!force||this.profilePending.loading))return this.profilePending.promise;
  const pending={token:p.playerToken,loading:true,promise:null};pending.promise=this.request('/v1/profile',undefined,p.playerToken).then(profile=>this.applyProfile(profile,p.playerToken)).catch(e=>{this.profileSynced=false;if(this.profilePending===pending)this.profilePending=null;throw e;}).finally(()=>pending.loading=false);this.profilePending=pending;return pending.promise;
 }
 async saveProfile(fields){if(typeof fields.nickname==='string'&&['小韭','小小韭'].includes(fields.nickname.normalize('NFC').trim()))throw new CloudError('這個暱稱已有人使用，請換一個暱稱。','NICKNAME_TAKEN');const p=await this.identity(),result=await this.request('/v1/profile',fields,p.playerToken),profile=this.applyProfile(result,p.playerToken);this.profilePending=null;this.invalidateBoards();return profile;}
 session(runId){return this.read().sessions[runId]||null;}
 receipt(runId){const a=this.read(),r=a.receipts[runId];return r&&(!r.ownerPlayerId||r.ownerPlayerId===a.player?.playerId)?r:null;}
 datedReceipt(runId){const a=this.read(),date=a.uploadDates?.[runId];return Number.isFinite(date)?{...a.receipts[runId],submittedAt:date}:a.receipts[runId]||null;}
 async loadUploadDates(records){
  const saved=this.read(),ids=[...new Set(records.map(r=>r.id).filter(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,120}$/.test(id)))].sort().slice(0,100),token=saved.player?.playerToken;
  if(!this.enabled||!token||!ids.length||ids.every(id=>Number.isFinite(saved.uploadDateChecks?.[id])&&saved.uploadDateChecks[id]+BOARD_CACHE_MS>this.now()))return;
  const key=JSON.stringify([token,ids]);if(this.uploadDatesPending?.key===key)return this.uploadDatesPending.promise;
  const pending={key,promise:null};pending.promise=this.request('/v1/upload-dates',{runIds:ids},token).then(result=>{const a=this.read();if(a.player?.playerToken!==token)return;a.uploadDates??={};a.uploadDateChecks??={};for(const id of ids){const date=result.dates?.[id];if(Number.isSafeInteger(date)&&date>0)a.uploadDates[id]=date;a.uploadDateChecks[id]=this.now();}this.write(a);}).finally(()=>{if(this.uploadDatesPending===pending)this.uploadDatesPending=null;});this.uploadDatesPending=pending;return pending.promise;
 }
 async start(s){if(!this.enabled||!s.runId)return null;if(this.session(s.runId))return this.session(s.runId);if(this.starting.has(s.runId))return this.starting.get(s.runId);if(s.status!=='playing'||(s.customStartDate?s.history?.length!==1:s.day!==-1))return null;
  const {runId,mode}=s;const work=(async()=>{const p=await this.identity(),session=await this.request('/v1/sessions',{runId,mode,editionId:this.config.editionId,startDay:s.customStartDate?s.day:-1,...(s.customStartDate?{startDate:s.startDate}:{})},p.playerToken),a=this.read();a.sessions[runId]=session;const ids=Object.keys(a.sessions);if(ids.length>100)for(const id of ids.slice(0,-100))delete a.sessions[id];this.write(a);return session;})();this.starting.set(runId,work);try{return await work;}finally{this.starting.delete(runId);}
 }
 eligibility(r){if(this.receipt(r.id))return {ok:false,reason:'這輪已提交線上成績。',submitted:true};if(!['won','lost','bankrupt'].includes(r.status))return {ok:false,reason:'只有走到資料終點的完整結算輪次可以提交。'};const s=this.session(r.id);if(!s)return {ok:false,reason:'這輪沒有開局時建立的線上 Session，可保留本機紀錄；下次開新一輪時連線即可參與線上排行。'};if((s.editionId!==this.config.editionId&&!this.config.compatibleEditionIds?.includes(s.editionId))||s.mode!==r.mode)return {ok:false,reason:'這輪的模式或行情版本不符。'};if(s.expiresAt*1000<=this.now())return {ok:false,reason:'這輪的線上 Session 已到期，本機紀錄仍保留。'};return {ok:true};}
 async submit(r,{retry=false}={}){
  if(this.starting.has(r.id))try{await this.starting.get(r.id);}catch{}
  const saved=this.read(),receipt=this.receipt(r.id);if(receipt)return receipt;
  const eligible=this.eligibility(r);if(!eligible.ok)throw new CloudError(eligible.reason,'INELIGIBLE');
  if(saved.pendingScores?.[r.id]?.status==='abandoned'&&!retry)throw new CloudError('已停止這輪的自動重試，可手動重新上傳。','UPLOAD_ABANDONED');
  if(!saved.player?.playerToken)throw new CloudError('匿名身分尚未建立。','PLAYER_REQUIRED');
  if(saved.pendingScores?.[r.id]&&saved.pendingScores[r.id].playerId!==saved.player.playerId)throw new CloudError('這輪屬於另一個匿名身分，無法代為上傳。','IDENTITY_CHANGED');
  if(!saved.pendingScores?.[r.id]){saved.pendingScores??={};saved.pendingScores[r.id]={body:payload(r,this.session(r.id),this.config),playerId:saved.player.playerId,expiresAt:this.session(r.id).expiresAt,status:'pending'};this.write(saved);}
  return this.sendScore(r.id,retry);
 }
 async sendScore(id,retry=false){
  if(this.submitting.has(id))return this.submitting.get(id);
  const work=(async()=>{const saved=this.read(),entry=saved.pendingScores?.[id];if(!entry||entry.playerId!==saved.player?.playerId||entry.status==='abandoned'&&!retry)return null;
   if(entry.expiresAt*1000<=this.now())throw new CloudError('這輪的線上 Session 已到期，本機紀錄仍保留。','SESSION_EXPIRED');
   try{let result;try{result=await this.request('/v1/scores',entry.body,saved.player.playerToken);}catch(e){if(e.code==='SESSION_USED'&&e.receipt)result=e.receipt;else throw e;}
    if(!result?.submitted||!Array.isArray(result.notifications))throw new CloudError('成績回應尚未完整，請重試確認名次。','RANK_PENDING');
    const a=this.read();if(a.player?.playerId!==entry.playerId)throw new CloudError('匿名身分已變更。','IDENTITY_CHANGED');a.receipts[id]={...result,ownerPlayerId:entry.playerId};delete a.pendingScores[id];this.write(a);this.invalidateBoards();this.invalidateQuotes();return result;
   }catch(e){const a=this.read();if(a.player?.playerId===entry.playerId&&a.pendingScores?.[id]){a.pendingScores[id].lastError=e.message;a.pendingScores[id].status='pending';this.write(a);}throw e;}
  })();this.submitting.set(id,work);try{return await work;}finally{this.submitting.delete(id);}
 }
 abandonScore(id){const a=this.read();if(a.pendingScores?.[id]){a.pendingScores[id].status='abandoned';this.write(a);}}
 markNotified(id){const a=this.read();if(a.receipts[id]){a.receipts[id].notificationShown=true;this.write(a);}}
 async flushScores(){const result=[];for(const [id,entry]of Object.entries(this.read().pendingScores||{})){if(entry.status==='abandoned'||entry.expiresAt*1000<=this.now())continue;try{const receipt=await this.sendScore(id);if(receipt)result.push({id,receipt});}catch{}}return result;}
 invalidateBoards(){this.boardGeneration++;this.boardCache=null;this.boardPending=null;this.scopedBoards.clear();this.scopedBoardPending.clear();}
 async boards(mode=null,category=null){
  const token=this.read().player?.playerToken||null,generation=this.boardGeneration;
  if(this.boardCache?.token===token&&this.now()<this.boardCache.expiresAt)return this.boardCache.data;
  if(this.boardPending?.token===token&&this.boardPending.generation===generation)return this.boardPending.promise;
  const key=mode&&category?mode+':'+category:null,cached=key?this.scopedBoards.get(key):null,inflight=key?this.scopedBoardPending.get(key):null;
  if(cached?.token===token&&this.now()<cached.expiresAt)return cached.data;
  if(inflight?.token===token&&inflight.generation===generation)return inflight.promise;
  const pending={token,generation,promise:null};
  pending.promise=this.request('/v1/boards'+(key?'?mode='+encodeURIComponent(mode)+'&category='+encodeURIComponent(category):''),undefined,token).then(data=>{
   for(const m of ['life','free'])for(const o of ['won','financing','gain','reincarnation'])if(!Array.isArray(data.boards?.[m]?.[o]?.items))throw new CloudError('排行榜資料不完整，請重新連線。');
   if(this.boardGeneration===generation){const value={token,data,expiresAt:this.now()+BOARD_CACHE_MS};if(key)this.scopedBoards.set(key,value);else this.boardCache=value;}
   return data;
  }).finally(()=>{if(key){if(this.scopedBoardPending.get(key)===pending)this.scopedBoardPending.delete(key);}else if(this.boardPending===pending)this.boardPending=null;});
  if(key)this.scopedBoardPending.set(key,pending);else this.boardPending=pending;return pending.promise;
 }
 async leaderboard(mode,outcome='won'){return (await this.boards(mode,outcome)).boards[mode][outcome];}
 async rank(mode,outcome='won'){return {entry:(await this.boards(mode,outcome)).boards[mode][outcome].entry};}
 async share(record,requestId){const p=await this.identity();return this.request('/v1/shares',{requestId,record},p.playerToken);}
  async sharedRecord(id){return this.request('/v1/shares/'+encodeURIComponent(id));}
  async community(){return this.request('/v1/community',null,this.read().player?.playerToken);}
  async polls(page=0){return this.request('/v1/polls?page='+page,null,this.read().player?.playerToken);}
  async vote(id,choice){const p=await this.identity();return this.request('/v1/polls/'+encodeURIComponent(id)+'/vote',{choice},p.playerToken);}
  async complete(r){
   if(!['life','free'].includes(r.mode)||!['won','lost','bankrupt'].includes(r.status))return null;
   if(this.starting.has(r.id))try{await this.starting.get(r.id);}catch{}
   const saved=this.read(),session=saved.sessions[r.id];if(saved.completions?.[r.id]||!session||session.mode!==r.mode||!saved.player)return null;
   if(!saved.pendingCompletions?.[r.id]){saved.pendingCompletions??={};saved.pendingCompletions[r.id]={body:completionPayload(r,session,this.config),playerId:saved.player.playerId,expiresAt:session.expiresAt};this.write(saved);}
   return this.sendCompletion(r.id);
  }
  async sendCompletion(id){
   if(this.completing.has(id))return this.completing.get(id);
   const work=(async()=>{const saved=this.read(),entry=saved.pendingCompletions?.[id];if(!entry||entry.playerId!==saved.player?.playerId)return null;
    if(entry.expiresAt*1000<=this.now()){delete saved.pendingCompletions[id];this.write(saved);return null;}
    try{const result=await this.request('/v1/completions',entry.body,saved.player.playerToken),a=this.read();if(a.player?.playerId!==entry.playerId)return null;a.completions??={};a.completions[id]=true;if(a.pendingCompletions)delete a.pendingCompletions[id];this.write(a);return result;}
    catch(e){if(['SESSION_EXPIRED','INVALID_COMPLETION','INCOMPLETE_RUN','EDITION_MISMATCH','INVALID_FIELD','INVALID_KEYS'].includes(e.code)){const a=this.read();if(a.player?.playerId===entry.playerId&&a.pendingCompletions){delete a.pendingCompletions[id];this.write(a);}}throw e;}
   })();this.completing.set(id,work);try{return await work;}finally{this.completing.delete(id);}
  }
  async flushCompletions(){let latest=null;for(const id of Object.keys(this.read().pendingCompletions||{})){try{const result=await this.sendCompletion(id);if(result?.completions)latest=result;}catch{}}return latest;}
  invalidateQuotes(){this.quoteGeneration++;this.quoteCache=null;this.quotePending=null;}
  async quoteBoards(){
   const token=this.read().player?.playerToken||null,generation=this.quoteGeneration;
   if(this.quoteCache?.token===token&&this.now()<this.quoteCache.expiresAt)return this.quoteCache.data;
   if(this.quotePending?.token===token&&this.quotePending.generation===generation)return this.quotePending.promise;
   const pending={token,generation,promise:null};
   pending.promise=this.request('/v1/quote-boards',null,token).then(data=>{for(const tab of ['popular','latest','featured'])if(!Array.isArray(data.tabs?.[tab]?.items)||!data.self)throw new CloudError('金句資料不完整，請重新連線。');if(this.quoteGeneration===generation)this.quoteCache={token,data,expiresAt:this.now()+BOARD_CACHE_MS};return data;}).finally(()=>{if(this.quotePending===pending)this.quotePending=null;});this.quotePending=pending;return pending.promise;
  }
  async quotes(tab='popular'){const d=await this.quoteBoards();if(!d.tabs[tab])throw new CloudError('金句分類不正確。','INVALID_TAB');return {...d.tabs[tab],self:d.self};}
  async createQuote(text,author={}){const p=await this.identity(),result=await this.request('/v1/quotes',{text,...author},p.playerToken);this.invalidateQuotes();return result;}
  async updateQuote(id,text,author){const p=await this.identity();try{return await this.request('/v1/quotes/'+encodeURIComponent(id)+'/edit',{text,...author},p.playerToken);}finally{this.invalidateQuotes();}}
  async likeQuote(id,liked){const p=await this.identity(),result=await this.request('/v1/quotes/'+encodeURIComponent(id)+'/like',{liked},p.playerToken);this.invalidateQuotes();return result;}
  async announcement(){return this.request('/v1/announcement');}
 async feedback(body){const p=await this.identity();return this.request('/v1/feedback',body,p.playerToken);}
}
root.TaiguOnline={deviceType,KEY,BOARD_CACHE_MS,CloudError,Client,payload};
})(typeof window!=='undefined'?window:globalThis);
