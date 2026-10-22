export const PUBLIC_TTL_MS=30000;
const states=new WeakMap();
const cacheFor=env=>env.PUBLIC_CACHE??globalThis.caches?.default;
export const hasPublicCache=env=>!!cacheFor(env);
function state(env){let s=states.get(env.DB);if(!s){s={generation:0,pending:new Map(),keys:new Set()};states.set(env.DB,s);}return s;}
export async function publicData(request,env,key,load){
 const cache=cacheFor(env);if(!cache)return {data:await load(),createdAt:Date.now(),status:'BYPASS'};
 const s=state(env),url=new URL('/__sf_public_cache/v01632-opt2/'+encodeURIComponent(key),request.url),cacheKey=new Request(url);s.keys.add(url.href);
 try{const hit=await cache.match(cacheKey);if(hit){const item=await hit.json();if(item.expiresAt>Date.now())return {...item,data:structuredClone(item.data),status:'HIT'};}}catch{}
 const generation=s.generation,pendingKey=generation+':'+url.href;
 if(s.pending.has(pendingKey))return structuredClone(await s.pending.get(pendingKey));
 const work=(async()=>{const data=await load(),createdAt=Date.now(),item={data,createdAt,expiresAt:createdAt+PUBLIC_TTL_MS};
  if(s.generation===generation)try{await cache.put(cacheKey,new Response(JSON.stringify(item),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=30'}}));}catch{}
  return {...item,status:'MISS'};
 })();s.pending.set(pendingKey,work);try{return structuredClone(await work);}finally{s.pending.delete(pendingKey);}
}
// Cache API deletion is local to the serving colo. Other colos expire within the TTL.
export async function invalidatePublic(env){const cache=cacheFor(env);if(!cache)return;const s=state(env);s.generation++;const keys=[...s.keys];s.keys.clear();await Promise.allSettled(keys.map(key=>cache.delete(new Request(key))));}
