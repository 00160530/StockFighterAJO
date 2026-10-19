import {exactKeys,fail,text} from './security.mjs';
const query=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const fields='title,body,published_at,image_url,repeat_daily';
const publicRow=r=>r?{title:r.title,body:r.body,publishedAt:r.published_at,imageUrl:r.image_url,repeatDaily:r.repeat_daily===1}:null;
export async function readAnnouncement(env){return publicRow(await query(env,'SELECT '+fields+' FROM sf_announcement WHERE id=1').first());}
function imageURL(value){
 const s=text(value,0,2048,'公告圖片連結');if(!s)return '';
 let url;try{url=new URL(s);}catch{fail(400,'INVALID_IMAGE_URL','請填入 HTTPS 圖片網址或 Google 雲端圖片分享連結。');}
 if(url.protocol!=='https:'||url.username||url.password)fail(400,'INVALID_IMAGE_URL','公告圖片須使用不含帳密的 HTTPS 網址。');
 if(url.href.length>2048)fail(400,'INVALID_IMAGE_URL','圖片網址過長，請使用較短的分享連結。');
 if(['drive.google.com','docs.google.com'].includes(url.hostname)){
  const id=url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]||(url.hostname==='drive.google.com'&&['/open','/uc','/thumbnail'].includes(url.pathname)?url.searchParams.get('id'):null);
  if(!id||!/^[-\w]{10,200}$/.test(id))fail(400,'INVALID_IMAGE_URL','請貼上單一圖片檔案的 Google 雲端分享連結，不能使用資料夾或文件連結。');
 }
 return url.href;
}
export async function publishAnnouncement(env,body,actor,at=Date.now()){
 exactKeys(body,['title','body','imageUrl','repeatDaily']);const title=text(body.title,1,60,'公告標題'),content=text(body.body,1,2000,'公告內容',true),hasImage=Object.hasOwn(body,'imageUrl'),hasDaily=Object.hasOwn(body,'repeatDaily');
 const image=hasImage?imageURL(body.imageUrl):'';
 if(hasDaily&&typeof body.repeatDaily!=='boolean')fail(400,'INVALID_ANNOUNCEMENT','每天顯示一次必須是開啟或關閉。');
 const row=await query(env,`INSERT INTO sf_announcement(id,title,body,published_at,updated_by,image_url,repeat_daily) VALUES (1,?,?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,published_at=MAX(sf_announcement.published_at+1,excluded.published_at),updated_by=excluded.updated_by,
 image_url=CASE WHEN ? THEN excluded.image_url ELSE sf_announcement.image_url END,
 repeat_daily=CASE WHEN ? THEN excluded.repeat_daily ELSE sf_announcement.repeat_daily END
 RETURNING ${fields}`,title,content,at,actor,image,body.repeatDaily===true?1:0,+hasImage,+hasDaily).first();
 return publicRow(row);
}
