> 本專案使用 AI 輔助開發，包含程式、劇情及美術素材。
>
> 遊戲網址：[台股戰士｜立即遊玩](https://00160530.github.io/StockFighterAJO/)

# Cloudflare 排行榜與回報 API

Worker：stockfighterajo-leaderboard-api。D1：stockfighterajo-leaderboard-db，binding DB，ID f0a34050-9b14-4163-8b87-952091c867a2。管理後台：[開啟](https://stockfighterajo-leaderboard-api.yyy335522001.workers.dev/admin)。正式 API 與前端配置見 wrangler.jsonc、../data/online-config.js。

## 已部署

兩個 SQL migration 已在既有 D1 成功執行，未刪除或重建資料庫。Worker API、管理頁及管理帳密已建立；機密不在此文件或 repository。後台使用自有帳密登入，不依賴 Cloudflare Access／Zero Trust，也不需訂閱該服務。

## 維護與部署

使用 Node.js 22 以上及 pnpm；安裝依賴後執行：

```sh
pnpm install --frozen-lockfile
node node_modules/wrangler/bin/wrangler.js whoami
node node_modules/wrangler/bin/wrangler.js login
node node_modules/wrangler/bin/wrangler.js d1 migrations list stockfighterajo-leaderboard-db --remote
node node_modules/wrangler/bin/wrangler.js d1 migrations apply stockfighterajo-leaderboard-db --remote
node --test tests/*.test.mjs
node node_modules/wrangler/bin/wrangler.js deploy
```

已登入時不必再次 login。遷移命令只套用未執行的檔案。RATE_LIMIT_SECRET 以 Worker secret 設定，不能進入前端、版本庫或日誌；它同時衍生 Session token，正式上線後請保留穩定。首次建立新環境才使用 `wrangler secret put RATE_LIMIT_SECRET` 輸入隨機值。請勿對現有服務任意重設。

管理帳密存 D1 的 sf_admin_credentials，salt 為 16 byte 隨機 hex、password_hash 為 PBKDF2-SHA256 100,000 次的 32 byte hex。新增／重設管理員可使用 `node tools/admin-credential.mjs --remote`；工具從標準輸入讀取 JSON，不將密碼放進命令列、不列印密碼，SQL 暫存會清除。重設會撤銷該管理員既有登入。不要把憑證內容貼到公開 issue 或 commit。

更新行情後，從遊戲根目錄執行 `node backend/tools/build-edition.mjs`，以現有引擎產生相符的 edition 與公開設定，再同步部署 Worker 與 Pages。沒有 Git 排程或瀏覽器即時行情更新。

## 結構與驗證

- src/api.mjs：公開排行、Session、回報與受保護管理 API。
- src/security.mjs、admin-auth.mjs：驗證、限流、token、密碼及登入 cookie。
- migrations：榜單／回報資料表與管理員資料表。D1 為唯一雲端資料庫。
- admin：同源後台，使用 HttpOnly、Secure、SameSite=Strict cookie，POST 驗證 Origin 與自訂標頭。使用者內容以 textContent 呈現，CSP 禁止外部腳本。
- tests：實際 SQLite migration、提交競爭、最佳紀錄、前百名、限流、登入、權限與管理操作。
- tools/smoke.mjs：透過現有遊戲引擎產生合法測試摘要，對正式 API 執行整合測試；會產生測試成績與回報，測後由後台標示完成並下架測試成績。

後台未登入不能讀取回報；一般玩家不能修改、刪除他人成績。管理員下架保留原資料與稽核。遊戲使用基本檢核而非伺服器重新計分，限制詳見 [LEADERBOARD.md](../docs/LEADERBOARD.md)。

GitHub Actions 僅測試和發布前端，Worker 部署由 Wrangler 執行。build-pages.mjs 只複製 index.html、.nojekyll、assets、css、data、js；backend、node_modules、私密設定均不進入 Pages。

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
