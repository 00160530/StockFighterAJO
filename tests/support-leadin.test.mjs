import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function sceneHarness(reduced=false){
 const frames=new Map(),events=new Map();let frameId=0,now=0;
 const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
 class Element{
  constructor(){this.children=new Map();this.listeners=new Map();this.open=false;this.dataset={};this.style={};}
  querySelector(key){if(!this.children.has(key))this.children.set(key,new Element());return this.children.get(key);}
  addEventListener(key,fn){this.listeners.set(key,fn);}setAttribute(){}append(){}
  showModal(){this.open=true;}close(){this.open=false;}focus(){document.activeElement=this;}
  getContext(){return ctx;}getBoundingClientRect(){return {left:0,top:0,width:800,height:500};}
 }
 const document={hidden:false,activeElement:new Element(),body:new Element(),createElement:()=>new Element(),addEventListener:(key,fn)=>events.set(key,fn)};
 const c={document,innerWidth:1280,innerHeight:720,devicePixelRatio:1,matchMedia:()=>({matches:reduced}),addEventListener(){},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/support.js',import.meta.url),'utf8'),c);
 const dialog=new Element(),eventDialog=new Element(),scene=new c.TaiguSupport.Scene({dialog,eventDialog}),progress=[];let ended=0;
 const chart={setFall:p=>progress.push(p),getFallSpot:()=>({x:900,top:230,bottom:250,width:9}),endFall:()=>ended++,draw(){}};
 const context={id:'0050',name:'元大台灣50',date:'2020-03-09',chipDate:'2020-03-06',institutionalNet:-322e8,marketDrop:-.03,drop:-.028};
 const tick=ms=>{for(let elapsed=0;elapsed<ms;elapsed+=80){now+=Math.min(80,ms-elapsed);const current=[...frames.values()];frames.clear();current.forEach(fn=>fn(now));}};
 return {scene,dialog,eventDialog,document,chart,context,progress,tick,frames,get ended(){return ended;},visibility:hidden=>{document.hidden=hidden;events.get('visibilitychange')();}};
}

test('chart fall reveals only copied current-day OHLC, falls monotonically, and finishes at real prices',()=>{
 const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../js/chart.js',import.meta.url),'utf8'),c);
 const row=['2020-03-09',86.8,86.8,85.6,85.85,42700000],before=JSON.stringify(row),prices=[];
 for(let i=0;i<=100;i++){const r=c.TaiguChart.fallingBar(row,i/100);assert.notEqual(r,row);assert.equal(r[0],row[0]);assert.equal(r[1],row[1]);assert.ok(r[3]>=row[3]&&r[3]<=r[4]&&r[4]<=r[1]&&r[2]>=r[1]);prices.push(r[4]);}
 assert.ok(prices.every((p,i)=>!i||p<=prices[i-1]));assert.equal(prices[0],row[1]);assert.equal(prices.at(-1),row[4]);assert.equal(JSON.stringify(c.TaiguChart.fallingBar(row,1)),before);assert.equal(JSON.stringify(row),before);
});

test('prelude holds the day and delays offer; hidden tabs cannot skip its fall or the final choice',async()=>{
 const h=sceneHarness();let done=false;const p=h.scene.leadIn(h.context,h.chart).then(()=>done=true);assert.equal(h.scene.leading,true);assert.equal(h.scene.leadDialog.open,true);assert.equal(h.eventDialog.open,false);assert.throws(()=>h.scene.leadIn(h.context,h.chart),/已在進行/);
 h.tick(400);assert.equal(done,false);assert.ok(h.progress.at(-1)>0&&h.progress.at(-1)<1);const progress=h.progress.at(-1),elapsed=h.scene.leadElapsed;
 h.visibility(true);h.tick(20000);assert.equal(h.scene.leadElapsed,elapsed);assert.equal(h.progress.at(-1),progress);assert.equal(done,false);h.visibility(false);h.tick(320);assert.equal(done,false);assert.equal(h.eventDialog.open,false);
 h.tick(1280);assert.equal(done,false);h.tick(160);await p;assert.equal(done,true);assert.equal(h.progress.at(-1),1);assert.equal(h.frames.size,0);assert.equal(h.scene.leadDialog.open,true,'darkness remains until choice dialog is ready');assert.equal(h.eventDialog.open,false);
 const choice=h.scene.offer(h.context);assert.equal(h.scene.leading,false);assert.equal(h.scene.leadDialog.open,false);assert.equal(h.eventDialog.open,true);assert.equal(h.ended,1);h.scene.choose(false);assert.equal(await choice,false);assert.equal(h.scene.active,false);h.scene.choose(true);assert.equal(h.scene.offering,false);
});

test('escape/reduced motion finish prelude without auto-selecting or opening the hand minigame',async()=>{
 const h=sceneHarness(),p=h.scene.leadIn(h.context,h.chart);h.tick(240);h.scene.leadDialog.listeners.get('cancel')({preventDefault(){}});await p;assert.equal(h.progress.at(-1),1);assert.equal(h.frames.size,0);assert.equal(h.scene.active,false);assert.equal(h.scene.offering,false);h.scene.clearLeadIn();assert.equal(h.scene.leadDialog.open,false);
 const reduced=sceneHarness(true),rp=reduced.scene.leadIn(reduced.context,reduced.chart);reduced.tick(560);await rp;assert.ok(reduced.progress.every(p=>p===1));assert.equal(reduced.eventDialog.open,false);assert.equal(reduced.scene.active,false);reduced.scene.clearLeadIn();assert.equal(reduced.frames.size,0);
});

test('prelude brings an offscreen mobile chart into view before spotlighting but leaves visible charts still',async()=>{
 for(const bounds of [{top:-240,bottom:160},{top:600,bottom:1000},{top:100,bottom:500}]){
  const h=sceneHarness(),calls=[];h.chart.el={getBoundingClientRect:()=>bounds,scrollIntoView:options=>{calls.push('scroll');assert.equal(options.block,'center');assert.equal(options.behavior,'instant');assert.equal(h.scene.leadDialog.open,false);}};h.chart.draw=()=>calls.push('draw');
  const p=h.scene.leadIn(h.context,h.chart);assert.deepEqual(calls,bounds.top<0||bounds.bottom>720?['scroll','draw']:[]);h.scene.finishLeadIn();await p;h.scene.clearLeadIn();
 }
});
