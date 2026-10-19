import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={URL};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/announcements.js',import.meta.url),'utf8'),c);
test('only a later publication shows a new popup; unknown, unchanged and earlier announcements do not',()=>{const a={title:'更新公告',body:'更新內容',publishedAt:1000};assert.equal(c.TaiguAnnouncements.unseen(a,0),true);assert.equal(c.TaiguAnnouncements.unseen(a,1000),false);assert.equal(c.TaiguAnnouncements.unseen(a,2000),false);assert.equal(c.TaiguAnnouncements.unseen({...a,publishedAt:2001},2000),true);for(const bad of [null,{}, {...a,publishedAt:'1000'},{...a,body:''},{...a,publishedAt:-1}])assert.equal(c.TaiguAnnouncements.unseen(bad,0),false);});

const {seen,dayKey,mark,unseen,imageLinks,imageHTML,openImage,bindImages}=c.TaiguAnnouncements;
const announcement={title:'新公告',body:'公告內容',publishedAt:1000,repeatDaily:true};
const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
test('daily reminders use Taiwan calendar midnight, survive a reload and never override a later publication receipt',()=>{
 const before=Date.parse('2026-10-19T15:59:59Z'),after=Date.parse('2026-10-19T16:00:00Z'),receipt=JSON.parse(JSON.stringify(mark(1000,0,before)));
 assert.equal(dayKey(before),'2026-10-19');assert.equal(dayKey(after),'2026-10-20');
 assert.equal(unseen(announcement,receipt,before),false);assert.equal(unseen(announcement,receipt,after),true);
 const today=mark(1000,receipt,after);assert.equal(unseen(announcement,today,after+3600000),false);
 assert.equal(unseen({...announcement,repeatDaily:false},receipt,after),false);
 assert.equal(unseen({...announcement,publishedAt:1001},receipt,before),true);
 assert.equal(unseen(announcement,{publishedAt:1001,day:'2020-01-01'},after),false);
 assert.equal(mark(1000,{publishedAt:1001,day:'2026-10-19'},after).publishedAt,1001);
 assert.equal(dayKey(Date.parse('2026-12-31T16:00:00Z')),'2027-01-01');assert.equal(dayKey(Date.parse('2028-02-28T16:00:00Z')),'2028-02-29');
});
test('legacy numeric receipts remain once-only, daily opt-in can remind once and damaged storage is normalized',()=>{
 const now=Date.parse('2026-10-19T03:00:00Z');assert.equal(unseen({...announcement,repeatDaily:false},1000,now),false);
 assert.equal(unseen(announcement,1000,now),true);assert.equal(unseen(announcement,mark(1000,1000,now),now),false);
 for(const value of [null,{},'1000',-1,{publishedAt:'1000',day:123}])assert.equal(seen(value).publishedAt,0);
 for(const invalid of [{repeatDaily:'true'},{imageUrl:123},{imageUrl:'x'.repeat(2049)}])assert.equal(unseen({...announcement,...invalid},0,now),false);
});
test('direct HTTPS images retain signed parameters and Google single-file sharing links keep resource keys',()=>{
 const direct='https://images.example.test/a.webp?signature=AbC%2B123&expires=200';assert.equal(imageLinks(direct).src,direct);
 const id='abcdefghijklmnop_123-456';for(const link of ['https://drive.google.com/file/d/'+id+'/view?usp=sharing&resourcekey=0-AbCd','https://drive.google.com/open?id='+id,'https://drive.google.com/uc?export=view&id='+id,'https://docs.google.com/file/d/'+id+'/edit']){
  const result=imageLinks(link),src=new URL(result.src);assert.equal(src.origin,'https://drive.google.com');assert.equal(src.pathname,'/thumbnail');assert.equal(src.searchParams.get('id'),id);assert.equal(src.searchParams.get('sz'),'w1600');assert.equal(new URL(result.large).searchParams.get('sz'),'w4000');assert.equal(result.original,link);if(link.includes('resourcekey='))assert.equal(src.searchParams.get('resourcekey'),'0-AbCd');
 }
});
test('image rendering escapes title and URL attributes, omits empty or unsafe links and offers a failure fallback',()=>{
 for(const link of ['',null,'not a url','javascript:alert(1)','data:image/svg+xml,<svg/>','http://images.example.test/a.jpg','https://user:pass@images.example.test/a.jpg','https://drive.google.com/drive/folders/abcdefghijklmnop','https://docs.google.com/document/d/abcdefghijklmnop/edit'])assert.equal(imageLinks(link),null);
 assert.equal(imageHTML({...announcement,imageUrl:''},esc),'');
 const html=imageHTML({...announcement,title:'<img onerror="bad">',imageUrl:'https://images.example.test/a.jpg?x="&y=1'},esc);
 assert.ok(html.includes('&lt;img onerror=&quot;bad&quot;&gt;'));assert.ok(!html.includes('alt="<img'));assert.ok(html.includes('&amp;y=1'));assert.ok(html.includes('referrerpolicy="no-referrer"'));assert.ok(html.includes('放大公告圖片'));assert.ok(html.includes('開啟原始圖片'));assert.ok(html.includes('圖片暫時無法載入'));
});

class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.attributes={};this.hidden=false;}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 emit(name,event={}){for(const fn of this.listeners[name]||[])fn(event);}
 showModal(){this.open=true;}
 close(){this.open=false;this.emit('close');}
 remove(){this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}
 focus(){this.focused=true;}
 get isConnected(){return !!this.parent;}
}
test('enlarging opens a separate modal, displays full image with original link, handles failure and returns focus on close',()=>{
 const doc={body:new Element('body'),createElement:tag=>new Element(tag)},trigger=new Element('button');doc.body.append(trigger);
 const a={...announcement,title:'<b>公告</b>',imageUrl:'https://images.example.test/a.jpg'},dialog=openImage(a,trigger,{document:doc});
 assert.equal(dialog.open,true);assert.equal(doc.body.children.length,2);assert.equal(dialog.children[0].children[0].textContent,a.title);
 const [image,error]=dialog.children[1].children;assert.equal(image.src,a.imageUrl);assert.equal(image.referrerPolicy,'no-referrer');assert.equal(error.hidden,true);
 image.onerror();assert.equal(image.hidden,true);assert.equal(error.hidden,false);image.onload();assert.equal(image.hidden,false);assert.equal(error.hidden,true);
 assert.equal(dialog.children[2].children[0].href,a.imageUrl);assert.equal(dialog.children[2].children[0].rel,'noopener noreferrer');
 dialog.children[0].children[1].onclick();assert.equal(dialog.open,false);assert.equal(doc.body.children.length,1);assert.equal(trigger.focused,true);
 const escaped=openImage(a,trigger,{document:doc});escaped.close();assert.equal(doc.body.children.length,1);
 const outside=openImage(a,trigger,{document:doc});outside.emit('click',{target:outside});assert.equal(outside.open,false);
});
test('failed inline images leave the announcement text usable and show the original-link fallback',()=>{
 const button=new Element('button'),image=new Element('img'),error=new Element('p'),hint=new Element('span'),nodes={'.announcement-image-button':button,img:image,'.announcement-image-error':error,'.announcement-image-hint':hint};error.hidden=true;image.complete=true;image.naturalWidth=0;
 bindImages({querySelectorAll:()=>[{querySelector:key=>nodes[key]}]},announcement);assert.equal(button.hidden,true);assert.equal(hint.hidden,true);assert.equal(error.hidden,false);
});

test('the title-screen announcement flow marks a visible popup immediately and reopens only on the next Taiwan day',async()=>{
 const store=new Map();let now=Date.parse('2026-10-19T15:59:59Z');
 const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8'),flow=app.slice(app.indexOf('let announcement=null,'),app.indexOf('const nextTitleQuip='));
 function context(){const shown=[],dialog={open:false,dataset:{}},elements={utilityDialog:dialog,utilityContent:{querySelectorAll:()=>[]},latestAnnouncement:{},announcementDone:{}};
  const sandbox={URL,Date:class extends Date{static now(){return now;}},KEY:'test',esc,screen:'title',incomingShare:null,shareLoading:false,window:{TAIGU_UPDATES:[]},TaiguCommunity:{latest:()=>null},online:{enabled:true,announcement:async()=>({announcement:{...announcement,imageUrl:'https://images.example.test/a.jpg'}})},document:{querySelector:()=>dialog.open?dialog:null},localStorage:{getItem:key=>store.get(key)},writeStorage:(key,value)=>store.set(key,JSON.stringify(value)),$:key=>elements[key],utility:(title,html,view)=>{shown.push({title,html});dialog.open=true;dialog.dataset.view=view;}};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(new URL('../js/announcements.js',import.meta.url),'utf8'),sandbox);vm.runInContext(flow,sandbox);return {sandbox,shown,dialog};
 }
 const first=context();vm.runInContext('checkAnnouncement()',first.sandbox);await vm.runInContext('announcementLoading',first.sandbox);
 assert.equal(first.shown.length,1);assert.ok(first.shown[0].html.includes('announcement-image-button'));assert.ok(first.shown[0].html.includes('announcement-actions'));
 assert.equal(JSON.parse(store.get('test.announcementSeenAt')).day,'2026-10-19');first.dialog.open=false;vm.runInContext('tryAnnouncement()',first.sandbox);assert.equal(first.shown.length,1);
 const reload=context();vm.runInContext('checkAnnouncement()',reload.sandbox);await vm.runInContext('announcementLoading',reload.sandbox);assert.equal(reload.shown.length,0);
 now=Date.parse('2026-10-19T16:00:00Z');vm.runInContext('tryAnnouncement()',reload.sandbox);assert.equal(reload.shown.length,1);assert.equal(JSON.parse(store.get('test.announcementSeenAt')).day,'2026-10-20');
});
