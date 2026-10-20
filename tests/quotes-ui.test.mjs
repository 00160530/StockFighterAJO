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
 const online=new context.window.TaiguOnline.Client({config:{apiBase:'https://api.example.test'},storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},fetcher:async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/players')?{playerId:'test-player',playerToken:'a'.repeat(64)}:url.endsWith('/quote-boards')?{tabs:{popular:{items:[]},latest:{items:[]},featured:{items:[]}},self:{}}:{});}});
 await online.quotes('featured');assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Authorization,undefined);
 await online.createQuote('先活下來');await online.likeQuote('quote-123',true);await online.quotes('popular');assert.equal(calls.filter(x=>x.url.endsWith('/players')).length,1);assert.equal(calls.at(-1).options.headers.Authorization,'Bearer '+'a'.repeat(64));assert.deepEqual(JSON.parse(calls[2].options.body),{text:'先活下來'});assert.deepEqual(JSON.parse(calls[3].options.body),{liked:true});
});

test('comment cards place escaped nickname and timestamp before the quote and use the requested character and mood',()=>{
 const esc=s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),html=quoteHTML({id:'quote-123',body:'等機會',nickname:'<股友>',avatarId:7,avatarCharacter:'xiaoxiaojiu',createdAt:1000,likes:2},esc,{avatar:(id,character)=>'<span class="avatar">'+character+':'+id+'</span>',now:1000*1000+86400000});
 assert.ok(html.includes('xiaoxiaojiu:7'));assert.ok(html.includes('&lt;股友&gt;'));assert.ok(html.includes('1 天前'));assert.ok(html.indexOf('quote-comment-head')<html.indexOf('quote-comment-body'));assert.ok(html.includes('datetime='));assert.ok(!html.includes('回覆'));assert.ok(!html.includes('分享'));
});

function cachedClient({fetcher}={}){
 const context={window:{},setTimeout,clearTimeout,AbortController};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/online.js',import.meta.url),'utf8'),context);
 const store=new Map(),calls=[];let clock=1000;
 const snapshot=()=>({tabs:Object.fromEntries(['popular','latest','featured'].map(tab=>[tab,{items:[{id:tab}]}])),self:{eligible:true}});
 const client=new context.window.TaiguOnline.Client({config:{apiBase:'https://api.example.test'},storage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},now:()=>clock,fetcher:async(url,options)=>{calls.push({url,options});if(fetcher)return fetcher(url,options,snapshot);return Response.json(url.endsWith('/quote-boards')?snapshot():{});}});
 const identity=token=>{const a=client.read();a.player={playerId:token,playerToken:token.repeat(64)};client.write(a);};return {client,calls,snapshot,identity,tick:()=>clock+=300001};
}
test('all quote tabs and reopening share one five-minute snapshot; identity changes never reuse private like state',async()=>{
 const a=cachedClient();await Promise.all([a.client.quotes('popular'),a.client.quotes('latest'),a.client.quotes('featured')]);await a.client.quotes('latest');assert.equal(a.calls.length,1);
 a.tick();await a.client.quotes('featured');assert.equal(a.calls.length,2);a.identity('a');await a.client.quotes('popular');assert.equal(a.calls.length,3);assert.equal(a.calls.at(-1).options.headers.Authorization,'Bearer '+'a'.repeat(64));
});
test('only successful posting or liking invalidates cached quote lists; errors are retryable and stale requests cannot overwrite a newer snapshot',async()=>{
 const a=cachedClient();a.identity('a');await a.client.quotes();await a.client.likeQuote('quote-123',true);await a.client.quotes('latest');assert.equal(a.calls.filter(c=>c.url.endsWith('/quote-boards')).length,2);await a.client.createQuote('一句',{nickname:'股友',avatarId:8,avatarCharacter:'xiaoxiaojiu'});await a.client.quotes('featured');assert.equal(a.calls.filter(c=>c.url.endsWith('/quote-boards')).length,3);assert.equal(JSON.parse(a.calls.find(c=>c.url.endsWith('/quotes')).options.body).avatarId,8);
 let fail=true;const b=cachedClient({fetcher:async(url,options,snapshot)=>fail?Response.json({error:{code:'RETRY',message:'再試一次'}},{status:503}):Response.json(snapshot())});await assert.rejects(b.client.quotes());fail=false;await b.client.quotes();assert.equal(b.calls.length,2);
 let resolve;const c=cachedClient({fetcher:(url,options,snapshot)=>c.calls.length===1?new Promise(r=>resolve=()=>r(Response.json(snapshot()))):Promise.resolve(Response.json(snapshot()))});const old=c.client.quotes();c.client.invalidateQuotes();await c.client.quotes();resolve();await old;await c.client.quotes();assert.equal(c.calls.length,2);
});

test('only the authenticated player’s exact quote ID receives the own-row color and nickname marker',()=>{
 const quote={id:'mine',body:'同一句金句',nickname:'同一暱稱',createdAt:1,likes:0},esc=String;
 const mine=quoteHTML(quote,esc,{ownId:'mine'}),other=quoteHTML({...quote,id:'another'},esc,{ownId:'mine'}),anonymous=quoteHTML(quote,esc);
 assert.ok(mine.includes('stock-quote-own'));assert.ok(mine.includes('同一暱稱 <span class="quote-you">(你)</span>'));
 for(const html of [other,anonymous]){assert.ok(!html.includes('stock-quote-own'));assert.ok(!html.includes('quote-you'));}
});

test('editing uses the existing identity and invalidates cached boards after success or a moderation conflict',async()=>{
 let revoked=false;const a=cachedClient({fetcher:async(url,options,snapshot)=>url.endsWith('/edit')?(revoked?Response.json({error:{code:'QUOTE_REVOKED',message:'你的金句已被管理員註銷。'}},{status:409}):Response.json({saved:true})):Response.json(snapshot())});a.identity('a');await a.client.quotes();await a.client.updateQuote('quote-123','新金句',{revision:1,avatarId:3,avatarCharacter:'xiaoxiaojiu'});await a.client.quotes('latest');assert.equal(a.calls.filter(c=>c.url.endsWith('/quote-boards')).length,2);const edit=a.calls.find(c=>c.url.endsWith('/edit'));assert.equal(edit.options.headers.Authorization,'Bearer '+'a'.repeat(64));assert.deepEqual(JSON.parse(edit.options.body),{text:'新金句',revision:1,avatarId:3,avatarCharacter:'xiaoxiaojiu'});revoked=true;await assert.rejects(a.client.updateQuote('quote-123','再改',{revision:2,avatarId:3,avatarCharacter:'xiaoxiaojiu'}),e=>e.code==='QUOTE_REVOKED');await a.client.quotes('popular');assert.equal(a.calls.filter(c=>c.url.endsWith('/quote-boards')).length,3);
});
