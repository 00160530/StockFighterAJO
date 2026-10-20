# 更新公告維護

後台「公告管理」分成作者公告、更新公告。作者公告保留圖片與每日提醒設定；更新公告可新增、修改及刪除，每次操作成功後顯示成功提示。儲存失敗保留表單與錯誤訊息。

更新公告欄位：版本、日期、標題、摘要、詳細內容（每行一項）。摘要用於首頁跑馬燈，詳細內容用於「更新及公告」。新版遊戲從同一個 `/v1/announcement` 請求讀取兩種公告；離線或舊版 API 則使用隨遊戲提供的更新紀錄。伺服器回傳空清單代表已刪除全部更新，不能再用靜態檔補回。

## 發布流程

1. 在 `CHANGELOG.md` 開頭依版本由新至舊新增更新紀錄，README 只維護目前的遊戲介紹、玩法與技術說明，不再堆放版本歷史。遊戲內需要顯示的更新，同時在 `data/updates.js` 加入新版本公告，使用從未出現過的穩定 `id`。
2. 執行 `node tools/sync-update-announcements.mjs`，將版本公告同步至 Worker 使用的 `backend/src/release-updates.json`。根目錄 `npm test` 以及範例／標準 Wrangler 設定的 build command 會自動執行此步驟；自訂 Wrangler 設定也需保留該 build command。
3. 首次上線先套用 D1 migration `0019_update_announcements.sql`，再部署新版 Worker 與遊戲。之後每次新增版本公告也要部署 Worker，不能只更新 Pages；否則線上公告清單會停留在前一版。
4. Worker 第一次讀取公告時自動匯入所有尚未出現的版本，包含既有歷史紀錄。後台先開或玩家先開皆可完成匯入。

匯入以 `INSERT OR IGNORE` 保留已存在的紀錄，不覆蓋管理員改過的文字。刪除保留 ID 墓碑，之後匯入不會復活；如要重新發布，請從後台新增。管理動作寫入 `sf_admin_audit`，更新及刪除以 revision 防止兩個管理頁面相互覆蓋。

測試：`node --test backend/tests/update-announcements.test.mjs`，包含匯入完整性、CRUD、權限／來源檢查、輸入驗證、同時修改衝突、手動修改／刪除保留，以及空清單。
