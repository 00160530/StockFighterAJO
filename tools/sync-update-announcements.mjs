import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function syncUpdates(root=path.resolve(import.meta.dirname,'..'),check=false){
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/updates.js'),'utf8'),context,{timeout:1000});
 const items=context.window.TAIGU_UPDATES;
 if(!Array.isArray(items)||!items.length||new Set(items.map(r=>r.id)).size!==items.length)throw Error('Invalid release updates');
 const output=JSON.stringify(items,null,2)+'\n',target=path.join(root,'backend/src/release-updates.json');
 if(check){if(fs.readFileSync(target,'utf8')!==output)throw Error('Run node tools/sync-update-announcements.mjs before publishing.');}
 else fs.writeFileSync(target,output);
 return items.length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(syncUpdates(undefined,process.argv.includes('--check'))+' update announcements synchronized.');
