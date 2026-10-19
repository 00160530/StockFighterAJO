import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './db.mjs';
import {handle} from '../src/api.mjs';
import {hash} from '../src/security.mjs';
import {importReleases} from '../src/update-announcements.mjs';
import releases from '../src/release-updates.json' with {type:'json'};
import {syncUpdates} from '../../tools/sync-update-announcements.mjs';
const base='https://api.example.test',origin='https://player.github.io',token='a'.repeat(64);
async function setup(){
 const DB=database(),env={DB,RATE_LIMIT_SECRET:'updates-test-only',ALLOWED_ORIGINS:origin};
 DB.db.prepare('INSERT INTO sf_admin_credentials VALUES (?,?,?,?,?)').run('owner','00','00',100000,1);
 DB.db.prepare('INSERT INTO sf_admin_sessions VALUES (?,?,?,?)').run(await hash(token),'owner',1,9999999999);
 const call=async(path='/admin/api/updates',body=null,authorized=true,source=base)=>{
  const response=await handle(new Request(base+path,{method:body?'POST':'GET',headers:{Origin:source,'Content-Type':'application/json','X-Admin-Action':'1',...(authorized?{Cookie:'sf_admin='+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
  assert.notEqual(response.status,500,DB.errors.join('\n'));return {status:response.status,data:await response.json()};
 };return {DB,env,call};
}
const content={version:'1.0.0',date:'2026-10-19',title:'自訂更新',summary:'首頁更新摘要',details:['第一項','第二項']};
test('all historical releases import exactly once and are publicly readable without admin metadata',async()=>{
 syncUpdates(undefined,true);const a=await setup();assert.equal((await a.call()).data.items.length,releases.length);
 await importReleases({...a.env,DB:{prepare:a.DB.prepare,batch:a.DB.batch}});
 const pub=await a.call('/v1/announcement',null,false,origin);assert.equal(pub.data.updates.length,releases.length);
 for(const entry of releases){const found=pub.data.updates.find(r=>r.id===entry.id);for(const key of ['version','date','title','summary','details'])assert.deepEqual(found[key],entry[key]);assert.ok(!('updated_by'in found));}
});
test('admin CRUD changes the public feed; reimports preserve manual edits and deleted tombstones',async()=>{
 const a=await setup(),initial=(await a.call()).data.items[0];
 const edited=await a.call('/admin/api/updates/'+initial.id,{...content,revision:initial.revision});assert.equal(edited.status,200);
 await importReleases({...a.env,DB:{prepare:a.DB.prepare,batch:a.DB.batch}});
 assert.equal((await a.call()).data.items.find(r=>r.id===initial.id).title,content.title);
 const created=(await a.call('/admin/api/updates',content)).data.item;assert.ok(created.id);
 assert.equal((await a.call('/admin/api/updates/'+created.id+'/delete',{confirm:true,revision:created.revision})).status,200);
 assert.equal((await a.call('/admin/api/updates/'+initial.id+'/delete',{confirm:true,revision:edited.data.item.revision})).status,200);
 await importReleases({...a.env,DB:{prepare:a.DB.prepare,batch:a.DB.batch}});
 const pub=(await a.call('/v1/announcement',null,false,origin)).data.updates;
 assert.ok(!pub.some(r=>r.id===created.id||r.id===initial.id));
 assert.equal(a.DB.db.prepare('SELECT deleted FROM sf_update_announcements WHERE id=?').get(initial.id).deleted,1);
 assert.deepEqual(a.DB.db.prepare('SELECT action FROM sf_admin_audit ORDER BY rowid').all().map(r=>r.action),['update-announcement-edit','update-announcement-create','update-announcement-delete','update-announcement-delete']);
});
test('authentication, CSRF, validation and concurrent edits cannot corrupt announcements',async()=>{
 const a=await setup();assert.equal((await a.call('/admin/api/updates',content,false)).status,401);
 assert.equal((await a.call('/admin/api/updates',content,true,origin)).status,403);
 for(const change of [{date:'2026-02-30'},{date:'bad'},{details:[]},{details:['']},{details:['x'.repeat(1001)]},{title:''},{unknown:true}])assert.equal((await a.call('/admin/api/updates',{...content,...change})).status,400);
 const r=(await a.call('/admin/api/updates',content)).data.item,path='/admin/api/updates/'+r.id;
 const edits=await Promise.all([a.call(path,{...content,title:'管理員甲',revision:r.revision}),a.call(path,{...content,title:'管理員乙',revision:r.revision})]);
 assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
 assert.equal((await a.call(path+'/delete',{confirm:true,revision:r.revision})).status,409);
 assert.equal(a.DB.db.prepare("SELECT COUNT(*) n FROM sf_admin_audit WHERE target_id=?").get(r.id).n,2);
 assert.equal((await a.call(path+'/delete',{confirm:false,revision:2})).status,400);
});
test('empty managed archive is authoritative and migration preserves author announcement and credentials',async()=>{
 const a=await setup();await a.call();a.DB.db.prepare('UPDATE sf_update_announcements SET deleted=1').run();
 assert.deepEqual((await a.call('/v1/announcement',null,false,origin)).data.updates,[]);
 assert.equal(a.DB.db.prepare('SELECT username FROM sf_admin_credentials').get().username,'owner');
 assert.equal((await a.call('/admin/api/announcement',{title:'保留作者公告',body:'保留圖片與每日顯示設定',imageUrl:'https://image.example.test/a.webp',repeatDaily:true})).status,200);
 const pub=(await a.call('/v1/announcement',null,false,origin)).data;
 assert.equal(pub.announcement.repeatDaily,true);assert.deepEqual(pub.updates,[]);
});
