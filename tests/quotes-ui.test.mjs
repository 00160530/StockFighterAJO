import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../js/quotes-ui.js',import.meta.url),'utf8'),c={};vm.createContext(c);vm.runInContext(source,c);
const {count,randomTab,quoteHTML,introduction}=c.TaiguQuotesUI;
test('each quote category can be selected on opening and manual tab choices are independent of random selection',()=>{
 assert.equal(randomTab(()=>0),'popular');assert.equal(randomTab(()=>0.5),'latest');assert.equal(randomTab(()=>0.999),'featured');assert.equal(introduction,'留下給股市夥伴的金句吧，我先來「買進群創，身心受創」');
});
test('quote character count agrees with normalized server Unicode limits including emoji and combining marks',()=>{
 assert.equal(count('  😀'.repeat(1)+'  '),1);assert.equal(count('😀'.repeat(25)),25);assert.equal(count('韭'.repeat(26)),26);assert.equal(count('e\u0301'),1);assert.equal(count(' \t '),0);
});
test('user quote text and accessible labels are escaped, and like state and featured label render without author identifiers',()=>{
 const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const html=quoteHTML({id:'quote-123',body:'<img onerror="bad">',likes:1234,liked:1,featured:1,player_id:'private-player'},esc);
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('aria-pressed="true"'));assert.ok(html.includes('取消按讚'));assert.ok(html.includes('作者精選'));assert.ok(html.includes('1,234'));assert.ok(!html.includes('private-player'));
});
test('local API preview only permits HTTP loopback when the page itself is local; production still requires HTTPS',()=>{
 const context={window:{location:{hostname:'127.0.0.1'}}};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/online.js',import.meta.url),'utf8'),context);
 const Client=context.window.TaiguOnline.Client,enabled=apiBase=>new Client({config:{apiBase}}).enabled;
 assert.equal(enabled('http://127.0.0.1:4196'),true);assert.equal(enabled('http://localhost:8787'),true);assert.equal(enabled('http://evil.test'),false);assert.equal(enabled('http://localhost.evil.test'),false);assert.equal(enabled('http://localhost@evil.test'),false);assert.equal(enabled(''),false);
 context.window.location.hostname='player.github.io';assert.equal(enabled('http://127.0.0.1:4196'),false);assert.equal(enabled('https://api.example.test'),true);
});
test('quote client uses the existing identity for writes and private list state but public reads do not create an identity',async()=>{
 const calls=[],store=new Map(),context={window:{},setTimeout,clearTimeout,AbortController};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/online.js',import.meta.url),'utf8'),context);
 const online=new context.window.TaiguOnline.Client({config:{apiBase:'https://api.example.test'},storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},fetcher:async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/players')?{playerId:'test-player',playerToken:'a'.repeat(64)}:{});}});
 await online.quotes('featured');assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Authorization,undefined);
 await online.createQuote('先活下來');await online.likeQuote('quote-123',true);await online.quotes('popular');assert.equal(calls.filter(x=>x.url.endsWith('/players')).length,1);assert.equal(calls.at(-1).options.headers.Authorization,'Bearer '+'a'.repeat(64));assert.deepEqual(JSON.parse(calls[2].options.body),{text:'先活下來'});assert.deepEqual(JSON.parse(calls[3].options.body),{liked:true});
});
