// Check native YouTube fullscreen without an extension-driven window transition.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const headed = process.env.YTC_HEADFUL === '1';
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:!headed,
    viewport:null, ignoreDefaultArgs:['--disable-extensions'],
    args:['--enable-unsafe-extension-debugging', '--window-size=1100,780', '--autoplay-policy=no-user-gesture-required'] });
  const deadline = setTimeout(() => void context.close(), 90000);
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path:root });
    const menu = await context.newPage(); await menu.goto(`chrome-extension://${id}/popup.html`);
    await menu.waitForSelector('#settings-form:not([inert])');
    await menu.evaluate(async () => {
      await chrome.storage.local.set({ backgroundImageData:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' });
      await chrome.storage.sync.set({ themeEnabled:true, backgroundMode:'image', uiBlur:12, showVideoBookmarks:true });
    });
    if (process.env.YTC_VIDEO_WALLPAPER === '1') await menu.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
      const painter = canvas.getContext('2d'), stream = canvas.captureStream(15), chunks = [];
      let frame = 0;
      const draw = () => { painter.fillStyle = frame++ % 2 ? '#31516b' : '#dfa476'; painter.fillRect(0, 0, 160, 90); };
      draw(); const timer = setInterval(draw, 60);
      const recorder = new MediaRecorder(stream, { mimeType:'video/mp4' });
      recorder.ondataavailable = event => chunks.push(event.data);
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start(); await new Promise(resolve => setTimeout(resolve, 600)); recorder.stop(); await stopped;
      clearInterval(timer); stream.getTracks().forEach(track => track.stop());
      const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(new Blob(chunks, { type:'video/mp4' })); });
      await chrome.storage.local.set({ backgroundImageData:data });
    });
    if (process.env.YTC_THEME_OFF === '1') await menu.evaluate(() => chrome.storage.sync.set({ themeEnabled:false, showVideoBookmarks:false }));
    const page = await context.newPage(), errors = [];
    await page.addInitScript(() => {
      window.fullscreenCalls = [];
      document.addEventListener('fullscreenchange', () => window.fullscreenCalls.push({ event:'fullscreenchange', element:document.fullscreenElement?.localName || null }));
      const exit = Document.prototype.exitFullscreen;
      Document.prototype.exitFullscreen = function(...args) {
        window.fullscreenCalls.push({ exit:new Error().stack }); return exit.apply(this, args);
      };
      const request = Element.prototype.requestFullscreen;
      Element.prototype.requestFullscreen = function(...args) {
        const call = { target:this.id || this.localName }; window.fullscreenCalls.push(call);
        return request.apply(this, args).then(value => { call.result = 'entered'; return value; }, error => { call.result = error.message; throw error; });
      };
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.YTC_VIDEO_URL || 'https://www.youtube.com/watch?v=LH-EvEfpZgI', { waitUntil:'domcontentloaded', timeout:45000 });
    const player = page.locator('#movie_player');
    await player.waitFor({ state:'visible', timeout:30000 });
    await page.locator('.ytp-fullscreen-button').waitFor({ state:'visible' });
    await page.locator('ytd-watch-metadata').waitFor({ state:'visible', timeout:25000 });
    await page.waitForFunction(() => typeof document.querySelector('#movie_player')?.getPlayerState === 'function');
    await page.waitForTimeout(500);
    await page.bringToFront();
    const session = await context.newCDPSession(page);
    if (headed && process.env.YTC_NATIVE_FOCUS === '1') await session.send('Emulation.setFocusEmulationEnabled', { enabled:false });
    async function state() {
      return { ...await page.evaluate(() => {
        const player = document.querySelector('#movie_player'), rect = player.getBoundingClientRect();
        return { fullscreen:document.fullscreenElement?.id || document.fullscreenElement?.localName || null, enabled:document.fullscreenEnabled,
          nativeClass:player.className, player:{ x:rect.x, y:rect.y, width:rect.width, height:rect.height },
          viewport:{ width:innerWidth, height:innerHeight }, outer:{ width:outerWidth, height:outerHeight },
          screen:{ width:screen.width, height:screen.height }, focus:document.activeElement?.tagName,
          calls:window.fullscreenCalls, apiFullscreen:player.isFullscreen?.(), error:document.querySelector('.ytp-error')?.textContent?.trim() };
      }), window:(await session.send('Browser.getWindowForTarget')).bounds };
    }
    await player.click({ position:{ x:100, y:100 } });
    await player.focus();
    const before = await state();
    await page.keyboard.press('f');
    await page.waitForFunction(() => {
      const box = document.querySelector('#movie_player').getBoundingClientRect();
      return document.fullscreenElement && Math.abs(box.width - innerWidth) < 3 && Math.abs(box.height - innerHeight) < 3;
    }, null, { timeout:10000 });
    await page.waitForTimeout(800);
    const entered = await state();
    console.log('Real YouTube fullscreen:', JSON.stringify({ headed, before, entered, errors }));
    assert.ok(entered.fullscreen, 'F enters real browser fullscreen');
    assert.ok(Math.abs(entered.player.width - entered.viewport.width) < 3 && Math.abs(entered.player.height - entered.viewport.height) < 3,
      'fullscreen player covers its viewport');
    await page.keyboard.press('f'); await page.waitForTimeout(500);
    const exited = await state();
    assert.equal(exited.fullscreen, null, 'a second F exits fullscreen');
    assert.equal(exited.window.windowState, before.window.windowState, 'exit restores the previous browser window mode');
    if (before.window.windowState === 'normal') assert.deepEqual(exited.window, before.window, 'exit restores the exact original window bounds');
    console.log('PASS: actual YouTube F entry/exit, native Fullscreen API, player coverage, and original window bounds.');
  } finally {
    await Promise.allSettled(context.pages().map(page => page.evaluate(() => document.fullscreenElement && document.exitFullscreen())));
    clearTimeout(deadline); await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
