import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function database({beforeMigration=()=>{}}={}){const db=new DatabaseSync(':memory:');for(const name of fs.readdirSync(new URL('../migrations/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort()){beforeMigration(db,name);db.exec(fs.readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));}const errors=[];
 function prepared(sql,args=[]){const run=()=>{try{return db.prepare(sql);}catch(e){errors.push(e.message+' '+sql);throw e;}};return {sql,args,bind(...values){return prepared(sql,values);},async first(){try{return run().get(...args)||null;}catch(e){errors.push(e.message+' '+sql);throw e;}},async all(){try{return {results:run().all(...args)};}catch(e){errors.push(e.message+' '+sql);throw e;}},async run(){try{const r=run().run(...args);return {success:true,meta:{changes:Number(r.changes)}};}catch(e){errors.push(e.message+' '+sql);throw e;}}};}
 // D1 batches are transactions and concurrent requests execute sequentially.
 let pending=Promise.resolve();
 return {db,errors,prepare:sql=>prepared(sql),batch(queries){const result=pending.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const results=[];for(const q of queries)results.push(await q.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}});pending=result.catch(()=>{});return result;}};
}
