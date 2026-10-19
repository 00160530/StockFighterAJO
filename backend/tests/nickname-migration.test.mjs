import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {database} from './db.mjs';
test('nickname migration keeps historical runs intact and uses the earliest name even when moderated',()=>{
 const db=new DatabaseSync(':memory:'),dir=new URL('../migrations/',import.meta.url),names=fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).sort();
 for(const name of names.filter(n=>n<'0014'))db.exec(fs.readFileSync(new URL(name,dir),'utf8'));
 db.prepare('INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)').run('old','hash-old',1);
 db.prepare('INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)').run('new','hash-new',1);
 for(const [id,name,time,hidden] of [['b','最初名字',10,1],['a','後來名字',20,0]]){
  db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run(id,'old',id,id,'life','legacy',1,1000);
  db.prepare('INSERT INTO sf_runs(id,session_id,player_id,edition,mode,nickname,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,highlights,submitted_at,hidden) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,id,'old','legacy','life',name,'lost',0,100,100,0,0,'{}',time,hidden);
 }
 const before=db.prepare('SELECT * FROM sf_runs ORDER BY id').all();
 db.exec(fs.readFileSync(new URL('0014_fixed_player_nickname.sql',dir),'utf8'));
 assert.equal(db.prepare('SELECT nickname FROM sf_players WHERE id=?').get('old').nickname,'最初名字');
 assert.equal(db.prepare('SELECT nickname FROM sf_players WHERE id=?').get('new').nickname,null);
 assert.deepEqual(db.prepare('SELECT * FROM sf_runs ORDER BY id').all(),before);db.close();
});

test('unique-name migration preserves all legacy records and duplicates while protecting new assignments',()=>{
 let before;
 const snapshot=db=>Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sf_%' ORDER BY name").all().map(({name})=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
 const {db}=database({beforeMigration(db,name){if(!name.startsWith('0017_'))return;
  for(const id of ['legacy-one','legacy-two']){
   db.prepare('INSERT INTO sf_players(id,token_hash,created_at,nickname) VALUES (?,?,?,?)').run(id,id,1,'既有同名');
   db.prepare('INSERT INTO sf_sessions(id,player_id,run_id,token_hash,mode,edition,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run(id,id,id,id,'life','legacy',1,9999999999);
   db.prepare('INSERT INTO sf_runs(id,session_id,player_id,edition,mode,nickname,outcome,score,equity_cents,benchmark_cents,drawdown_bps,trades,highlights,submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,id,id,'legacy','life','既有同名','lost',0,100,100,0,0,'{}',1);
   db.prepare('INSERT INTO sf_stock_quotes(id,player_id,body,nickname,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(id,id,'原本的金句','既有同名',1,2);
  }
  db.prepare('INSERT INTO sf_stock_quote_likes VALUES (?,?,?)').run('legacy-one','legacy-two',3);
  before=snapshot(db);
 }});
 assert.deepEqual(snapshot(db),before);
 db.prepare('UPDATE sf_players SET nickname=nickname,banned=1 WHERE id=?').run('legacy-one');
 db.prepare('INSERT INTO sf_players(id,token_hash,created_at) VALUES (?,?,?)').run('new','new',1);
 assert.throws(()=>db.prepare('UPDATE sf_players SET nickname=? WHERE id=?').run('既有同名','new'),/SF_NICKNAME_TAKEN/);
 assert.throws(()=>db.prepare('INSERT INTO sf_players(id,token_hash,created_at,nickname) VALUES (?,?,?,?)').run('newer','newer',1,'既有同名'),/SF_NICKNAME_TAKEN/);
 db.prepare('UPDATE sf_players SET nickname=? WHERE id=?').run('新名字','new');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM sf_players WHERE nickname=?').get('既有同名').n,2);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM sf_stock_quote_likes').get().n,1);db.close();
});
