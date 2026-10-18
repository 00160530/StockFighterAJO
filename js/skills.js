(function(root){
'use strict';
const DEFINITIONS=[
 {id:'calendar',name:'日期跳躍',max:5,unit:'次',text:'每級每輪可用 1 次，最高 5 級。遊戲中選擇未來交易日跳躍，保留資產與持股，取消未成交委託、略過沿途劇情；人生模式須二周目。使用後須完成 10 個事件且有成交，人生模式結算才能領技能點。'},
 {id:'remote',name:'人生遙控器',max:1,passive:true,text:'花 1 點永久解鎖。取消未成交委託、略過後續劇情，持股依原規則快轉到期末；人生模式須二周目後使用。使用後至少經歷 10 個事件且有成交，人生模式結算才能領技能點。'},
 {id:'mother',name:'媽媽10塊',max:5,unit:'萬',text:'跟媽媽借錢頂一下。每級增加 20 萬元額度，半年後還款，遊戲結束也會自動結清；還錢不恢復本輪額度。'},
 {id:'divination',name:'奇門遁甲',max:3,unit:'次',text:'每級可使用 1 次占術，預測指定標的未來 10 個交易日的上漲、下跌與平盤日數；看不到漲跌幅度。'},
 {id:'vip',name:'林北VIP拉',max:5,unit:'萬',text:'收到追繳令時，威脅營業員「我認識你們老闆」！每級 20 萬元券商代墊額度，補到約 166.67%；已用額度不恢復。融資部位結清或本輪結束時還款。'}
];
function profile(raw){const levels={};for(const d of DEFINITIONS)levels[d.id]=Number.isInteger(raw?.levels?.[d.id])&&raw.levels[d.id]>=0&&raw.levels[d.id]<=d.max?raw.levels[d.id]:0;const awarded={},announced={};for(const[id,n]of Object.entries(raw?.awarded||{}))if(id.length<=120&&Number.isInteger(n)&&n>=1&&n<=4){awarded[id]=n;if(raw?.announced?.[id]===true)announced[id]=true;}const earned=Object.values(awarded).reduce((n,x)=>n+x,0),spent=Object.values(levels).reduce((n,x)=>n+x,0);if(spent>earned)for(const id in levels)levels[id]=0;return {version:1,levels,awarded,announced,earned,points:earned-Object.values(levels).reduce((n,x)=>n+x,0)};}
function reward(r,end,sessions){if(r?.mode!=='life'||!['won','lost'].includes(r.status)||r.date!==end||(!r.customStartDate&&r.sessions!==sessions||r.customStartDate&&(!Number.isInteger(r.sessions)||r.sessions<1||r.sessions>sessions))||!Number.isFinite(r.equity)||!Number.isFinite(r.benchmark)||r.benchmark<=0)return 0;if((r.customStartDate||r.earlySettlementDate||r.dateJumps?.length)&&(!(r.choices>=10)||!(r.trades>=1)))return 0;const ratio=r.equity/r.benchmark;return ratio>2?4:ratio>1.5?3:ratio>1?2:1;}
function award(raw,r,end,sessions){const p=profile(raw),id=r?.rewardRootId||r?.id,points=reward(r,end,sessions);if(points&&typeof id==='string'&&id.length<=120&&!Object.hasOwn(p.awarded,id)){p.awarded[id]=points;p.earned+=points;p.points+=points;}return p;}
function upgrade(raw,id){const p=profile(raw),d=DEFINITIONS.find(d=>d.id===id);if(!d||p.points<1||p.levels[id]>=d.max)throw Error('技能點不足或已達最高等級');p.levels[id]++;p.points--;return p;}
root.TaiguSkills={DEFINITIONS,profile,reward,award,upgrade};
})(globalThis);
