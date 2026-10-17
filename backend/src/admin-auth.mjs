import {fail,hash,randomToken,rate,ipKey,text} from './security.mjs';
const encoder=new TextEncoder(),COOKIE='sf_admin';
function bytes(s){return Uint8Array.from(s.match(/.{2}/g)||[],n=>parseInt(n,16));}
export async function derivePassword(password,salt,iterations){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return [...new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:bytes(salt),iterations},key,256))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function adminCookie(token,clear=false){return COOKIE+'='+(clear?'':token)+'; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age='+(clear?0:28800);}
function cookieToken(request){const pair=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));const token=pair?.slice(COOKIE.length+1);return token&&/^[a-f0-9]{64}$/.test(token)?token:null;}
export async function adminIdentity(request,env,now){const token=cookieToken(request);if(!token)fail(401,'ADMIN_LOGIN_REQUIRED','請先登入管理後台。');const row=await env.DB.prepare('SELECT username FROM sf_admin_sessions WHERE token_hash=? AND expires_at>?').bind(await hash(token),now).first();if(!row)fail(401,'ADMIN_LOGIN_REQUIRED','登入已過期，請重新登入。');return row.username;}
export async function adminLogin(request,env,body,now){
 if(Object.keys(body).some(k=>!['username','password'].includes(k)))fail(400,'INVALID_LOGIN','登入內容不正確。');
 const ip=await ipKey(request,env);await rate(env,'admin-login:'+ip,10,900,now);
 const username=text(body.username,1,40,'帳號'),password=typeof body.password==='string'?body.password:'';if(password.length<6||password.length>128)fail(401,'LOGIN_FAILED','帳號或密碼不正確。');
 const row=await env.DB.prepare('SELECT * FROM sf_admin_credentials WHERE username=?').bind(username).first();
 const computed=await derivePassword(password,row?.salt||'f'.repeat(32),row?.iterations||100000);
 if(!row||!equal(computed,row.password_hash))fail(401,'LOGIN_FAILED','帳號或密碼不正確。');
 const token=randomToken();await env.DB.prepare('INSERT INTO sf_admin_sessions(token_hash,username,created_at,expires_at) VALUES (?,?,?,?)').bind(await hash(token),username,now,now+28800).run();return {username,cookie:adminCookie(token)};
}
export async function adminLogout(request,env){const token=cookieToken(request);if(token)await env.DB.prepare('DELETE FROM sf_admin_sessions WHERE token_hash=?').bind(await hash(token)).run();return adminCookie('',true);}
