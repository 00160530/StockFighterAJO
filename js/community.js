(function(root){
'use strict';
const VERSION='0.15.2';
function latest(items){return (Array.isArray(items)?items:[]).filter(a=>a&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&typeof a.summary==='string').slice().sort((a,b)=>b.date.localeCompare(a.date)||String(b.version).localeCompare(String(a.version),undefined,{numeric:true}))[0]||null;}
const api={VERSION,latest};
root.TaiguCommunity=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
