// Optional live check: use current YouTube DOM/CSS in a stable mixed rich shelf.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const context = await chromium.launchPersistentContext('', {channel:'chrome',headless:true,viewport:{width:1998,height:1100},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline = setTimeout(() => void context.close(),90000);
  try {
    const cdp = await context.browser().newBrowserCDPSession(), {id} = await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
    const admin = await context.newPage(); await admin.goto(`chrome-extension://${id}/popup.html`); await admin.waitForFunction(() => initialized);
    await admin.evaluate(() => chrome.storage.sync.set({themeEnabled:true,customizeCards:true,videosPerRow:6,cardPadding:8,cardBorderWidth:1,cardRadius:12}));
    const live = await context.newPage(); await live.goto('https://www.youtube.com/results?search_query=shorts',{waitUntil:'domcontentloaded',timeout:45000});
    await live.locator('ytm-shorts-lockup-view-model-v2').first().waitFor({state:'visible',timeout:25000});
    const native = await live.evaluate(() => ({
      rootFontSize:getComputedStyle(document.documentElement).fontSize,
      fontFamily:getComputedStyle(document.body).fontFamily,
      styles:[...document.styleSheets].filter(s => s.ownerNode?.id !== 'yt-custom-progress-style').map(s => {
        try {return [...s.cssRules].map(rule => rule.cssText).join('\n')} catch {return ''}
      }).join('\n'),
      cards:[...document.querySelectorAll('ytm-shorts-lockup-view-model-v2')].slice(0,6).map((e,i) => {
        const clone = e.cloneNode(true);
        for (const host of [clone,...clone.querySelectorAll('ytm-shorts-lockup-view-model')]) host.style.width = [130,270,220,510,265,185][i] + 'px';
        return clone.outerHTML;
      })
    }));
    assert.equal(native.cards.length,6,'six native Shorts cards are available');
    const html = `<!doctype html><html dark><meta charset="utf-8"><style>${native.styles}</style><style>
      html{font-size:${native.rootFontSize}}body{margin:0;font-family:${native.fontFamily}}#native-home{display:block;margin:32px;max-width:1750px}#native-home ytd-rich-grid-renderer{display:block;width:100%}
      #native-shelf{display:block;width:100%;padding:12px;box-sizing:border-box}#native-shelf #contents{display:flex}
      #native-shelf #content{display:flex;justify-content:center;align-items:center}#native-shelf ytd-rich-item-renderer{display:flex;align-items:center}
      #native-shelf h2{font:700 20px Arial;margin:0 0 16px}
      </style><ytd-app><ytd-browse page-subtype="home" id="native-home"><ytd-rich-grid-renderer><ytd-rich-shelf-renderer is-shorts id="native-shelf"><div id="dismissible"><h2>Shorts</h2><div id="contents-container"><div id="contents">
      ${native.cards.map(card => `<ytd-rich-item-renderer><div id="content">${card}</div></ytd-rich-item-renderer>`).join('')}
      </div></div></div></ytd-rich-shelf-renderer></ytd-rich-grid-renderer></ytd-browse></ytd-app></html>`;
    await context.route('https://www.youtube.com/',r => r.fulfill({contentType:'text/html',body:html}));
    const page = await context.newPage(); await page.goto('https://www.youtube.com/'); await page.waitForSelector('#native-shelf [data-ytc-home-shorts-grid="1"]');
    const rows = await page.locator('#native-home').evaluate(h => [...h.querySelectorAll('[data-ytc-home-shorts-card="1"]')].map(c => {
      const thumb = c.querySelector('yt-thumbnail-view-model').getBoundingClientRect(), title = c.querySelector('h3'), views = c.querySelector('.shortsLockupViewModelHostMetadataSubhead');
      const details = e => {const r = e.getBoundingClientRect(),s = getComputedStyle(e);return {top:r.y,height:r.height,lineHeight:s.lineHeight,font:s.fontSize,minHeight:s.minHeight,margin:s.margin,padding:s.padding,display:s.display}};
      return {w:thumb.width,h:thumb.height,top:thumb.y,title:details(title),views:details(views),metadata:details(title.parentElement.parentElement)};
    }));
    console.log(JSON.stringify(rows.map(r => ({width:r.w,height:r.h,top:r.top,title:r.title.top,views:r.views.top}))));
    for (const r of rows) {
      assert.ok(Math.abs(r.h - rows[0].h) < 1 && Math.abs(r.top - rows[0].top) < 1,'native thumbnails align');
      assert.ok(Math.abs(r.h / r.w - 1.5) < .02,'native 2:3 frame');
      assert.ok(Math.abs(r.views.top - rows[0].views.top) < 1,'native view counts align');
    }
    await page.locator('#native-shelf').screenshot({path:path.join(os.tmpdir(),'ytc-shorts-native-height-after.png')});
    console.log('PASS: current YouTube thumbnail/metadata DOM and CSS, mixed rich shelf, equal thumbnail heights and aligned view counts.');
  } finally {clearTimeout(deadline);await context.close()}
})().catch(e => {console.error(e);process.exitCode=1});
