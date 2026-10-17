const encoder=new TextEncoder();
export class ApiError extends Error{constructor(status,code,message,extra={}){super(message);Object.assign(this,{status,code,extra});}}
export const fail=(status,code,message,extra)=>{throw new ApiError(status,code,message,extra);};
export const nowSeconds=()=>Math.floor(Date.now()/1000);
export function randomToken(){const a=crypto.getRandomValues(new Uint8Array(32));return [...a].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function hmac(secret,value){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function readJson(request,max=8192){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON_REQUIRED','請使用 JSON 格式。');
 if(Number(request.headers.get('content-length'))>max)fail(413,'BODY_TOO_LARGE','送出的內容太長了。');
 const reader=request.body?.getReader();if(!reader)fail(400,'INVALID_JSON','缺少送出內容。');let length=0,parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();fail(413,'BODY_TOO_LARGE','送出的內容太長了。');}parts.push(value);}}finally{reader.releaseLock();}
 try{const all=new Uint8Array(length);let offset=0;for(const p of parts){all.set(p,offset);offset+=p.length;}const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{fail(400,'INVALID_JSON','送出內容不是有效的 JSON。');}
}
export function exactKeys(body,allowed){if(Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'UNKNOWN_FIELD','送出的欄位不正確。');}
export function integer(v,min,max,name){if(!Number.isSafeInteger(v)||v<min||v>max)fail(400,'INVALID_NUMBER',name+'超出有效範圍。');return v;}
export function text(v,min,max,name,multiline=false){if(typeof v!=='string')fail(400,'INVALID_TEXT',name+'格式不正確。');const s=v.normalize('NFC').trim();if([...s].length<min||[...s].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(s)||(!multiline&&/[\r\n\t]/.test(s)))fail(400,'INVALID_TEXT',name+'長度或內容不正確。');return s;}
export function nickname(v){const s=text(v,2,16,'暱稱');if(!/^[\p{L}\p{N} _.-]+$/u.test(s))fail(400,'INVALID_NICKNAME','暱稱限 2–16 字，可用中英文、數字、空格、_、- 或 .。');return s;}
export function uuid(v){if(typeof v!=='string'||!/^[a-zA-Z0-9_-]{8,120}$/.test(v))fail(400,'INVALID_ID','識別碼格式不正確。');return v;}
export async function player(request,env){const bearer=request.headers.get('authorization')||'';if(!/^Bearer [a-f0-9]{64}$/.test(bearer))fail(401,'PLAYER_REQUIRED','請重新整理後再試。');const row=await env.DB.prepare('SELECT id,banned FROM sf_players WHERE token_hash=?').bind(await hash(bearer.slice(7))).first();if(!row||row.banned)fail(401,'PLAYER_REQUIRED','匿名身分無法使用，請聯絡作者。');return row.id;}
export async function rate(env,key,limit,period,now){const bucket=key+':'+Math.floor(now/period),end=(Math.floor(now/period)+1)*period;const row=await env.DB.prepare('INSERT INTO sf_rate_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(bucket,end,limit).first();if(!row)fail(429,'RATE_LIMITED','操作太頻繁，請稍後再試。',{retryAfter:Math.max(1,end-now)});}
export async function ipKey(request,env){if(!env.RATE_LIMIT_SECRET)fail(503,'NOT_CONFIGURED','服務尚未完成設定。');return hmac(env.RATE_LIMIT_SECRET,request.headers.get('CF-Connecting-IP')||'local-development');}
