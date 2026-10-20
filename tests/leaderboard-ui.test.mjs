import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/leaderboard-ui.js',import.meta.url),'utf8'),c);const B=c.TaiguBoard;
test('leaderboard compares wealth directly to the benchmark and formats net trade profit with its cost-based return',()=>{assert.equal(B.comparison(7600000,5000000),'贏過大盤 52.00%');assert.equal(B.comparison(4000000,5000000),'落後大盤 20.00%');assert.equal(B.gain({maxGain:{pnl:2000,costBasis:10000}},false),'$2,000 <span class="board-gain-pct">(20.00%)</span>');assert.match(B.gain({highlights:{maxGain:{pnlCents:200000}}},true),/舊版雲端紀錄未保存交易成本/);assert.equal(B.gain({},false),'—');});
test('online and local tables have the same six meaningful columns; names are escaped and old incomplete gains do not invent percentages',()=>{const cloud={rank:1,nickname:'<script>',submittedAt:Date.parse('2026-10-20T16:30:00Z')/1000,startDate:'2020-01-02',equityCents:760000000,benchmarkCents:500000000,trades:5,highlights:{maxGain:{pnlCents:200000,costBasisCents:1000000}}};const html=B.table([cloud],{online:true});assert.equal((html.match(/<th scope=/g)||[]).length,6);assert.match(html,/最後總資產/);assert.match(html,/交易次數/);assert.match(html,/贏過大盤 52.00%/);assert.match(html,/&lt;script&gt;/);assert.match(html,/上傳 2026\/10\/21/);assert.ok(!html.includes('起始 2020-01-02'));assert.match(B.table([{...cloud,submittedAt:null}],{online:true}),/上傳 —/);assert.ok(!html.includes('回撤'));assert.match(B.table([]),/colspan="6"/);});
test('losing boards show largest realized loss and a negative return while winning boards keep profit',()=>{const r={id:'run',equity:4000000,benchmark:5000000,trades:2,maxGain:{pnl:2000,costBasis:10000},maxLoss:{pnl:-3000,costBasis:10000}};const html=B.table([r],{outcome:'lost'});assert.match(html,/紀錄 —/);assert.match(html,/單筆最大虧損/);assert.match(html,/−\$3,000/);assert.match(html,/\(-30.00%\)/);assert.ok(!html.includes('單筆最大獲利'));});

test('local rows show their own upload receipt date or local record date, never another best score upload',()=>{
 const r={id:'local-run',at:'2026-10-19T16:30:00Z',equity:1000000,benchmark:5000000,trades:1};
 assert.match(B.table([r]),/紀錄 2026\/10\/20/);
 assert.match(B.table([r],{receipt:()=>({submittedAt:Date.parse('2026-10-20T16:30:00Z')/1000})}),/上傳 2026\/10\/21/);
 assert.match(B.table([r],{receipt:()=>({runId:'uploaded',rank:{runId:'uploaded',submittedAt:Date.parse('2026-10-20T16:30:00Z')/1000}})}),/上傳 2026\/10\/21/);
 assert.match(B.table([r],{receipt:()=>({runId:'uploaded',rank:{runId:'different',submittedAt:Date.parse('2026-10-20T16:30:00Z')/1000}})}),/紀錄 2026\/10\/20/);
});
