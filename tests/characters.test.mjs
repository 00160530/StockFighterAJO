import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/characters.js',import.meta.url),'utf8'),context);const c=context.TaiguCharacters;
test('legacy or corrupt character preferences require a choice and safely default to Xiao Jiu',()=>{for(const raw of [null,{},'xiaoxiaojiu',{selected:'bad',chosen:true}]){const p=c.profile(raw);assert.equal(p.selected,'xiaojiu');assert.equal(p.chosen,false);}assert.equal(c.profile({selected:'xiaojiu',chosen:true}).chosen,true);});
test('a chosen character survives storage and switching changes only cosmetic preferences',()=>{const original={selected:'xiaojiu',chosen:false};const next=c.choose(original,'xiaoxiaojiu');assert.equal(original.selected,'xiaojiu');assert.equal(original.chosen,false);assert.equal(c.profile(JSON.parse(JSON.stringify(next))).selected,'xiaoxiaojiu');assert.equal(next.chosen,true);assert.deepEqual(Object.keys(next).sort(),['chosen','selected']);assert.throws(()=>c.choose(next,'<script>'));assert.equal(c.choose(next,'xiaojiu').selected,'xiaojiu');});
test('both characters load all six existing prologue scenes with the current artwork version',()=>{
 for(const id of ['xiaojiu','xiaoxiaojiu']){
  for(const field of ['sheet','serious','moods']){
   const asset=c.get(id)[field];
   assert.ok(asset.endsWith(id==='xiaoxiaojiu'?'?v=0.16.0':'?v=0.14.2'));
   assert.ok(fs.existsSync(new URL('../'+asset,import.meta.url)));
  }
  for(let i=1;i<=6;i++){
   const path='assets/intro/cg-0'+i+'.webp',asset=c.intro(id,path);
   assert.equal(asset,c.get(id).intro+'cg-0'+i+'.webp?v=0.14.2');
   assert.ok(fs.existsSync(new URL('../'+asset,import.meta.url)));
  }
 }
 assert.equal(c.intro('unknown','assets/intro/cg-01.webp'),'assets/intro/cg-01.webp?v=0.14.2');
 assert.equal(c.intro('xiaoxiaojiu','assets/intro/cg-99.webp'),'assets/intro/cg-99.webp');
});
