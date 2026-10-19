import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './db.mjs';import {handle} from '../src/api.mjs';import {hash} from '../src/security.mjs';
const origin='https://player.github.io',base='https://api.example.test',token='d'.repeat(64);
async function setup(){const DB=database(),env={DB,RATE_LIMIT_SECRET:'test-announcements',ALLOWED_ORIGINS:origin};DB.db.prepare('INSERT INTO sf_admin_credentials VALUES (?,?,?,?,?)').run('test-owner','00','00',100000,1);DB.db.prepare('INSERT INTO sf_admin_sessions VALUES (?,?,?,?)').run(await hash(token),'test-owner',1,9999999999);
 const call=async(body,{admin=true,source=base,header=true,path='/admin/api/announcement'}={})=>{const response=await handle(new Request(base+path,{method:body?'POST':'GET',headers:{Origin:source,'Content-Type':'application/json',...(admin?{Cookie:'sf_admin='+token}:{}),...(header?{'X-Admin-Action':'1'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);assert.notEqual(response.status,500,DB.errors.join('\n'));return {status:response.status,data:await response.json(),headers:response.headers};};return {DB,env,call};}
const content={title:'圖片公告',body:'第一段\n第二段',imageUrl:'https://images.example.test/announcement.webp',repeatDaily:true};
test('admin image and daily settings round-trip through the public API without exposing administrator identity',async()=>{
 const a=await setup();assert.equal((await a.call()).data.announcement,null);
 assert.equal((await a.call(content,{admin:false})).status,401);assert.equal((await a.call(content,{source:origin})).status,403);assert.equal((await a.call(content,{header:false})).status,403);
 const saved=await a.call(content);assert.equal(saved.status,200);const result=saved.data.announcement;for(const key of Object.keys(content))assert.equal(result[key],content[key]);
 const pub=await a.call(null,{admin:false,path:'/v1/announcement',source:origin});assert.equal(pub.status,200);assert.deepEqual(pub.data.announcement,result);assert.equal(pub.headers.get('Cache-Control'),'no-store');assert.equal(pub.headers.get('Access-Control-Allow-Origin'),origin);assert.ok(!('updated_by' in result));
 const row=a.DB.db.prepare('SELECT * FROM sf_announcement').get();assert.equal(row.repeat_daily,1);assert.equal(row.image_url,content.imageUrl);assert.equal(row.updated_by,'test-owner');
});
test('legacy admin updates preserve image and daily options; explicit empty image and false turn them off',async()=>{
 const a=await setup(),first=(await a.call(content)).data.announcement;
 const legacy=(await a.call({title:'舊版管理更新',body:'保留圖片設定'})).data.announcement;assert.equal(legacy.imageUrl,content.imageUrl);assert.equal(legacy.repeatDaily,true);assert.ok(legacy.publishedAt>first.publishedAt);
 const cleared=(await a.call({...content,imageUrl:'',repeatDaily:false})).data.announcement;assert.equal(cleared.imageUrl,'');assert.equal(cleared.repeatDaily,false);assert.ok(cleared.publishedAt>legacy.publishedAt);
 assert.equal(a.DB.db.prepare('SELECT COUNT(*) n FROM sf_announcement').get().n,1);
});
test('image and daily validation reject malformed input without replacing the existing announcement',async()=>{
 const a=await setup();await a.call(content);const before=a.DB.db.prepare('SELECT * FROM sf_announcement').get();
 for(const imageUrl of ['javascript:alert(1)','data:image/png;base64,aaa','http://images.example.test/a.jpg','https://user:pass@images.example.test/a.jpg','not a url','https://drive.google.com/drive/folders/abcdefghijklmnop','https://docs.google.com/document/d/abcdefghijklmnop/edit',null,123,'https://images.example.test/'+ 'a'.repeat(2048)]){const result=await a.call({...content,imageUrl});assert.equal(result.status,400,String(imageUrl));}
 for(const repeatDaily of ['true',1,null,{}])assert.equal((await a.call({...content,repeatDaily})).status,400);
 assert.equal((await a.call({...content,imageUrl:'https://images.example.test/'+ '圖'.repeat(300)})).status,400);
 assert.equal((await a.call({...content,unknown:true})).status,400);assert.deepEqual(a.DB.db.prepare('SELECT * FROM sf_announcement').get(),before);
});
test('Google shared-file and direct image URLs are accepted unchanged, including resource keys and signed query parameters',async()=>{
 const a=await setup();for(const imageUrl of ['https://drive.google.com/file/d/abcdefghijklmnop_123-456/view?usp=sharing&resourcekey=0-AbCd','https://drive.google.com/open?id=abcdefghijklmnop','https://drive.google.com/uc?id=abcdefghijklmnop&export=view','https://docs.google.com/file/d/abcdefghijklmnop/view','https://images.example.test/a.jpg?signature=A%2BB&expires=5'])assert.equal((await a.call({...content,imageUrl})).data.announcement.imageUrl,imageUrl);
});
test('image migration preserves an existing publication and admin credentials and defaults to no image and once-only',()=>{
 let before,credentials;const {db}=database({beforeMigration(db,name){if(!name.startsWith('0018_'))return;db.prepare('INSERT INTO sf_announcement VALUES (1,?,?,?,?)').run('原本公告','原本文字',123456,'原本管理員');db.prepare('INSERT INTO sf_admin_credentials VALUES (?,?,?,?,?)').run('existing','salt','hash',100000,1);before=db.prepare('SELECT * FROM sf_announcement').get();credentials=db.prepare('SELECT * FROM sf_admin_credentials').get();}});
 const after=db.prepare('SELECT * FROM sf_announcement').get();for(const key of Object.keys(before))assert.equal(after[key],before[key]);assert.equal(after.image_url,'');assert.equal(after.repeat_daily,0);assert.deepEqual(db.prepare('SELECT * FROM sf_admin_credentials').get(),credentials);db.close();
});
