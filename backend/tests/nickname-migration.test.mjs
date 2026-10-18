import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
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
