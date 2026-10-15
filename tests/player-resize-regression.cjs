// Exercise theater/fullscreen while video frames and native player dimensions keep changing.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = `<!doctype html><html><head><style>
  body { margin:0; color:white; }
  ytd-app, ytd-watch-flexy, ytd-player { display:block; }
  #full-bleed-container { position:relative; height:0; }
  ytd-watch-flexy[theater] #full-bleed-container { height:540px; }
  #player-container { width:720px; height:405px; margin:40px; }
  ytd-player { position:relative; height:100%; view-transition-name:player; }
  #movie_player, .html5-video-container { position:relative; width:100%; height:100%; }
  video { display:block; width:70%; height:100%; margin:auto; }
  .ytp-chrome-bottom { position:absolute; bottom:0; left:0; right:0; height:50px; }
  button { height:40px; min-width:80px; }
  #movie_player:fullscreen { background:black; width:100vw; height:100vh; }
  #movie_player:fullscreen video { width:100%; }
  #measure-gutter { position:absolute; left:24px; top:150px; width:80px; height:80px; pointer-events:none; }
  #cached-home { display:none; }
</style></head><body><ytd-app><ytd-watch-flexy>
  <div id="full-bleed-container"><div id="measure-gutter"></div></div><div id="player-container">
    <ytd-player><div id="movie_player" class="html5-video-player">
      <div class="html5-video-container"><video muted></video></div>
      <div class="ytp-chrome-bottom"><button class="ytp-size-button">Theater</button>
        <button class="ytp-fullscreen-button">Fullscreen</button><button class="ytp-play-button">Pause</button>
        <div class="ytp-play-progress"></div><div class="ytp-volume-area">Volume</div>
      </div>
    </div></ytd-player>
  </div>
  <ytd-comments>Comments</ytd-comments>
</ytd-watch-flexy><ytd-browse id="cached-home" page-subtype="home">${
  '<ytd-rich-item-renderer><yt-lockup-view-model>Cached Home video</yt-lockup-view-model></ytd-rich-item-renderer>'.repeat(120)
}</ytd-browse></ytd-app><script>
  const watch = document.querySelector('ytd-watch-flexy');
  const player = document.querySelector('#movie_player');
  const video = document.querySelector('video');
  window.resizeSamples = [];
  window.mediaResets = 0;
  video.addEventListener('emptied', () => window.mediaResets++);
  function theater() {
    const start = performance.now();
    const expanded = watch.toggleAttribute('theater');
    document.querySelector(expanded ? '#full-bleed-container' : '#player-container').append(player.parentElement);
    let previous = start;
    let frames = 0;
    function resize() {
      const now = performance.now();
      // Native player JS writes dimensions/classes on each frame of the size transition.
      player.style.width = (expanded ? 1000 + frames : 720 - frames) + 'px';
      player.style.height = (expanded ? 500 + frames : 405 - frames) + 'px';
      player.className = 'html5-video-player ytp-resize-state-' + frames;
      player.querySelector('.html5-video-container').style.height = '100%';
      if (!frames) window.resizeSamples.push(now - start);
      window.maxResizeFrame = Math.max(window.maxResizeFrame || 0, now - previous);
      previous = now;
      if (++frames < 20) requestAnimationFrame(resize);
      else {
        player.style.width = '100%';
        player.style.height = '100%';
        window.resizeDone = true;
      }
    }
    window.resizeDone = false;
    requestAnimationFrame(resize);
  }
  document.querySelector('.ytp-size-button').onclick = theater;
  document.querySelector('.ytp-fullscreen-button').onclick = () =>
    document.fullscreenElement ? document.exitFullscreen() : player.requestFullscreen();
  document.querySelector('.ytp-play-button').onclick = () => video.pause();
  document.addEventListener('keydown', event => { if (event.key === 't') theater(); });
  document.addEventListener('fullscreenchange', () => watch.toggleAttribute('fullscreen', !!document.fullscreenElement));
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chrome', headless: true, viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging', '--autoplay-policy=no-user-gesture-required']
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: root });
    const popup = await context.newPage();
    await popup.goto('chrome-extension://' + id + '/popup.html');
    await popup.waitForSelector('#settings-form:not([inert])');
    await popup.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      for (let x = 0; x < 64; x += 4) {
        ctx.fillStyle = x % 8 ? '#fff' : '#000';
        ctx.fillRect(x, 0, 4, 64);
      }
      await chrome.storage.local.set({ backgroundImageData: canvas.toDataURL() });
      await chrome.storage.sync.set({ themeEnabled:true, backgroundMode:'image', backgroundFit:'tile',
        backgroundOpacity:100, uiBlur:12 });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://www.youtube.com/watch?v=resize-fixture');
    await page.waitForFunction(() => !!document.querySelector('ytd-comments[data-ytc-universal-glass]'));
    await page.bringToFront();
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d');
      let frame = 0;
      function draw() {
        ctx.fillStyle = frame++ % 2 ? '#21a366' : '#ffb900';
        ctx.fillRect(0, 0, 320, 180);
        requestAnimationFrame(draw);
      }
      draw();
      const video = document.querySelector('video');
      video.srcObject = canvas.captureStream(30);
      window.primaryVideo = video;
      await video.play();
      window.mediaResets = 0;
    });
    await page.waitForFunction(() => document.querySelector('video').currentTime > .1);
    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url:'https://www.youtube.com/watch*' });
      await chrome.scripting.executeScript({ target:{tabId:tab.id}, func:() => {
        globalThis.resizeWork = { playerSelectorChecks:0, subtreeScans:0, fullScans:0 };
        const matches = Element.prototype.matches;
        Element.prototype.matches = function(selector, ...args) {
          if (/data-ytc-universal/.test(selector) && this.id === 'movie_player') resizeWork.playerSelectorChecks++;
          return matches.call(this, selector, ...args);
        };
        const query = Element.prototype.querySelectorAll;
        Element.prototype.querySelectorAll = function(selector, ...args) {
          if (/data-ytc-universal/.test(selector)) resizeWork.subtreeScans++;
          return query.call(this, selector, ...args);
        };
        const documentQuery = Document.prototype.querySelectorAll;
        Document.prototype.querySelectorAll = function(selector, ...args) {
          if (/data-ytc-universal|cinematic|live-chat/.test(selector)) resizeWork.fullScans++;
          return documentQuery.call(this, selector, ...args);
        };
      }});
    });
    const initialTime = await page.locator('video').evaluate(video => video.currentTime);
    await page.locator('.ytp-size-button').click();
    await page.waitForFunction(() => window.resizeDone);
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.resizeDone);
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.resizeDone);
    await page.waitForTimeout(200);
    const work = await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url:'https://www.youtube.com/watch*' });
      const [{ result }] = await chrome.scripting.executeScript({ target:{tabId:tab.id}, func:() => resizeWork });
      return result;
    });
    console.log('Resize observer work: ' + JSON.stringify(work));
    assert.equal(work.fullScans, 0, 'size transitions never scan the entire page');
    assert.equal(work.playerSelectorChecks, 0, 'native player dimensions/classes bypass the large surface selectors');
    const layers = await page.evaluate(() => {
      const video = document.querySelector('video');
      const filteredAncestors = [];
      for (let element = video; element; element = element.parentElement) {
        if (getComputedStyle(element).backdropFilter !== 'none') filteredAncestors.push(element.id || element.localName);
      }
      return { filteredAncestors, gutterBlur:getComputedStyle(document.querySelector('#full-bleed-container'), '::before').backdropFilter };
    });
    assert.deepEqual(layers.filteredAncestors, [], 'resizing video stays outside a backdrop-filter surface');
    assert.equal(layers.gutterBlur, 'blur(12px)', 'a separate background layer preserves theater wallpaper blur');

    async function gutterContrast() {
      const png = await page.locator('#measure-gutter').screenshot();
      return page.evaluate(async data => {
        const image = new Image();
        image.src = 'data:image/png;base64,' + data;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 40, image.width, 1).data;
        const values = [];
        for (let i = 0; i < pixels.length; i += 4) values.push(pixels[i]);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
      }, png.toString('base64'));
    }
    const frostedContrast = await gutterContrast();
    await popup.evaluate(() => chrome.storage.sync.set({ uiBlur:0 }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#full-bleed-container'), '::before').backdropFilter === 'none');
    const clearContrast = await gutterContrast();
    assert.ok(clearContrast > 50 && frostedContrast < clearContrast * .35,
      'theater wallpaper is visibly blurred across the native player transition layer: ' + clearContrast + ' -> ' + frostedContrast);
    await popup.evaluate(() => chrome.storage.sync.set({ uiBlur:12 }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#full-bleed-container'), '::before').backdropFilter === 'blur(12px)');

    // Fullscreen uses the real browser API and preserves the same playing video.
    await page.locator('.ytp-fullscreen-button').click();
    await page.waitForFunction(() => !!document.fullscreenElement);
    assert.equal(await page.locator('#full-bleed-container').evaluate(element => getComputedStyle(element, '::before').content), 'none');
    await page.locator('.ytp-fullscreen-button').click();
    await page.waitForFunction(() => !document.fullscreenElement);
    const state = await page.evaluate(() => ({ sameVideo:window.primaryVideo === document.querySelector('video'),
      paused:primaryVideo.paused, time:primaryVideo.currentTime, resets:window.mediaResets,
      firstFrames:window.resizeSamples, maxFrame:window.maxResizeFrame }));
    assert.equal(state.sameVideo, true);
    assert.equal(state.paused, false);
    assert.equal(state.resets, 0);
    assert.ok(state.time > initialTime + .5, 'video continues to render throughout resizing');
    assert.ok(state.firstFrames.every(ms => ms < 500) && state.maxFrame < 500,
      'no long resize stall: ' + JSON.stringify(state));
    await page.locator('.ytp-play-button').click();
    assert.equal(await page.locator('video').evaluate(video => video.paused), true, 'background layer never intercepts controls');
    assert.deepEqual(errors, []);
    console.log('PASS: theater click/keyboard, native resize updates, real fullscreen, persistent video, controls. First frames: ' +
      state.firstFrames.map(ms => ms.toFixed(1)).join('/') + ' ms; max resize frame: ' + state.maxFrame.toFixed(1) + ' ms.');
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
