(function(root){'use strict';
function ids(data){return [...new Set(data.watchlist||Object.keys(data.instruments))].filter(id=>id==='TAIEX'||data.instruments[id]?.tradable);}
function normalize(value,data){const allowed=new Set(ids(data).filter(id=>data.instruments[id]?.tradable)),pins=Array.isArray(value)?value:value?.pinned;return Array.isArray(pins)?[...new Set(pins.filter(id=>typeof id==='string'&&allowed.has(id)))]:[];}
function ordered(data,value=[]){const pinned=new Set(normalize(value,data));return ids(data).sort((a,b)=>a==='TAIEX'?-1:b==='TAIEX'?1:Number(pinned.has(b))-Number(pinned.has(a))||a.localeCompare(b,'en',{numeric:true}));}
function toggle(value,id,data){const pins=normalize(value,data);if(id==='TAIEX'||!ids(data).includes(id)||!data.instruments[id]?.tradable)return pins;return pins.includes(id)?pins.filter(x=>x!==id):[...pins,id];}
root.TaiguWatchlist={normalize,ordered,toggle};
})(globalThis);
