> 本專案使用 AI 輔助開發，包含程式、劇情及美術素材。
>
> 遊戲網址：[台股戰士｜立即遊玩](https://00160530.github.io/StockFighterAJO/)

# 行情心情與手指支撐線（0.8）

## 逐日播放時的內心劇場

只在人生模式逐日播放或暫停播放時顯示；正式新聞、劇情選項優先。選到有持股的股票就比較該股，否則比較最近買進且仍持有的標的。

以目前持倉週期內「最近一筆買進成交價」比較當日收盤，超過 +5% 用得意表情說「台股，簡單！」，低於 −5% 用緊張表情說「獲利去哪裡了？」；等於 ±5% 仍為觀望。這不是整個帳戶的投資報酬率，未計股利、費用與稅；畫面同時註明比較標的與買進價。

全部空手時，選中股票連兩個交易日下跌且合計至少 −2%，換成認真表情說「現在買入一定爆賺」。若選中加權指數，改觀察 0050。以上都是小韭的自信吐槽，不是買入訊號。

計算僅使用當日前行情；已生效的分割會同步還原先前買進價與 K 棒，避免 0050 的 1 拆 4 製造假跌幅。

## 手指支撐線！（0.8.2）

人生模式將這段互動改成有選擇的賣壓小劇場。符合條件時先凍結日期，顯示小韭緊張的表情、行情回想、已公布法人資料與當日跌幅，說出「開盤後股價一直往下跌……沒辦法，只好使出那招了！」；選擇使用才啟動動畫。

觸發需同時符合：

- 前一交易日已公布的三大法人（外資＋投信＋自營商）合計賣超至少 100 億元。
- 當日加權指數較前收跌至少 2%。
- 下跌前已持有的股票，當日收盤低於前收，也低於當日開盤。0050 與個股使用相同規則，不再要求持股連跌兩日或跌滿 8%。
- 尚在遊玩，且距上次賣壓事件至少 30 個交易日。多檔持股優先目前選中的符合標的；全部共用冷卻，選擇不出招也會進入冷卻，避免反覆詢問。

前一日指「上一個交易日」，不是週末或假日。法人只讀 market.chipCutoff 當日資料，三項缺任一項即不觸發，不拿當日尚未公開或更早的資料補上。行情和持股價格只讀至當日；已生效分割同步還原，停牌與復牌資料斷層不當成單日跌幅。

兩個選擇：

- 「使用手指支撐線」：留下出招選擇，再進入秘技切入條與鏡頭拉近（1.2 秒）；食指橫向從右方伸入，當日 K 棒往下落到食指上方，出現「咚！」、接觸震動與音效。6 秒的下跌／連點階段中，先接觸再依支撐力暫時抬高，小韭短暫得意；最後支撐線裂成碎片、手指失守、K 棒加速下墜，再回到真實收盤（約 1.4 秒）。完成後按繼續接續同日事件或行情。
- 「讓它跌吧」：留下不出招選擇，沒有動畫，也不自動代玩家下單；接續同日事件或行情。選擇視窗按 Escape 也按不出招處理。

情節以「當日盤勢回想」呈現。資料只有每日 OHLC，不能還原真實盤中逐筆路徑；角色台詞與 K 棒動畫都是趣味演出。選擇及連點不改變行情、現金、股數、委託、0050 基準或交易窗口，不影響排行榜評分。正式新聞事件若在同日發生，完成這段選擇後仍會顯示原本新聞與選項。

演出中可略過；Escape 先略過演出，結束後再按可關閉。音樂與音效共用靜音、音量；背景分頁不播放，動畫時間也暫停。系統設定減少動畫時使用固定放大鏡頭，取消震動與入場縮放。

本機 supportGames 紀錄增加可選的 choice（pending／use／decline）。事件出現前先儲存 pending；未選擇就重新整理，按繼續會回到選項，不能直接前進日期。選「使用」後在動畫中重新整理則不重播已選演出。舊紀錄沒有 choice 仍可載入。不出招紀錄 finished=true、taps=0；已選擇的事件不能再次改選。

以內建 2020/01/02—2026/10/16 資料、首次開盤買進後持有 0050 到結束、計入 30 日冷卻試算，有 17 次事件機會；第一次為 2020/03/09：3/6 已公布法人賣超 322.69 億、當日大盤 −3.04%、0050 −2.83%。實際機會依持倉、選中標的與共用冷卻而變。

## 首頁角色台詞

滑鼠每次移入角色時抽取一句並換表情；五句洗牌後完整出現一次才重新洗牌，跨輪也避免接連重複。移出恢復原本表情，台詞保留。鍵盤聚焦及 Enter/空白鍵、手機觸碰角色亦可觸發。手機台詞顯示於底部約 4.5 秒，不遮住模式按鈕。

- 股票就是買低賣高，台股，簡單！
- 一張不賣，奇蹟自來
- 別人恐懼我貪婪，別人小虧我破產
- 本多終勝
- 這次不一樣

## 原創認真表情

內建 imagegen 工具生成 assets/xiaojiu-serious.webp，1536 × 1024、透明 RGBA。參考既有原創小韭的角色設計，新增扶眼鏡、拿筆記的認真表情；只轉成 WebP 格式，未用程式重繪或套色。0.8.3 手部改用 Q 版裸手 WebP，完整提示詞見 [HAND_ASSET.md](HAND_ASSET.md)；衝擊圈、聚光與 K 棒為 CSS/Canvas。

最終提示詞：

```text
Use case: stylized-concept. Asset type: single transparent chibi character cutout for an existing cute Taiwanese stock-market visual novel. Input reference is CHARACTER IDENTITY reference only, not an edit target or a collage. Create one original Xiao Jiu, exactly the same adult office worker design as reference: cute 2.3-head-tall proportions, oversized rounded head, tousled dark desaturated brown hair with tiny green onion hairclip, round thin dark glasses, large dark green eyes, white short-sleeve office shirt, muted sage tie, charcoal trousers, small brown shoes and beige crossbody bag. New expression: very SERIOUS and studious, eyebrows slightly furrowed with determined focused eyes, tiny closed straight mouth, one hand adjusting the edge of his glasses and the other holding a small plain notebook. This should read as cute intense concentration on stock research, not angry or glamorous. FULL BODY centered with generous margin on all sides, one character only. Simple bold clean anime chibi outlines, flat colors, only two-level cel shading, consistent with supplied sprite identity. Neutral white balance, very restrained sage accents. No yellow/orange tint, no blue wash, no green wash, no glow, no painterly background, no extra panels, no words or letters, no logo or watermark. Truly transparent background; retain alpha. Landscape canvas 3:2 with centered single character.
```


## 0.8.1 表情切換修正

首頁角色現在是可操作的按鈕，因此會套用通用按鈕的 background 過渡；該簡寫也包含 background-position，造成整張 sprite 在 150 ms 內滑動。以 #titleCharacter 的 transition:none 覆寫，表情及認真圖立即切換，移出同樣立即回復，保留原本輕微浮動動畫。
