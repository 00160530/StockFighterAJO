import {exactKeys,fail,text} from './security.mjs';
const query=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const row=r=>({id:r.id,version:r.version,date:r.release_date,title:r.title,summary:r.summary,details:JSON.parse(r.details),revision:r.revision});
export async function readUpdates(env){
 const {results}=await query(env,'SELECT * FROM sf_update_announcements WHERE deleted=0 ORDER BY release_date DESC,updated_at DESC,id DESC').all();
 return results.map(row).sort((a,b)=>b.date.localeCompare(a.date)||b.version.localeCompare(a.version,undefined,{numeric:true}));
}
export async function saveUpdate(env,body,actor,id=null,at=Date.now()){
 exactKeys(body,['version','date','title','summary','details','revision']);
 const version=text(body.version,1,24,'版本'),date=text(body.date,10,10,'更新日期'),title=text(body.title,1,120,'更新標題'),summary=text(body.summary,1,1000,'更新摘要');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)fail(400,'INVALID_DATE','請選擇有效日期。');
 if(!Array.isArray(body.details)||body.details.length<1||body.details.length>30)fail(400,'INVALID_DETAILS','請填寫 1–30 項更新內容。');
 const details=body.details.map(s=>text(s,1,1000,'更新內容')),key=id||crypto.randomUUID();
 if(id&&!Number.isSafeInteger(body.revision))fail(400,'INVALID_REVISION','請重新讀取公告後再儲存。');
 const sql=id?'UPDATE sf_update_announcements SET version=?,release_date=?,title=?,summary=?,details=?,updated_at=?,updated_by=?,revision=revision+1 WHERE id=? AND deleted=0 AND revision=?':'INSERT INTO sf_update_announcements(version,release_date,title,summary,details,updated_at,updated_by,id) VALUES (?,?,?,?,?,?,?,?)';
 const statements=[query(env,sql,version,date,title,summary,JSON.stringify(details),at,actor,key,...(id?[body.revision]:[])),query(env,"INSERT INTO sf_admin_audit(id,actor,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0",crypto.randomUUID(),actor,id?'update-announcement-edit':'update-announcement-create',key,Math.floor(at/1000))];
 const result=await env.DB.batch(statements);if(!result[0].meta.changes)fail(409,'UPDATE_CONFLICT','這則公告已被修改或刪除，請重新讀取後再試。');
 return row(await query(env,'SELECT * FROM sf_update_announcements WHERE id=?',key).first());
}
export async function deleteUpdate(env,body,actor,id,at=Date.now()){
 exactKeys(body,['revision','confirm']);if(body.confirm!==true||!Number.isSafeInteger(body.revision))fail(400,'INVALID_CONFIRMATION','請確認要刪除的公告。');
 const result=await env.DB.batch([query(env,'UPDATE sf_update_announcements SET deleted=1,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND deleted=0 AND revision=?',at,actor,id,body.revision),query(env,"INSERT INTO sf_admin_audit(id,actor,action,target_id,created_at) SELECT ?,?,?,?,? WHERE changes()>0",crypto.randomUUID(),actor,'update-announcement-delete',id,Math.floor(at/1000))]);
 if(!result[0].meta.changes)fail(409,'UPDATE_CONFLICT','這則公告已被修改或刪除，請重新讀取後再試。');
 return {deleted:true};
}
