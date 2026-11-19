// Search-to-watch navigation must settle while native player/counter updates continue.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fixture = `<!doctype html><style>
  [hidden]{display:none!important}ytd-app,ytd-search,ytd-video-renderer,ytd-watch-flexy,ytd-watch-metadata{display:block}
  ytd-video-renderer{height:100px}.html5-video-player{height:220px;width:640px}
  </style><ytd-app><button id="heartbeat">Check response</button><ytd-search>
  <ytd-video-renderer><a id="result" href="/watch?v=aaaaaaaaaaa">Film result</a>
  <div id="metadata-line"><span class="inline-metadata-item">123 views</span><span class="inline-metadata-item date">6 years ago</span></div>
  <ytd-thumbnail><div id="preview"><div id="movie_player" class="html5-video-player"><video></video>
  <div class="ytp-time-current"></div><div class="ytp-left-controls"><div class="ytp-volume-area"></div></div>
  <div class="ytp-right-controls"><button class="ytp-settings-button">Settings</button></div></div></div></ytd-thumbnail>
  </ytd-video-renderer></ytd-search><div id="watch-mount"></div></ytd-app><script>
  document.querySelector('#result').onclick=event=>{
    event.preventDefault();document.dispatchEvent(new Event('yt-navigate-start'));
    history.pushState({},'',event.currentTarget.href);document.querySelector('ytd-search').hidden=true;
    const watch=document.createElement('ytd-watch-flexy');watch.innerHTML='<ytd-watch-metadata><h1 id="title">Film title</h1><yt-formatted-string id="info"><span id="views">123 views</span> • 6 years ago</yt-formatted-string><div id="description"></div></ytd-watch-metadata>';
    document.querySelector('#watch-mount').replaceChildren(watch);watch.prepend(document.querySelector('#movie_player'));
    document.dispatchEvent(new Event('yt-navigate-finish'));document.dispatchEvent(new Event('yt-page-data-updated'));
  };
  document.querySelector('#heartbeat').onclick=event=>requestAnimationFrame(()=>window.responseMs=performance.now()-event.timeStamp);
  </script>`;

(async () => {
  const context = await chromium.launchPersistentContext('', {channel:'chrome',headless:true,
    ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline = setTimeout(() => void context.close(), 60000), errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:fixture}));
    const cdp = await context.browser().newBrowserCDPSession();
    const {id} = await cdp.send('Extensions.loadUnpacked', {path:path.resolve(__dirname,'..')});
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(() => { globalThis.fetch = async () => new Response('<meta itemprop="datePublished" content="2020-02-03">'); });
    const menu = await context.newPage(); await menu.goto('chrome-extension://'+id+'/popup.html');
    await menu.waitForSelector('#settings-form:not([inert])');
    await menu.evaluate(() => chrome.storage.sync.set({themeEnabled:true,uiOpacity:30,uiBlur:12}));
    const page = await context.newPage(); await page.goto('https://www.youtube.com/results?search_query=film');
    await page.waitForFunction(() => document.querySelector('ytd-search .date')?.hasAttribute('data-ytc-publication-date'));
    await page.locator('#result').click();
    await page.waitForFunction(() => document.querySelector('ytd-watch-metadata #info')?.hasAttribute('data-ytc-publication-date'));
    await page.waitForTimeout(200);
    const tabId = await menu.evaluate(async () => (await chrome.tabs.query({url:'https://www.youtube.com/watch*'}))[0].id);
    await menu.evaluate(async tabId => chrome.scripting.executeScript({target:{tabId},func:() => {
      globalThis.watchWork = {frames:0,scans:0,writes:0};
      const frame = requestAnimationFrame;
      globalThis.requestAnimationFrame = callback => { if(callback.name==='flush')watchWork.frames++; return frame(callback); };
      const query = Element.prototype.querySelectorAll;
      Element.prototype.querySelectorAll = function(selector,...args) {
        if(selector.startsWith('#info,#info > span') && this.matches('ytd-watch-metadata,ytd-video-primary-info-renderer,ytd-video-description-header-renderer'))watchWork.scans++;
        return query.call(this,selector,...args);
      };
      const data = Object.getOwnPropertyDescriptor(CharacterData.prototype,'data');
      Object.defineProperty(CharacterData.prototype,'data',{...data,set(value) {
        if(this.parentElement?.closest('[data-ytc-publication-date]'))watchWork.writes++;
        return data.set.call(this,value);
      }});
    }}), tabId);
    const read = () => menu.evaluate(async tabId => (await chrome.scripting.executeScript({target:{tabId},func:() => ({...watchWork})}))[0].result, tabId);
    const samples = [];
    for(const kind of ['player','metadata','metadata-replacement']) {
      const before = await read();
      for(let tick=0;tick<12;tick++) {
        await page.evaluate(({kind,tick}) => {
          if(kind==='player')document.querySelector('.ytp-time-current').innerHTML='<span><span>0:'+tick+'</span></span>';
          else {
            if(kind==='metadata-replacement')document.querySelector('#views').innerHTML='<span><span>'+(123+tick)+' views</span></span>';
            else document.querySelector('#views').firstChild.data=(123+tick)+' views';
            document.querySelector('#title').firstChild.data='Film title '+tick;
          }
        },{kind,tick});
        await page.waitForTimeout(25);
      }
      await page.waitForTimeout(100);
      const after = await read(), work = Object.fromEntries(Object.keys(after).map(key=>[key,after[key]-before[key]]));
      samples.push({kind,...work});
      assert.deepEqual(work,{frames:0,scans:0,writes:0},kind+': native updates must not restart date discovery or rendering');
    }
    assert.match(await page.locator('ytd-watch-metadata #info').textContent(),/2020-02-03 \(/);
    const label = await page.locator('ytd-watch-metadata #info').textContent();
    assert.equal(await page.locator('ytd-watch-metadata #info').getAttribute('aria-label'),label,'combined accessible labels keep the current native view count');
    assert.equal(await page.locator('ytd-watch-metadata #info').getAttribute('title'),label);
    // Native replacement and later hydration still repair the date without a reload.
    await page.locator('ytd-watch-metadata #info').evaluate(node => { node.lastChild.data=' • 7 years ago'; });
    await page.waitForFunction(() => document.querySelector('ytd-watch-metadata #info').textContent.includes('2020-02-03 ('));
    await page.locator('ytd-watch-metadata #info').evaluate(node => { node.innerHTML='<span id="views">999 views</span><span id="date">8 years ago</span>'; });
    await page.waitForFunction(() => document.querySelector('ytd-watch-metadata #date')?.textContent.startsWith('2020-02-03 ('));
    await page.locator('#date').evaluate(node => node.remove());
    await page.waitForTimeout(100);
    await page.locator('ytd-watch-metadata #info').evaluate(node => { const date=document.createElement('span');date.id='date';date.textContent='9 years ago';node.append(date); });
    await page.waitForFunction(() => document.querySelector('ytd-watch-metadata #date')?.textContent.startsWith('2020-02-03 ('));
    await page.locator('#heartbeat').click();await page.waitForFunction(() => window.responseMs!==undefined);
    assert.ok(await page.evaluate(() => responseMs<250),'controls remain responsive after SPA navigation');
    const before = await read(); await page.waitForTimeout(250); assert.deepEqual(await read(),before,'date rendering settles after repair');
    assert.deepEqual(errors,[]);
    console.log('Watch navigation work:',JSON.stringify(samples));
    console.log('PASS: retained search/preview handoff, idle player/counter updates, native date replacement/hydration, and responsive controls.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
