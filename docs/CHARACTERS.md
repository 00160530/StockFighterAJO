# 角色素材與選擇

角色選單使用「小韭」「小小韭」兩個名字。角色是瀏覽器的外觀偏好，不改動劇情中的「小韭」稱呼、交易數值、技能或每輪成績。第一次進入人生模式會先選擇；首頁點擊人物可更換，滑過人物保留金句。

角色偏好存在 `taigu-warrior.v1.characters`，舊資料預設小韭且尚未確認選擇。清除全部本機紀錄會一併清除偏好。既有存檔不需遷移，重載網頁保留外觀。六張序章、一般與認真姿勢共用角色設定。

## 完整圖片盤點

| 原素材 | 內容／使用位置 | 小小韭版本 |
| --- | --- | --- |
| assets/xiaojiu-expressions.png | 六表情：平常、開心、驚嚇、哭哭、得意、疲倦；首頁、對話頭像、手指支撐線事件與演出 | assets/characters/xiaoxiaojiu/expressions.webp |
| assets/xiaojiu-serious.webp | 扶眼鏡拿筆記；首頁及遊戲內認真反應 | assets/characters/xiaoxiaojiu/serious.webp |
| assets/xiaojiu-moods-flat-1-10.webp | 十心情：微笑、興奮、得意、認真、緊張、驚訝、哭哭、疲憊、生氣、期待；成績提交及排行榜 | assets/characters/xiaoxiaojiu/moods.webp |
| assets/intro/cg-01.webp | 辦公室疲倦看盤 | assets/characters/xiaoxiaojiu/intro/cg-01.webp |
| assets/intro/cg-02.webp | AI 獲利，包含幻想泡泡內的小分身 | assets/characters/xiaoxiaojiu/intro/cg-02.webp |
| assets/intro/cg-03.webp | 卡車事故，無血腥漫畫撞擊 | assets/characters/xiaoxiaojiu/intro/cg-03.webp |
| assets/intro/cg-04.webp | 時間倒轉 | assets/characters/xiaoxiaojiu/intro/cg-04.webp |
| assets/intro/cg-05.webp | 租屋處驚醒 | assets/characters/xiaoxiaojiu/intro/cg-05.webp |
| assets/intro/cg-06.webp | 重新挑戰，包含右側平行人生分身 | assets/characters/xiaoxiaojiu/intro/cg-06.webp |

共 9 個含角色的原素材檔、9 個新版本。支撐線手部三個歷代素材只有裸手或通用袖口，可共用。room-simple.png、room-neutral.png、room-sage.png、xiaojiu-halo.svg、favicon.svg 均無角色，不需替換。work/pages 中同名素材為舊部署副本，不是另一套圖。

## 形象

小小韭沿用原創小韭的 Q 版比例、棕髮、綠眼、圓眼鏡、韭菜髮夾與米色斜背包，搭配及肩髮、低側馬尾與灰綠緞帶、白色短袖上衣、灰綠領結、深灰 A 字裙、深色不透膚襪與棕色圓頭鞋。使用日常上班族造型、粗輪廓與簡單兩階明暗，保持原遊戲美術風格。

## 美術製作及提示詞

全部以內建 image_gen 製作。表情、認真及心情圖為真透明 alpha；程式只做 WebP 格式編碼，未裁切、改尺寸、調色或重繪。原小韭圖片保留。

共同角色提示詞：

> Original adult office-worker Xiao Xiao Jiu, cute 2.3-head chibi, brown shoulder-length hair with a small low side ponytail and sage ribbon on viewer right, green leek hairclip, green eyes behind thin round glasses, white short-sleeve office blouse, muted sage bow, charcoal A-line knee-length skirt, opaque dark tights, brown round-toe shoes, small beige crossbody work bag. Thick clean dark outlines, flat colors, simple two-tone cel shading, neutral white balance. Match the supplied original character's art direction. No text, logos or watermark.

最終圖集修正提示詞：

> Preserve the supplied six-expression atlas identity, poses and colors. Exactly 3 columns by 2 rows on a 1536x1024 canvas, each 512x512 square. Uniformly reduce each figure about 10% in its own cell, with at least 24px transparent padding on all four sides; heads and shoes must not cross cell edges. Row-major neutral, delighted star eyes, shocked panic, crying kneeling, smug folded arms, exhausted. Genuine transparent alpha, no grid, labels, numbers or colored background.

認真姿勢提示詞：

> Replace only the person in the original serious cutout using the supplied new character reference. Preserve focused eyes, one hand adjusting glasses, the other holding a small plain dark notebook; full-body centered in the same landscape framing. Match the exact new hairstyle, sage bow, skirt and tights. Truly transparent alpha background. One person, no haze or extra objects.

心情頭像提示詞：

> Replace all ten emotes in the supplied 5x2 atlas with the new character identity. Retain very simple flat doodle sticker style, thick near-black outlines, huge rounded head and tiny shoulders. Same row-major moods: calm smile, happy arms raised, smug folded arms, determined fists, nervous sweat, surprised, crying, tired chin-in-hand, grumpy pout, hopeful clasped hands. Equal cells and true transparent alpha, no labels or borders.

序章共同編輯提示詞：

> Image1 is the edit target; image2 is the replacement character identity reference. Replace every depiction of the main brown-haired glasses-wearing protagonist with the exact new character. Preserve composition, camera, story action, environment, props, lighting, neutral colors, comic emotion and landscape 3:2 framing. Background NPCs stay unchanged. Keep modest clothing and opaque tights in action scenes. No added words, captions or watermark.

各場景追加要求：01 保留托腮疲倦、手機群組與下跌螢幕；02 同時替換主角與幻想泡泡的躺椅分身，保留墨鏡、陽傘、飲料；03 保留撞擊、飛出手機與唯一一個飛出包包，不加傷口；04 保留倒轉時鐘、空白月曆、房間入口；05 保留大臉驚醒、舊手機日曆圖示、床與書桌；06 同時替換前景主角與右側灰色半透明平行人生分身。

03 最後修正：Remove only the extra beige bag on the character's right waist. Keep the single flying beige bag near the truck bumper and preserve every other pixel-level scene detail, character identity, pose, lighting and composition.

## 排行榜相容性

心情編號仍為 1～10，另以 avatarCharacter 保存頭像角色，避免其他玩家或歷史紀錄跟著目前使用者換外觀。API 僅接受已登錄的兩個角色，舊客戶端省略此欄時沿用小韭。0012_avatar_character.sql 只增加欄位，不刪除資料；這項維護記錄不放入遊戲公告。
