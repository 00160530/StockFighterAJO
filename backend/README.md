> 本專案使用 AI 輔助開發，包含程式、劇情及美術素材。

# Cloudflare 排行榜與回報 API

這是遊戲的獨立 Worker 後端，D1 綁定保持 `DB`。每個部署者應建立自己的 Worker、D1 與管理員，不會從 Fork 自動取得雲端資源。

完整步驟與所有參數請讀 [部署教學](../docs/DEPLOYMENT.md)。公開的 `wrangler.jsonc` 和 `wrangler.example.jsonc` 只有示意值；複製範本為已忽略的 `wrangler.local.jsonc` 後填寫自己的 Account ID、Worker、D1 與 ALLOWED_ORIGINS。管理後台是你自己的 API 基底網址後接 `/admin`，使用自己的管理帳密登入。

## 安裝、測試與維護

在 backend 目錄執行：

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm exec wrangler whoami
```

以下只供已核對帳號及資源的部署者執行，不是測試命令：

```sh
pnpm exec wrangler d1 migrations list DB --config wrangler.local.jsonc --remote
pnpm exec wrangler d1 migrations apply DB --config wrangler.local.jsonc --remote
pnpm exec wrangler deploy --config wrangler.local.jsonc
```

Migration 僅套用未執行檔案，不刪除或重建資料庫。既有正式環境保留原 Secret、資料庫及管理員，不要重跑首次建立帳密流程。RATE_LIMIT_SECRET 同時衍生 Session token，正式上線後必須保持穩定；只存 Cloudflare Secret，本機測試值可放已忽略的 .dev.vars。

管理帳密存 D1 的 sf_admin_credentials，salt 為 16 bytes 隨機 hex，password_hash 為 PBKDF2-SHA256 100,000 次的 32 bytes hex。管理員工具從 stdin 讀 JSON，不列印密碼或 SQL；必須指定 --config，遠端還需 --confirm-database 與該設定內的 D1 ID 一致。重設同名帳密會撤銷既有登入，詳見部署教學。

更新行情時從專案根目錄執行 `node backend/tools/build-edition.mjs`。editionId 與 datasetId 沿用原本計算，API 不再寫死，部署時由公開變數注入。需要資料版本改版時協調 Worker 與 Pages 發布。

## 結構與安全

- src/api.mjs：公開排行、Session、回報與受保護管理 API。
- src/security.mjs、admin-auth.mjs：限流、token、密碼驗證及登入 cookie。
- migrations：完整歷次 SQL，既有資料不重建；tests 使用獨立記憶體 SQLite。
- admin：同源後台，HttpOnly、Secure、SameSite=Strict cookie，POST 驗證 Origin 與自訂標頭，內容以 textContent 顯示。
- tools/smoke.mjs：必須指定 --base 和 --origin；預設只讀。只有 --write 加匹配 --confirm-target 才會新增測試玩家、Session、成績及回報，應對獨立測試環境使用。

後台未登入不能讀回報，一般玩家不能管理他人成績。註銷保留原始紀錄與稽核；前端可修改，基本成績檢核無法完全防作弊。詳見 [排行榜文件](../docs/LEADERBOARD.md)。API 網址不是密鑰，CORS 也不是身分驗證。

GitHub Actions 只測試並發布前端，不會部署 Worker 或操作 D1。build-pages.mjs 以白名單產生 work/pages，排除 backend、機密、本機設定與範本。

## 0.12.0 管理功能

`GET /admin/api/runs` 接受 `q`（暱稱部分字串）、`id`（成績完整編號）、`status=all|active|revoked`、`mode=all|life|free`、`financing=all|cash|margin`、`sort=latest|score|equity|duration|trades`、`page`（從 0 起，每頁 50 筆）。LIKE 特殊字元作為字面字元，排序使用白名單，所有值皆為參數綁定。

`POST /admin/api/runs/:id/hide` 註銷；`POST /admin/api/runs/:id/restore` 恢復。皆須 2–500 字原因、管理 cookie、同源 Origin 與 X-Admin-Action。使用 D1 batch 原子更新成績、重選該玩家與版本的三種最佳成績，並留下稽核紀錄，不刪除原始成績。

回報狀態增加 `ignored`（不處理）。0007 以 not_handled 旗標保留原狀態 CHECK 與舊資料；對外狀態及計數由 API 導出，與已結案分開。回報列表回傳所有狀態總數 `counts`，不受當前篩選及頁數影響。

## 玩家分享紀錄

0008 新增 `sf_shared_records`，儲存玩家主動分享的顯示 JSON。`POST /v1/shares` 需匿名玩家 token、requestId 與白名單紀錄，按玩家與 IP 限頻，重試同 requestId 回傳同一份不可變紀錄。`GET /v1/shares/:id` 公開回傳顯示紀錄，不回傳玩家 ID、requestId 或 token；分享不寫入排行榜。遊戲連結使用 `?record=<id>`，直接開啟「你朋友股神的紀錄」。

## 0.13.0 社群統計與調查 API

0009 新增 sf_life_completions、sf_polls、sf_poll_votes、sf_community_counters，保留原有資料。`POST /v1/completions` 使用開局 Session 及現有結算檢核（含最低遊玩時長），不消耗排行榜提交資格；Session 去重，自由模式、破產、未完成不計。排行榜提交也會補記同一通關。`GET /v1/community` 回傳總完成／勝利次數與唯一進行中調查。

`GET /v1/polls?page=0` 為公開歷史，每頁 50 題；提供匿名 bearer 時只附該玩家的 myChoice，不公開玩家身分。`POST /v1/polls/:id/vote` 選 yes/no，匿名身分每題僅一票，改選取代原票；在單一 SQL 內確認調查仍進行且公開，另有玩家與 IP 限頻。

管理員 `GET/POST /admin/api/polls`、`POST /admin/api/polls/:id` 設定題目、active、visible。D1 部分唯一索引限制最多一題 active，切換以 batch 原子處理；active 必須 visible，已有票的題目由 DB trigger 鎖定原文。過往資料可隱藏而不刪票。管理員 `GET/POST /admin/api/community-counts` 接受 total 與 wins（非負整數且 wins≤total）；以當下自動數的差額保存，後續通關繼續累加。全部修改須管理登入、同源驗證並留下稽核紀錄。

## 0.13.1 選項文字與移除調查

0010 為 sf_polls 增加 red_label、green_label、deleted_at。紅色綁定 yes，預設行；綠色綁定 no，預設不行。管理新增／修改接口接受可選 redLabel、greenLabel，1–12 字，舊管理頁省略時保留現有文字。公開接口只回傳文字與票數，前端在文字及 aria 屬性中均轉義。

`POST /admin/api/polls/:id/delete`（空 JSON）需要既有管理登入及同源驗證，以 batch 標記 deleted_at、關閉 active／visible 並寫入 delete-poll 稽核。兩種列表、投票及設定接口均排除已刪除題目，保留原始投票供查核；不提供公開刪除接口。

## 0.14.1 合併排行榜讀取

新增 GET /v1/boards，一個 SQL 排序查詢同時取得四榜及合法匿名身分的名次；未進前 100 名者仍能查看本人排名。舊端點維持相容，無資料表變更。前端依身分保留 5 分鐘快取，提交後失效。詳見 ../docs/LEADERBOARD-CACHE.md。
