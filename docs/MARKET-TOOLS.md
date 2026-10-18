# 行情副圖與股票擴充（0.16.0）

副圖下拉選單提供法人買賣超、成交量、KD／J、MACD、RSI、乖離率、威廉指標、多空指標乖離、CDP、DMI。切換副圖保留目前標的、縮放範圍和回看位置。十字線、提示框及副圖數值同步選取同一天。

主圖保留原有 K 線、5／20／60 日均線及事件註記。副圖共用同一時間軸。每日成交量可從副圖選單選擇，或在任一指標的提示框查看。副圖參數顯示在選單旁，矮視窗可將滑鼠停在選單查看；資料不足的暖機期顯示「—」。點「放大圖表」可用大視窗檢視，按 X 或 Esc 回到原位置，所選指標與縮放不變。

| 工具 | 計算規則 |
| --- | --- |
| KD／J | 9 日 RSV；K、D 由 50 起算，各採 1/3 平滑；J=3K−2D |
| MACD | EMA12−EMA26 為 DIF，DIF 的 EMA9 為訊號，柱狀為 2×(DIF−訊號)；EMA 由完整期間 SMA 起算 |
| RSI | 6／12 日，Wilder 平滑；無漲跌為 50 |
| 乖離率 | 收盤價相對 SMA6／12／24 的百分比 |
| 威廉指標 | %R14，範圍 −100～0 |
| 多空指標乖離 | BBI 為 SMA3／6／12／24 平均；顯示收盤相對 BBI 的百分比 |
| CDP | 只用前一交易日高、低、收計算 CDP／AH／NH／NL／AL |
| DMI | 14 日 Wilder 平滑的 +DI／−DI／ADX |

所有指標只用遊戲日期以前已出現的 K 棒。法人買賣超仍延後一個交易日，個股用股數、大盤用金額；缺資料不補成零，也不顯示隔日資料。

## 股票與歷史資料

新增聯電（2303）、長榮（2603）、華航（2610）、玉山金（2884）、康那香（9919）、華邦電（2344）、台達電（2308）。「聯電」重複項目去重；合計 11 檔可交易標的及加權指數。`tools/market-universe.mjs` 集中設定清單與排序。加權指數固定在清單頂端，桌面清單垂直捲動，手機維持橫向捲動。

行情、法人與現金股利來自既有 FinMind 資料來源；不更換原有 4 檔股票或交易日曆。停牌日不補造 K 棒、不撮合委託，估值沿用最近實際收盤價。長榮 2022/09/07～09/16、玉山金 2025/11/05 的停牌另有公告佐證。

`data/corporate-actions.json` 保存核對過的配股發放日及現金減資資訊。未知配股發放日或減資條件會讓資料工具停止，避免默默使用錯誤假設。

- 玉山金除權日建立應收股票，分攤成本並隨當時股價估值；公告發放日才成為可賣持股。現股與融資部位分開計算，未滿一股按面額折成現金，遊戲不提供人工併股。融資應收股票跟隨原貸款，原部位結清後不會歸入後來新借的融資。
- 長榮現金減資在 2022/09/19 換股，股數乘 0.4，每舊股退還 6 元，於 2022/09/29 入帳。現股與融資部位分開計算畸零股，依公告最後交易日收盤價折算；融資退還部分優先還款。

## 舊版相容與部署順序

`build-edition.mjs` 保留原本 datasetId／editionId 計算。只有舊版股票與日曆的 SHA256 完全不變，才把原版加入相容版本清單。舊存檔先核對舊範圍簽章再遷移，保留 runId、進度、現金、持股、績效歷史及線上 Session。

Worker 接受已驗證的舊版 Session，排行榜納入新舊相容版本並維持每個匿名身分每榜最佳一筆。未知版本及從新 Session 降回舊版本的提交會被拒絕。既有 D1 資料列保留，不需 Migration、重建資料庫、重設 Secret 或管理員密碼。

正式發布須先更新相容 Worker，再更新 Pages，避免新前端向舊 Worker 提交新行情版本。`data/online-config.js` 的 API 仍預設空白，正式 API 由原本部署設定注入。

## 參考來源

- [Yahoo 股市指標切換操作](https://tw.help.yahoo.com/kb/SLN35891.html)
- [FinMind 技術面資料](https://finmind.github.io/tutor/TaiwanMarket/Technical/)、[法人資料](https://finmind.github.io/tutor/TaiwanMarket/Chip/)
- [玉山金股利與配股資訊](https://www.esunfhc.com/en/investor-relations/shareholders/shareholder-Information)
- [長榮公司發布的換股與退還股款公告](https://www.marketscreener.com/quote/stock/EVERGREEN-MARINE-CORPORAT-6492351/news/Evergreen-Marine-Taiwan-The-record-date-of-capital-reduction-the-record-date-of-share-replacement-40877021/)
- [玉山金停牌公告（證交所）](https://wwwc.twse.com.tw/staticFiles/news/news/tsecnews/8a8216d69a3d6cf9019a4e78607c0048.pdf)
- [MACD](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/macd-moving-average-convergence-divergence-oscillator)、[RSI](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/relative-strength-index-rsi)、[DMI／ADX](https://chartschool.stockcharts.com/table-of-contents/technical-indicators-and-overlays/technical-indicators/average-directional-index-adx)
