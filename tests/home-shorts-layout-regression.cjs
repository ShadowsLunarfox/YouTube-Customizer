// Verifies the shared homepage column setting against both native Shorts layouts.
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
const legacyCard = index => `<ytd-rich-item-renderer is-slim-media data-short-card ${index >= 6 ? "hidden" : ""} style="width:240px">
  <div id="content"><ytd-rich-grid-slim-media><a href="/shorts/fixture-${index}"><ytd-thumbnail><img src="${cover}" alt="Short ${index}"></ytd-thumbnail></a>${metadata(index)}</ytd-rich-grid-slim-media></div></ytd-rich-item-renderer>`;
const rows = () => `<div class="ytGridShelfViewModelGridShelfRow">${[0,1,2,3].map(modernCard).join("")}</div>
  <div class="ytGridShelfViewModelGridShelfRow">${[4,5].map(modernCard).join("")}</div>
  <div class="ytGridShelfViewModelGridShelfRow" hidden>${[6,7].map(modernCard).join("")}</div>`;
const modernShelf = (id, direct = false) => `<grid-shelf-view-model id="${id}" class="ytGridShelfViewModelHost" data-shelf>
  <yt-section-header-view-model>Shorts</yt-section-header-view-model>
  ${direct ? rows() : `<div class="native-rows">${rows()}</div>`}
  <div class="ytGridShelfViewModelGridShelfBottomButtonContainer"><button class="expand">Show more</button></div>
</grid-shelf-view-model>`;
const fixture = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:14px Arial} [hidden]{display:none!important} ytd-app,ytd-browse,ytd-rich-grid-renderer,ytd-rich-grid-media,ytd-rich-grid-slim-media{display:block}
  #home{margin:56px 24px 0 240px} ytd-rich-grid-renderer{width:100%;min-width:0}
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

async function checkLayout(page, columns, visibleCount = 6) {
  const state = await page.evaluate(() => {
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {
      regular:[...document.querySelectorAll('[data-regular-card]')].map(rect),
      shelves:['legacy','modern','direct','nested'].map(id=>{const s=document.getElementById(id);return {id,panel:rect(s),header:s.querySelector('yt-section-header-view-model')?rect(s.querySelector('yt-section-header-view-model')):null,cards:[...s.querySelectorAll('[data-short-card]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({ ...rect(e),image:rect(e.querySelector('img')),menu:rect(e.querySelector('.more'))})),footer:rect(s.querySelector('.expand'))};}),
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
    };
  });
  assert.equal(state.overflow,false,'no horizontal overflow');
  assert.equal(state.regular.filter(r=>Math.abs(r.y-state.regular[0].y)<1).length,columns,'regular videos use the effective column count');
  for(const shelf of state.shelves) {
    assert.equal(shelf.cards.length,visibleCount,`${shelf.id}: native item visibility is preserved`);
    const rows=new Map();
    for(const card of shelf.cards) {const y=Math.round(card.y);if(!rows.has(y))rows.set(y,[]);rows.get(y).push(card);
      assert.ok(card.width>0,`${shelf.id}: visible card`);
      assert.ok(card.x>=shelf.panel.x-1&&card.right<=shelf.panel.right+1,`${shelf.id}: card stays inside the shelf`);
      assert.ok(card.image.x>=card.x-1&&card.image.right<=card.right+1,`${shelf.id}: native fixed Shorts width cannot overflow the card`);
      assert.ok(card.menu.right<=card.right+1,`${shelf.id}: menu remains within the card`);
      assert.ok(Math.abs(card.image.height/card.image.width-1.5)<.02,`${shelf.id}: portrait cover proportions are preserved`);
    }
    const firstRow=[...rows.values()][0];
    assert.equal(firstRow.length,Math.min(columns,visibleCount),`${shelf.id}: Shorts honor the homepage column count`);
    for(const row of rows.values())for(const card of row)assert.ok(Math.abs(card.width-firstRow[0].width)<1,`${shelf.id}: uniform widths across former native row boundaries`);
    assert.ok(shelf.footer.y>=Math.max(...shelf.cards.map(c=>c.bottom))-1,`${shelf.id}: footer stays below every card`);
    if(shelf.header)assert.ok(shelf.header.bottom<=shelf.cards[0].y&&shelf.header.width>=firstRow[0].width-1,`${shelf.id}: header spans the grid`);
  }
}

(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1440,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),60000);
  try {
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
    const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    await popup.evaluate(()=>chrome.storage.sync.set({videosPerRow:6,themeEnabled:true,hideShorts:false}));
    await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://www.youtube.com/');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#modern .native-rows')).display==='grid');
    await checkLayout(page,6);
    await popup.getByRole('tab',{name:'Layout'}).click();
    for(const selected of [2,3,4,5,6]) {
      await popup.locator('#videosPerRow').selectOption(String(selected));
      await page.waitForFunction(n=>getComputedStyle(document.querySelector('#modern .native-rows')).gridTemplateColumns.split(' ').length===n,selected);
      await checkLayout(page,selected);
    }
    for(const [width,columns] of [[2300,6],[1440,6],[1000,3],[800,3],[600,2],[390,1]]) {
      await page.setViewportSize({width,height:1000});await checkLayout(page,columns);
      if(process.env.YTC_SCREENSHOTS&&[1440,390].includes(width))await page.locator('#modern').screenshot({path:path.join(os.tmpdir(),`ytc-home-shorts-${width}.png`)});
    }
    await page.locator('#modern .more').first().click();await page.locator('#popup.open').waitFor();await page.keyboard.press('Escape');
    for(const shelf of ['legacy','modern','direct','nested'])await page.locator(`#${shelf} .expand`).click();await checkLayout(page,1,8);
    await page.setViewportSize({width:1440,height:1000});await checkLayout(page,6,8);
    await page.locator('#modern .native-rows').evaluate((el,html)=>{el.innerHTML=html;},`${[0,1,2].map(modernCard).join('')}<div class="ytGridShelfViewModelGridShelfRow">${[3,4,5,6,7].map(modernCard).join('')}</div>`);
    // Simulate YouTube rebuilding its rows after a resize or SPA navigation.
    await page.locator('#modern .native-rows').evaluate(el=>{const direct=[...el.children].filter(e=>e.hasAttribute('data-short-card'));const row=document.createElement('div');row.className='ytGridShelfViewModelGridShelfRow';el.prepend(row);direct.forEach(card=>row.append(card));});
    await checkLayout(page,6,8);
    assert.equal(await page.locator('#not-shorts .native-rows').evaluate(el=>getComputedStyle(el).display),'block','regular shelves are not flattened');
    assert.equal(await page.locator('#search-shorts .native-rows').evaluate(el=>getComputedStyle(el).display),'block','search shelves keep their existing layout');
    await page.locator('#direct').evaluate(el=>el.classList.add('ytGridShelfViewModelHostIsDismissed'));
    assert.equal(await page.locator('#direct').evaluate(el=>getComputedStyle(el).display),'none','native dismissal remains effective');
    await page.locator('#direct').evaluate(el=>el.classList.remove('ytGridShelfViewModelHostIsDismissed'));
    await popup.evaluate(()=>chrome.storage.sync.set({hideShorts:true}));
    await page.waitForFunction(()=>['legacy','modern','direct','nested'].every(id=>!document.getElementById(id).getBoundingClientRect().height));
    await popup.evaluate(()=>chrome.storage.sync.set({hideShorts:false,themeEnabled:false}));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#modern .native-rows')).display==='grid');await checkLayout(page,6,8);
    await page.reload();await page.waitForFunction(()=>getComputedStyle(document.querySelector('#modern .native-rows')).display==='grid');await checkLayout(page,6);
    await popup.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/'});await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.__ytProgressCustomizer.dispose()});});
    await page.waitForFunction(()=>!document.querySelector('#yt-custom-progress-style'));
    assert.equal(await page.locator('#modern .native-rows').evaluate(el=>getComputedStyle(el).display),'block','removing the extension restores native row grouping');
    assert.equal(await page.locator('#modern .ytGridShelfViewModelGridShelfRow').first().evaluate(el=>getComputedStyle(el).display),'flex','native flex rows are restored');
    assert.deepEqual(errors,[]);
    console.log('PASS: homepage Shorts follow 2–6 columns in classic, modern, direct-row, and nested shelves; responsive limits, popup changes, native width overrides, row rebuilding, expansion, menus, hide/dismiss behavior, persistence, and disposal.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
