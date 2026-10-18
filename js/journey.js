(function(root){
'use strict';
const rewardNotice='人生模式使用跳日期或提前結算後，本輪至少須經歷 10 個事件，並且有實際成交，結算後才能獲得技能點。';
function allowed(levels,lifeCompleted,mode,id){return Number.isInteger(levels?.[id])&&levels[id]>=1&&(mode==='free'||lifeCompleted===true);}
function startChoice(value,calendar){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value||value<calendar[0]||value>calendar.at(-1))throw Error('請選擇資料範圍內的有效日期');const date=calendar.find(d=>d>=value);return {date,adjusted:date!==value};}
function details(r,esc){return '<div class="journey-dates"><span>起始日期 <b>'+esc(r.startDate||'2020-01-02')+'</b></span><span>提前結算日期 <b>'+esc(r.earlySettlementDate||'未使用')+'</b></span>'+((r.dateJumps||[]).length?'<span>日期跳躍 <b>'+r.dateJumps.map(j=>esc(j.from)+' → '+esc(j.to)).join('、')+'</b></span>':'')+'</div>';}
root.TaiguJourney={rewardNotice,allowed,startChoice,details};
})(globalThis);
