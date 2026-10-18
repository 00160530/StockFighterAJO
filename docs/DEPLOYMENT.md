# 部署你自己的台股戰士

本專案使用 AI 輔助開發。此文件適用於 Fork 後建立**自己的**網站、Worker 與 D1。GitHub Fork 只複製檔案，不會替你建立 Cloudflare 資源。未設定 API 時，單機遊戲及本機存檔仍可使用，線上功能會提示尚未設定。

如果維護的是既有正式服務，先看最後的「既有正式站漸進遷移」，不要照新環境流程另建資料庫或重設密鑰。

## 1. 準備服務與工具

- GitHub 帳號：Fork 本專案。啟用 Fork 的 Actions，並確認預設分支為 `main`；若使用其他分支，調整 `.github/workflows/pages.yml` 的 `branches`。
- Cloudflare 帳號：使用自己的帳號建立 Workers 與 D1。此架構不需要 Cloudflare Access 或 Zero Trust。
- 本機安裝 Node.js 22.9 以上、Git 及 pnpm。已附歷史行情，不需重新下載行情。
- 將 Fork Clone 到電腦，終端機進入有 `index.html` 的專案根目錄。

服務可能有費用或配額，部署前查看自己帳號的方案。GitHub Pages 靜態網站和 Cloudflare Worker 是兩個獨立部署。

## 2. 設定檔與參數

| 位置／參數 | 用途 | 必填與預設 |
| --- | --- | --- |
| `backend/wrangler.local.jsonc` → `name` | 你的 Worker 名稱 | 必填，例如 `your-game-api`，應自行命名 |
| 同上 → `account_id` | 你的 Cloudflare Account ID | 本專案管理工具的遠端操作必填 |
| 同上 → `d1_databases[0].database_name` | 你的 D1 名稱 | 必填，自行命名 |
| 同上 → `d1_databases[0].database_id` | 你的 D1 UUID | 必填，建立資料庫後取得 |
| 同上 → `d1_databases[0].binding` | 程式的資料庫綁定 | 保持 `DB`；程式使用 `env.DB` |
| 同上 → `vars.ALLOWED_ORIGINS` | 可用遊戲 API 的瀏覽器來源 | 必填，逗號分隔，不含路徑或尾端 `/` |
| GitHub Repository Variable `TAIGU_API_BASE` | Pages 建置時注入公開 API 網址 | 要有線上功能必填；留空為單機版 |
| GitHub Repository Variable `TAIGU_REQUIRE_ONLINE` | 避免缺 API 時意外發布離線版 | 正式線上站設 `true`；純單機站可不設 |
| `.env` → `TAIGU_API_BASE` | 本機建置 API | 可選；用 `node --env-file=.env tools/build-pages.mjs` 讀取 |
| `.env` → `TAIGU_REPOSITORY_URL` | 「關於」的原始碼連結 | 可選；Actions 會自動用目前 Repository |
| `data/online-config.local.js` → `apiBase` | 不使用 `.env` 時的本機替代設定 | 可選；從 `.example.js` 複製並改成自己的網址 |
| Cloudflare Worker Secret `RATE_LIMIT_SECRET` | 限流 HMAC 與 Session token 衍生 | 新環境必填，至少 32 bytes 隨機值，既有環境保留原值 |
| 管理員帳密 | 管理後台登入 | 新環境必建，經工具加鹽雜湊後寫入 D1 |
| `editionId`、`datasetId` | 遊戲資料與規則版本 | 自動產生，不能填成自己的帳號，也不要手動改 |

公開範本為 `backend/wrangler.example.jsonc`、`data/online-config.example.js`、`.env.example`。範本網址和 ID 必須替換，不能直接部署。`backend/wrangler.jsonc` 也是不含個人資訊的安全範本，維護命令一律明確使用 `wrangler.local.jsonc`。

設定優先順序：明確的環境變數（包含空字串）→ 本機 `online-config.local.js` → `data/online-config.js`。Repository 內的 `data/online-config.js` 預設 API 空白；建置只更新 `work/pages/data/online-config.js`，不覆寫原始設定。範例 `.local.js` 只需 API 與可選原始碼連結，資料版本仍讀自動產生的原始設定。

`.env.example` 只供前端公開建置參數使用，不要放管理密碼、Cloudflare API Token 或 Worker Secret。API URL 不是密鑰，發布後會出現在瀏覽器。Wrangler 登入憑證由 Wrangler 保管；本機 Worker Secret 可放在已忽略的 `backend/.dev.vars`，不會發布到 Pages。[Cloudflare 機密設定文件](https://developers.cloudflare.com/workers/configuration/secrets/)

## 3. 建立自己的 D1 與 Wrangler 設定

先複製 `backend/wrangler.example.jsonc` 為 `backend/wrangler.local.jsonc`。可以用檔案總管複製；終端機範例：

```sh
cd backend
cp wrangler.example.jsonc wrangler.local.jsonc
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler whoami
```

Windows PowerShell 將 `cp` 換成 `Copy-Item` 也可以。`whoami` 只確認登入帳號；先核對是你自己的帳號。

在 Cloudflare Dashboard 的 Workers & Pages 頁面查看 Account ID，或在 `wrangler whoami` 的帳號清單取得。多帳號時選正確一個，填入 `account_id`。不要複製其他部署者的 ID。

接著到 Cloudflare Dashboard → Storage & databases → D1 SQL Database → Create Database，輸入自己的資料庫名稱。建立後在資料庫詳細頁複製 Database ID（UUID）。填回 `wrangler.local.jsonc` 的 `database_name` 與 `database_id`，保留 `binding: "DB"` 和 `migrations_dir: "migrations"`。也可以使用 `pnpm exec wrangler d1 create <你自己的資料庫名稱>` 建立，命令輸出會提供 ID；若詢問自動改設定，請核對修改的是本機設定檔。[D1 官方入門及綁定說明](https://developers.cloudflare.com/d1/get-started/)

`name` 填自己的 Worker 名稱。`ALLOWED_ORIGINS` 填自己的 Pages **Origin**，例如 `https://your-username.github.io`。即使網站是 `/your-game/`，Origin 仍不包含這段路徑。自訂網域填實際的 `https://game.your-domain.com`；需要本機測試可另外加入 `http://127.0.0.1:4173`，以逗號分隔、不要加入空白。後台使用 Worker 本身同源，不需把 `/admin` 加入此設定。

注意：GitHub Pages 同帳號的多個 repository 共用相同 Origin，CORS 無法區分路徑。CORS 不是身分驗證；匿名 token、管理員登入、限流與資料檢核仍由現有 API 執行。

設定檔使用標準 JSON 語法（這也是合法 JSONC）。管理員工具會以 JSON 解析，請勿加入註解或尾端逗號。

## 4. 執行 SQL Migration

仍在 `backend`，先跑測試，再核對目標後執行：

```sh
pnpm test
pnpm exec wrangler d1 migrations list DB --config wrangler.local.jsonc --remote
pnpm exec wrangler d1 migrations apply DB --config wrangler.local.jsonc --remote
```

這些命令只應對你剛建立、已核對 ID 的資料庫執行。第一次會依序套用 `migrations/0001` 至目前版本。既有資料庫只套用尚未執行的 migration，不能手動清掉 migration 紀錄、刪除資料表或重建資料庫來解決錯誤。[D1 Migration 官方說明](https://developers.cloudflare.com/d1/reference/migrations/)

僅測本機 SQLite 時，用 `--local` 取代 `--remote`。兩者是不同資料庫，本機 migration 不會建立遠端資料表。

## 5. 建立自己的 Worker 與 Secret

設定及資料表完成後，部署**自己的新環境**：

```sh
pnpm exec wrangler deploy --config wrangler.local.jsonc
pnpm exec wrangler secret put RATE_LIMIT_SECRET --config wrangler.local.jsonc
```

第一次 `deploy` 會建立設定名稱對應的 Worker，輸出你的 HTTPS Worker URL。不要另用建立新專案的指令覆蓋這個遊戲資料夾。Secret 尚未設定完成時，部分 API 會回「服務尚未完成設定」。

第二個命令會互動要求 Secret，輸入至少 32 bytes 的隨機值，存到你自己的安全密碼管理器；不要貼到程式、README、命令列參數或公開日誌。Secret 放在 Cloudflare 的 Worker 設定中；日後部署程式不要重設它，否則原 Session token 會受影響。不要把這個新環境步驟套用到現有正式服務。[Wrangler Secret 文件](https://developers.cloudflare.com/workers/configuration/secrets/)

此專案不需要把 Cloudflare Token 放進 GitHub Pages Actions，Pages 工作流程不會部署後端。

## 6. 建立管理員

在 `backend` 建立暫存的 `admin.private.json`，內容格式：

```json
{"username":"your_admin_name","password":"REPLACE_WITH_YOUR_PRIVATE_PASSWORD"}
```

請換成自己的帳密，使用足夠長且不重複的密碼。此檔案已被 `.gitignore` 排除，仍不要強制加入 Git。把下面的 `YOUR_D1_DATABASE_ID` 換成**剛核對的同一個資料庫 ID**。

PowerShell：

```powershell
Get-Content -Raw admin.private.json | node tools/admin-credential.mjs --remote --config wrangler.local.jsonc --confirm-database YOUR_D1_DATABASE_ID
Remove-Item -LiteralPath admin.private.json
```

macOS / Linux：

```sh
node tools/admin-credential.mjs --remote --config wrangler.local.jsonc --confirm-database YOUR_D1_DATABASE_ID < admin.private.json
rm admin.private.json
```

工具只從 stdin 讀帳密，以隨機 salt 和 PBKDF2-SHA256 雜湊保存，不輸出密碼或 SQL。遠端命令必須提供正確設定與 ID 確認。對既有同名管理員執行會重設其密碼並撤銷登入，所以既有正式站不要重跑。

測本機後台時改用 `--local --config wrangler.local.jsonc`；如果 Wrangler dev 與 migration 指定了 `--persist-to`，管理工具也要帶同一個路徑，才會操作同一份本機 SQLite。此參數不能用於遠端。

在瀏覽器打開**你的 Worker URL 後接 `/admin`**，用自己的帳密登入。不要在遊戲前端設定管理密碼或登入 cookie。

## 7. GitHub Pages 連接你的 API

1. 到自己的 GitHub Repository → Settings → Secrets and variables → Actions → **Variables** → New repository variable。
2. 新增 `TAIGU_API_BASE`，值為步驟 5 的 **HTTPS Worker URL**，不要帶 `/admin`、`/v1`、查詢參數或密碼。
3. 要正式提供線上功能，再新增 `TAIGU_REQUIRE_ONLINE`，值為 `true`。以後 API 變數意外漏填，建置會失敗並保留先前的已部署版本。
4. Settings → Pages → Build and deployment → Source 選 **GitHub Actions**。
5. 推送自己的 `main`，或在 Actions 手動執行 `Deploy static game to GitHub Pages`。Fork 若尚未啟用 Actions，先依 GitHub 提示啟用。
6. 測試通過才建置、上傳 `work/pages` 並部署。到 Settings → Pages 取得自己的遊戲網址。

Workflow 不依賴原作者帳號；原始碼連結從 `GITHUB_REPOSITORY` 自動取得。分享與 LINE 推廣使用開啟中的遊戲 URL，支援 repository 子路徑與自訂網域。[GitHub 變數設定](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)、[Pages 自訂工作流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

未填 API 且未要求線上功能時，Actions 會發布單機版，不會自動借用任何部署者的雲端服務。前端發布採白名單，不含 `backend`、Wrangler、`.env`、`.dev.vars` 或本機設定。請使用此 Actions 流程；直接選「從 branch 發布整個 repo」會繞過排除規則。

## 8. 本機預覽與驗證

單機版在專案根目錄執行 `npm start`。要預覽有 API 的建置版，複製 `.env.example` 為 `.env`，填自己的 `TAIGU_API_BASE`：

```sh
node --env-file=.env tools/build-pages.mjs
node tools/serve.mjs work/pages
```

開啟終端機顯示的本機網址，API 的 `ALLOWED_ORIGINS` 必須允許這個本機 Origin。`.env` 只在明確 `--env-file` 時讀取；`data/online-config.local.js` 是另一種選擇，不需兩者都建立。首頁尚未開局時，排行榜不需要新增玩家。測試時先關 BGM。

確認 `/v1/config` 可讀、`/v1/boards` 可讀，以及自己的 `/admin` 可登入。下面從 `backend` 執行的 API 冒煙檢查**預設只 GET，不建立玩家、Session、成績或回報**：

```sh
node tools/smoke.mjs --base https://YOUR_REAL_WORKER_URL --origin https://YOUR_REAL_PAGES_HOST
```

如要完整寫入整合測試，先建立自己的獨立測試 Worker / D1，填入它們的實際網址，再加上 `--write --confirm-target <與 --base 完全相同且不含尾端斜線的網址>`。這會新增測試玩家、Session、成績及兩筆回報，不會自動清除；不要對正式環境執行。工具不會預設任何雲端測試目標。

最後在**自己的測試環境**完成一輪、提交排行榜、送回報、由管理後台查詢並註銷／恢復成績。純本機單元測試已涵蓋 DB migration、驗證和管理功能，但不能取代帳號、DNS、權限及瀏覽器的實際驗證。

## 9. 更新行情或程式

程式更新後執行前後端測試。只有更新行情才需執行 `node backend/tools/build-edition.mjs`；這會保留原始設定中的 API 選擇、自動更新版本識別，不會加入其他人的 API，也不會把本機 `.env` 寫入原始檔。接著重新建置 Pages，API 仍從部署變數或自己的本機設定取得。行情與規則改版如影響 `editionId`，需協調 Worker 和 Pages 發布，原有驗證規則不變。

## 10. 常見問題

| 問題 | 檢查方式 |
| --- | --- |
| 顯示「線上服務尚未設定」 | 檢查 `TAIGU_API_BASE` 在 **Variables**，並重新執行 Actions；不要修改頁面去接別人的服務 |
| `TAIGU_REQUIRE_ONLINE` 導致建置失敗 | 補回自己的 API 變數；既有已發布網站不會被這次失敗部署替換 |
| 範例 URL 被拒絕 | 範本是教學值，請換為自己部署命令輸出的實際 Worker URL |
| CORS／403 | `ALLOWED_ORIGINS` 要等於瀏覽器實際 Origin，不含 repo 路徑、尾端斜線或空白；改後需部署自己的 Worker |
| `NOT_CONFIGURED`／503 | Worker 的 `RATE_LIMIT_SECRET` 尚未設定；既有服務先核對，不要直接重設 |
| `no such table` | Migration 是否套用到該 Worker 綁定的遠端 D1，而非只套用本機 |
| D1 找不到或無權限 | 用 `whoami` 核對 Account ID，核對 D1 ID 及 `binding: DB` |
| 管理員工具讀不到設定 | 指定 `--config`；設定保持 JSON 語法，不加註解；Windows 編碼使用 UTF-8 |
| 管理員登入失敗 | 核對自己的 Worker、同源 cookie、帳密及資料庫；不要將密碼放入前端設定 |
| 舊存檔不能上傳 | 原規則要求開局 Session，離線舊輪次不補建；單機紀錄仍可玩 |
| Pages 404 | 確認 Actions 啟用、Pages Source、main 分支及 workflow 成功；使用 Settings → Pages 的網址 |

## 11. 既有正式站漸進遷移

1. **尚未 Push 時**，私下備份原 Wrangler 與前端設定，核對現有 Worker / Account / D1。備份不能提交。現有 Worker Secret、管理員與 D1 保持原樣。
2. 經站主確認，先在正式 Repository 設定 `TAIGU_API_BASE` 為現有 API，`TAIGU_REQUIRE_ONLINE=true`。此時舊 workflow 仍不受影響。
3. 用新工具在本機建置，核對產物 API 等於原設定，`editionId`、`datasetId` 完全一致；確認後再 Push 設定整理。
4. 等 Pages workflow 成功後，核對頁面設定和 API 只讀功能；若變數漏填，建置應失敗，不能發布範例或離線 API。
5. 這次整理不需要部署 Worker、執行遠端 SQL、重建 D1 或重設任何密碼。以後維護既有 Worker 時，使用私下保留的 `wrangler.local.jsonc`，指向同一組原資源。
6. 若需回復 Pages，可回復前一版靜態產物或程式提交；不需要動資料庫。不要先 Push 空 API 設定再補正式變數。

清掉目前檔案中的識別值不會刪除 Git 歷史、舊 Fork、已下載副本或瀏覽器快取。若發現真實密鑰外洩，應另外處理撤換與歷史清理；不能靠隱藏 API 網址代替權限驗證。
