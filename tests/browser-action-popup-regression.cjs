// Exercise the real Chrome action popup, its live tab target and the separate page entry.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = `<!doctype html><html><head><style>
  body{margin:0;background:#222;color:white;font:14px Arial}ytd-app,ytd-masthead{display:block}
  ytd-masthead{display:flex;justify-content:flex-end;height:56px}#buttons{display:flex}#avatar-btn{width:40px;height:40px}
  #movie_player{position:relative;width:640px;height:360px;margin:24px;background:#111}video{width:100%;height:100%}
  .ytp-play-progress{height:5px;width:50%;background:red}
  </style></head><body><ytd-app><ytd-masthead><div id="end"><div id="buttons"><ytd-topbar-menu-button-renderer><button id="avatar-btn">A</button></ytd-topbar-menu-button-renderer></div></div></ytd-masthead>
  <div id="movie_player" class="html5-video-player"><video muted></video><div class="ytp-play-progress"></div></div></ytd-app></body></html>`;
(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true,
    viewport:{width:1280,height:900}, ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 90000), errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:fixture}));
    await context.route('https://example.invalid/**', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Other website</title><p>Other website</p>'}));
    const cdp = await context.browser().newBrowserCDPSession(), {id} = await cdp.send('Extensions.loadUnpacked',{path:root});
    const admin = await context.newPage(); await admin.goto('chrome-extension://' + id + '/popup.html');
    await admin.waitForSelector('#settings-form:not([inert])');
    const page = await context.newPage(); await page.goto('https://www.youtube.com/watch?v=action-popup');
    await page.waitForSelector('ytc-settings-entry');
    const tab = await admin.evaluate(async () => {
      const [tab] = await chrome.tabs.query({url:'https://www.youtube.com/watch?v=action-popup'});
      await chrome.tabs.update(tab.id,{active:true}); return tab;
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const action = await worker.evaluate(async tabId => ({popup:await chrome.action.getPopup({tabId}),pageHandler:chrome.action.onClicked.hasListeners()}),tab.id);
    assert.equal(action.popup,'chrome-extension://' + id + '/popup.html');
    assert.equal(action.pageHandler,false,'toolbar action has no handler that opens a page dialog');
    const windowsBefore = await admin.evaluate(async () => (await chrome.windows.getAll()).length);
    async function open() {
      await admin.evaluate(() => chrome.action.openPopup());
      await admin.waitForFunction(() => chrome.extension.getViews({type:'popup'}).some(view => view.document.querySelector('#settings-form:not([inert])')));
    }
    async function close() {
      await admin.evaluate(() => chrome.extension.getViews({type:'popup'}).forEach(view => view.close()));
      await admin.waitForFunction(() => chrome.extension.getViews({type:'popup'}).length === 0);
    }
    const snapshot = () => admin.evaluate(async () => {
      const view = chrome.extension.getViews({type:'popup'})[0], doc = view.document;
      const status = doc.querySelector('.status-bar').getBoundingClientRect();
      return {target:(await view.getPreviewTab())?.id,width:view.innerWidth,height:view.innerHeight,
        panel:doc.querySelector('.panel').getBoundingClientRect().height,statusBottom:status.bottom,
        horizontalOverflow:doc.documentElement.scrollWidth > view.innerWidth,
        framed:view !== view.top,windowLayout:doc.documentElement.hasAttribute('data-settings-window'),
        tabs:[...doc.querySelectorAll('[role="tab"]')].map(el => el.id),progressColor:doc.querySelector('#progressColor').value};
    });
    await open();
    const first = await snapshot();
    assert.equal(first.target,tab.id,'native popup targets the active YouTube tab');
    assert.equal(first.framed,false); assert.equal(first.windowLayout,false);
    assert.deepEqual(first.tabs,['appearance','player','records','shortcuts','audio','layout','backup'].map(name => 'tab-' + name));
    assert.ok(first.height >= 300,'popup opens at a usable height: ' + JSON.stringify(first));
    assert.ok(first.panel <= first.height && first.statusBottom <= first.height,'popup fits the browser height limit');
    assert.equal(first.horizontalOverflow,false);
    const nativeContexts = await worker.evaluate(() => chrome.runtime.getContexts({contextTypes:['POPUP']}));
    assert.equal(nativeContexts.length,1,'settings are rendered in a real browser popup context');
    assert.equal(await admin.evaluate(async () => (await chrome.windows.getAll()).length),windowsBefore,'toolbar popup does not create a browser window');
    assert.equal(await page.locator('ytc-settings-modal').count(),0,'opening the browser action does not mount a page dialog');
    for (const name of ['appearance','player','records','shortcuts','audio','layout','backup']) {
      await admin.evaluate(name => {
        const view = chrome.extension.getViews({type:'popup'})[0], button = view.document.querySelector('#tab-' + name);
        button.scrollIntoView({block:'nearest'}); button.click();
      },name);
      assert.equal(await admin.evaluate(name => chrome.extension.getViews({type:'popup'})[0].document.querySelector('#' + name + '-panel').hidden,name),false);
    }
    await admin.evaluate(() => {
      const view = chrome.extension.getViews({type:'popup'})[0], doc = view.document;
      doc.querySelector('#tab-player').click();
      const input = doc.querySelector('#progressColor'); input.value = '#714ec7';
      input.dispatchEvent(new view.Event('input',{bubbles:true})); input.dispatchEvent(new view.Event('change',{bubbles:true}));
    });
    await admin.waitForFunction(async () => (await chrome.storage.sync.get('progressColor')).progressColor === '#714ec7');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.ytp-play-progress')).backgroundColor === 'rgb(113, 78, 199)');
    const footer = await admin.evaluate(() => {
      const view = chrome.extension.getViews({type:'popup'})[0], button = view.document.querySelector('#closePopup');
      button.scrollIntoView({block:'nearest'}); const r = button.getBoundingClientRect();
      return {y:r.y,bottom:r.bottom,height:view.innerHeight};
    });
    assert.ok(footer.y >= 0 && footer.bottom <= footer.height,'footer remains reachable in a height-limited popup');
    await close(); await open(); assert.equal((await snapshot()).progressColor,'#714ec7','reopening keeps saved settings'); await close();
    await page.goto('https://example.invalid/'); await open();
    assert.equal((await snapshot()).target,tab.id,'popup is also available when another website is active');
    assert.equal(await page.locator('ytc-settings-modal').count(),0); await close();
    await page.goto('https://www.youtube.com/watch?v=action-popup'); await page.waitForSelector('ytc-settings-entry');
    await page.locator('ytc-settings-entry button').click(); await page.waitForSelector('ytc-settings-modal dialog[open]');
    await page.waitForFunction(() => document.querySelector('ytc-settings-modal')?.shadowRoot.querySelector('iframe')?.src);
    const frameURL = await page.locator('ytc-settings-modal iframe').getAttribute('src');
    const view = page.frames().find(frame => frame.url() === frameURL); await view.waitForSelector('#settings-form:not([inert])');
    assert.equal(await admin.evaluate(() => chrome.extension.getViews({type:'popup'}).length),0,'avatar entry opens only the page menu');
    await view.locator('#closeInPage').click(); await page.locator('ytc-settings-modal dialog').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);
    console.log('PASS: real native toolbar popup, complete form, active-tab live preview, saved edits/reopen, height-limited scrolling/footer, other-site access, and independent avatar page entry.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
