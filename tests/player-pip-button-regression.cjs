// Native PiP must be usable directly from classic and modern player controls.
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
function controls(modern){
  const right='<button class="ytp-button ytp-subtitles-button" aria-label="Subtitles">CC</button><button class="ytp-button ytp-settings-button" aria-label="Settings">⚙</button>';
  return `<div class="ytp-chrome-bottom"><div class="ytp-chrome-controls"><div class="ytp-left-controls"><button class="ytp-button ytp-play-button">▶</button><span>0:01 / 1:00</span></div><div class="ytp-right-controls">${modern?'<div class="ytp-right-controls-left">'+right+'</div>':right}</div></div></div>`;
}
function fixture(modern){return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#222;color:#fff;font:14px Arial}ytd-app,ytd-watch-flexy{display:block}
  .html5-video-player{position:relative;width:900px;height:506px;margin:30px;max-width:calc(100vw - 60px);background:#111}
  .html5-video-player video{width:100%;height:100%;object-fit:contain}.html5-video-player:fullscreen{width:100vw;height:100vh;margin:0;max-width:none}
  .ytp-chrome-bottom{position:absolute;bottom:8px;left:12px;right:12px;height:40px}
  .ytp-chrome-controls{display:flex;height:100%;justify-content:space-between;align-items:center;gap:8px}
  .ytp-left-controls{display:flex;align-items:center;flex:1;min-width:0;gap:8px}
  .ytp-right-controls{display:flex;height:100%;align-items:center;flex-shrink:0}.ytp-right-controls-left{display:flex;height:100%;align-items:center;border-radius:24px;background:#850251;border:1px solid #cd0074;padding-inline:4px}
  .ytp-button{display:inline-block;background:transparent;border:0;width:40px;height:100%;color:white;cursor:pointer;padding:0;font-size:18px;vertical-align:top}
  .ytp-button:hover{background:rgba(255,255,255,.1)}.ytp-button svg{width:100%;height:100%}
  #inline-player{width:100px;height:80px}
  #movie_player.theater{width:1080px;height:608px}
</style></head><body><ytd-app><ytd-watch-flexy><div id="movie_player" class="html5-video-player ${modern?'ytp-delhi-modern':''}"><video id="main-video" muted loop playsinline></video>${controls(modern)}</div></ytd-watch-flexy></ytd-app>
  <div id="inline-player" class="html5-video-player"><video id="preview" muted></video>${controls(modern)}</div>
  <script>document.addEventListener('click',event=>{if(event.target.closest('.ytp-subtitles-button'))document.body.dataset.cc='clicked';if(event.target.closest('.ytp-settings-button'))document.body.dataset.settings='clicked'});
  document.querySelector('#movie_player').addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter')document.body.dataset.playerKey='intercepted'});
  document.querySelector('#movie_player').addEventListener('click',event=>{if(event.target.closest('.ytc-pip-button'))document.body.dataset.playerClick='intercepted'});
  </script></body></html>`}
async function layout(page,player='#movie_player'){
  return page.locator(player).evaluate(player=>{
    const button=player.querySelector('.ytc-pip-button'),cc=player.querySelector('.ytp-subtitles-button');
    const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    return{button:box(button),cc:box(cc),host:box(button.parentElement),first:button===button.parentElement.firstElementChild,count:player.querySelectorAll('.ytc-pip-button').length,
      blur:getComputedStyle(button).backdropFilter,icon:box(button.querySelector('svg'))};
  });
}
function checkLayout(s){
  assert.equal(s.count,1);assert.equal(s.first,true,'leftmost button in the CC/settings group');
  assert.ok(s.button.right<=s.cc.x+.1,'button sits to the left of CC');
  assert.ok(s.button.x>=s.host.x&&s.button.right<=s.host.right,'button stays inside the native controls');
  assert.ok(Math.abs(s.button.y-s.cc.y)<1&&Math.abs(s.button.height-s.cc.height)<1,'matches native button height');
  assert.ok(s.button.width>=32&&s.button.height>=32,'usable click target');assert.equal(s.icon.width,24);assert.equal(s.icon.height,24);
  assert.equal(s.blur,'none','sharp player control');
}
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1200,height:800},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--autoplay-policy=no-user-gesture-required']});
  const deadline=setTimeout(()=>void context.close(),90000),errors=[];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  try{
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(route.request().url().includes('modern'))}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=button-classic');
    await page.waitForSelector('#movie_player .ytc-pip-button');
    assert.equal(context.pages().some(page=>page.url().startsWith('chrome-extension:')),false,'button appears without ever opening the menu');
    const clip=await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
      const stream=canvas.captureStream(30),ctx=canvas.getContext('2d'),chunks=[];
      const recorder=new MediaRecorder(stream,{mimeType:'video/mp4'});let running=true,frame=0;
      function draw(){ctx.fillStyle='#31516b';ctx.fillRect(0,0,640,360);ctx.fillStyle='#dfa476';ctx.fillRect((frame++*16)%640,20,140,320);if(running)requestAnimationFrame(draw)}draw();
      recorder.ondataavailable=event=>chunks.push(event.data);const stop=new Promise(resolve=>recorder.onstop=resolve);
      recorder.start();await new Promise(resolve=>setTimeout(resolve,1000));recorder.stop();await stop;running=false;stream.getTracks().forEach(track=>track.stop());
      return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/mp4'}))});
    });
    for(const modern of [false,true]){
      if(modern){await page.goto('https://www.youtube.com/watch?v=button-modern');await page.waitForSelector('#movie_player .ytc-pip-button')}
      await page.locator('#main-video').evaluate(async(video,clip)=>{video.src=clip;video.volume=.42;video.playbackRate=1.25;await video.play()},clip);
      checkLayout(await layout(page));assert.equal(await page.locator('#inline-player .ytc-pip-button').count(),0,'previews have no added button');
      const button=page.locator('#movie_player .ytc-pip-button');
      await button.click();await page.waitForFunction(()=>document.pictureInPictureElement?.id==='main-video');
      assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await button.getAttribute('aria-label'),'Exit picture-in-picture');
      assert.equal(await page.locator('#main-video').evaluate(video=>video.paused),false);
      await button.click();await page.waitForFunction(()=>!document.pictureInPictureElement);
      await button.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.pictureInPictureElement?.id==='main-video');
      await page.evaluate(()=>document.exitPictureInPicture());await page.waitForFunction(()=>document.querySelector('#movie_player .ytc-pip-button').getAttribute('aria-pressed')==='false');
      await button.focus();await page.keyboard.press('Space');await page.waitForFunction(()=>document.pictureInPictureElement?.id==='main-video');await page.evaluate(()=>document.exitPictureInPicture());
      assert.equal(await page.locator('body').getAttribute('data-player-key'),null);assert.equal(await page.locator('body').getAttribute('data-player-click'),null,'button never toggles playback through bubbling');
      for(const mode of ['normal','theater','fullscreen','narrow']){
        if(mode==='theater')await page.locator('#movie_player').evaluate(player=>player.classList.add('theater'));
        if(mode==='fullscreen')await page.locator('#movie_player').evaluate(player=>player.requestFullscreen());
        if(mode==='narrow'){await page.evaluate(()=>document.exitFullscreen());await page.locator('#movie_player').evaluate(player=>{player.classList.remove('theater');player.style.width='360px'})}
        checkLayout(await layout(page));
        if(process.env.YTC_SCREENSHOTS&&modern&&mode==='normal')await page.locator('#movie_player .ytp-right-controls').screenshot({path:path.join(os.tmpdir(),'ytc-player-pip-controls.png')});
      }
      await page.locator('#movie_player').evaluate(player=>{player.style.width='';player.querySelector('.ytp-chrome-bottom').remove()});
      await page.locator('#movie_player').evaluate((player,html)=>player.insertAdjacentHTML('beforeend',html),controls(modern));
      await page.waitForSelector('#movie_player .ytc-pip-button');checkLayout(await layout(page));
      await page.locator('#movie_player .ytc-pip-button').evaluate(button=>button.remove());await page.waitForSelector('#movie_player .ytc-pip-button');
      await page.locator('#movie_player .ytp-subtitles-button').click();await page.locator('#movie_player .ytp-settings-button').click();
      assert.equal(await page.locator('body').getAttribute('data-cc'),'clicked');assert.equal(await page.locator('body').getAttribute('data-settings'),'clicked');
      await page.locator('#main-video').evaluate(video=>video.disablePictureInPicture=true);await page.locator('#movie_player .ytc-pip-button').click();
      await page.waitForFunction(()=>!document.querySelector('#movie_player .ytc-pip-status').hidden);assert.ok((await page.locator('#movie_player .ytc-pip-status').textContent()).includes('disabled for this video'));
      await page.locator('#main-video').evaluate(video=>video.disablePictureInPicture=false);
      assert.deepEqual(await page.locator('#main-video').evaluate(video=>({volume:video.volume,muted:video.muted,rate:video.playbackRate})),{volume:.42,muted:true,rate:1.25});
    }
    // A second player's button acts on its own video, not the larger playing one.
    await page.locator('body').evaluate((body,html)=>body.insertAdjacentHTML('beforeend','<ytd-miniplayer><div id="mini" class="html5-video-player" style="width:300px;height:169px"><video id="mini-video" muted loop></video>'+html+'</div></ytd-miniplayer>'),controls(true));
    await page.waitForSelector('#mini .ytc-pip-button');await page.locator('#mini-video').evaluate(async(video,clip)=>{video.src=clip;await video.play();video.pause()},clip);
    await page.locator('#mini .ytc-pip-button').click();await page.waitForFunction(()=>document.pictureInPictureElement?.id==='mini-video');await page.evaluate(()=>document.exitPictureInPicture());
    const admin=await context.newPage();await admin.goto('chrome-extension://'+id+'/popup.html');await admin.waitForSelector('#settings-form:not([inert])');
    const tab=await admin.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=button-modern'});return tab});
    const inject=()=>admin.evaluate(async tabId=>{const manifest=chrome.runtime.getManifest();await chrome.scripting.executeScript({target:{tabId},files:manifest.content_scripts[0].js})},tab.id);
    await inject();await inject();assert.equal(await page.locator('#movie_player .ytc-pip-button').count(),1,'repeated injection never duplicates the control');
    await admin.evaluate(async tabId=>{await chrome.scripting.executeScript({target:{tabId},func:()=>globalThis.__ytProgressCustomizer.dispose()})},tab.id);
    assert.equal(await page.locator('[data-ytc-pip-owned]').count(),0,'disposal removes only owned controls/styles/status');
    assert.equal(await page.locator('#movie_player .ytp-settings-button').count(),1);
    await inject();await page.waitForSelector('#movie_player .ytc-pip-button');checkLayout(await layout(page));
    assert.deepEqual(errors,[]);
    console.log('PASS: player-only native PiP before CC in classic/modern controls, matching heights, keyboard/mouse controls, native close sync, theater/fullscreen/narrow layouts, late/replaced/deleted controls, preview exclusion, own-player targeting, unchanged native buttons/media, reinjection and disposal.');
  }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
