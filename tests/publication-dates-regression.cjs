// Exact calendar dates, bounded metadata lookup, and local rendering on all video surfaces.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'content/publication-dates.js'),'utf8');
async function unitChecks(){
  let now=Date.now(),calls=0,active=0,peak=0,status=200,cancelled=0,body='<meta content="2012-02-29T23:59:00-12:00" itemprop="datePublished">',stored={},credentials;
  const sandbox={URL,Intl,TextDecoder,AbortController,Response,clearTimeout,setTimeout:(fn,ms)=>setTimeout(fn,ms===10000?10:ms),
    Date:class extends Date{static now(){return now;}},chrome:{storage:{session:{get:async()=>structuredClone(stored),set:async values=>{stored=structuredClone(values);}}}},
    fetch:async(url,options)=>{calls++;credentials=options;active++;peak=Math.max(peak,active);try{await new Promise(resolve=>setTimeout(resolve,2));if(body==='offline')throw Error('offline');
      if(body==='timeout')await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout'))));
      if(body==='stream')return new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('<meta itemprop="datePublished" content="2020-01-01">'));},cancel(){cancelled++;}}));
      return new Response(body,{status});}finally{active--;}}};
  vm.runInNewContext(source,sandbox);const api=sandbox.YTCustomizerPublicationDates;
  for(const [value,expected]of [['2012-02-29','2012-02-29'],['2005-04-23T23:59:59-12:00','2005-04-23'],['2011-02-29',''],['2024-13-01',''],['3 years ago',''],[null,'']])assert.equal(api.dateOnly(value),expected);
  assert.equal(api.elapsedYears('2005-04-23',new Date(2026,3,22)),20);assert.equal(api.elapsedYears('2005-04-23',new Date(2026,3,23)),21);
  assert.equal(api.elapsedYears('2024-02-29',new Date(2025,1,28)),0);assert.equal(api.elapsedYears('2024-02-29',new Date(2025,2,1)),1);
  assert.equal(api.formatDate('2026-11-11','en',new Date(2026,10,11)),'2026-11-11 (0 years ago)');
  assert.equal(api.formatDate('2025-11-11','en',new Date(2026,10,11)),'2025-11-11 (1 year ago)');
  assert.equal(api.formatDate('2027-11-11','en',new Date(2026,10,11)),'');
  assert.equal(api.extractDate('<meta itemprop="uploadDate" content="2004-01-01"><meta CONTENT=2005-04-23 ITEMPROP=datePublished>'),'2005-04-23');
  assert.equal(api.extractDate('<p>21 years ago</p>'),'');
  const service=api.createService();assert.equal(await service.get('../invalid'),'');assert.equal(calls,0);
  const data=await Promise.all([service.get('aaaaaaaaaaa'),service.get('aaaaaaaaaaa')]);assert.deepEqual(data,['2012-02-29','2012-02-29']);assert.equal(calls,1);
  await api.createService().get('aaaaaaaaaaa');assert.equal(calls,1,'session cache survives worker restarts');
  assert.equal(credentials.credentials,'omit');assert.equal(credentials.redirect,'error');
  now+=21600001;await service.get('aaaaaaaaaaa');assert.equal(calls,2,'exact-date cache expires');
  await Promise.all(Array.from({length:12},(_,i)=>service.get(String(i).padStart(11,'0'))));assert.ok(peak<=3,'worker limits concurrent metadata downloads');
  body='offline';assert.equal(await service.get('bbbbbbbbbbb'),'');const failed=calls;await service.get('bbbbbbbbbbb');assert.equal(calls,failed,'failure cache prevents DOM-triggered retries');
  body='<meta itemprop="datePublished" content="2020-01-01">';status=429;assert.equal(await service.get('ccccccccccc'),'');const limited=calls;await service.get('ddddddddddd');assert.equal(calls,limited,'rate limits suspend further lookups');
  now+=300001;status=200;assert.equal(await service.get('ddddddddddd'),'2020-01-01');
  body='timeout';assert.equal(await service.get('hhhhhhhhhhh'),'');assert.equal(credentials.signal.aborted,true);
  body='stream';assert.equal(await service.get('iiiiiiiiiii'),'2020-01-01');assert.equal(cancelled,1,'stop downloading after the publication meta tag');
  console.log('PASS: exact-date parsing/timezones, calendar anniversaries/leap years, zero/future ages, cached/coalesced requests, concurrency, offline and rate-limit handling.');
}

const legacy=(id,age='4 years ago',extra='')=>`<ytd-rich-item-renderer class="card" data-id="${id}" ${extra}><ytd-rich-grid-media><a href="/watch?v=${id}">Video ${id}</a><div id="metadata-line"><span class="inline-metadata-item views">123K views</span><span class="inline-metadata-item date">${age}</span></div></ytd-rich-grid-media></ytd-rich-item-renderer>`;
const modern=id=>`<yt-lockup-view-model class="card" data-id="${id}"><a href="/watch?v=${id}">Modern video</a><div class="ytContentMetadataViewModelMetadataRow"><span class="ytContentMetadataViewModelMetadataText channel">2 years ago</span></div><div class="ytContentMetadataViewModelMetadataRow"><span class="ytContentMetadataViewModelMetadataText views" aria-label="2,020 views">2020</span><span class="ytContentMetadataViewModelMetadataText date">2020</span></div></yt-lockup-view-model>`;
const fixture=watch=>`<!doctype html><html lang="en"><head>${watch?'<link rel="canonical" href="https://www.youtube.com/watch?v=aaaaaaaaaaa"><meta itemprop="datePublished" content="2005-04-23T23:59:59-07:00"><meta itemprop="uploadDate" content="2004-01-01">':''}<style>
body{margin:0;font:14px Arial}ytd-app,ytd-watch-metadata,ytd-rich-item-renderer,yt-lockup-view-model{display:block}.card{height:120px;width:320px}.ytContentMetadataViewModelMetadataRow{display:flex;white-space:nowrap}.ytContentMetadataViewModelMetadataText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.date{margin-left:8px}#offscreen{margin-top:2200px}#unrelated{height:0}
</style></head><body><ytd-app>${watch?'<ytd-watch-flexy><ytd-watch-metadata><div id="info"><span id="views">448M views</span><span class="date" id="watch-date">21y ago</span><a id="location" href="#place">SAN DIEGO ZOO</a></div><button id="expand">More</button></ytd-watch-metadata></ytd-watch-flexy>':''}<div id="feed">${legacy('bbbbbbbbbbb')}${modern('bbbbbbbbbbb')}${legacy('eeeeeeeeeee','1 year ago')}${legacy('fffffffffff','Live now')}</div><div id="offscreen">${legacy('zzzzzzzzzzz')}</div><ytd-comments><span id="published-time-text">2 years ago</span></ytd-comments><div id="unrelated"></div></ytd-app><script>document.querySelector('#expand')?.addEventListener('click',()=>window.expanded=(window.expanded||0)+1)</script></body></html>`;

(async()=>{
  await unitChecks();
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,timezoneId:'Asia/Kuala_Lumpur',viewport:{width:1100,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),90000),errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  try{
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(new URL(route.request().url()).pathname==='/watch')}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(()=>{globalThis.dateRequests=[];globalThis.fetch=async(url,options)=>{
      const id=new URL(url).searchParams.get('v');dateRequests.push({id,credentials:options.credentials});await new Promise(resolve=>setTimeout(resolve,id==='ccccccccccc'?250:30));
      const date=id==='ccccccccccc'?'2018-06-15':id==='ddddddddddd'?'2000-02-29':'2020-09-17';
      return new Response('<html><meta itemprop="datePublished" content="'+date+'T23:59:59-12:00"><script>throw Error("Must never execute fetched HTML")</script></html>',{status:id==='eeeeeeeeeee'?404:200});
    };});
    const menu=await context.newPage();await menu.goto('chrome-extension://'+id+'/popup.html');await menu.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    await page.waitForFunction(()=>document.querySelector('#watch-date')?.textContent.startsWith('2005-04-23 ('));
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-id="bbbbbbbbbbb"] .date')].every(node=>node.textContent.startsWith('2020-09-17 (')));
    assert.equal(await worker.evaluate(()=>dateRequests.some(request=>request.id==='aaaaaaaaaaa')),false,'watch page uses its own authoritative date metadata');
    assert.equal(await worker.evaluate(()=>dateRequests.filter(request=>request.id==='bbbbbbbbbbb').length),1,'duplicate cards share a lookup');
    assert.equal(await worker.evaluate(()=>dateRequests.some(request=>request.id==='zzzzzzzzzzz')),false,'offscreen cards are not fetched');
    assert.equal(await page.locator('.channel').textContent(),'2 years ago','channel names are not publication dates');
    assert.equal(await page.locator('yt-lockup-view-model .views').textContent(),'2020','numeric view counts are not mistaken for publication years');
    assert.equal(await page.locator('#published-time-text').textContent(),'2 years ago','comment timestamps stay unchanged');
    assert.equal(await page.locator('[data-id="eeeeeeeeeee"] .date').textContent(),'1 year ago','unavailable dates are not fabricated');
    assert.equal(await page.locator('[data-id="fffffffffff"] .date').textContent(),'Live now');
    assert.equal(await page.locator('#views').textContent(),'448M views');assert.equal(await page.locator('#location').textContent(),'SAN DIEGO ZOO');
    await page.locator('#expand').click();assert.equal(await page.evaluate(()=>expanded),1,'native metadata interactions keep working');
    await page.evaluate(()=>{
      const header=document.createElement('ytd-video-description-header-renderer');header.innerHTML='<div id="factoids"><factoid-renderer><span id="likes">123 Likes</span></factoid-renderer><upload-time-factoid-renderer><factoid-renderer><div class="ytwFactoidRendererFactoid" aria-label="21 years ago"><span class="ytwFactoidRendererValue">2005</span><span class="ytwFactoidRendererLabel">Apr 23</span></div></factoid-renderer></upload-time-factoid-renderer></div>';document.querySelector('ytd-app').append(header);
    });
    await page.waitForFunction(()=>document.querySelector('.ytc-publication-value')?.textContent.startsWith('2005-04-23 ('));
    assert.equal(await page.locator('#likes').textContent(),'123 Likes','date factoids leave likes and views alone');
    assert.equal(await page.locator('upload-time-factoid-renderer .ytwFactoidRendererValue').evaluate(node=>getComputedStyle(node).display),'none','year-only factoids show the full date in one replacement label');
    await page.evaluate(()=>{
      const results=document.createElement('ytd-search');results.innerHTML='<ytd-video-renderer class="card" id="search-card"><a href="/watch?v=bbbbbbbbbbb">Search result</a><div id="metadata-line"><span class="inline-metadata-item">123 views</span><span class="inline-metadata-item date">6 years ago</span></div></ytd-video-renderer><ytd-grid-video-renderer class="card" id="channel-card"><a href="/watch?v=bbbbbbbbbbb">Channel video</a><div id="metadata-line"><span class="inline-metadata-item">123 views</span><span class="inline-metadata-item date">17 Sep 2020</span></div></ytd-grid-video-renderer>';document.querySelector('#feed').prepend(results);
    });
    await page.waitForFunction(()=>[...document.querySelectorAll('#search-card .date,#channel-card .date')].every(node=>node.textContent.startsWith('2020-09-17 (')));
    await page.locator('yt-lockup-view-model .views').evaluate(node=>node.remove());
    await page.locator('yt-lockup-view-model .date').evaluate(node=>{node.firstChild.data='6 years ago';});
    await page.waitForFunction(()=>document.querySelector('yt-lockup-view-model .date').textContent.startsWith('2020-09-17 ('));
    await page.locator('[data-id="bbbbbbbbbbb"] .date').first().evaluate(node=>{node.firstChild.data='3 years ago';});
    await page.waitForFunction(()=>document.querySelector('[data-id="bbbbbbbbbbb"] .date').textContent.startsWith('2020-09-17 ('));
    assert.equal(await worker.evaluate(()=>dateRequests.filter(request=>request.id==='bbbbbbbbbbb').length),1,'native text changes reuse the cached exact date');
    const count=await worker.evaluate(()=>dateRequests.length);
    await page.evaluate(()=>{for(let i=0;i<100;i++){const span=document.createElement('span');span.textContent=i;document.querySelector('#unrelated').append(span);}});await page.waitForTimeout(100);
    assert.equal(await worker.evaluate(()=>dateRequests.length),count,'unrelated DOM changes do not fetch dates');
    // Recycled card href/text changes must not accept a late response for its old video.
    await page.locator('[data-id="bbbbbbbbbbb"]').first().evaluate(card=>{card.querySelector('a').href='/watch?v=ccccccccccc';card.querySelector('.date').firstChild.data='7 years ago';});
    await page.waitForTimeout(70);
    await page.locator('[data-id="bbbbbbbbbbb"]').first().evaluate(card=>{card.querySelector('a').href='/watch?v=ddddddddddd';card.querySelector('.date').firstChild.data='8 years ago';});
    await page.waitForFunction(()=>document.querySelector('[data-id="bbbbbbbbbbb"] .date').textContent.startsWith('2000-02-29 ('));await page.waitForTimeout(300);
    assert.match(await page.locator('[data-id="bbbbbbbbbbb"] .date').first().textContent(),/^2000-02-29 \(/);
    // SPA metadata can briefly still belong to the previous video.
    await page.evaluate(()=>{
      const object=document.createElement('div');object.setAttribute('itemtype','http://schema.org/VideoObject');object.setAttribute('itemid','https://www.youtube.com/watch?v=aaaaaaaaaaa');
      const identifier=document.createElement('meta');identifier.setAttribute('itemprop','identifier');identifier.content='aaaaaaaaaaa';object.append(identifier,document.querySelector('meta[itemprop="datePublished"]'));document.body.prepend(object);
      document.querySelector('link[rel="canonical"]').href='https://www.youtube.com/watch?v=ddddddddddd';
      history.pushState({},'','/watch?v=ddddddddddd');document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.waitForFunction(()=>document.querySelector('#watch-date')?.textContent.startsWith('2000-02-29 ('));
    await menu.locator('#menuLanguage').selectOption('zh-CN');await page.waitForFunction(()=>document.querySelector('#watch-date').textContent.includes('年前'));
    await page.locator('[data-id="zzzzzzzzzzz"]').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-id="zzzzzzzzzzz"] .date').textContent.startsWith('2020-09-17 ('));
    const home=await context.newPage();await home.goto('https://www.youtube.com/');await home.waitForFunction(()=>document.querySelector('[data-id="bbbbbbbbbbb"] .date')?.textContent.startsWith('2020-09-17 ('));
    assert.equal(await worker.evaluate(()=>dateRequests.filter(request=>request.id==='bbbbbbbbbbb').length),1,'watch, home and other tabs share session metadata');
    await home.setViewportSize({width:360,height:850});assert.equal(await home.locator('.ytContentMetadataViewModelMetadataRow').last().evaluate(row=>getComputedStyle(row).flexWrap),'wrap','long dates can wrap on narrow cards');
    const tabId=await menu.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/'});return tab.id;});
    await menu.evaluate(async tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}}),tabId);
    await home.evaluate(html=>document.querySelector('#feed').insertAdjacentHTML('afterbegin',html),legacy('jjjjjjjjjjj'));
    await home.waitForTimeout(80);
    await home.locator('[data-id="jjjjjjjjjjj"]').evaluate(card=>card.remove());
    await home.evaluate(html=>document.querySelector('#feed').insertAdjacentHTML('afterbegin',html),legacy('kkkkkkkkkkk'));
    await home.waitForTimeout(80);assert.equal(await worker.evaluate(()=>dateRequests.some(request=>['jjjjjjjjjjj','kkkkkkkkkkk'].includes(request.id))),false,'background DOM changes do not start metadata requests');
    await menu.evaluate(async tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}}),tabId);
    await home.waitForFunction(()=>document.querySelector('[data-id="kkkkkkkkkkk"] .date')?.textContent.startsWith('2020-09-17 ('));
    assert.equal(await worker.evaluate(()=>dateRequests.some(request=>request.id==='jjjjjjjjjjj')),false,'removed background cards are never fetched on return');
    await menu.evaluate(async tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>globalThis.__ytProgressCustomizer.dispose()}),tabId);
    assert.equal(await home.locator('[data-ytc-publication-date]').count(),0,'disposal restores native date labels');
    assert.equal(await home.locator('[data-id="bbbbbbbbbbb"] .date').first().textContent(),'4 years ago');
    const shorts=await context.newPage();await shorts.goto('https://www.youtube.com/shorts/aaaaaaaaaaa');
    await shorts.evaluate(()=>{
      const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=location.href;document.head.append(canonical);
      const meta=document.createElement('meta');meta.setAttribute('itemprop','datePublished');meta.content='2005-04-23T23:59:59-07:00';document.head.append(meta);
      const header=document.createElement('ytd-video-description-header-renderer');header.innerHTML='<upload-time-factoid-renderer><div class="ytwFactoidRendererFactoid" aria-label="Apr 23, 2005"><span class="ytwFactoidRendererValue">2005</span><span class="ytwFactoidRendererLabel">Apr 23</span></div></upload-time-factoid-renderer>';document.querySelector('ytd-app').prepend(header);
    });
    await shorts.waitForFunction(()=>document.querySelector('.ytc-publication-value')?.textContent.startsWith('2005-04-23 ('));
    assert.deepEqual(errors,[]);
    console.log('PASS: watch/legacy/modern/Home/search/channel/Shorts dates, visible-only shared lookups, background deferral, unchanged comments/views, text repair, card recycling/SPA safety, language, narrow wrapping, and disposal.');
  }finally{clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
