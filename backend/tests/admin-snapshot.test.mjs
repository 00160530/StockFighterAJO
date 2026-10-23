import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {database} from './db.mjs';import {handle} from '../src/api.mjs';import {hash} from '../src/security.mjs';
function lib(){const ctx=vm.createContext({structuredClone,Date});vm.runInContext(fs.readFileSync(new URL('../admin/snapshot.txt',import.meta.url),'utf8'),ctx);return ctx.TaiguAdminSnapshot;}
test('query snapshots retain all rows indefinitely for local use, deduplicate clicks, and refresh only explicit queries after 30 seconds',async()=>{
 const {createStore,rows}=lib();let now=0,calls=0;const store=createStore(async()=>{calls++;await new Promise(r=>setImmediate(r));return {items:Array.from({length:125},(_,i)=>({id:String(i),nickname:'股友'+i,created_at:i,last_seen_at:i,life_completed_count:i%3,free_completed_count:0,upload_count:i%2,last_device_type:i%2?'mobile':'desktop'})),total:125,fetchedAt:1};},()=>now);
 await Promise.all(Array.from({length:10},()=>store.query('players')));assert.equal(calls,1);const snapshot=store.peek('players');now=120000;assert.equal(rows('players',snapshot.items,{device:'mobile'}).length,62);assert.equal(rows('players',snapshot.items,{device:'mobile'}).slice(50,100).length,12);assert.equal(calls,1);await store.query('players');assert.equal(calls,2);await store.query('players');assert.equal(calls,2);await store.query('players',{force:true});assert.equal(calls,3);assert.equal(store.peek('players').items.length,125);
});
test('filters and sorting operate on the snapshot, preserve literal text and numeric ordering, and never mutate original order',()=>{
 const {rows}=lib(),items=[{id:'02',nickname:'A_%',player_id:'p-2',hidden:0,mode:'life',financing:1,device_type:'tablet',gain_cents:20,submitted_at:1,margin_summary:'{"totalBorrowedCents":200}'},{id:'01',nickname:'Alpha',player_id:'p-1',hidden:1,mode:'free',financing:0,device_type:'mobile',gain_cents:100,submitted_at:2,margin_summary:'{}'}];assert.equal(rows('runs',items,{q:'_%'}).length,1);assert.equal(rows('runs',items,{status:'active',mode:'life',device:'tablet',financing:'margin',playerId:'p-2'})[0].id,'02');assert.deepEqual([...rows('runs',items,{sort:'gain'})].map(r=>r.id),['01','02']);assert.deepEqual(items.map(r=>r.id),['02','01']);
});
test('logout clears snapshot data and prevents late requests from installing the previous admin data',async()=>{
 const {createStore}=lib();let release;const store=createStore(()=>new Promise(r=>release=r));const old=store.query('runs');store.clear();release({items:[{id:'old'}],total:1});await old;assert.equal(store.peek('runs'),null);await assert.rejects(createStore(async()=>({items:[],total:2})).query('players'),/完整資料/);
});

test('snapshot text comparisons preserve SQLite ASCII folding and code-point nickname ordering',()=>{
 const {rows}=lib(),DB=database(),names=['a股友','B股友','Ä股友','ä股友','\uE000股友','𠀀股友'];
 names.forEach((nickname,i)=>DB.db.prepare('INSERT INTO sf_players(id,token_hash,nickname,created_at) VALUES (?,?,?,1)').run(String(i),String(i),nickname));
 const items=DB.db.prepare('SELECT id,nickname FROM sf_players').all();
 assert.deepEqual([...rows('players',items,{sort:'nickname'})].map(r=>r.id),DB.db.prepare('SELECT id FROM sf_players ORDER BY nickname COLLATE NOCASE,id').all().map(r=>r.id));
 for(const q of ['A','Ä','ä'])assert.deepEqual([...rows('players',items,{q,sort:'nickname'})].map(r=>r.id),DB.db.prepare("SELECT id FROM sf_players WHERE nickname LIKE ? ORDER BY nickname COLLATE NOCASE,id").all('%'+q+'%').map(r=>r.id));
});
test('admin all-data endpoints return every row and current persisted counters, bypass page filters, and protect credentials',async()=>{
 const DB=database(),token='c'.repeat(64);DB.db.prepare('INSERT INTO sf_admin_credentials VALUES (?,?,?,?,?)').run('owner','00','00',100000,1);DB.db.prepare('INSERT INTO sf_admin_sessions VALUES (?,?,?,?)').run(await hash(token),'owner',1,9999999999);for(let i=0;i<125;i++)DB.db.prepare('INSERT INTO sf_players(id,token_hash,created_at,nickname) VALUES (?,?,1,?)').run('snapshot-'+i,'hash-'+i,'玩家'+i);
 const req=async(path,auth=true)=>{const r=await handle(new Request('https://admin.test/admin/api/'+path,{headers:auth?{Cookie:'sf_admin='+token}:{}}),{DB,RATE_LIMIT_SECRET:'test'});return {status:r.status,data:await r.json()};};const r=await req('players/all?page=20&q=none&device=mobile');assert.equal(r.status,200);assert.equal(r.data.items.length,125);assert.equal(r.data.total,125);assert.equal(r.data.items[0].life_completed_count,0);assert.ok(!JSON.stringify(r.data).includes('token_hash'));assert.equal((await req('players/all',false)).status,401);assert.equal((await req('runs/all',false)).status,401);
});
