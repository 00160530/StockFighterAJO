# 人生遙控器與日期跳躍（0.15.3）

人生遙控器花 1 點永久解鎖。日期跳躍最高 5 級，每級每輪增加 1 次；每次升級花 1 點，開新輪次才重置額度。兩種模式皆可使用，人生模式須先完成一輪。

## 日期與獎勵

開新遊戲一律從原本起點開始，不再詢問自訂日期。進入遊戲後在事件操作區的「使用技能」選擇日期跳躍，使用年、月、日三個下拉選單，只列出目前日期之後、資料範圍內的交易日；切換年月時自動調整無效日。跳躍保留資產、持股、原始起點及 0050 基準，取消未成交委託、略過沿途劇情，沿用原引擎逐日計算股利、分割、利息、借款與追繳。人生模式抵達時開啟三日操作期，當日事件仍可選擇。

人生遙控器則直接快轉至期末。兩種功能均在狀態副本完成計算，成功才更新存檔；破產會停在實際發生日，不保證抵達目標。

使用跳日期或提前結算的人生輪次，須實際完成至少 10 個事件選擇且有 1 筆成交，完成結算才按既有績效規則獲得技能點。未成交委託、沿途略過的事件不計入；每輪獎勵仍只領一次。成績正常列入原排行榜，沒有另設練習分類。

存檔、摘要、分享 JSON、CSV 記錄原起點、提前結算日期及最多五筆 `dateJumps: [{from,to}]`；技能使用摘要含可選的 `calendar` 次數。舊格式沒有新增欄位仍可讀取，舊版自訂起點紀錄也保持相容；本版不提供開局自訂起點入口。

## 繼續遊戲

首頁只有「新遊戲」「繼續遊戲」兩個主入口，點開後選人生／自由模式。兩模式自動存檔分別為 `taigu-warrior.v1.auto.life` 與 `taigu-warrior.v1.auto.free`；原 `.auto` 保留最後開啟輪次以相容舊版。

首次載入會從既有自動存檔、三個手動欄位及分模式自動存檔，依實際儲存時間選出各模式最新且有效的進度；不修改手動存檔。已被舊版覆蓋、且沒有任何存檔副本的輪次無法憑空恢復。

## 介面與支撐線

總資產超過初始一百萬元時日期使用紅底；依玩家資產獲利判斷，不以是否贏過 0050 判斷。賣出委託為白字，心情圖集使用獨立 SVG viewBox 限定範圍，避免相鄰表情外露。桌機右欄只有交易與持股，事件操作放在內心劇場右側；縮減委託留白，主畫面及右欄不再使用捲軸。長清單仍可在各自內容區捲動。

支撐線下跌前導約 2 秒，保留背景暫停及減少動態效果設定。每輪實際使用兩次後不再觸發，選擇不使用只計入既有 30 交易日冷卻；使用次數由存檔紀錄延續。

奇門遁甲在占卜按鈕旁及主畫面技能入口旁顯示最後一次預測，包含標的、預測日期、交易日數及漲跌平盤日數；讀檔後仍保留。林北VIP拉僅在營業員來電時提供使用選項。人生遙控器僅在技能畫面使用；CG 保留原始 3:2 比例，圖片與說明放在同一捲動區，底部取消與快轉按鈕不隨內容捲動。追繳視窗按 X 或 Esc 等同暫不補繳；結算後的存檔視窗按 X 或 Esc 返回起始畫面。

主畫面在可用寬度至少 1000px 時維持三欄，不因瀏覽器工具列令高度低於 620px 而改成直排。高度較矮時縮減表頭、委託與市場觀察留白；1000～1199px 另調整三欄寬度。窄視窗沿用自然上下排列，長紀錄或長篇劇情可在各自內容區捲動。

## 融資追繳

依[證交所操作辦法第 54 條](https://twse-regulation.twse.com.tw/TW/law/DOC01.aspx?FLCODE=FL007121&FLNO=54)與[第 55 條](https://twse-regulation.twse.com.tw/TW/law/DOC01.aspx?FLCODE=FL007121&FLNO=55)區分追繳、暫緩處分、取消紀錄：低於 130% 發出通知，通知後兩個交易日為補繳期；期滿仍不足才排定次日開盤處分。回升至 130% 以上暫緩處分並保留追繳紀錄，後續再不足時當日補繳、否則次日處分。回升至 166% 或繳足原通知差額才取消紀錄。處分日使用當天開盤價判斷回升，不偷看收盤價。

原有現金移入擔保金模型及補到約 166.67% 的建議補繳金額不變；已新增通知差額、累計補繳、暫緩及處分日期欄位，保留舊追繳存檔相容。

## 排行榜與發布

四榜快照與記憶體快取保持原樣；移除前端手動更新按鈕及五分鐘快取文字。自己的名次顯示贏過或落後大盤百分比，計算與排行榜欄位相同。

經確認目標環境後，先套用 `backend/migrations/0013_journey_dates.sql`，僅新增 Session 起點、成績起點、提前結算日期與跳躍 JSON 四個可為空的欄位。再部署相容舊前端的新 Worker，最後部署 Pages。沒有刪表、重建資料或變更 Secret／管理員帳密。

日期跳躍沿用原起點，沒有重設 0050 基準；由 `backend/tools/build-edition.mjs` 產生的每起點基準檔保留以相容舊版起點紀錄。editionId／datasetId 計算不變，重新生成也不會加入作者 API。仍沿用基本摘要驗證，沒有聲稱完整交易重播或伺服器權威技能點驗證。

## 新 CG 與提示詞

工具：內建 imagegen。生成原檔保留於工具預設目錄；遊戲使用 1536×1024 WebP，品質 91，只做編碼轉換。

- 男主角：`assets/early-settlement/xiaojiu.webp`
- 女主角：`assets/early-settlement/xiaoxiaojiu.webp`

簡化版本共同提示詞：Preserve the approved character identity and illustration proportions. White shirt, male glasses and sage tie, female no glasses and sage bow. A tidy Taipei bedroom/study, plain light mint wall, one window and one desk lamp. Remove flying calendars, papers, graphs, candles and glowing ribbons. A short palm-sized remote with exactly three large buttons, held naturally close to the chest with a natural thumb grip, playful surprised expression. Only two subtle horizontal motion streaks. No text, logos or watermarks. Landscape 3:2.

女主角最後校正提示詞：Image 1 is the edit target, the girl holding a three-button remote at her tidy desk. Image 2 is the authoritative Xiaoxiaojiu character reference. Preserve the room, remote, natural hand pose, startled expression, lighting, feminine face, white shirt and sage bow. Correct the warm brown layered hairstyle: short back ending at the nape, two natural front face-framing locks ending near the collarbones, never down the chest. Leave visible light negative space between the short rear hair tips and inside edges of the front locks next to the neck. Remove long hair behind the shoulders; no ponytail, braid or wig-like attached strands. Keep green eyes, leek hairclip, feminine jaw, no glasses and no hat. No duplicate character, text, logos, charts or flying papers.
