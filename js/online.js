(function(root){
'use strict';
const KEY='taigu-warrior.v1.online';
const BOARD_CACHE_MS=5*60*1000;
class CloudError extends Error{constructor(message,code='NETWORK_ERROR',extra={}){super(message);Object.assign(this,{code,...extra});}}
function payload(r,session,config,nickname,avatarId=1,avatarCharacter='xiaojiu'){const cents=n=>Math.round(n*100),highlight=t=>t?{symbol:t.id,date:t.date,qty:t.qty,priceCents:cents(t.price),pnlCents:cents(t.pnl),...(Number.isFinite(t.costBasis)&&t.costBasis>0?{costBasisCents:cents(t.costBasis)}:{})}:null;const equityCents=cents(r.equity),benchmarkCents=cents(r.benchmark);return {sessionId:session.sessionId,sessionToken:session.sessionToken,nickname,avatarId,avatarCharacter,editionId:config.editionId,mode:r.mode,playTimeMs:r.playTimeMs??null,playTimePartial:r.playTimePartial===true,skillUses:r.skillUses??null,outcome:r.status,date:r.date,sessions:r.sessions,score:Math.round((equityCents-benchmarkCents)/10000),equityCents,benchmarkCents,drawdownBps:Math.round(r.maxDrawdown*100),trades:r.trades,buyTrades:r.buyTrades,sellTrades:r.sellTrades,maxGain:r.statsComplete?highlight(r.maxGain):null,maxLoss:r.statsComplete?highlight(r.maxLoss):null,...(r.margin?.totalBorrowed>0?{margin:{totalBorrowedCents:cents(r.margin.totalBorrowed),totalInterestCents:cents(r.margin.totalInterest),interestPaidCents:cents(r.margin.interestPaid),totalTopupsCents:cents(r.margin.totalTopups),liquidations:r.margin.liquidations,principalCents:cents(r.margin.principal),interestCents:cents(r.margin.interest),collateralCents:cents(r.margin.collateral)}}:{})};}
class Client{
 constructor({config,storage,fetcher=root.fetch?.bind(root),now=()=>Date.now()}){this.config=config;this.storage=storage;this.fetcher=fetcher;this.now=now;this.starting=new Map();this.completing=new Map();this.registering=null;this.boardCache=null;this.boardPending=null;this.boardGeneration=0;}
 get enabled(){return !!this.config?.apiBase&&/^https:\/\//.test(this.config.apiBase);}
 read(){try{const a=JSON.parse(this.storage.getItem(KEY)||'null');return a&&a.version===1&&a.sessions&&a.receipts?a:{version:1,sessions:{},receipts:{},player:null};}catch{return {version:1,sessions:{},receipts:{},player:null};}}
 write(a){try{this.storage.setItem(KEY,JSON.stringify(a));}catch{throw new CloudError('瀏覽器無法保留匿名身分，這輪仍可繼續本機遊玩。','STORAGE_UNAVAILABLE');}}
 async request(path,body,token){if(!this.enabled)throw new CloudError('線上服務尚未設定。','NOT_CONFIGURED');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);try{const response=await this.fetcher(this.config.apiBase+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,credentials:'omit'});let data;try{data=await response.json();}catch{throw new CloudError('服務回應異常，請稍後再試。');}if(!response.ok)throw new CloudError(data.error?.message||'線上服務暫時無法使用。',data.error?.code||'SERVICE_ERROR',data.error||{});return data;}catch(e){if(e instanceof CloudError)throw e;throw new CloudError('目前連不上線上服務，本機遊戲仍可繼續。');}finally{clearTimeout(timer);}}
 async identity(){const saved=this.read().player;if(saved?.playerToken)return saved;if(this.registering)return this.registering;this.registering=(async()=>{const data=await this.request('/v1/players',{}),a=this.read();a.player={playerId:data.playerId,playerToken:data.playerToken};this.write(a);return a.player;})().finally(()=>this.registering=null);return this.registering;}
 session(runId){return this.read().sessions[runId]||null;}
 receipt(runId){return this.read().receipts[runId]||null;}
 async start(s){if(!this.enabled||!s.runId)return null;if(this.session(s.runId))return this.session(s.runId);if(this.starting.has(s.runId))return this.starting.get(s.runId);if(s.day!==-1||s.status!=='playing')return null;
  const {runId,mode}=s;const work=(async()=>{const p=await this.identity(),session=await this.request('/v1/sessions',{runId,mode,editionId:this.config.editionId,startDay:-1},p.playerToken),a=this.read();a.sessions[runId]=session;const ids=Object.keys(a.sessions);if(ids.length>100)for(const id of ids.slice(0,-100))delete a.sessions[id];this.write(a);return session;})();this.starting.set(runId,work);try{return await work;}finally{this.starting.delete(runId);}
 }
 eligibility(r){if(this.receipt(r.id))return {ok:false,reason:'這輪已提交線上成績。',submitted:true};if(!['won','lost'].includes(r.status))return {ok:false,reason:'只有走到資料終點的完整結算輪次可以提交。'};const s=this.session(r.id);if(!s)return {ok:false,reason:'這輪沒有開局時建立的線上 Session，可保留本機紀錄；下次開新一輪時連線即可參與線上排行。'};if(s.editionId!==this.config.editionId||s.mode!==r.mode)return {ok:false,reason:'這輪的模式或行情版本不符。'};if(s.expiresAt*1000<=this.now())return {ok:false,reason:'這輪的線上 Session 已到期，本機紀錄仍保留。'};return {ok:true};}
 async submit(r,name,avatarId=1,avatarCharacter='xiaojiu'){const eligible=this.eligibility(r);if(!eligible.ok)throw new CloudError(eligible.reason,eligible.submitted?'ALREADY_SUBMITTED':'INELIGIBLE');const p=await this.identity();let result;try{result=await this.request('/v1/scores',payload(r,this.session(r.id),this.config,name,avatarId,avatarCharacter),p.playerToken);}catch(e){if(e.code==='SESSION_USED'&&e.receipt)result=e.receipt;else throw e;}const a=this.read();a.receipts[r.id]=result;a.nickname=name;a.avatarId=avatarId;a.avatarCharacter=avatarCharacter;this.write(a);this.invalidateBoards();return result;}
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
  async complete(r){const saved=this.read(),session=this.session(r.id);if(r.mode!=='life'||!['won','lost'].includes(r.status)||!session||saved.completions?.[r.id])return null;if(this.completing.has(r.id))return this.completing.get(r.id);const work=(async()=>{const p=await this.identity(),result=await this.request('/v1/completions',payload(r,session,this.config,'小韭'),p.playerToken),a=this.read();a.completions??={};a.completions[r.id]=true;this.write(a);return result;})();this.completing.set(r.id,work);try{return await work;}finally{this.completing.delete(r.id);}}
  async announcement(){return this.request('/v1/announcement');}
 async feedback(body){const p=await this.identity();return this.request('/v1/feedback',body,p.playerToken);}
}
root.TaiguOnline={KEY,BOARD_CACHE_MS,CloudError,Client,payload};
})(typeof window!=='undefined'?window:globalThis);
