import fs from 'node:fs';
import path from 'node:path';

export function apiBase(value=''){
 if(typeof value!=='string')throw Error('apiBase must be a string');
 if(!value.trim())return '';
 const u=new URL(value.trim());
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||/your-worker|your-subdomain|example\.(com|test|invalid)/i.test(u.hostname))throw Error('Set your own HTTPS API URL without credentials, query or fragment.');
 return u.href.replace(/\/+$/,'');
}
export function repositoryUrl(value=''){
 if(!value)return '';
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Invalid repository URL');return u.href;
}
export function readConfig(file){
 const text=fs.readFileSync(file,'utf8'),match=text.match(/^\s*window\.TAIGU_ONLINE_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
 if(!match)throw Error('Config must assign a JSON object to window.TAIGU_ONLINE_CONFIG: '+file);
 return JSON.parse(match[1]);
}
export function serializeConfig(config){return 'window.TAIGU_ONLINE_CONFIG = '+JSON.stringify(config,null,2).replaceAll('<','\\u003c')+';\n';}
export function publicConfig(config,overrides={}){
 // Only these public fields may enter the browser. Never copy environment objects.
 return {apiBase:apiBase(overrides.apiBase??config.apiBase??''),editionId:config.editionId,datasetId:config.datasetId,version:config.version,repositoryUrl:repositoryUrl(overrides.repositoryUrl??config.repositoryUrl??'')};
}
export function resolveConfig(root,env=process.env){
 const source=readConfig(path.join(root,'data/online-config.js')),localFile=path.join(root,'data/online-config.local.js');
 const local=fs.existsSync(localFile)?readConfig(localFile):{};
 const config=publicConfig(source,{
  apiBase:Object.hasOwn(env,'TAIGU_API_BASE')?env.TAIGU_API_BASE:local.apiBase??source.apiBase,
  repositoryUrl:Object.hasOwn(env,'TAIGU_REPOSITORY_URL')?env.TAIGU_REPOSITORY_URL:local.repositoryUrl??(env.GITHUB_REPOSITORY?(env.GITHUB_SERVER_URL||'https://github.com')+'/'+env.GITHUB_REPOSITORY:source.repositoryUrl)
 });
 if(env.TAIGU_REQUIRE_ONLINE==='true'&&!config.apiBase)throw Error('TAIGU_REQUIRE_ONLINE is true but TAIGU_API_BASE is empty. Deployment stopped.');
 return config;
}

export function smokeOptions(args){
 const values={};for(let i=0;i<args.length;i++){const k=args[i];if(k==='--write'){if(values.write)throw Error('Duplicate --write');values.write=true;continue;}if(!['--base','--origin','--confirm-target','--report'].includes(k)||!args[i+1]||args[i+1].startsWith('--')||Object.hasOwn(values,k))throw Error('Use --base URL --origin ORIGIN [--write --confirm-target URL] [--report FILE]');values[k]=args[++i];}
 const base=new URL(values['--base']),origin=new URL(values['--origin']);
 const allowed=u=>u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname));
 if(!allowed(base)||base.username||base.password||base.search||base.hash||/your-|example\./i.test(base.hostname))throw Error('Invalid test target');
 if(!allowed(origin)||origin.href!==origin.origin+'/')throw Error('Origin must be scheme + hostname + optional port, without a repository path');
 const target=base.href.replace(/\/+$/,'');
 if(values.write&&values['--confirm-target']!==target)throw Error('Writing requires --confirm-target exactly matching --base (without trailing slash).');
 if(!values.write&&values['--confirm-target'])throw Error('--confirm-target requires --write');
 return {base:target,origin:origin.origin,write:!!values.write,report:values['--report']};
}
