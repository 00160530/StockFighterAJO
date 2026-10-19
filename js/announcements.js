(function(root){
'use strict';
function valid(a){return !!a&&typeof a.title==='string'&&a.title.length>0&&a.title.length<=120&&typeof a.body==='string'&&a.body.length>0&&a.body.length<=4000&&Number.isSafeInteger(a.publishedAt)&&a.publishedAt>0&&(a.imageUrl===undefined||typeof a.imageUrl==='string'&&a.imageUrl.length<=2048)&&(a.repeatDaily===undefined||typeof a.repeatDaily==='boolean');}
function seen(value){if(Number.isSafeInteger(value)&&value>0)return {publishedAt:value,day:''};return {publishedAt:Number.isSafeInteger(value?.publishedAt)&&value.publishedAt>0?value.publishedAt:0,day:typeof value?.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.day)?value.day:''};}
function dayKey(now=Date.now()){return new Date(now+8*60*60*1000).toISOString().slice(0,10);}
function unseen(a,last,now=Date.now()){if(!valid(a))return false;const s=seen(last);return a.publishedAt>s.publishedAt||a.publishedAt===s.publishedAt&&a.repeatDaily===true&&s.day!==dayKey(now);}
function mark(at,last,now=Date.now()){const s=seen(last);return Number.isSafeInteger(at)&&at>0&&at>=s.publishedAt?{publishedAt:at,day:dayKey(now)}:s;}
function imageLinks(value){
 if(typeof value!=='string'||value.length>2048||!value.trim())return null;
 let url;try{url=new URL(value.trim());}catch{return null;}
 if(url.protocol!=='https:'||url.username||url.password||url.href.length>2048)return null;
 if(['drive.google.com','docs.google.com'].includes(url.hostname)){
  const id=url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1]||(url.hostname==='drive.google.com'&&['/open','/uc','/thumbnail'].includes(url.pathname)?url.searchParams.get('id'):null);
  if(!id||!/^[-\w]{10,200}$/.test(id))return null;
  const thumbnail=new URL('https://drive.google.com/thumbnail');thumbnail.searchParams.set('id',id);thumbnail.searchParams.set('sz','w1600');const resourceKey=url.searchParams.get('resourcekey');if(resourceKey)thumbnail.searchParams.set('resourcekey',resourceKey);
  const src=thumbnail.href;thumbnail.searchParams.set('sz','w4000');return {src,large:thumbnail.href,original:url.href};
 }
 return {src:url.href,large:url.href,original:url.href};
}
function imageHTML(a,esc){const links=imageLinks(a?.imageUrl);if(!links)return '';return '<figure class="announcement-media"><button type="button" class="announcement-image-button" aria-label="放大公告圖片"><img src="'+esc(links.src)+'" alt="'+esc(a.title)+'的公告圖片" referrerpolicy="no-referrer" decoding="async"></button><figcaption><span class="announcement-image-hint">點擊圖片放大</span><a href="'+esc(links.original)+'" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer">開啟原始圖片 ↗</a></figcaption><p class="announcement-image-error" role="status" hidden>圖片暫時無法載入，可開啟原始圖片查看。</p></figure>';}
function openImage(a,trigger,{document:doc=root.document}={}){
 const links=imageLinks(a?.imageUrl);if(!links)return null;
 const dialog=doc.createElement('dialog');dialog.className='announcement-image-dialog';dialog.setAttribute('aria-label','公告圖片放大');
 const heading=doc.createElement('div');heading.className='dialog-heading';const title=doc.createElement('h2');title.textContent=a.title;const close=doc.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','關閉放大圖片');heading.append(title,close);
 const body=doc.createElement('div');body.className='announcement-image-stage';const image=doc.createElement('img');image.alt=a.title+'的公告圖片';image.referrerPolicy='no-referrer';const error=doc.createElement('p');error.hidden=true;error.textContent='圖片暫時無法載入，請開啟原始圖片查看。';error.setAttribute('role','status');body.append(image,error);
 const actions=doc.createElement('div');actions.className='announcement-image-actions';const original=doc.createElement('a');original.textContent='開啟原始圖片 ↗';original.href=links.original;original.target='_blank';original.rel='noopener noreferrer';original.referrerPolicy='no-referrer';actions.append(original);dialog.append(heading,body,actions);
 image.onload=()=>{image.hidden=false;error.hidden=true;};image.onerror=()=>{image.hidden=true;error.hidden=false;};image.src=links.large;
 close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();if(trigger?.isConnected)trigger.focus();},{once:true});dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});doc.body.append(dialog);dialog.showModal();return dialog;
}
function bindImages(container,a,options){for(const media of container.querySelectorAll('.announcement-media')){const button=media.querySelector('.announcement-image-button'),image=media.querySelector('img'),error=media.querySelector('.announcement-image-error'),hint=media.querySelector('.announcement-image-hint');button.onclick=()=>openImage(a,button,options);const failed=()=>{button.hidden=true;hint.hidden=true;error.hidden=false;};image.onerror=failed;if(image.complete&&!image.naturalWidth)failed();}}
root.TaiguAnnouncements={valid,seen,dayKey,unseen,mark,imageLinks,imageHTML,openImage,bindImages};
})(globalThis);
