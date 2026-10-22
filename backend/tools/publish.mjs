import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {credentialTarget} from './credential-target.mjs';
import {importForTarget} from './import-update-announcements.mjs';
const backend=path.resolve(import.meta.dirname,'..'),target=credentialTarget(process.argv.slice(2),backend);
if(target.mode!=='--remote')throw Error('Publication requires --remote with an explicitly confirmed database. Use updates:import for local testing.');
// Fail before deployment if new announcements cannot be imported. Retries preserve existing IDs.
console.log('Release announcements: '+JSON.stringify(await importForTarget(target)));
const result=spawnSync(process.execPath,[path.join(backend,'node_modules/wrangler/bin/wrangler.js'),'deploy','--config',target.config],{cwd:backend,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
