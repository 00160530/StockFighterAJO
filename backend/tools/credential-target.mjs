import fs from 'node:fs';
import path from 'node:path';
export function credentialTarget(args,root){
 const mode=args.shift();if(!['--local','--remote'].includes(mode))throw Error('Specify --local or --remote and --config FILE. Supply credentials privately on stdin.');
 const values={};for(let i=0;i<args.length;i+=2){if(!['--config','--confirm-database','--persist-to'].includes(args[i])||!args[i+1]||values[args[i]])throw Error('Invalid target arguments');values[args[i]]=args[i+1];}
 if(!values['--config'])throw Error('Explicit --config FILE is required');
 const config=path.resolve(root,values['--config']);
 // Templates intentionally use strict JSON (also valid JSONC); no code is evaluated.
 const settings=JSON.parse(fs.readFileSync(config,'utf8').replace(/^\uFEFF/,'')),db=settings.d1_databases?.find(x=>x.binding==='DB');
 if(!db||!settings.name)throw Error('Config must specify Worker name and DB binding');
 if(mode==='--remote'&&(!/^[a-f0-9]{32}$/i.test(settings.account_id||'')||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(db.database_id||'')||values['--confirm-database']!==db.database_id))throw Error('Remote credentials require your account_id, database_id and matching --confirm-database ID.');
 if(mode==='--remote'&&values['--persist-to'])throw Error('--persist-to is only for local testing');
 return {mode,config,databaseId:db.database_id,worker:settings.name,persistTo:values['--persist-to']};
}
