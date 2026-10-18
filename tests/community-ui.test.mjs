import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/community-ui.js',import.meta.url),'utf8'),c);const {ratio,pollHTML}=c.TaiguCommunityUI;
test('poll comparison gives proportional red and green widths including unanimous and empty votes',()=>{assert.equal(ratio(3,1).yes,75);assert.equal(ratio(3,1).no,25);assert.equal(ratio(0,2).yes,0);assert.equal(ratio(0,2).no,100);const empty=ratio(0,0);assert.equal(empty.total,0);assert.ok(Number.isFinite(empty.yes));const html=pollHTML({id:'id-000000',question:'測試',red_label:'有信心',green_label:'很難',active:1,created_at:1,yes:3,no:1,myChoice:'yes'},x=>x,{voting:true});assert.ok(html.includes('width:75%'));assert.ok(html.includes('aria-pressed="true"'));assert.ok(html.includes('有信心 3 票，很難 1 票'));});

test('custom option labels are escaped in text, selected message and accessible name; defaults use 行 and 不行',()=>{const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),p={id:'safe-poll',question:'題目',active:1,created_at:1,yes:2,no:1,myChoice:'yes',red_label:'<b>好</b>',green_label:'不行'};const html=pollHTML(p,esc,{voting:true});assert.ok(html.includes('&lt;b&gt;好&lt;/b&gt;'));assert.ok(!html.includes('<b>好</b>'));assert.ok(html.includes('不行'));const defaults=pollHTML({...p,red_label:null},esc,{voting:true});assert.ok(defaults.includes('<b>行</b>'));});

function votingHome(myChoice=null,{vote}={}){
 let reads=0,renders=0,disabledWrites=0;const calls=[],note={textContent:'',setAttribute(){}};
 const box={buttons:[],querySelectorAll(){return this.buttons;},querySelector(){return note;},set innerHTML(value){this.html=value;renders++;this.buttons=['yes','no'].map(choice=>{let disabled=false;return{dataset:{poll:'safe-poll',choice},get disabled(){return disabled;},set disabled(value){disabled=value;disabledWrites++;}};});}};
 const context={document:{getElementById:()=>box}};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../js/community-ui.js',import.meta.url),'utf8'),context);
 const online={async community(){reads++;return {completions:{total:0,wins:0},poll:{id:'safe-poll',question:'測試',created_at:1,active:1,yes:1,no:0,myChoice}};},async vote(id,choice){calls.push({id,choice});if(vote)await vote();myChoice=choice;}};
 const home=Object.assign(Object.create(context.TaiguCommunityUI.Home.prototype),{online,esc:x=>x,loading:null,counts(){}});
 return{home,box,note,calls,get reads(){return reads;},get renders(){return renders;},get disabledWrites(){return disabledWrites;}};
}
test('clicking the existing selection changes neither the UI nor the vote or refresh request count',async()=>{
 const a=votingHome('yes');await a.home.refresh();const before={html:a.box.html,renders:a.renders,reads:a.reads,writes:a.disabledWrites};
 await a.box.buttons[0].onclick();await a.box.buttons[0].onclick();
 assert.equal(a.calls.length,0);assert.equal(a.box.html,before.html);assert.equal(a.renders,before.renders);assert.equal(a.reads,before.reads);assert.equal(a.disabledWrites,before.writes);
});
test('the first vote and changing sides each submit once; clicking either confirmed selection again is a no-op',async()=>{
 const a=votingHome();await a.home.refresh();await a.box.buttons[0].onclick();await a.box.buttons[0].onclick();
 assert.equal(a.calls.length,1);assert.equal(a.reads,2);assert.match(a.box.html,/你選擇了「行」/);
 await a.box.buttons[1].onclick();await a.box.buttons[1].onclick();
 assert.deepEqual(a.calls,[{id:'safe-poll',choice:'yes'},{id:'safe-poll',choice:'no'}]);assert.equal(a.reads,3);assert.match(a.box.html,/你選擇了「不行」/);
});
test('in-flight clicks cannot duplicate a vote, and a failed change can be retried',async()=>{
 let finish,fail=false;const a=votingHome('yes',{vote:()=>new Promise((resolve,reject)=>{finish=()=>fail?reject(Error('連線失敗')):resolve();})});await a.home.refresh();const buttons=a.box.buttons;
 const first=buttons[1].onclick();await buttons[1].onclick();await buttons[0].onclick();assert.equal(a.calls.length,1);
 fail=true;finish();await first;assert.ok(buttons.every(b=>!b.disabled));assert.equal(a.reads,1);assert.equal(a.note.textContent,'連線失敗');
 await buttons[0].onclick();assert.equal(a.calls.length,1);
 fail=false;const retry=buttons[1].onclick();finish();await retry;assert.equal(a.calls.length,2);assert.equal(a.reads,2);assert.match(a.box.html,/你選擇了「不行」/);
});
