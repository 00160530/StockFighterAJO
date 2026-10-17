import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/community.js',import.meta.url),'utf8'),context);
const api=context.window.TaiguCommunity;
const plain=a=>JSON.parse(JSON.stringify(a));
test('announcement ticker chooses newest date and semantic version without mutating archive',()=>{
 const items=[{date:'2026-10-16',version:'1.0',summary:'old'},{date:'2026-10-17',version:'0.9.9',summary:'first'},{date:'2026-10-17',version:'0.9.10',summary:'latest'}];
 assert.equal(api.latest(items).summary,'latest');assert.equal(items[0].summary,'old');assert.equal(api.latest(null),null);
});
test('feedback draft survives reopening and retains separate problem reproduction field',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const draft={kind:'problem',title:'播放停住',body:'按了下一事件後停住',steps:'讀取進度 → 按播放'};
 assert.equal(api.saveDraft(storage,draft),true);assert.deepEqual(plain(api.readDraft(storage)),draft);
 assert.deepEqual([...values.keys()],[api.DRAFT_KEY]);
});
test('broken or denied draft storage never affects gameplay save keys or throws',()=>{
 assert.equal(api.saveDraft({setItem(){throw Error('quota');}},{}),false);
 assert.equal(api.readDraft({getItem(){throw Error('denied');}}).kind,'wish');
 assert.equal(api.readDraft({getItem(){return '{invalid';}}).body,'');
});
test('draft normalization bounds content and ignores malformed fields',()=>{
 const a=api.normalize({kind:'unknown',title:'x'.repeat(100),body:'y'.repeat(2500),steps:42,run:{cash:100}});
 assert.deepEqual(Object.keys(a),['kind','title','body','steps']);assert.equal(a.kind,'wish');assert.equal(a.title.length,80);assert.equal(a.body.length,2000);assert.equal(a.steps,'');
});
