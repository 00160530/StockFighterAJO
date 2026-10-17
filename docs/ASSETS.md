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

## room-neutral.png（0.3 使用中的背景）

1536 × 1024，白牆、藍灰家具、自然日光的小租屋處。使用內建 imagegen 重新生成原創插畫，非 CLI。用於首頁和轉生序章；未對角色套用全畫面黃色或橘色濾鏡。

最終提示詞：

```text
Use case: illustration-story. Asset: background illustration for a cute Taiwanese stock trading text adventure, landscape 3:2. A modest tidy Taipei rented studio bedroom belonging to a young office worker, simple desk with closed notebook and small potted green onion on left, window showing pale blue sky and simple distant city blocks in center, low bed with white sheets and muted blue-gray blanket on right. Flat hand-drawn 2D animation background, simple confident outlines, broad clean color shapes, only two-level cel shading, charming economical art direction, uncluttered composition with open central floor area for a chibi character overlay. Neutral daylight and accurate WHITE white balance, white walls, soft light-gray floor, cool pale blue window, blue-gray furniture, small natural green accents. Crisp and fresh, no yellow or orange tint, no cream/beige wall or sepia, no amber glow, no golden-hour light, no bloom, no cinematic haze, no painterly texture, no photorealistic detail. No characters, no text, no watermark.
```

## 動畫與聲音

- 角色浮動使用 CSS idleBob，尊重 prefers-reduced-motion。
- 卡車段落使用非暴力的畫面亮度閃光。
- 介面按鈕與成交音由 Web Audio 振盪器即時合成；與 BGM 共用音量與靜音設定，第一次互動後啟用。
- favicon.svg 是程式繪製的原創簡單韭菜／K 棒符號。

目前的角色表情是可用的原型素材；正式劇本若增加角色或動作，可沿用這套比例、線條、綠色領帶、圓眼鏡與韭菜髮夾設計。

0.2 版另加入四首自行編排、程式合成的循環 BGM，詳見 [AUDIO.md](AUDIO.md)。音檔、樂譜和離線渲染器均隨原始碼交付。
