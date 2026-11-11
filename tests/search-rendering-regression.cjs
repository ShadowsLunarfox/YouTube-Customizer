// Search hydration and preview clocks must not repeatedly rediscover/repaint dates.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=`<!doctype html><style>body{margin:0;font:14px Arial}ytd-app,ytd-search,ytd-video-renderer,ytd-thumbnail,ytd-browse{display:block}[hidden]{display:none!important}header{height:55px}ytd-video-renderer{height:90px}.ytp-time-current{display:inline-block}</style>
<ytd-app><header><form id="search-form"><input id="query" name="search_query" aria-label="Search"><button id="submit-search">Search</button></form><button id="microphone">Microphone</button><button id="heartbeat">Check response</button></header><ytd-browse id="home" page-subtype="home">Home</ytd-browse><div id="mount"></div><ytd-popup-container><tp-yt-paper-dialog id="voice" role="dialog" aria-hidden="true" hidden><ytd-voice-search-dialog-renderer><input id="transcript" aria-label="Recognized speech"><button id="voice-submit">Use recognized speech</button></ytd-voice-search-dialog-renderer></tp-yt-paper-dialog></ytd-popup-container></ytd-app><script>
window.searchCycles=0;
function search(){searchCycles++;history.pushState({},'','/results?search_query='+encodeURIComponent(document.querySelector('#query').value));document.querySelector('#home').hidden=true;document.querySelector('#mount').replaceChildren();const results=document.createElement('ytd-search');document.querySelector('#mount').append(results);
for(let i=0;i<12;i++){const card=document.createElement('ytd-video-renderer');results.append(card);const a=document.createElement('a');a.href='/watch?v='+String(searchCycles).padStart(5,'0')+String(i).padStart(6,'0');a.innerHTML='<span class="heading">Result</span>';card.append(a);const line=document.createElement('div');line.id='metadata-line';card.append(line);const views=document.createElement('span');views.className='inline-metadata-item views';views.textContent='123 views';line.append(views);const date=document.createElement('span');date.className='inline-metadata-item date';date.textContent='6 years ago';line.append(date);const thumbnail=document.createElement('ytd-thumbnail');card.append(thumbnail);const clock=document.createElement('span');clock.className='ytp-time-current';clock.textContent='0:00';thumbnail.append(clock);for(let j=0;j<12;j++){const badge=document.createElement('span');badge.innerHTML='<span><span>Native badge</span></span>';thumbnail.append(badge);}}
document.dispatchEvent(new Event('yt-navigate-finish'));document.dispatchEvent(new Event('yt-page-data-updated'));}
document.querySelector('#search-form').onsubmit=event=>{event.preventDefault();search()};
document.querySelector('#microphone').onclick=()=>{voice.hidden=false;voice.removeAttribute('aria-hidden')};
document.querySelector('#voice-submit').onclick=()=>{document.querySelector('#query').value=document.querySelector('#transcript').value;voice.hidden=true;voice.setAttribute('aria-hidden','true');document.querySelector('#search-form').requestSubmit()};
document.querySelector('#heartbeat').onclick=event=>requestAnimationFrame(()=>window.responseMs=performance.now()-event.timeStamp);
</script>`;
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1280,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),90000),errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  try{
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');await worker.evaluate(()=>{globalThis.dateRequests=0;globalThis.fetch=async url=>{dateRequests++;return new Response('<meta itemprop="datePublished" content="2020-02-03">');};});
    const menu=await context.newPage();await menu.goto('chrome-extension://'+id+'/popup.html');await menu.waitForSelector('#settings-form:not([inert])');await menu.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,uiOpacity:30,uiBlur:12}));
    const page=await context.newPage();await page.goto('https://www.youtube.com/');await page.waitForSelector('#yt-custom-progress-style',{state:'attached'});
    const tabId=await menu.evaluate(async()=>(await chrome.tabs.query({url:'https://www.youtube.com/'}))[0].id);
    await menu.evaluate(async tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>{
      globalThis.searchWork={discovery:0,watch:0,dateScans:0,paints:0,frames:0};
      const frame=requestAnimationFrame;globalThis.requestAnimationFrame=callback=>{if(callback.name==='flush')searchWork.frames++;return frame(callback);};
      const elementQuery=Element.prototype.querySelectorAll;Element.prototype.querySelectorAll=function(selector,...args){if(selector.includes('ytd-playlist-video-renderer,yt-lockup-view-model'))searchWork.discovery++;if(selector.startsWith('#metadata-line .inline-metadata-item'))searchWork.dateScans++;return elementQuery.call(this,selector,...args);};
      const documentQuery=document.querySelectorAll;document.querySelectorAll=function(selector,...args){if(selector==='ytd-watch-metadata,ytd-video-primary-info-renderer,ytd-video-description-header-renderer'||selector==='#microformat,[itemtype*="VideoObject"]')searchWork.watch++;return documentQuery.call(this,selector,...args);};
      const set=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,...args){if(this.hasAttribute('data-ytc-publication-date'))searchWork.paints++;return set.call(this,name,...args);};
    }}),tabId);
    const read=()=>menu.evaluate(async tabId=>(await chrome.scripting.executeScript({target:{tabId},func:()=>({...searchWork})}))[0].result,tabId);
    const reset=()=>menu.evaluate(async tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>{searchWork.discovery=searchWork.watch=searchWork.dateScans=searchWork.paints=searchWork.frames=0;}}),tabId);
    const samples=[];
    for(const method of ['text','voice']){
      await reset();
      if(method==='text'){await page.locator('#query').fill('space');await page.locator('#submit-search').click();}
      else{await page.locator('#microphone').click();await page.locator('#transcript').fill('recognized nebula');await page.locator('#voice-submit').click();}
      await page.waitForFunction(()=>document.querySelector('ytd-search [data-ytc-publication-date]'));
      await page.waitForTimeout(250);const hydration=await read();await reset();
      for(let tick=0;tick<16;tick++){
        await page.evaluate(tick=>{for(const card of document.querySelectorAll('ytd-search ytd-video-renderer')){const clock=document.createElement('span');clock.textContent='0:'+String(tick).padStart(2,'0');card.querySelector('.ytp-time-current').replaceChildren(clock);card.querySelector('.views').firstChild.data=(123+tick)+' views';card.querySelector('.heading').firstChild.data='Result '+tick;}},tick);
        await page.waitForTimeout(22);
      }
      await page.waitForTimeout(100);const unrelated=await read();await reset();await page.waitForTimeout(250);const idle=await read();
      await page.locator('#heartbeat').click();await page.waitForFunction(()=>window.responseMs!==undefined);assert.ok(await page.evaluate(()=>responseMs<250));
      assert.match(await page.locator('ytd-search .date').first().textContent(),/^2020-02-03 \(/);
      if(method==='voice')assert.equal(await page.locator('#voice').getAttribute('aria-hidden'),'true');
      samples.push({method,hydration,unrelated,idle});
      assert.ok(hydration.discovery<=30,method+': nested search hydration is discovered once per outer subtree');
      assert.equal(hydration.watch,0,method+': search navigation does not scan for watch-page metadata');
      assert.equal(unrelated.dateScans,0,method+': preview clocks, counters and headings do not rescan dates');
      assert.equal(unrelated.discovery,0);assert.equal(unrelated.paints,0);
      assert.equal(unrelated.frames,0,method+': native preview replacements do not schedule empty date-render frames');
      assert.ok(Object.values(idle).every(value=>value===0),method+': settled results stay idle');
      await page.locator('ytd-search .date').first().evaluate(node=>{const replacement=document.createElement('span');replacement.className=node.className;replacement.textContent='7 years ago';node.replaceWith(replacement);});
      await page.waitForFunction(()=>document.querySelector('ytd-search .date')?.textContent.startsWith('2020-02-03 ('));
    }
    console.log('Search rendering work:',JSON.stringify(samples));
    assert.deepEqual(errors,[]);
    console.log('PASS: typed and recognized-voice submission, exact dates, native counters/previews and responsive controls.');
  }finally{clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
