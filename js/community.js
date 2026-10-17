(function(root){
'use strict';
const VERSION='0.9.1',DRAFT_KEY='taigu-warrior.v1.feedbackDraft';
function latest(items){return (Array.isArray(items)?items:[]).filter(a=>a&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&typeof a.summary==='string').slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.version).localeCompare(String(a.version),undefined,{numeric:true}))[0]||null;}
function normalize(raw){const a=raw&&typeof raw==='object'?raw:{};return {kind:a.kind==='problem'?'problem':'wish',title:typeof a.title==='string'?a.title.slice(0,80):'',body:typeof a.body==='string'?a.body.slice(0,2000):'',steps:typeof a.steps==='string'?a.steps.slice(0,1000):''};}
function readDraft(storage){try{return normalize(JSON.parse(storage.getItem(DRAFT_KEY)||'null'));}catch{return normalize(null);}}
function saveDraft(storage,draft){try{storage.setItem(DRAFT_KEY,JSON.stringify(normalize(draft)));return true;}catch{return false;}}
const api={VERSION,DRAFT_KEY,latest,normalize,readDraft,saveDraft};
root.TaiguCommunity=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
