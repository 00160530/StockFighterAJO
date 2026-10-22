import {hash,text,fail} from './security.mjs';

const TTL=60000,states=new WeakMap();
const cacheFor=env=>env.ADMIN_COUNTS_CACHE??globalThis.caches?.default;
function state(env){let s=states.get(env.DB);if(!s){s={generation:0,pending:new Map(),keys:new Set(),revisions:new Map()};states.set(env.DB,s);}return s;}
export function countOptions(request,params){
 const fresh=text(params.get('fresh')||'',0,80,'重新整理');if(fresh&&!/^[a-zA-Z0-9-]+$/.test(fresh))fail(400,'INVALID_FILTER','查詢條件不正確。');
 return {request,fresh};
}
// Call only after admin authentication. Cache numerical aggregates, never admin/player responses.
export async function adminCount(env,key,load,{request,fresh=''}={}){
 const cache=cacheFor(env);if(!cache||!request)return load();
 const s=state(env),url=new URL('/__sf_admin_counts/v01632/'+await hash(key),request.url),requestKey=new Request(url);s.keys.add(url.href);
 // Bound the local key registry; evicted Cache API entries expire within 60 seconds.
 if(s.keys.size>256){const oldest=s.keys.values().next().value;s.keys.delete(oldest);s.revisions.delete(oldest);}
 try{const hit=await cache.match(requestKey);if(hit){const value=await hit.json();if(value.expiresAt>Date.now()&&(!fresh||value.fresh===fresh))return structuredClone(value.data);}}catch{}
 const generation=s.generation,pendingKey=generation+':'+url.href+':'+fresh;
 if(s.pending.has(pendingKey))return structuredClone(await s.pending.get(pendingKey));
 const revision=(s.revisions.get(url.href)||0)+1;s.revisions.set(url.href,revision);
 const work=(async()=>{const data=await load();if(!data||!Object.values(data).every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('Invalid admin aggregate');
  if(generation===s.generation&&revision===s.revisions.get(url.href))try{await cache.put(requestKey,new Response(JSON.stringify({data,fresh,expiresAt:Date.now()+TTL}),{headers:{'Content-Type':'application/json','Cache-Control':'max-age=60'}}));}catch{}
  return data;
 })();s.pending.set(pendingKey,work);try{return structuredClone(await work);}finally{s.pending.delete(pendingKey);}
}
export function readAdminOverview(env,options){return adminCount(env,'overview',()=>env.DB.prepare("SELECT (SELECT COUNT(*) FROM sf_feedback WHERE status='new') AS unread,(SELECT COUNT(*) FROM sf_feedback) AS feedback,(SELECT COUNT(*) FROM sf_runs WHERE hidden=0) AS runs,(SELECT COUNT(*) FROM sf_players) AS players").first(),options);}
export async function invalidateAdminCounts(env,request){const cache=cacheFor(env);if(!cache)return;const s=state(env);s.generation++;if(request)s.keys.add(new URL('/__sf_admin_counts/v01632/'+await hash('overview'),request.url).href);const keys=[...s.keys];s.keys.clear();s.revisions.clear();await Promise.allSettled(keys.map(key=>cache.delete(new Request(key))));}
