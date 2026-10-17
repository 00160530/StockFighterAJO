(function(){
'use strict';
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(!window.TAIGU_DATA){document.body.innerHTML='<p style="padding:40px">歷史資料未載入。請確認 data/market.js 和 index.html 位於同一份完整的遊戲資料夾。</p>';return;}
const data=window.TAIGU_DATA,market=TaiguEngine.createMarket(data),story=window.TAIGU_STORY;
const KEY='taigu-warrior.v1',fmt=n=>Math.round(n).toLocaleString('zh-TW'),dollars=n=>'$'+fmt(n),pct=n=>(n>=0?'+':'')+n.toFixed(2)+'%',tone=n=>n>0?'up':n<0?'down':'neutral';
let state=market.fresh(),selected='0050',side='buy',tab='holdings',introIndex=0,replay=false,toastTimer,busy=false,resultShown=false,storageFailed=false;
let quantityMode='fixed';
let screen='title',previewMode=null,book={version:1,runs:[]},recordSignature='';
const music=new TaiguMusic.Player(updateMusicUI);
const chart=new TaiguChart($('marketChart'),$('chartTooltip'),market);
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function beep(kind='click'){music.sfx(kind);}
function identify(s){if(typeof s.runId!=='string'||s.runId.length>120)s.runId=window.crypto?.randomUUID?.()||'run-'+Date.now()+'-'+Math.random().toString(36).slice(2);return s;}
function validateState(raw){const s=identify(market.validate(raw));if(s.activeEvent&&!story.events.some(e=>e.id===s.activeEvent))throw Error('未知劇情事件');if(!s.seen.every(id=>story.events.some(e=>e.id===id)))throw Error('未知劇情紀錄');return s;}
function pack(s=state){return {format:'taigu-warrior-save',version:1,savedAt:new Date().toISOString(),state:s};}
function writeStorage(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{storageFailed=true;document.querySelector('.local-tag').textContent='⚠ 自動存檔不可用';notify('瀏覽器無法儲存進度。請從「存檔管理」匯出存檔。');return false;}}
function save(){if(!storageFailed)writeStorage(KEY+'.auto',pack());}
function load(){try{const text=localStorage.getItem(KEY+'.auto');if(text){const p=JSON.parse(text);state=validateState(p.state);}}catch(e){notify('存檔無法載入：'+e.message+'。請使用存檔管理匯入備份。');try{const raw=localStorage.getItem(KEY+'.auto');if(raw)localStorage.setItem(KEY+'.recovery',raw);}catch{} }}
function changed(resetChart=false){market.trigger(state,story.events);save();render(resetChart);}
function selectSymbol(id){quantityMode='fixed';selected=id;$('orderMessage').textContent='';render(true);}
function quote(id){const rows=market.visibleRows(state,id),r=rows.at(-1),prev=rows.at(-2);return {r,change:r&&prev?r[4]-prev[4]:0,rate:r&&prev?(r[4]/prev[4]-1)*100:0};}
function render(resetChart=false){
 const d=market.date(state),e=market.equity(state,d),b=market.equity(state.benchmark,d),pr=(e/1e6-1)*100,br=(b/1e6-1)*100,alpha=pr-br;
 $('gameDate').textContent=state.day<0?'2020.01.01':d.replaceAll('-','.');$('phase').textContent=state.day<0?'元旦休市':state.status==='playing'?'收盤後':'本輪結算';
 $('sessionCount').textContent=state.day<0?'明日開始交易 · 行情截至 2019/12/31':`第 ${state.day+1} / ${data.calendar.length} 個交易日`;
 $('equity').textContent=dollars(e);$('cash').textContent=dollars(state.cash);$('benchmark').textContent=dollars(b);$('playerReturn').textContent='總報酬 '+pct(pr);$('playerReturn').className=tone(pr);$('benchmarkReturn').textContent='總報酬 '+pct(br);$('benchmarkReturn').className=tone(br);
 const receivable=state.receivables.reduce((n,r)=>n+r.amount,0);$('holdingValue').textContent=`持股 ${dollars(e-state.cash-receivable)}${receivable?' · 應收 '+dollars(receivable):''}`;
 $('alpha').innerHTML=(alpha>=0?'+':'')+alpha.toFixed(2)+' <em>百分點</em>';$('alpha').style.color=alpha<0?'#ac4d68':'#47795d';$('alphaHint').textContent=alpha>0?'目前領先 '+dollars(e-b):alpha<0?'距離平行人生還差 '+dollars(b-e):'起跑線一樣，結局由你決定。';
 $('watchItems').innerHTML=['TAIEX','0050','2330','2317','2454'].map(id=>{const q=quote(id);return `<button class="watch-item ${id===selected?'selected':''}" data-symbol="${id}" aria-pressed="${id===selected}"><div class="watch-top"><strong>${esc(data.instruments[id].name)}</strong><b class="${tone(q.change)}">${q.r?q.r[4].toFixed(id==='TAIEX'?0:2):'—'}</b></div><div class="watch-bottom"><span>${id==='TAIEX'?'TWSE / 大盤':id}</span><b class="${tone(q.change)}">${pct(q.rate)}</b></div></button>`;}).join('');
 document.querySelectorAll('[data-symbol]').forEach(el=>el.onclick=()=>selectSymbol(el.dataset.symbol));
 const inst=data.instruments[selected],q=quote(selected);$('symbolCode').textContent=selected==='TAIEX'?'TWSE':selected;$('symbolName').textContent=inst.name;$('symbolSector').textContent=inst.sector;
 $('quotePrice').textContent=q.r?q.r[4].toFixed(2):'—';$('quotePrice').className=tone(q.change);$('quoteChange').textContent=(q.change>=0?'+':'')+q.change.toFixed(2)+' ('+pct(q.rate)+')';$('quoteChange').className=tone(q.change);
 $('chipNote').textContent=`法人截至 ${market.chipCutoff(state).replaceAll('-','/')} · ${inst.chipUnit==='元'?'大盤金額':'買賣超股數'}`;
 const stale=state.day>=0&&!market.bar(selected,d),hasSplit=(inst.splits||[]).some(s=>s.date<=d);
 $('suspensionNote').textContent=stale?'本標的暫停交易，畫面與持股估值沿用最近收盤價。':hasSplit?(chart.adjust?'分割還原僅套用遊戲當下已發生的分割；成交仍用當日原始報價。':'原始價格包含分割跳空。可勾選「分割還原」輔助判讀均線。'):'';
 $('stressText').textContent=state.stress+' / 100';$('stressBar').style.width=state.stress+'%';$('rankTitle').textContent=state.day<30?'剛發芽的小韭':alpha>10?'有想法的小韭':alpha< -10?'逆風中的小韭':'努力研究的小韭';
 $('rankText').textContent=state.stress>60?'先喝口水，手先離開買進鍵。':'先活下來，再談財富自由。';
 const chapter=[...story.events].reverse().find(ev=>ev.date<=d);$('chapterLabel').textContent=chapter?chapter.chapter:'PROLOGUE / 重新上市';
 renderStory();renderTrade();renderPortfolio();chart.update(state,selected,resetChart);
 $('nextDate').textContent=data.calendar[state.day+1]?.replaceAll('-','.')||'已到資料終點';$('nextBtn').innerHTML=(state.day<0?'迎接第一次開盤':state.status==='playing'?'前往下一個交易日':'本輪已結算')+' <span>→</span>';
 for(const id of ['nextBtn','weekBtn','monthBtn'])$(id).disabled=busy||state.status!=='playing'||!!state.activeEvent;
 $('coverage').textContent=`真實歷史 ${data.start.replaceAll('-','/')}—${data.end.replaceAll('-','/')} · 本機存檔`;
 $('homeBtn').disabled=busy;
 if(state.status!=='playing')rememberRun('completed');
 renderTitle();syncMusic();
 if(screen==='game'&&state.status!=='playing'&&!resultShown){resultShown=true;setTimeout(()=>{if(screen==='game')showResult();},80);}
}
let lastReply='';
function renderStory(){
 const ev=story.events.find(e=>e.id===state.activeEvent);
 $('storyChoices').innerHTML='';
 if(ev){$('storySpeaker').textContent=ev.speaker;$('storyTag').textContent=ev.tag;$('storyTitle').textContent=ev.title;$('storyText').textContent=ev.text;$('storyHint').textContent='完成選擇後，才能繼續推進時間。';
  ev.choices.forEach(choice=>{const btn=document.createElement('button');btn.className='choice-btn';btn.textContent=choice.label;btn.disabled=(choice.cost||0)>state.cash;btn.onclick=()=>{try{market.choose(state,ev,choice);lastReply=choice.reply;beep();changed();}catch(e){notify(e.message);}};$('storyChoices').append(btn);});
 }else{$('storySpeaker').textContent='小韭';$('storyTag').textContent='內心獨白・下一步由你決定';$('storyTitle').textContent=state.day<0?'一百萬，不是一串數字。':state.orders.length?'下好委託，也放下手機。':'市場還在，先想清楚。';$('storyText').textContent=lastReply||(state.day<0?'那是五年不敢亂花的薪水。上一輪，我把決定交給群組。這一輪，先學著把決定拿回來。':'看過價格，記下理由。今天不交易，也是一種決定。');$('storyHint').textContent='劇情會隨日期觸發；群組台詞為虛構，沒有未來行情提示。';}
 const lead=market.equity(state,market.date(state))-market.equity(state.benchmark,market.date(state));
 const emotion=ev&&/恐懼|風險|錯失/.test(ev.tag)?2:state.stress>60?3:state.day<0?0:lead>100000?4:lead>0?1:state.stress<6?5:0;
 document.querySelectorAll('#gameShell .character-sprite').forEach(el=>{el.style.setProperty('--sprite-x',(emotion%3)*50+'%');el.style.setProperty('--sprite-y',Math.floor(emotion/3)*100+'%');});
}
function renderTrade(){
 const inst=data.instruments[selected],p=quote(selected).r?.[4]||0;if(quantityMode==='all')$('quantity').value=side==='buy'?market.affordable(state.cash,p||1):(state.holdings[selected]?.qty||0);const qty=Number($('quantity').value),valid=Number.isSafeInteger(qty)&&qty>0;
 $('allQty').textContent=side==='buy'?'全部買進':'全部賣出';$('allQty').setAttribute('aria-pressed',quantityMode==='all');$('halfQty').textContent=side==='buy'?'1/2 資金':'1/2 持股';
 $('allQty').disabled=!inst.tradable||(side==='buy'?market.affordable(state.cash,p||1)<1:!(state.holdings[selected]?.qty>0));
 const value=valid?qty*p:0,fees=valid?TaiguEngine.fee(value):0,tax=side==='sell'?Math.floor(value*(selected==='0050'?.001:.003)):0;
 $('tradeSymbol').textContent=selected;$('refPrice').textContent=p.toFixed(2)+' 元';$('estimatedCost').textContent=valid?dollars(value):'—';$('estimatedFees').textContent=valid?`${dollars(fees)} / ${dollars(tax)}`:'—';
 $('availableShares').textContent=side==='buy'?`可買估算 ${fmt(market.affordable(state.cash,p||1))} 股`:`可賣 ${fmt(state.holdings[selected]?.qty||0)} 股`;
 $('buySide').classList.toggle('selected',side==='buy');$('sellSide').classList.toggle('selected',side==='sell');$('buySide').setAttribute('aria-pressed',side==='buy');$('sellSide').setAttribute('aria-pressed',side==='sell');
 $('orderBtn').innerHTML=`送出${side==='buy'?'買進':'賣出'}委託 <span>↗</span>`;$('orderBtn').classList.toggle('sell',side==='sell');
 const blocked=!inst.tradable||state.status!=='playing'||!!state.activeEvent||busy||!!state.orders.find(o=>o.id===selected)||(state.day>=0&&!market.bar(selected,market.date(state)));
 $('orderBtn').disabled=blocked||!valid;$('quantity').disabled=!inst.tradable;
 $('tradeNote').textContent=!inst.tradable?'加權指數供觀察，不能直接下單。選擇 0050 或個股進行交易。':state.activeEvent?'先完成劇情選擇，再進行交易。':state.orders.some(o=>o.id===selected)?'本標的已有委託，可在「待成交」頁籤取消。':quantityMode==='all'?'全部委託：依次日開盤價與當時現金／持股成交；多筆依送單順序。':'次日開盤成交，現金不足則整筆取消。零股與整張採相同開盤價的簡化撮合。';
}
function renderPortfolio(){
 $('positionCount').textContent=Object.keys(state.holdings).length;$('orderCount').textContent=state.orders.length;
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',b.dataset.tab===tab);});
 const el=$('portfolioContent'),d=market.date(state);el.dataset.view=tab;
 if(tab==='holdings'){
  const entries=Object.entries(state.holdings);if(!entries.length){el.innerHTML='<div class="empty-state">你的故事，還沒有第一筆持股。<span>從市場觀察選擇標的，下好委託後推進到下一個交易日。</span></div>';return;}
  el.innerHTML='<div class="table-scroll"><table><thead><tr><th>持有標的</th><th>股數</th><th>含費均價</th><th>市值</th><th>未實現損益</th><th></th></tr></thead><tbody>'+entries.map(([id,h])=>{const p=market.latest(id,d)[4],v=p*h.qty,pnl=v-h.cost;return `<tr><td><strong>${esc(data.instruments[id].name)}</strong><small>${id}</small></td><td>${fmt(h.qty)}</td><td>${(h.cost/h.qty).toFixed(2)}</td><td>${dollars(v)}</td><td class="${tone(pnl)}">${pnl>=0?'+':''}${fmt(pnl)}<br><small>${pct(pnl/h.cost*100)}</small></td><td><button class="table-action" data-sell="${id}">賣出</button></td></tr>`;}).join('')+'</tbody></table></div>';
  el.querySelectorAll('[data-sell]').forEach(btn=>btn.onclick=()=>{side='sell';$('quantity').value=state.holdings[btn.dataset.sell].qty;selectSymbol(btn.dataset.sell);$('orderBtn').scrollIntoView({behavior:'smooth',block:'center'});});
 }else if(tab==='orders'){
  if(!state.orders.length){el.innerHTML='<div class="empty-state">目前沒有等待成交的委託。<span>收盤後下單，下一個交易日以開盤價撮合。</span></div>';return;}
  el.innerHTML='<div class="table-scroll"><table><thead><tr><th>標的</th><th>方向</th><th>股數</th><th>成交方式</th><th></th></tr></thead><tbody>'+state.orders.map(o=>`<tr><td><strong>${esc(data.instruments[o.id].name)}</strong><small>${o.id}</small></td><td class="${o.side==='buy'?'up':'down'}">${o.side==='buy'?'買進':'賣出'}</td><td>${o.sizeMode==='all'?'全部（約）':''}${fmt(o.qty)}</td><td>次日開盤價</td><td><button class="table-action" data-cancel="${o.id}">取消</button></td></tr>`).join('')+'</tbody></table></div>';
  el.querySelectorAll('[data-cancel]').forEach(btn=>btn.onclick=()=>{market.cancel(state,btn.dataset.cancel);changed();});
 }else if(tab==='journal'){
  el.innerHTML=state.log.length?'<div class="journal-list">'+state.log.slice().reverse().slice(0,200).map(l=>`<div class="journal-row"><time>${esc(l.date)}</time><span>${esc(l.text)}${l.type==='fill'?` · 費 ${l.fee} / 稅 ${l.tax}`:''}</span></div>`).join('')+'</div>':'<div class="empty-state">每一個決定，都會留在這裡。<span>交易、取消委託、股利與劇情選擇均會記錄。</span></div>';
  el.insertAdjacentHTML('afterbegin','<button id="inlineHighlights" class="inline-highlights">✦ 查看本輪高光與交易次數 ↗</button>');$('inlineHighlights').onclick=showCurrentHighlights;
 }else{
  const h=state.history,lo=Math.min(...h.flatMap(p=>[p.player,p.benchmark]))*.96,hi=Math.max(...h.flatMap(p=>[p.player,p.benchmark]))*1.04,span=hi-lo||1;
  const line=key=>h.map((p,i)=>`${i?'L':'M'}${(i/Math.max(1,h.length-1)*600+1).toFixed(2)} ${(130-(p[key]-lo)/span*120).toFixed(2)}`).join(' ');
  el.innerHTML=`<div class="performance"><div class="perf-key"><span>小韭</span><span>0050 股利再投入</span></div><svg viewBox="0 0 604 140" preserveAspectRatio="none" role="img" aria-label="總資產績效比較，${h.length} 個紀錄點"><path d="M0 130H604M0 70H604M0 10H604" stroke="#edf1e8" fill="none"/><path d="${line('benchmark')}" stroke="#8872b7" stroke-width="2" fill="none"/><path d="${line('player')}" stroke="#4e8a68" stroke-width="2" fill="none"/></svg><p>${esc(h[0].date)} — ${esc(d)} · 每日資產按收盤估值，包含應收股利。</p></div>`;
 }
}
async function advance(count){
 if(busy||state.status!=='playing')return;if(state.activeEvent){notify('先完成小韭的劇情選擇。');return;}busy=true;$('orderMessage').textContent='';render();let moved=0;
 try{for(let i=0;i<count;i++){if(!market.next(state))break;moved++;lastReply='';market.trigger(state,story.events);if(state.activeEvent||state.status!=='playing')break;if(i%5===4)await new Promise(r=>setTimeout(r,0));}chart.offset=0;beep('next');}
 catch(e){notify('無法推進：'+e.message);}finally{busy=false;save();render();if(count>1&&moved)notify(`已推進 ${moved} 個交易日${state.activeEvent?'，遇到新的劇情。':'。'}`);}
}
function showIntro(isReplay=false){replay=isReplay;introIndex=0;renderIntro();if(!$('introDialog').open)$('introDialog').showModal();syncMusic();}
function renderIntro(){const p=story.opening[introIndex];$('introDate').textContent=p.date;$('introTag').textContent=p.tag;$('introSpeaker').textContent=p.speaker;$('introText').textContent=p.text;$('introProgress').textContent=story.opening.map((_,i)=>i===introIndex?'●':'○').join(' ');$('introNext').textContent=introIndex===story.opening.length-1?'重新開盤 →':'繼續 →';document.querySelector('.intro-art').classList.toggle('truck-flash',introIndex===2);const emotion=[5,1,2,2,4][introIndex],el=document.querySelector('.intro-character');el.style.setProperty('--sprite-x',(emotion%3)*50+'%');el.style.setProperty('--sprite-y',Math.floor(emotion/3)*100+'%');}
function closeIntro(){if(!replay){state.opening=false;changed();}$('introDialog').close();}
function utility(title,html){previewMode=null;syncMusic();$('utilityTitle').textContent=title;$('utilityContent').innerHTML=html;if(!$('utilityDialog').open)$('utilityDialog').showModal();}
function download(name,text,type='application/json'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function exportSave(){download('台股戰士-'+market.date(state)+'.json',JSON.stringify(pack(),null,2));}
function syncMusic(){const ev=story.events.find(e=>e.id===state.activeEvent);music.setMode(previewMode||TaiguMusic.modeFor(screen,ev));}
function updateMusicUI(info){
 $('bgmName').textContent=info.title;
 $('bgmStatus').textContent=!info.enabled?'背景音樂已關閉':info.volume===0?'音量為零':info.hidden?'切換分頁，音樂已暫停':!info.unlocked||info.blocked?'點一下，讓音樂開始。':info.error?'音檔未能播放，請確認 audio 資料夾。':info.playing?info.mood+' · '+info.bpm+' BPM':'音樂準備中…';
 $('bgmToggle').textContent=info.enabled&&info.unlocked?'♫':'♪';$('bgmToggle').setAttribute('aria-pressed',info.enabled);$('bgmToggle').setAttribute('aria-label',!info.unlocked?'開啟背景音樂':info.enabled?'關閉背景音樂':'開啟背景音樂');
 $('bgmVolume').value=Math.round(info.volume*100);$('soundBtn').querySelector('span').textContent=info.enabled?'BGM 設定':'BGM 關';
 $('bgmName').parentElement.dataset.mode=info.mode;
 const mute=$('dialogMusicToggle');if(mute){mute.textContent=info.enabled?'關閉背景音樂':'開啟背景音樂';mute.setAttribute('aria-pressed',info.enabled);}
 if($('dialogMusicVolume'))$('dialogMusicVolume').value=Math.round(info.volume*100);
 document.querySelectorAll('[data-audition]').forEach(b=>b.classList.toggle('selected',b.dataset.audition===info.mode));
}
function showMusic(){
 utility('BGM 試聽與設定',`<p>四首原創循環配樂會依選單、日常和事件切換。切換時淡入淡出，離開分頁自動暫停，音量與靜音設定會保留。</p><div class="audio-dialog-controls"><button id="dialogMusicToggle" class="secondary"></button><label for="dialogMusicVolume">音量 <input id="dialogMusicVolume" type="range" min="0" max="100" step="1" value="35"></label></div><div class="music-auditions">${Object.entries(TaiguMusic.TRACKS).map(([id,t])=>`<button data-audition="${id}"><span>♫ ${esc(t.mood)}<small>${t.bpm} BPM</small></span><strong>${esc(t.title)}</strong><small>點此試聽 ↗</small></button>`).join('')}</div><p class="muted-note">試聽只切換音樂，不會改變日期、劇情或行情。關閉視窗後回到目前場景配樂。</p>`);
 $('dialogMusicToggle').onclick=()=>music.setEnabled(!music.enabled);$('dialogMusicVolume').oninput=()=>music.setVolume(Number($('dialogMusicVolume').value)/100);
 document.querySelectorAll('[data-audition]').forEach(b=>b.onclick=()=>{previewMode=b.dataset.audition;music.setEnabled(true);music.unlock();syncMusic();});updateMusicUI(music.info());
}
function hasProgress(s=state){return !s.opening||s.day>=0||s.log.length>0;}
function rememberRun(reason){
 if(!hasProgress())return;identify(state);const r=TaiguRecords.snapshot(market,state,reason);const signature=JSON.stringify([r.id,r.date,r.status,r.reason,r.equity,r.trades,r.spent]);if(signature===recordSignature)return;
 book=TaiguRecords.upsert(book,r);if(writeStorage(KEY+'.records',book))recordSignature=signature;
}
function renderTitle(){
 const recent=hasProgress()?TaiguRecords.snapshot(market,state):book.runs.at(-1),best=TaiguRecords.best(book);
 $('menuContinue').disabled=!hasProgress();$('menuContinue').innerHTML=(state.status==='playing'?'繼續上次旅程':'查看上次結局')+' <span>↗</span>';
 $('lastRunValue').textContent=recent?dollars(recent.equity):'還沒有冒險紀錄';$('lastRunNote').textContent=recent?`${recent.date.replaceAll('-','.')} · 超額 ${(recent.alpha>=0?'+':'')+recent.alpha.toFixed(2)} 百分點`:'每一次決定，都會被留下。';
 $('bestRunValue').textContent=best?(best.alpha>=0?'+':'')+best.alpha.toFixed(2)+' 百分點':'等你寫下第一個結局';$('bestRunNote').textContent=best?`${best.status==='won'?'成功超越 0050':'已完成一輪'} · 總資產 ${dollars(best.equity)}`:'依完整一輪的超額報酬比較。';
}
function highlightsHTML(r){
 const amount=n=>'$'+n.toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
 const signed=n=>(n>=0?'+':'−')+amount(Math.abs(n));
 const ready=r.statsVersion===1&&r.statsComplete;
 const card=(trade,title,empty)=>`<article class="highlight-card"><span>${title}</span>${trade?`<strong class="${tone(trade.pnl)}">${signed(trade.pnl)}</strong><b>${esc(data.instruments[trade.id]?.name||trade.id)} <small>${esc(trade.id)}</small></b><p>${esc(trade.date)} · 賣出 ${fmt(trade.qty)} 股<br>成交 ${trade.price.toFixed(2)} 元 · 淨報酬 ${pct(trade.returnPct)}</p><small>分攤成本 ${amount(trade.costBasis)}<br>賣出實收 ${amount(trade.proceeds)}</small>`:`<strong class="highlight-empty">${ready?empty:'尚無可重建明細'}</strong><p>${ready?'完成賣出後自動記錄。':'舊版摘要未保留明細；若仍有該輪存檔，讀取後可重新計算。'}</p>`}</article>`;
 return `<section class="highlights"><h3>✦ 操作高光</h3><div class="highlight-counts"><div><span>交易次數</span><b>${r.trades} 筆</b></div><div><span>買進 / 賣出</span><b>${r.statsVersion===1?`${r.buyTrades} / ${r.sellTrades}`:'—'}</b></div><div><span>已實現淨損益</span><b class="${ready?tone(r.realizedPnl):''}">${ready?signed(r.realizedPnl):'—'}</b></div></div><div class="highlight-grid">${card(ready?r.maxGain:null,'最大獲利・依金額','尚無獲利賣出')}${card(ready?r.maxLoss:null,'最大虧損・依金額','尚無虧損賣出')}</div><p class="highlight-rules">以每筆賣出成交為一筆高光，成本採移動加權平均，扣除買賣手續費與賣出稅；不含股利及未賣出的帳面損益。買一次、賣一次算 2 筆交易，取消與未成交不計。</p></section>`;
}
function showCurrentHighlights(){const r=TaiguRecords.snapshot(market,state);utility('本輪操作高光',`<span class="story-badge">${esc(r.date)} · 本機紀錄</span>${highlightsHTML(r)}`);}
function showLeaderboard(metric='alpha'){
 const rows=TaiguRecords.leaderboard(book,metric,{ruleset:'tw-v1',datasetEnd:data.end});
 const title=metric==='alpha'?'超額報酬':metric==='gain'?'單筆最大獲利':'單筆最大虧損・趣味榜';
 const score=r=>metric==='alpha'?pct(r.alpha).replace('%',' 百分點'):(metric==='gain'?'+$':'−$')+Math.abs(r[metric==='gain'?'maxGain':'maxLoss'].pnl).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
 utility('排行榜・本機預覽',`<p class="board-notice">目前只顯示這個瀏覽器的完整結算輪次，尚未連線到跨玩家排行榜。</p><div class="board-tabs" role="group" aria-label="排行榜類型"><button data-board="alpha" class="${metric==='alpha'?'selected':''}">超額報酬榜</button><button data-board="gain" class="${metric==='gain'?'selected':''}">最大獲利榜</button><button data-board="loss" class="${metric==='loss'?'selected':''}">翻車紀錄榜</button></div><div class="board-table-wrap"><table class="board-table"><thead><tr><th>名次</th><th>本機輪次</th><th>${title}</th><th>總資產</th><th>最大回撤</th><th>交易次數</th></tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.id.slice(0,8))}<small>${esc(r.date)}</small></td><td>${score(r)}</td><td>${dollars(r.equity)}</td><td>${r.maxDrawdown.toFixed(2)}%</td><td>${r.trades}</td></tr>`).join(''):'<tr><td colspan="6" class="board-empty">還沒有符合本版規則的完整結算紀錄。<br>完成一輪後，這裡會出現真實成績。</td></tr>'}</tbody></table></div><h3>線上榜預定顯示</h3><p>名次、玩家暱稱、超額報酬、最終資產、最大回撤、交易次數；點開可看最大獲利與最大虧損交易。</p><p class="muted-note">主榜依超額報酬排序；同分比較較小回撤、較少成交，最後依提交時間。同規則與資料版本分榜，僅列完整結算輪次。虧損榜是趣味紀錄，不影響主榜。</p><p class="muted-note">平台與玩家登入方式確認後再接上雲端。現在不會上傳存檔或建立線上帳號。</p>`);
 document.querySelectorAll('[data-board]').forEach(b=>b.onclick=()=>showLeaderboard(b.dataset.board));
}
function showRunStats(kind){
 const isBest=kind==='best',r=isBest?TaiguRecords.best(book):(hasProgress()?TaiguRecords.snapshot(market,state):book.runs.at(-1));
 if(!r){utility(isBest?'最佳遊玩數據':'上次遊玩數據',`<div class="record-empty"><span>${isBest?'♧':'🌱'}</span><h3>${isBest?'第一個結局，還在等你。':'你的第一輪冒險，還沒開始。'}</h3><p>${isBest?'完整一輪結算後，這裡會依超額報酬留下最佳成績；進行中或重開的紀錄不列入。':'開始遊戲後，這裡會顯示最近一輪的真實遊玩數據。'}</p></div>`);return;}
 const labels={playing:r.reason==='restarted'?'中途重新開始':'冒險進行中',won:'成功超越 0050',lost:'未能超越 0050',bankrupt:'資產耗盡', 'awaiting-data':'等待資料補齊'};
 utility(isBest?'最佳遊玩數據':'上次遊玩數據',`<span class="story-badge">${esc(labels[r.status])}</span><h3>${esc(r.date)} · 第 ${r.sessions} 個交易日</h3><div class="result-card"><div><span>小韭總資產</span><b>${dollars(r.equity)}</b></div><div><span>0050 平行人生</span><b>${dollars(r.benchmark)}</b></div></div><p class="result-number">${(r.alpha>=0?'+':'')+r.alpha.toFixed(2)} <small>百分點</small></p><div class="record-details"><div><span>總報酬</span><b>${pct(r.returnPct)}</b></div><div><span>最大回撤</span><b>${r.maxDrawdown.toFixed(2)}%</b></div><div><span>交易次數（成交）</span><b>${r.trades} 筆</b></div><div><span>劇情選擇</span><b>${r.choices} 次</b></div><div><span>累積手續費</span><b>${dollars(r.fees)}</b></div><div><span>累積交易稅</span><b>${dollars(r.tax)}</b></div><div><span>劇情支出</span><b>${dollars(r.spent)}</b></div><div><span>剩餘現金</span><b>${dollars(r.cash)}</b></div></div>${highlightsHTML(r)}<p class="muted-note">最佳紀錄依已結算輪次的超額報酬排序，打平時比較總資產。紀錄僅保存在本機。</p>`);
}
function enterGame(){screen='game';$('titleScreen').hidden=true;$('gameShell').hidden=false;document.body.classList.remove('at-title');resultShown=false;render(true);if(state.opening)showIntro();}
function showTitle(){if(busy)return;save();screen='title';previewMode=null;for(const d of document.querySelectorAll('dialog[open]'))d.close();$('gameShell').hidden=true;$('titleScreen').hidden=false;document.body.classList.add('at-title');renderTitle();syncMusic();window.scrollTo(0,0);}
function restartGame(){
 if(hasProgress())rememberRun(state.status==='playing'?'restarted':'completed');
 state=identify(market.fresh());lastReply='';recordSignature='';resultShown=false;selected='0050';side='buy';quantityMode='fixed';chart.offset=0;$('utilityDialog').close();save();enterGame();
}
function startFromMenu(){
 if(!hasProgress()){restartGame();return;}
 utility('重新開始一輪冒險？','<p>目前進度會整理成上次遊玩數據，再從一百萬元重新開始。要保留可讀取的進度，可先存到手動欄位或匯出 JSON。</p><div class="dialog-actions"><button class="primary" id="startFresh">開始新的轉生</button><button class="secondary" id="keepPlaying">繼續原本的旅程</button></div>');
 $('startFresh').onclick=restartGame;$('keepPlaying').onclick=()=>{$('utilityDialog').close();enterGame();};
}
function resumeState(loaded){quantityMode='fixed';state=loaded;lastReply='';resultShown=false;storageFailed=false;$('utilityDialog').close();market.trigger(state,story.events);save();enterGame();}
function showSaves(){
 let html='<p>遊戲會自動儲存在這個瀏覽器。手動存檔有三個欄位，也可以匯出 JSON，換裝置後再匯入。</p><p class="muted-note">無痕模式、清除網站資料、變更網域或瀏覽器，都可能讓本機存檔無法保留。建議定期匯出。</p><div class="dialog-actions"><button class="primary" id="exportSave">匯出完整存檔</button><button class="secondary" id="importSave">匯入存檔</button><button class="secondary" id="exportLog">匯出操作紀錄 CSV</button></div>';
 for(let i=1;i<=3;i++){let p;try{p=JSON.parse(localStorage.getItem(KEY+'.slot'+i)||'null');}catch{}html+=`<div class="save-slot"><strong>存檔 ${i}${p?' · '+esc(market.date(p.state)):''}</strong><small>${p?'儲存於 '+esc(new Date(p.savedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})):'尚未使用'}</small><div class="dialog-actions"><button class="secondary" data-store="${i}">儲存到此欄</button><button class="secondary" data-load="${i}" ${p?'':'disabled'}>讀取</button></div></div>`;}
 html+='<div class="restart-box"><h3>重新開始</h3><p>開始新的一輪會覆寫自動存檔，手動存檔仍保留。</p><button class="secondary danger" id="restartBtn">重新轉生</button><div id="restartConfirm"></div></div>';
 utility('存檔管理',html);$('exportSave').onclick=exportSave;$('importSave').onclick=()=>$('importInput').click();$('exportLog').onclick=()=>{
  const cell=x=>{let s=String(x??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const fields=['date','type','text','id','side','qty','price','value','fee','tax','costBasis','realizedPnl','sizeMode'];download('台股戰士-操作紀錄.csv','\ufeff'+[fields,...state.log.map(l=>fields.map(f=>l[f]))].map(row=>row.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
 };
 document.querySelectorAll('[data-store]').forEach(b=>b.onclick=()=>{if(writeStorage(KEY+'.slot'+b.dataset.store,pack())){notify('已儲存到欄位 '+b.dataset.store);showSaves();}});
 document.querySelectorAll('[data-load]').forEach(b=>b.onclick=()=>{try{const p=JSON.parse(localStorage.getItem(KEY+'.slot'+b.dataset.load));resumeState(validateState(p.state));notify('已讀取存檔。');}catch(e){notify('讀取失敗：'+e.message);}});
 $('restartBtn').onclick=()=>{$('restartConfirm').innerHTML='<div class="restart-confirm"><p>確定從一百萬元重新開始？</p><button class="primary" id="confirmRestart">確定，重新轉生</button></div>';$('confirmRestart').onclick=restartGame;};
}
function showHelp(){utility('玩法與勝負條件',`<h3>你的任務</h3><p>小韭在 2020 年 1 月帶著一百萬元重新開始。到 2026 年 10 月 16 日，總資產必須<strong>嚴格高於</strong>0050 股利再投入的平行人生。相同或落後，皆為失敗。</p><h3>每天怎麼玩</h3><ol><li>閱讀劇情選項，觀察大盤、0050 與個股。</li><li>輸入股數，送出買進或賣出委託。同一標的一次一筆，成交前可取消。</li><li>推進交易日，委託以次日開盤價撮合，再查看當日收盤資料。</li></ol><h3>全部委託與高光</h3><p>「全部買進」按下一交易日開盤價，以當時現金買入可負擔的最大整數股數；「全部賣出」出售當時全部持股，含已生效的分割換發。多筆委託依提交順序使用剩餘現金。選單「本輪高光」或紀錄頁可查看最大獲利、最大虧損及成交次數。</p><h3>看盤方式</h3><p>K 棒採台股紅漲綠跌，提供 MA5、MA20、MA60、成交股數及法人買賣超。拖曳回看，滾輪縮放。「回到今日」恢復最新位置。法人資料依你的遊戲設定，延後一個交易日顯示。</p><h3>勝負與生活費</h3><p>初始本金固定一百萬元，暫不加入後續薪資或自動生活扣款。劇情支出扣除現金並列入績效。持股也是資產；用現金買進股票，不會因此被判定破產。只有總資產耗盡才立即失敗。</p><h3>交易模擬的範圍</h3><p>現股、整數股數、無槓桿。手續費採遊戲固定費率 0.1425%，每筆至少 20 元。賣出 ETF 稅率 0.1%，一般股票 0.3%。零股統一使用開盤價；交割即時完成，未模擬 T+2、撮合佇列、流動性限制、所得稅與補充保費。</p><p>原型劇情只是可替換的示範，不代表投資建議；歷史行情不會被情緒或選項改寫。</p>`);}
function showData(){utility('資料來源與計算規則',`<h3>已收錄的真實資料</h3><p>${data.start} 至 ${data.end}，共 ${data.calendar.length.toLocaleString()} 個交易日。另含 2019 年 10 月起的暖機資料，供開局均線計算使用。</p><p>大盤與四檔標的的每日開高低收、成交股數、成交金額，三大法人、現金股利，來自 <a href="https://finmind.github.io/" target="_blank" rel="noopener">FinMind</a>。完整查詢網址、資料筆數與下載時間列在 <a href="data/provenance.json" target="_blank" rel="noopener">provenance.json</a>。</p><h3>公平的時間線</h3><p>開局為 2020 元旦休市，只能看到 2019/12/31 以前的行情；第一筆委託於 2020/01/02 開盤撮合。後續只顯示遊戲日期以前的價格，法人只顯示上一交易日以前的資料。股利與分割於歷史生效日處理，不會提前反映在資產。</p><h3>0050 基準</h3><p>同樣一百萬元，第一日開盤以可負擔的最大整數股數買進 0050，支付相同手續費。除息日建立應收股利，實際發放後於第一個有報價的開盤再投入。剩餘現金與應收股利計入資產。兩者都按收盤市值比較，未持有部位才產生賣出稅費；不假設期末強制清倉。</p><h3>分割與暫停交易</h3><p>0050 在 2025/06/11—06/17 暫停交易，該期間無 K 棒，不虛構成交；持股沿用最近收盤估值。2025/06/18 持股數乘四、總成本不變。圖表預設原始報價，可選只依當時已知分割還原。參見<a href="https://www.twse.com.tw/zh/ETFortune/announcement?company=A00005&date=20250617&fund=0050&seq=1&type=other" target="_blank" rel="noopener">證交所分割公告</a>。</p><h3>單位與缺值</h3><p>成交量是股；個股法人是買賣超股數，大盤法人是買賣超金額（元）。缺少法人資料的日期留白；不會以零或模擬數據代替。</p><h3>資料與本機儲存</h3><p>遊玩時不連接行情服務。所有歷史資料均隨網頁提供，進度存在瀏覽器 localStorage。目前只有本機排行預覽，尚未串接跨玩家排行榜或服務端驗證。更新資料需在本機執行下載工具，再重新上傳靜態檔案。</p><p class="muted-note">資料供應商可能更正歷史紀錄。公開再散布前需確認供應商與原始來源的授權範圍；原始素材圖的生成提示詞與檔案資訊收錄於 docs/ASSETS.md。</p>`);}
function showResult(){const d=market.date(state),e=market.equity(state,d),b=market.equity(state.benchmark,d),alpha=(e-b)/1e6*100;const title=state.status==='won'?'這次，你超越了平行人生。':state.status==='bankrupt'?'本金耗盡，這輪先下市。':state.status==='awaiting-data'?'資料暫時到這裡。':'你活到了最後，卻沒能贏過 0050。';utility(state.status==='won'?'結局解鎖・台股戰士':state.status==='awaiting-data'?'等待資料補齊':'結局・再練一輪',`<h3>${title}</h3><p>${state.status==='awaiting-data'?'尚未抵達目標日期，不判定勝負。':state.status==='won'?'小韭放下手機，這一次，過馬路前記得抬頭。':'賺錢與打敗市場，是兩個不同的考題。你的每筆決定都還留在紀錄裡。'}</p><div class="result-card"><div><span>小韭總資產</span><b>${dollars(e)}</b></div><div><span>0050 平行人生</span><b>${dollars(b)}</b></div></div><p class="result-number">${(alpha>=0?'+':'')+alpha.toFixed(2)} <small>百分點</small></p><p>${esc(d)} 結算 · 總共 ${state.log.filter(l=>l.type==='fill').length} 筆成交 · 劇情支出 ${dollars(state.spent)}</p>${highlightsHTML(TaiguRecords.snapshot(market,state))}<div class="dialog-actions"><button class="primary" id="resultExport">匯出這一輪存檔</button><button class="secondary" id="resultSaves">存檔與重新開始</button></div>`);$('resultExport').onclick=exportSave;$('resultSaves').onclick=showSaves;}
// Bind interface events once; all mutations go through the game engine.
 $('nextBtn').onclick=()=>advance(1);$('weekBtn').onclick=()=>advance(5);$('monthBtn').onclick=()=>advance(20);
 $('quantity').oninput=()=>{quantityMode='fixed';renderTrade();};$('buySide').onclick=()=>{side='buy';quantityMode='fixed';renderTrade();};$('sellSide').onclick=()=>{side='sell';quantityMode='fixed';renderTrade();};
 document.querySelectorAll('[data-qty]').forEach(b=>b.onclick=()=>{quantityMode='fixed';$('quantity').value=b.dataset.qty;renderTrade();});
 $('allQty').onclick=()=>{quantityMode='all';renderTrade();};
 $('halfQty').onclick=()=>{quantityMode='fixed';const p=quote(selected).r?.[4]||1;$('quantity').value=side==='buy'?Math.max(1,market.affordable(state.cash/2,p)):Math.max(1,Math.floor((state.holdings[selected]?.qty||0)/2));renderTrade();};
 $('orderBtn').onclick=()=>{try{market.queue(state,selected,side,Number($('quantity').value),quantityMode);beep('trade');tab='orders';$('orderMessage').textContent='委託已送出，下一交易日開盤撮合。';changed();notify('委託已送出。推進時間後查看成交結果。');}catch(e){$('orderMessage').textContent=e.message;}};
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderPortfolio();});
 document.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{chart.setRange(Number(b.dataset.range));document.querySelectorAll('[data-range]').forEach(n=>n.classList.toggle('selected',n===b));});
 $('maToggle').onchange=()=>{chart.ma=$('maToggle').checked;chart.draw();};$('adjustToggle').onchange=()=>{chart.adjust=$('adjustToggle').checked;render();};$('chartReset').onclick=()=>{chart.offset=0;chart.hover=null;chart.draw();};
 $('highlightsBtn').onclick=showCurrentHighlights;$('rankingsBtn').onclick=()=>showLeaderboard();$('menuRankings').onclick=()=>showLeaderboard();
 $('saveBtn').onclick=showSaves;$('helpBtn').onclick=showHelp;$('dataBtn').onclick=showData;$('closeUtility').onclick=()=>$('utilityDialog').close();
 document.querySelector('#gameMenu nav').addEventListener('click',e=>{if(e.target.closest('button'))$('gameMenu').open=false;});
 document.addEventListener('click',e=>{if(!e.target.closest('#gameMenu'))$('gameMenu').open=false;});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')$('gameMenu').open=false;});
 $('soundBtn').onclick=showMusic;$('bgmSettings').onclick=showMusic;$('menuStart').onclick=startFromMenu;$('menuContinue').onclick=enterGame;$('menuSaves').onclick=showSaves;$('menuLast').onclick=()=>showRunStats('last');$('menuBest').onclick=()=>showRunStats('best');$('menuHelp').onclick=showHelp;$('homeBtn').onclick=showTitle;
 $('bgmToggle').onclick=()=>{if(!music.unlocked){music.setEnabled(true);music.unlock();}else music.setEnabled(!music.enabled);};
 $('bgmVolume').oninput=()=>music.setVolume(Number($('bgmVolume').value)/100);
 function unlockAudio(e){if(e.target.closest?.('#bgmToggle'))return;if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;if(!music.unlocked||music.blocked)music.unlock();}
 document.addEventListener('click',unlockAudio,{capture:true});document.addEventListener('keydown',unlockAudio,{capture:true});
 $('utilityDialog').addEventListener('close',()=>{previewMode=null;syncMusic();});
 $('replayBtn').onclick=()=>showIntro(true);$('introNext').onclick=()=>{beep();if(introIndex<story.opening.length-1){introIndex++;renderIntro();}else closeIntro();};$('skipIntro').onclick=closeIntro;
 $('introDialog').addEventListener('cancel',e=>{e.preventDefault();closeIntro();});
 $('importInput').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>8*1024*1024)throw Error('檔案超過 8 MB');const p=JSON.parse(await f.text());if(p.format!=='taigu-warrior-save')throw Error('不是台股戰士存檔');resumeState(validateState(p.state));notify('已匯入存檔。');}catch(err){notify('匯入失敗：'+err.message);}};
 window.addEventListener('pagehide',()=>{save();music.setHidden(true);});window.addEventListener('pageshow',()=>music.setHidden(document.hidden));document.addEventListener('visibilitychange',()=>{if(document.hidden)save();music.setHidden(document.hidden);});
 load();identify(state);try{book=TaiguRecords.normalize(JSON.parse(localStorage.getItem(KEY+'.records')||'null'));}catch{}
 market.trigger(state,story.events);render(true);showTitle();updateMusicUI(music.info());
})();
