(function(root){
'use strict';
const choices=()=>[{label:'先看圖，整理判斷 · 壓力 −3',stress:-3,reply:'消息是新的，我仍然得自己決定部位。'},{label:'先看群組怎麼說 · 壓力 +2',stress:2,openGroup:true,reply:'聊天室又熱鬧起來了。每個人說的都像有道理，但他們的成本不一定和我一樣。'}];
function create(market,legacy,news,group){
 const data=market.data,session=d=>data.calendar.find(x=>x>=d),events=legacy.events.map(e=>({...e,type:'main'}));
 for(const n of news.items){
  if(n.attach){const e=events.find(e=>e.id===n.attach);if(e)e.newsId=n.id;continue;}
  events.push({id:'news-'+n.id,date:session(n.date),exact:true,type:'news',newsId:n.id,music:n.music,chapter:'歷史新聞',speaker:'小韭',tag:'真實新聞 × 原創劇情',title:n.title,text:n.music==='panic'?'新的消息跳上手機。聊天室有人喊跑，有人說機會來了。我看了一眼自己的持股與現金，忽然發現：我們害怕的，可能根本不是同一件事。':n.music==='fomo'?'聊天室的獲利截圖又多起來了。我想起上一輪的自己，也想起自己根本記不得中間每一次回檔。這次，還是要用自己的錢做決定。':'新聞讓話題換了方向。有人算未來的機會，有人先問晚餐吃什麼。我把消息和自己的猜測分開，重新看看手上有什麼。',choices:choices()});
 }
 const newsDialogue={
 'fed-emergency':'群組忽然都在算利率。有人說救市了，有人反而問是不是出大事。我看著一百萬本金：同一則消息，怎麼能讓大家同時更興奮、也更害怕？',
 'vaccine-preview':'疫苗的消息讓聊天內容從口罩變回旅行。阿明開始查機票，我開始看自己追過的題材。世界可能在改變，我買進時寫的理由呢？',
 'level-three':'公司傳來分流上班的通知。群組有人先問股票，有人先問家裡的口罩夠不夠。我把報價畫面縮小，先回覆家人的訊息。',
 'shipping-volatility':'午休一打開群組，全都是船。有人說運價還很好，有人說自己已經不敢看帳戶。阿明問我有沒有上船，我一時不知道他是在邀請，還是在求救。',
 'ukraine-war':'新聞裡出現了戰爭，聊天室忽然沒人接昨天的玩笑。那些離生活很遠的地名，和手機上的價格擠在同一個畫面。我先把不確定的事寫下來。',
 'fed-75bp':'三碼兩個字，被群組重複貼了好多次。上一輪我總覺得利率離自己很遠。現在才發現，我想等的反彈，和大家擔心的未來，可能根本不是同一段時間。',
 'stabilization-fund':'群組換上「國家隊來了」的新貼圖。我有一瞬間很想鬆口氣，像終於有人來替我負責。但帳戶的名字還是我，明天的決定也還是得自己做。',
 'chatgpt-preview':'阿明傳來一個會聊天的網站，叫它幫忙寫請假理由。大家笑了半天，我卻想起上一輪不停看到的三個字。知道名字，距離理解一門生意，原來還有很遠。',
 'svb-weekend':'週末群組傳來銀行被接管的消息，接著又是保障存款的後續措施。我把兩則都看完，才發現自己剛剛只讀第一個標題，就已經在想要不要全部賣掉。',
 'etf-fever':'連平常不看盤的同事，都開始問月月配息。有人拿每月入帳算午餐費，有人算多久能不用上班。我也想過那張離職申請單，所以特別知道它有多吸引人。',
 'hualien-earthquake':'先確認家人平安，再看手機另一個通知。群組有人問工廠，有人問車能不能通行。我忽然覺得，帳戶裡的數字可以晚幾分鐘再看。',
 'boj-rate':'群組開始討論日圓與日本利率，我原本還以為那只跟出國便不便宜有關。線線畫了一張全球資金的圖，我先問：我們現在知道的，和正在猜的，分別是哪幾段？',
 'august-selloff':'今天的大盤收盤數字大得像打錯了一位。群組有人不說話，有人喊著再跌再買。我看了自己的部位，也看了那些沒貼出來的生活開銷。',
 'tariff-and-close':'連假讀過的消息，今天一起擠進報價畫面。有人早上就想跑，有人想接，收盤後大家的口氣又變了。我把今天真正做過的事和腦中的早知道分開。',
 'tariff-pause':'昨天群組還在比誰比較悲觀，今天又有人問現在追來不來得及。新的政策消息到了，但我的生活沒有重設。我想先確認，自己是不是只在追上一種情緒。',
 'split-exchanged':'小數點貼出換發後的股數，笑說想先開心三秒。大家明明知道資產不會因此變四倍，還是忍不住多看一眼。我也笑了，這次至少知道自己在看什麼。',
 'tsmc-capex':'手機裡是數百億美元的資本預算，桌上是我捨不得換的充電線。AI 的故事仍然很大，我卻得用自己的本金承受每一天。新的展望，足以支持我現在的部位嗎？'
 };
 for(const e of events)if(e.type==='news'&&newsDialogue[e.newsId])e.text=newsDialogue[e.newsId];
 for(let y=2020;y<=2026;y++)for(const half of [0,1]){
  if(y===2020&&half===0)continue;const d=session(`${y}-${half?'06-30':'01-01'}`);if(!d)continue;
  events.push({id:`life-${y}-${half}`,date:d,exact:true,type:'life',music:'walk',chapter:'小韭的日常',speaker:'小韭',tag:'人生事件・工作與投資',title:half?'半年過去了，我有更接近想要的生活嗎？':'新的一年，錢包還是得自己顧。',text:half?'日曆翻過一半。上班、吃飯、存錢、看盤，日子沒有因為重生就突然變容易。這段時間我做的決定，是自己的計畫，還是群組的氣氛？':'群組開始討論今年的新機會。我把上一段交易紀錄翻出來：有賺到的，也有想快一點反而繞遠路的。先看清楚，再走下一段。',choices:[{label:'看看持股與這段紀錄',stress:-2,reply:'人生沒有快轉鍵。但至少我可以不把每一天都拿來追同一個後悔。'},{label:'打開群組，聊聊近況',stress:0,openGroup:true,reply:'有時候需要的不是下一檔股票，是有人問我晚餐吃了沒。'}]});
 }
 events.push({id:'life-diver-return',date:session('2026-01-09'),exact:true,type:'life',music:'walk',chapter:'小韭的日常',speaker:'滷蛋',tag:'群友支線・生活還在',title:'潛水的人，回來聊午餐了。',text:'前幾天說想休息的群友又出現了。他沒有貼損益，只問大家最近好不好。原來群組除了下一檔股票，也可以有別的話題。',choices:[{label:'開群組，問他吃了沒',stress:-3,openGroup:true,reply:'今天先不問買了什麼。'},{label:'留個貼圖，晚點再聊',stress:-1,reply:'不用每次上線，都有一筆交易可以交代。'}]});
 const cache=new Map();
 function indicators(id,date){const key=id+date;if(cache.has(key))return cache.get(key);const rows=data.instruments[id].rows.filter(r=>r[0]<=date).map(r=>r.slice());for(const sp of data.instruments[id].splits||[])if(sp.date<=date)for(const r of rows)if(r[0]<sp.date)for(let j=1;j<=4;j++)r[j]/=sp.ratio;const close=rows.at(-1)?.[4]||0;const result={close,return5:rows.length>=6?close/rows.at(-6)[4]-1:null,return20:rows.length>=21?close/rows.at(-21)[4]-1:null};cache.set(key,result);return result;}
 for(let y=2020;y<=2026;y++)for(const type of ['panic','fomo'])events.push({id:`signal-${type}-${y}`,date:`${y}-01-20`,until:`${y}-12-31`,type:'signal',music:type,chapter:'市場與心情',speaker:'小韭',tag:'技術事件・只依已發生行情',title:type==='panic'?'跌的是價格，還是我的信心？':'大家都在賺，只有我還在等嗎？',text:type==='panic'?'大盤這幾天的跌幅讓群組越來越吵。有人改口長期投資，有人開始找停損理由。我先看自己的部位：再跌一段，我還能照原本的計畫生活嗎？':'大盤近一段時間持續上漲，群組的話題開始從股票變成離職。我的手停在委託頁面上：我想買，是因為想清楚了，還是怕又輪不到我？',when:s=>{const v=indicators('TAIEX',market.date(s));return type==='panic'?v.return5!==null&&v.return5<=-.06:v.return20!==null&&v.return20>=.10;},choices:choices()});
 // Finite annual signal IDs cap interruptions at two per year; news/story win same-day priority.
 events.sort((a,b)=>a.date.localeCompare(b.date)||(a.type==='signal'?1:0)-(b.type==='signal'?1:0));
 function textFor(e,s){if(e.id!=='ai-wave')return e.text;const owned=['2330','2317','2454'].some(id=>s.holdings[id]);return owned?'AI 的消息越來越熱，我也有持股。帳面變紅時，第一個想到的居然是離職申請單……等一下，我是不是又跳太遠了？先看看部位，這次不要把行情誤會成自己的能力。':'我明明記得 AI 很重要，可是記得三個字，跟真的敢花自己的錢，是兩件事。重生沒有送我完整的買賣時刻表。現在想追，是研究之後的決定，還是不甘心？';}
 function selectChat(s,e){
  const d=market.date(s),equity=market.equity(s,d),benchmark=market.equity(s.benchmark,d),held=Object.keys(s.holdings).length;
  const lastSell=s.log.filter(l=>l.type==='fill'&&l.side==='sell').at(-1);
  const saleDate=lastSell?data.calendar.indexOf(lastSell.date):-999;
  const ratio=lastSell?(data.instruments[lastSell.id].splits||[]).filter(sp=>sp.date>lastSell.date&&sp.date<=d).reduce((r,sp)=>r*sp.ratio,1):1;
  const flew=lastSell&&s.day-saleDate<=10&&s.day>saleDate&&(market.latest(lastSell.id,d)?.[4]||0)>lastSell.price/ratio*1.05;
  const recovered=held&&Object.entries(s.holdings).some(([id,h])=>{const current=h.qty*(market.latest(id,d)?.[4]||0);return h.cost&&current/h.cost>=.99&&current/h.cost<=1.04&&s.history.slice(-90).some(hh=>hh.player<equity*.85);});
  let id=e.id==='first-bell'?'chat-001':e.id==='life-2026-0'||e.id==='life-diver-return'?'chat-013':e.newsId==='tariff-and-close'?'chat-014':e.newsId==='tariff-pause'?'chat-015':e.newsId==='split-exchanged'?'chat-016':e.newsId==='shipping-volatility'?'chat-005':e.newsId==='etf-fever'?'chat-018':e.id==='desk-lunch'?'chat-011':e.id==='last-mile'?'chat-017':null;
  if(!id)id=flew?'chat-003':recovered?'chat-004':equity>1e6&&benchmark-equity>=50000?'chat-017':s.cash/equity<.10&&s.log.filter(l=>l.type==='fill'&&l.side==='buy').length>1?'chat-007':e.music==='panic'?'chat-006':e.id==='ai-wave'?'chat-008':null;
  if(id==='chat-017'&&!(equity>1e6&&benchmark-equity>=50000))id='chat-020';
  if(id==='chat-008'&&equity<=1e6)id='chat-020';
  if(!id&&held&&s.history.length>=6){const index=indicators('TAIEX',d).return5,own=equity/s.history.at(-6).player-1;if(index>0&&own<index-.02)id='chat-002';}
  if(!id){const seen=new Set((s.chats||[]).map(c=>c.id));id=['chat-009','chat-012','chat-010','chat-019','chat-020'].find(id=>!seen.has(id))||'chat-020';}
  return group.scenes.find(c=>c.id===id);
 }
 function ensureChat(s){s.chats??=[];const e=events.find(e=>e.id===s.activeEvent);if(!e||s.chats.some(c=>c.eventId===e.id))return;const c=selectChat(s,e);if(!c)return;let messages=c.messages.map(m=>({...m}));
  if(c.id==='chat-005')messages=messages.map(m=>m.speaker==='xiaojiu'?{...m,speaker:'achong'}:m);
  if(c.id==='chat-013')messages=e.id==='life-diver-return'?messages.slice(3):messages.slice(0,3);
  if(c.id==='chat-014'){messages[0].text='連假本來想少看手機，結果群組比上班還忙。今天復市收盤了，還是放不下。';messages[3].text='我們還沒決定晚餐，你們已經把下週走完了。';messages[5].text='今天收盤了，我先去吃飯。剩下的明天再想。';}
  if(c.id==='chat-006'){const rows=market.visibleRows(s,'TAIEX');if(rows.at(-1)?.[4]<rows.at(-2)?.[4]){messages[0].text='昨天還有人說只是洗盤，今天我不太敢講了。';messages[1].text='我也有點亂，現在先別急著猜明天。';}}
  s.chats.push({id:c.id,eventId:e.id,date:market.date(s),title:c.title,messages,replies:c.playerReplies.slice(),reply:null});
 }
 return {events,indicators,textFor,ensureChat,news,group};
}
function progression(raw,state){const p={version:1,freeUnlocked:raw?.version===1&&raw.freeUnlocked===true,unlockedBy:typeof raw?.unlockedBy==='string'?raw.unlockedBy:null,marginUnlocked:raw?.version===1&&raw.marginUnlocked===true,marginUnlockedBy:typeof raw?.marginUnlockedBy==='string'?raw.marginUnlockedBy:null,notifiedFree:raw?.notifiedFree===true,notifiedMargin:raw?.notifiedMargin===true,marginDebtAchievement:raw?.marginDebtAchievement===true,notifiedMarginDebt:raw?.notifiedMarginDebt===true};if(state?.mode==='life'&&['won','lost'].includes(state.status)&&state.life?.eligibleForUnlock!==false){p.marginUnlocked=true;p.marginUnlockedBy=p.marginUnlockedBy||state.runId||'life-completed';if(state.status==='won'){p.freeUnlocked=true;p.unlockedBy=state.runId||'life-completed';}}if(state?.status==='bankrupt'&&state.bankruptcyReason==='margin-debt'&&state.cash<0)p.marginDebtAchievement=true;return p;}
root.TaiguEvents={create,progression};
})(globalThis);
