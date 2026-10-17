(function(root){
'use strict';
const categories={main:'劇情',news:'新聞',life:'人生',signal:'技術',support:'支撐線'};
function collect(state,events,asof){
 const entries=[];
 for(const row of state.log||[]){if(row.type!=='story'||row.date>asof)continue;const e=events.find(e=>row.text.startsWith(e.title+'／'));entries.push({date:row.date,id:e?.id||row.text,title:e?.title||row.text.split('／')[0],category:categories[e?.type]||'事件',text:e?.text||''});}
 if(state.activeEvent){const e=events.find(e=>e.id===state.activeEvent);if(e)entries.push({date:asof,id:e.id,title:e.title,category:categories[e.type]||'事件',text:e.text});}
 for(const g of state.supportGames||[])if(g.date<=asof)entries.push({date:g.date,id:'support-'+g.date,title:'手指支撐線',category:'支撐線',text:g.choice==='use'?'小韭使出了手指支撐線。':g.choice==='decline'?'小韭選擇讓它跌吧。':'賣壓來了，小韭正準備做決定。'});
 const groups=new Map();for(const e of entries){if(!groups.has(e.date))groups.set(e.date,{date:e.date,entries:[]});const group=groups.get(e.date);if(!group.entries.some(x=>x.id===e.id))group.entries.push(e);}
 return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
function layout(groups,rows,x,y,width,priceBottom){
 const index=new Map(rows.map((r,i)=>[r[0],i])),points=[];
 for(const group of groups){const i=index.get(group.date);if(i===undefined)continue;const px=x(i),py=y(rows[i][2]),last=points.at(-1);if(last&&px-last.x<14){last.entries.push(...group.entries);last.dateEnd=group.date;last.anchorY=Math.min(last.anchorY,py);}else points.push({date:group.date,dateEnd:group.date,x:px,anchorY:py,entries:group.entries.slice()});}
 let labels=0,right=-100;
 return points.map(p=>{const category=p.entries.every(e=>e.category===p.entries[0].category)?p.entries[0].category:'事件',label=category+(p.entries.length>1?' '+p.entries.length:''),lw=label.length*10+12,left=Math.max(6,Math.min(width-lw-60,p.x-lw/2)),full=labels<4&&left>=right+9;if(full){labels++;right=left+lw;}const top=Math.max(6,Math.min(priceBottom-22,p.anchorY-(full?25:12)));return {...p,label,full,left:full?left:Math.max(4,Math.min(width-64,p.x-5)),top,stem:Math.max(3,p.anchorY-top-17)};});
}
root.TaiguChartEvents={collect,layout};
})(globalThis);
