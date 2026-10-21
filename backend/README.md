> 本專案使用 AI 輔助開發，包含程式、劇情及美術素材。

# Cloudflare 排行榜與回報 API

玩家資料與自動上傳調整見 [PLAYER_PROFILE_BOARDS.md](../docs/PLAYER_PROFILE_BOARDS.md)。新增 Migration 0024、0025；sf_runs 不再保存暱稱或排行榜頭像，查詢改 JOIN sf_players。新榜單、重試與部署回復流程以該文件為準。以下含歷史版本設計說明。

## 公告圖片及每天提醒

公告管理可填寫選用的 `imageUrl`（HTTPS 圖床圖片網址或 Google 雲端單一圖片的分享連結），並切換 `repeatDaily`。圖片留空即為純文字公告；有圖片時可在遊戲公告與「更新及公告」中點圖放大。Google 雲端分享請選「知道連結的任何人」可檢視，且須使用圖片檔案，不能是資料夾或 Google 文件；分享連結的 `resourcekey` 會保留。外部圖片若受分享權限、圖床防盜連或流量限制，會顯示原始連結供玩家另開查看，文字公告仍可閱讀。

`repeatDaily=true` 時，同一瀏覽器每天依台灣日期（UTC+8）提醒一次；關閉時維持每次發布只提醒一次。顯示彈窗即記錄當日已看過，重新整理或同一天回首頁不重複跳出；跨日回首頁會再次提醒。查看「更新及公告」也算已閱讀。再次發布會更新發布時間，並視為新公告。

`GET /v1/announcement`、`GET /admin/api/announcement` 回傳 `imageUrl` 與 `repeatDaily`。管理寫入沿用登入及同源驗證，`POST /admin/api/announcement` 可一併設定兩個欄位；舊版管理介面沒有送出新欄位時，保留原有圖片及提醒設定。`0018_announcement_images_and_daily.sql` 只新增欄位，舊公告預設無圖片且不每天提醒，原文、發布時間及管理員資料不變。正式更新時先套用 Migration，再部署 Worker，最後更新前端；舊版 Worker 能在新增欄位後繼續讀寫。

這是遊戲的獨立 Worker 後端，D1 綁定保持 `DB`。每個部署者應建立自己的 Worker、D1 與管理員，不會從 Fork 自動取得雲端資源。

完整步驟與所有參數請讀 [部署教學](../docs/DEPLOYMENT.md)。公開的 `wrangler.jsonc` 和 `wrangler.example.jsonc` 只有示意值；複製範本為已忽略的 `wrangler.local.jsonc` 後填寫自己的 Account ID、Worker、D1 與 ALLOWED_ORIGINS。管理後台是你自己的 API 基底網址後接 `/admin`，使用自己的管理帳密登入。

## 安裝、測試與維護

### 查詢玩家

後台「查詢玩家」使用 `GET /admin/api/players`，列出所有已建立的匿名身分，包括尚無暱稱、尚未上傳排行榜和停用的身分。每頁 50 位，可搜尋部分暱稱或匿名編號、篩選暱稱與上傳狀態，依最近上線、建立時間、上傳次數或暱稱排序。上傳次數計算所有成功儲存的 `sf_runs`，包含已註銷的成績，不把尚未提交的 Session 或重送同筆成績另計一次。回應不含 Token、Token hash 或 Session 憑證。

`0020_player_last_seen.sql` 僅新增可為空的 `last_seen_at` 和查詢索引。新增身分時記錄建立及上線時間；驗證成功的玩家 API 連線會更新最後上線時間，同一玩家每分鐘最多寫入一次，不表示目前仍在線。首頁已有匿名身分時的社群查詢也會更新；尚未建立身分的純瀏覽訪客不會自動新增玩家。既有身分沒有可確認的歷史上線時間，保留空值，直到下次連線後才開始顯示。部署時先套用此 Migration，再部署 Worker；不需重設管理員或 Secret。

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

### 暱稱不可重複

第一次成功上傳排行榜時固定玩家暱稱，新暱稱不得與其他匿名身分重複；前後空白會移除、Unicode 使用 NFC 正規化，英文字母 A–Z 不分大小寫。重名回傳 `409 NICKNAME_TAKEN`，玩家可以更換暱稱，用原本同一輪的 Session 重試。已固定的玩家仍使用原名，股友金句沿用該名稱。註銷成績、金句或停用身分不會釋放暱稱。

`0017_unique_new_nicknames.sql` 新增查詢索引及資料庫觸發器，阻止同時提交繞過重名檢查；失敗時整批交易回滾，不消耗 Session，也不留下成績或半完成的暱稱。Migration 不改動既有玩家、成績、金句、按讚或其他資料；歷史上已存在的同名身分保留原名，仍可繼續提交，只有新的名稱指派受到限制。這是保留既有玩家資料的相容規則，不會自動幫舊玩家改名。

正式啟用需部署新版 Worker 並套用此 Migration；可先部署 Worker（能讀取原有結構並提示重名），再套用 Migration 補齊並行保護。兩個步驟都完成才算啟用，無需重設 Secret 或管理員。應依專案既有程序先核對目標帳號、資料庫並備份；本機測試不得執行遠端更新。

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

`GET /admin/api/runs` 接受 `q`（暱稱部分字串）、`id`（成績完整編號）、`status=all|active|revoked|modified`、`mode=all|life|free`、`financing=all|cash|margin`、`sort=latest|score|equity|duration|trades`、`page`（從 0 起，每頁 50 筆）。LIKE 特殊字元作為字面字元，排序使用白名單，所有值皆為參數綁定。

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

## 股友金句

`0015_stock_quotes.sql` 只新增金句及按讚資料表，不修改原本的遊戲、成績或通關紀錄。發布此功能時，先核對部署環境並取得站主確認，再依既有 migration 流程套用 0015，接著部署 Worker，最後更新前端。不要先讓新前端呼叫尚未上線的金句 API；不需重設 Secret 或管理員帳密。

- `GET /v1/quotes?tab=popular|latest|featured`：各分類最多 50 句；人氣按讚數遞減，最新按建立時間遞減，作者精選按精選時間遞減，同分以建立時間與 ID 穩定排序。公開資料不回傳玩家 ID 或憑證。有匿名 bearer 時附自己的按讚狀態與留言資格。
- `POST /v1/quotes`：`{text}`，去除頭尾空白、NFC 正規化後 1–25 個 Unicode 碼點。必須以同一匿名身分上傳過有效的人生模式排行榜成績（won 或 lost，排除破產、自由模式及遭註銷的成績）；沿用伺服器既有成績檢核，不接受本機旗標，只有通關回報而未上傳排行榜仍無留言資格。玩家唯一索引永久限制一句，註銷也不釋放；相同文字重試不新增，不同文字再次送出回覆 409。
- `POST /v1/quotes/:id/like`：`{liked:true|false}`，任何合法匿名玩家可按讚或取消，不必通關。每人每句唯一鍵防重複計票，同狀態重試保持相同結果。註銷或被封鎖作者的金句不能再按讚。讀取、留言與按讚均沿用來源、身分與限頻檢查。
- 管理員 `GET /admin/api/quotes?page=0` 每頁 50 句，包含已註銷資料及管理原因。`POST /admin/api/quotes/:id/feature` 接受 `{featured:true|false}`；`hide` / `restore` 接受 `{note}`（2–500 字）。需要原有登入、同源檢查及操作標頭，並寫入管理稽核。註銷會撤掉精選、保留原文、留言資格與按讚紀錄，恢復後不會自動重新精選。

匿名身分沿用既有瀏覽器保存方式，一個身分一句並不代表一個自然人一句；本功能不新增可跨瀏覽器辨識個人的追蹤方式。留言以純文字顯示，金句文字與可及性標籤均須轉義。

本機開發可將 API 指向 HTTP loopback，但頁面本身也必須位於 loopback；公開網站仍只接受 HTTPS API。此例外不會改寫公開設定，Pages 建置的 HTTPS 驗證維持原樣。

## 金句頭像、留言卡與快取

`0016_quote_authors.sql` 為既有金句新增 `nickname`、`avatar_id`、`avatar_character`；舊金句回填原玩家暱稱（沒有則顯示匿名股友），預設小韭的微笑頭像，保留金句原文、時間、狀態及按讚。

留言接受額外的 `nickname`（同排行榜 2–20 字規則）、`avatarId`（1–10）、`avatarCharacter`（`xiaojiu`／`xiaoxiaojiu`）。已有固定排行榜暱稱必須沿用；尚無排行榜暱稱時，金句暱稱只保存為這則留言的顯示資料，不會替玩家設定排行榜暱稱。舊版只送 `text` 的請求仍能使用預設頭像及原本的排行榜暱稱，或匿名股友。新增留言的重試不能覆蓋文字、暱稱或頭像；修改自己的金句使用獨立的 edit API。

`GET /v1/quote-boards` 一次回傳三類金句的前 50 句和自己的資格、留言、按讚狀態。查詢用視窗函式先選出各榜上限，最多回傳 150 個不同候選給 Worker；公開結果不帶玩家 ID、token 或內部排名欄位。前端依匿名 token 暫存 5 分鐘，去重同時讀取，切換頁籤及短時間重開不再請求。留言、修改、按讚、取消按讚成功或送出排行榜成績後使金句快取失效；修改失敗也使快取失效，以重新取得註銷或版本衝突狀態；讀取失敗可重試，舊請求不能覆蓋已失效後的新快取。不新增手動更新按鈕。

管理查詢 `GET /admin/api/quotes` 增加 `q`（部分金句）、`nickname`（部分顯示暱稱）、`featured=all|yes|no`、`status=all|active|revoked|modified`、`sort=latest|oldest|likes|likes_asc|nickname|updated`；支援同時套用條件及 `page`，回傳篩選後 `total`。部分查詢中的 `%`、`_`、反斜線以字面比對，所有值均綁定參數，排序採白名單。後台以表格呈現，註銷、恢復與精選操作保留當下查詢條件。

管理員可透過 `POST /admin/api/quotes/:id/delete` 與 `{confirm:true}` 永久刪除測試金句。這個操作沿用登入、同源及操作標頭檢查，並以同一筆交易刪除該金句、修改歷史與所有按讚、寫入 `quote-delete` 稽核紀錄。只釋放這位玩家的金句名額，不刪除匿名身分、排行榜成績或通關紀錄；重新留言仍須符合原本資格。玩家重新整理遊戲後會取得更新狀態。註銷仍保留名額，適用不當留言管理。


## 金句修改歷史

部署前先套用 `0021_quote_revisions.sql`，再部署 Worker 與前端。既有金句從第 1 版開始，文字、暱稱、時間、狀態、精選及按讚均保留。

- `POST /v1/quotes/:id/edit`：`{text,revision,avatarId,avatarCharacter,confirmResetLikes:true}`。限作者本人；沿用來源、身分及限頻檢查，文字仍最多 25 個 Unicode 字元，暱稱不可修改。私有 `self` 回傳目前版本及頭像供編輯。
- 相同內容與頭像重送不增加版本。不同內容必須符合目前 revision；過期回傳 `409 QUOTE_CHANGED`，避免兩個視窗互相覆蓋。
- 條件更新同時檢查作者、revision、未註銷；資料庫觸發器於同一個原子更新內保存舊文字、頭像、精選、時間與當時按讚數。任何歷史寫入失敗會回滾替換，註銷先完成則不能再改。
- 儲存修改前跳出確認，提醒按讚數將歸零及取消作者精選；取消時保留草稿且不送出請求。API 必須收到 `confirmResetLikes:true` 才能修改，舊前端不能未提醒就重設。
- 修改成功保留金句 ID 與原留言時間，舊版本保存當時按讚數；目前版本清除全部按讚及精選，玩家可重新按讚。條件更新與清除按讚為同一個 D1 batch 交易，透過 `changes()=1` 限制只清除這次成功更新的金句。失敗、版本衝突及重送相同內容不清除新按讚。
- 歷史內容只由管理員查詢，`status=modified` 顯示舊版本；公開榜單只讀取目前有效內容。「已修改」歷史列不可操作；管理員對目前版本註銷、恢復、精選或永久刪除。
- 註銷後前後端均禁止修改，訊息為「你的金句已被管理員註銷。」。管理員永久刪除目前金句時，同一交易刪除其歷史與按讚並釋放名額。
