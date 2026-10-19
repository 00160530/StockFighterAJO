import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveConfig,serializeConfig} from './deployment-config.mjs';
const project=path.resolve(import.meta.dirname,'..');
export function buildPages({root=project,target=path.join(root,'work/pages'),env=process.env}={}){
 root=path.resolve(root);target=path.resolve(target);
 const work=path.join(root,'work'),relative=path.relative(work,target);
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Pages build must be within project work/');
 // Verify every existing ancestor before recursive cleanup; reject junctions/symlinks.
 for(let p=target;p!==root;p=path.dirname(p))if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Pages target cannot pass through a symlink');
 const config=resolveConfig(root,env);
 fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
 const safe=p=>{
  const info=fs.lstatSync(p),relative=path.relative(root,p).split(path.sep).join('/');
  if(info.isSymbolicLink()||relative.split('/').some(n=>n.startsWith('.')||['backend','node_modules','work'].includes(n)||/\.(?:local|private|example)\./.test(n)))return false;
  if(info.isDirectory())return true;
  if(relative.startsWith('js/'))return path.extname(p)==='.js';
  if(relative.startsWith('css/'))return path.extname(p)==='.css';
  if(relative.startsWith('Art/'))return /\.(html|css|js|json|txt|png|webp|jpg|jpeg|gif|svg)$/.test(p);
  return /\.(png|webp|svg|wav|mp3|ogg)$/.test(p)||['assets/audio/manifest.json','assets/audio/scores.json'].includes(relative);
 };
 for(const name of ['index.html','.nojekyll'])fs.copyFileSync(path.join(root,name),path.join(target,name));
 for(const name of ['assets','css','js'])fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true,filter:safe});
 if(fs.existsSync(path.join(root,'Art')))fs.cpSync(path.join(root,'Art'),path.join(target,'Art'),{recursive:true,filter:safe});
 fs.mkdirSync(path.join(target,'data'));
 for(const name of ['market.js','news.js','group.js','updates.js','provenance.json'])fs.copyFileSync(path.join(root,'data',name),path.join(target,'data',name));
 fs.writeFileSync(path.join(target,'data/online-config.js'),serializeConfig(config));
 return {target,online:!!config.apiBase};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=buildPages({target:path.resolve(project,process.argv[2]||'work/pages')});
 console.log('Pages artifact ready; online features '+(result.online?'configured.':'not configured (single-player works).'));
}
