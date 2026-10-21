(function(root){'use strict';
const moods=['微笑','興奮','得意','認真','緊張','驚訝','哭哭','疲憊','生氣','期待'];
let active=null;
function button({avatarId=1,avatarCharacter='xiaojiu'},avatar){const id=Number.isInteger(avatarId)&&avatarId>=1&&avatarId<=10?avatarId:1,character=avatarCharacter==='xiaoxiaojiu'?'xiaoxiaojiu':'xiaojiu';return avatar(id,character)+'<span>選擇頭像<b>'+(character==='xiaoxiaojiu'?'小小韭':'小韭')+'・'+moods[id-1]+'</b></span><span aria-hidden="true">⌄</span>'; }
function open({online,avatar,setup=false,defaultCharacter='xiaojiu'}){
 if(active)return active;
 active=new Promise(resolve=>{
  const prefs=online.read(),dialog=document.createElement('dialog');let character=prefs.avatarCharacter||defaultCharacter,mood=prefs.avatarId||1,sending=false;
  dialog.className='utility-dialog player-profile-dialog';dialog.setAttribute('aria-labelledby','playerProfileHeading');
  dialog.innerHTML='<div class="dialog-heading"><h2 id="playerProfileHeading">'+(setup?'設定玩家暱稱與頭像':'修改排行榜心情頭像')+'</h2><button type="button" aria-label="關閉玩家設定">×</button></div><form class="player-profile-form"><div class="player-profile-body">'+(setup?'<label>玩家暱稱<input name="nickname" required minlength="2" maxlength="20" autocomplete="nickname"><small class="form-help">2–20 字，可使用中英文、數字、空格、_、- 或 .</small></label><p class="nickname-warning">暱稱不可與其他玩家重複，設定後無法修改。</p><p>遊戲結算後將自動以此暱稱上傳至排行榜。</p>':'<p>排行榜頭像可隨時更換，不會變更遊戲角色或金句的頭像。</p>')+'<section class="profile-avatar-panel" aria-label="排行榜心情頭像"><div class="profile-avatar-heading"><strong>排行榜心情頭像</strong><small>後續可在排行榜畫面更改</small></div><div class="profile-character-tabs" role="group" aria-label="頭像角色"><button type="button" data-profile-character="xiaojiu">小韭</button><button type="button" data-profile-character="xiaoxiaojiu">小小韭</button></div><fieldset class="mood-picker"><legend>選擇心情頭像</legend><div class="profile-moods"></div></fieldset></section></div><div class="player-profile-footer"><p class="profile-status" role="status"></p><div class="dialog-actions"><button type="button" class="secondary" data-profile-cancel>取消</button><button class="primary" type="submit">'+(setup?'儲存並開始遊戲':'儲存頭像')+'</button></div></div></form>';
  const form=dialog.querySelector('form'),status=dialog.querySelector('.profile-status'),submit=form.querySelector('[type=submit]');
  const paint=()=>{dialog.querySelectorAll('[data-profile-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profileCharacter===character)));dialog.querySelector('.profile-moods').innerHTML=moods.map((name,i)=>'<label title="'+name+'"><input type="radio" name="avatarId" value="'+(i+1)+'" '+(mood===i+1?'checked':'')+'>'+avatar(i+1,character)+'<span class="profile-mood-name">'+name+'</span></label>').join('');form.querySelectorAll('[name=avatarId]').forEach(input=>input.onchange=()=>mood=Number(input.value));};
  const close=()=>{if(!sending)dialog.close();};dialog.querySelector('.dialog-heading button').onclick=dialog.querySelector('[data-profile-cancel]').onclick=close;
  dialog.addEventListener('cancel',e=>{if(sending)e.preventDefault();});dialog.addEventListener('close',()=>{dialog.remove();active=null;resolve(dialog.savedProfile||null);},{once:true});
  dialog.querySelectorAll('[data-profile-character]').forEach(b=>b.onclick=()=>{if(sending)return;character=b.dataset.profileCharacter;paint();});
  form.onsubmit=async e=>{e.preventDefault();if(sending)return;sending=true;form.querySelectorAll('button,input').forEach(b=>b.disabled=true);status.textContent='正在儲存雲端設定…';try{const result=await online.saveProfile({...(setup?{nickname:form.elements.nickname.value.trim()}:{}),avatarId:mood,avatarCharacter:character});dialog.savedProfile=result;dialog.close();}catch(error){status.textContent=error.message;status.classList.add('error');sending=false;form.querySelectorAll('button,input').forEach(b=>b.disabled=false);}};
  paint();document.body.append(dialog);dialog.showModal();if(setup)form.elements.nickname.focus();else submit.focus();
 });return active;
}
root.TaiguPlayerProfile={open,button};
})(globalThis);
