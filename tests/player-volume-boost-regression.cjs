// Exercise the inline boost through real media output, native controls and storage.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
function tone() {
  const rate = 48000, samples = rate * 10, bytes = Buffer.alloc(44 + samples * 4);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 4, 28); bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(samples * 4, 40);
  for (let i = 0; i < samples; i++) {
    const sample = Math.round(32767 * .04 * Math.sin(2 * Math.PI * 1000 * i / rate));
    bytes.writeInt16LE(sample, 44 + i * 4); bytes.writeInt16LE(sample, 46 + i * 4);
  }
  return bytes;
}
function controls(modern) {
  const volume = '<button class="ytp-button ytp-mute-button" aria-label="Mute">♪</button>' +
    '<div class="ytp-volume-panel"><div class="ytp-volume-slider"><input class="native-volume" type="range" min="0" max="100" value="100" aria-label="YouTube volume"></div></div>';
  return `<div class="ytp-chrome-bottom"><div class="ytp-chrome-controls"><div class="ytp-left-controls">
    <button class="ytp-button ytp-play-button">▶</button>${modern ? '<div class="ytp-volume-area">' + volume + '</div>' : volume}
    <span class="ytp-time-display">0:01 / 1:00</span></div><div class="ytp-right-controls">
    <button class="ytp-button ytp-subtitles-button">CC</button><button class="ytp-button ytp-settings-button">⚙</button>
    </div></div></div>`;
}
function fixture(modern) { return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#222;color:#fff;font:14px Arial}ytd-app,ytd-watch-flexy{display:block}
  .html5-video-player{position:relative;width:1000px;height:560px;margin:20px;max-width:calc(100vw - 40px);background:#111}
  .html5-video-player video{width:100%;height:100%}.html5-video-player:fullscreen{width:100vw;height:100vh;margin:0;max-width:none}
  .ytp-chrome-bottom{position:absolute;bottom:8px;left:12px;right:12px;height:40px}
  .ytp-chrome-controls{display:flex;height:100%;gap:8px}.ytp-left-controls{display:flex;align-items:center;flex:1;min-width:0}
  .ytp-right-controls{display:flex;flex:none;height:100%}.ytp-volume-area{display:flex;align-items:center;height:100%}
  .ytp-delhi-modern .ytp-chrome-bottom{height:56px}.ytp-delhi-modern .ytp-volume-area{height:40px;margin-block:8px}
  .ytp-volume-panel{display:flex;align-items:center;width:0;height:100%;flex:none;opacity:0;visibility:hidden;transition:width .2s}
  .ytp-volume-slider{display:flex;align-items:center;width:0;height:100%;overflow:hidden}.native-volume{width:100%;min-width:0;margin:0}
  .ytp-volume-area:hover .ytp-volume-panel,.ytp-mute-button:hover+.ytp-volume-panel,.ytp-volume-panel:hover{width:52px;opacity:1;visibility:visible}
  .ytp-button{background:transparent;color:#fff;border:0;width:32px;height:100%;padding:0;flex:none;cursor:pointer}
  .ytp-time-display{white-space:nowrap;overflow:hidden;min-width:0;margin-left:8px}#inline-player{width:180px;height:110px}
  #movie_player.theater{width:1160px;height:650px}
  </style></head><body><ytd-app><ytd-watch-flexy><div id="movie_player" class="html5-video-player ${modern ? 'ytp-delhi-modern ytp-delhi-horizontal-volume-controls' : ''}">
  <video id="main-video" loop></video>${controls(modern)}</div></ytd-watch-flexy></ytd-app>
  <div id="inline-player" class="html5-video-player"><video muted></video>${controls(modern)}</div>
  <script>
    const player=document.querySelector('#movie_player'),video=player.querySelector('video');
    video.src='/tone.wav';video.play();
    player.addEventListener('input',event=>{if(event.target.matches('.native-volume'))video.volume=event.target.value/100});
    player.addEventListener('click',event=>{
      if(event.target.closest('.ytp-mute-button'))video.muted=!video.muted;
      if(event.target.closest('.ytc-volume-boost'))document.body.dataset.leakedClick='true';
    });
    player.addEventListener('keydown',event=>{if(event.target.closest('.ytc-volume-boost'))document.body.dataset.leakedKey='true'});
    player.addEventListener('pointerdown',event=>{if(event.target.closest('.ytc-volume-boost'))document.body.dataset.leakedPointer='true'});
    document.addEventListener('fullscreenchange',()=>player.classList.toggle('ytp-big-mode',Boolean(document.fullscreenElement)));
  </script></body></html>`; }
(async () => {
  const context = await chromium.launchPersistentContext('', { channel: 'chrome', headless: true,
    viewport: { width: 1280, height: 900 }, ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging', '--autoplay-policy=no-user-gesture-required'] });
  const deadline = setTimeout(() => void context.close(), 90000), errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill(route.request().url().endsWith('/tone.wav')
      ? { contentType: 'audio/wav', body: tone() }
      : { contentType: 'text/html', body: fixture(route.request().url().includes('modern')) }));
    const cdp = await context.browser().newBrowserCDPSession(), { id } = await cdp.send('Extensions.loadUnpacked', { path: root });
    const page = await context.newPage();
    await page.goto('https://www.youtube.com/watch?v=volume-classic');
    const host = page.locator('#movie_player .ytc-volume-boost'), slider = host.locator('input'), toggle = host.locator('button');
    await host.waitFor();
    assert.equal(context.pages().some(page => page.url().startsWith('chrome-extension:')), false, 'available without opening settings');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('#movie_player .ytp-volume-panel').evaluate(el => el.matches(':hover')), false);
    assert.equal(await page.locator('#movie_player .ytp-volume-slider').evaluate(el => el.getBoundingClientRect().width), 52, 'native volume is expanded before hovering with the page theme off');
    await page.locator('#movie_player .ytp-mute-button').hover(); await page.mouse.move(0, 0);
    assert.equal(await page.locator('#movie_player .ytp-volume-panel').evaluate(el => el.getBoundingClientRect().width), 52, 'native volume stays expanded after mouse leave');
    assert.equal(await page.locator('#inline-player .ytc-volume-boost').count(), 0);
    const admin = await context.newPage();
    await admin.goto('chrome-extension://' + id + '/popup.html');
    await admin.waitForSelector('#settings-form:not([inert])');
    const tabId = await admin.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/watch?v=volume-classic' }))[0].id);
    const audio = action => admin.evaluate(async ({ tabId, action }) => {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId }, args: [action], func: async action => {
        if (action === 'context') return YTCustomizerContent.audioResources.context;
        const graph = YTCustomizerContent.audioResources.graphs.get(document.querySelector('#main-video'));
        const analyser = graph.context.createAnalyser(), silent=graph.context.createGain();
        analyser.fftSize = 4096; silent.gain.value=0; graph.output.connect(analyser);
        analyser.connect(silent);silent.connect(graph.context.destination);
        // Wait for rendered audio, since wall-clock timers can outrun the audio thread.
        const start=graph.context.currentTime,deadline=performance.now()+5000;
        while(graph.context.currentTime-start<.25&&performance.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
        if(graph.context.currentTime-start<.25)throw Error('Audio rendering did not advance');
        const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
        graph.output.disconnect(analyser); analyser.disconnect();silent.disconnect();
        return Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      } });
      return result;
    }, { tabId, action });
    assert.equal(await audio('context'), null, 'off allocates no audio graph');
    const setBoost = value => slider.evaluate((input, value) => {
      input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    const saved = (enabled, boost) => admin.waitForFunction(async ({ enabled, boost }) => {
      const saved = await chrome.storage.sync.get(['audioEnabled', 'volumeBoost']);
      return saved.audioEnabled === enabled && saved.volumeBoost === boost;
    }, { enabled, boost });
    const rms = () => audio('rms');
    await admin.evaluate(() => chrome.storage.sync.set({audioLimiter:false}));
    await setBoost(100); await saved(true, 100);
    const baseline = await rms(); assert.ok(baseline > .01);
    await setBoost(300); await saved(true, 300);
    const boosted = await rms();
    assert.ok(Math.abs(boosted / baseline - 3) < .08, '300% triples actual sample amplitude; measured ratio ' + boosted / baseline);
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    await page.locator('#movie_player .native-volume').fill('25');
    const nativeQuarter=await rms();
    assert.ok(Math.abs(nativeQuarter / baseline - .75) < .03, 'native volume still scales enhanced audio; measured ratio '+nativeQuarter / baseline);
    await page.locator('#movie_player .ytp-mute-button').click(); assert.ok(await rms() < .00001, 'native mute silences output');
    await page.locator('#movie_player .ytp-mute-button').click();
    await page.locator('#movie_player .native-volume').fill('100');
    await toggle.click(); await saved(false, 300);
    assert.ok(Math.abs(await rms() / baseline - 1) < .03, 'off restores normal audio while retaining boost');
    await toggle.focus(); await page.keyboard.press('Enter'); await saved(true, 300);
    await slider.focus(); await page.keyboard.press('ArrowRight'); await saved(true, 310);
    assert.equal(await page.locator('body').getAttribute('data-leaked-click'), null);
    assert.equal(await page.locator('body').getAttribute('data-leaked-key'), null, 'range keys do not seek/change native volume');
    await toggle.click(); await saved(false, 310);
    const range = await slider.boundingBox();
    await page.mouse.move(range.x + range.width / 2, range.y + range.height / 2);
    await page.mouse.down();
    await page.mouse.move(range.x + range.width - 1, range.y + range.height / 2, { steps: 8 });
    await page.mouse.up(); await saved(true, 500);
    assert.equal(await page.locator('body').getAttribute('data-leaked-pointer'), null, 'dragging does not reach native player pointer handlers');
    assert.equal(await page.locator('#main-video').evaluate(video => video.paused), false);
    await admin.bringToFront(); await admin.evaluate(() => window.dispatchEvent(new Event('focus')));
    await admin.locator('#tab-audio').click();
    await admin.waitForFunction(() => document.querySelector('#volumeBoost').value === '500');
    assert.equal(await admin.locator('#audioEnabled').isChecked(), true, 'Audio menu reloads player changes');
    const second = await context.newPage(); await second.goto('https://www.youtube.com/watch?v=volume-modern');
    await second.waitForFunction(() => document.querySelector('.ytc-volume-boost-slider')?.value === '500');
    await admin.evaluate(() => chrome.storage.sync.set({ audioEnabled: false, volumeBoost: 420 }));
    for (const tab of [page, second]) await tab.waitForFunction(() => document.querySelector('.ytc-volume-boost-slider')?.value === '420' && document.querySelector('.ytc-volume-boost-toggle')?.getAttribute('aria-pressed') === 'false');
    await admin.evaluate(() => chrome.storage.local.set({ menuLanguage: 'zh-CN' }));
    await page.waitForFunction(() => document.querySelector('.ytc-volume-boost-slider').getAttribute('aria-label') === '音量增强');
    for (const tab of [page, second]) {
      await tab.bringToFront();
      // Glass follows the shared UI tokens while the track stays visible over each frame.
      await tab.locator('#main-video').evaluate(video => video.style.opacity = '0');
      for (const opacity of [0,30,100]) {
        const blur=opacity===0?0:opacity===30?12:24;
        await admin.evaluate(([uiOpacity,uiBlur]) => chrome.storage.sync.set({themeEnabled:true,uiOpacity,uiBlur,surfaceColor:'#ffffff',pageColor:'#ffffff',textColor:'#111111'}),[opacity,blur]);
        await tab.waitForFunction(value => document.documentElement.style.getPropertyValue('--ytc-ui-opacity') === String(value/100),opacity);
        for (const frame of ['#fff','#000']) {
          await tab.locator('#movie_player').evaluate((player,color) => player.style.background = color,frame);
          for (const enabled of [false,true]) {
            await admin.evaluate(audioEnabled => chrome.storage.sync.set({audioEnabled,volumeBoost:300}),enabled);
            await tab.waitForFunction(active => document.querySelector('.ytc-volume-boost-toggle').getAttribute('aria-pressed') === String(active),enabled);
            const visible = await tab.locator('#movie_player .ytc-volume-boost').evaluate(host => {
              const button=host.querySelector('button'),slider=host.querySelector('input'),value=host.querySelector('span');
              return {background:getComputedStyle(host).backgroundColor,blur:getComputedStyle(host).backdropFilter,value:getComputedStyle(value).color,
                button:getComputedStyle(button).backgroundColor,icon:getComputedStyle(button.querySelector('svg')).color,
                outline:getComputedStyle(button).outlineStyle,opacity:getComputedStyle(slider).opacity,glassButton:button.hasAttribute('data-ytc-universal-glass')};
            });
            assert.equal(visible.background,opacity===100?'rgb(255, 255, 255)':`rgba(255, 255, 255, ${opacity/100})`,'background follows shared UI color and opacity');
            assert.equal(visible.blur,blur?`blur(${blur}px)`:'none','blur follows shared UI setting');
            assert.equal(visible.value,'rgb(255, 255, 255)');
            assert.equal(visible.button,'rgba(0, 0, 0, 0)');assert.equal(visible.icon,enabled?'rgb(255, 206, 112)':'rgb(255, 255, 255)');
            assert.equal(visible.outline,'none','enabled boost has no extra outline ring');
            assert.equal(visible.opacity,'1');assert.equal(visible.glassButton,false,'one shared background for the boost control');
            const png=await tab.locator('#movie_player .ytc-volume-boost-slider').screenshot();
            const pixels=await tab.evaluate(async base64=>{
              const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
              const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
              const context=canvas.getContext('2d');context.drawImage(image,0,0);const data=context.getImageData(0,0,image.width,image.height).data;
              let light=0,dark=0;for(let i=0;i<data.length;i+=4){const brightness=(data[i]+data[i+1]+data[i+2])/3;if(brightness>110)light++;if(brightness<80)dark++;}
              return{light,dark};
            },png.toString('base64'));
            assert.ok(pixels.light>40&&pixels.dark>15,'visible track/thumb on light and dark frames: '+JSON.stringify({opacity,frame,enabled,pixels}));
          }
        }
      }
      await admin.evaluate(() => chrome.storage.sync.set({audioEnabled:false,volumeBoost:420}));
      await tab.waitForFunction(() => document.querySelector('.ytc-volume-boost-slider').value === '420');
      await tab.locator('#movie_player').evaluate(player => {player.style.background='';player.querySelector('video').style.opacity=''});
      await tab.locator('#movie_player .ytc-volume-boost-slider').focus();await tab.keyboard.press('Shift+Tab');
      assert.equal(await tab.locator('#movie_player .ytc-volume-boost-toggle').evaluate(button=>getComputedStyle(button).outlineWidth),'2px','keyboard focus stays visible');
      await tab.locator('#movie_player .ytp-mute-button').focus();
      for (const mode of ['normal', 'theater', 'fullscreen', 'narrow']) {
        if (mode === 'theater') await tab.locator('#movie_player').evaluate(player => player.classList.add('theater'));
        if (mode === 'fullscreen') await tab.locator('#movie_player').evaluate(player => player.requestFullscreen());
        if (mode === 'narrow') await tab.evaluate(async () => { await document.exitFullscreen(); const p = document.querySelector('#movie_player'); p.classList.remove('theater'); p.style.width = '360px'; });
        await tab.waitForFunction(() => {
          const p = document.querySelector('#movie_player'), h = p.querySelector('.ytc-volume-boost');
          return h.classList.contains('ytc-volume-boost-compact') === (p.clientWidth < 720);
        });
        const layout = await tab.locator('#movie_player').evaluate(player => {
          const host = player.querySelector('.ytc-volume-boost'), anchor = player.querySelector('.ytp-volume-area') || player.querySelector('.ytp-volume-panel');
          const box = host.getBoundingClientRect(), native = anchor.getBoundingClientRect(), right = player.querySelector('.ytp-right-controls').getBoundingClientRect();
          const icon = host.querySelector('svg path').getBoundingClientRect();
          const panel=player.querySelector('.ytp-volume-panel'), track=player.querySelector('.ytp-volume-slider');
          return { adjacent: anchor.nextElementSibling === host, x: box.x, nativeRight: native.right, right: box.right, controlsX: right.x, height: box.height, iconWidth: icon.width, iconHeight: icon.height, count: player.querySelectorAll('.ytc-volume-boost').length,
            nativeHeight:native.height,centerY:box.y+box.height/2,nativeCenterY:native.y+native.height/2,
            nativeWidth:panel.getBoundingClientRect().width,trackWidth:track.getBoundingClientRect().width,expectedWidth:player.classList.contains('ytp-big-mode')?78:52,visibility:getComputedStyle(panel).visibility };
        });
        assert.equal(layout.adjacent, true); assert.equal(layout.count, 1); assert.ok(layout.x >= layout.nativeRight, mode);
        assert.ok(layout.right <= layout.controlsX, mode + ' does not overlap native right controls'); assert.ok(layout.height >= 24);
        assert.ok(Math.abs(layout.height-layout.nativeHeight)<.1,mode+': boost capsule matches native volume height');
        assert.ok(Math.abs(layout.centerY-layout.nativeCenterY)<1,mode+': volume capsules share a vertical center');
        assert.ok(layout.iconWidth >= 10 && layout.iconHeight >= 12, 'lightning icon remains legible');
        assert.equal(layout.nativeWidth,layout.expectedWidth,mode+': native volume stays expanded');
        assert.equal(layout.trackWidth,layout.expectedWidth);assert.equal(layout.visibility,'visible');
        if (process.env.YTC_SCREENSHOTS && mode === 'normal') await tab.locator('#movie_player .ytp-chrome-bottom').screenshot({ path: path.join(os.tmpdir(), 'ytc-volume-boost-' + (tab === page ? 'classic' : 'modern') + '.png') });
      }
      if(tab===second) {
        for(const height of [32,48,40]) {
          await tab.locator('#movie_player .ytp-volume-area').evaluate((anchor,height)=>anchor.style.height=height+'px',height);
          await tab.waitForFunction(height=>Math.abs(document.querySelector('#movie_player .ytc-volume-boost').getBoundingClientRect().height-height)<.1,height);
        }
      }
      await tab.locator('#movie_player .ytp-chrome-bottom').evaluate(el => el.remove());
      await tab.waitForFunction(() => !document.querySelector('.ytc-volume-boost-status'));
      await tab.locator('#movie_player').evaluate((p, html) => p.insertAdjacentHTML('beforeend', html), controls(tab === second));
      await tab.waitForSelector('#movie_player .ytc-volume-boost');
      assert.equal(await tab.locator('#movie_player .ytp-volume-slider').evaluate(el=>el.getBoundingClientRect().width),52,'replacement native controls stay expanded');
      await tab.locator('#movie_player .ytc-volume-boost').evaluate(el => el.remove());
      await tab.waitForSelector('#movie_player .ytc-volume-boost');
    }
    const inject = () => admin.evaluate(async tabId => chrome.scripting.executeScript({ target: { tabId }, files: chrome.runtime.getManifest().content_scripts[0].js }), tabId);
    await inject(); await inject(); assert.equal(await host.count(), 1);
    await admin.evaluate(async tabId => chrome.scripting.executeScript({ target: { tabId }, func: () => globalThis.__ytProgressCustomizer.dispose() }), tabId);
    assert.equal(await page.locator('[data-ytc-volume-boost-owned]').count(), 0);
    assert.equal(await page.locator('#movie_player .ytp-mute-button').count(), 1);
    await inject(); await host.waitFor(); assert.equal(await slider.inputValue(), '420');
    await page.reload(); await host.waitFor(); assert.equal(await slider.inputValue(), '420', 'boost persists after reload');
    assert.deepEqual(errors, []);
    console.log('PASS: inline boost placement in classic/modern, real 300% audio, native volume/mute/bypass, pointer/keyboard isolation, saved settings/menu/cross-tab/language sync, theater/fullscreen/narrow layout, replaced controls, reinjection and disposal.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
