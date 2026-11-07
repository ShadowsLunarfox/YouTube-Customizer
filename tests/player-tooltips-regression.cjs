// Verify native player hints keep one panel, readable labels and a separate shortcut.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
function fixture(mode) {
  const legacy = mode === 'legacy';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:white;font:14px Arial;color:white}ytd-app{display:block}
    .html5-video-player{position:relative;margin:20px;width:800px;max-width:calc(100vw - 40px);height:400px;background:#fff}
    video{width:100%;height:100%}.html5-video-player:fullscreen{margin:0;width:100vw;height:100vh;max-width:none}
    #controls{position:absolute;bottom:0;display:flex;height:40px;gap:4px}button{width:40px;height:40px;padding:0;border:0;color:white;background:#333}
    .ytp-tooltip{position:absolute;left:16px;top:200px;max-width:300px;font:500 13px/15px Arial;color:#eee;pointer-events:none}
    .ytp-tooltip-bottom-text{display:flex;align-items:center;padding:5px 9px;gap:4px;border-radius:8px;background:#0005}
    .ytp-tooltip-text{white-space:nowrap}.ytp-tooltip-keyboard-shortcut{border:1px solid #fff5;padding:0 2px;border-radius:3px;color:#fff}
    .ytp-tooltip-keyboard-shortcut:empty{display:none}.ytp-tooltip-text-wrapper.ytp-frosted-glass-fade-transition{background:#0005;backdrop-filter:blur(16px);border-radius:8px}
    .ytp-frosted-glass-fade-transition .ytp-tooltip-bottom-text{background:transparent}
    .legacy .ytp-tooltip-text{display:inline-block;background:#1c1c1ce6;padding:5px 9px;border-radius:3px}
    #seek-preview{top:30px;left:300px;width:160px;height:90px;background:#222;border-radius:8px}
    #seek-preview .ytp-tooltip-text-wrapper{position:absolute;bottom:0;width:100%;text-align:center}#seek-preview .ytp-tooltip-text{background:transparent}
    [hidden]{display:none!important}
  </style></head><body><ytd-app><div id="movie_player" class="html5-video-player ${mode === 'classic' || legacy ? '' : 'ytp-delhi-modern'} ${legacy ? 'legacy' : ''}">
    <video></video><div id="controls"><button id="captions" class="ytp-button" aria-disabled="true" data-label="Subtitles/closed captions unavailable" data-key="C">CC</button>
    <button id="settings" class="ytp-button" data-label="Settings" data-key="">⚙</button>
    <button id="fullscreen" class="ytp-button" data-label="Full screen" data-key="F">⛶</button></div>
    <div id="hint" class="ytp-tooltip ytp-bottom" style="max-width:300px;left:16px;top:200px" aria-live="polite" hidden><div class="ytp-tooltip-text-wrapper ${mode === 'fade' ? 'ytp-frosted-glass-fade-transition' : ''}">
    ${legacy ? '<span class="ytp-tooltip-text"></span>' : '<div class="ytp-tooltip-bottom-text"><span class="ytp-tooltip-text"></span><div class="ytp-tooltip-keyboard-shortcut"></div></div>'}</div></div>
    <div id="seek-preview" class="ytp-tooltip ytp-preview"><div class="ytp-tooltip-text-wrapper"><span class="ytp-tooltip-text">0:05</span></div></div>
    </div></ytd-app><script>
    const hint=document.querySelector('#hint');
    for(const button of document.querySelectorAll('#controls button')){
      button.addEventListener('mouseenter',()=>{
        hint.querySelector('.ytp-tooltip-text').textContent=button.dataset.label;
        const key=hint.querySelector('.ytp-tooltip-keyboard-shortcut');if(key)key.textContent=button.dataset.key;
        hint.hidden=false;
      });
      button.addEventListener('mouseleave',()=>{hint.hidden=true});
    }
    document.querySelector('#fullscreen').addEventListener('click',()=>document.querySelector('#movie_player').requestFullscreen());
  </script></body></html>`;
}
async function inspect(page) {
  return page.locator('#hint').evaluate(hint => {
    const label = hint.querySelector('.ytp-tooltip-text'), key = hint.querySelector('.ytp-tooltip-keyboard-shortcut');
    const panel = hint.querySelector('.ytp-tooltip-bottom-text') || label;
    const box = element => { const r = element.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom, width:r.width, height:r.height }; };
    const style = element => { const s = getComputedStyle(element); return { background:s.backgroundColor, blur:s.backdropFilter, color:s.color }; };
    return { hint:box(hint), panel:box(panel), label:box(label), key:key && box(key), keyText:key?.textContent,
      labelText:label.textContent, panelStyle:style(panel), labelStyle:style(label), wrapperStyle:style(hint.firstElementChild),
      glassLabel:label.hasAttribute('data-ytc-universal-glass'), left:hint.style.left, top:hint.style.top };
  });
}
function check(state, legacy = false) {
  assert.equal(state.panelStyle.color, 'rgb(255, 255, 255)');
  assert.equal(state.panelStyle.background, 'rgba(24, 24, 24, 0.94)', 'readable panel does not fade with page opacity');
  assert.equal(state.wrapperStyle.background, 'rgba(0, 0, 0, 0)');
  assert.equal(state.wrapperStyle.blur, 'none'); assert.equal(state.glassLabel, false);
  assert.equal(state.left, '16px'); assert.equal(state.top, '200px', 'native tooltip positioning stays owned by YouTube');
  assert.ok(state.panel.width <= state.hint.width + .1);
  assert.ok(state.label.x >= state.panel.x && state.label.right <= state.panel.right + .1);
  assert.ok(state.label.y >= state.panel.y && state.label.bottom <= state.panel.bottom + .1, 'label stays inside panel');
  if (!legacy) {
    assert.equal(state.labelStyle.background, 'rgba(0, 0, 0, 0)'); assert.equal(state.labelStyle.blur, 'none');
    if (state.keyText) {
      assert.ok(state.key.x - state.label.right >= 7.9, 'name and shortcut have an eight-pixel gap');
      assert.ok(state.key.right <= state.panel.right && state.key.y >= state.panel.y && state.key.bottom <= state.panel.bottom);
    } else assert.equal(state.key.width, 0, 'empty shortcut does not leave a badge');
  }
}
(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true, viewport:{width:1100,height:800},
    ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 90000), errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:fixture(new URL(route.request().url()).searchParams.get('mode'))}));
    const cdp = await context.browser().newBrowserCDPSession(), {id} = await cdp.send('Extensions.loadUnpacked',{path:root});
    const admin = await context.newPage(); await admin.goto('chrome-extension://' + id + '/popup.html');
    await admin.waitForSelector('#settings-form:not([inert])');
    const page = await context.newPage();
    for (const mode of ['classic', 'modern', 'fade', 'legacy']) {
      await admin.evaluate(() => chrome.storage.sync.set({themeEnabled:false}));
      await page.goto('https://www.youtube.com/watch?v=tooltip&mode=' + mode);
      await page.waitForSelector('#yt-custom-progress-style',{state:'attached'});
      await page.locator('#captions').hover(); const native = await inspect(page);
      const preview = () => page.locator('#seek-preview').evaluate(el => ({html:el.innerHTML,background:getComputedStyle(el).backgroundColor,rect:[el.offsetWidth,el.offsetHeight]}));
      const before = await preview();
      await admin.evaluate(() => chrome.storage.sync.set({themeEnabled:true,uiOpacity:42,uiBlur:12,surfaceColor:'#fff',pageColor:'#fff',textColor:'#111'}));
      await page.waitForFunction(() => document.documentElement.hasAttribute('data-ytc-theme'));
      for (const selector of ['#captions', '#settings', '#fullscreen']) {
        await page.locator(selector).hover(); const state = await inspect(page); check(state,mode === 'legacy');
        assert.equal(state.labelText, await page.locator(selector).getAttribute('data-label'), 'native names remain intact');
      }
      for (const [opacity,blur] of [[0,0],[100,30]]) {
        await admin.evaluate(([uiOpacity,uiBlur]) => chrome.storage.sync.set({uiOpacity,uiBlur}), [opacity,blur]);
        await page.waitForFunction(value => document.documentElement.style.getPropertyValue('--ytc-ui-opacity') === String(value/100),opacity);
        await page.locator('#captions').hover(); check(await inspect(page), mode === 'legacy');
      }
      await page.locator('#captions').evaluate(el => el.dataset.label = '字幕/隐藏式字幕暂时无法使用 — This is a longer translated tooltip label that must remain readable inside the player.');
      await page.mouse.move(0,0); await page.setViewportSize({width:360,height:800}); await page.locator('#captions').hover();
      check(await inspect(page), mode === 'legacy');
      await page.mouse.move(0,0); assert.equal(await page.locator('#hint').isVisible(),false,'native hide on mouse leave still works');
      assert.deepEqual(await preview(),before,'timeline preview contents, dimensions and background stay native');
      await page.setViewportSize({width:1100,height:800});
      await page.locator('#fullscreen').click(); await page.locator('#captions').hover(); check(await inspect(page),mode === 'legacy');
      await page.evaluate(() => document.exitFullscreen());
      await admin.evaluate(() => chrome.storage.sync.set({themeEnabled:false}));
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-theme'));
      await page.locator('#captions').evaluate(el => el.dataset.label = 'Subtitles/closed captions unavailable');
      await page.mouse.move(0,0); await page.locator('#captions').hover();
      assert.deepEqual(await inspect(page),native,'disabling the theme restores native tooltip appearance');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: classic/modern/fading/legacy native tooltips, readable single panels at all opacities, label/shortcut spacing, unavailable names, long labels, narrow/fullscreen layouts, native show/hide/restoration and unchanged timeline previews.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
