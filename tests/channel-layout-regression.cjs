// Reproduces channel headers, variable-height carousel cards, compact posts, and release artwork.
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const image = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const card = index => `<yt-lockup-view-model class="ytLockupViewModelWrapper" data-card>
  <div class="ytLockupViewModelHost"><yt-collection-thumbnail-view-model>
    <yt-thumbnail-view-model class="ytThumbnailViewModelCinematic"><img src="${image}" alt="Release ${index}"></yt-thumbnail-view-model>
  </yt-collection-thumbnail-view-model><h3>${index % 2 ? 'A longer release title that wraps onto a second line' : 'Release ' + index}</h3>
  <button class="ytSpecButtonShapeNextHost more" aria-label="More actions">More</button></div>
</yt-lockup-view-model>`;
const arrows = `<div id="left-arrow"><button class="arrow">Previous</button></div>
  <div id="right-arrow"><button class="arrow">Next</button></div>`;
const post = index => `<ytd-post-renderer uses-compact-lockup attachment="image" data-post>
  <div id="dismissible"><div id="header">Channel · ${index + 1} days ago</div>
    <div id="body"><div id="post-text">${index ? 'Short post' : 'A longer community post preview that wraps over several lines while the attachment keeps its size.'}</div>
      <ytd-backstage-image-renderer><img src="${image}" alt="Post attachment"></ytd-backstage-image-renderer></div>
    <div id="toolbar"><ytd-comment-action-buttons-renderer id="action-buttons"><div class="nested-toolbar" id="toolbar">
      <div><button>Like</button><button>Dislike</button></div><button>Share</button><button>Comments</button>
    </div></ytd-comment-action-buttons-renderer><ytd-menu-renderer><button>More</button></ytd-menu-renderer></div>
  </div></ytd-post-renderer>`;
const gridCard = index => `<ytd-rich-item-renderer data-grid-card><yt-lockup-view-model>
  <div class="ytLockupViewModelHost"><yt-thumbnail-view-model><img src="${image}" alt="Video ${index}"></yt-thumbnail-view-model>
    <yt-lockup-metadata-view-model class="ytLockupMetadataViewModelHost">
      <div class="ytLockupMetadataViewModelTextContainer"><h3 class="ytLockupMetadataViewModelTitle">
        ${index % 2 ? 'A longer video title with its channel badge' : 'Video ' + index} <span>✓</span></h3><span>1M views · 1 year ago</span></div>
      <div class="ytLockupMetadataViewModelMenuButton"><button class="ytSpecButtonShapeNextHost more" aria-label="More actions">⋮</button></div>
    </yt-lockup-metadata-view-model></div></yt-lockup-view-model></ytd-rich-item-renderer>`;
const fixture = `<!doctype html><html><head><style>
  :root { --fixture-sidebar:240px; } body { margin:0; font:14px Arial; }
  ytd-app, ytd-browse, ytd-tabbed-page-header, yt-page-header-renderer,
  yt-page-header-view-model, tp-yt-paper-tabs, ytd-item-section-renderer,
  ytd-shelf-renderer, ytd-section-list-renderer, yt-horizontal-list-renderer,
  ytd-two-column-browse-results-renderer, ytd-rich-grid-renderer { display:block; }
  ytd-browse { margin:56px 16px 0 var(--fixture-sidebar); }
  ytd-tabbed-page-header { height:300px; }
  #channel-header-shell { position:fixed; top:56px; left:var(--fixture-sidebar); right:16px; z-index:10; }
  yt-image-banner-view-model { display:block; height:96px; background:#6b4d3a; }
  yt-page-header-renderer { height:140px; background:#222; }
  yt-page-header-view-model { padding:16px; }
  tp-yt-paper-tabs { height:48px; display:flex; gap:8px; align-items:center; }
  ytd-section-list-renderer { width:1600px; }
  ytd-item-section-renderer { margin-bottom:1px; }
  #music h2 { margin:0 0 12px; }
  yt-horizontal-list-renderer { position:relative; }
  #scroll-outer-container { display:flex; }
  #scroll-container { overflow:hidden; margin-top:-12px; }
  #items { display:inline-block; white-space:nowrap; padding-top:12px; }
  #items > * { display:inline-block; vertical-align:top; white-space:normal; }
  yt-lockup-view-model { width:220px; }
  .ytLockupViewModelHost { display:flex; flex-direction:column; width:220px; }
  h3 { font-size:16px; line-height:20px; margin:8px 0; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
  yt-thumbnail-view-model { display:block; aspect-ratio:16/9; width:100%; }
  yt-collection-thumbnail-view-model { display:block; }
  img { width:100%; height:100%; display:block; }
  #left-arrow, #right-arrow { position:absolute; top:0; width:0; height:118px; display:flex; align-items:center; justify-content:center; z-index:200; }
  #left-arrow { left:0; } #right-arrow { right:4px; }
  .arrow { flex-shrink:0; width:40px; height:40px; }
  #items > ytd-post-renderer { display:inline-flex; flex-direction:column; width:386px; height:196px; padding:12px 24px 0; border:1px solid #666; }
  ytd-post-renderer #dismissible { display:flex; flex-direction:column; flex:1; }
  ytd-post-renderer #header { height:24px; margin-bottom:12px; }
  ytd-post-renderer #body { display:flex; flex:1; max-height:116px; gap:16px; }
  #post-text { flex:1; line-height:20px; }
  ytd-backstage-image-renderer { display:block; width:116px; height:116px; flex-shrink:0; }
  ytd-post-renderer #toolbar { display:flex; justify-content:space-between; align-items:center; margin:2px 0; }
  #action-buttons { display:block; width:100%; }
  .nested-toolbar { width:calc(100% + 12px); }
  ytd-post-renderer ytd-menu-renderer { display:flex; margin-left:12px; }
  ytd-post-renderer button { height:32px; }
  #popup { display:none; position:fixed; top:140px; left:40%; width:180px; height:120px; z-index:3000; }
  #popup.open { display:block; }
  #cinematics { position:fixed; inset:0; background:#000; }
  ytd-rich-grid-renderer { display:flex; flex-direction:column; }
  ytd-rich-grid-renderer > #contents { display:flex; flex-wrap:wrap; width:100%; }
  ytd-rich-item-renderer { display:block; width:calc(100% / var(--ytd-rich-grid-items-per-row) - 12px); margin:0 6px 24px; }
  ytd-rich-item-renderer yt-lockup-view-model { display:flex; width:100%; }
  .ytLockupMetadataViewModelHost { display:flex; position:relative; margin-top:12px; }
  .ytLockupMetadataViewModelTextContainer { display:flex; flex-direction:column; min-width:0; }
  .ytLockupMetadataViewModelTitle { margin:0; padding-right:24px; }
  .ytLockupMetadataViewModelMenuButton { position:absolute; top:-6px; right:-10px; }
  .ytLockupMetadataViewModelMenuButton button { width:32px; height:32px; padding:0; }
  #outside-section { display:block; padding:3px; border-radius:2px; }
  @media(max-width:1100px) { :root { --fixture-sidebar:72px; } }
  @media(max-width:700px) { :root { --fixture-sidebar:0px; } }
</style></head><body><ytd-app><ytd-browse page-subtype="channels">
  <ytd-tabbed-page-header><div id="channel-header-shell">
    <yt-image-banner-view-model>Channel banner</yt-image-banner-view-model>
    <yt-page-header-renderer><yt-page-header-view-model>Channel profile</yt-page-header-view-model></yt-page-header-renderer>
    <tp-yt-paper-tabs><button role="tab" aria-selected="true" id="home-tab">Home</button><button role="tab">Videos</button></tp-yt-paper-tabs>
  </div></ytd-tabbed-page-header>
  <ytd-two-column-browse-results-renderer><div id="primary"><ytd-section-list-renderer>
    <ytd-item-section-renderer id="music"><ytd-shelf-renderer><h2>Releases</h2>
      <yt-horizontal-list-renderer><div id="scroll-outer-container"><div id="scroll-container"><div id="items">${Array.from({length:8}, (_, i) => card(i)).join("")}</div></div></div>
        ${arrows}</yt-horizontal-list-renderer>
    </ytd-shelf-renderer></ytd-item-section-renderer>
    <ytd-item-section-renderer id="posts"><yt-horizontal-list-renderer>
      <div id="scroll-outer-container"><div id="scroll-container"><div id="items">${post(0)}${post(1)}</div></div></div>${arrows}
    </yt-horizontal-list-renderer></ytd-item-section-renderer>
  </ytd-section-list-renderer></div></ytd-two-column-browse-results-renderer>
  <ytd-rich-grid-renderer id="standalone"><div id="contents">${Array.from({length:12}, (_, index) => gridCard(index)).join('')}</div></ytd-rich-grid-renderer>
</ytd-browse><ytd-item-section-renderer id="outside-section">Other page</ytd-item-section-renderer>
<ytd-browse page-subtype="home"><ytd-rich-grid-renderer id="outside-grid"><div id="contents"></div></ytd-rich-grid-renderer></ytd-browse>
<div id="cinematics">Ambient decoration</div><ytd-popup-container><ytd-menu-popup-renderer id="popup" role="menu"><button role="menuitem">Menu item</button></ytd-menu-popup-renderer></ytd-popup-container>
</ytd-app><script>
  document.querySelectorAll('.more').forEach(button => button.addEventListener('click', () => document.querySelector('#popup').classList.add('open')));
  document.addEventListener('keydown', e => { if(e.key === 'Escape') document.querySelector('#popup').classList.remove('open'); });
  document.querySelector('#home-tab').addEventListener('click', () => document.body.dataset.clickedTab = 'home');
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width:1440, height:900 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route("https://www.youtube.com/**", route => route.fulfill({ contentType:"text/html", body:fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path:root });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");
    await popup.evaluate(async image => {
      await chrome.storage.local.set({backgroundImageData:image});
      await chrome.storage.sync.set({themeEnabled:false,backgroundMode:"image",uiOpacity:30,uiBlur:12});
    }, image);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://www.youtube.com/@channel-fixture");
    const original = await page.locator("#music").evaluate(el => [getComputedStyle(el).padding,getComputedStyle(el).borderRadius]);
    await popup.evaluate(() => chrome.storage.sync.set({themeEnabled:true}));
    await page.waitForFunction(() => document.querySelector("#music").hasAttribute("data-ytc-universal-glass"));

    for (const width of [1440,1000,800,500]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(() => scrollTo(0,0));
      const state = await page.evaluate(() => {
        const rect = el => { const r=el.getBoundingClientRect(); return {x:r.x,right:r.right,y:r.y,bottom:r.bottom}; };
        const header=document.querySelector("#channel-header-shell");
        const panel=document.querySelector("#music");
        const artwork=[...document.querySelectorAll(".ytThumbnailViewModelCinematic")];
        return { header:rect(header), sidebar:parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fixture-sidebar")),
          panel:rect(panel), tabs:rect(document.querySelector("tp-yt-paper-tabs")),
          artwork:artwork.every(el => el.clientWidth>0 && el.clientHeight>0 && !el.hasAttribute("data-ytc-ambient-blocked")),
          cardsFit:[...document.querySelectorAll("[data-card]")].every(el => el.querySelector("yt-thumbnail-view-model").getBoundingClientRect().right<=el.getBoundingClientRect().right),
          equalHeights:[...document.querySelectorAll('yt-horizontal-list-renderer #items')].every(track => {
            const heights=[...track.children].map(el => el.getBoundingClientRect().height);
            return Math.max(...heights)-Math.min(...heights)<1;
          }),
          postButtonsFit:[...document.querySelectorAll('[data-post]')].every(post => {
            const r=post.getBoundingClientRect();
            return [...post.querySelectorAll('button')].every(button => {
              const b=button.getBoundingClientRect();return b.x>=r.x && b.right<=r.right-10 && b.bottom<=r.bottom-10;
            });
          }),
          arrowsFit:[...document.querySelectorAll('.arrow')].every(button => {
            const p=button.closest('ytd-item-section-renderer').getBoundingClientRect(), b=button.getBoundingClientRect();
            return b.x>=p.x+10 && b.right<=p.right-10;
          }),
          gridColumns:Number(getComputedStyle(document.querySelector('#standalone > #contents')).getPropertyValue('--ytc-grid-columns')),
          expectedColumns:Math.min(6,Math.max(1,Math.floor(document.querySelector('#standalone').clientWidth/288))),
          gridCardsFit:[...document.querySelectorAll('[data-grid-card]')].every(card => {
            const c=card.getBoundingClientRect(),image=card.querySelector('yt-thumbnail-view-model').getBoundingClientRect();
            const text=card.querySelector('.ytLockupMetadataViewModelTextContainer').getBoundingClientRect();
            const menu=card.querySelector('.ytLockupMetadataViewModelMenuButton button').getBoundingClientRect();
            return image.width>=256 && image.x>=c.x+8 && image.right<=c.right-8 && menu.right<=c.right-8 &&
              menu.bottom<=c.bottom-8 && menu.width>=40 && menu.height>=40 && text.right<=menu.x-6;
          }),
          overflow:document.documentElement.scrollWidth>innerWidth };
      });
      assert.equal(state.header.x,state.sidebar,"blur must not relocate the fixed channel header");
      assert.ok(state.header.right<=width && state.panel.right<=width,"header and section fit the viewport");
      assert.ok(state.panel.y>=state.tabs.bottom+12,"tabs remain separated from section content");
      assert.equal(state.artwork,true,"cinematic album artwork stays visible");
      assert.equal(state.cardsFit,true,"carousel media fits the inset cards");
      assert.equal(state.equalHeights,true,"each carousel stretches cards to a uniform height despite wrapped titles");
      assert.equal(state.postButtonsFit,true,"compact post actions stay inside the card with bottom spacing");
      assert.equal(state.arrowsFit,true,"carousel arrows stay inside the panel edges");
      assert.equal(state.gridColumns,state.expectedColumns,"channel columns respond to the content width");
      assert.equal(state.gridCardsFit,true,"large covers, titles, badges, and menu buttons fit without overlapping");
      assert.equal(state.overflow,false);
    }
    assert.equal(await page.locator("#cinematics").evaluate(el => getComputedStyle(el).display),"none","actual ambient layers remain hidden");
    assert.equal(await page.locator("#standalone ytd-rich-item-renderer").first().evaluate(el => getComputedStyle(el).backdropFilter),"blur(12px)","standalone grid cards keep their own blur");
    assert.deepEqual(await page.locator("#outside-section").evaluate(el => [getComputedStyle(el).padding,getComputedStyle(el).borderRadius]),["3px","2px"],"channel spacing stays scoped");

    await page.setViewportSize({width:1440,height:900});
    assert.equal(await page.locator('#outside-grid').evaluate(el => getComputedStyle(el).containerName),'none',"channel sizing does not contain the homepage grid");
    assert.equal(await page.locator('#outside-grid > #contents').evaluate(el => getComputedStyle(el).getPropertyValue('--ytc-grid-columns').trim()),'6',"the homepage keeps its column setting");
    const fullWidth=await page.locator('[data-grid-card]').first().evaluate(el => el.clientWidth);
    await popup.evaluate(() => chrome.storage.sync.set({videosPerRow:2}));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#standalone > #contents')).getPropertyValue('--ytc-grid-columns').trim()==='2');
    assert.ok(await page.locator('[data-grid-card]').first().evaluate((el,width) => el.clientWidth>width,fullWidth),"the maximum videos-per-row setting still works");
    await popup.evaluate(() => chrome.storage.sync.set({videosPerRow:6}));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#standalone > #contents')).getPropertyValue('--ytc-grid-columns').trim()==='4');
    for (const uiBlur of [12,0,30]) {
      await popup.evaluate(uiBlur => chrome.storage.sync.set({uiBlur}),uiBlur);
      await page.waitForFunction(uiBlur => document.documentElement.style.getPropertyValue("--ytc-ui-blur")===uiBlur+"px",uiBlur);
      await page.evaluate(() => {
        const panel=document.querySelector("#music"),tabs=document.querySelector("tp-yt-paper-tabs");
        scrollTo(0,panel.offsetTop-tabs.getBoundingClientRect().y);
      });
      assert.equal(await page.locator("#home-tab").evaluate(el => {
        const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      }),true,"carousel arrows cannot cover sticky tabs, including with blur off");
    }
    await page.evaluate(() => scrollTo(0,0));
    await page.locator(".more").first().click();
    await page.locator("#popup.open").waitFor({state:"visible"});
    assert.equal(await page.locator("#popup").evaluate(el => {
      const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }),true,"popup menus appear above the header and sections");
    await page.keyboard.press("Escape");
    await page.locator('#standalone .more').first().scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#standalone .more').first().evaluate(el => {
      const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }),true,"the grid menu has a clear clickable area beside the title");
    await page.locator('#standalone .more').first().click();
    await page.locator('#popup.open').waitFor({state:'visible'});
    await page.keyboard.press('Escape');

    await page.locator("#music #items").evaluate((el,markup) => el.insertAdjacentHTML("beforeend",markup),card(9));
    await page.locator("[data-card]").last().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("[data-card]")].every(el => el.hasAttribute("data-ytc-universal-glass")));
    assert.equal(await page.locator('#music [data-card]').evaluateAll(cards => {
      const heights=cards.map(el => el.getBoundingClientRect().height);return Math.max(...heights)-Math.min(...heights)<1;
    }),true,"new carousel cards also share the row height");
    assert.equal(await page.locator('.nested-toolbar').first().evaluate(el => getComputedStyle(el).paddingTop),'0px',"post spacing does not alter nested action toolbars");
    await popup.evaluate(() => chrome.storage.sync.set({uiOpacity:0,uiBlur:0}));
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue("--ytc-ui-opacity")==="0");
    assert.ok((await page.locator("#music").evaluate(el => getComputedStyle(el).backgroundColor)).endsWith(", 0)"));
    await popup.evaluate(() => chrome.storage.sync.set({themeEnabled:false}));
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-theme"));
    assert.deepEqual(await page.locator("#music").evaluate(el => [getComputedStyle(el).padding,getComputedStyle(el).borderRadius]),original);
    assert.equal(await page.locator("#cinematics").evaluate(el => getComputedStyle(el).display),"block");
    assert.deepEqual(errors,[]);
    console.log("PASS: large responsive channel covers and separate clickable menus; live column limits; aligned headers, visible artwork, equal carousel heights, contained post controls, popups, dynamic cards, glass settings, scoping, and restoration.");
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
