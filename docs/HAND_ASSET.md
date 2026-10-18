> 本專案使用 AI 輔助開發，包含程式、劇情及美術素材。
>
> 遊戲網址：請至你自己的 Repository → Settings → Pages 查看。

# 0.8.4 參考姿勢 Q 版手部素材

目前使用：`assets/support-hand-reference.webp`（1536 × 1024，RGBA）。使用內建 imagegen，第一張輸入為使用者提供的裸手姿勢參考，第二張為既有小韭表情圖的線條、比例與上色參考。食指微彎向左、其餘手指自然收攏，只有裸手與短手腕，沒有衣袖。生成後僅作無損 WebP 轉換，保留原生透明 alpha。動畫接觸點約 x=450、y=156。

## 0.8.4 最終提示詞

```text
Use case: style-transfer. Asset type: isolated transparent chibi hand sprite for the 2D game 台股戰士.
Reference image 1 is the user's requested POSE reference: one bare right hand seen from the side / slight three-quarter view, index points LEFT and is gently bent, thumb rests across the folded middle ring and little fingers, wrist enters lower right. Closely preserve this readable natural silhouette and the space below the index. Reference image 2 is STYLE ONLY: the actual Xiao Jiu chibi game's character sheet. Match those soft rounded shapes, dark brown clean outline and very simple flat cel shading.
Redraw only ONE isolated hand, cuter and a little plumper than reference 1, with shorter soft rounded digits, a small palm and a short bare wrist. Keep the index's upper edge gently rounded and almost horizontal so it can prop up a falling stock candlestick; do not create a long rigid straight sausage finger. Clear thumb attachment, correct five digit anatomy, three curled fingers tucked underneath, no extra fingers. Use very few small joint lines, no detailed skin folds, no veins, no realistic knuckles. Flat neutral light pink skin and just ONE restrained pink shadow tone, outline thickness like the chibi character. No glossy realistic rendering, no painterly gradients, no 3D.
Canvas landscape 3:2, whole hand fully visible with transparent padding; short bare wrist ends toward bottom right. Absolutely NO clothing, sleeve, cuff, glove or jewelry. No character, chart, candle, text, UI icons, watermarks, support line or light effects. Genuinely transparent background; no white backdrop, no checkerboard, no exterior shadow or colored halo. Neutral white balance, no orange/yellow color wash. Output only the new hand sprite.
```

## 0.8.3 歷史素材

最終檔案：assets/support-hand-chibi.webp（1536 × 1024，RGBA，保留透明背景）。使用內建 imagegen 生成姿勢參考稿，再用內建工具改為 Q 版、裸手與短手腕，移除衣袖。生成後只做無損 WebP 格式轉換，未以程式繪製或修改手部輪廓。

遊戲改用新圖；保留舊 SVG 作為版本素材紀錄。原畫接觸點約 x=350、y=182；動畫依此對齊 K 棒與手指，桌面與手機等比例縮放。事件選擇下方的額外說明文字已移除。

## 姿勢參考稿提示詞

```text
Use case: stylized-concept.
Asset type: one transparent hand illustration sprite for the cute Taiwanese stock-market game Taigu Warrior.
Primary request: redraw an anatomically convincing human hand in a horizontal supporting index-finger pose, suitable for a falling candlestick to rest on the upper edge of the extended index finger. One adult RIGHT hand and a short piece of forearm only. Index finger extends naturally STRAIGHT HORIZONTALLY TO THE LEFT. Hand/fist is on the right; wrist and forearm enter from the lower right. Side / slight three-quarter view so the upper edge of the index finger forms a clear nearly level support shelf. The middle, ring and little finger are naturally folded into the palm in a compact fist. Thumb is relaxed across the folded fingers, with a SHORT natural thumb silhouette and believable attachment near the wrist, not a second long protruding finger. Clear correct finger joints and knuckles, natural taper, a softly rounded index fingertip, realistic underlying hand proportions simplified for animation. Exactly five anatomical digits total, exactly one extended index, three curled fingers and one thumb; no extra knuckle bumps or fused shapes. No finger-gun thumb sticking up.
Style/medium: polished hand-drawn 2D anime game illustration, clean confident thin charcoal-brown outlines, restrained two-level cel shading, cute understated styling, NOT a crude vector icon, NOT a geometric mitten, NOT photorealistic. Neutral natural light skin, subtle pink shadows, neutral white balance, no yellow/orange color wash and no green color wash. White office-shirt cuff with a small muted sage button, consistent with an ordinary young office worker.
Composition/framing: landscape 3:2 canvas, whole hand fully visible with modest transparent margin around the index fingertip and above the hand. Finger points to the left in the upper-middle of the canvas, fist below and to the right, short shirt sleeve enters the lower-right corner. Make the index long enough to carry a candlestick visually but anatomically normal, not stretched or sausage-like. Do not draw a stock chart, candle, support line, light effects, character face, text, arrows or watermark. The output is JUST the isolated hand and cuff on a genuinely transparent background, preserve clean alpha edges.
```

## 最終 Q 版編輯提示詞

```text
Use case: style-transfer.
Asset type: transparent Q-version / chibi hand sprite for a cute 2D stock-market game.
Input image 1: edit target for POSE AND ANATOMY only. Redraw the hand in a visibly cute CHIBI cartoon style. Keep the index pointing horizontally LEFT and the fist/wrist on the RIGHT so a candlestick can rest on the flat upper edge of the index. Make the hand softer, rounder and cuter, with short plump fingers, simplified joints and charming clean outlines, matching a 2.3-head-tall anime chibi character. Preserve believable human hand structure: ONE extended index, three compact fingers folded naturally into the palm, and one small thumb resting across those curled fingers. Exactly five anatomical digits, no extra bumps, no fused mitten, no large sausage thumb. Natural index length relative to the fist, not stretched.
REMOVE ALL clothing: NO shirt cuff, NO sleeve, NO glove, NO buttons, NO accessories. Only the bare hand and a short cleanly cropped bare wrist. The wrist enters from the bottom-right, the hand stays wholly visible. Maintain a clear nearly level support shelf along the upper index edge, modest transparent margin above and around the fingertip. Landscape 3:2, hand fills most of canvas without being cut off except at the wrist edge.
Style: simple polished cute 2D anime game sprite, rounded dark charcoal outlines, flat light natural pink skin with ONE subtle shadow tone, no detailed veins/tendons/skin wrinkles, no realistic painting or 3D. Neutral white balance, no yellow/orange wash. Remove every exterior blurry glow and cast shadow: the outside of the crisp hand outline must be 100% TRANSPARENT, including around the index and between fingers; retain smooth alpha edges only at the outline. No background, no floor, no shadows outside the hand, no light rays, no chart, no candle, no support line, no letters or watermark.
```

