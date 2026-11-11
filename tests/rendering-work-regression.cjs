// Measure real content-script rendering work while settings and native controls change.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = `<!doctype html><style>
  body{margin:0}ytd-app{display:block}.html5-video-player{width:800px;height:450px}
  .ytp-left-controls{display:flex;align-items:center}.ytp-volume-area{height:40px;width:90px}
  .ytp-progress-list{position:relative}.ytp-scrubber-button{position:absolute}
  </style><ytd-app><div id="movie_player" class="html5-video-player">
  <video></video><div class="ytp-chrome-bottom"><div class="ytp-progress-bar-container">
  <div class="ytp-progress-list"><div class="ytp-play-progress"></div><div class="ytp-load-progress"></div>
  <div class="ytp-scrubber-button"></div></div></div><div class="ytp-chrome-controls">
  <div class="ytp-left-controls"><button class="ytp-play-button">Play</button><div class="ytp-volume-area"></div></div>
  <div class="ytp-right-controls"><button class="ytp-settings-button">Settings</button></div>
  </div></div></div></ytd-app>`;
(async () => {
  const context = await chromium.launchPersistentContext('', {channel:'chrome',headless:true,
    viewport:{width:1280,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline = setTimeout(() => void context.close(), 60000), errors = [];
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:fixture}));
    const cdp = await context.browser().newBrowserCDPSession();
    const {id} = await cdp.send('Extensions.loadUnpacked',{path:root});
    const menu = await context.newPage(); await menu.goto('chrome-extension://' + id + '/popup.html');
    await menu.waitForSelector('#settings-form:not([inert])');
    const page = await context.newPage(); page.on('pageerror',error => errors.push(error.message));
    await page.goto('https://www.youtube.com/watch?v=render-work');
    await page.waitForSelector('.ytc-volume-boost');
    const tabId = await menu.evaluate(async () => (await chrome.tabs.query({url:'https://www.youtube.com/watch?v=render-work'}))[0].id);
    const settings = await menu.evaluate(() => ({...YTCustomizer.defaults,themeEnabled:true,progressEffect:'pulse'}));
    const preview = patch => menu.evaluate(async ({tabId,settings}) => {
      const response = await chrome.tabs.sendMessage(tabId,{type:'YT_PROGRESS_LIVE_PREVIEW',settings},{frameId:0});
      if (!response.applied) throw Error('Live preview was not applied');
    },{tabId,settings:Object.assign(settings,patch)});
    await preview({}); await page.waitForTimeout(200);
    await menu.evaluate(async tabId => chrome.scripting.executeScript({target:{tabId},func:() => {
      const runtime = YTCustomizerContent;
      globalThis.renderBuilderCalls = 0;
      globalThis.renderHeightReads = 0;
      const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype,'offsetHeight');
      Object.defineProperty(HTMLElement.prototype,'offsetHeight',{...height,get() {
        if (this.classList.contains('ytp-volume-area')) renderHeightReads++;
        return height.get.call(this);
      }});
      for (const name of ['buildSurfaceCss','buildHomepageGlassCss','buildButtonCss']) {
        const build = runtime[name]; runtime[name] = (...args) => { renderBuilderCalls++; return build(...args); };
      }
    }}),tabId);
    await page.evaluate(() => {
      window.renderWork = {sheetWrites:0,sheetBytes:0,boostWrites:0};
      window.renderObserver = new MutationObserver(records => {
        for (const record of records) {
          if (record.target.id === 'yt-custom-progress-style') {
            renderWork.sheetWrites++; renderWork.sheetBytes += record.target.textContent.length;
          }
          if (record.type === 'attributes' && record.target.closest?.('[data-ytc-volume-boost-owned]')) renderWork.boostWrites++;
        }
      });
      renderObserver.observe(document.documentElement,{subtree:true,childList:true,attributes:true});
    });
    for (let i=0;i<24;i++) {
      const barHeight = 3 + i % 12, thumbSize = 10 + i % 25;
      await preview({barHeight,thumbSize});
      const geometry = await page.evaluate(() => {
        const bar = getComputedStyle(document.querySelector('.ytp-progress-list'));
        const thumb = getComputedStyle(document.querySelector('.ytp-scrubber-button'));
        return {bar:bar.height,width:thumb.width,height:thumb.height,left:thumb.marginLeft,top:thumb.marginTop,transform:bar.transform};
      });
      assert.equal(geometry.bar,barHeight+'px'); assert.equal(geometry.width,thumbSize+'px'); assert.equal(geometry.height,thumbSize+'px');
      assert.equal(geometry.left,-thumbSize/2+'px'); assert.equal(geometry.top,-Math.max(0,(thumbSize-barHeight)/2)+'px');
      assert.equal(geometry.transform,'matrix(1, 0, 0, 1, 0, ' + -Math.max(0,Math.round((barHeight-4)/2)) + ')');
    }
    await page.waitForTimeout(150);
    const geometryWork = await page.evaluate(() => ({...renderWork}));
    assert.equal(geometryWork.sheetWrites,0,'size sliders must keep the main stylesheet intact');
    assert.equal(geometryWork.boostWrites,0,'size sliders must not repaint unchanged audio controls');
    for (let i=0;i<6;i++) await preview({progressColor:i%2?'#3377aa':'#aa3377'});
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.ytp-play-progress')).backgroundColor === 'rgb(51, 119, 170)');
    const [{result:staticBuilds}] = await menu.evaluate(async tabId => chrome.scripting.executeScript({target:{tabId},func:() => renderBuilderCalls}),tabId);
    await page.evaluate(() => {renderWork.boostWrites=0;});
    for (let i=0;i<6;i++) {
      await page.evaluate(i => {
        document.querySelector('.native-state')?.remove();
        const state = document.createElement('span'); state.className='native-state'; state.textContent='Native state '+i;
        document.querySelector('.ytp-left-controls').append(state);
      },i);
      await page.waitForTimeout(30);
    }
    const idleBoostWrites = await page.evaluate(() => renderWork.boostWrites);
    const [{result:mountHeightReads}] = await menu.evaluate(async tabId => chrome.scripting.executeScript({target:{tabId},func:() => renderHeightReads}),tabId);
    assert.equal(staticBuilds,0,'settings-independent CSS is reused across geometry and color edits');
    assert.equal(idleBoostWrites,0,'native control churn must not rewrite unchanged boost controls');
    assert.equal(mountHeightReads,0,'routine mounts must not poll the native volume height');
    // ResizeObserver still tracks the native capsule without polling layout during mounts.
    await page.locator('.ytp-volume-area').evaluate(element => {element.style.height='32px';});
    await page.waitForFunction(() => document.querySelector('.ytc-volume-boost').getBoundingClientRect().height === 32);
    await preview({audioEnabled:true,volumeBoost:320});
    await page.waitForFunction(() => document.querySelector('.ytc-volume-boost-value').textContent === '320%');
    assert.equal(await page.locator('.ytc-volume-boost-toggle').getAttribute('aria-pressed'),'true');
    await preview({themeEnabled:false,barHeight:14,thumbSize:34});
    assert.equal(await page.locator('.ytp-play-progress').evaluate(element => getComputedStyle(element).height),'14px','player geometry works with page theming disabled');
    await preview({thumbSize:10});
    assert.equal(await page.locator('.ytp-scrubber-button').evaluate(element => getComputedStyle(element).marginTop),'0px','a knob smaller than the bar keeps the native top alignment');
    await preview({thumbSize:34});
    // A removed sheet is rebuilt, even when the next settings update is token-only.
    await page.locator('#yt-custom-progress-style').evaluate(element => element.remove());
    await page.waitForSelector('#yt-custom-progress-style',{state:'attached'});
    assert.equal(await page.locator('.ytp-scrubber-button').evaluate(element => getComputedStyle(element).width),'34px');
    await menu.evaluate(async tabId => chrome.scripting.executeScript({target:{tabId},func:() => globalThis.__ytProgressCustomizer.dispose()}),tabId);
    assert.equal(await page.evaluate(() => ['--ytc-player-bar-height','--ytc-player-bar-offset','--ytc-player-thumb-size'].some(key => document.documentElement.style.getPropertyValue(key))),false,'disposal removes player geometry tokens');
    console.log('Rendering work:',JSON.stringify({geometryWork,staticBuilds,idleBoostWrites,mountHeightReads}));
    assert.deepEqual(errors,[]);
    console.log('PASS: live geometry, colors, native-height updates, audio state, theme-off rendering and stylesheet repair.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
