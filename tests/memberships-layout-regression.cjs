// Checks real browser geometry for the classic and modern Home memberships cards.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const wallpaper = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
function card(index, modern) {
  const title = ["Turkey March NM NO BAR - Pump It Up Phoenix 2", "Ugly Dee D18: No Bar No Cheat Legs", "Vacuum D25 with Cheat Rail", "Final Step!"][index % 4];
  const cover = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${["#724a2b", "#287d9a", "#237834", "#9030aa"][index % 4]}"/><circle cx="460" cy="130" r="110" fill="white" opacity=".1"/><text x="32" y="188" fill="white" font-size="64" font-family="Arial">${["TURKEY MARCH", "Ugly Dee", "PUMP IT UP", "FINAL STEP"][index % 4]}</text></svg>`);
  const thumbnail = `<a class="ytLockupViewModelContentImage" href="#video-${index}"><yt-thumbnail-view-model><img class="cover" src="${cover}" alt="${title}"></yt-thumbnail-view-model></a>`;
  const avatar = `<a class="avatar" href="#channel-${index}" aria-label="Channel ${index}"><img src="${cover}" alt="Channel logo"></a>`;
  const text = `<h3 class="ytLockupMetadataViewModelTitle">${title}</h3><p>Channel ${index} · 1 day ago</p><span class="members-badge">⊕ Members only</span>`;
  const button = `<button class="ytSpecButtonShapeNextHost more" aria-label="More actions for video ${index}">⋮</button>`;
  const classicMenu = `<ytd-menu-renderer>${button}</ytd-menu-renderer>`;
  const inner = modern
    ? `<yt-lockup-view-model class="ytLockupViewModelHost ytLockupViewModelVertical">${thumbnail}<yt-lockup-metadata-view-model class="ytLockupMetadataViewModelHost ytLockupMetadataViewModelHasMenuButton">${avatar}<div class="ytLockupMetadataViewModelTextContainer" data-text>${text}</div><div class="ytLockupMetadataViewModelMenuButton">${button}</div></yt-lockup-metadata-view-model></yt-lockup-view-model>`
    : `<ytd-rich-grid-media>${thumbnail}<div id="details">${avatar}<div id="meta" data-text>${text}</div>${index % 2 ? classicMenu : `<div id="menu">${classicMenu}</div>`}</div></ytd-rich-grid-media>`;
  return `<ytd-rich-item-renderer data-card ${index >= 4 ? "hidden" : ""}><div id="content">${inner}</div></ytd-rich-item-renderer>`;
}

function fixture(modern) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:14px Arial;color:#eee} ytd-app,ytd-browse,ytd-rich-grid-renderer,ytd-rich-section-renderer,ytd-rich-grid-media,ytd-menu-renderer{display:block}
    ytd-rich-grid-renderer{padding:24px;box-sizing:border-box;width:100%} [hidden]{display:none!important}
    ytd-rich-shelf-renderer{display:flex;width:100%;box-sizing:border-box;background:#222}
    ytd-rich-shelf-renderer>#dismissible{position:relative;width:100%;margin-bottom:40px;padding-bottom:40px;border-bottom:1px solid #444}
    #rich-shelf-header{display:flex;justify-content:space-between;margin:0 0 16px 8px}
    #title-container{display:flex;flex-direction:column} h2{font-size:20px;margin:0 0 4px} #subtitle{font-size:12px} #subtitle-text{font-size:13px;margin-top:8px}
    #contents-container{margin-top:-12px} #contents{display:flex;flex-wrap:wrap;margin:0 -6px -12px;padding:12px 0}
    ytd-rich-item-renderer{display:block;width:calc(100% / var(--ytd-rich-grid-items-per-row,6) - 12px);margin:0 6px 24px}
    ytd-rich-item-renderer>#content{display:block} yt-lockup-view-model{display:flex;flex:1;position:relative;min-width:0}
    .ytLockupViewModelVertical{flex-direction:column} .ytLockupViewModelContentImage{display:block;position:relative;width:100%}
    yt-thumbnail-view-model{display:block;aspect-ratio:16/9;width:100%} img.cover{display:block;width:100%;height:100%;object-fit:cover}
    .ytLockupMetadataViewModelHost,#details{display:flex;position:relative;margin-top:12px;min-width:0}
    .avatar{display:block;flex:0 0 36px;width:36px;height:36px;margin-right:12px;border-radius:50%;overflow:hidden}
    .avatar img{display:block;width:100%;height:100%;object-fit:cover}
    .ytLockupMetadataViewModelTextContainer{display:flex;flex-direction:column;min-width:0} #meta{overflow-x:hidden;padding-right:24px}
    h3{font-size:16px;line-height:22px;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
    .ytLockupMetadataViewModelHasMenuButton h3{padding-right:24px} p{font-size:12px;line-height:18px;margin:4px 0}
    .members-badge{font-size:12px;line-height:18px;color:#4ee173}
    .ytLockupMetadataViewModelMenuButton,ytd-rich-grid-media ytd-menu-renderer{position:absolute;top:4px;right:-12px}
    button{cursor:pointer;color:inherit;border:0;border-radius:2px;background:#333} .more{width:32px;height:32px;padding:0;font-size:24px}
    .button-container{position:absolute;bottom:0;left:50%;transform:translate(-50%,50%);width:360px;max-width:100%;background:#111}
    #show-more{width:100%;height:40px;font-weight:600;font-size:14px}
    #ordinary{margin-top:16px;padding:3px;border-radius:2px} #ordinary>#dismissible{padding:0;margin:0;border:0}
    #shorts{margin:16px 0} #shorts>#dismissible{padding:0;margin:0;border:0}
    #popup{display:none;position:fixed;inset:100px auto auto 30%;width:200px;height:100px;z-index:3000;padding:12px} #popup.open{display:block}
  </style></head><body><ytd-app><ytd-browse page-subtype="home"><ytd-rich-grid-renderer>
    <ytd-rich-section-renderer><ytd-rich-shelf-renderer id="memberships" has-paygated-featured-badge has-expansion-button>
      <div id="dismissible"><div id="rich-shelf-header"><div id="title-container"><h2>Get more from memberships</h2><span id="subtitle">YouTube featured</span><span id="subtitle-text">Enjoy perks like members-only videos and much more</span></div></div>
        <div id="contents-container"><div id="contents" data-grid>${Array.from({length:8},(_,i)=>card(i,modern)).join("")}</div></div>
        <div class="button-container"><button id="show-more" class="ytSpecButtonShapeNextHost">Show more ﹀</button></div>
      </div></ytd-rich-shelf-renderer></ytd-rich-section-renderer>
    <ytd-rich-shelf-renderer id="ordinary"><div id="dismissible">Adjacent video shelf</div></ytd-rich-shelf-renderer>
    <ytd-rich-shelf-renderer id="shorts" is-shorts><div id="dismissible">Shorts shelf</div></ytd-rich-shelf-renderer>
  </ytd-rich-grid-renderer></ytd-browse><ytd-popup-container><ytd-menu-popup-renderer id="popup" role="menu"><button role="menuitem">Save to playlist</button></ytd-menu-popup-renderer></ytd-popup-container></ytd-app>
  <script>document.addEventListener('click',event=>{if(event.target.closest('.more'))document.querySelector('#popup').classList.add('open')});document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('#popup').classList.remove('open')});document.querySelector('#show-more').addEventListener('click',event=>{const expanded=event.target.textContent.startsWith('Show more');document.querySelectorAll('[data-card]').forEach((card,i)=>card.hidden=!expanded&&i>=4);event.target.textContent=expanded?'Show less ﹀':'Show more ﹀'});</script></body></html>`;
}

async function layout(page) {
  return page.evaluate(() => {
    const rect = el => { const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const host=document.querySelector('#memberships');
    return {
      host:rect(host),grid:rect(document.querySelector('[data-grid]')),header:rect(document.querySelector('#rich-shelf-header')),footer:rect(document.querySelector('#show-more')),
      cards:[...host.querySelectorAll('[data-card]')].filter(el=>el.getBoundingClientRect().width>0).map(el=>({
        ...rect(el),thumbnail:rect(el.querySelector('yt-thumbnail-view-model')),text:rect(el.querySelector('[data-text]')),menu:rect(el.querySelector('.more')),avatar:rect(el.querySelector('.avatar')),
        radius:getComputedStyle(el).borderRadius,thumbnailRadius:getComputedStyle(el.querySelector('yt-thumbnail-view-model')).borderRadius,
        bevel:[getComputedStyle(el).borderTopColor,getComputedStyle(el).borderBottomColor],blur:getComputedStyle(el).backdropFilter
      })),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
      radius:getComputedStyle(host).borderRadius,bevel:[getComputedStyle(host).borderTopColor,getComputedStyle(host).borderBottomColor],blur:getComputedStyle(host).backdropFilter,
      footerFill:getComputedStyle(document.querySelector('.button-container')).backgroundColor,
      menuRadius:getComputedStyle(host.querySelector('.more')).borderRadius
    };
  });
}
function check(state,width,count) {
  assert.equal(state.overflow,false,`no page overflow at ${width}px`);
  assert.equal(state.cards.length,count,'native collapsed/expanded item visibility is preserved');
  assert.equal(state.radius,'16px');assert.notEqual(...state.bevel,'panel has a subtle bevel');
  assert.equal(state.blur,'blur(12px)');assert.equal(state.footerFill,'rgba(0, 0, 0, 0)','footer shares the panel background');
  assert.equal(state.menuRadius,'999px');
  assert.ok(state.header.x>=state.host.x+12,'header is inset');
  assert.ok(state.footer.bottom<=state.host.bottom-12,'Show more stays inside the panel');
  assert.ok(Math.abs((state.footer.x+state.footer.right)/2-(state.host.x+state.host.right)/2)<1,'footer is centered');
  const rows = new Map();
  for(const card of state.cards) {
    assert.equal(card.radius,'16px');assert.equal(card.thumbnailRadius,'12px');assert.notEqual(...card.bevel);
    assert.equal(card.blur,'none','cards use the shelf backdrop without stacking blur');
    assert.ok(card.x>=state.host.x+12&&card.right<=state.host.right-12&&card.bottom<=state.host.bottom-12,'cards stay inside the panel');
    assert.ok(card.thumbnail.x>=card.x+10&&card.thumbnail.right<=card.right-10,'cover is inset within its card');
    assert.ok(card.menu.width>=40&&card.menu.height>=40,'menu remains easy to click');
    assert.ok(card.text.right<=card.menu.x,'title and badges have a separate menu column');
    assert.ok(card.avatar.right<=card.text.x,'channel logo does not overlap the title');
    assert.ok(card.menu.right<=card.right-10,'menu stays inside the card');
    const key=Math.round(card.y);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(card);
  }
  for(const row of rows.values()) {
    for(const card of row) {assert.ok(Math.abs(card.width-row[0].width)<1,'equal card widths');assert.ok(Math.abs(card.height-row[0].height)<1,'uniform row heights');}
    assert.ok(Math.abs(row[0].x-state.grid.x)<1,'first card aligns with the grid');
  }
  const firstRow=[...rows.values()][0];
  assert.ok(Math.abs(firstRow.at(-1).right-state.grid.right)<1,'collapsed cards fill the available row');
}

(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1880,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),60000);
  try {
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(route.request().url().includes('modern'))}));
    const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,surfaceColor:'#745532',pageColor:'#684722',uiOpacity:30,uiBlur:12,videosPerRow:6}));
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const modern of [false,true]) {
      await page.goto('https://www.youtube.com/?fixture='+(modern?'modern':'classic'));
      await page.waitForFunction(()=>document.querySelector('#yt-custom-progress-style'));
      const original=await page.locator('#memberships').evaluate(el=>({padding:getComputedStyle(el).padding,radius:getComputedStyle(el).borderRadius,style:el.getAttribute('style')||''}));
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:true}));
      await page.waitForFunction(()=>document.querySelector('#memberships').hasAttribute('data-ytc-universal-glass'));
      for(const width of [1880,1440,800,390]) {
        await page.setViewportSize({width,height:1000});check(await layout(page),width,4);
        await page.locator('.more:visible').first().click();await page.locator('#popup.open').waitFor();await page.keyboard.press('Escape');
        if(process.env.YTC_SCREENSHOTS&&[1880,390].includes(width))await page.locator('#memberships').screenshot({path:path.join(os.tmpdir(),`ytc-memberships-${modern?'modern':'classic'}-${width}.png`)});
      }
      await page.locator('#show-more').click();check(await layout(page),390,8);
      await page.locator('#show-more').click();check(await layout(page),390,4);
      await popup.evaluate(()=>chrome.storage.sync.set({videosPerRow:2}));
      await page.setViewportSize({width:1880,height:1000});
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-grid]')).gridTemplateColumns.split(' ').length===2);
      check(await layout(page),1880,4);
      await popup.evaluate(()=>chrome.storage.sync.set({videosPerRow:6}));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-grid]')).gridTemplateColumns.split(' ').filter(track=>parseFloat(track)>0).length===4);
      await popup.evaluate(async wallpaper=>{await chrome.storage.local.set({backgroundImageData:wallpaper});await chrome.storage.sync.set({backgroundMode:'image'});},wallpaper);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-home-glass'));check(await layout(page),1880,4);
      await popup.evaluate(()=>chrome.storage.sync.set({uiOpacity:0}));
      await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--ytc-ui-opacity')==='0');
      assert.equal(await page.locator('#memberships').evaluate(el=>getComputedStyle(el).borderTopColor),'rgba(255, 255, 255, 0)','bevel follows opacity');
      await popup.evaluate(()=>chrome.storage.sync.set({uiOpacity:30}));
      await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--ytc-ui-opacity')==='0.3');
      await page.locator('#memberships').evaluate(el=>el.removeAttribute('has-paygated-featured-badge'));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-card]')).backdropFilter==='blur(12px)');
      await page.locator('#memberships').evaluate(el=>el.setAttribute('has-paygated-featured-badge',''));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-card]')).backdropFilter==='none');check(await layout(page),1880,4);
      await page.locator('#ordinary').evaluate(el=>el.setAttribute('has-paygated-featured-badge',''));
      await page.waitForFunction(()=>document.querySelector('#ordinary').style.backdropFilter==='var(--ytc-ui-backdrop)');
      await page.locator('#ordinary').evaluate(el=>el.removeAttribute('has-paygated-featured-badge'));
      assert.equal(await page.locator('#ordinary').evaluate(el=>getComputedStyle(el).padding),'3px','ordinary shelves keep their spacing');
      assert.equal(await page.locator('#shorts').evaluate(el=>getComputedStyle(el).padding),'6px 12px','Shorts keep their compact layout');
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,backgroundMode:'color'}));
      await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme'));
      assert.deepEqual(await page.locator('#memberships').evaluate(el=>({padding:getComputedStyle(el).padding,radius:getComputedStyle(el).borderRadius,style:el.getAttribute('style')||''})),original,'disabling restores the native shelf');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: classic and modern memberships shelves at 1880/1440/800/390px; rounded bevels, balanced cards, menu clicks, expansion, column settings, wallpaper, opacity, recycled shelves, restoration, and no overflow.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
