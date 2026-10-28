// Old content scripts survive extension reloads. Their DOM callbacks must stay safe.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

function checkLanguageAfterInvalidation() {
  let calls = 0, invalid = false;
  const sandbox = { navigator:{ languages:['ja-JP'] }, chrome:{ i18n:{ getUILanguage() {
    calls++; if (invalid) throw Error('Extension context invalidated.'); return 'zh-HK';
  } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8'), sandbox);
  const i18n = sandbox.YTCustomizerI18n;
  assert.equal(i18n.resolveLanguage('ko'), 'ko');
  assert.equal(calls, 0, 'explicit languages never query extension APIs');
  assert.equal(i18n.resolveLanguage('auto'), 'zh-TW');
  invalid = true;
  assert.equal(i18n.translate('Open menu', 'auto'), '打開選單');
  assert.equal(calls, 1, 'automatic language is cached before the old context disappears');
  const stale = { navigator:{ languages:['th-TH'] }, chrome:{ i18n:{ getUILanguage() { throw Error('Extension context invalidated.'); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8'), stale);
  assert.equal(stale.YTCustomizerI18n.resolveLanguage('auto'), 'th', 'an already invalid context falls back to the browser language');
}

async function checkSynchronousMessageFailure() {
  const sandbox = { chrome:{ runtime:{ id:'test', sendMessage() { throw Error('Extension context invalidated.'); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'settings.js'), 'utf8'), sandbox);
  let pending;
  assert.doesNotThrow(() => { pending = sandbox.YTCustomizer.sendRuntimeMessage({ type:'TEST' }); });
  await assert.rejects(pending, /Extension context invalidated/);
  assert.doesNotThrow(() => sandbox.YTCustomizer.removeExtensionListener({ removeListener() { throw Error('Extension context invalidated.'); } }, () => {}));
}

const fixture = `<!doctype html><html><head><style>
body{margin:0;background:#333;color:white}ytd-masthead{display:block;height:64px}#buttons{display:flex;justify-content:flex-end}
.html5-video-player{position:relative;width:640px;height:360px;margin:20px}video{width:100%;height:100%}
.ytp-right-controls{position:absolute;bottom:0;right:0}.ytp-button{width:40px;height:32px}
.ytp-progress-bar-container{position:absolute;bottom:40px;width:100%;height:8px}
</style></head><body><ytd-app><ytd-masthead><div id="end"><div id="buttons"><button id="avatar-btn">Avatar</button></div></div></ytd-masthead>
<ytd-watch-flexy><div id="movie_player" class="html5-video-player"><video muted></video><div class="ytp-progress-bar-container"></div>
<div class="ytp-right-controls"><button class="ytp-button">CC</button></div></div></ytd-watch-flexy></ytd-app></body></html>`;

(async () => {
  checkLanguageAfterInvalidation();
  await checkSynchronousMessageFailure();
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true,
    viewport:{ width:1100, height:900 }, ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType:'text/html', body:fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path:root });
    const worker = context.serviceWorkers().find(worker => worker.url().includes(id)) || await context.waitForEvent('serviceworker');
    const menu = await context.newPage(); await menu.goto(`chrome-extension://${id}/popup.html`);
    await menu.waitForSelector('#settings-form:not([inert])');
    await menu.evaluate(() => chrome.storage.local.set({ menuLanguage:'auto' }));
    const page = await context.newPage(), pageErrors = [], iconErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /icons\/icon-32\.png/.test(message.text())) iconErrors.push(message.text()); });
    await page.goto('https://www.youtube.com/watch?v=reload-test'); await page.waitForSelector('ytc-settings-entry');
    await menu.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url:'https://www.youtube.com/watch?v=reload-test' });
      await chrome.scripting.executeScript({ target:{ tabId:tab.id }, func:() => {
        const errors = [];
        const record = message => { errors.push(message); document.documentElement.dataset.reloadErrors = JSON.stringify(errors); };
        window.addEventListener('error', event => record(event.message));
        window.addEventListener('unhandledrejection', event => record(String(event.reason?.message || event.reason)));
        document.documentElement.dataset.reloadErrors = '[]';
        // Run the original world's closure after its extension APIs are invalid.
        document.addEventListener('ytc-test-language', () => {
          document.documentElement.dataset.reloadContext = String(YTCustomizer.hasExtensionContext());
          document.documentElement.dataset.reloadLanguage = YTCustomizerI18n.resolveLanguage('auto');
          document.documentElement.dataset.reloadExplicit = YTCustomizerI18n.translate('Open menu', 'zh-CN');
        });
        document.addEventListener('ytc-test-dispose', () => {
          globalThis.__ytProgressCustomizer.dispose();
          document.documentElement.dataset.reloadDisposed = 'yes';
        });
      } });
    });
    await page.locator('ytc-settings-entry button').click();
    const modal = page.locator('ytc-settings-modal dialog');
    await modal.waitFor({ state:'visible' });
    await page.waitForFunction(() => document.querySelector('ytc-settings-modal').shadowRoot.querySelector('#loading').hidden);
    await page.evaluate(() => {
      window.oldPlayer = document.querySelector('#movie_player');
      window.oldEntryIcon = document.querySelector('ytc-settings-entry').shadowRoot.querySelector('[data-ytc-entry-icon]');
    });
    await worker.evaluate(() => chrome.runtime.reload()).catch(() => {});
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.mouse.click(2, 2);
    await page.evaluate(() => {
      document.dispatchEvent(new Event('ytc-test-language'));
      document.dispatchEvent(new Event('enterpictureinpicture'));
      window.dispatchEvent(new Event('focus'));
      document.querySelector('#movie_player').classList.add('paused-mode');
      document.querySelector('#movie_player video').dispatchEvent(new Event('durationchange', { bubbles:true }));
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.waitForTimeout(250);
    const state = await page.evaluate(() => ({ errors:JSON.parse(document.documentElement.dataset.reloadErrors),
      language:document.documentElement.dataset.reloadLanguage, explicit:document.documentElement.dataset.reloadExplicit,
      context:document.documentElement.dataset.reloadContext,
      open:document.querySelector('ytc-settings-modal').shadowRoot.querySelector('dialog').open,
      samePlayer:window.oldPlayer === document.querySelector('#movie_player') }));
    console.log('After actual reload:', JSON.stringify({ ...state, pageErrors }));
    assert.deepEqual(state.errors, [], 'no synchronous exceptions or rejected callbacks after a real extension reload');
    assert.deepEqual(pageErrors, []);
    assert.equal(state.explicit, '打开菜单'); assert.equal(state.language, 'en');
    assert.equal(state.open, false, 'an old authenticated iframe can be closed after its extension reloads');
    assert.equal(state.samePlayer, true, 'context recovery does not reload or replace the native video');
    assert.equal(await page.evaluate(() => oldEntryIcon === document.querySelector('ytc-settings-entry').shadowRoot.querySelector('[data-ytc-entry-icon]') && oldEntryIcon.getBoundingClientRect().width === 28), true, 'the inline logo remains rendered after extension invalidation');
    assert.deepEqual(iconErrors, [], 'reload causes no forbidden extension image fetch');
    await page.locator('ytc-settings-entry button').click();
    await page.waitForFunction(() => document.querySelector('ytc-settings-modal').shadowRoot.querySelector('#loading').dataset.error === '1');
    assert.equal(await page.locator('ytc-settings-modal #loading').textContent(), 'Could not open settings. Refresh YouTube and try again.');
    assert.equal(await page.locator('ytc-settings-modal iframe').count(), 0, 'a stale menu shows recovery guidance without creating an invalid extension iframe');
    await page.locator('ytc-settings-modal #loading-close').click();
    // Old runtime disposal must release DOM listeners even when Chrome event APIs are gone.
    await page.evaluate(() => document.dispatchEvent(new Event('ytc-test-dispose')));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.reloadDisposed), 'yes');
    assert.deepEqual(await page.evaluate(() => JSON.parse(document.documentElement.dataset.reloadErrors)), []);
    // Install a fresh CDP build after retiring the invalidated script world.
    await cdp.send('Extensions.uninstall', { id });
    const fresh = await cdp.send('Extensions.loadUnpacked', { path:root });
    assert.equal(fresh.id, id);
    await page.reload(); await page.waitForSelector('ytc-settings-entry');
    await page.locator('ytc-settings-entry button').click();
    await page.waitForFunction(() => document.querySelector('ytc-settings-modal').shadowRoot.querySelector('#loading').hidden);
    assert.equal(await page.locator('ytc-settings-entry').count(), 1, 'a fresh page recovers with one working menu entry');
    console.log('PASS: safe language lookup, real extension invalidation, native interactions, old-dialog close/disposal, and fresh-page recovery.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
