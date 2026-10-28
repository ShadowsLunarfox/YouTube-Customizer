// Native fullscreen must never be followed by extension-driven window resizing.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const wav = Buffer.alloc(44 + 48000 * 4);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const fixture = `<!doctype html><html><head><style>
body{margin:0;color:white;background:#333;font:14px Arial}ytd-masthead{display:block;height:64px}#buttons{display:flex;justify-content:flex-end}
#movie_player{position:relative;width:640px;height:360px;margin:20px}video{width:100%;height:100%}.ytp-right-controls{position:absolute;bottom:0;right:0;height:32px}
.ytp-button{height:32px;width:40px}.ytp-progress-bar-container{position:absolute;bottom:40px;left:0;width:100%;height:8px}
html:fullscreen #movie_player{position:fixed;inset:0;width:100vw;height:100vh;margin:0}
</style></head><body><ytd-app><ytd-masthead><div id="end"><div id="buttons"><button id="avatar-btn">Avatar</button></div></div></ytd-masthead>
<input id="search"><ytd-watch-flexy><div id="movie_player" class="html5-video-player" tabindex="0"><video muted loop src="/tone.wav"></video>
<div class="ytp-progress-bar-container"></div><div class="ytp-right-controls"><button class="ytp-button ytp-fullscreen-button">Full</button></div>
</div></ytd-watch-flexy></ytd-app><script>
window.nativeRequests=0; window.nativePlayer=document.querySelector('#movie_player'); window.nativeVideo=document.querySelector('video');
function full(){window.nativeRequests++;return document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}
document.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select'))return;
 if(event.key.toLowerCase()==='f'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();void full()}
 if(event.key==='Escape'&&document.fullscreenElement)void document.exitFullscreen();});
document.querySelector('.ytp-fullscreen-button').onclick=full;
document.querySelector('video').ondblclick=full;
document.addEventListener('fullscreenchange',()=>nativePlayer.classList.toggle('ytp-fullscreen',!!document.fullscreenElement));
</script></body></html>`;
(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true, viewport:null,
    ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging','--window-size=1100,780'] });
  const deadline = setTimeout(() => void context.close(), 60000), errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill(route.request().url().endsWith('/tone.wav')
      ? { contentType:'audio/wav', body:wav } : { contentType:'text/html', body:fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path:root });
    const menu = await context.newPage(); await menu.goto(`chrome-extension://${id}/popup.html`);
    await menu.waitForSelector('#settings-form:not([inert])');
    await menu.evaluate(() => chrome.storage.sync.set({ themeEnabled:true, showVideoBookmarks:true }));
    const page = await context.newPage(); await page.goto('https://www.youtube.com/watch?v=fullscreen-fixture');
    await page.waitForSelector('ytc-settings-entry'); await page.waitForSelector('ytc-bookmark-markers #bookmark-add:enabled');
    const tab = await menu.evaluate(async () => (await chrome.tabs.query({ url:'https://www.youtube.com/watch?v=fullscreen-fixture' }))[0]);
    const windowInfo = () => menu.evaluate(windowId => chrome.windows.get(windowId), tab.windowId);
    const records = () => menu.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).filter(key => key.startsWith('fullscreenWindow:')));
    async function until(read, matches, label) {
      const end = Date.now() + 5000;
      while (Date.now() < end) {
        const value = await read(); if (matches(value)) return value;
        await page.waitForTimeout(30);
      }
      assert.fail('Timed out: ' + label);
    }

    // A stale snapshot from the removed override must be discarded without
    // restoring its bounds or accepting requests from an old content script.
    await menu.evaluate(async tab => chrome.storage.session.set({ ['fullscreenWindow:' + tab.windowId]:
      { tabId:tab.id, state:'maximized', left:100, top:100, width:500, height:500 } }), tab);
    const beforeCleanup = await windowInfo();
    const targets = await cdp.send('Target.getTargets');
    const oldWorker = targets.targetInfos.find(target => target.type === 'service_worker' && target.url === `chrome-extension://${id}/service-worker.js`);
    await cdp.send('Target.closeTarget', { targetId:oldWorker.targetId });
    await menu.evaluate(async tabId => chrome.scripting.executeScript({ target:{ tabId }, func:() =>
      chrome.runtime.sendMessage({ type:'YT_SHORTCUT_DEFAULT_STATE' }) }), tab.id);
    const worker = await until(() => context.serviceWorkers().find(worker => worker.url().includes(id)), Boolean, 'worker restart');
    await menu.evaluate(async tabId => chrome.scripting.executeScript({ target:{ tabId }, func:() =>
      chrome.runtime.sendMessage({ type:'YT_PLAYER_FULLSCREEN_WINDOW', active:false }).catch(() => null) }), tab.id);
    await until(records, keys => keys.length === 0, 'discard obsolete snapshots');
    const afterCleanup = await windowInfo();
    for (const key of ['left','top','width','height','state']) assert.equal(afterCleanup[key], beforeCleanup[key], 'cleanup does not change ' + key);

    // Observe the privileged API directly, rather than relying on a screenshot
    // that might miss a brief shrink/maximize sequence.
    await worker.evaluate(async windowId => {
      globalThis.windowUpdates = [];
      const update = chrome.windows.update;
      chrome.windows.update = (...args) => { windowUpdates.push(args); return update.apply(chrome.windows, args); };
      await chrome.windows.update(windowId, { state:'normal' });
      if (windowUpdates.length !== 1) throw Error('Window API observation failed');
      windowUpdates.length = 0;
    }, tab.windowId);
    await page.bringToFront();
    const requests = () => page.evaluate(() => nativeRequests);
    async function cycle(enter, exit = () => page.keyboard.press('f')) {
      const original = await windowInfo(), count = await requests();
      await enter(); await page.waitForFunction(() => !!document.fullscreenElement);
      await page.waitForTimeout(250);
      assert.equal(await requests(), count + 1, 'only the native player enters fullscreen');
      await exit(); await page.waitForFunction(() => !document.fullscreenElement);
      await until(windowInfo, window => window.state === original.state, 'native window exit');
      const restored = await windowInfo();
      for (const key of ['left','top','width','height','state']) assert.equal(restored[key], original[key], 'native exit preserves ' + key);
      assert.deepEqual(await worker.evaluate(() => windowUpdates), [], 'fullscreen never invokes extension window resizing');
      assert.deepEqual(await records(), [], 'fullscreen never saves window snapshots');
    }
    await cycle(async () => { await page.locator('#movie_player').focus(); await page.keyboard.press('f'); });
    await cycle(() => page.locator('.ytp-fullscreen-button').click());
    await cycle(() => page.locator('video').dblclick());
    for (const selector of ['ytc-settings-entry button','ytc-bookmark-markers #bookmark-add']) {
      await cycle(async () => { await page.locator(selector).focus(); await page.keyboard.press('f'); }, () => page.keyboard.press('Escape'));
    }
    await page.locator('#search').fill('f'); await page.locator('#search').press('f');
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
    await page.locator('ytc-bookmark-markers #bookmark-add').click();
    await page.locator('ytc-video-bookmarks #bookmark-note').fill('f'); await page.locator('ytc-video-bookmarks #bookmark-note').press('f');
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), false);
    await page.locator('ytc-video-bookmarks #bookmark-close').click();
    for (const state of ['maximized','fullscreen']) {
      await menu.evaluate(({ windowId, state }) => chrome.windows.update(windowId, { state }), { windowId:tab.windowId, state });
      await cycle(async () => { await page.locator('#movie_player').focus(); await page.keyboard.press('f'); });
    }
    assert.equal(await page.evaluate(() => nativePlayer === document.querySelector('#movie_player') && nativeVideo === document.querySelector('video')), true);
    assert.deepEqual(await worker.evaluate(() => windowUpdates), []);
    assert.deepEqual(errors, []);
    console.log('PASS: native F/button/double-click entry and exit, zero extension window updates, no snapshots, obsolete-state cleanup, F/Escape focus handling, typing protection and original window modes.');
  } finally {
    await Promise.allSettled(context.pages().map(page => page.evaluate(() => document.fullscreenElement && document.exitFullscreen())));
    clearTimeout(deadline); await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
