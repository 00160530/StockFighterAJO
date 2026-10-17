import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/community.js',import.meta.url),'utf8'),context);
const api=context.window.TaiguCommunity;
test('announcement ticker chooses newest date and semantic version without mutating archive',()=>{
 const items=[{date:'2026-10-16',version:'1.0',summary:'old'},{date:'2026-10-17',version:'0.9.9',summary:'first'},{date:'2026-10-17',version:'0.9.10',summary:'latest'}];
 assert.equal(api.latest(items).summary,'latest');assert.equal(items[0].summary,'old');assert.equal(api.latest(null),null);
});
