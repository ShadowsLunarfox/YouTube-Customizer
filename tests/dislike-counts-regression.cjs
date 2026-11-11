// Exercise opt-in estimates through the real worker and native YouTube-shaped controls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');

async function checkService() {
  let now = Date.now(), calls = 0, stored = {}, next = {dislikes:123}, options, status = 200;
  const sandbox = {URL,AbortController,Response,clearTimeout,
    setTimeout:(fn,ms) => setTimeout(fn,ms === 8000 ? 10 : ms),
    Date:class extends Date {static now(){return now;}},
    chrome:{storage:{session:{get:async () => structuredClone(stored),set:async values => {stored=structuredClone(values);}}}},
    fetch:async (url,init) => {
      calls++; options={url,init};
      if (next === 'offline') throw Error('offline');
      if (next === 'timeout') return new Promise((resolve,reject) => init.signal.addEventListener('abort',() => reject(Error('aborted'))));
      await new Promise(resolve => setTimeout(resolve,2));
      return new Response(JSON.stringify({id:new URL(url).searchParams.get('videoId'),...next}),{status,headers:{'Retry-After':'120'}});
    }};
  vm.runInNewContext(fs.readFileSync(path.join(root,'content/dislike-counts.js'),'utf8'),sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(root,'settings.js'),'utf8'),sandbox);
  assert.equal(sandbox.YTCustomizer.defaults.showDislikeEstimates,false);
  const backup=sandbox.YTCustomizer.createBackup({showDislikeEstimates:true},{},{},{},false);
  assert.equal(sandbox.YTCustomizer.parseBackup(JSON.stringify(backup)).settings.showDislikeEstimates,true);
  delete backup.settings.showDislikeEstimates;
  assert.equal(sandbox.YTCustomizer.parseBackup(JSON.stringify(backup)).settings.showDislikeEstimates,false,'older backups keep third-party estimates disabled');
  const api = sandbox.YTCustomizerDislikes, service = api.createService();
  for (const url of ['https://www.youtube.com/watch?v=aaaaaaaaaaa','https://www.youtube.com/shorts/aaaaaaaaaaa','https://youtube.com/live/aaaaaaaaaaa']) assert.equal(api.videoId(url),'aaaaaaaaaaa');
  for (const url of ['http://www.youtube.com/watch?v=aaaaaaaaaaa','https://www.youtube.com.evil.invalid/watch?v=aaaaaaaaaaa','https://evil@youtube.com/watch?v=aaaaaaaaaaa','https://music.youtube.com/watch?v=aaaaaaaaaaa','https://www.youtube.com/watch?v=short','https://www.youtube.com/embed/aaaaaaaaaaa']) assert.equal(api.videoId(url),'');
  assert.equal((await service.get('../invalid')).ok,false); assert.equal(calls,0);
  const results = await Promise.all([service.get('aaaaaaaaaaa'),service.get('aaaaaaaaaaa')]);
  assert.equal(calls,1); assert.ok(results.every(value => value.ok && value.dislikes===123));
  assert.equal(options.url,'https://returnyoutubedislikeapi.com/votes?videoId=aaaaaaaaaaa');
  assert.equal(options.init.credentials,'omit'); assert.equal(options.init.referrerPolicy,'no-referrer'); assert.equal(options.init.redirect,'error');
  await api.createService().get('aaaaaaaaaaa'); assert.equal(calls,1,'session cache survives worker recreation');
  now+=1800001; await service.get('aaaaaaaaaaa'); assert.equal(calls,2,'expired counts are refreshed');
  next={dislikes:0}; assert.equal((await service.get('bbbbbbbbbbb')).dislikes,0);
  for (const value of [{dislikes:-1},{dislikes:'12'},{dislikes:Infinity},{dislikes:1,deleted:true},{id:'mismatch-id',dislikes:4}]) {
    now+=1800001; next=value; assert.equal((await service.get('ccccccccccc')).ok,false);
  }
  next='offline'; assert.equal((await service.get('ddddddddddd')).ok,false);
  const failedCalls=calls; await service.get('ddddddddddd'); assert.equal(calls,failedCalls,'failures are cached rather than retried on DOM churn');
  next='timeout'; assert.equal((await service.get('eeeeeeeeeee')).ok,false); assert.equal(options.init.signal.aborted,true);
  next={dislikes:25}; status=429; await service.get('fffffffffff');
  const limitedCalls=calls; assert.equal((await service.get('ggggggggggg')).ok,false); assert.equal(calls,limitedCalls,'429 backs off across all video IDs');
  now+=120001; status=200; assert.equal((await service.get('ggggggggggg')).dislikes,25);
  for (let i=0;i<129;i++) await service.get(String(i).padStart(11,'0'));
  assert.equal(stored.dislikeEstimates.items.length,128,'the session cache stays bounded');
  const beforeEviction=calls; await service.get('00000000000'); assert.equal(calls,beforeEviction+1,'old cache entries are evicted');
  console.log('PASS: estimate validation, deduplicated/session-cached requests, TTL, zero, offline/timeout, and rate-limit backoff.');
}

const controls = legacy => legacy ? `<div id="top-level-buttons-computed"><ytd-toggle-button-renderer><button>Like</button></ytd-toggle-button-renderer><ytd-toggle-button-renderer><button class="native-dislike" aria-label="Dislike" aria-pressed="false">Dislike</button></ytd-toggle-button-renderer></div>` :
  `<segmented-like-dislike-button-view-model><like-button-view-model><button>Like</button></like-button-view-model><dislike-button-view-model><button class="native-dislike" aria-label="Dislike" aria-pressed="false"><span>Dislike</span></button></dislike-button-view-model></segmented-like-dislike-button-view-model>`;
const fixture = legacy => `<!doctype html><style>body{margin:20px;font:14px Arial}ytd-app,ytd-watch-metadata,ytd-reel-video-renderer{display:block}button{min-width:70px;height:40px}.native-dislike{display:inline-flex;align-items:center;white-space:nowrap;box-sizing:border-box;width:56px;min-width:56px;padding:0 16px}ytd-reel-video-renderer[hidden]{display:none}</style>
  <ytd-app><ytd-watch-metadata><div id="actions">${controls(legacy)}</div></ytd-watch-metadata><div id="unrelated"></div></ytd-app>
  <script>document.addEventListener('click',event=>{const button=event.target.closest('.native-dislike');if(button){button.setAttribute('aria-pressed',String(button.getAttribute('aria-pressed')!=='true'));window.nativeClicks=(window.nativeClicks||0)+1;}})</script>`;

(async () => {
  await checkService();
  const context = await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1280,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(() => void context.close(),90000), errors=[];
  context.on('page',page => page.on('pageerror',error => errors.push(error.message)));
  try {
    await context.route('https://www.youtube.com/**',route => route.fulfill({contentType:'text/html',body:fixture(route.request().url().includes('legacy'))}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(() => {
      globalThis.estimateRequests=[];
      globalThis.fetch=async (url,options) => {
        const id=new URL(url).searchParams.get('videoId'); estimateRequests.push({id,credentials:options.credentials});
        await new Promise(resolve => setTimeout(resolve,id==='ccccccccccc'?250:60));
        return new Response(JSON.stringify({id,dislikes:id==='bbbbbbbbbbb'?0:id==='ccccccccccc'?9876:1234}),{status:id==='eeeeeeeeeee'?404:200});
      };
    });
    const menu=await context.newPage(); await menu.goto('chrome-extension://'+id+'/popup.html'); await menu.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage(); await page.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    await page.waitForSelector('#yt-custom-progress-style',{state:'attached'}); await page.waitForTimeout(100);
    assert.equal(await menu.locator('#showDislikeEstimates').isChecked(),false);
    assert.equal(await worker.evaluate(() => estimateRequests.length),0,'disabled feature makes no third-party requests');
    const tabId=await menu.evaluate(async () => (await chrome.tabs.query({url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'}))[0].id);
    const requestFromPage=id => menu.evaluate(async ({tabId,id}) => {
      const [injection]=await chrome.scripting.executeScript({target:{tabId},args:[id],func:id=>YTCustomizer.sendRuntimeMessage({type:'YT_DISLIKE_ESTIMATE',videoId:id}).catch(()=>null)});
      return injection.result;
    },{tabId,id});
    assert.equal((await requestFromPage('aaaaaaaaaaa')).ok,false,'worker also enforces the saved opt-in');
    assert.equal(await worker.evaluate(() => estimateRequests.length),0);
    await menu.locator('#tab-player').click(); await menu.locator('#showDislikeEstimates').check();
    await page.waitForSelector('.ytc-dislike-estimate');
    assert.equal(await page.locator('.ytc-dislike-estimate').textContent(),'≈1.2K');
    assert.match(await page.locator('.ytc-dislike-estimate').getAttribute('title'),/Estimated dislikes: 1,234.*Return YouTube Dislike/);
    assert.equal(await page.locator('.native-dislike').getAttribute('aria-label'),'Dislike');
    assert.equal(await page.locator('.ytc-dislike-estimate').evaluate(node => {const count=node.getBoundingClientRect(),button=node.closest('button').getBoundingClientRect();return count.left>=button.left && count.right<=button.right && button.height===40;}),true,'estimates fit inside native icon buttons without changing their height');
    assert.notEqual((await requestFromPage('zzzzzzzzzzz'))?.ok,true,'worker rejects requests for a different video');
    assert.equal(await worker.evaluate(() => estimateRequests.some(item=>item.id==='zzzzzzzzzzz')),false);
    await menu.reload(); await menu.waitForSelector('#settings-form:not([inert])');
    assert.equal(await menu.locator('#showDislikeEstimates').isChecked(),true,'the opt-in persists after reopening settings');
    await menu.locator('#tab-player').click();
    await page.locator('.ytc-dislike-estimate').click(); assert.equal(await page.locator('.native-dislike').getAttribute('aria-pressed'),'true');
    const navigate=async (id,shorts=false) => page.evaluate(({id,shorts}) => {history.pushState({},'',(shorts?'/shorts/':'/watch?v=')+id);document.dispatchEvent(new Event('yt-navigate-finish'));},{id,shorts});
    await navigate('bbbbbbbbbbb'); await page.waitForFunction(() => document.querySelector('.ytc-dislike-estimate')?.textContent==='≈0');
    await navigate('ccccccccccc'); await page.waitForTimeout(70); await navigate('ddddddddddd');
    await page.waitForFunction(() => document.querySelector('.ytc-dislike-estimate')?.textContent==='≈1.2K'); await page.waitForTimeout(300);
    assert.equal(await page.locator('.ytc-dislike-estimate').textContent(),'≈1.2K','an obsolete video response cannot overwrite the current estimate');
    assert.equal(await page.locator('.ytc-dislike-estimate').count(),1,'late responses and repeated mounting do not duplicate counts');
    await navigate('eeeeeeeeeee'); await page.waitForTimeout(180); assert.equal(await page.locator('.ytc-dislike-estimate').count(),0,'unavailable data is not displayed as zero');
    await navigate('aaaaaaaaaaa'); await page.waitForSelector('.ytc-dislike-estimate');
    await page.evaluate(() => {const button=document.querySelector('.native-dislike');button.replaceChildren(Object.assign(document.createElement('span'),{textContent:'Dislike'}));});
    await page.waitForSelector('.ytc-dislike-estimate');
    await page.locator('.native-dislike').evaluate(button => {const count=document.createElement('span');count.id='return-youtube-dislike-count';count.textContent='27';button.append(count);});
    await page.locator('.ytc-dislike-estimate').waitFor({state:'detached'});
    assert.equal(await page.locator('#return-youtube-dislike-count').textContent(),'27','foreign dislike counts are left intact');
    await page.locator('#return-youtube-dislike-count').evaluate(node => node.remove()); await page.waitForSelector('.ytc-dislike-estimate');
    const before=await worker.evaluate(() => estimateRequests.length);
    await page.evaluate(() => {for(let i=0;i<100;i++)document.querySelector('#unrelated').append(document.createElement('span'));});
    await page.waitForTimeout(150); assert.equal(await worker.evaluate(() => estimateRequests.length),before,'unrelated DOM changes do not fetch');
    const legacy=await context.newPage(); await legacy.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa&legacy=1'); await legacy.waitForSelector('.ytc-dislike-estimate');
    assert.equal(await legacy.locator('.ytc-dislike-estimate').count(),1); assert.equal(await worker.evaluate(() => estimateRequests.filter(item=>item.id==='aaaaaaaaaaa').length),1,'tabs share cached data');
    await page.evaluate(() => {document.querySelector('ytd-watch-metadata').remove();for(const [id,active] of [['fffffffffff',true],['ggggggggggg',false]]){const reel=document.createElement('ytd-reel-video-renderer');reel.setAttribute('video-id',id);reel.toggleAttribute('is-active',active);reel.innerHTML='<div id="dislike-button"><button class="native-dislike" aria-label="Dislike">Dislike</button></div>';document.querySelector('ytd-app').append(reel);}});
    await navigate('fffffffffff',true); await page.waitForSelector('ytd-reel-video-renderer[is-active] .ytc-dislike-estimate');
    assert.equal(await page.locator('ytd-reel-video-renderer:not([is-active]) .ytc-dislike-estimate').count(),0);
    await page.evaluate(() => {const reels=[...document.querySelectorAll('ytd-reel-video-renderer')];reels[0].removeAttribute('is-active');reels[1].setAttribute('is-active','');history.pushState({},'','/shorts/ggggggggggg');document.dispatchEvent(new Event('yt-navigate-finish'));});
    await page.waitForSelector('ytd-reel-video-renderer[video-id="ggggggggggg"] .ytc-dislike-estimate');
    assert.equal(await page.locator('ytd-reel-video-renderer:not([is-active]) .ytc-dislike-estimate').count(),0,'retired Shorts counts are removed');
    await page.evaluate(() => {
      const reel=document.querySelector('ytd-reel-video-renderer[is-active]');reel.removeAttribute('is-active');reel.removeAttribute('video-id');
      reel.innerHTML='<div id="shorts-player"></div><reel-action-bar-view-model><dislike-button-view-model><label><button class="native-dislike" style="width:48px;min-width:48px" aria-label="Dislike">↓</button><div class="ytSpecButtonShapeWithLabelLabel"><span id="native-shorts-label">Dislike</span></div></label></dislike-button-view-model></reel-action-bar-view-model>';
    });
    await page.waitForSelector('.ytSpecButtonShapeWithLabelLabel .ytc-dislike-estimate');
    assert.equal(await page.locator('#native-shorts-label').evaluate(element=>getComputedStyle(element).display),'none','the estimate uses the native Shorts label slot');
    assert.equal(await page.locator('reel-action-bar-view-model button').evaluate(element=>element.getBoundingClientRect().width),48,'Shorts circular controls keep their native size');
    await menu.locator('#menuLanguage').selectOption('zh-CN');
    await page.waitForFunction(() => document.querySelector('.ytc-dislike-estimate')?.title.startsWith('估算点踩数'));
    await menu.locator('#showDislikeEstimates').uncheck(); await page.locator('.ytc-dislike-estimate').waitFor({state:'detached'}); await legacy.locator('.ytc-dislike-estimate').waitFor({state:'detached'});
    const stopped=await worker.evaluate(() => estimateRequests.length); await navigate('hhhhhhhhhhh'); await page.waitForTimeout(120);
    assert.equal(await worker.evaluate(() => estimateRequests.length),stopped);
    assert.equal(await page.locator('.native-dislike[aria-describedby]').count(),0,'disabling removes owned accessibility descriptions');
    assert.notEqual(await page.locator('#native-shorts-label').evaluate(element=>getComputedStyle(element).display),'none','disabling restores the original Shorts label');
    await menu.reload(); await menu.waitForSelector('#settings-form:not([inert])'); assert.equal(await menu.locator('#showDislikeEstimates').isChecked(),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: default-off/menu opt-in, native buttons and accessible estimates, zero/missing data, SPA/stale replies, shared cache, legacy/modern/Shorts, foreign extension compatibility, language and disable persistence.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
