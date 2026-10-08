// Measure real media samples after boost/EQ; exercise native volume, mute, routing, and reinjection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const sandbox={};vm.runInNewContext(fs.readFileSync(path.join(root,'settings.js'),'utf8'),sandbox);
const settings=sandbox.YTCustomizer;
assert.equal(settings.defaults.audioEnabled,false);assert.equal(settings.normalize({volumeBoost:1000}).volumeBoost,500);
assert.equal(settings.normalize({bassGain:-99,midGain:Infinity,trebleGain:'8.8',audioBalance:110}).bassGain,-12);
assert.equal(settings.normalize({midGain:Infinity}).midGain,0);assert.equal(settings.normalize({trebleGain:'8.8'}).trebleGain,9);
assert.equal(settings.normalize({audioBalance:110}).audioBalance,100);assert.equal(settings.normalize({volumeBoost:'url(x)',audioEnabled:1}).volumeBoost,100);
function tone() {
  const rate=48000,samples=rate*2,bytes=Buffer.alloc(44+samples*4);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*4,40);
  for(let i=0;i<samples;i++){const value=Math.round(32767*.025*[100,1000,8000].reduce((sum,hz)=>sum+Math.sin(2*Math.PI*hz*i/rate),0));bytes.writeInt16LE(value,44+i*4);bytes.writeInt16LE(value,46+i*4);}
  return bytes;
}
const wav=tone();
const fixture=`<!doctype html><html><head><style>body{margin:20px;background:#333;color:white;font:16px Arial}.html5-video-player{width:640px;max-width:100%}video{width:320px;height:180px;background:#111}button{padding:12px;margin:8px}.ytp-play-progress{width:40%;height:4px;background:red}[hidden]{display:none!important}</style></head><body>
  <div id="movie_player" class="html5-video-player"><video loop></video><div class="ytp-play-progress"></div></div>
  <button id="start">Play</button><button id="pause">Pause</button><button id="prepare">Prepare</button>
  <div id="inline-player" class="html5-video-player"><video muted loop></video></div><video id="ytc-background-video" muted loop hidden></video>
  <script>
    window.prepareMedia=async()=>{const blob=await(await fetch('/fixture-tone.wav')).blob();window.toneUrl=URL.createObjectURL(blob);document.querySelectorAll('video').forEach(video=>video.src=window.toneUrl)};
    document.querySelector('#start').addEventListener('click',()=>document.querySelector('#movie_player video').play());
    document.querySelector('#pause').addEventListener('click',()=>document.querySelector('#movie_player video').pause());
    window.prepareMedia();
  </script></body></html>`;
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1200,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),120000);
  try {
    await context.route('https://www.youtube.com/**',route=>route.request().url().endsWith('.wav')?route.fulfill({contentType:'audio/wav',body:wav}):route.fulfill({contentType:'text/html',body:fixture}));
    await context.route('https://media.example.invalid/**',route=>route.fulfill({contentType:'audio/wav',body:wav}));
    const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));popup.on('pageerror',error=>errors.push(error.message));
    await page.goto('https://www.youtube.com/watch?v=audio-fixture');await page.waitForSelector('#yt-custom-progress-style',{state:'attached'});await page.waitForFunction(()=>document.querySelector('#movie_player video').readyState>=3);
    const state=()=>popup.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=audio-fixture'});const[{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
      const store=YTCustomizerContent.audioResources,video=document.querySelector('#movie_player video'),graph=store.graphs.get(video);
      return {context:store.context?.state||null,graphs:store.connected.size,route:graph?.route||null,gain:graph?.gain.gain.value,eq:graph?[graph.bass.gain.value,graph.mid.gain.value,graph.treble.gain.value]:null,volume:video.volume,muted:video.muted,paused:video.paused,limiter:graph?.limited,sourceCount:globalThis.__sourceCount||0,styleText:document.querySelector('#yt-custom-progress-style').textContent,preview:store.graphs.has(document.querySelector('#inline-player video')),wallpaper:store.graphs.has(document.querySelector('#ytc-background-video'))};
    }});return result;});
    const measure=()=>popup.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=audio-fixture'});const[{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:async()=>{
      const graph=YTCustomizerContent.audioResources.graphs.get(document.querySelector('#movie_player video')),context=graph.context;
      const output=graph.route==='bypass'?graph.source:graph.limited?graph.limiter:graph.gain;
      const splitter=context.createChannelSplitter(2),left=context.createAnalyser(),right=context.createAnalyser(),silent=context.createGain();left.fftSize=right.fftSize=4096;left.smoothingTimeConstant=right.smoothingTimeConstant=0;silent.gain.value=0;
      output.connect(splitter);splitter.connect(left,0);splitter.connect(right,1);left.connect(silent);right.connect(silent);silent.connect(context.destination);
      await new Promise(resolve=>setTimeout(resolve,180));
      const data=analyser=>{const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);const bins=new Float32Array(analyser.frequencyBinCount);analyser.getFloatFrequencyData(bins);return {rms:Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length),peak:samples.reduce((max,x)=>Math.max(max,Math.abs(x)),0),db:[100,1000,8000].map(hz=>{const bin=Math.round(hz*analyser.fftSize/context.sampleRate);return Math.max(...bins.slice(bin-1,bin+2))})};};
      const result={left:data(left),right:data(right)};output.disconnect(splitter);splitter.disconnect();left.disconnect();right.disconnect();silent.disconnect();return result;
    }});return result;});
    const waitRoute=async route=>{await popup.waitForFunction(async route=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=audio-fixture'});const[{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>YTCustomizerContent.audioResources.graphs.get(document.querySelector('#movie_player video'))?.route});return result===route;},route);};
    const settlePreview=async()=>{await popup.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));await popup.waitForFunction(()=>!previewInFlight&&!pendingPreview);};
    await page.locator('#start').click();assert.equal((await state()).context,null,'default off does not allocate an audio context');
    await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');await page.bringToFront();await popup.locator('#tab-audio').click();assert.equal(await popup.locator('#volumeBoost').isDisabled(),true);
    assert.deepEqual(await popup.locator('[role=tab]').allTextContents(),['Appearance','Player','Audio','Layout']);
    assert.equal(await popup.evaluate(()=>YTCustomizer.audioKeys.every(key=>document.getElementById(key).closest('[role=tabpanel]').id==='audio-panel')),true,'all audio controls live on their own page');
    await popup.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=audio-fixture'});await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
      const create=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(...args){globalThis.__sourceCount=(globalThis.__sourceCount||0)+1;return create.apply(this,args);};
    }});});
    await popup.locator('#audioEnabled').check();await popup.locator('#audioLimiter').uncheck();await waitRoute('processed');
    const native=await measure();assert.ok(native.left.rms>.01,'real player audio reaches the graph');
    const originalStyle=(await state()).styleText;
    await popup.locator('#volumeBoost').evaluate(element=>{element.value='300';element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));});
    await popup.waitForFunction(async()=> (await chrome.storage.sync.get('volumeBoost')).volumeBoost===300);
    const boosted=await measure();assert.ok(boosted.left.rms/native.left.rms>2.9&&boosted.left.rms/native.left.rms<3.1,'300% triples real sample amplitude');
    await settlePreview();
    assert.equal((await state()).styleText,originalStyle,'audio sliders do not replace visual CSS or rescan surfaces');
    await page.locator('#movie_player video').evaluate(video=>video.volume=.25);const quiet=await measure();assert.ok(quiet.left.rms/boosted.left.rms>.23&&quiet.left.rms/boosted.left.rms<.27,'native volume slider still controls output');
    await page.locator('#movie_player video').evaluate(video=>video.muted=true);assert.ok((await measure()).left.rms<.0001,'native mute remains silent');
    await page.locator('#movie_player video').evaluate(video=>{video.muted=false;video.volume=1;});
    await popup.evaluate(()=>chrome.storage.sync.set({volumeBoost:100,bassGain:9,midGain:8,trebleGain:-6}));await page.waitForTimeout(180);
    const equalized=await measure();assert.ok(equalized.left.db[0]-native.left.db[0]>7,'bass adjustment boosts measured low frequencies');assert.ok(equalized.left.db[1]-native.left.db[1]>6,'midrange adjustment boosts measured mid frequencies');assert.ok(equalized.left.db[2]-native.left.db[2]<-4,`treble adjustment reduces measured high frequencies: ${JSON.stringify({native,equalized,state:await state()})}`);
    await popup.evaluate(()=>chrome.storage.sync.set({bassGain:0,midGain:0,trebleGain:0,audioBalance:-100}));await page.waitForTimeout(120);const panned=await measure();assert.ok(panned.left.rms>.01&&panned.right.rms<.0001,'full left balance silences the right channel');
    await popup.evaluate(()=>chrome.storage.sync.set({audioBalance:0,audioLimiter:true,volumeBoost:500}));await page.waitForTimeout(120);assert.equal((await state()).limiter,true,'clipping reduction is in the output path');
    await popup.evaluate(()=>chrome.storage.sync.set({bassGain:12,midGain:12,trebleGain:12,audioLimiter:false}));await page.waitForTimeout(180);const unlimited=await measure();
    await popup.evaluate(()=>chrome.storage.sync.set({audioLimiter:true}));await page.waitForTimeout(180);const limited=await measure();assert.ok(unlimited.left.peak>1&&limited.left.peak<unlimited.left.peak*.95,'clipping reduction lowers peaks that exceed the normal output range');
    await popup.evaluate(()=>chrome.storage.sync.set({bassGain:0,midGain:0,trebleGain:0}));await page.waitForTimeout(180);
    await page.evaluate(async()=>{await document.querySelector('#inline-player video').play();await document.querySelector('#ytc-background-video').play();});assert.equal((await state()).preview,false);assert.equal((await state()).wallpaper,false);
    await popup.evaluate(()=>chrome.storage.sync.set({audioEnabled:false}));await waitRoute('bypass');const bypassed=await measure();assert.ok(Math.abs(bypassed.left.rms/native.left.rms-1)<.03,'off restores normal audio instead of closing its source context');
    assert.equal((await state()).volume,1);assert.equal((await state()).muted,false);
    await popup.evaluate(()=>chrome.storage.sync.set({audioEnabled:true,volumeBoost:200,audioLimiter:false}));await waitRoute('processed');
    await page.locator('#movie_player video').evaluate(video=>{video.currentTime=.5;});await page.locator('#pause').click();assert.equal(await page.locator('#movie_player video').evaluate(video=>video.paused),true);await page.locator('#start').click();
    await page.evaluate(()=>{history.pushState({},'', '/watch?v=audio-fixture');document.dispatchEvent(new Event('yt-navigate-finish'));});assert.equal((await state()).sourceCount,1,'repeated play and navigation reuse the same media source');
    await page.locator('#pause').click();await popup.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=audio-fixture'});await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>YTCustomizerContent.audioResources.context.suspend()});});
    await page.locator('#start').click();await waitRoute('processed');await popup.waitForFunction(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=audio-fixture'});const[{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>YTCustomizerContent.audioResources.context.state});return result==='running';});assert.ok((await measure()).left.rms>.01,'a real playback gesture resumes a suspended audio context');
    await popup.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=audio-fixture'});await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>__ytProgressCustomizer.dispose()});});await waitRoute('bypass');assert.ok((await measure()).left.rms>.01,'disposal keeps sound playing');
    await popup.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=audio-fixture'});await chrome.scripting.executeScript({target:{tabId:tab.id},files:['settings.js','content/surface-controller.js','content/shorts-controller.js','content/homepage-glass.js','content/home-shorts-grid.js','content/audio-controller.js','yt.js']});});await waitRoute('processed');assert.equal((await state()).sourceCount,1,'reinjection does not acquire a second media source');
    await page.locator('#movie_player video').evaluate(async old=>{old.pause();const video=document.createElement('video');video.loop=true;video.src=window.toneUrl;old.replaceWith(video);await video.play();});await waitRoute('processed');assert.equal((await state()).sourceCount,2,'replacement player gets its own audio graph');assert.equal((await state()).graphs,1,'removed paused players are released');
    await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');await page.bringToFront();await popup.locator('#tab-audio').click();assert.equal(await popup.locator('#audioEnabled').isChecked(),true);assert.equal(await popup.locator('#volumeBoost').inputValue(),'200');
    if(process.env.YTC_SCREENSHOTS)await popup.screenshot({path:path.join(os.tmpdir(),'ytc-audio-controls.png')});
    await popup.locator('#tab-player').focus();await popup.locator('#tab-player').press('ArrowRight');assert.equal(await popup.locator('#tab-audio').getAttribute('aria-selected'),'true');assert.equal(await popup.locator('#audio-panel').isVisible(),true);
    await popup.locator('#tab-audio').press('ArrowLeft');assert.equal(await popup.locator('#tab-player').getAttribute('aria-selected'),'true');
    await popup.locator('#reset').click();assert.equal(await popup.locator('#audioEnabled').isChecked(),true);assert.equal(await popup.locator('#volumeBoost').inputValue(),'200','Player reset preserves audio settings');
    await popup.locator('#progressColor').fill('#714ec7');await settlePreview();await popup.waitForFunction(async()=> (await chrome.storage.sync.get('progressColor')).progressColor==='#714ec7');
    await popup.locator('#tab-audio').click();await popup.locator('#reset').click();await waitRoute('bypass');assert.equal(await popup.locator('#audioEnabled').isChecked(),false);assert.equal(await popup.locator('#bassGainValue').textContent(),'0');assert.equal(await popup.locator('#progressColor').inputValue(),'#714ec7','Audio reset preserves Player settings');
    // A non-CORS stream continues through its native path; no Web Audio source is acquired.
    await page.locator('#movie_player video').evaluate(async old=>{old.pause();const video=document.createElement('video');video.loop=true;video.src='https://media.example.invalid/tone.wav';old.replaceWith(video);await video.play();});await popup.locator('#audioEnabled').check();await page.waitForFunction(()=>document.querySelector('#movie_player video').readyState>=3);
    await page.waitForTimeout(150);const unsafe=await state();assert.equal(unsafe.route,null);assert.equal(unsafe.sourceCount,2);assert.equal(unsafe.paused,false);assert.equal(unsafe.muted,false);
    assert.deepEqual(errors,[]);
    console.log('PASS: actual media boost/EQ/panning, native volume/mute/pause/seek, default off, live UI/persistence/reset, unchanged visual CSS, preview/wallpaper exclusion, bypass/disposal/reinjection, replacement video, and cross-origin fallback.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
