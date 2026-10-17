> 本專案使用 AI 輔助開發，包含程式、劇情及美術素材。
>
> 遊戲網址：[台股戰士｜立即遊玩](https://00160530.github.io/StockFighterAJO/)

# 原創美術素材

依使用者指定：可愛 Q 版角色、簡單美術背景。使用內建 imagegen 工具生成，未使用 CLI 或外部 API 金鑰。使用者提供的參考圖只作比例、線條與表情方向參考；交付圖是原創小韭與原創租屋處。

## xiaojiu-expressions.png

1536 × 1024 RGBA，六格表情，三欄兩列。保留透明 alpha，以 CSS sprite 切換。表情順序：平常、開心、驚嚇、哭哭、得意、疲倦。

提示詞：

```text
Use case: stylized-concept. Asset type: production chibi character sprite expression sheet for original Taiwanese stock trading visual novel. Input images are STYLE REFERENCES ONLY for cute 2.3-head-tall body proportions, thick smooth outlines, simple cel shading, funny expressions, rounded soft face. Create an ORIGINAL adult Taiwanese salaryman protagonist called Xiao Jiu, NOT any of the reference characters. Same character repeated exactly SIX times in a precise 3-column by 2-row equal-cell grid. Every cell has same centered full-body character, uniform size and baseline, full body visible with generous empty safe margins so software can crop each cell independently. Design: cute non-handsome little chibi adult, oversized rounded head, tiny body, messy dark desaturated brown hair with one small green onion shoot hair clip, large simple dark green eyes, small thin round glasses, chubby cheeks, off-white short sleeve office shirt, loose muted sage green tie, dark charcoal trousers, little brown shoes, tiny beige crossbody work bag. No glamour, no sharp adult anime jaw, no detailed rendering, no human realistic proportions. Six poses, row-major: 1 neutral calm tiny smile standing; 2 delighted cheering with star eyes, hands up; 3 panic shocked white eyes, sweat drop, hands on cheeks; 4 devastated crying with thick comic tear streams and droopy shoulders; 5 smug confident with folded arms and half-lidded eyes; 6 exhausted sleepy blank stare and shoulders down. Simple bold cute anime chibi sticker art like supplied references but original design, pastel sage cream and muted salmon palette, consistent outlines. Transparent background, absolutely no text labels, no letters, no grid lines, no numbers, no borders, no logos, no watermark. Canvas landscape approximately 1536x1024. All six figures separate, never touching or overlapping cell boundaries.
```

## room-simple.png（0.1 舊版，已停用）

1536 × 1024，簡化的台北小租屋處，無角色，可重複搭配表情素材。

提示詞：

```text
Use case: illustration-story. Asset type: simple 2D background for cute chibi Taiwanese stock market visual novel. Wide landscape composition with no people or characters at all. Cozy modest Taipei rental room in morning, simple desk on left holding open laptop with tiny red green candlestick symbols (no readable text), cheap swivel chair, little potted spring onion plant, coffee cup, small shelf with three books and cardboard box, single bed on far right, bright square window showing simplified Taipei apartment shapes and soft blue sky. Keep lower center and right foreground clear open floor for overlaying chibi character sprites. Flat pastel color blocks, clean gently rounded thin dark sage outlines, extremely simple cel shading, only a few background objects, cute casual anime mobile game background, no complex textures, no photorealism, no detailed cinematic painting. Light ivory walls, pale sage desk and bedding, soft peach morning light, pastel sky blue window, small muted yellow highlights. Cheerful soft and approachable. Not luxurious, ordinary office worker's small rental room. No text, no logos, no watermark. Canvas wide 1536x1024 or wider.
```

## room-neutral.png（0.3 背景，0.4 已停用）

1536 × 1024，白牆、藍灰家具、自然日光的小租屋處。使用內建 imagegen 重新生成原創插畫，非 CLI。用於首頁和轉生序章；未對角色套用全畫面黃色或橘色濾鏡。

最終提示詞：

```text
Use case: illustration-story. Asset: background illustration for a cute Taiwanese stock trading text adventure, landscape 3:2. A modest tidy Taipei rented studio bedroom belonging to a young office worker, simple desk with closed notebook and small potted green onion on left, window showing pale blue sky and simple distant city blocks in center, low bed with white sheets and muted blue-gray blanket on right. Flat hand-drawn 2D animation background, simple confident outlines, broad clean color shapes, only two-level cel shading, charming economical art direction, uncluttered composition with open central floor area for a chibi character overlay. Neutral daylight and accurate WHITE white balance, white walls, soft light-gray floor, cool pale blue window, blue-gray furniture, small natural green accents. Crisp and fresh, no yellow or orange tint, no cream/beige wall or sepia, no amber glow, no golden-hour light, no bloom, no cinematic haze, no painterly texture, no photorealistic detail. No characters, no text, no watermark.
```

## room-sage.png（0.4 使用中的背景）

1536 × 1024，以 `room-neutral.png` 為編輯目標，保留房間構圖及簡單線條，改成中性白牆、淺灰地板、極淡灰綠窗簾與床單。由內建 imagegen 編輯，非 CLI；原圖保留，未以程式套濾鏡。

最終提示詞：

```text
Use case: lighting-weather and precise palette edit. Edit target: supplied rented studio bedroom illustration. Preserve the exact room layout, furniture shapes, clean simple 2D cel-shaded linework, empty floor, and absence of characters/text. Replace the dominant BLUE upholstery, blue curtains, blue-gray chair and blue-tinted room shadows with neutral light GRAY and extremely subtle desaturated SAGE GRAY. The result should be predominantly clean neutral WHITE walls and white sheets, light neutral gray floor, soft gray curtains with just a hint of sage green, light sage-gray blanket, neutral charcoal desk chair. Green should be a small restrained accent, NOT a green color wash, NOT mint saturation. Outside the window retain natural pale sky blue but reduce saturation and brightness so it is a supporting background rather than the main color. Plants remain natural green. Neutral midday daylight and WHITE white balance; neutral shadows. Absolutely no orange, yellow, cream, amber, sepia, golden hour, yellow sunlight glow, no vintage filter. No overall blue filter and no overall green filter. Keep the illustration simple, crisp, cute and understated, harmonious with a mostly white user interface with tiny muted green accents. No new objects, no people, no text, no logos, no watermark. Landscape same composition.
```

## 動畫與聲音

- 角色浮動使用 CSS idleBob，尊重 prefers-reduced-motion。
- 卡車段落使用非暴力的畫面亮度閃光。
- 介面按鈕與成交音由 Web Audio 振盪器即時合成；與 BGM 共用音量與靜音設定，第一次互動後啟用。
- favicon.svg 是程式繪製的原創簡單韭菜／K 棒符號。

目前的角色表情是可用的原型素材；正式劇本若增加角色或動作，可沿用這套比例、線條、綠色領帶、圓眼鏡與韭菜髮夾設計。

0.2 版另加入四首自行編排、程式合成的循環 BGM，詳見 [AUDIO.md](AUDIO.md)。音檔、樂譜和離線渲染器均隨原始碼交付。

## v0.6 序章 CG

六張專屬 CG 已取代序章固定房間與表情貼圖。依頁面切換整張圖，使用中性白、灰與少量淡綠，完整提示詞及檔案見 [INTRO_CG.md](INTRO_CG.md)。卡車事故直接以無血腥漫畫撞擊呈現，取消舊版亮度閃光。

## v0.8 認真表情與支撐線

新增 assets/xiaojiu-serious.webp（1536 × 1024，透明背景），用於空手看跌及首頁「這次不一樣」。內建 imagegen 生成後只轉 WebP，角色設計沿用小韭；完整提示詞在 [THEATRE.md](THEATRE.md)。手指為原創 SVG；聚光、放大 K 棒、衝擊圈與文字為程式動畫。

0.8.2：新增 assets/support-hand.svg，原創程式向量，食指橫向伸出、其餘手指握拳，以白色袖口及灰綠細節配合小韭。接觸點與 K 棒共用座標錨點；放大比例依當日開盤到最低價計算，讓 0050 窄幅 K 棒也能準確托在手指上。秘技切入條、速度線、衝擊與支撐碎片由 CSS／Canvas 繪製。

## v0.8.3 Q 版裸手

assets/support-hand-chibi.webp 取代演出使用的 SVG 手部。內建 imagegen 生成並編輯為 Q 版、裸手、無衣袖，保留透明 RGBA，僅轉換為無損 WebP。詳細素材資訊與兩階段提示詞見 [HAND_ASSET.md](HAND_ASSET.md)。



