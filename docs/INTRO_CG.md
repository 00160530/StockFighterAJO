> 本專案使用 AI 輔助開發，包含程式、劇情及美術素材。
>
> 遊戲網址：請至你自己的 Repository → Settings → Pages 查看。

# 序章專屬 CG 與最終提示詞（v0.6）

使用內建 image_gen 工具，沒有 CLI 或外部 API 金鑰。六張皆為原創小韭場景；參考現有小韭表情素材維持角色身分、room-sage.png 維持中性白與淡灰綠色調。原始 PNG 1536×1024，遊戲交付 WebP 僅做格式壓縮，未調色或裁切。每頁依故事切換整張 CG；日期和重點字幕以 HTML 顯示，避免圖片日期辨識錯誤。

| 檔案 | 故事畫面 |
| --- | --- |
| assets/intro/cg-01.webp | 聽明牌、工作看盤疲倦 |
| assets/intro/cg-02.webp | AI 獲利、誤以為可以離職 |
| assets/intro/cg-03.webp | 卡車實際撞上小韭，漫畫式無血腥呈現 |
| assets/intro/cg-04.webp | 時鐘倒轉，從 2026 回到 2020 |
| assets/intro/cg-05.webp | 在舊租屋處驚醒、確認日期與本金 |
| assets/intro/cg-06.webp | 對決只買 0050 的平行人生自己 |

## CG 01 最終提示詞

```text
Use case: illustration-story. Asset: original visual novel prologue CG 01, landscape 3:2. Reference image 1 is CHARACTER IDENTITY AND CUTE CHIBI STYLE ONLY: Xiao Jiu, adult Taiwanese office worker, 2.3 heads tall, messy dark brown hair, round glasses, green onion hairclip, white shirt, muted sage tie, charcoal trousers, small beige crossbody bag. Reference 2 is palette and restrained simple environment style only. Draw an ORIGINAL single scene, not a sheet, no repeated sprites. He sits slumped at a cramped ordinary office desk, chin on hand, exhausted half-lidded expression; phone in the other hand is swarming with several simple anonymous group-chat bubbles with just stock arrow icons, while a small monitor has a declining stylized stock graph. Unopened lunch and work paperwork show he is still a salaryman. Clear visual story: followed stock tips for years, missing profits, still stuck at work. Waist-up medium wide composition with face and screen readable at thumbnail size. Draw all character and props together in the scene, no floating pasted sticker. Clean cute 2D anime chibi, thick smooth outlines, simple flat color shapes and two-tone cel shading, minimal background. Predominantly neutral white and gray with a LITTLE muted sage green and small muted red stock accents. Neutral daylight and white balance. No orange/yellow tint, no sepia, no cream wash, no blue wash, no green wash, no painterly glow. No words, letters, captions, logos, watermarks, panels or borders. Keep essential face/props inside central 80%.
```

## CG 02—06 共用提示詞

每張使用「共用提示詞 + 對應場景提示詞」各別呼叫內建工具。

```text
Use case: illustration-story. Asset: dedicated original visual novel prologue CG, single landscape 3:2 scene. Reference 1 is CHARACTER IDENTITY ONLY: Xiao Jiu, cute adult Taiwanese salaryman with tiny 2.3-head chibi proportions, messy dark desaturated brown hair, small green onion hairclip, thin round glasses, simple large dark green eyes, off-white office shirt, muted sage tie, charcoal trousers, small beige crossbody bag. Reference 2 is restrained simple rental-room/palette reference. Match original character identity, not collage or sprite sheet. Clean cute 2D anime chibi with thick smooth outlines, flat color shapes, minimal TWO LEVEL cel shading, economical uncluttered illustration background. Predominantly neutral white, light gray, charcoal and SMALL restrained sage accents. Accurate neutral white balance. No orange/yellow/cream tint, no sepia, no cinematic golden glow, no saturated blue wash, no green wash, no painterly texture. No words, letters, numerals, captions, logos, watermarks, panels or borders. Compose important subjects inside central 80%. 
```

## CG 02 場景提示詞

```text
Scene 02: A lucky AI stock rally. Medium wide shot on a Taipei sidewalk by a zebra crossing. Xiao Jiu is still in ordinary office clothes with his work bag, clutching a phone displaying a simple rising RED Taiwan stock chart, cheering with starry delighted eyes and an absurd daydream of himself reclining under a tiny parasol in a SMALL cloud above him. The cloud is a drawn fantasy thought bubble, clearly distinct from reality. His cheap work badge and ordinary clothes remain visible: a small profit made him imagine freedom, he is not rich. Clear action and readable silhouette. One traffic signal and simple gray building blocks only. Cute humorous, clean neutral daylight, not a yellow sunset. Do not put a truck in this scene.
```

## CG 03 場景提示詞

```text
Scene 03: The actual truck accident, visibly unmistakable, comic non-graphic cartoon. Dynamic wide diagonal view at a Taiwan zebra crossing. A small white cab-over delivery TRUCK enters from left; its front bumper makes contact with Xiao Jiu's work bag/hip at center, a big sharp WHITE outlined comic impact burst marks that contact. Xiao Jiu has been knocked airborne toward right, arms and legs splayed, shocked blank circular eyes behind glasses, his phone and bag flying separately; phone shows tiny RED rising chart. A red pedestrian signal behind. Clear cause and effect: he was hit by truck while watching phone, not a near miss or simply seeing a truck. Simple graphic motion lines, broad gray asphalt and WHITE crosswalk stripes. No blood, no gore, no wounds, no realistic suffering, no dead body. Original cute chibi slapstick, neutral white gray slight sage, no orange explosion.
```

## CG 04 場景提示詞

```text
Scene 04: Reincarnation and TIME RUNNING BACKWARD, a distinct surreal transition, not another room scene. Xiao Jiu floats curled in surprise in a clean WHITE void, still wearing his office clothes, hairclip, round glasses and loose sage tie. His phone, work bag, many blank calendar sheets and a simple analog CLOCK swirl around him in a broad subtle sage-gray spiral. Oversized clock hands clearly pointing counterclockwise with a curved return-arrow motif. Tiny receding outline of truck at far left fades away while simple doorway silhouette of his bedroom appears on right. Convey passage from accident into a past life, cute astonished expression and readable large shapes. No halo, wings or religious deity, no sparkly yellow glow, no cyan vortex. No text on calendars because dates will be added in HTML.
```

## CG 05 場景提示詞

```text
Scene 05: waking up back in January 2020 in the modest rented room from reference 2. Xiao Jiu jolts upright on the simple bed on RIGHT, hair messy, round glasses slightly crooked, white office shirt collar unbuttoned, sage tie loosened. He stares wide-eyed at an older simple black smartphone held close in front of him; enlarged screen faces viewer, blank WHITE screen with only a small green calendar icon, leave clean space for HTML date. On LEFT desk a small closed laptop, plain bank passbook and a cheap stack of five notebooks hint at his five years of saved wages. Tiny green onion pot. Face and phone are primary subjects large, background extremely simple. Bright neutral WHITE January morning, soft gray/sage bedding, no orange sunshine, no blue color cast. Clear story: shocked to discover he woke up in his old bedroom.
```

## CG 06 場景提示詞

```text
Scene 06: choosing a second chance and accepting the benchmark challenge. Same bedroom desk and ORIGINAL chibi Xiao Jiu, now determined but cute, seated centrally leaning forward toward an open laptop, rolling up one short sleeve with a modest resolute smile, glasses straight, sage tie and onion hairclip. On desk a simple notebook checklist and plain bank passbook; in the laptop display TWO separated clean stock performance lines, muted sage and muted purple, beginning at the exact same start point and diverging. A small subtle SEMITRANSPARENT gray silhouette of the SAME chibi self stands on the opposite side of desk, calmly holding a plain ETF notebook, representing the parallel 0050 self. No confrontation/weapons/magic powers. Composition tells 'can I beat the passive version of myself this time?' This is a single intimate room CG, not UI screenshot, no charts covering the artwork. All important faces visible, neutral white and light gray with a little sage green.
```
