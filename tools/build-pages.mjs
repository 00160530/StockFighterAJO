import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),target=path.resolve(root,process.argv[2]||'work/pages');
if(!target.startsWith(path.join(root,'work')+path.sep))throw Error('Pages build must be within project work/');
fs.mkdirSync(target,{recursive:true});
for(const name of ['index.html','.nojekyll','assets','css','data','js'])fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true});
console.log('Pages artifact contains only frontend HTML, JS, CSS, data and assets; backend and credentials are excluded.');
