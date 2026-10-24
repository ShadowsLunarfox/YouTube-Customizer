// Premium image campaigns use statement banners, not brand-video shelves.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const wallpaper = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#244f78"/><circle cx="160" cy="180" r="100" fill="#debb62"/><text x="290" y="190" fill="white" font-size="40" font-family="Arial">Premium</text></svg>');
const scope = 'class="style-scope ytd-statement-banner-renderer"';
function promo(slotZero = false) {
  return `<ytd-statement-banner-renderer id="premium" elements-per-row="3" has-tile use-bigger-showcase-image ${slotZero ? 'location="slot-zero-home"' : ''}>
    <div id="dismissible" ${scope}><div id="statement-banner-content" ${scope}>
      <div id="background-content" ${scope} style="background:linear-gradient(#264861,#cda64e)"></div>
      <div id="foreground-content" ${scope}>
        <div class="showcase-image style-scope ytd-statement-banner-renderer"><div id="tile-container" ${scope}><div id="tile-image-view-model" ${scope} hidden></div><yt-img-shadow id="tile-image" ${scope} object-fit="CONTAIN"><img src="${cover}" alt="Premium offline viewing"></yt-img-shadow></div></div>
        <div class="showcase-image style-scope ytd-statement-banner-renderer" id="logo-container" hidden><div id="logo-wrapper"><img alt="Hidden logo"></div></div>
        <div id="details-container" ${scope}><div id="text-container" ${scope}>
          <h3 id="dynamic-title" ${scope}><div><yt-dynamic-sizing-formatted-string max-height="110" max-lines="2" min-font-size="20"><div id="container" style="max-height:110px"><yt-formatted-string id="text" style="font-size:36px;line-height:50px">Lag-proof your viewing experience with Premium</yt-formatted-string></div></yt-dynamic-sizing-formatted-string></div></h3>
          <div id="badge-view-model-container" ${scope}><div id="additional-badge-view-model" ${scope}></div><div id="badge-view-model" ${scope}>YouTube featured</div></div>
          <div id="subtitle-container" ${scope}><yt-formatted-string id="subtitle" ${scope}>Don’t let a bad connection end your streak. Watch downloaded gaming videos offline.</yt-formatted-string></div>
          <div id="supplemental-text-container" ${scope}><yt-formatted-string id="supplemental-text" ${scope}>Terms apply. Cancel anytime.</yt-formatted-string></div>
        </div><div id="button-container" ${scope}><div id="button-wrapper" ${scope}><div id="secondary-button" ${scope} hidden></div><div id="primary-button" ${scope}><ytd-button-renderer><button class="ytSpecButtonShapeNextHost" id="get-premium">Get YouTube Premium</button></ytd-button-renderer></div></div></div></div>
        <div id="dismiss-button" ${scope}></div><div id="overflow-button" ${scope}></div>
      </div></div><div id="attached-survey" ${scope} hidden></div></div><div id="dismissed" ${scope}>Promotion dismissed</div>
  </ytd-statement-banner-renderer>`;
}
function fixture(slotZero) {
  // The hierarchy, classes, widths, negative margins, and column overrides below
  // follow the public native template/CSSOM inspected on 2026-10-25.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html{font-size:10px} body{margin:0;font:14px Arial;color:#eee} [hidden]{display:none!important}
    ytd-app,ytd-browse,ytd-rich-grid-renderer,ytd-button-renderer,yt-formatted-string{display:block}
    ytd-rich-grid-renderer{box-sizing:border-box;width:100%;padding:24px;--ytd-rich-grid-item-margin:16px;--ytd-rich-grid-items-per-row:3;--ytd-rich-grid-item-max-width:640px}
    #feed{display:flex;flex-wrap:wrap;width:100%} .video-row{width:100%;height:80px;background:#35444c}
    ytd-rich-section-renderer{width:100%;display:flex;justify-content:center} ytd-rich-section-renderer>#content{width:100%;min-width:0}
    ytd-statement-banner-renderer{--ytd-statement-banner-thumbnail-width:calc((100% + var(--ytd-rich-grid-item-margin))/var(--ytd-rich-grid-items-per-row) - var(--ytd-rich-grid-item-margin));display:block}
    ytd-statement-banner-renderer:not([is-dismissed]) #dismissed.ytd-statement-banner-renderer,ytd-statement-banner-renderer[is-dismissed] #dismissible.ytd-statement-banner-renderer{display:none}
    #dismissible.ytd-statement-banner-renderer{display:flex;flex-direction:column}
    #statement-banner-content.ytd-statement-banner-renderer{border-radius:12px;overflow:hidden;position:relative}
    #background-content.ytd-statement-banner-renderer{background-position:0 center;background-size:cover;height:100%;position:absolute;width:100%}
    ytd-statement-banner-renderer:not([location="slot-zero-home"]):not([banner-style="statement-banner-style-type-compact"]){margin-left:-16px;margin-right:-16px}
    ytd-statement-banner-renderer:not([location="slot-zero-home"]):not([banner-style="statement-banner-style-type-compact"]) #foreground-content.ytd-statement-banner-renderer{padding:16px}
    ytd-statement-banner-renderer:not([location="slot-zero-home"]) .showcase-image.ytd-statement-banner-renderer{align-self:flex-start}
    #foreground-content.ytd-statement-banner-renderer{position:relative;align-items:center;display:flex;flex-direction:row}
    .showcase-image.ytd-statement-banner-renderer{width:var(--ytd-statement-banner-thumbnail-width);flex-shrink:0;height:auto;position:relative;padding-bottom:calc(var(--ytd-statement-banner-thumbnail-width)*9/16)}
    #tile-image.ytd-statement-banner-renderer{width:100%;height:100%;display:block} #tile-image img{width:100%;height:100%;object-fit:contain;display:block}
    #tile-container.ytd-statement-banner-renderer{border-radius:8px;overflow:hidden;position:absolute;inset:0;width:100%;height:100%;cursor:pointer;align-self:center}
    #logo-container.ytd-statement-banner-renderer{justify-content:center;display:flex;flex-direction:column}
    #details-container.ytd-statement-banner-renderer{padding:16px 16px 16px var(--ytd-rich-grid-item-margin);flex:1 1 0%;display:flex;flex-direction:column;justify-content:center}
    #text-container.ytd-statement-banner-renderer{width:calc(100%/(var(--ytd-rich-grid-items-per-row) - 1)*2);max-width:calc(100%/(var(--ytd-rich-grid-items-per-row) - 1)*2);padding-right:var(--ytd-rich-grid-item-margin);margin-bottom:8px}
    #button-container.ytd-statement-banner-renderer{display:flex;flex-direction:row} #button-wrapper.ytd-statement-banner-renderer{display:flex;flex-flow:wrap;align-self:center}
    #dynamic-title.ytd-statement-banner-renderer{cursor:pointer;color:#eee;margin:0;font-size:36px;line-height:50px}
    #subtitle-container.ytd-statement-banner-renderer{color:#eee;font-size:18px;line-height:26px}
    #supplemental-text-container.ytd-statement-banner-renderer{color:#bbb;margin-top:8px;font-size:10px;line-height:16px}
    #badge-view-model-container.ytd-statement-banner-renderer{display:flex;flex-direction:row;margin-bottom:8px;font-size:12px;line-height:18px}
    #primary-button.ytd-statement-banner-renderer,#secondary-button.ytd-statement-banner-renderer{margin-block:6px}
    #dismiss-button.ytd-statement-banner-renderer,#overflow-button.ytd-statement-banner-renderer{border-radius:50%;position:absolute;top:8px;right:8px;z-index:1}
    #attached-survey.ytd-statement-banner-renderer{min-width:var(--ytd-statement-banner-thumbnail-width);align-self:flex-start}
    ytd-statement-banner-renderer[elements-per-row="1"] #foreground-content.ytd-statement-banner-renderer{display:flex;flex-direction:column}
    ytd-statement-banner-renderer[elements-per-row="1"] #details-container.ytd-statement-banner-renderer{padding-top:40px;padding-inline:12px;align-self:flex-start}
    ytd-statement-banner-renderer[elements-per-row="1"][has-tile] #details-container.ytd-statement-banner-renderer{margin:16px 0 8px;padding-top:0}
    ytd-statement-banner-renderer[location="slot-zero-home"]{margin-inline:24px;display:flex;flex-direction:row;justify-content:center}
    ytd-statement-banner-renderer[location="slot-zero-home"] #dismissible.ytd-statement-banner-renderer{width:calc(var(--ytd-rich-grid-items-per-row)*(var(--ytd-rich-grid-item-max-width) + var(--ytd-rich-grid-item-margin)) - var(--ytd-rich-grid-item-margin))}
    @media(max-width:346px){#foreground-content.ytd-statement-banner-renderer{width:calc(100% + 16px);margin-inline:-8px}}
    button{color:inherit;cursor:pointer;background:#333;border:0;border-radius:999px;min-height:36px;padding:8px 12px;font:500 12px Arial}
    #ordinary{display:block;width:100%;height:50px;padding:3px;border-radius:2px}
  </style></head><body><ytd-app><ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="feed">
    <div id="previous-video" class="video-row">Previous videos</div>
    ${slotZero ? promo(true) : `<ytd-rich-section-renderer id="promo-section"><div id="content">${promo()}</div></ytd-rich-section-renderer>`}
    <div id="following-video" class="video-row">Following videos</div><ytd-rich-shelf-renderer id="ordinary">Ordinary shelf</ytd-rich-shelf-renderer>
  </div></ytd-rich-grid-renderer></ytd-browse></ytd-app><script>
    document.querySelector('#get-premium').addEventListener('click',()=>document.body.dataset.premiumClicked='yes');
    document.querySelector('#tile-container').addEventListener('click',()=>document.body.dataset.artClicked='yes');
    document.querySelector('#dismiss-button').addEventListener('click',()=>document.querySelector('#premium').setAttribute('is-dismissed',''));
  </script></body></html>`;
}
async function state(page) {
  return page.evaluate(() => {
    const host = document.querySelector('#premium');
    const box = el => {const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,radius:s.borderRadius,border:s.borderTopWidth,padding:s.padding,background:s.backgroundColor,image:s.backgroundImage,blur:s.backdropFilter}};
    return {host:box(host),previous:box(document.querySelector('#previous-video')),following:box(document.querySelector('#following-video')),
      artwork:box(host.querySelector('.showcase-image:not([hidden])')),tile:box(host.querySelector('#tile-container')),details:box(host.querySelector('#details-container')),
      title:box(host.querySelector('#dynamic-title')),button:box(host.querySelector('#get-premium')),terms:box(host.querySelector('#supplemental-text-container')),
      wrappers:[...host.querySelectorAll('#dismissible,#statement-banner-content,#foreground-content,#background-content,#details-container,#text-container,#button-container,#button-wrapper')].map(box),
      fontSize:parseFloat(getComputedStyle(host.querySelector('#text')).fontSize),overflow:document.documentElement.scrollWidth>innerWidth,
      hiddenLogo:getComputedStyle(host.querySelector('#logo-container')).display};
  });
}
function check(s, {padding=12,border=1,radius=16,spacing=16}={}) {
  assert.equal(s.overflow,false,'no horizontal overflow');
  assert.equal(s.host.radius,`${radius}px`);assert.equal(s.host.border,`${border}px`);assert.equal(s.host.padding,`${padding}px`);assert.equal(s.host.blur,'blur(12px)');
  assert.ok(Math.abs(s.host.y-s.previous.bottom-spacing)<.1,'space reserved above promo');
  assert.ok(Math.abs(s.following.y-s.host.bottom-spacing)<.1,'space reserved below promo');
  for(const item of [s.artwork,s.details,s.button,s.title,s.terms]){
    assert.ok(item.x>=s.host.x+padding+border-.1&&item.right<=s.host.right-padding-border+.1,'content is horizontally inset');
    assert.ok(item.y>=s.host.y+padding+border-.1&&item.bottom<=s.host.bottom-padding-border+.1,'content stays inside frame');
  }
  assert.ok(Math.abs(s.artwork.width/s.artwork.height-16/9)<.01,'artwork ratio preserved');
  assert.ok(s.artwork.width<=380.1,'promo art stays compact on large windows');
  assert.ok(s.artwork.right<=s.details.x+.1||s.artwork.bottom<=s.details.y+.1,'image and copy never overlap');
  assert.ok(s.fontSize>=20&&s.fontSize<=28,'heading matches card scale');
  assert.ok(s.button.height>=32,'CTA remains usable');assert.equal(s.hiddenLogo,'none');
  for(const wrapper of s.wrappers){assert.equal(wrapper.background,'rgba(0, 0, 0, 0)');assert.equal(wrapper.image,'none');assert.equal(wrapper.blur,'none','one outer backdrop');}
}
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1289,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),90000);
  try{
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(route.request().url().includes('slot-zero'))}));
    const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const slotZero of [false,true]){
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,backgroundMode:'color',surfaceColor:'#745532',pageColor:'#684722',uiOpacity:30,uiBlur:12,customizeCards:false,hideHomeFeatured:false}));
      await page.goto('https://www.youtube.com/?promo='+(slotZero?'slot-zero':'feed'));
      await page.waitForFunction(()=>document.querySelector('#yt-custom-progress-style'));
      const original=await page.locator('#premium').evaluate(el=>({style:el.getAttribute('style')||'',radius:getComputedStyle(el).borderRadius,background:el.querySelector('#background-content').style.background,padding:getComputedStyle(el.querySelector('#foreground-content')).padding}));
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:true}));
      await page.waitForFunction(()=>document.querySelector('#premium').hasAttribute('data-ytc-universal-glass'));
      for(const width of [1776,1289,800,600,390,320]){
        await page.setViewportSize({width,height:1000});check(await state(page));
        if(width===390)assert.ok((await state(page)).details.y>=(await state(page)).artwork.bottom,'narrow windows stack content');
        await page.locator('#get-premium').click();assert.equal(await page.locator('body').getAttribute('data-premium-clicked'),'yes');
        await page.locator('#tile-container').click();assert.equal(await page.locator('body').getAttribute('data-art-clicked'),'yes');
        if(process.env.YTC_SCREENSHOTS&&[1289,390].includes(width))await page.screenshot({path:path.join(os.tmpdir(),`ytc-premium-${slotZero?'slot-zero':'feed'}-${width}.png`),fullPage:true});
      }
      await page.setViewportSize({width:1289,height:1000});
      await page.locator('#premium').evaluate(el=>el.setAttribute('elements-per-row','1'));check(await state(page));
      await page.locator('#dismiss-button').evaluate(el=>el.innerHTML='<button aria-label="Dismiss Premium" class="ytSpecButtonShapeNextHost">×</button>');
      await page.waitForFunction(()=>document.querySelector('#dismiss-button button').hasAttribute('data-ytc-universal-glass'));
      check(await state(page));await page.locator('#dismiss-button button').click();
      assert.equal(await page.locator('#premium>#dismissible').evaluate(el=>getComputedStyle(el).display),'none','native dismissal is preserved');
      await page.locator('#premium').evaluate(el=>el.removeAttribute('is-dismissed'));
      await page.locator('#dismiss-button').evaluate(el=>el.replaceChildren());
      await popup.evaluate(async image=>{await chrome.storage.local.set({backgroundImageData:image});await chrome.storage.sync.set({backgroundMode:'image'});},wallpaper);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-home-glass'));check(await state(page));
      await popup.evaluate(()=>chrome.storage.sync.set({customizeCards:true,cardPadding:18,cardBorderWidth:3,cardRadius:24,cardGap:20,shelfSpacing:28}));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#premium')).borderTopWidth==='3px');check(await state(page),{padding:18,border:3,radius:24,spacing:28});
      await popup.evaluate(()=>chrome.storage.sync.set({hideHomeFeatured:true}));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#premium')).display==='none');
      if(!slotZero)assert.equal(await page.locator('#promo-section').evaluate(el=>getComputedStyle(el).display),'none','hidden parent releases its reserved space');
      assert.equal(await page.locator('#following-video').evaluate(el=>el.getBoundingClientRect().y-document.querySelector('#previous-video').getBoundingClientRect().bottom),0,'hidden promo leaves no empty feed space');
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,customizeCards:false,backgroundMode:'color'}));
      await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme'));
      assert.equal(await page.locator('#premium').evaluate(el=>getComputedStyle(el).display),'none','hide promo works with theme disabled');
      await popup.evaluate(()=>chrome.storage.sync.set({hideHomeFeatured:false}));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#premium')).display!=='none');
      assert.deepEqual(await page.locator('#premium').evaluate(el=>({style:el.getAttribute('style')||'',radius:getComputedStyle(el).borderRadius,background:el.querySelector('#background-content').style.background,padding:getComputedStyle(el.querySelector('#foreground-content')).padding})),original,'theme off restores native styling');
      assert.equal(await page.locator('#ordinary').evaluate(el=>getComputedStyle(el).borderRadius),'2px','ordinary shelves are unaffected');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: Premium statement banner frame, inset copy/art, reserved feed spacing, responsive layout at 1776/1289/800/600/390/320px, slot-zero placement, CTA/art/dismiss controls, dynamic buttons, single backdrop, wallpaper, custom layout, hide toggle with/without theme, and restoration.');
  }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
