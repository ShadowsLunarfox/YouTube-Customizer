// Layout hiding must win over the watch filter's glass skin and remove its box.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chip = id => `<yt-chip-cloud-renderer id="${id}"><div id="container"><div id="scroll-container"><div id="chips"><yt-chip-cloud-chip-renderer selected><div id="chip-container">All</div></yt-chip-cloud-chip-renderer><yt-chip-cloud-chip-renderer><div id="chip-container">From the series</div></yt-chip-cloud-chip-renderer></div></div></div></yt-chip-cloud-renderer>`;
const fixture = modern => `<!doctype html><style>
  body{margin:0;color:white;background:#342f38;font:14px Arial}ytd-app,ytd-watch-flexy,ytd-watch-grid,ytd-watch-next-secondary-results-renderer,ytd-browse,ytd-feed-filter-chip-bar-renderer{display:block}
  #related{width:540px;margin:24px}yt-chip-cloud-renderer{display:block;height:56px;margin-bottom:12px}yt-chip-cloud-chip-renderer{display:inline-block;padding:8px}#next-video,#description{display:block;height:80px;margin:0}#home{margin:24px}
  </style><ytd-app><${modern?'ytd-watch-grid':'ytd-watch-flexy'}><div id="related"><ytd-watch-next-secondary-results-renderer>${chip('shared')}<article id="next-video">Related video</article></ytd-watch-next-secondary-results-renderer>${chip('standalone')}<yt-chip-cloud-renderer id="empty"></yt-chip-cloud-renderer></div><article id="description">Description</article></${modern?'ytd-watch-grid':'ytd-watch-flexy'}><ytd-browse page-subtype="home" id="home"><ytd-feed-filter-chip-bar-renderer>${chip('home-chips')}</ytd-feed-filter-chip-bar-renderer></ytd-browse></ytd-app>`;
async function hidden(page, id) {
  return page.locator('#' + id).evaluate(e => !e.getClientRects().length && e.getBoundingClientRect().height === 0);
}
(async () => {
  const context = await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1024,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline = setTimeout(() => void context.close(),90000);
  try {
    await context.route('https://www.youtube.com/**',r => r.fulfill({contentType:'text/html',body:fixture(r.request().url().includes('modern'))}));
    const cdp = await context.browser().newBrowserCDPSession(), {id} = await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
    const admin = await context.newPage(); await admin.goto(`chrome-extension://${id}/popup.html`); await admin.waitForFunction(() => initialized);
    for (const modern of [false,true]) {
      await admin.evaluate(() => Promise.all([chrome.storage.sync.set({themeEnabled:true,hideHomeTopicBar:false,hideRelated:false}),chrome.storage.local.set({pageProfiles:{}})]));
      const page = await context.newPage(); await page.goto(`https://www.youtube.com/watch?v=${modern?'modern':'classic'}-hidden-filters`);
      await page.waitForSelector('#shared[data-ytc-universal-clear]');
      const before = await page.locator('#next-video').evaluate(e => e.getBoundingClientRect().y), height = await page.locator('#shared').evaluate(e => e.getBoundingClientRect().height);
      const tabId = await admin.evaluate(async url => (await chrome.tabs.query({url}))[0].id,page.url());
      const menu = await context.newPage(); await menu.goto(`chrome-extension://${id}/popup.html?window=1&target=${tabId}`); await menu.waitForFunction(() => initialized);
      await menu.locator('#tab-layout').click(); await menu.locator('#hideHomeTopicBar').check();
      await menu.waitForFunction(async () => (await chrome.storage.sync.get('hideHomeTopicBar')).hideHomeTopicBar === true);
      await page.waitForFunction(() => document.querySelector('#yt-custom-progress-style').textContent.includes('yt-chip-cloud-renderer:has(yt-chip-cloud-chip-renderer)'));
      for (const name of ['shared','standalone','empty','home-chips']) assert.equal(await hidden(page,name),true,`${modern?'modern':'classic'}: ${name} is fully hidden`);
      assert.ok(before - await page.locator('#next-video').evaluate(e => e.getBoundingClientRect().y) >= height,'the next video moves into the released space');
      assert.equal(await hidden(page,'next-video'),false); assert.equal(await hidden(page,'description'),false);
      await page.evaluate(() => {const e = document.createElement('yt-chip-cloud-renderer');e.id='late';document.querySelector('#related').append(e);});
      assert.equal(await hidden(page,'late'),true,'new/empty watch filters have no visible frame');
      // Live page-theme changes do not disable a layout preference.
      await admin.evaluate(() => chrome.storage.sync.set({themeEnabled:false}));
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-theme'));
      assert.equal(await hidden(page,'shared'),true);
      // A Watch override takes precedence without changing the shared/Home switch.
      await admin.evaluate(() => chrome.storage.local.set({pageProfiles:{watch:{enabled:true,settings:{hideHomeTopicBar:false}}}}));
      await page.waitForFunction(() => document.querySelector('#shared').getBoundingClientRect().height > 0);
      assert.equal(await hidden(page,'home-chips'),false,'the fixture resolves its single document using the Watch configuration');
      await admin.evaluate(() => chrome.storage.local.set({pageProfiles:{}}));
      await page.waitForFunction(() => !document.querySelector('#shared').getClientRects().length);
      await menu.evaluate(() => dispatchEvent(new Event('focus'))); await menu.waitForFunction(() => !form.inert && fields.hideHomeTopicBar.checked);
      await menu.locator('#hideHomeTopicBar').uncheck();
      await page.waitForFunction(() => document.querySelector('#shared').getBoundingClientRect().height > 0);
      assert.equal(await hidden(page,'standalone'),false); assert.equal(await hidden(page,'home-chips'),false);
      await admin.evaluate(() => chrome.storage.sync.set({themeEnabled:true}));
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-ytc-theme'));
      assert.equal(await page.locator('#shared').evaluate(e => getComputedStyle(e).borderRadius),'12px','showing the filter restores its glass frame');
      // Hiding recommendations also includes their standalone filter frames.
      await admin.evaluate(() => chrome.storage.sync.set({hideRelated:true}));
      await page.waitForFunction(() => !document.querySelector('#next-video').getClientRects().length);
      for (const name of ['shared','standalone','empty','late']) assert.equal(await hidden(page,name),true,'hidden recommendations include ' + name);
      assert.equal(await hidden(page,'description'),false); assert.equal(await hidden(page,'home-chips'),false);
      await admin.evaluate(() => chrome.storage.sync.set({hideRelated:false}));
      await page.waitForFunction(() => document.querySelector('#next-video').getBoundingClientRect().height > 0);
      assert.equal(await hidden(page,'shared'),false); assert.equal(await hidden(page,'standalone'),false);
      await menu.close(); await page.close();
    }
    console.log('PASS: actual hide checkbox, classic/modern watch filters and empty frames, Home filters, released space, lazy insertion, theme on/off, Watch overrides, hide-related and live show/restore.');
  } finally {clearTimeout(deadline);await context.close()}
})().catch(e => {console.error(e);process.exitCode=1});
