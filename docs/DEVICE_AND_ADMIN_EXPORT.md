# 裝置紀錄、後台查詢與匯出

v0.16.33 使用 Migration `0026_device_types.sql`，為 `sf_players` 增加 `last_device_type`、為 `sf_runs` 增加 `device_type`。值為 mobile、desktop、tablet、unknown，歷史資料預設 unknown，不推定以前使用的裝置。沒有新增索引、統計表、Token 或完整 User-Agent 紀錄。

前端只在玩家建立與有匿名 Token 的請求附上 `X-SF-Device`，以瀏覽器資訊判斷，另用觸控點區分 iPad 的桌面瀏覽模式。Worker 只接受合法值，沒有提示時以 User-Agent 判斷。這是瀏覽器回報的統計分類，不參與身分、Session、計分或防作弊判定，也不以螢幕寬度區分裝置。

成績在第一次成功上傳時記錄裝置；重送、查名次、後續玩家換裝置不改寫那輪紀錄。玩家在驗證 Token 的既有查詢中讀取最後裝置，同裝置保留 10 分鐘節流，偵測切換裝置時用同一條 UPDATE 更新時間與裝置；未知資訊不覆蓋已知裝置，時間不倒退。不因匿名看榜而建立玩家。

後台 `/admin/api/runs` 新增 `playerId` 部分編號查詢與 `device` 篩選，與原有暱稱、模式、狀態、融資及排序條件並用；`/admin/api/players` 的 device 篩選對應最後連線裝置。device 可為 all、mobile、desktop、tablet、unknown。查詢玩家總數快取的鍵包含裝置條件，避免混用數字。

`GET /admin/api/runs/export`、`GET /admin/api/players/export` 使用同一套篩選與排序，不受畫面頁數限制。單次最多 10,000 筆，超過回傳 413 並要求縮小條件，不默默截斷；匯出不再額外查總數。每次仍驗證管理員 Session，不回傳 token_hash、Token 或 Session 憑證。

瀏覽器按「匯出 Excel」才載入既有 ExcelJS 4.4.0，從同源 Worker 的 `/admin/exceljs.js` 取得，不使用外部 CDN，也不放寬 CSP。`backend/admin/exceljs.txt` 與既有 `js/vendor/exceljs.min.js` 位元組相同，原始授權見 [ExcelJS LICENSE](../js/vendor/exceljs.LICENSE)。檔案在瀏覽器建立下載，含資料工作表及匯出說明；台幣總額為整數、日期時間使用台北時間，未記錄時長留白。文字保持 Excel 字串，避免暱稱或筆記成為公式。匯出過程登出或切換管理登入時不繼續下載。

## 發布與回復

先備份正式 D1、確認欄位尚未存在，再套用新的 0026 Migration，然後部署 Worker，最後發布前端。原有 Migration 不修改。舊 Worker 對既有欄位的 INSERT／UPDATE 可與新增預設欄位並存，過渡期間舊前端沒有裝置提示仍可用 User-Agent 分類。需要回復時先回復原 Worker／前端，保留新增欄位即可；不要刪除玩家、成績或回寫歷史裝置。

本機以所有 Migration 建立隔離資料庫，測試舊資料預設值、同裝置節流、切換裝置、成績去重、篩選組合與 Excel 往返讀取。正式 Migration 與部署是另外的發布步驟。
