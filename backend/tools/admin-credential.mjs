// Supply {"username":"...","password":"..."} as private JSON on stdin.
// Never put passwords in arguments or commit the input file.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {derivePassword} from '../src/admin-auth.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!['--local','--remote'].includes(process.argv[2])||process.argv.length!==3)throw Error('Use --local or --remote; supply credentials as private JSON on stdin.');
let input='';for await(const part of process.stdin){input+=part;if(input.length>4096)throw Error('Input too large');}
const {username,password}=JSON.parse(input);input='';
if(typeof username!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(username)||typeof password!=='string'||password.length<6||password.length>128)throw Error('Invalid credentials');
const salt=randomBytes(16).toString('hex'),iterations=100000,digest=await derivePassword(password,salt,iterations),now=Math.floor(Date.now()/1000);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stockfighter-admin-'));
const sql=path.join(dir,'credential.sql');
try{
 const statement="INSERT INTO sf_admin_credentials(username,salt,password_hash,iterations,updated_at) VALUES ('"+username+"','"+salt+"','"+digest+"',"+iterations+","+now+") ON CONFLICT(username) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,iterations=excluded.iterations,updated_at=excluded.updated_at;\nDELETE FROM sf_admin_sessions WHERE username='"+username+"';\n";
 await fs.writeFile(sql,statement,{mode:0o600});
 const child=spawn(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','stockfighterajo-leaderboard-db',process.argv[2],'--file',sql],{cwd:root,stdio:['ignore','ignore','pipe'],windowsHide:true});
 // Suppress CLI output so an error cannot accidentally echo the SQL/hash.
 child.stderr.resume();
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
 if(code!==0)throw Error('Credential update failed. Check Wrangler login and database binding.');
 console.log('Administrator credential updated; existing sessions revoked.');
}finally{await fs.rm(sql,{force:true});await fs.rmdir(dir);}
