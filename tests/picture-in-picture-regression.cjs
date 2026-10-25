// Use native Picture-in-Picture and real locally encoded MP4 media, not API mocks.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
function fixture(url) {
  const video='<video id="main-video" muted loop playsinline></video>';
  const player=url.pathname.startsWith('/shorts')
    ? `<ytd-shorts><ytd-reel-video-renderer is-active><div id="shorts-player" class="html5-video-player">${video}</div></ytd-reel-video-renderer></ytd-shorts>`
    : url.hostname==='music.youtube.com'
      ? `<ytmusic-app><ytmusic-player><div class="html5-video-player">${video}</div></ytmusic-player></ytmusic-app>`
      : `<ytd-app><ytd-watch-flexy><div id="movie_player" class="html5-video-player">${video}</div></ytd-watch-flexy></ytd-app>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;color:white;background:#31516b} .html5-video-player{width:640px;height:360px;margin:50px} video{width:100%;height:100%}
    #inline-player{position:fixed;inset:0;width:1200px;height:800px;pointer-events:none;z-index:-1}
    #hidden-player{display:none!important} #other-player{position:absolute;top:12000px;left:0;width:1600px;height:900px}
    .ytp-chrome-bottom{height:30px}
  </style></head><body>${player}<div id="inline-player" class="html5-video-player"><video id="hover-video" muted loop></video></div>
    <div id="hidden-player" class="html5-video-player"><video id="hidden-video" muted loop></video></div>
    <ytd-reel-video-renderer id="other-player"><video id="other-video" muted loop></video></ytd-reel-video-renderer>
  </body></html>`;
}
async function ready(page) { await page.waitForSelector('#settings-form:not([inert])'); }
async function pipState(page) {
  return page.evaluate(()=>({
    id:document.pictureInPictureElement?.id||null,
    video:[...document.querySelectorAll('video')].map(video=>({id:video.id,paused:video.paused,volume:video.volume,muted:video.muted,rate:video.playbackRate,source:video.currentSrc,time:video.currentTime}))
  }));
}
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1200,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--autoplay-policy=no-user-gesture-required']});
  const deadline=setTimeout(()=>void context.close(),90000),errors=[];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  try{
    await context.route('https://*.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(new URL(route.request().url()))}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const menu=await context.newPage();await menu.goto('chrome-extension://'+id+'/popup.html');await ready(menu);
    await menu.bringToFront();
    const clip=await menu.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
      const ctx=canvas.getContext('2d'),stream=canvas.captureStream(30),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/mp4',videoBitsPerSecond:600000});
      let running=true,frame=0;
      function draw(){ctx.fillStyle='#31516b';ctx.fillRect(0,0,640,360);ctx.fillStyle='#dfa476';ctx.fillRect((frame++*16)%640,20,140,320);if(running)requestAnimationFrame(draw)}
      draw();recorder.ondataavailable=event=>chunks.push(event.data);
      const stopped=new Promise(resolve=>recorder.onstop=resolve);recorder.start();await new Promise(resolve=>setTimeout(resolve,1000));recorder.stop();await stopped;
      running=false;stream.getTracks().forEach(track=>track.stop());
      const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/mp4'}))});
      await chrome.storage.local.set({backgroundImageData:data});await chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image'});
      return data;
    });
    const page=await context.newPage();
    const routes=['https://www.youtube.com/watch?v=pip-test','https://www.youtube.com/shorts/pip-test','https://music.youtube.com/watch?v=pip-test'];
    let standalone;
    for(const [index,url]of routes.entries()){
      await page.goto(url);await page.waitForFunction(()=>document.querySelector('#yt-custom-progress-style'));
      await page.evaluate(async clip=>{
        const main=document.querySelector('#main-video');main.src=clip;main.volume=.37;main.playbackRate=1.25;await main.play();
        for(const id of ['hover-video','hidden-video','other-video']){const video=document.getElementById(id);video.src=clip;if(id!=='other-video')await video.play()}
      },clip);
      await page.waitForFunction(()=>document.querySelector('#main-video').readyState>=2);
      const tab=await menu.evaluate(async url=>{const[tab]=await chrome.tabs.query({url});await chrome.tabs.update(tab.id,{active:true});return tab},url);
      let controls=menu;
      if(index===1){
        const pending=context.waitForEvent('page');
        await menu.evaluate(async target=>{await chrome.windows.create({url:chrome.runtime.getURL('popup.html')+'?window=1&target='+target+'&scope=shared&panel=player',type:'popup',focused:true,width:520,height:760})},tab.id);
        standalone=await pending;await ready(standalone);controls=standalone;await controls.setViewportSize({width:520,height:760});
      }else if(index===2){
        await standalone.goto('chrome-extension://'+id+'/popup.html?window=1&target='+tab.id+'&scope=music&panel=player');await ready(standalone);controls=standalone;
      }
      await controls.locator('#tab-player').click();
      const original=await pipState(page);
      await controls.locator('#pictureInPicture').click();
      await page.waitForFunction(()=>document.pictureInPictureElement?.id==='main-video');
      await controls.waitForFunction(()=>document.querySelector('#pictureInPicture').getAttribute('aria-pressed')==='true');
      const active=await pipState(page);assert.equal(active.id,'main-video','main player selected instead of wallpaper/hover/hidden/recycled videos');
      for(const video of active.video){const before=original.video.find(item=>item.id===video.id);assert.equal(video.source,before.source);assert.equal(video.volume,before.volume);assert.equal(video.muted,before.muted);assert.equal(video.rate,before.rate);}
      assert.equal(active.video.find(video=>video.id==='main-video').paused,false,'playback continues');
      const frames=await page.locator('#main-video').evaluate(video=>video.getVideoPlaybackQuality().totalVideoFrames);
      await page.waitForFunction(frames=>document.querySelector('#main-video').getVideoPlaybackQuality().totalVideoFrames>frames,frames);
      await controls.locator('#pictureInPicture').click();await page.waitForFunction(()=>!document.pictureInPictureElement);
      await controls.waitForFunction(()=>document.querySelector('#pictureInPicture').getAttribute('aria-pressed')==='false');
      // The same command supports paused videos, and native window closing is reflected on focus.
      await page.locator('#main-video').evaluate(video=>video.pause());
      const pausedTime=await page.locator('#main-video').evaluate(video=>video.currentTime);
      await controls.locator('#pictureInPicture').click();await page.waitForFunction(()=>document.pictureInPictureElement?.id==='main-video');
      assert.equal(await page.locator('#main-video').evaluate(video=>video.paused),true);
      assert.equal(await page.locator('#main-video').evaluate(video=>video.currentTime),pausedTime);
      await page.evaluate(()=>document.exitPictureInPicture());
      await controls.evaluate(()=>window.dispatchEvent(new Event('focus')));
      await controls.waitForFunction(()=>document.querySelector('#pictureInPicture').getAttribute('aria-pressed')==='false');
      if(index===1)for(const width of [520,360]){
        await controls.setViewportSize({width,height:760});
        assert.equal(await controls.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'PiP controls fit narrow menus');
        if(process.env.YTC_SCREENSHOTS)await controls.screenshot({path:path.join(os.tmpdir(),`ytc-picture-in-picture-menu-${width}.png`)});
      }
      await page.locator('#main-video').evaluate(video=>video.disablePictureInPicture=true);
      await controls.locator('#pictureInPicture').click();await controls.waitForFunction(()=>document.querySelector('#pictureInPictureStatus').textContent.includes('disabled for this video'));
      assert.equal((await pipState(page)).id,null);assert.equal(await page.locator('#main-video').evaluate(video=>video.disablePictureInPicture),true);
      await page.locator('#main-video').evaluate(video=>{video.disablePictureInPicture=false;video.removeAttribute('src');video.load()});
      await controls.locator('#pictureInPicture').click();await controls.waitForFunction(()=>document.querySelector('#pictureInPictureStatus').textContent.includes('Wait for the video picture to load'));
      assert.equal(await controls.locator('#pictureInPicture').isEnabled(),true,'failed requests can be retried');
    }
    await page.goto('https://www.youtube.com/');
    await page.locator('#main-video').evaluate(video=>video.closest('#movie_player').remove());
    await standalone.evaluate(()=>window.dispatchEvent(new Event('focus')));await ready(standalone);
    await standalone.locator('#pictureInPicture').click();await standalone.waitForFunction(()=>document.querySelector('#pictureInPictureStatus').textContent.includes('Open a YouTube video first'));
    await page.close();
    await standalone.locator('#pictureInPicture').click();await standalone.waitForFunction(()=>document.querySelector('#pictureInPictureStatus').textContent.includes('Open a YouTube video to use'));
    assert.deepEqual(errors,[]);
    console.log('PASS: native PiP enter/exit on Watch, Shorts and Music; toolbar and separate settings window; excludes wallpaper/preview/hidden/recycled players; preserves media source, volume, mute, speed and paused time; native close sync; disabled/unloaded/no-video/closed-tab feedback and retries.');
  }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
