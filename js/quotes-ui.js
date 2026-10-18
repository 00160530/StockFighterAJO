(function(root){'use strict';
const tabs=[['popular','人氣金句'],['latest','最新金句'],['featured','作者精選']];
const introduction='留下給股市夥伴的金句吧，我先來「買進群創，身心受創」';
const count=value=>[...value.normalize('NFC').trim()].length;
function randomTab(random=Math.random){return tabs[Math.floor(random()*tabs.length)][0];}
function quoteHTML(q,esc){return '<article class="stock-quote"><blockquote>「'+esc(q.body)+'」</blockquote><div class="stock-quote-meta"><span>'+(q.featured?'✦ 作者精選':'股友金句')+'</span><button type="button" class="quote-like" data-quote-like="'+esc(q.id)+'" aria-pressed="'+!!q.liked+'" aria-label="'+(q.liked?'取消按讚':'按讚')+'：'+esc(q.body)+'"><span aria-hidden="true">'+(q.liked?'♥':'♡')+'</span> <b>'+Number(q.likes).toLocaleString('zh-TW')+'</b></button></div></article>';}
async function open({online,utility,esc}){
 let tab=randomTab(),generation=0,draft='',sending=false;
 utility('股友金句','<p class="quotes-introduction">'+introduction+'</p><div class="quotes-tabs" role="tablist" aria-label="金句分類">'+tabs.map(([id,label])=>'<button type="button" role="tab" id="quotes-tab-'+id+'" data-quotes-tab="'+id+'" aria-controls="quotesList" aria-selected="'+(id===tab)+'">'+label+'</button>').join('')+'</div><div id="quoteComposer" class="quote-composer"></div><p id="quotesStatus" role="status"></p><div id="quotesList" role="tabpanel" tabindex="0" class="quotes-list"></div>','stock-quotes');
 const $=id=>document.getElementById(id),list=$('quotesList'),composer=$('quoteComposer'),status=$('quotesStatus'),buttons=[...document.querySelectorAll('[data-quotes-tab]')];
 function compose(self){
  if(self.submitted){composer.innerHTML='<p class="quote-own">你的金句：'+esc(self.body)+(self.hidden?'（已註銷）':'')+'</p><small>你已留下金句，每個匿名玩家只能留下一句。</small>';return;}
  if(!self.eligible){composer.innerHTML='<p>完成一次人生模式後，就能留下你的金句。</p>';return;}
  composer.innerHTML='<form id="stockQuoteForm"><label for="stockQuoteText">我的金句</label><div class="quote-input-row"><input id="stockQuoteText" type="text" required autocomplete="off" aria-describedby="quoteLimit quoteRule" value="'+esc(draft)+'"><button type="submit" class="primary">留下金句</button></div><small id="quoteLimit"></small><small id="quoteRule">最多 25 個字；每個匿名玩家只能留下一句，送出後無法修改，註銷後也不能重留。</small></form>';
  const form=$('stockQuoteForm'),input=$('stockQuoteText'),submit=form.querySelector('button'),limit=$('quoteLimit');
  const update=()=>{draft=input.value;const n=count(draft);limit.textContent=n+' / 25 字';limit.classList.toggle('quote-over-limit',n>25);submit.disabled=sending||n<1||n>25;};input.oninput=update;update();
  form.onsubmit=async e=>{e.preventDefault();if(sending||count(input.value)<1||count(input.value)>25)return;sending=true;update();status.textContent='正在送出金句…';try{await online.createQuote(input.value.normalize('NFC').trim());draft='';await load();}catch(error){if(list.isConnected){status.textContent=error.message;if(error.code==='QUOTE_ALREADY_SUBMITTED')await load();}}finally{sending=false;if(form.isConnected)update();}};
 }
 async function load(){
  const current=++generation;status.textContent='正在讀取股友金句…';list.setAttribute('aria-busy','true');list.setAttribute('aria-labelledby','quotes-tab-'+tab);list.replaceChildren();
  buttons.forEach(b=>{const selected=b.dataset.quotesTab===tab;b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;});
  try{
   const data=await online.quotes(tab);if(!list.isConnected||current!==generation)return;compose(data.self);
   list.innerHTML=data.items.map(q=>quoteHTML(q,esc)).join('');status.textContent=data.items.length?'每種分類最多顯示 50 句。':'這裡還沒有金句，等你來開場。';
   list.querySelectorAll('[data-quote-like]').forEach(button=>button.onclick=async()=>{if(button.disabled)return;button.disabled=true;const liked=button.getAttribute('aria-pressed')!=='true';try{await online.likeQuote(button.dataset.quoteLike,liked);if(list.isConnected&&current===generation)await load();}catch(error){if(list.isConnected&&current===generation){status.textContent=error.message;button.disabled=false;}}});
  }catch(error){if(list.isConnected&&current===generation){status.textContent=error.message;composer.innerHTML='<button type="button" class="secondary" id="retryQuotes">重新連線</button>';$('retryQuotes').onclick=load;}}
  finally{if(list.isConnected&&current===generation)list.setAttribute('aria-busy','false');}
 }
 buttons.forEach((button,index)=>{
  button.onclick=()=>{if(button.dataset.quotesTab===tab)return;tab=button.dataset.quotesTab;load();};
  button.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%buttons.length;else if(e.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus();buttons[next].click();};
 });
 await load();
}
root.TaiguQuotesUI={open,tabs,introduction,count,randomTab,quoteHTML};
})(globalThis);
