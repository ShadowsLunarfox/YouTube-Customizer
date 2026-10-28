// The page entry must draw its logo without cross-origin extension image loads.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), master = fs.readFileSync(path.join(root, 'icons/logo-mark.svg'), 'utf8');
const header = music => music
  ? '<ytmusic-nav-bar><div id="right-content"><ytmusic-settings-button><button>Account</button></ytmusic-settings-button></div></ytmusic-nav-bar>'
  : '<ytd-masthead><div id="end"><div id="buttons"><button id="avatar-btn">Account</button></div></div></ytd-masthead>';
const fixture = music => `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="img-src 'none'">
<style>body{margin:0;background:#222;color:white}ytd-masthead,ytmusic-nav-bar{display:flex;height:64px;align-items:center;justify-content:flex-end}
#buttons,#right-content{display:flex;align-items:center}#avatar-btn,ytmusic-settings-button button{width:40px;height:40px}#movie_player{width:640px;height:360px}</style>
</head><body>${header(music)}<div id="movie_player" class="html5-video-player"><video></video></div></body></html>`;
(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true,
    viewport:{ width:1100, height:900 }, ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 60000), errors = [], blocked = [], requests = [];
  try {
    await context.route('https://*.youtube.com/**', route => route.fulfill({ contentType:'text/html', body:fixture(route.request().url().includes('music.youtube.com')) }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path:root });
    const admin = await context.newPage(); await admin.goto(`chrome-extension://${id}/popup.html`);
    await admin.waitForSelector('#settings-form:not([inert])');
    await admin.evaluate(() => chrome.storage.sync.set({ themeEnabled:true, uiOpacity:40, uiBlur:12 }));
    async function openPage(url) {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/\/icons\/icon-32\.png/.test(request.url())) requests.push(request.url()); });
      const log = await context.newCDPSession(page); await log.send('Log.enable');
      log.on('Log.entryAdded', ({ entry }) => { if (/icon-32\.png|Unsafe attempt to load URL chrome-extension:/.test(entry.text)) blocked.push(entry.text); });
      await page.goto(url); await page.waitForSelector('ytc-settings-entry [data-ytc-entry-icon]');
      return page;
    }
    async function checkIcon(page) {
      const state = await page.locator('ytc-settings-entry').evaluate((entry, master) => {
        const button = entry.shadowRoot.querySelector('button'), icon = button.querySelector('[data-ytc-entry-icon]');
        const shape = svg => [...svg.children].filter(node => node.localName !== 'title').map(node => [node.localName,
          [...node.attributes].map(attribute => [attribute.name, attribute.value]).sort((a,b) => a[0].localeCompare(b[0]))]);
        const expected = new DOMParser().parseFromString(master, 'image/svg+xml').documentElement;
        const box = icon.getBoundingClientRect(), buttonBox = button.getBoundingClientRect();
        return { shape:shape(icon), expected:shape(expected), icons:button.querySelectorAll('svg').length,
          images:button.querySelectorAll('img,image,use').length, width:box.width, height:box.height,
          buttonWidth:buttonBox.width, buttonHeight:buttonBox.height, hidden:icon.getAttribute('aria-hidden'),
          color:getComputedStyle(icon.querySelector('rect')).fill, label:button.getAttribute('aria-label') };
      }, master);
      assert.deepEqual(state.shape, state.expected, 'inline artwork matches the editable logo master');
      assert.equal(state.icons, 1); assert.equal(state.images, 0, 'entry contains no external image or SVG reference');
      assert.equal(state.width, 28); assert.equal(state.height, 28);
      assert.equal(state.buttonWidth, 40); assert.equal(state.buttonHeight, 40);
      assert.equal(state.hidden, 'true'); assert.equal(state.color, 'rgb(240, 68, 100)'); assert.ok(state.label);
    }
    const page = await openPage('https://www.youtube.com/watch?v=entry-icon');
    await checkIcon(page);
    await page.locator('ytc-settings-entry button').click();
    await page.waitForFunction(() => document.querySelector('ytc-settings-modal').shadowRoot.querySelector('#loading').hidden);
    await page.evaluate(() => {
      window.iconUpgrade = { button:document.querySelector('ytc-settings-entry').shadowRoot.querySelector('button'),
        frame:document.querySelector('ytc-settings-modal').shadowRoot.querySelector('iframe') };
      // Simulate the old image-based entry while keeping its real controller.
      const image = document.createElement('img'); image.alt = '';
      iconUpgrade.button.querySelector('svg').replaceWith(image);
    });
    await admin.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url:'https://www.youtube.com/watch?v=entry-icon' });
      await chrome.scripting.executeScript({ target:{ tabId:tab.id }, func:() => { globalThis.__ytProgressCustomizer.version = 'legacy-entry-icon'; } });
      await chrome.scripting.executeScript({ target:{ tabId:tab.id }, files:chrome.runtime.getManifest().content_scripts[0].js });
    });
    await page.waitForSelector('ytc-settings-entry [data-ytc-entry-icon]'); await checkIcon(page);
    assert.equal(await page.evaluate(() => iconUpgrade.button === document.querySelector('ytc-settings-entry').shadowRoot.querySelector('button') &&
      iconUpgrade.frame === document.querySelector('ytc-settings-modal').shadowRoot.querySelector('iframe') &&
      document.querySelector('ytc-settings-modal').shadowRoot.querySelector('dialog').open), true, 'upgrade repairs the icon while retaining the live button and authenticated menu');
    await page.frameLocator('ytc-settings-modal iframe').locator('#closePopup').click();
    await page.locator('ytc-settings-modal dialog').waitFor({ state:'hidden' });
    await page.locator('ytd-masthead').evaluate((element, html) => { element.outerHTML = html; }, header(false));
    await page.waitForSelector('ytc-settings-entry [data-ytc-entry-icon]'); await checkIcon(page);
    await page.locator('ytc-settings-entry').evaluate(entry => entry.remove());
    await page.waitForSelector('ytc-settings-entry [data-ytc-entry-icon]'); await checkIcon(page);
    await admin.evaluate(() => chrome.storage.sync.set({ themeEnabled:false }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-theme')); await checkIcon(page);
    const music = await openPage('https://music.youtube.com/watch?v=entry-icon'); await checkIcon(music);
    assert.deepEqual(requests, [], 'YouTube/Music never request the extension PNG');
    assert.deepEqual(blocked, [], 'no CSP or cross-origin icon-load errors');
    assert.deepEqual(errors, []);
    console.log('PASS: inline master artwork, blocked-image CSP, no extension image requests, preserved geometry/colors/accessibility, live-menu upgrade, header repair and Music.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
