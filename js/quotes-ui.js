(function(root){'use strict';
const tabs=[['popular','人氣金句'],['latest','最新金句'],['featured','作者精選']];
const introduction='留下給股市夥伴的金句吧，我先來「買進群創，身心受創」';
const count=value=>[...value.normalize('NFC').trim()].length;
function randomTab(random=Math.random){return tabs[Math.floor(random()*tabs.length)][0];}
const moods=['微笑','興奮','得意','認真','緊張','驚訝','哭哭','疲憊','生氣','期待'];
function quoteTime(seconds,now=Date.now()){
 const date=new Date(seconds*1000),elapsed=Math.max(0,Math.floor((now-date.getTime())/1000)),full=date.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 return {full,iso:date.toISOString(),label:elapsed<60?'剛剛':elapsed<3600?Math.floor(elapsed/60)+' 分鐘前':elapsed<86400?Math.floor(elapsed/3600)+' 小時前':elapsed<604800?Math.floor(elapsed/86400)+' 天前':date.toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei'})};
}
function quoteHTML(q,esc,{avatar=()=>'',now=Date.now(),ownId}={}){const time=quoteTime(q.createdAt||1,now),isOwn=!!ownId&&q.id===ownId;return '<article class="stock-quote'+(isOwn?' stock-quote-own':'')+'"><header class="quote-comment-head">'+avatar(q.avatarId||1,q.avatarCharacter||'xiaojiu')+'<div><strong>'+esc(q.nickname||'匿名股友')+(isOwn?' <span class="quote-you">(你)</span>':'')+'</strong><time datetime="'+time.iso+'" title="'+esc(time.full)+'" aria-label="留言時間 '+esc(time.full)+'">'+esc(time.label)+'</time></div>'+(q.featured?'<small>✦ 作者精選</small>':'')+'</header><p class="quote-comment-body">'+esc(q.body)+'</p><div class="stock-quote-meta"><button type="button" class="quote-like" data-quote-like="'+esc(q.id)+'" aria-pressed="'+!!q.liked+'" aria-label="'+(q.liked?'取消按讚':'按讚')+'：'+esc(q.body)+'"><span aria-hidden="true">'+(q.liked?'♥':'♡')+'</span> <b>'+Number(q.likes).toLocaleString('zh-TW')+'</b></button></div></article>';}
async function open({online,utility,esc,avatar=()=>'',defaultCharacter='xiaojiu'}){
 const prefs=online.read?.()||{};
 let tab=randomTab(),generation=0,draft='',draftName='',sending=false,self={},composeDialog=null,chosenCharacter=['xiaojiu','xiaoxiaojiu'].includes(prefs.quoteAvatarCharacter)?prefs.quoteAvatarCharacter:defaultCharacter,chosenMood=Number.isInteger(prefs.quoteAvatarId)&&prefs.quoteAvatarId>=1&&prefs.quoteAvatarId<=10?prefs.quoteAvatarId:1;
 utility('股友金句','<div class="quotes-intro-row"><p class="quotes-introduction">'+introduction+'</p><button type="button" id="openQuoteComposer" class="secondary" disabled>我也要留言</button></div><div class="quotes-tabs" role="tablist" aria-label="金句分類">'+tabs.map(([id,label])=>'<button type="button" role="tab" id="quotes-tab-'+id+'" data-quotes-tab="'+id+'" aria-controls="quotesList" aria-selected="'+(id===tab)+'">'+label+'</button>').join('')+'</div><p id="quotesStatus" role="status"></p><div id="quotesList" role="tabpanel" tabindex="0" class="quotes-list"></div>','stock-quotes');
 const $=id=>document.getElementById(id),list=$('quotesList'),composeButton=$('openQuoteComposer'),outer=$('utilityDialog'),status=$('quotesStatus'),buttons=[...document.querySelectorAll('[data-quotes-tab]')];
 const alive=()=>list.isConnected&&outer.open&&outer.dataset.view==='stock-quotes';
 function closeComposer(){if(composeDialog?.open)composeDialog.close();}
 outer.addEventListener('close',closeComposer,{once:true});
 function compose(){
  if(!alive()||composeDialog||sending)return;
  composeDialog=document.createElement('dialog');composeDialog.className='utility-dialog quote-compose-dialog';composeDialog.setAttribute('aria-labelledby','quoteComposeTitle');
  composeDialog.innerHTML='<div class="dialog-heading"><h2 id="quoteComposeTitle">留下股友金句</h2><button type="button" id="closeQuoteComposer" aria-label="關閉留言視窗">×</button></div><div id="quoteComposer" class="quote-composer"></div><p id="quoteComposeStatus" role="status"></p><div class="dialog-actions quote-compose-actions"><button type="button" id="cancelQuoteComposer" class="secondary">取消</button></div>';
  document.body.append(composeDialog);
  const dialog=composeDialog,composer=$('quoteComposer'),message=$('quoteComposeStatus');
  dialog.addEventListener('close',()=>{dialog.remove();composeDialog=null;if(alive())composeButton.focus();},{once:true});
  $('closeQuoteComposer').onclick=$('cancelQuoteComposer').onclick=closeComposer;
  const editing=!!self.submitted,original={...self};
  if(editing){
   $('quoteComposeTitle').textContent='修改我的股友金句';
   if(self.hidden){$('quoteComposeTitle').textContent='我的股友金句';$('cancelQuoteComposer').textContent='關閉';composer.innerHTML='<label for="ownStockQuote">我的金句</label><textarea id="ownStockQuote" class="quote-own-text" readonly rows="3">'+esc(self.body||'')+'</textarea><small>你的金句已被管理員註銷。</small>';dialog.showModal();return;}
   draft=self.body||'';chosenMood=self.avatarId||1;chosenCharacter=self.avatarCharacter||defaultCharacter;
  }
  if(!editing&&!self.eligible){composer.innerHTML='<p>上傳排行榜後才可留言喔。</p>';dialog.showModal();return;}
  if(self.nickname)draftName=self.nickname;
  composer.innerHTML='<form id="stockQuoteForm"><div class="quote-author-input"><label for="quoteNickname">留言暱稱<input id="quoteNickname" required minlength="2" maxlength="20" autocomplete="nickname" value="'+esc(draftName)+'" readonly></label><details id="quoteAvatarPicker"><summary id="quoteAvatarSummary"></summary><div class="quote-avatar-panel"><div class="quote-character-tabs">'+[['xiaojiu','小韭'],['xiaoxiaojiu','小小韭']].map(([id,label])=>'<button type="button" data-quote-character="'+id+'" aria-pressed="'+(id===chosenCharacter)+'">'+label+'</button>').join('')+'</div><fieldset class="quote-mood-options"><legend>選擇心情頭像</legend><div id="quoteMoodOptions"></div></fieldset></div></details></div><small>沿用排行榜暱稱。</small><label for="stockQuoteText">我的金句</label><div class="quote-input-row"><input id="stockQuoteText" type="text" required autocomplete="off" aria-describedby="quoteLimit quoteRule" value="'+esc(draft)+'"></div><small id="quoteLimit"></small><small id="quoteRule">最多 25 個字；每個匿名玩家只能留下一句，可修改；被管理員註銷後無法修改。</small></form>';
  dialog.querySelector('.quote-compose-actions').insertAdjacentHTML('beforeend','<button type="submit" form="stockQuoteForm" class="primary">'+(editing?'儲存修改':'留下金句')+'</button>');
  const form=$('stockQuoteForm'),input=$('stockQuoteText'),name=$('quoteNickname'),submit=dialog.querySelector('button[type=submit]'),limit=$('quoteLimit');
  const paintAvatar=()=>{
   $('quoteAvatarSummary').innerHTML=avatar(chosenMood,chosenCharacter)+'<span>選擇頭像<br><b>'+(chosenCharacter==='xiaoxiaojiu'?'小小韭':'小韭')+'・'+moods[chosenMood-1]+'</b></span><span aria-hidden="true">⌄</span>';
   $('quoteMoodOptions').innerHTML=moods.map((m,i)=>'<label><input type="radio" name="quoteAvatarId" value="'+(i+1)+'" '+(chosenMood===i+1?'checked':'')+'>'+avatar(i+1,chosenCharacter)+'<span>'+m+'</span></label>').join('');
   form.querySelectorAll('[data-quote-character]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.quoteCharacter===chosenCharacter));
   form.querySelectorAll('[name=quoteAvatarId]').forEach(radio=>radio.onchange=()=>{chosenMood=Number(radio.value);$('quoteAvatarPicker').open=false;paintAvatar();update();$('quoteAvatarSummary').focus();});
  };
  form.querySelectorAll('[data-quote-character]').forEach(b=>b.onclick=()=>{chosenCharacter=b.dataset.quoteCharacter;paintAvatar();update();});paintAvatar();
  const validName=()=>count(name.value)>=2&&count(name.value)<=20&&/^[\p{L}\p{N} _.-]+$/u.test(name.value.normalize('NFC').trim());
  const update=()=>{draft=input.value;draftName=name.value;const n=count(draft);limit.textContent=n+' / 25 字';limit.classList.toggle('quote-over-limit',n>25);submit.disabled=sending||n<1||n>25||!validName()||(editing&&draft.normalize('NFC').trim()===original.body&&chosenMood===original.avatarId&&chosenCharacter===original.avatarCharacter);form.inert=sending;};input.oninput=name.oninput=update;update();
  form.onsubmit=async e=>{e.preventDefault();if(submit.disabled||sending||count(input.value)<1||count(input.value)>25||!validName())return;sending=true;composeButton.disabled=true;update();message.textContent=editing?'正在儲存修改…':'正在送出金句…';try{const content=input.value.normalize('NFC').trim(),author={avatarId:chosenMood,avatarCharacter:chosenCharacter};if(editing)await online.updateQuote(original.quoteId,content,{...author,revision:original.revision});else await online.createQuote(content,{...author,nickname:name.value.normalize('NFC').trim()});try{const saved=online.read();saved.quoteAvatarId=chosenMood;saved.quoteAvatarCharacter=chosenCharacter;online.write(saved);}catch{}draft='';closeComposer();if(alive())await load();}catch(error){if(!dialog.isConnected&&alive())status.textContent=error.message;if(dialog.isConnected){message.textContent=error.message;if(['QUOTE_ALREADY_SUBMITTED','QUOTE_CHANGED','QUOTE_REVOKED','QUOTE_NOT_FOUND'].includes(error.code)){online.invalidateQuotes?.();closeComposer();if(alive()){await load();status.textContent=error.message;}}if(error.code==='NICKNAME_LOCKED'&&error.nickname){name.value=draftName=error.nickname;name.readOnly=true;}}}finally{sending=false;if(alive())composeButton.disabled=false;if(form.isConnected)update();}};
  dialog.showModal();
 }
 composeButton.onclick=compose;
 async function load(){
  const current=++generation;status.textContent='正在讀取股友金句…';list.setAttribute('aria-busy','true');list.setAttribute('aria-labelledby','quotes-tab-'+tab);list.replaceChildren();
  buttons.forEach(b=>{const selected=b.dataset.quotesTab===tab;b.setAttribute('aria-selected',selected);b.tabIndex=selected?0:-1;});
  try{
   const data=await online.quotes(tab);if(!alive()||current!==generation)return;self=data.self;composeButton.textContent=self.submitted?'你已經留過言':'我也要留言';composeButton.disabled=false;
   list.innerHTML=data.items.map(q=>quoteHTML(q,esc,{avatar,ownId:self.quoteId})).join('');status.textContent=data.items.length?'':'這裡還沒有金句，等你來開場。';
   list.querySelectorAll('[data-quote-like]').forEach(button=>button.onclick=async()=>{if(button.disabled)return;button.disabled=true;const liked=button.getAttribute('aria-pressed')!=='true';try{await online.likeQuote(button.dataset.quoteLike,liked);if(alive()&&current===generation)await load();}catch(error){if(alive()&&current===generation){status.textContent=error.message;button.disabled=false;}}});
  }catch(error){if(alive()&&current===generation){status.textContent=error.message;status.insertAdjacentHTML('beforeend',' <button type="button" class="secondary" id="retryQuotes">重新連線</button>');$('retryQuotes').onclick=load;}}
  finally{if(alive()&&current===generation)list.setAttribute('aria-busy','false');}
 }
 buttons.forEach((button,index)=>{
  button.onclick=()=>{if(button.dataset.quotesTab===tab)return;tab=button.dataset.quotesTab;load();};
  button.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%buttons.length;else if(e.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=buttons.length-1;else return;e.preventDefault();buttons[next].focus();buttons[next].click();};
 });
 await load();
}
root.TaiguQuotesUI={open,tabs,introduction,count,randomTab,quoteHTML,quoteTime};
})(globalThis);
