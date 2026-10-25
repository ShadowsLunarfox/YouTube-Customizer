// Single-video Premium campaigns have their own template, separate from image banners and shelves.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const wallpaper = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g"><stop stop-color="#070d31"/><stop offset="1" stop-color="#4a3485"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="430" cy="110" r="110" fill="#276aad" opacity=".5"/><text x="76" y="230" fill="white" font-size="72" font-family="Arial">A L W A Y S</text><text x="140" y="305" fill="white" font-size="62" font-family="Arial">L A L I S A</text></svg>');
const scope = 'class="style-scope ytd-brand-video-singleton-renderer"';
function card(modern, hidden = false) {
  const image = `<a class="ytLockupViewModelContentImage" data-video href="#trailer"><ytd-thumbnail><img src="${cover}" alt="Always Lalisa trailer"><span class="duration">1:20</span></ytd-thumbnail></a>`;
  const avatar = `<a class="avatar" href="#channel"><img src="${cover}" alt="LLOUD"></a>`;
  const text = '<h3><a id="video-title" href="#trailer">LISA - Always Lalisa (Official Trailer)</a></h3><p>LLOUD Official · and 2 more</p><p>15M views · 1 month ago</p>';
  const menu = '<button class="ytSpecButtonShapeNextHost more" aria-label="More video actions">⋮</button>';
  return modern
    ? `<yt-lockup-view-model data-card ${hidden ? 'hidden' : ''}><div class="ytLockupViewModelHost">${image}<yt-lockup-metadata-view-model class="ytLockupMetadataViewModelHost">${avatar}<div class="ytLockupMetadataViewModelTextContainer" data-text>${text}</div><div class="ytLockupMetadataViewModelMenuButton">${menu}</div></yt-lockup-metadata-view-model></div></yt-lockup-view-model>`
    : `<ytd-rich-grid-media data-card ${hidden ? 'hidden' : ''}><div id="dismissible" class="ytd-rich-grid-media">${image}<div id="details" class="ytd-rich-grid-media">${avatar}<div id="meta" data-text>${text}</div><div id="menu"><ytd-menu-renderer>${menu}</ytd-menu-renderer></div></div></div></ytd-rich-grid-media>`;
}
function fixture(modern) {
  // Native IDs, negative margins, scoped rules, and elements-per-row overrides
  // were inspected on youtube.com on 2026-10-25, including the reported XPath.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html{font-size:10px}body{margin:0;font:14px Arial;color:#eee} [hidden]{display:none!important}
    ytd-app,ytd-browse,ytd-rich-grid-renderer,ytd-button-renderer,ytd-menu-renderer,yt-formatted-string{display:block}
    ytd-rich-grid-renderer{box-sizing:border-box;padding:24px;--ytd-rich-grid-item-margin:16px;--ytd-rich-grid-items-per-row:3;--ytd-rich-grid-item-max-width:640px}
    #feed{display:flex;flex-wrap:wrap;width:100%}.video-row{width:100%;height:80px;background:#35444c}
    ytd-rich-section-renderer{display:flex;width:100%}ytd-rich-section-renderer>#content{width:100%;min-width:0}
    ytd-brand-video-singleton-renderer{display:block;--ytd-brand-video-item-width:calc(100%/var(--ytd-rich-grid-items-per-row) - var(--ytd-rich-grid-item-margin))}
    ytd-brand-video-singleton-renderer:not([is-dismissed]) #dismissed.ytd-brand-video-singleton-renderer,ytd-brand-video-singleton-renderer[is-dismissed] #dismissible.ytd-brand-video-singleton-renderer{display:none}
    ytd-brand-video-singleton-renderer:not([is-dismissed]) #dismissible.ytd-brand-video-singleton-renderer{position:relative;display:flex;flex-direction:column;align-items:center}
    ytd-brand-video-singleton-renderer[rounded-container]:not([is-first-feed-item]) #content-wrapper.ytd-brand-video-singleton-renderer{border-radius:8px;margin-inline:-8px;padding-inline:calc(var(--ytd-rich-grid-item-margin)/2);overflow:hidden}
    #content-wrapper.ytd-brand-video-singleton-renderer{padding:24px 0;align-items:center;display:flex;flex-direction:row;max-width:calc(var(--ytd-rich-grid-items-per-row)*(var(--ytd-rich-grid-item-max-width) + var(--ytd-rich-grid-item-margin)));width:calc(100% + var(--ytd-rich-grid-item-margin));margin-inline:calc(var(--ytd-rich-grid-item-margin)/-2);background:linear-gradient(#392512,#6d5034)}
    #thumbnail-container.ytd-brand-video-singleton-renderer{position:relative;flex-shrink:0;width:var(--ytd-brand-video-item-width);margin-inline:calc(var(--ytd-rich-grid-item-margin)/2);align-self:flex-start}
    #metadata-container.ytd-brand-video-singleton-renderer{align-items:center;display:flex;flex-direction:row;flex:1 1 auto}
    #metadata-text-container.ytd-brand-video-singleton-renderer{width:calc(100%/(var(--ytd-rich-grid-items-per-row) - 1)*2 - var(--ytd-rich-grid-item-margin));margin-left:calc(var(--ytd-rich-grid-item-margin)/2);margin-right:var(--ytd-rich-grid-item-margin);display:flex;flex-direction:column}
    #title-container.ytd-brand-video-singleton-renderer{font-size:32px;line-height:44px;font-weight:700}
    #featured-badge-container.ytd-brand-video-singleton-renderer{padding-top:2px;font-size:12px;line-height:18px}
    #subtitle-container.ytd-brand-video-singleton-renderer{margin-top:8px;font-size:18px;line-height:26px}
    #button-container.ytd-brand-video-singleton-renderer{margin-left:calc(var(--ytd-rich-grid-item-margin)/2)}
    #overflow-button.ytd-brand-video-singleton-renderer{position:absolute;top:16px;right:8px}
    #attached-survey.ytd-brand-video-singleton-renderer{min-width:var(--ytd-brand-video-item-width);align-self:flex-start}
    ytd-brand-video-singleton-renderer:is([elements-per-row="2"],[elements-per-row="3"]) #metadata-container.ytd-brand-video-singleton-renderer{align-items:flex-start;flex-direction:column}
    ytd-brand-video-singleton-renderer:is([elements-per-row="2"],[elements-per-row="3"]) #metadata-text-container.ytd-brand-video-singleton-renderer{width:auto}
    ytd-brand-video-singleton-renderer:is([elements-per-row="2"],[elements-per-row="3"]) #button-container.ytd-brand-video-singleton-renderer{margin-top:16px}
    ytd-brand-video-singleton-renderer[elements-per-row="1"] #metadata-container.ytd-brand-video-singleton-renderer{margin-inline:calc(var(--ytd-rich-grid-item-margin)/2);flex-direction:column}
    ytd-brand-video-singleton-renderer[elements-per-row="1"] #metadata-text-container.ytd-brand-video-singleton-renderer{margin-bottom:16px;width:auto;align-self:stretch}
    ytd-brand-video-singleton-renderer[elements-per-row="1"] #button-container.ytd-brand-video-singleton-renderer{margin-inline:calc(var(--ytd-rich-grid-item-margin)/2);margin-top:16px;align-self:stretch}
    .sr-only.ytd-brand-video-singleton-renderer{height:0;visibility:hidden;width:0}
    [data-card]{display:block;background:#252525} [data-card]>#dismissible{display:flex;flex-direction:column}
    yt-lockup-view-model{display:flex}.ytLockupViewModelHost{display:flex;flex-direction:column;flex:none;width:360px}
    .ytLockupViewModelContentImage,ytd-thumbnail{display:block;position:relative;width:100%}ytd-thumbnail{aspect-ratio:16/9;overflow:hidden;border-radius:8px}
    ytd-thumbnail img{display:block;width:100%;height:100%;object-fit:cover}.duration{position:absolute;right:4px;bottom:4px;padding:2px;background:#1119;font-size:12px}
    .ytLockupMetadataViewModelHost,#details{display:flex;position:relative;margin-top:12px;min-width:0}
    .avatar{flex:0 0 36px;width:36px;height:36px;margin-right:12px;border-radius:50%;overflow:hidden}.avatar img{width:100%;height:100%;object-fit:cover}
    .ytLockupMetadataViewModelTextContainer{display:flex;flex-direction:column;min-width:0}#meta{overflow-x:hidden;padding-right:24px}
    h3{font-size:16px;line-height:22px;margin:0;overflow-wrap:anywhere}p{font-size:12px;line-height:18px;margin:2px 0}a{color:inherit;text-decoration:none}
    .ytLockupMetadataViewModelMenuButton,#menu{position:absolute;top:4px;right:-12px}button{color:inherit;background:#333;border:0;cursor:pointer;padding:8px 12px;min-height:36px}
    .more{width:32px;height:32px;padding:0;font-size:24px}.campaign-overflow{width:32px;height:32px;padding:0}
    #menu-popup{display:none;position:fixed;inset:100px auto auto 30%;z-index:3000;padding:16px;background:#222}#menu-popup.open{display:block}
    #ordinary{display:block;width:100%;height:50px;border-radius:2px}
  </style></head><body><ytd-app><ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="feed">
    <div class="video-row" id="previous-video">Previous videos</div>
    <ytd-rich-section-renderer id="promo-section"><div id="content"><ytd-brand-video-singleton-renderer id="singleton" elements-per-row="3" title-size="TITLE_SIZE_MEDIUM" rounded-container>
      <div id="dismissible" ${scope}><div id="spatial-heading" class="sr-only ytd-brand-video-singleton-renderer">Premium featured video</div><div id="content-wrapper" ${scope}>
        <div id="thumbnail-container" ${scope}>${card(modern)}</div>
        <div id="metadata-container" ${scope}><div id="metadata-text-container" ${scope}>
          <div id="title-container" ${scope}><yt-formatted-string id="title">Get ready to watch Always Lalisa with Premium</yt-formatted-string></div>
          <div id="featured-badge-container" ${scope}>YouTube featured</div><div id="subtitle-container" ${scope}><yt-formatted-string id="subtitle">Stream ad-free when it drops</yt-formatted-string></div>
        </div><div id="metadata-video-container" ${scope} hidden>${card(modern, true)}</div><div id="button-container" ${scope}><div id="primary-button" ${scope}></div></div></div>
      </div><div id="overflow-button" ${scope}></div><div id="attached-survey" ${scope} hidden></div></div><div id="dismissed" ${scope}>Promotion dismissed</div>
    </ytd-brand-video-singleton-renderer></div></ytd-rich-section-renderer>
    <div class="video-row" id="following-video">Following videos</div><ytd-rich-shelf-renderer id="ordinary">Ordinary shelf</ytd-rich-shelf-renderer>
    </div></ytd-rich-grid-renderer></ytd-browse><ytd-popup-container><ytd-menu-popup-renderer id="menu-popup" role="menu"><button role="menuitem">Save video</button></ytd-menu-popup-renderer></ytd-popup-container></ytd-app>
    <script>document.addEventListener('click',event=>{if(event.target.closest('.more'))document.querySelector('#menu-popup').classList.add('open');if(event.target.closest('[data-video]'))document.body.dataset.videoClicked='yes';if(event.target.closest('#get-premium'))document.body.dataset.premiumClicked='yes';if(event.target.closest('.campaign-overflow'))document.querySelector('#singleton').setAttribute('is-dismissed','')});document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('#menu-popup').classList.remove('open')})</script>
  </body></html>`;
}
async function state(page) {
  return page.evaluate(() => {
    const host = document.querySelector('#singleton'), card = host.querySelector('[data-card]');
    const box = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height, padding:s.padding, radius:s.borderRadius, border:s.borderTopWidth, blur:s.backdropFilter, background:s.backgroundColor, image:s.backgroundImage }; };
    return { host:box(host), card:box(card), thumbnail:box(card.querySelector('ytd-thumbnail')), menu:box(card.querySelector('.more')), text:box(card.querySelector('[data-text]')),
      copy:box(host.querySelector('#metadata-text-container')), title:box(host.querySelector('#title-container')), previous:box(document.querySelector('#previous-video')), following:box(document.querySelector('#following-video')),
      wrappers:[...host.querySelectorAll('#content-wrapper,#metadata-container,#metadata-text-container,#thumbnail-container,#dismissible')].map(box),
      hidden:getComputedStyle(host.querySelector('#metadata-video-container')).display, overflow:document.documentElement.scrollWidth>innerWidth };
  });
}
function check(s, { padding=12, border=1, radius=16, spacing=16 }={}) {
  assert.equal(s.overflow, false, 'feed has no horizontal overflow');
  assert.equal(s.host.radius, radius+'px'); assert.equal(s.host.border, border+'px'); assert.equal(s.host.padding, padding+'px'); assert.equal(s.host.blur, 'blur(12px)');
  assert.equal(s.card.border, border+'px'); assert.equal(s.card.radius, radius+'px'); assert.equal(s.card.blur, 'none', 'card shares outer backdrop');
  assert.ok(Math.abs(s.host.y-s.previous.bottom-spacing)<.1, 'section reserves space above');
  assert.ok(Math.abs(s.following.y-s.host.bottom-spacing)<.1, 'section reserves space below');
  for (const item of [s.card,s.copy,s.title,s.menu]) {
    assert.ok(item.x>=s.host.x+padding+border-.1 && item.right<=s.host.right-padding-border+.1, 'content is inset horizontally');
    assert.ok(item.y>=s.host.y+padding+border-.1 && item.bottom<=s.host.bottom-padding-border+.1, 'content fits vertically');
  }
  assert.ok(s.thumbnail.x>s.card.x+8 && s.thumbnail.right<s.card.right-8, 'thumbnail has card padding');
  assert.ok(Math.abs(s.thumbnail.width/s.thumbnail.height-16/9)<.01, 'video aspect ratio is preserved');
  assert.ok(s.card.width<=380.1, 'video stays compact on wide screens');
  assert.ok(s.card.right<=s.copy.x+.1 || s.card.bottom<=s.copy.y+.1, 'video and copy do not overlap');
  assert.ok(s.text.right<=s.menu.x+.1, 'video menu has a separate column'); assert.ok(s.menu.width>=40 && s.menu.height>=40);
  assert.equal(s.hidden, 'none', 'native alternative video stays hidden');
  for(const wrapper of s.wrappers){ assert.equal(wrapper.background,'rgba(0, 0, 0, 0)');assert.equal(wrapper.image,'none');assert.equal(wrapper.blur,'none'); }
}
(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true, viewport:{width:1289,height:1000}, ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 90000), errors=[];
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:fixture(route.request().url().includes('modern'))}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    for(const modern of [false,true]){
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,backgroundMode:'color',surfaceColor:'#745532',pageColor:'#684722',uiOpacity:30,uiBlur:12,customizeCards:false,hideHomeFeatured:false,hideHomeSingleVideo:false}));
      await page.goto('https://www.youtube.com/?singleton='+(modern?'modern':'classic'));await page.waitForSelector('#yt-custom-progress-style',{state:'attached'});
      const original=await page.locator('#singleton').evaluate(el=>({style:el.getAttribute('style')||'',wrapper:el.querySelector('#content-wrapper').getAttribute('style')||'',padding:getComputedStyle(el.querySelector('#content-wrapper')).padding,radius:getComputedStyle(el).borderRadius}));
      assert.equal(await page.locator('#singleton').evaluate(el=>document.evaluate('./div[1]/div[2]',el,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue.id),'content-wrapper','fixture matches reported XPath');
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:true}));await page.waitForFunction(()=>document.querySelector('#singleton').hasAttribute('data-ytc-universal-glass'));
      for(const width of [1776,1289,1024,800,600,390,320]){
        await page.setViewportSize({width,height:1000});check(await state(page));
        if(width===390)assert.ok((await state(page)).copy.y>=(await state(page)).card.bottom,'small windows stack video and copy');
        await page.locator('.more:visible').click();await page.locator('#menu-popup.open').waitFor();await page.keyboard.press('Escape');
        await page.locator('[data-video]:visible').click();assert.equal(await page.locator('body').getAttribute('data-video-clicked'),'yes');
        if(process.env.YTC_SCREENSHOTS&&[1024,390].includes(width))await page.screenshot({path:path.join(os.tmpdir(),`ytc-singleton-${modern?'modern':'classic'}-${width}.png`),fullPage:true});
      }
      await page.setViewportSize({width:1024,height:1000});
      await page.locator('#singleton').evaluate(el=>el.setAttribute('elements-per-row','1'));check(await state(page));
      await page.locator('#singleton>#dismissible>#overflow-button').evaluate(el=>el.innerHTML='<button class="ytSpecButtonShapeNextHost campaign-overflow" aria-label="Dismiss promotion">×</button>');
      await page.waitForFunction(()=>document.querySelector('.campaign-overflow').hasAttribute('data-ytc-universal-glass'));check(await state(page));
      await page.locator('.campaign-overflow').click();assert.equal(await page.locator('#singleton>#dismissible').evaluate(el=>getComputedStyle(el).display),'none','native dismissal survives');
      await page.locator('#singleton').evaluate(el=>{el.removeAttribute('is-dismissed');el.querySelector('#overflow-button').replaceChildren();el.querySelector('#primary-button').innerHTML='<button id="get-premium" class="ytSpecButtonShapeNextHost">Get YouTube Premium</button>'});
      await page.waitForFunction(()=>document.querySelector('#get-premium').hasAttribute('data-ytc-universal-glass'));await page.locator('#get-premium').click();assert.equal(await page.locator('body').getAttribute('data-premium-clicked'),'yes');
      await popup.evaluate(async image=>{await chrome.storage.local.set({backgroundImageData:image});await chrome.storage.sync.set({backgroundMode:'image'});},wallpaper);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-home-glass'));check(await state(page));
      await popup.evaluate(()=>chrome.storage.sync.set({customizeCards:true,cardPadding:18,cardBorderWidth:3,cardRadius:24,cardGap:20,shelfSpacing:28}));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#singleton')).borderTopWidth==='3px');check(await state(page),{padding:18,border:3,radius:24,spacing:28});
      await popup.evaluate(()=>chrome.storage.sync.set({uiOpacity:0}));await page.waitForFunction(()=>getComputedStyle(document.querySelector('#singleton')).borderTopColor==='rgba(255, 255, 255, 0)');
      await popup.evaluate(()=>chrome.storage.sync.set({hideHomeSingleVideo:true}));await page.waitForFunction(()=>getComputedStyle(document.querySelector('#promo-section')).display==='none');
      assert.equal(await page.locator('#following-video').evaluate(el=>el.getBoundingClientRect().y-document.querySelector('#previous-video').getBoundingClientRect().bottom),0,'the single-video switch removes its section spacing');
      await popup.evaluate(()=>chrome.storage.sync.set({hideHomeSingleVideo:false}));await page.waitForFunction(()=>getComputedStyle(document.querySelector('#singleton')).display!=='none');
      check(await state(page),{padding:18,border:3,radius:24,spacing:28});
      await popup.evaluate(()=>chrome.storage.sync.set({hideHomeFeatured:true}));await page.waitForFunction(()=>getComputedStyle(document.querySelector('#promo-section')).display==='none');
      assert.equal(await page.locator('#following-video').evaluate(el=>el.getBoundingClientRect().y-document.querySelector('#previous-video').getBoundingClientRect().bottom),0,'hiding releases the whole section');
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,customizeCards:false,backgroundMode:'color'}));await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme'));
      assert.equal(await page.locator('#singleton').evaluate(el=>getComputedStyle(el).display),'none','hide toggle also works without a theme');
      await popup.evaluate(()=>chrome.storage.sync.set({hideHomeFeatured:false}));await page.waitForFunction(()=>getComputedStyle(document.querySelector('#singleton')).display!=='none');
      assert.deepEqual(await page.locator('#singleton').evaluate(el=>({style:el.getAttribute('style')||'',wrapper:el.querySelector('#content-wrapper').getAttribute('style')||'',padding:getComputedStyle(el.querySelector('#content-wrapper')).padding,radius:getComputedStyle(el).borderRadius})),original,'turning the theme off restores native styling');
      assert.equal(await page.locator('#ordinary').evaluate(el=>getComputedStyle(el).borderRadius),'2px','ordinary shelves are unchanged');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: single-video promo XPath, classic/modern card frames, inset thumbnail/copy/menu, responsive 1776–320px flow, reserved section spacing, single backdrop, dynamic CTA/dismiss controls, wallpaper, custom geometry, opacity, hide toggle and native restoration.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
