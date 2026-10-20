(() => {
 const list=document.getElementById('unreleased-list');
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 const link=(label,url,download=false)=>{const a=make('a','',label);a.href=url;if(download)a.download='';else{a.target='_blank';a.rel='noopener';}return a;};
 const art=(url,title,alt)=>{const b=make('button','art-button checker');b.type='button';b.dataset.src=url;b.dataset.title=title;b.setAttribute('aria-label','放大：'+title);const im=make('img');im.src=url;im.alt=alt||title;im.loading='lazy';b.append(im);return b;};
 for(const item of window.TAIGU_UNRELEASED_ART.items){
  const card=make('article','art-section unreleased-card');card.id=item.id;
  const head=make('header','section-heading');head.append(make('h2','',item.title));head.append(make('span','status',item.status==='approved_unreleased'?'已確認 · 未上架':'未上架'));card.append(head,make('p','intro',item.description));
  if(item.images?.length){
   const grid=make('div','comparison unreleased-illustrations');
   for(const entry of item.images){
    const figure=make('figure','figure');
    const caption=make('figcaption');caption.append(make('strong','',entry.label),link('開啟原圖 ↗',entry.url),link('下載原圖',entry.url,true));
    const button=art(entry.url,item.title+' · '+entry.label,entry.alt);
    const thumbnail=button.querySelector('img');thumbnail.decoding='async';thumbnail.style.height='auto';if(entry.width)thumbnail.width=entry.width;if(entry.height)thumbnail.height=entry.height;
    figure.append(caption,button);grid.append(figure);
   }
   card.append(grid);
   const actions=make('div','unreleased-actions');if(item.bundle)actions.append(link(item.bundleLabel||'下載本組原圖',item.bundle,true));if(item.manifest)actions.append(link('素材檔案清單',item.manifest));card.append(actions,make('p','unreleased-note',item.note||'尚未套用遊戲'));list.append(card);continue;
  }
  const image=make('img','unreleased-preview');image.src=item.preview;image.alt=item.alt||item.title;image.loading='lazy';card.append(image);
  const actions=make('div','unreleased-actions');
  const replay=make('button','','重新播放');replay.type='button';replay.onclick=()=>image.src=item.preview+'?r='+Date.now();
  const still=make('button','',item.stillLabel||'定格查看動作');still.type='button';still.onclick=()=>image.src=item.still;
  if(item.animated)actions.append(replay);if(item.still)actions.append(still);if(item.bundle)actions.append(link('下載原圖與動畫完整包',item.bundle,true));
  for(const d of item.downloads||[])actions.append(link(d.label,d.url,true));
  if(item.comparison)actions.append(link(item.comparisonLabel||'查看動作對照',item.comparison));
  card.append(actions,make('p','unreleased-note',item.note||'尚未套用遊戲'));
  const details=make('details');details.append(make('summary','','個別角色動畫與原始圖集'));
  const comparison=make('div','comparison');
  for(const c of item.characters||[]){
   const figure=make('figure','figure unreleased-character');figure.append(make('figcaption','',c.name));figure.append(art(c.preview,c.name+' · 跳舞動畫'));
   const links=make('div','unreleased-actions');links.append(link('透明 GIF',c.gif,true),link('透明 WebP',c.webp,true),link('查看 35 格動作',c.contact));figure.append(links);
   const atlas=make('div','unreleased-actions');for(const a of c.atlases)atlas.append(link(a.label,a.url));figure.append(atlas);comparison.append(figure);
  }
  details.append(comparison);if(item.characters?.length)card.append(details);
  if(item.manifest){const foot=make('div','unreleased-actions');foot.append(link('素材檔案清單',item.manifest));card.append(foot);}list.append(card);
 }
})();
