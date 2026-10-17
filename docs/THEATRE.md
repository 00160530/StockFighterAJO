> 本專案使用 AI 輔助開發，包含程式、劇情及美術素材。
>
> 遊戲網址：[台股戰士｜立即遊玩](https://00160530.github.io/StockFighterAJO/)

# 行情心情與手指支撐線（0.8）

## 逐日播放時的內心劇場

只在人生模式逐日播放或暫停播放時顯示；正式新聞、劇情選項優先。選到有持股的股票就比較該股，否則比較最近買進且仍持有的標的。

以目前持倉週期內「最近一筆買進成交價」比較當日收盤，超過 +5% 用得意表情說「台股，簡單！」，低於 −5% 用緊張表情說「獲利去哪裡了？」；等於 ±5% 仍為觀望。這不是整個帳戶的投資報酬率，未計股利、費用與稅；畫面同時註明比較標的與買進價。

全部空手時，選中股票連兩個交易日下跌且合計至少 −2%，換成認真表情說「現在買入一定爆賺」。若選中加權指數，改觀察 0050。以上都是小韭的自信吐槽，不是買入訊號。

計算僅使用當日前行情；已生效的分割會同步還原先前買進價與 K 棒，避免 0050 的 1 拆 4 製造假跌幅。

## 手指支撐線！

觸發條件：人生模式、仍在遊玩、持倉至少跨過最近三個交易日，且持股連兩日各跌至少 2%、合計跌至少 8%、當日收黑。持有多檔時優先選中標的；全局冷卻 30 個交易日。停止交易造成的資料斷層不算連續下跌。

觸發後日期停在當天，使用原生 modal 隔離其他操作。放大當日 K 棒，背景壓暗，以聚光照亮 K 棒與原創 SVG 手指。鏡頭拉近約 1.2 秒、連點約 6 秒、支撐破裂與收盤復位約 1.4 秒。連點會提高暫時支撐力，有衝擊圈、字樣、輕微震動及短音效，最後仍跌破並回到真實收盤。點擊、空白鍵與 Enter 均可操作，按住鍵盤不會自動灌入連點。

演出始終只使用已揭露的當日 OHLC，沒有盤中逐筆資料；動畫是趣味表演，不宣稱為真實盤中走勢。不修改行情、現金、股數、委託、0050 基準、事件選擇或交易窗口，也不改排行規則。演出結束後按繼續，才回到當日事件或逐日播放。

可略過演出；Escape 先略過，結束後再按可關閉。音樂與音效共用靜音、音量；背景分頁不播放，動畫時間也暫停。系統設定減少動畫時使用固定放大的鏡頭，取消震動與入場縮放。

本機存檔增加可選的 supportGames：標的、日期、連點次數、是否結束。啟動前先儲存，以免重新整理重複觸發；結束後另寫入冒險紀錄。遊戲資料仍全部在前端，舊存檔不含此欄也可讀取。

## 首頁角色台詞

滑鼠每次移入角色時抽取一句並換表情；五句洗牌後完整出現一次才重新洗牌，跨輪也避免接連重複。移出恢復原本表情，台詞保留。鍵盤聚焦及 Enter/空白鍵、手機觸碰角色亦可觸發。手機台詞顯示於底部約 4.5 秒，不遮住模式按鈕。

- 股票就是買低賣高，台股，簡單！
- 一張不賣，奇蹟自來
- 別人恐懼我貪婪，別人小虧我破產
- 本多終勝
- 這次不一樣

## 原創認真表情

內建 imagegen 工具生成 assets/xiaojiu-serious.webp，1536 × 1024、透明 RGBA。參考既有原創小韭的角色設計，新增扶眼鏡、拿筆記的認真表情；只轉成 WebP 格式，未用程式重繪或套色。手指為 HTML 內原創 SVG，衝擊圈、聚光與 K 棒為 CSS/Canvas。

最終提示詞：

```text
Use case: stylized-concept. Asset type: single transparent chibi character cutout for an existing cute Taiwanese stock-market visual novel. Input reference is CHARACTER IDENTITY reference only, not an edit target or a collage. Create one original Xiao Jiu, exactly the same adult office worker design as reference: cute 2.3-head-tall proportions, oversized rounded head, tousled dark desaturated brown hair with tiny green onion hairclip, round thin dark glasses, large dark green eyes, white short-sleeve office shirt, muted sage tie, charcoal trousers, small brown shoes and beige crossbody bag. New expression: very SERIOUS and studious, eyebrows slightly furrowed with determined focused eyes, tiny closed straight mouth, one hand adjusting the edge of his glasses and the other holding a small plain notebook. This should read as cute intense concentration on stock research, not angry or glamorous. FULL BODY centered with generous margin on all sides, one character only. Simple bold clean anime chibi outlines, flat colors, only two-level cel shading, consistent with supplied sprite identity. Neutral white balance, very restrained sage accents. No yellow/orange tint, no blue wash, no green wash, no glow, no painterly background, no extra panels, no words or letters, no logo or watermark. Truly transparent background; retain alpha. Landscape canvas 3:2 with centered single character.
```


## 0.8.1 表情切換修正

首頁角色現在是可操作的按鈕，因此會套用通用按鈕的 background 過渡；該簡寫也包含 background-position，造成整張 sprite 在 150 ms 內滑動。以 #titleCharacter 的 transition:none 覆寫，表情及認真圖立即切換，移出同樣立即回復，保留原本輕微浮動動畫。
