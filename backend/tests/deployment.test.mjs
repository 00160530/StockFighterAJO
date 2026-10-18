import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {credentialTarget} from '../tools/credential-target.mjs';
test('admin target is explicit, keeps DB binding and rejects mismatched remote confirmation before reading a password',t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'taigu-target-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const id='11111111-2222-3333-4444-555555555555';fs.writeFileSync(path.join(root,'own.jsonc'),JSON.stringify({name:'own-worker',account_id:'a'.repeat(32),d1_databases:[{binding:'DB',database_id:id}]}));assert.throws(()=>credentialTarget(['--remote'],root),/config/);assert.throws(()=>credentialTarget(['--remote','--config','own.jsonc'],root),/confirm-database/);assert.throws(()=>credentialTarget(['--remote','--config','own.jsonc','--confirm-database','wrong'],root),/confirm-database/);assert.equal(credentialTarget(['--remote','--config','own.jsonc','--confirm-database',id],root).databaseId,id);assert.equal(credentialTarget(['--local','--config','own.jsonc'],root).mode,'--local');});
