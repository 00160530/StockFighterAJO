(function(root){'use strict';
const PREFIX='taigu-warrior.v1';
function read(storage,mode){try{const p=JSON.parse(storage.getItem(PREFIX+'.auto.'+mode)||'null');return p?.state&&(p.state.mode||'life')===mode?p:null;}catch{return null;}}
function migrate(storage,validate){const candidates=[];for(const key of [PREFIX+'.auto',...Array.from({length:3},(_,i)=>PREFIX+'.slot'+(i+1))]){try{const p=JSON.parse(storage.getItem(key)||'null');if(p?.state){p.state=validate(p.state)||p.state;candidates.push(p);}}catch{}}
 for(const mode of ['life','free']){const pool=candidates.filter(p=>(p.state.mode||'life')===mode),existing=read(storage,mode);try{if(existing){existing.state=validate(existing.state)||existing.state;pool.push(existing);}}catch{}const p=pool.sort((a,b)=>(Date.parse(b.savedAt)||0)-(Date.parse(a.savedAt)||0))[0];if(p){const serialized=JSON.stringify(p),key=PREFIX+'.auto.'+mode;if(storage.getItem(key)!==serialized)storage.setItem(key,serialized);}}}
root.TaiguContinue={read,migrate};
})(globalThis);
