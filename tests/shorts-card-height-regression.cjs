// Current Shorts lockups can also mount inside the classic rich-shelf wrapper.
// Keep their native rows/nodes, but give all thumbnails the same responsive box.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const nativeWidths = [130, 270, 220, 510, 265, 185];
const cover = i => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${120 + i * 80}" height="${100 + i * 130}"><rect width="100%" height="100%" fill="${['#8b5349','#467f70','#8057a3','#997e46','#4b738a','#aa6178'][i % 6]}"/><circle cx="50%" cy="35%" r="35" fill="#fff8"/><text x="8%" y="65%" font-size="24" fill="white">Short ${i + 1}</text></svg>`);
const metadata = i => `<div class="shortsLockupViewModelHostOutsideMetadata"><div><h3 class="shortsLockupViewModelHostMetadataTitle"><a href="/shorts/${i}">${i % 3 === 0 ? 'Short ' + i : i % 3 === 1 ? 'A much longer video title that needs more than one line' : '长标题与English一起验证缩略图和文字是否对齐'}</a></h3><div class="shortsLockupViewModelHostMetadataSubhead">${i + 1}K views</div></div><button class="more" aria-label="More">⋮</button></div>`;
const lockup = i => `<ytm-shorts-lockup-view-model-v2 class="shortsLockupViewModelHost" style="width:${nativeWidths[i % 6]}px"><ytm-shorts-lockup-view-model class="shortsLockupViewModelHost" style="width:${nativeWidths[i % 6]}px"><a class="shortsLockupViewModelHostEndpoint" href="/shorts/${i}"><div class="shortsLockupViewModelHostThumbnailParentContainer" style="width:${nativeWidths[i % 6]}px"><yt-thumbnail-view-model class="ytThumbnailViewModelHost"><div class="ytThumbnailViewModelImage"><img src="${cover(i % 6)}" alt="Short ${i}"></div></yt-thumbnail-view-model></div></a>${metadata(i)}</ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2>`;
const richCard = (i, classic = false) => `<ytd-rich-item-renderer data-card ${i >= 6 ? 'hidden' : ''} style="width:${nativeWidths[i % 6]}px"><div id="content">${classic ? `<ytd-rich-grid-slim-media><a id="thumbnail" href="/shorts/${i}"><ytd-thumbnail style="width:${nativeWidths[i % 6]}px;height:${nativeWidths[i % 6] * 1.5}px"><img src="${cover(i % 6)}" alt="Short ${i}"></ytd-thumbnail></a>${metadata(i)}</ytd-rich-grid-slim-media>` : lockup(i)}</div></ytd-rich-item-renderer>`;
const richShelf = (id, classic = false) => `<ytd-rich-shelf-renderer is-shorts id="${id}" data-shelf><div id="dismissible"><h2>Shorts</h2><div id="contents-container"><div id="contents">${Array.from({ length: 8 }, (_, i) => richCard(i, classic)).join('')}</div></div><div class="button-container"><button class="expand">Show more</button></div></div></ytd-rich-shelf-renderer>`;
const gridShelf = `<grid-shelf-view-model id="modern" data-shelf><h2>Shorts</h2><div class="native-rows"><div class="ytGridShelfViewModelGridShelfRow">${nativeWidths.map((width, i) => `<div class="ytGridShelfViewModelGridShelfItem" data-card style="width:${width}px">${lockup(i)}</div>`).join('')}</div></div></grid-shelf-view-model>`;
const fixture = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;color:white;background:#362e3a;font:14px/20px Arial}[hidden]{display:none!important}ytd-app,ytd-browse,ytd-rich-grid-renderer,ytd-rich-shelf-renderer,grid-shelf-view-model{display:block;box-sizing:border-box}#home{margin:24px 32px;max-width:1800px}h2{margin:0 0 16px}ytd-rich-shelf-renderer,grid-shelf-view-model{margin-bottom:32px;padding:8px;background:#ffffff18;border-radius:14px}#contents,.ytGridShelfViewModelGridShelfRow{display:flex;align-items:stretch}.ytGridShelfViewModelGridShelfItem,ytd-rich-item-renderer{display:flex;align-items:center;justify-content:center;min-width:0;box-sizing:border-box}#content{display:flex;align-items:center;justify-content:center}ytd-rich-grid-slim-media{display:block}.shortsLockupViewModelHost{display:inline-block;position:relative;flex-shrink:1}.shortsLockupViewModelHostEndpoint,#thumbnail{display:block;color:inherit;text-decoration:none}.shortsLockupViewModelHostThumbnailParentContainer{border-radius:12px;overflow:hidden}yt-thumbnail-view-model,ytd-thumbnail{display:block;position:relative;overflow:hidden;border-radius:12px}yt-thumbnail-view-model:before{content:'';display:block;padding-top:150%}.ytThumbnailViewModelImage{position:absolute;inset:0}img{display:block;width:100%;height:100%;object-fit:cover}.shortsLockupViewModelHostOutsideMetadata{display:flex;position:relative;padding-top:8px;min-width:0}.shortsLockupViewModelHostOutsideMetadata>div{flex:1;min-width:0}.shortsLockupViewModelHostMetadataTitle{font-size:14px;line-height:20px;margin:0 0 4px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}.shortsLockupViewModelHostMetadataTitle a{color:inherit;text-decoration:none}.shortsLockupViewModelHostMetadataSubhead{font-size:12px;line-height:18px}.more{width:32px;height:32px;flex:none;cursor:pointer}.button-container{margin:12px auto 0;width:240px}button{cursor:pointer}#outside{display:block;width:min(460px,calc(100% - 48px));margin:24px}#outside .shortsLockupViewModelHost{width:160px!important}
</style><ytd-app><ytd-browse page-subtype="home" id="home"><ytd-rich-grid-renderer>${richShelf('hybrid')}${gridShelf}${richShelf('classic', true)}</ytd-rich-grid-renderer></ytd-browse><div id="outside">${lockup(0)}</div></ytd-app><script>window.menuClicks=0;document.addEventListener('click',e=>{if(e.target.closest('.more'))menuClicks++;if(e.target.closest('.expand')){const s=e.target.closest('[data-shelf]');s.querySelectorAll('[hidden]').forEach(n=>n.hidden=false)}if(e.target.closest('a'))e.preventDefault()});</script>`;
async function geometry(page, id) {
  return page.locator('#' + id).evaluate(s => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right }; };
    return [...s.querySelectorAll('[data-card]')].filter(e => e.getBoundingClientRect().width > 0).map(e => ({ card:rect(e),thumb:rect(e.querySelector('yt-thumbnail-view-model,ytd-thumbnail')),title:rect(e.querySelector('h3')),views:rect(e.querySelector('.shortsLockupViewModelHostMetadataSubhead')),menu:rect(e.querySelector('.more')) }));
  });
}
async function check(page, columns, equal = true, expanded = false) {
  for (const id of ['hybrid','modern','classic']) {
    const cards = await geometry(page, id), first = cards[0];
    assert.equal(cards.length, expanded && id === 'hybrid' ? 8 : columns, id + ': responsive visible count');
    for (const [i, c] of cards.entries()) {
      assert.ok(Math.abs(c.thumb.w - first.thumb.w) < 1 && Math.abs(c.thumb.h - first.thumb.h) < 1, id + ': one thumbnail size ' + JSON.stringify(cards));
      assert.ok(Math.abs(c.thumb.h / c.thumb.w - 1.5) < .02, id + ': 2:3 frame');
      assert.ok(c.thumb.x >= c.card.x - 1 && c.thumb.r <= c.card.r + 1, id + ': thumbnail fits');
      assert.ok(c.menu.r <= c.card.r + 1, id + ': menu fits');
      if (i < columns) {
        assert.ok(Math.abs(c.thumb.y - first.thumb.y) < 1, id + ': top alignment');
        if (equal) assert.ok(Math.abs(c.views.y - first.views.y) < 1, id + ': view-count alignment');
      }
    }
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no page overflow');
}
(async () => {
  const context = await chromium.launchPersistentContext('', {channel:'chrome',headless:true,viewport:{width:1998,height:1100},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline = setTimeout(() => void context.close(), 90000);
  try {
    await context.route('https://www.youtube.com/**', r => r.fulfill({contentType:'text/html',body:fixture}));
    const cdp = await context.browser().newBrowserCDPSession(), {id} = await cdp.send('Extensions.loadUnpacked',{path:root});
    const admin = await context.newPage(); await admin.goto(`chrome-extension://${id}/popup.html`); await admin.waitForFunction(() => initialized);
    await admin.evaluate(() => chrome.storage.sync.set({themeEnabled:true,customizeCards:true,cardPadding:8,cardBorderWidth:1,videosPerRow:6,equalCardHeights:true}));
    const page = await context.newPage(); await page.goto('https://www.youtube.com/'); await page.waitForSelector('#modern [data-ytc-home-shorts-grid="1"]');
    console.log('Hybrid thumbnail heights:', JSON.stringify((await geometry(page,'hybrid')).map(c => c.thumb.h)));
    await page.locator('#hybrid').screenshot({path:path.join(os.tmpdir(),'ytc-shorts-height-hybrid.png')});
    await check(page,6);
    await page.evaluate(() => { globalThis.originalParents = [...document.querySelectorAll('[data-card]')].map(e => [e,e.parentElement]); });
    for (const [width,columns] of [[1440,6],[900,3],[600,2],[390,1],[1998,6]]) { await page.setViewportSize({width,height:1100}); await check(page,columns); }
    await page.locator('#hybrid [data-ytc-home-shorts-toggle]').click(); await check(page,6,true,true);
    await page.locator('#hybrid [data-ytc-home-shorts-toggle]').click(); await check(page,6);
    await page.locator('#hybrid .more').first().click(); assert.equal(await page.evaluate(() => menuClicks),1);
    await admin.evaluate(() => chrome.storage.sync.set({customizeCards:false}));
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-cards')); await check(page,6);
    await admin.evaluate(() => chrome.storage.sync.set({customizeCards:true,cardPadding:20,cardTitleLines:3}));
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ytc-card-padding').trim() === '20px'); await check(page,6);
    await admin.evaluate(() => chrome.storage.sync.set({equalCardHeights:false}));
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ytc-card-alignment').trim() === 'start'); await check(page,6,false);
    await admin.evaluate(() => chrome.storage.sync.set({equalCardHeights:true,themeEnabled:false}));
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-theme')); await check(page,6);
    const outside = await page.locator('#outside').evaluate(e => e.querySelector('ytm-shorts-lockup-view-model').getBoundingClientRect().width); assert.equal(outside,160,'outside lockups keep native sizing');
    assert.equal(await page.evaluate(() => originalParents.every(([e,p]) => e.parentElement === p)),true,'native ownership remains intact');
    // A lazy replacement must receive the same normalization.
    await page.locator('#hybrid #contents').evaluate((e,html) => {e.innerHTML = html;},Array.from({length:8},(_,i)=>richCard(i)).join(''));
    await page.waitForSelector('#hybrid ytm-shorts-lockup-view-model[data-ytc-home-shorts-lockup="1"]'); await check(page,6);
    await page.locator('#hybrid').evaluate(e => e.removeAttribute('is-shorts'));
    await page.waitForFunction(() => !document.querySelector('#hybrid [data-ytc-home-shorts-card]'));
    await page.locator('#hybrid').evaluate(e => e.setAttribute('is-shorts',''));
    await page.waitForSelector('#hybrid ytm-shorts-lockup-view-model[data-ytc-home-shorts-lockup="1"]'); await check(page,6);
    await page.setViewportSize({width:1440,height:1100}); await page.locator('#hybrid').screenshot({path:path.join(os.tmpdir(),'ytc-shorts-height-after.png')});
    console.log('PASS: hybrid/classic/modern Shorts use equal responsive thumbnail frames, aligned titles/views, live card options, native menus/expansion, lazy replacement and scoped sizing.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
