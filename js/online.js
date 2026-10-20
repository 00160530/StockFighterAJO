(function(root){
'use strict';
const KEY='taigu-warrior.v1.online';
const BOARD_CACHE_MS=5*60*1000;
function completionPayload(r,session,config){const cents=n=>Math.round(n*100);if(r.status!=='bankrupt')return {...payload(r,session,config,'小韭'),cashCents:cents(r.cash)};return {sessionId:session.sessionId,sessionToken:session.sessionToken,editionId:config.editionId,mode:r.mode,outcome:r.status,playTimeMs:r.playTimeMs??null,playTimePartial:r.playTimePartial===true,date:r.date,startDate:r.startDate,customStartDate:r.customStartDate??null,earlySettlementDate:r.earlySettlementDate??null,dateJumps:r.dateJumps??[],sessions:r.sessions,equityCents:cents(r.equity),benchmarkCents:cents(r.benchmark),cashCents:r.cash<0?Math.min(-1,cents(r.cash)):cents(r.cash)};}
class CloudError extends Error{constructor(message,code='NETWORK_ERROR',extra={}){super(message);Object.assign(this,{code,...extra});}}
function payload(r,session,config,nickname,avatarId=1,avatarCharacter='xiaojiu'){const cents=n=>Math.round(n*100),highlight=t=>t?{symbol:t.id,date:t.date,qty:t.qty,priceCents:cents(t.price),pnlCents:cents(t.pnl),...(Number.isFinite(t.costBasis)&&t.costBasis>0?{costBasisCents:cents(t.costBasis)}:{})}:null;const equityCents=cents(r.equity),benchmarkCents=cents(r.benchmark);return {sessionId:session.sessionId,sessionToken:session.sessionToken,nickname,avatarId,avatarCharacter,editionId:config.editionId,mode:r.mode,playTimeMs:r.playTimeMs??null,playTimePartial:r.playTimePartial===true,skillUses:r.skillUses??null,startDate:r.startDate,customStartDate:r.customStartDate??null,earlySettlementDate:r.earlySettlementDate??null,...(r.dateJumps?.length?{dateJumps:r.dateJumps.map(j=>({...j}))}:{}),outcome:r.status,date:r.date,sessions:r.sessions,score:Math.round((equityCents-benchmarkCents)/10000),equityCents,benchmarkCents,drawdownBps:Math.round(r.maxDrawdown*100),trades:r.trades,buyTrades:r.buyTrades,sellTrades:r.sellTrades,maxGain:r.statsComplete?highlight(r.maxGain):null,maxLoss:r.statsComplete?highlight(r.maxLoss):null,...(r.margin?.totalBorrowed>0?{margin:{totalBorrowedCents:cents(r.margin.totalBorrowed),totalInterestCents:cents(r.margin.totalInterest),interestPaidCents:cents(r.margin.interestPaid),totalTopupsCents:cents(r.margin.totalTopups),liquidations:r.margin.liquidations,principalCents:cents(r.margin.principal),interestCents:cents(r.margin.interest),collateralCents:cents(r.margin.collateral)}}:{})};}
class Client{
 constructor({config,storage,fetcher=root.fetch?.bind(root),now=()=>Date.now()}){this.config=config;this.storage=storage;this.fetcher=fetcher;this.now=now;this.starting=new Map();this.completing=new Map();this.registering=null;this.boardCache=null;this.boardPending=null;this.boardGeneration=0;this.quoteGeneration=0;this.quoteCache=null;this.quotePending=null;}
 get enabled(){const base=this.config?.apiBase||'',local=['127.0.0.1','localhost','[::1]'].includes(root.location?.hostname);return /^https:\/\//.test(base)||(local&&/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::[0-9]{1,5})?(?:\/|$)/.test(base));}
 read(){try{const a=JSON.parse(this.storage.getItem(KEY)||'null');return a&&a.version===1&&a.sessions&&a.receipts?a:{version:1,sessions:{},receipts:{},player:null};}catch{return {version:1,sessions:{},receipts:{},player:null};}}
 write(a){try{this.storage.setItem(KEY,JSON.stringify(a));}catch{throw new CloudError('瀏覽器無法保留匿名身分，這輪仍可繼續本機遊玩。','STORAGE_UNAVAILABLE');}}
 async request(path,body,token){if(!this.enabled)throw new CloudError('線上服務尚未設定。','NOT_CONFIGURED');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await this.fetcher(this.config.apiBase+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,credentials:'omit'});let data;try{data=await response.json();}catch{throw new CloudError('服務回應異常，請稍後再試。');}if(!response.ok)throw new CloudError(data.error?.message||'線上服務暫時無法使用。',data.error?.code||'SERVICE_ERROR',data.error||{});return data;}catch(e){if(e instanceof CloudError)throw e;throw new CloudError('目前連不上線上服務，本機遊戲仍可繼續。');}finally{clearTimeout(timer);}}
 async identity(){const saved=this.read().player;if(saved?.playerToken)return saved;if(this.registering)return this.registering;this.registering=(async()=>{const data=await this.request('/v1/players',{}),a=this.read();a.player={playerId:data.playerId,playerToken:data.playerToken};this.write(a);return a.player;})().finally(()=>this.registering=null);return this.registering;}
 async profile(){const p=await this.identity();if(this.profilePending?.token===p.playerToken)return this.profilePending.promise;const pending={token:p.playerToken,promise:null};pending.promise=this.request('/v1/profile',undefined,p.playerToken).then(profile=>{if(profile.nickname!==null&&typeof profile.nickname!=='string')throw new CloudError('玩家暱稱資料不完整，請重新連線。');const a=this.read();if(a.player?.playerToken===p.playerToken){if(profile.nickname){a.nickname=a.lockedNickname=profile.nickname;}else delete a.lockedNickname;this.write(a);}return profile;}).catch(e=>{if(this.profilePending===pending)this.profilePending=null;throw e;});this.profilePending=pending;return pending.promise;}
 session(runId){return this.read().sessions[runId]||null;}
 receipt(runId){return this.read().receipts[runId]||null;}
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
 eligibility(r){if(this.receipt(r.id))return {ok:false,reason:'這輪已提交線上成績。',submitted:true};if(!['won','lost'].includes(r.status))return {ok:false,reason:'只有走到資料終點的完整結算輪次可以提交。'};const s=this.session(r.id);if(!s)return {ok:false,reason:'這輪沒有開局時建立的線上 Session，可保留本機紀錄；下次開新一輪時連線即可參與線上排行。'};if((s.editionId!==this.config.editionId&&!this.config.compatibleEditionIds?.includes(s.editionId))||s.mode!==r.mode)return {ok:false,reason:'這輪的模式或行情版本不符。'};if(s.expiresAt*1000<=this.now())return {ok:false,reason:'這輪的線上 Session 已到期，本機紀錄仍保留。'};return {ok:true};}
 async submit(r,name,avatarId=1,avatarCharacter='xiaojiu'){const locked=this.read().lockedNickname;if(locked&&name!==locked)throw new CloudError('暱稱在第一次成功提交後即固定，無法修改。','NICKNAME_LOCKED',{nickname:locked});const eligible=this.eligibility(r);if(!eligible.ok)throw new CloudError(eligible.reason,eligible.submitted?'ALREADY_SUBMITTED':'INELIGIBLE');const p=await this.identity();let result;try{result=await this.request('/v1/scores',payload(r,this.session(r.id),this.config,name,avatarId,avatarCharacter),p.playerToken);}catch(e){if(e.code==='SESSION_USED'&&e.receipt)result=e.receipt;else{if(e.code==='NICKNAME_LOCKED'&&e.nickname){const a=this.read();a.nickname=a.lockedNickname=e.nickname;this.write(a);this.profilePending=null;}throw e;}}const a=this.read();a.receipts[r.id]=result;a.nickname=a.lockedNickname=result.nickname||result.rank?.nickname||name;this.profilePending=null;a.avatarId=avatarId;a.avatarCharacter=avatarCharacter;this.write(a);this.invalidateBoards();this.invalidateQuotes();return result;}
 invalidateBoards(){this.boardGeneration++;this.boardCache=null;this.boardPending=null;}
 async boards(){
  const token=this.read().player?.playerToken||null,generation=this.boardGeneration;
  if(this.boardCache?.token===token&&this.now()<this.boardCache.expiresAt)return this.boardCache.data;
  if(this.boardPending?.token===token&&this.boardPending.generation===generation)return this.boardPending.promise;
  const pending={token,generation,promise:null};
  pending.promise=this.request('/v1/boards',undefined,token).then(data=>{
   for(const m of ['life','free'])for(const o of ['won','lost'])if(!Array.isArray(data.boards?.[m]?.[o]?.items))throw new CloudError('排行榜資料不完整，請重新連線。');
   if(this.boardGeneration===generation)this.boardCache={token,data,expiresAt:this.now()+BOARD_CACHE_MS};
   return data;
  }).finally(()=>{if(this.boardPending===pending)this.boardPending=null;});
  this.boardPending=pending;return pending.promise;
 }
 async leaderboard(mode,outcome='won'){return (await this.boards()).boards[mode][outcome];}
 async rank(mode,outcome='won'){return {entry:(await this.boards()).boards[mode][outcome].entry};}
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
root.TaiguOnline={KEY,BOARD_CACHE_MS,CloudError,Client,payload};
})(typeof window!=='undefined'?window:globalThis);
