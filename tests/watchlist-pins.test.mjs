import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/watchlist.js',import.meta.url),'utf8'),c);const W=c.TaiguWatchlist,data={watchlist:['TAIEX','2330','0050','2303','2884'],instruments:{TAIEX:{tradable:false},'2330':{tradable:true},'0050':{tradable:true},'2303':{tradable:true},'2884':{tradable:true},OTHER:{tradable:true}}},plain=x=>JSON.parse(JSON.stringify(x));
test('index stays first, pinned ETFs and stocks follow by code, and other stocks keep numeric code order',()=>{
 assert.deepEqual(plain(W.ordered(data)),['TAIEX','0050','2303','2330','2884']);const pins=['2884','0050'];assert.deepEqual(plain(W.ordered(data,pins)),['TAIEX','0050','2884','2303','2330']);assert.deepEqual(pins,['2884','0050']);assert.deepEqual(data.watchlist,['TAIEX','2330','0050','2303','2884']);
});
test('pin settings reject unknown, non-tradable and duplicate entries and tolerate corrupt stored values',()=>{
 assert.deepEqual(plain(W.normalize({pinned:['TAIEX','0050','0050','bad','OTHER',null,2330,'2884']},data)),['0050','2884']);for(const value of [null,'oops',{}, {pinned:'0050'}])assert.deepEqual(plain(W.normalize(value,data)),[]);
});
test('toggle pins independently, supports ETF and stock, and serialized preferences survive a new session',()=>{
 let pins=W.toggle([], '0050',data);pins=W.toggle(pins,'2330',data);const stored=JSON.parse(JSON.stringify({version:1,pinned:pins})),restored=W.normalize(stored,data);assert.deepEqual(plain(restored),['0050','2330']);pins=W.toggle(restored,'0050',data);assert.deepEqual(plain(pins),['2330']);assert.deepEqual(plain(W.toggle(pins,'TAIEX',data)),['2330']);assert.deepEqual(plain(W.toggle(pins,'bad',data)),['2330']);
});
test('updated watchlists discard removed pins without changing remaining preferences',()=>{
 const expanded={...data,watchlist:['TAIEX','0050','2884']};assert.deepEqual(plain(W.normalize(['2330','2884'],expanded)),['2884']);assert.deepEqual(plain(W.ordered(expanded,['2330','2884'])),['TAIEX','2884','0050']);
});
