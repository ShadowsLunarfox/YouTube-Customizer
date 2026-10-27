// Exercise the real authenticated iframe during runtime upgrades and slider drags
// with large media, where small fixtures hide repeated validation/serialization.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
const image = size => 'data:image/gif;base64,' + Buffer.concat([gif, Buffer.alloc(size)]).toString('base64');
const fixture = `<!doctype html><style>
body{margin:0;background:#18202a;color:white;font:14px Arial}ytd-masthead{display:flex;height:56px;justify-content:flex-end;align-items:center}#buttons{display:flex}#avatar-btn{width:36px;height:36px}ytd-watch-flexy{display:block}#movie_player{width:640px;height:360px}video{width:100%;height:100%}.ytp-progress-bar-container{height:8px;width:100%}ytd-comments{display:block;padding:20px}
</style><ytd-app><ytd-masthead><div id="end"><div id="buttons"><ytd-topbar-menu-button-renderer><button id="avatar-btn">A</button></ytd-topbar-menu-button-renderer></div></div></ytd-masthead><ytd-watch-flexy><div id="movie_player" class="html5-video-player"><video muted></video><div class="ytp-progress-bar-container"><div class="ytp-progress-list"></div><button class="ytp-scrubber-button"></button></div></div><ytd-comments>Comments</ytd-comments></ytd-watch-flexy></ytd-app>`;
(async () => {
  const context = await chromium.launchPersistentContext('', { channel: 'chrome', headless: true, viewport: { width: 1280, height: 900 }, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 150000), errors = [];
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  try {
    await context.route('https://www.youtube.com/**', r => r.fulfill({ contentType: 'text/html', body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession(), { id } = await cdp.send('Extensions.loadUnpacked', { path: root });
    const admin = await context.newPage(); await admin.goto(`chrome-extension://${id}/popup.html`); await admin.waitForFunction(() => initialized);
    await admin.evaluate(async assets => {
      await chrome.storage.local.set(assets);
      await chrome.storage.sync.set({ themeEnabled: true, backgroundMode: 'image', thumbStyle: 'custom', uiOpacity: 37, uiBlur: 8 });
    }, { customIconData: image(4 * 1024 * 1024), backgroundImageData: image(14 * 1024 * 1024) });
    const page = await context.newPage(); await page.goto('https://www.youtube.com/watch?v=menu-interaction'); await page.waitForSelector('ytc-settings-entry');
    const tab = await admin.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/watch?v=menu-interaction' }))[0]);
    const button = page.locator('ytc-settings-entry button'), dialog = page.locator('ytc-settings-modal dialog');
    // Delay the initial ping and report an old generation until the real runtime
    // releases its appearance. This previously disposed the opening dialog.
    await admin.evaluate(async tabId => {
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => {
        __ytProgressCustomizer.dispose();
        const event = chrome.runtime.onMessage, add = event.addListener.bind(event), remove = event.removeListener.bind(event), listeners = new Map();
        globalThis.__menuProbe = { stale: true, disposals: 0 };
        event.addListener = listener => {
          const wrapped = (message, sender, reply) => {
            if (message?.type === 'YT_PROGRESS_PING') {
              setTimeout(() => listener(message, sender, response => reply(__menuProbe.stale ? { ...response, version: 'previous-generation' } : response)), 60);
              return true;
            }
            return listener(message, sender, reply);
          };
          listeners.set(listener, wrapped); add(wrapped);
        };
        event.removeListener = listener => { remove(listeners.get(listener) || listener); listeners.delete(listener); };
      }});
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['yt.js'] });
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => {
        const instance = __ytProgressCustomizer, release = instance.releaseAppearance, dispose = instance.dispose;
        instance.version = 'previous-generation';
        instance.releaseAppearance = function () { __menuProbe.stale = false; return release.call(this); };
        instance.dispose = function () { __menuProbe.disposals++; return dispose.call(this); };
      }});
    }, tab.id);
    await button.click();
    await page.waitForTimeout(1300);
    const survived = await dialog.isVisible();
    console.log('First-open upgrade:', JSON.stringify({ survived }));
    // Continue collecting performance evidence on the original implementation.
    if (!survived) await button.click();
    await page.waitForFunction(() => document.querySelector('ytc-settings-modal')?.shadowRoot.querySelector('iframe:not([data-loading])'));
    let view = page.frames().find(f => f.url().includes('/popup.html?embedded=1'));
    await view.waitForFunction(() => initialized && !form.inert && !document.body.inert);
    await view.evaluate(() => {
      const send = chrome.tabs.sendMessage.bind(chrome.tabs);
      globalThis.__dragProbe = { messages: 0, mediaBytes: 0, thumbWrites: 0, outputWrites: 0, calls: [], longTasks: [] };
      chrome.tabs.sendMessage = (tab, message, ...rest) => {
        if (message.type === 'YT_PROGRESS_LIVE_PREVIEW') { __dragProbe.messages++; __dragProbe.mediaBytes += Object.values(message.assets || {}).reduce((n, data) => n + data.length, 0); }
        return send(tab, message, ...rest);
      };
      new MutationObserver(records => __dragProbe.thumbWrites += records.length).observe(document.querySelector('.preview-thumb'), { attributes: true, attributeFilter: ['style'] });
      new MutationObserver(records => __dragProbe.outputWrites += records.length).observe(document.querySelector('#thumbSizeValue'), { childList: true, subtree: true });
      new PerformanceObserver(list => __dragProbe.longTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask' });
    });
    const drag = await view.evaluate(async () => {
      const start = performance.now();
      for (let i = 0; i < 36; i++) {
        const key = i % 2 ? 'uiBlur' : 'uiOpacity', input = fields[key];
        input.value = key === 'uiBlur' ? i % 31 : 20 + i;
        const t = performance.now(); input.dispatchEvent(new Event('input', { bubbles: true })); __dragProbe.calls.push(performance.now() - t);
        await new Promise(requestAnimationFrame);
      }
      fields.uiOpacity.value = 63; fields.uiOpacity.dispatchEvent(new Event('change', { bubbles: true }));
      fields.uiBlur.value = 17; fields.uiBlur.dispatchEvent(new Event('change', { bubbles: true }));
      await storageWriteQueue;
      return { elapsed: performance.now() - start, ...__dragProbe };
    });
    await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--ytc-ui-opacity') === '0.63' && document.documentElement.style.getPropertyValue('--ytc-ui-blur') === '17px');
    await view.waitForFunction(() => !previewInFlight && !pendingPreview);
    const counts = await view.evaluate(() => __dragProbe);
    console.log('Large-media slider drag:', JSON.stringify({ elapsed: Math.round(drag.elapsed), maxInput: Math.max(...drag.calls), ...counts, calls: undefined }));
    assert.equal(survived, true, 'the first open must survive a delayed/stale connection check');
    assert.equal(counts.mediaBytes, 0, 'changing numeric controls never serializes unchanged uploaded media');
    assert.equal(counts.thumbWrites, 0, 'unrelated sliders do not parse/rewrite the multi-MB custom icon');
    assert.equal(counts.outputWrites, 0, 'unrelated outputs keep their text nodes');
    assert.ok(Math.max(...drag.calls) < 35, 'range input handlers remain lightweight');
    const icon = await page.locator('.ytp-scrubber-button').evaluate(e => getComputedStyle(e).backgroundImage);
    assert.match(icon, /blob:/, 'large icons use a stable Blob URL');
    assert.ok(await page.locator('style#yt-custom-progress-style').evaluate(e => e.textContent.length) < 500000, 'ordinary settings do not reparse a multi-MB stylesheet');
    // A burst of native input events uses one pending frame, across categories.
    const burst = await view.evaluate(async () => {
      const before = __dragProbe.messages;
      for (let i = 0; i < 30; i++) {
        fields.barHeight.value = 4 + i % 7;
        fields.barHeight.dispatchEvent(new Event('input', { bubbles: true }));
        fields.thumbSize.value = 16 + i % 10;
        fields.thumbSize.dispatchEvent(new Event('input', { bubbles: true }));
        fields.backgroundOpacity.value = 40 + i;
        fields.backgroundOpacity.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise(requestAnimationFrame);
      while (previewInFlight || pendingPreview) await new Promise(requestAnimationFrame);
      return __dragProbe.messages - before;
    });
    assert.equal(burst, 1, '90 range events before a frame produce one final preview');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.ytp-progress-list')).height === '5px');
    assert.equal(await page.locator('.ytp-scrubber-button').evaluate(e => getComputedStyle(e).backgroundImage), icon);
    await view.evaluate(async () => { await saveSettings(); await storageWriteQueue; });
    // Repeated focus from controls does not reread all media or disable the form.
    const focus = await view.evaluate(async () => {
      const get = chrome.storage.local.get.bind(chrome.storage.local); let reads = 0, blocked = false;
      chrome.storage.local.get = (...args) => { reads++; return get(...args); };
      for (let i = 0; i < 4; i++) { dispatchEvent(new Event('focus')); blocked ||= form.inert; await new Promise(requestAnimationFrame); }
      chrome.storage.local.get = get; return { reads, blocked };
    });
    assert.deepEqual(focus, { reads: 0, blocked: false });
    // A change made in another menu is still picked up on returning to this one.
    await admin.evaluate(() => chrome.storage.sync.set({ uiOpacity: 46 }));
    await view.evaluate(() => dispatchEvent(new Event('focus')));
    await view.waitForFunction(() => !form.inert && fields.uiOpacity.value === '46');
    // Finishing a gesture on the backdrop must not close a drag that started inside.
    await view.locator('#uiOpacity').scrollIntoViewIfNeeded();
    const box = await view.locator('#uiOpacity').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(2, 2, { steps: 5 }); await page.mouse.up();
    assert.equal(await dialog.isVisible(), true);
    await page.mouse.click(2, 2); await dialog.waitFor({ state: 'hidden' });
    // Even with an older preview still in flight, closing flushes the last input
    // before destroying the caller. It cannot leave the page at that older value.
    await button.click(); await page.waitForFunction(() => document.querySelector('ytc-settings-modal')?.shadowRoot.querySelector('iframe:not([data-loading])'));
    view = page.frames().find(f => f.url().includes('/popup.html?embedded=1'));
    await view.evaluate(async () => {
      const send = chrome.tabs.sendMessage.bind(chrome.tabs);
      chrome.tabs.sendMessage = async (tab, message, ...rest) => {
        if (message.type === 'YT_PROGRESS_LIVE_PREVIEW') await new Promise(resolve => setTimeout(resolve, 80));
        return send(tab, message, ...rest);
      };
      fields.uiOpacity.value = 58; fields.uiOpacity.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(requestAnimationFrame);
      fields.uiOpacity.value = 71; fields.uiOpacity.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#closeInPage').click();
    });
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await admin.evaluate(async () => (await chrome.storage.sync.get('uiOpacity')).uiOpacity), 71);
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--ytc-ui-opacity')), '0.71');
    assert.deepEqual(errors, []);
    console.log('PASS: first-open upgrade, large-media drag, unchanged preview nodes, focus refresh, cross-menu edits, drag-safe backdrop, immediate-close persistence.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
