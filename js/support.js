(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,ease=t=>1-Math.pow(1-clamp(t,0,1),3);
class Scene{
 constructor({dialog,sound}){
  this.dialog=dialog;this.sound=sound;this.active=false;this.canvas=dialog.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.stage=dialog.querySelector('.support-stage');this.tapButton=dialog.querySelector('#supportTap');this.done=dialog.querySelector('#supportContinue');this.frame=0;
  this.tapButton.addEventListener('pointerdown',e=>{e.preventDefault();this.tap(e.clientX,e.clientY);});
  this.tapButton.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)this.tap();}});
  this.tapButton.addEventListener('click',e=>{if(e.detail===0)this.tap();});
  this.done.onclick=()=>this.close();dialog.querySelector('#supportSkip').onclick=()=>this.skip();dialog.addEventListener('cancel',e=>{e.preventDefault();if(this.ready)this.close();else this.skip();});
  root.addEventListener('resize',()=>{if(this.active)this.draw();});document.addEventListener('visibilitychange',()=>{this.lastStamp=null;});
 }
 open(context){
  if(this.active)throw Error('小劇場已在播放');this.active=true;this.context=context;this.elapsed=0;this.energy=15;this.taps=0;this.ready=false;this.breakStart=null;this.lastStamp=null;this.lastPhase='';this.oldFocus=document.activeElement;this.reduced=root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  this.dialog.querySelector('#supportDate').textContent=context.date.replaceAll('-','.')+' · '+context.id+' '+context.name+' · 兩日 '+(context.drop*100).toFixed(2)+'%';
  this.dialog.querySelector('#supportHeadline').textContent='手指支撐線！';this.dialog.querySelector('#supportInstructions').textContent='鏡頭鎖定當天這根 K 線……';this.dialog.querySelector('#supportResult').textContent='';this.dialog.querySelector('#supportCount').textContent='0';this.dialog.querySelector('#supportSkip').hidden=false;this.dialog.querySelector('.support-avatar').dataset.emotion='panic';this.dialog.querySelector('#supportSpeech').textContent='這裡……一定有支撐！';this.done.hidden=true;this.done.textContent=context.doneLabel||'回到行情 →';this.tapButton.disabled=false;
  this.dialog.querySelectorAll('.support-burst').forEach(n=>n.remove());this.dialog.showModal();this.tapButton.focus({preventScroll:true});this.sound?.('support-start');
  this.promise=new Promise(resolve=>this.resolve=resolve);this.tick=now=>{if(!this.active)return;if(!document.hidden){const dt=this.lastStamp===null?0:Math.min(80,now-this.lastStamp);this.elapsed+=dt;this.energy=Math.max(0,this.energy-dt*.024);this.update();this.draw();}this.lastStamp=now;if(this.active&&!this.ready)this.frame=requestAnimationFrame(this.tick);};this.frame=requestAnimationFrame(this.tick);return this.promise;
 }
 tap(clientX,clientY){
  if(!this.active||this.ready||TaiguTheatre.phase(this.elapsed)==='break')return;this.taps=Math.min(10000,this.taps+1);this.context.onTap?.(this.taps);this.energy=Math.min(100,this.energy+16);this.dialog.querySelector('#supportCount').textContent=this.taps;this.dialog.querySelector('#supportSpeech').textContent=['撐住！我的午餐錢！','我有在撐！看到了嗎！','支撐在這裡！不要破啊！'][this.taps%3];
  this.sound?.('support-hit');const r=this.stage.getBoundingClientRect(),x=Number.isFinite(clientX)?clientX-r.left:r.width*.64,y=Number.isFinite(clientY)?clientY-r.top:r.height*.68,burst=document.createElement('span');burst.className='support-burst';burst.style.left=clamp(x,20,r.width-20)+'px';burst.style.top=clamp(y,20,r.height-20)+'px';burst.style.setProperty('--tilt',(this.taps%2? -12:12)+'deg');burst.textContent='撐！';this.stage.append(burst);burst.addEventListener('animationend',()=>burst.remove(),{once:true});
  if(!this.reduced)this.stage.animate([{transform:'translate(0,0)'},{transform:'translate(-3px,2px)'},{transform:'translate(2px,-2px)'},{transform:'translate(0,0)'}],{duration:140});this.draw();
 }
 update(){
  const p=TaiguTheatre.phase(this.elapsed);this.dialog.dataset.phase=p;this.dialog.querySelector('#supportEnergy').style.width=this.energy+'%';
  if(p!==this.lastPhase){this.lastPhase=p;if(p==='play')this.dialog.querySelector('#supportInstructions').textContent='連續點擊，支撐住股價！';if(p==='break'){this.breakStart=this.lastPrice;this.sound?.('support-break');this.dialog.querySelector('#supportHeadline').textContent='支撐……破了！';this.dialog.querySelector('#supportInstructions').textContent='不行……還在跌！';this.dialog.querySelector('.support-avatar').dataset.emotion='cry';this.dialog.querySelector('#supportSpeech').textContent='手指好痠，市場怎麼沒感覺？';if(!this.reduced)this.stage.animate([{transform:'translate(0,0)'},{transform:'translate(-7px,4px)'},{transform:'translate(6px,-3px)'},{transform:'translate(0,0)'}],{duration:390});}}
  if(this.elapsed>=TaiguTheatre.duration.zoom+TaiguTheatre.duration.play+TaiguTheatre.duration.break+TaiguTheatre.duration.settle){this.ready=true;this.tapButton.disabled=true;this.dialog.dataset.phase='result';this.dialog.querySelector('#supportHeadline').textContent='支撐……破了！';this.dialog.querySelector('.support-avatar').dataset.emotion='cry';this.dialog.querySelector('#supportSpeech').textContent='手指好痠，市場怎麼沒感覺？';this.dialog.querySelector('#supportInstructions').textContent='手指撐住了螢幕，沒有撐住市場。';this.dialog.querySelector('#supportResult').textContent='連點 '+this.taps+' 次 · 當日真實收盤 '+this.context.rows.at(-1)[4].toFixed(2)+' 元';this.dialog.querySelector('#supportSkip').hidden=true;this.done.hidden=false;this.done.focus({preventScroll:true});}
 }
 skip(){if(!this.active||this.ready)return;this.elapsed=TaiguTheatre.duration.zoom+TaiguTheatre.duration.play+TaiguTheatre.duration.break+TaiguTheatre.duration.settle;this.lastPhase='';this.update();this.draw();cancelAnimationFrame(this.frame);}
 draw(){
  if(!this.active)return;const r=this.stage.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h)return;const dpr=root.devicePixelRatio||1;if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#101e19';ctx.fillRect(0,0,w,h);
  const rows=this.context.rows.slice(-18),last=rows.at(-1),n=rows.length,hi=Math.max(...rows.slice(-3).map(p=>p[2]))*1.012,lo=Math.min(...rows.slice(-3).map(p=>p[3]))*.988,span=hi-lo||1,y=p=>h*.12+(hi-p)/span*h*.61,step=w*.54/Math.max(1,n-1),x=i=>w*.08+i*step,lastX=x(n-1),openY=y(last[1]);
  const camera=this.reduced?1:ease(this.elapsed/TaiguTheatre.duration.zoom),zx=lerp(1,3.6,camera),zy=lerp(1,clamp(h*.67/Math.max(1,y(last[3])-openY),1.3,5),camera),anchorX=lerp(lastX,w*.64,camera),anchorY=lerp(openY,h*.19,camera),sx=xx=>anchorX+(xx-lastX)*zx,sy=yy=>anchorY+(yy-openY)*zy;
  const spotX=sx(lastX),spotY=h*.54,light=ctx.createRadialGradient(spotX,spotY,10,spotX,spotY,Math.max(170,h*.65));light.addColorStop(0,'#b4edc61d');light.addColorStop(.65,'#688f7510');light.addColorStop(1,'#00000000');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#9ab8a01c';ctx.lineWidth=1;for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(12,h*i/6);ctx.lineTo(w-12,h*i/6);ctx.stroke();}
  const price=TaiguTheatre.visualPrice(this.elapsed,last,this.energy,this.breakStart);this.lastPrice=price;
  rows.forEach((bar,i)=>{const isLast=i===n-1,close=isLast?price:bar[4],xx=sx(x(i)),yo=sy(y(bar[1])),yc=sy(y(close)),color=close>=bar[1]?'#e986a4':'#68d9bc',bw=isLast?clamp(step*.58*zx,22,74):clamp(step*.58*zx,5,54);if(xx< -80||xx>w+80)return;ctx.globalAlpha=isLast?1:.24;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=isLast?3:1;ctx.shadowColor=isLast?'#b3ffe1':'transparent';ctx.shadowBlur=isLast?18:0;ctx.beginPath();ctx.moveTo(xx,sy(y(bar[2])));ctx.lineTo(xx,isLast&&!this.ready?Math.max(yo,yc):sy(y(bar[3])));ctx.stroke();ctx.fillRect(xx-bw/2,Math.min(yo,yc),bw,Math.max(3,Math.abs(yo-yc)));});ctx.globalAlpha=1;ctx.shadowBlur=0;
  const floor=h*.68,broken=['break','result'].includes(this.dialog.dataset.phase);ctx.strokeStyle=broken?'#dc8197':'#b8e9c8';ctx.lineWidth=3;ctx.setLineDash([9,5]);ctx.beginPath();ctx.moveTo(spotX-100,floor);ctx.lineTo(spotX-7,floor);ctx.moveTo(spotX+7,floor+(broken?20:0));ctx.lineTo(spotX+100,floor+(broken?37:0));ctx.stroke();ctx.setLineDash([]);
  ctx.font='bold '+(w<500?14:18)+'px ui-monospace,monospace';ctx.fillStyle='#e5fff0';ctx.textAlign='left';const py=clamp(sy(y(price)),34,h-32);ctx.fillText(price.toFixed(2),Math.min(w-85,spotX+57),py);ctx.font='11px sans-serif';ctx.fillStyle='#a4bbae';ctx.fillText(this.context.date,clamp(spotX-45,15,w-90),h-14);
  const hand=this.dialog.querySelector('.support-hand');hand.style.left=spotX+'px';hand.style.top=floor+'px';
 }
 close(){if(!this.active||!this.ready)return;this.active=false;cancelAnimationFrame(this.frame);this.dialog.close();this.oldFocus?.focus?.({preventScroll:true});this.resolve({taps:this.taps});}
}
root.TaiguSupport={Scene};
})(globalThis);
