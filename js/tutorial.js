(function(root){
'use strict';
const VERSION=1;
const lifeSteps=[
 {id:'goal',target:'.topbar',title:'先看日期與你的目標',text:'上方是遊戲日期、總資產與 0050 基準。最後要嚴格贏過「買進 0050、股利再投入」的自己，打平也算失敗。行情只顯示當時已發生的資料。'},
 {id:'inventory',target:'#inventoryBtn',title:'點總資產，就能看庫存',text:'「庫存 ↗」會打開股票明細：買進日期、股數、含費均價、現價、市值與損益，也能展開每筆成交紀錄。教學結束後就能點開查看。'},
 {id:'watchlist',target:'#watchItems',title:'從這裡切換觀察標的',text:'選擇 0050、台積電、鴻海或聯發科，K 線與交易委託會一起切換。加權指數是大盤觀察工具，不能直接買賣。'},
 {id:'chart',target:'.chart-panel',title:'讀懂價格，別急著追價',text:'這裡有每日 K 棒、均線與成交量，可拖曳回看、用滾輪縮放。法人買賣超延後一個交易日才看得到；0050 分割後可勾選「分割還原」輔助判讀。'},
 {id:'story',target:'.story-panel',title:'事件來了，先替小韭做決定',text:'事件會出現在這裡，先選完劇情選項，才能送出委託。人生模式每次事件開放「當日＋後兩個交易日」操作；旁邊的群組可看原創散戶對話。'},
 {id:'trade',target:'.trade-panel',title:'買進、賣出與全部委託',text:'選擇方向與股數，也可用「全部買進／全部賣出」。委託於下一個交易日開盤撮合，參考價不是成交保證；畫面會估算手續費與交易稅。'},
 {id:'portfolio',target:'.portfolio-panel',title:'成交之後，紀錄都在這裡',text:'這排頁籤可看持股、待成交委託、冒險紀錄與績效走勢。送單後先到「待成交」確認，需要時可在成交前取消；成交後才會增加交易次數。'},
 {id:'advance',target:'.advance-panel',title:'讓行情走，不必每天一直按',text:'操作期內可前往下一操作日，或提早結束本次操作。前往下一事件時會自動逐交易日播放 K 線，可調速度、暫停及繼續，遇到事件就停下。'},
 {id:'menu',target:'#gameMenu nav',title:'存檔與重看教學，都在選單裡',text:'選單可管理存檔、看新聞與高光、設定音樂，也能隨時「重看操作教學」。教學只介紹介面，不會替你選劇情或下單。準備好，接下來由你決定。'}
];
const freeSteps=[
 {id:'free-trade',target:'.trade-panel',title:'自由模式，每個交易日都能下單',text:'你不必等待事件，也沒有三日操作期限制。每個交易日都能自行買賣；遇到劇情仍先完成選擇，委託也一樣於下一個交易日開盤成交。'},
 {id:'free-advance',target:'.advance-panel',title:'自己決定走一天，還是一段行情',text:'用主按鈕前往下一交易日，也可一次推進 5 日或 20 日。途中遇到事件會自動停下，完成選項後再繼續；這裡不會替你關閉任何操作期。'},
 {id:'free-menu',target:'#gameMenu nav',title:'自由模式，成績與教學各自保留',text:'排行榜切到「自由模式」，就能看自由模式的獨立成績。從這裡「重看操作教學」會顯示這份差異教學；回人生模式則會顯示人生模式的完整教學。'}
];
function stepsFor(mode){if(mode==='life')return lifeSteps;if(mode==='free')return freeSteps;throw Error('未知教學模式');}
function profile(raw){return {version:VERSION,life:raw?.version===VERSION&&raw.life===true,free:raw?.version===VERSION&&raw.free===true};}
function needs(s,p){return ['life','free'].includes(s.mode)&&s.status==='playing'&&!s.opening&&!profile(p)[s.mode]&&(s.day<0||s.tutorialPending===true);}
function complete(raw,mode){stepsFor(mode);return {...profile(raw),[mode]:true};}
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(n,Math.max(lo,hi)));
function placeCard(r,v,c){
 const pad=12,gap=16,w=Math.min(c.width,v.width-2*pad),h=Math.min(c.height,v.height-2*pad);
 const candidates=[[r.x+(r.width-w)/2,r.y+r.height+gap],[r.x+(r.width-w)/2,r.y-h-gap],[r.x+r.width+gap,r.y],[r.x-w-gap,r.y],[pad,pad],[v.width-w-pad,pad],[pad,v.height-h-pad],[v.width-w-pad,v.height-h-pad]];
 return candidates.map(([x,y])=>{x=clamp(x,pad,v.width-w-pad);y=clamp(y,pad,v.height-h-pad);const overlap=Math.max(0,Math.min(x+w,r.x+r.width)-Math.max(x,r.x))*Math.max(0,Math.min(y+h,r.y+r.height)-Math.max(y,r.y));return {x,y,score:overlap*1000+Math.hypot(x+w/2-r.x-r.width/2,y+h/2-r.y-r.height/2)};}).sort((a,b)=>a.score-b.score)[0];
}
class Tour{
 constructor({dialog,onStep,onEnd}){
  this.dialog=dialog;this.onStep=onStep;this.onEnd=onEnd;this.active=false;this.index=0;this.frame=0;
  this.card=dialog.querySelector('.tutorial-card');this.prev=dialog.querySelector('#tutorialPrev');this.next=dialog.querySelector('#tutorialNext');this.close=dialog.querySelector('#tutorialClose');
  this.prev.onclick=()=>this.move(-1);this.next.onclick=()=>this.move(1);this.close.onclick=()=>this.end(false);
  dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();if(!this.required)this.end(false);});
  dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();this.move(e.key==='ArrowRight'?1:-1);}});
  this.reposition=()=>{if(!this.active)return;cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>this.position());};
  root.addEventListener('resize',this.reposition);root.addEventListener('scroll',this.reposition,true);
 }
 start(mode='life',required=false){
  if(this.active)return;this.mode=mode;this.steps=stepsFor(mode);this.required=required;this.active=true;this.index=0;this.oldFocus=document.activeElement;this.oldScroll=[root.scrollX,root.scrollY];this.close.hidden=required;this.dialog.showModal();this.showStep();
 }
 move(direction){if(!this.active)return;if(direction<0){if(this.index>0){this.index--;this.showStep();}}else if(this.index<this.steps.length-1){this.index++;this.showStep();}else this.end(true);}
 showStep(){
  const s=this.steps[this.index];this.onStep?.(s);this.target=document.querySelector(s.target);if(!this.target)throw Error('教學區塊未找到：'+s.id);
  this.dialog.dataset.step=s.id;this.dialog.dataset.mode=this.mode;this.dialog.querySelector('#tutorialLabel').textContent=this.mode==='life'?'人生模式・操作教學':'自由模式・差異教學';this.dialog.querySelector('#tutorialTitle').textContent=s.title;this.dialog.querySelector('#tutorialText').textContent=s.text;this.dialog.querySelector('#tutorialCount').textContent=(this.index+1)+' / '+this.steps.length;
  this.dialog.querySelector('#tutorialFill').style.width=(this.index+1)/this.steps.length*100+'%';this.dialog.querySelector('#tutorialHint').textContent=this.required?'完成所有步驟後開始遊戲':'重看教學不會改動遊戲進度';
  this.prev.disabled=this.index===0;this.next.textContent=this.index===this.steps.length-1?(this.required?'完成教學，開始遊戲 →':'完成教學 ✓'):'下一步 →';
  const r=this.target.getBoundingClientRect();if(r.top<8||r.bottom>root.innerHeight-8)this.target.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
  this.position();this.next.focus({preventScroll:true});
 }
 position(){
  if(!this.active||!this.target)return;const v={width:document.documentElement.clientWidth,height:root.innerHeight},raw=this.target.getBoundingClientRect(),x=clamp(raw.left-6,3,v.width-3),y=clamp(raw.top-6,3,v.height-3),right=clamp(raw.right+6,x+1,v.width-3),bottom=clamp(raw.bottom+6,y+1,v.height-3),r={x,y,width:right-x,height:bottom-y};
  this.dialog.style.width=v.width+'px';const hole=this.dialog.querySelector('#tutorialHole');for(const k of ['x','y','width','height'])hole.setAttribute(k,r[k]);
  const ring=this.dialog.querySelector('.tutorial-focus');Object.assign(ring.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});
  this.card.style.width='';let box=this.card.getBoundingClientRect();const sideSpace=Math.max(r.x-28,v.width-r.x-r.width-28),verticalSpace=Math.max(r.y-28,v.height-r.y-r.height-28);
  if(verticalSpace<box.height&&sideSpace>=280&&sideSpace<box.width){this.card.style.width=Math.floor(sideSpace)+'px';box=this.card.getBoundingClientRect();}
  const p=placeCard(r,v,box);this.card.style.left=p.x+'px';this.card.style.top=p.y+'px';
 }
 end(finished){
  if(!this.active||(!finished&&this.required))return;this.active=false;cancelAnimationFrame(this.frame);this.dialog.close();this.onStep?.(null);root.scrollTo({left:this.oldScroll[0],top:this.oldScroll[1],behavior:'instant'});if(this.oldFocus?.isConnected)this.oldFocus.focus({preventScroll:true});this.onEnd?.(finished,this.required);
 }
}
root.TaiguTutorial={VERSION,stepsFor,profile,needs,complete,placeCard,Tour};
})(globalThis);
