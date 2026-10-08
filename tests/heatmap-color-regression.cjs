// Replay colors must preserve the native SVG gradient, clipping, hover, and seek controls.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const shape = 'M0 95 C50 50 100 85 150 45 S250 10 300 40 S400 90 500 50 S600 5 700 30 S800 80 900 40 S950 60 1000 10 L1000 100 L0 100 Z';
const fixture = `<!doctype html><html><head><style>
  body{margin:24px;background:#303030;color:white;font:16px Arial} .html5-video-player{position:relative;width:min(100%,960px);height:400px;background:#151515}
  .ytp-progress-bar-container{position:absolute;bottom:44px;left:12px;right:12px;height:20px;cursor:pointer} .ytp-progress-list{position:absolute;bottom:0;left:0;right:0;background:#444}
  .ytp-play-progress{width:40%;background:red} .ytp-load-progress{position:absolute;inset:0 auto 0 0;width:70%;background:#777}
  .ytp-heat-map-container{display:none;pointer-events:none;position:absolute;bottom:6px;left:0;right:0;height:40px} .ytp-progress-bar-container:hover .ytp-heat-map-container{display:block}
  .ytp-heat-map-chapter,.ytp-heat-map-svg{width:100%;height:100%} .ytp-heat-map-played_bar .ytp-heat-map-hover{fill:rgba(255,255,255,.5)} .ytp-modern-heat-map{display:none} .ytp-delhi-modern .ytp-modern-heat-map{display:block} .ytp-delhi-modern .ytp-heat-map-graph,.ytp-delhi-modern .ytp-heat-map-hover{display:none}
  button{position:absolute;bottom:8px;left:12px;width:60px;height:28px} #unrelated-icon{position:absolute;top:20px;right:20px;width:30px;height:30px}
</style></head><body><ytd-watch-flexy><div class="html5-video-player ytp-delhi-modern" id="player">
  <div class="ytp-progress-bar-container" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="40">
    <div class="ytp-heat-map-container"><div class="ytp-heat-map-chapter"><svg class="ytp-heat-map-svg" viewBox="0 0 1000 100" preserveAspectRatio="none">
      <defs><clipPath id="replay-shape"><path class="ytp-heat-map-path" fill="white" d="${shape}"></path></clipPath><linearGradient id="ytp-heat-map-gradient-def" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="white" stop-opacity="1"></stop><stop offset="100%" stop-color="white" stop-opacity="0"></stop></linearGradient></defs>
      <rect class="ytp-heat-map-graph" clip-path="url(#replay-shape)" fill="white" fill-opacity=".4" width="100%" height="100%"></rect>
      <rect class="ytp-heat-map-hover" clip-path="url(#replay-shape)" fill="white" fill-opacity=".7" width="25%" height="100%"></rect>
      <path class="ytp-modern-heat-map" fill="url(#ytp-heat-map-gradient-def)" stroke="white" stroke-opacity="1" stroke-width="2" d="${shape}"></path>
    </svg></div></div><div class="ytp-progress-list"><div class="ytp-load-progress"></div><div class="ytp-play-progress"></div></div>
  </div><button id="pause">Pause</button><svg id="unrelated-icon"><path fill="white" stroke="white" d="M0 0 L20 20"></path></svg>
</div></ytd-watch-flexy><script>
  window.seekActions=0;document.querySelector('[role=slider]').addEventListener('keydown',event=>{if(event.key==='ArrowRight'){window.seekActions++;event.currentTarget.setAttribute('aria-valuenow','45')}});
  document.querySelector('#pause').addEventListener('click',event=>event.currentTarget.textContent=event.currentTarget.textContent==='Pause'?'Play':'Pause');
</script></body></html>`;
const colors = page => page.evaluate(() => {
  const player=document.querySelector('#player'),css=selector=>getComputedStyle(player.querySelector(selector));
  return {graph:css('.ytp-heat-map-graph').fill,hover:css('.ytp-heat-map-hover').fill,outline:css('.ytp-modern-heat-map').stroke,
    stops:[...player.querySelectorAll('stop')].map(stop=>[getComputedStyle(stop).stopColor,getComputedStyle(stop).stopOpacity]),
    gradient:css('.ytp-modern-heat-map').fill,graphOpacity:css('.ytp-heat-map-graph').fillOpacity,hoverOpacity:css('.ytp-heat-map-hover').fillOpacity,
    progress:css('.ytp-play-progress').backgroundColor,buffer:css('.ytp-load-progress').backgroundColor,
    unrelated:getComputedStyle(document.querySelector('#unrelated-icon path')).fill};
});
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1200,height:800},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),60000);
  try {
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
    const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    // An existing installation without the new field gets the native white heatmap.
    await popup.evaluate(async()=>{await chrome.storage.sync.clear();await chrome.storage.sync.set({progressColor:'#1a86d9',bufferColor:'#858585',uiOpacity:42});});
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('https://www.youtube.com/watch?v=EOTAWLaDa58');await page.waitForSelector('#yt-custom-progress-style',{state:'attached'});
    assert.equal((await colors(page)).outline,'rgb(255, 255, 255)');
    const nativeShape=await page.locator('.ytp-heat-map-svg').innerHTML();
    await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');await page.bringToFront();await popup.locator('#tab-player').click();
    await popup.locator('#heatmapColor').fill('#35c2a4');
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ytp-modern-heat-map')).stroke==='rgb(53, 194, 164)');
    const state=await colors(page);
    assert.equal(state.graph,'rgb(53, 194, 164)');assert.equal(state.hover,state.graph);assert.equal(state.outline,state.graph);
    assert.deepEqual(state.stops,[[state.graph,'1'],[state.graph,'0']]);assert.ok(state.gradient.includes('ytp-heat-map-gradient-def'));
    assert.equal(state.graphOpacity,'0.4');assert.equal(state.hoverOpacity,'0.7');assert.equal(state.progress,'rgb(26, 134, 217)');assert.equal(state.buffer,'rgb(133, 133, 133)');assert.equal(state.unrelated,'rgb(255, 255, 255)');
    assert.equal(await page.locator('.ytp-heat-map-svg').innerHTML(),nativeShape,'recoloring preserves the SVG geometry, clip path, and attributes');
    assert.deepEqual(await popup.locator('.preview-heatmap').evaluate(svg=>({stroke:getComputedStyle(svg.querySelector('path')).stroke,stops:[...svg.querySelectorAll('stop')].map(stop=>getComputedStyle(stop).stopColor)})),{stroke:state.graph,stops:[state.graph,state.graph]});
    await popup.waitForFunction(async()=> (await chrome.storage.sync.get('heatmapColor')).heatmapColor==='#35c2a4');
    await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');assert.equal(await popup.locator('#heatmapColor').inputValue(),'#35c2a4');
    await page.reload();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ytp-modern-heat-map')).stroke==='rgb(53, 194, 164)');
    await page.locator('[role=slider]').hover();await page.locator('.ytp-heat-map-container').waitFor({state:'visible'});
    if(process.env.YTC_SCREENSHOTS)await page.locator('#player').screenshot({path:path.join(os.tmpdir(),'ytc-heatmap-custom.png')});
    await page.locator('[role=slider]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>window.seekActions),1);
    await page.locator('#pause').click();assert.equal(await page.locator('#pause').textContent(),'Play');
    await page.mouse.move(1100,700);await page.locator('.ytp-heat-map-container').waitFor({state:'hidden'});
    await page.locator('#player').evaluate(player=>player.classList.remove('ytp-delhi-modern'));
    assert.equal((await colors(page)).graph,state.graph,'classic renderer shares the chosen color');
    await page.locator('#player').evaluate(player=>player.classList.add('ytp-heat-map-played_bar'));
    assert.equal((await colors(page)).hover,'rgba(53, 194, 164, 0.5)','native played-bar alpha is preserved');
    await page.locator('#player').evaluate(player=>player.classList.remove('ytp-heat-map-played_bar'));
    await page.locator('.ytp-modern-heat-map').evaluate(path=>path.setAttribute('stroke','white'));
    assert.equal((await colors(page)).outline,state.graph,'native repaint cannot replace the selected color');
    await page.bringToFront();await popup.locator('#tab-player').click();await popup.locator('#reset').click();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ytp-modern-heat-map')).stroke==='rgb(255, 255, 255)');
    assert.equal(await popup.locator('#heatmapColor').inputValue(),'#ffffff');assert.equal((await popup.evaluate(()=>chrome.storage.sync.get('uiOpacity'))).uiOpacity,42,'Player reset preserves Appearance settings');
    await popup.evaluate(()=>chrome.storage.sync.set({heatmapColor:'#fff;url(https://example.invalid)'}));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.ytp-modern-heat-map')).stroke==='rgb(255, 255, 255)');
    await popup.evaluate(async()=>{const [tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=EOTAWLaDa58'});await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>globalThis.__ytProgressCustomizer.dispose()});});
    await page.waitForFunction(()=>!document.querySelector('#yt-custom-progress-style'));
    assert.equal((await colors(page)).outline,'rgb(255, 255, 255)');assert.equal(await page.locator('.ytp-heat-map-svg').innerHTML(),nativeShape,'disposal leaves native SVG intact');
    assert.deepEqual(errors,[]);
    console.log('PASS: replay color UI/preview, old-settings default, live update/persistence, native modern gradient/outline, classic/hover opacity, clipping/seek/pause, independent progress/buffer colors, reset, validation, and disposal.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
