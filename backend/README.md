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
