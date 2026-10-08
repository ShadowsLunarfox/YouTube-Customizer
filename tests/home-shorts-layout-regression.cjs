// Home Shorts use structural markers, keep native DOM ownership, and share video columns.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const cover = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="540"><rect width="360" height="540" fill="#4f727d"/><circle cx="180" cy="240" r="110" fill="#8cbcae"/><text x="36" y="480" font-size="40" fill="white">YouTube Shorts</text></svg>');
const metadata = index => `<div class="metadata"><h3>Short ${index}: a longer title for a portrait video</h3><span>12K views</span><button class="more" aria-label="More actions for Short ${index}">⋮</button></div>`;
const modernCard = index => `<div class="ytGridShelfViewModelGridShelfItem" data-short-card style="width:240px;margin-inline:8px;--ytd-shorts-width:240px">
  <ytm-shorts-lockup-view-model-v2 class="shortsLockupViewModelHost"><ytm-shorts-lockup-view-model class="shortsLockupViewModelHost">
    <a href="/shorts/fixture-${index}"><yt-thumbnail-view-model><img src="${cover}" alt="Short ${index}"></yt-thumbnail-view-model></a>${metadata(index)}
  </ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2></div>`;
const legacyCard = index => `<ytd-rich-item-renderer is-slim-media data-short-card ${index >= 6 ? "hidden" : ""} style="width:calc(100% / var(--ytd-rich-grid-slim-items-per-row) - 12px)">
  <div id="content"><ytd-rich-grid-slim-media><a href="/shorts/fixture-${index}"><ytd-thumbnail><img src="${cover}" alt="Short ${index}"></ytd-thumbnail></a>${metadata(index)}</ytd-rich-grid-slim-media></div></ytd-rich-item-renderer>`;
const rows = () => `<div class="ytGridShelfViewModelGridShelfRow">${[0,1,2,3].map(modernCard).join("")}</div>
  <div class="ytGridShelfViewModelGridShelfRow">${[4,5].map(modernCard).join("")}</div>
  <div class="ytGridShelfViewModelGridShelfRow" hidden>${[6,7].map(modernCard).join("")}</div>`;
const modernShelf = (id, direct = false) => `<grid-shelf-view-model id="${id}" class="ytGridShelfViewModelHost" data-shelf>
  <yt-section-header-view-model>Shorts</yt-section-header-view-model>
  ${direct ? rows() : `<div class="native-rows" ${id==='modern'?'data-ytc-home-shorts-grid="native"':''}>${rows()}</div>`}
  <div class="ytGridShelfViewModelGridShelfBottomButtonContainer"><button class="expand">Show more</button></div>
</grid-shelf-view-model>`;
const fixture = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:14px Arial} [hidden]{display:none!important} ytd-app,ytd-browse,ytd-rich-grid-renderer,ytd-rich-grid-media,ytd-rich-grid-slim-media{display:block}
  #home{margin:56px 24px 0 240px} ytd-rich-grid-renderer{width:100%;min-width:0;--ytd-rich-grid-slim-items-per-row:4}
  #regular{display:flex;flex-wrap:wrap;width:100%} #regular>ytd-rich-item-renderer{width:calc(100% / var(--ytd-rich-grid-items-per-row,6) - 12px);margin:0 6px 24px;box-sizing:border-box}
  ytd-rich-item-renderer{display:block;min-width:0} [data-regular-card]{height:120px}
  ytd-rich-shelf-renderer{display:block;width:100%;box-sizing:border-box;margin:16px 0}
  ytd-rich-shelf-renderer>#dismissible{width:100%;box-sizing:border-box} h2{font-size:20px;margin:0 0 12px}
  #contents-container>#contents{display:flex;flex-wrap:wrap;padding:0;margin:0}
  #contents>ytd-rich-item-renderer{margin-inline:6px;box-sizing:border-box}
  ytd-thumbnail,yt-thumbnail-view-model{display:block;width:100%;aspect-ratio:2/3;overflow:hidden;border-radius:12px}
  img{display:block;width:100%;height:100%;object-fit:cover} a{display:block}
  .ytGridShelfViewModelHost{display:flex;flex-direction:column;position:relative;margin:16px 0}
  .ytGridShelfViewModelHostIsDismissed{display:none}
  yt-section-header-view-model{display:block;font-size:20px;margin-bottom:12px}
  .ytGridShelfViewModelGridShelfRow{display:flex} .ytGridShelfViewModelGridShelfRow:not(:last-of-type){margin-bottom:8px}
  .ytGridShelfViewModelGridShelfItem{display:flex;justify-content:center;min-width:0;box-sizing:border-box}
  .shortsLockupViewModelHost{display:inline-block;position:relative;width:var(--ytd-shorts-width,100%)}
  .metadata{position:relative;padding-top:8px;min-width:0} h3{font-size:14px;line-height:18px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;padding-right:36px;margin:0 0 4px;word-break:break-word}
  .metadata>span{font-size:12px} button{cursor:pointer}.more{position:absolute;right:0;top:4px;width:32px;height:32px;border-radius:50%;border:0}
  .ytGridShelfViewModelGridShelfBottomButtonContainer,.button-container{width:min(100%,360px);margin:16px auto 0}.expand{height:40px;width:100%}
  #not-shorts .ytGridShelfViewModelGridShelfItem{height:60px;width:200px}.normal-card{display:block;width:100%;height:100%}
  #search-outside{margin:24px;display:block} #search-outside .metadata{display:none}
  #popup{display:none;position:fixed;left:40%;top:100px;z-index:3000;padding:16px;width:180px;height:100px} #popup.open{display:block}
  @media(max-width:1100px){#home{margin-left:72px}} @media(max-width:700px){#home{margin-left:12px;margin-right:12px}}
</style></head><body><ytd-app><ytd-browse page-subtype="home" id="home"><ytd-rich-grid-renderer>
  <div id="regular">${Array.from({length:8},(_,i)=>`<ytd-rich-item-renderer data-regular-card>Regular video ${i}</ytd-rich-item-renderer>`).join("")}</div>
  <ytd-rich-shelf-renderer id="legacy" is-shorts data-shelf><div id="dismissible"><h2>Shorts</h2><div id="contents-container"><div id="contents">${Array.from({length:8},(_,i)=>legacyCard(i)).join("")}</div></div><div class="button-container"><button class="expand">Show more</button></div></div></ytd-rich-shelf-renderer>
  ${modernShelf("modern")}${modernShelf("direct",true)}
  <ytd-rich-shelf-renderer is-shorts id="nested-shell"><div id="dismissible"><div id="contents-container"><div id="contents">${modernShelf("nested")}</div></div></div></ytd-rich-shelf-renderer>
  <grid-shelf-view-model id="not-shorts"><div class="native-rows"><div class="ytGridShelfViewModelGridShelfRow"><div class="ytGridShelfViewModelGridShelfItem"><yt-lockup-view-model class="normal-card">Regular shelf</yt-lockup-view-model></div></div></div></grid-shelf-view-model>
</ytd-rich-grid-renderer></ytd-browse><ytd-search id="search-outside">${modernShelf("search-shorts")}</ytd-search>
<ytd-popup-container><ytd-menu-popup-renderer id="popup" role="menu"><button role="menuitem">Save</button></ytd-menu-popup-renderer></ytd-popup-container></ytd-app>
<script>document.addEventListener('click',event=>{if(event.target.closest('.more'))document.querySelector('#popup').classList.add('open');if(event.target.closest('.expand')){const shelf=event.target.closest('[data-shelf]');shelf.querySelectorAll('[hidden]').forEach(el=>el.hidden=false);event.target.textContent='Show less';}});document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('#popup').classList.remove('open')});</script></body></html>`;

async function checkLayout(page, columns, visibleCount = columns) {
  const state = await page.evaluate(() => {
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {
      regular:[...document.querySelectorAll('[data-regular-card]')].map(rect),
      legacyDisplay:getComputedStyle(document.querySelector('#legacy #contents')).display,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
      shelves:['legacy','modern','direct','nested'].map(id=>{const s=document.getElementById(id);const container=s.querySelector('.native-rows')||s;return {
        id,panel:rect(s),containerDisplay:getComputedStyle(container).display,
        slimColumns:getComputedStyle(s.querySelector('#contents')||s).getPropertyValue('--ytd-rich-grid-slim-items-per-row').trim(),
        rows:[...s.querySelectorAll('.ytGridShelfViewModelGridShelfRow:not([hidden])')].map(row=>({display:getComputedStyle(row).display,childCount:row.children.length})),
        cards:[...s.querySelectorAll('[data-short-card]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({...rect(e),image:rect(e.querySelector('img')),menu:rect(e.querySelector('.more'))})),
        nativeCount:s.querySelectorAll('[data-short-card]').length,
        footer:rect(s.querySelector('[data-ytc-home-shorts-toggle]'))
      };})
    };
  });
  assert.equal(state.overflow,false,'no horizontal overflow');
  assert.equal(state.regular.filter(r=>Math.abs(r.y-state.regular[0].y)<1).length,columns,'regular videos use the effective column count');
  assert.equal(state.legacyDisplay,'grid','classic Shorts use the marked grid');
  for(const shelf of state.shelves) {
    assert.equal(shelf.cards.length,visibleCount,`${shelf.id}: collapsed count follows the setting; expansion reveals the other cards`);
    assert.equal(shelf.nativeCount,8,`${shelf.id}: hidden cards remain in the native DOM`);
    assert.equal(shelf.slimColumns,'4',`${shelf.id}: YouTube's native Shorts variable stays intact`);
    if(shelf.id!=='legacy') {
      assert.equal(shelf.containerDisplay,'grid',`${shelf.id}: the marked container lays out cards`);
      for(const row of shelf.rows)assert.equal(row.display,'contents',`${shelf.id}: native row nodes stay in the DOM`);
      assert.ok(shelf.rows.reduce((count,row)=>count+row.childCount,0)>=visibleCount,`${shelf.id}: YouTube's row grouping stays intact`);
    }
    const firstRow=shelf.cards.filter(card=>Math.abs(card.y-shelf.cards[0].y)<1);
    assert.equal(firstRow.length,Math.min(columns,visibleCount),`${shelf.id}: shares the effective video column count`);
    for(const card of shelf.cards) {
      assert.ok(card.x>=shelf.panel.x-1&&card.right<=shelf.panel.right+1,`${shelf.id}: card fits its shelf`);
      assert.ok(card.image.x>=card.x-1&&card.image.right<=card.right+1,`${shelf.id}: fixed native thumbnails fit the card`);
      assert.ok(card.menu.right<=card.right+1,`${shelf.id}: menus fit the card`);
      assert.ok(Math.abs(card.image.height/card.image.width-1.5)<.02,`${shelf.id}: portrait proportions remain intact`);
      assert.ok(Math.abs(card.width-firstRow[0].width)<1,`${shelf.id}: consistent widths across native row boundaries`);
    }
    assert.ok(shelf.footer.y>=Math.max(...shelf.cards.map(c=>c.bottom))-1,`${shelf.id}: expansion control remains below all cards`);
  }
}

// Compare actual native geometry, including widths inherited from YouTube's variables.
async function shortsGeometry(page) {
  return page.evaluate(()=>['legacy','modern','direct','nested'].map(id=>{
    const shelf=document.getElementById(id);const panel=shelf.getBoundingClientRect();
    return {id,width:panel.width,height:panel.height,cards:[...shelf.querySelectorAll('[data-short-card]')].filter(el=>el.getBoundingClientRect().width>0).map(el=>{
      const card=el.getBoundingClientRect();return {x:card.x-panel.x,y:card.y-panel.y,width:card.width,height:card.height};
    })};
  }));
}

(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1440,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),60000);
  try {
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
    await context.route('https://native-layout.test/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
    const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    await popup.evaluate(()=>chrome.storage.sync.set({videosPerRow:6,themeEnabled:true,hideShorts:false}));
    await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://www.youtube.com/');
    await page.waitForSelector('#modern [data-ytc-home-shorts-grid="1"]');
    await checkLayout(page,6);
    await page.evaluate(()=>{window.originalParents=[...document.querySelectorAll('#legacy [data-short-card],#direct [data-short-card],#nested [data-short-card]')].map(card=>[card,card.parentElement]);});
    await popup.getByRole('tab',{name:'Layout'}).click();
    for(const selected of [2,3,4,5,6]) {
      await popup.locator('#videosPerRow').selectOption(String(selected));
      await page.waitForFunction(n=>Number(getComputedStyle(document.querySelector('#regular')).getPropertyValue('--ytc-grid-columns'))===n,selected);
      await checkLayout(page,selected);
    }
    for(const [width,columns] of [[2300,6],[1440,6],[1000,3],[800,3],[600,2],[390,1]]) {
      await page.setViewportSize({width,height:1000});await checkLayout(page,columns);
      if(process.env.YTC_SCREENSHOTS&&[1440,390].includes(width))await page.locator('#modern').screenshot({path:path.join(os.tmpdir(),`ytc-home-shorts-${width}.png`)});
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#modern .more').first().click();await page.locator('#popup.open').waitFor();await page.keyboard.press('Escape');
    const toggleAll=async()=>{for(const shelf of ['legacy','modern','direct','nested'])await page.locator(`#${shelf} [data-ytc-home-shorts-toggle]`).click();};
    await toggleAll();await checkLayout(page,6,8);
    await toggleAll();await checkLayout(page,6);
    await toggleAll();await checkLayout(page,6,8);
    await popup.locator('#videosPerRow').selectOption('3');
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#regular')).getPropertyValue('--ytc-grid-columns'))===3);
    await checkLayout(page,3);
    assert.equal(await page.locator('#modern [data-ytc-home-shorts-toggle]').getAttribute('aria-expanded'),'false','changing the setting collapses an expanded shelf');
    await popup.locator('#videosPerRow').selectOption('6');
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#regular')).getPropertyValue('--ytc-grid-columns'))===6);
    await toggleAll();await checkLayout(page,6,8);
    await page.setViewportSize({width:1440,height:1000});await checkLayout(page,6,8);
    await page.locator('#modern .native-rows').evaluate((el,html)=>{el.innerHTML=html;},`${[0,1,2].map(modernCard).join('')}<div class="ytGridShelfViewModelGridShelfRow">${[3,4,5,6,7].map(modernCard).join('')}</div>`);
    // Simulate YouTube rebuilding its rows after a resize or SPA navigation.
    await page.locator('#modern .native-rows').evaluate(el=>{const direct=[...el.children].filter(e=>e.hasAttribute('data-short-card'));const row=document.createElement('div');row.className='ytGridShelfViewModelGridShelfRow';el.prepend(row);direct.forEach(card=>row.append(card));});
    await page.waitForFunction(()=>[...document.querySelectorAll('#modern .ytGridShelfViewModelGridShelfRow')].every(row=>row.hasAttribute('data-ytc-home-shorts-row')));
    await checkLayout(page,6,8);
    assert.equal(await page.evaluate(()=>window.originalParents.every(([card,parent])=>card.parentElement===parent)),true,'the controller never reparents native cards');
    // Lazy shelf insertion and removal must be discovered without a navigation event.
    await page.locator('ytd-rich-grid-renderer').evaluate((el,html)=>el.insertAdjacentHTML('beforeend',html),modernShelf('lazy'));
    await page.waitForSelector('#lazy [data-ytc-home-shorts-grid]');
    await page.locator('#lazy').evaluate(el=>{el.querySelector('.ytGridShelfViewModelGridShelfBottomButtonContainer').remove();el.querySelectorAll('[hidden]').forEach(row=>row.hidden=false);});
    await page.waitForFunction(()=>!document.querySelector('#lazy [data-ytc-home-shorts-toggle]').hasAttribute('data-ytc-home-shorts-native-more'));
    assert.equal(await page.locator('#lazy [data-short-card]:visible').count(),6,'a shelf without a native footer also collapses to one row');
    await page.locator('#lazy [data-ytc-home-shorts-toggle]').click();
    assert.equal(await page.locator('#lazy [data-short-card]:visible').count(),8,'the fallback control reveals cached extra cards');
    await page.locator('#lazy').evaluate(el=>{window.removedShelf=el;el.remove();});
    await page.waitForFunction(()=>!window.removedShelf.querySelector('[data-ytc-home-shorts-grid]'));
    assert.equal(await page.locator('#not-shorts .native-rows').evaluate(el=>getComputedStyle(el).display),'block','regular shelves are not flattened');
    assert.equal(await page.locator('#search-shorts .native-rows').evaluate(el=>getComputedStyle(el).display),'block','search shelves keep their existing layout');
    assert.equal(await page.locator('#search-shorts .ytGridShelfViewModelGridShelfRow').first().evaluate(el=>getComputedStyle(el).display),'grid','Shorts column rules stay active outside the homepage');
    await page.locator('#direct').evaluate(el=>el.classList.add('ytGridShelfViewModelHostIsDismissed'));
    assert.equal(await page.locator('#direct').evaluate(el=>getComputedStyle(el).display),'none','native dismissal remains effective');
    await page.locator('#direct').evaluate(el=>el.classList.remove('ytGridShelfViewModelHostIsDismissed'));
    await popup.evaluate(()=>chrome.storage.sync.set({hideShorts:true}));
    await page.waitForFunction(()=>['legacy','modern','direct','nested'].every(id=>!document.getElementById(id).getBoundingClientRect().height));
    assert.equal(await page.locator('[data-ytc-home-shorts-grid="1"]').count(),0,'hiding Shorts detaches the layout controller');
    assert.equal(await page.locator('#modern .native-rows').getAttribute('data-ytc-home-shorts-grid'),'native','a preexisting marker value is restored');
    await popup.evaluate(()=>chrome.storage.sync.set({hideShorts:false,themeEnabled:false}));
    await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme')&&document.getElementById('modern').getBoundingClientRect().height>0);await checkLayout(page,6,8);
    // Refresh popup state after writing storage directly, before it sends another live preview.
    await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');
    await page.reload();await page.waitForSelector('#modern [data-ytc-home-shorts-grid="1"]');await checkLayout(page,6);
    // Handle a delayed replacement of the entire Home renderer.
    await page.locator('#home').evaluate(el=>{window.cachedHome=el;el.remove();});
    await page.waitForFunction(()=>window.cachedHome.querySelector('.native-rows').getAttribute('data-ytc-home-shorts-grid')==='native');
    await page.evaluate(()=>document.querySelector('ytd-app').prepend(window.cachedHome));
    await page.waitForFunction(()=>document.querySelector('#modern .native-rows').getAttribute('data-ytc-home-shorts-grid')==='1');
    await checkLayout(page,6);
    const nativePage=await context.newPage();await nativePage.goto('https://native-layout.test/');
    await popup.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/'});await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.__ytProgressCustomizer.dispose()});});
    await page.waitForFunction(()=>!document.querySelector('#yt-custom-progress-style'));
    assert.equal(await page.locator('#modern .native-rows').evaluate(el=>getComputedStyle(el).display),'block','removing the extension restores native row grouping');
    assert.equal(await page.locator('#modern .ytGridShelfViewModelGridShelfRow').first().evaluate(el=>getComputedStyle(el).display),'flex','native flex rows are restored');
    assert.equal(await page.locator('#modern .native-rows').getAttribute('data-ytc-home-shorts-grid'),'native','disposal restores the preexisting marker');
    assert.deepEqual(await shortsGeometry(page),await shortsGeometry(nativePage),'disposal restores native geometry');
    await nativePage.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: Home Shorts show exactly one responsive row for 2-6 columns, hide extra cards, expand/collapse through native and fallback controls, collapse on setting changes, preserve native nodes, handle rebuilt/lazy shelves, and restore on disposal.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
