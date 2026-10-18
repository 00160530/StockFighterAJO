# 角色素材與選擇

角色選單只顯示「小韭」「小小韭」。外觀偏好不改動劇情中的小韭稱呼、交易數值、技能、存檔或成績。第一次進入人生模式先選擇；首頁點擊人物可更換，滑過人物保留金句。

角色偏好存在 taigu-warrior.v1.characters，舊資料預設小韭且尚未確認選擇。重載網頁保留外觀。一般表情、認真立繪、十種心情頭像及六張序章皆隨角色切換。

## 0.14.2 確認設計

- 男女主角襯衫均為中性白色，使用淺灰皺褶陰影，不使用米色或奶油色底。男主角序章 01–06 與女主角序章 04 採用最後確認的白襯衫 v2 圖片，包含幻想／平行分身。
- 小小韭不戴帽子或眼鏡，前側髮束至鎖骨、後髮短；頸側或衣領的留白表現前長後短，不綁馬尾。
- 女性化五官、柔和肩線、收腰及自然臀腿線條；修身九分褲保留褲中線與露踝，鞋子為棕色低跟橫帶樂福鞋。
- 各類圖片依男主角原圖維持相對應的 Q 版程度；心情頭像使用粗描邊及簡化塗色。
- 女主角認真立繪為右手握筆、左手托筆記本，男主角保留扶眼鏡姿勢。

## 圖片盤點

| 內容 | 小韭 | 小小韭 |
| --- | --- | --- |
| 六種全身表情 | assets/xiaojiu-expressions.png | assets/characters/xiaoxiaojiu/expressions.webp |
| 認真立繪 | assets/xiaojiu-serious.webp | assets/characters/xiaoxiaojiu/serious.webp |
| 十種心情頭像 | assets/xiaojiu-moods-flat-1-10.webp | assets/characters/xiaoxiaojiu/moods.webp |
| 序章 01 · 辦公室 | assets/intro/cg-01.webp | assets/characters/xiaoxiaojiu/intro/cg-01.webp |
| 序章 02 · 街頭與幻想分身 | assets/intro/cg-02.webp | assets/characters/xiaoxiaojiu/intro/cg-02.webp |
| 序章 03 · 卡車 | assets/intro/cg-03.webp | assets/characters/xiaoxiaojiu/intro/cg-03.webp |
| 序章 04 · 時間倒轉 | assets/intro/cg-04.webp | assets/characters/xiaoxiaojiu/intro/cg-04.webp |
| 序章 05 · 驚醒 | assets/intro/cg-05.webp | assets/characters/xiaoxiaojiu/intro/cg-05.webp |
| 序章 06 · 重新挑戰與灰色分身 | assets/intro/cg-06.webp | assets/characters/xiaoxiaojiu/intro/cg-06.webp |

## 檔案與載入

採用內建 imagegen 產出的已確認原圖。PNG 直接複製，透明素材僅以 lossless WebP 編碼；序章僅轉為品質 94 的 WebP，不裁切、重排或程式調色。所有圖片保留原始尺寸，心情圖集為 1983 × 793，其餘為 1536 × 1024。

每張來源與正式素材的 SHA-256、Git blob SHA、尺寸及透明度記錄在 character-art-v0.14.2.json。來源原圖與完整提示詞另附於本次美術預覽下載包。男女主角的一般表情、認真立繪、心情頭像與六張序章都使用 v=0.14.2 圖片版本，包含預載與最初的 HTML 圖片。

## 排行榜相容性

心情編號仍為 1～10，另以 avatarCharacter 保存頭像角色，避免其他玩家或歷史紀錄跟著目前使用者換外觀。API 僅接受已登錄的兩個角色，舊客戶端省略此欄時沿用小韭。0012_avatar_character.sql 只增加欄位，不刪除資料；這項維護記錄不放入遊戲公告。

