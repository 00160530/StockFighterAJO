import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {credentialTarget} from './credential-target.mjs';
import {syncUpdates} from '../../tools/sync-update-announcements.mjs';
const backend=path.resolve(import.meta.dirname,'..');
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";

// Run only during publication. Existing IDs include deleted tombstones and manual edits.
export async function importReleaseUpdates({execute,releases,at=Date.now()}){
 if(!Array.isArray(releases)||new Set(releases.map(r=>r.id)).size!==releases.length)throw Error('Invalid release IDs');
 let inserted=0,missingCount=0;
 for(let i=0;i<releases.length;i+=50){
  const batch=releases.slice(i,i+50),result=await execute('SELECT id FROM sf_update_announcements WHERE id IN ('+batch.map(r=>literal(r.id)).join(',')+');');
  const existing=new Set(result.flatMap(r=>r.results||[]).map(r=>r.id)),missing=batch.filter(r=>!existing.has(r.id));
  missingCount+=missing.length;if(!missing.length)continue;
  const statements=missing.map(r=>'INSERT INTO sf_update_announcements(id,version,release_date,title,summary,details,updated_at,updated_by) VALUES ('+[r.id,r.version,r.date,r.title,r.summary,JSON.stringify(r.details)].map(literal).join(',')+','+at+",'release') ON CONFLICT(id) DO NOTHING RETURNING id;");
  let sql='';
  const flush=async()=>{if(!sql)return;const written=await execute(sql);inserted+=written.reduce((n,r)=>n+(r.results?r.results.length:r.meta?.changes||0),0);sql='';};
  for(const statement of statements){if(statement.length>24000)throw Error('Release announcement exceeds publication query limit');if(sql.length+statement.length>24000)await flush();sql+=statement+'\n';}await flush();
 }
 return {total:releases.length,missing:missingCount,inserted};
}

export function d1Executor(target){return async sql=>{
 const r=spawnSync(process.execPath,[path.join(backend,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','DB',target.mode,'--config',target.config,...(target.persistTo?['--persist-to',target.persistTo]:[]),'--command',sql,'--json'],{cwd:backend,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}});
 if(r.status!==0)throw Error('Release import failed. Check Wrangler login, DB binding and migrations.');
 const result=JSON.parse(r.stdout);if(!Array.isArray(result)||result.some(r=>r.success===false))throw Error('Release import failed');return result;
};}

export async function importForTarget(target){
 syncUpdates(path.resolve(backend,'..'));
 const releases=JSON.parse(fs.readFileSync(path.join(backend,'src/release-updates.json'),'utf8'));
 return importReleaseUpdates({execute:d1Executor(target),releases});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const target=credentialTarget(process.argv.slice(2),backend);
 console.log(JSON.stringify(await importForTarget(target)));
}
