// First paint and read-only close must not wait for unrelated storage or media.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = `<!doctype html><style>body{margin:0;background:#293846;color:white}ytd-masthead{display:flex;justify-content:flex-end;height:56px}#buttons{display:flex}button{height:40px}ytd-comments{display:block;padding:20px}</style>
<ytd-app><ytd-masthead><div id="end"><div id="buttons"><button id="avatar-btn">Account</button></div></div></ytd-masthead><ytd-comments>Comments</ytd-comments></ytd-app>`;
(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true, viewport:{width:1280,height:900}, ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 90000);
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:fixture}));
    const cdp = await context.browser().newBrowserCDPSession(), { id } = await cdp.send('Extensions.loadUnpacked', {path:root});
    const admin = await context.newPage(); await admin.goto(`chrome-extension://${id}/popup.html`); await admin.waitForFunction(() => initialized);
    await admin.evaluate(() => chrome.storage.sync.set({themeEnabled:true,uiBlur:24}));
    const page = await context.newPage(); await page.goto('https://www.youtube.com/watch?v=menu-lifecycle'); await page.waitForSelector('ytc-settings-entry');
    const tab = await admin.evaluate(async () => (await chrome.tabs.query({url:'https://www.youtube.com/watch?v=menu-lifecycle'}))[0]);
    // A slow preference read must never delay displaying the dialog shell.
    await admin.evaluate(async tabId => {
      await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:() => {
        __ytProgressCustomizer.dispose();
        const observe = YTCustomizerMenuTheme.observe;
        YTCustomizerMenuTheme.observe = change => { const observer = observe(change); return {...observer, ready:observer.ready.then(() => new Promise(resolve => setTimeout(resolve,600)))}; };
      }});
      await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['yt.js']});
    },tab.id);
    await page.waitForSelector('ytc-settings-entry');
    const opened = await page.evaluate(async () => {
      const started = performance.now(); document.querySelector('ytc-settings-entry').shadowRoot.querySelector('button').click();
      while (!document.querySelector('ytc-settings-modal')?.shadowRoot.querySelector('dialog')?.open) await new Promise(requestAnimationFrame);
      return performance.now() - started;
    });
    await page.waitForFunction(() => document.querySelector('ytc-settings-modal').shadowRoot.querySelector('iframe:not([data-loading])'));
    const src = await page.locator('ytc-settings-modal iframe').getAttribute('src'), view = page.frames().find(frame => frame.url() === src);
    await view.waitForFunction(() => initialized && !form.inert);
    await view.evaluate(() => {
      globalThis.__lifecycle = {writes:0};
      for (const area of ['sync','local']) { const set = chrome.storage[area].set.bind(chrome.storage[area]); chrome.storage[area].set = async values => { __lifecycle.writes++; await new Promise(resolve => setTimeout(resolve,180)); return set(values); }; }
    });
    const closed = await view.evaluate(async () => {
      const started = performance.now(); await closeSettings(); return {elapsed:performance.now()-started,writes:__lifecycle.writes};
    }).catch(() => null);
    await page.locator('ytc-settings-modal dialog').waitFor({state:'hidden'});
    console.log('Menu lifecycle:', JSON.stringify({firstShellMs:Math.round(opened),cleanClose:closed}));
    assert.ok(opened < 200, 'the menu shell appears before the delayed preference read');
    assert.ok(closed && closed.writes === 0, 'read-only close does not write settings');
    assert.ok(closed.elapsed < 160, 'read-only close does not wait for storage');
    await page.locator('ytc-settings-entry button').click();
    await page.waitForFunction(() => document.querySelector('ytc-settings-modal').shadowRoot.querySelector('iframe:not([data-loading])'));
    const nextSrc = await page.locator('ytc-settings-modal iframe').getAttribute('src'), edited = page.frames().find(frame => frame.url() === nextSrc);
    await edited.waitForFunction(() => initialized && !form.inert);
    await edited.evaluate(async () => {
      const set = chrome.storage.sync.set.bind(chrome.storage.sync); let fail = true;
      chrome.storage.sync.set = async values => { await new Promise(resolve => setTimeout(resolve,100)); if (fail) { fail = false; throw Error('Simulated storage failure'); } return set(values); };
      fields.uiOpacity.value = 57; fields.uiOpacity.dispatchEvent(new Event('input',{bubbles:true}));
      await closeSettings();
    });
    assert.equal(await page.locator('ytc-settings-modal dialog').isVisible(), true, 'a failed save keeps the menu open');
    assert.equal(await edited.locator('#settings-form').getAttribute('inert'), null, 'failed close leaves controls editable');
    assert.equal(await admin.evaluate(async () => (await chrome.storage.sync.get('uiOpacity')).uiOpacity), undefined);
    await edited.evaluate(() => closeSettings());
    await page.locator('ytc-settings-modal dialog').waitFor({state:'hidden'});
    assert.equal(await admin.evaluate(async () => (await chrome.storage.sync.get('uiOpacity')).uiOpacity), 57, 'retry saves the final edit before destroying the frame');
    console.log('PASS: immediate shell, no-write clean close, save-failure recovery and immediate-close persistence.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
