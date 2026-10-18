import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {smokeOptions} from '../../tools/deployment-config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),options=smokeOptions(process.argv.slice(2)),base=options.base;
const headers={Origin:options.origin,'Content-Type':'application/json'};
async function call(route,body,token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...headers,...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();return {status:r.status,data,origin:r.headers.get('Access-Control-Allow-Origin')};}
const config=await call('/v1/config');assert.equal(config.status,200);assert.equal(config.origin,headers.Origin);const edition=config.data.edition;
if(!options.write){const boards=await call('/v1/boards');assert.equal(boards.status,200);if(options.report)fs.writeFileSync(options.report,JSON.stringify({base,write:false,createdRecords:false,checks:['config','cors','boards']},null,2)+'\n');console.log('Read-only API and CORS checks passed. No player, session, score or feedback created.');}
else {
const who=(await call('/v1/players',{})).data;assert.ok(who.playerToken);
const runId=crypto.randomUUID(),input={runId,mode:'free',editionId:edition.id,startDay:-1},session=await call('/v1/sessions',input,who.playerToken);assert.equal(session.status,200);assert.deepEqual((await call('/v1/sessions',input,who.playerToken)).data,session.data);
const c={window:{}};vm.createContext(c);for(const p of ['data/market.js','js/engine.js','js/story.js','data/news.js','data/group.js','js/events.js','js/records.js','js/online.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),c);
const market=c.TaiguEngine.createMarket(c.window.TAIGU_DATA),events=c.TaiguEvents.create(market,c.window.TAIGU_STORY,c.window.TAIGU_NEWS,c.window.TAIGU_GROUP),s=market.fresh('free');s.opening=false;s.runId=runId;
while(s.status==='playing'){market.trigger(s,events.events);while(s.activeEvent){const event=events.events.find(e=>e.id===s.activeEvent);market.choose(s,event,event.choices.find(ch=>(ch.cost||0)<=s.cash));market.trigger(s,events.events);}if(s.day===0)market.queue(s,'2330','buy',1000);market.next(s);}
const summary=c.TaiguRecords.snapshot(market,s),payload=c.window.TaiguOnline.payload(summary,session.data,{editionId:edition.id},'API連線測試');
let invalid=await call('/v1/scores',{...payload,score:payload.score+.5},who.playerToken);assert.equal(invalid.status,400);
const tooEarly=await call('/v1/scores',payload,who.playerToken);assert.equal(tooEarly.data.error?.code,'TOO_FAST');
console.log('Server-issued session, CORS, fractional score rejection and minimum-time check passed. Waiting for normal free-mode minimum...');
await new Promise(resolve=>setTimeout(resolve,Math.max(0,(session.data.createdAt+edition.minDurationSeconds.free+1)*1000-Date.now())));
const posted=await call('/v1/scores',payload,who.playerToken);assert.equal(posted.status,200,JSON.stringify(posted.data));assert.ok(posted.data.rank.rank>=1);
assert.equal((await call('/v1/scores',payload,who.playerToken)).status,409);
const outcome=encodeURIComponent(payload.outcome),rank=await call('/v1/rank?mode=free&outcome='+outcome,null,who.playerToken),board=await call('/v1/leaderboard?mode=free&outcome='+outcome);assert.equal(rank.data.entry.runId,posted.data.runId);assert.ok(board.data.items.some(r=>r.runId===posted.data.runId));
const feedback=[];for(const kind of ['wish','problem']){const r=await call('/v1/feedback',{requestId:crypto.randomUUID(),kind,title:'【串接測試】'+(kind==='wish'?'許願收件':'問題回報'),body:'這是 API 串接的驗證紀錄，確認指定測試 D1 能收到資料；可標記為已完成。',steps:kind==='problem'?'建立匿名身分 → 送出回報 → 確認收到編號':'',version:'0.10.0',context:null,website:''},who.playerToken);assert.equal(r.status,200);feedback.push(r.data.id);}
const report={base,runId:posted.data.runId,playerId:who.playerId,rank:posted.data.rank.rank,feedbackIds:feedback,checks:['config','cors','anonymous-player','idempotent-session','fractional-rejected','minimum-duration','legal-engine-summary','score-submitted','duplicate-rejected','rank-query','leaderboard-query','wish-received','problem-received']};
const dest=options.report;if(dest)fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
