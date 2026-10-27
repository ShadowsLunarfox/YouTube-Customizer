const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const sandbox=vm.createContext({URL,crypto:require('node:crypto').webcrypto});
vm.runInContext(fs.readFileSync(path.join(root,'content/video-bookmarks.js'),'utf8'),sandbox);
const api=sandbox.YTCustomizerVideoBookmarks;
assert.equal(api.videoId('https://www.youtube.com/watch?v=test-1'),'test-1');
assert.equal(api.videoId('https://youtube.com.evil.invalid/watch?v=test'),'');
assert.equal(api.videoId('https://www.youtube.com/redirect?v=test'),'');
assert.equal(api.format(59.999),'1:00');assert.equal(api.parse('1:03:25.12'),3805.12);
assert.ok(Number.isNaN(api.parse('1:75')));
assert.throws(()=>api.mutate({},'save',{time:NaN,note:'bad'}),/valid/);
assert.throws(()=>api.mutate({},'save',{time:-1,note:'bad'}),/valid/);
assert.throws(()=>api.mutate({},'save',{time:1,note:'x'.repeat(1001)}),/1000/);
const valid=api.mutate({},'save',{time:0,note:''});assert.equal(valid.points.length,1,'a bare timestamp is a valid bookmark');
assert.equal(api.normalize({points:[...valid.points,...valid.points,{id:'bad',time:Infinity,note:''}]}).points.length,1);
const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#292119;color:white;font:14px Arial}ytd-app,ytd-watch-flexy,ytd-watch-metadata{display:block}#primary{width:900px;max-width:calc(100% - 32px);margin:16px auto}#movie_player{position:relative;width:100%;aspect-ratio:16/9;background:#111;overflow:hidden}#movie_player:fullscreen{width:100vw;height:100vh}#main{width:100%;height:100%;object-fit:contain}.ytp-chrome-bottom{position:absolute;bottom:0;left:0;right:0;height:50px}.autohide .ytp-chrome-bottom{opacity:0;pointer-events:none}.ytp-progress-bar-container{position:absolute;bottom:12px;left:12px;right:12px;height:18px;background:#6668}.ytp-progress-bar{height:4px;background:#888;position:absolute;top:7px;width:100%}.ytp-play-progress{width:100%;height:4px;background:#d35;transform-origin:left}#top-row{display:flex;align-items:center;justify-content:space-between}#actions{display:flex;gap:6px}#actions button{height:36px;border:0;border-radius:20px;padding:0 12px;color:inherit;background:#8884}#description{height:130px;background:#8882;margin-top:12px}#inline-player{width:80px;height:45px}#inline-player video{width:100%;height:100%}</style>
<ytd-app><ytd-watch-flexy><div id="primary"><div id="movie_player" class="html5-video-player"><video id="main" muted loop playsinline></video><div class="ytp-chrome-bottom"><div class="ytp-progress-bar-container"><div class="ytp-progress-bar"><div class="ytp-play-progress"></div></div></div></div></div><ytd-watch-metadata><h1>Tutorial</h1><div id="top-row"><span>Practice channel</span><div id="actions"><button id="like">Like</button><button id="share">Share</button><button id="native-save">Save</button></div></div><div id="description">Description</div></ytd-watch-metadata></div></ytd-watch-flexy></ytd-app><div id="inline-player"><video id="preview" muted loop></video></div><script>window.nativeClicks=0;window.playerClicks=0;window.playerKeys=0;document.querySelector('#like').onclick=()=>nativeClicks++;document.querySelector('#movie_player').addEventListener('click',()=>playerClicks++);document.querySelector('#movie_player').addEventListener('keydown',()=>playerKeys++);document.querySelector('.ytp-progress-bar-container').addEventListener('click',()=>{document.body.dataset.nativeSeek='yes'});const v=document.querySelector('#main');v.addEventListener('timeupdate',()=>{document.querySelector('.ytp-play-progress').style.transform='scaleX('+(v.currentTime/v.duration||0)+')'});</script>`;
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1200,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--autoplay-policy=no-user-gesture-required']});
 const deadline=setTimeout(()=>void context.close(),150000),errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 try{
  await context.route('https://www.youtube.com/**',r=>r.fulfill({contentType:'text/html',body:html}));
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
  const admin=await context.newPage();await admin.goto(`chrome-extension://${id}/popup.html`);await admin.waitForFunction(()=>typeof initialized!=='undefined'&&initialized);await admin.evaluate(()=>chrome.storage.local.set({menuLanguage:'zh-CN'}));
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=lesson');
  await page.waitForSelector('ytc-bookmark-markers');
  const clip=await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=320;c.height=180;const ctx=c.getContext('2d'),stream=c.captureStream(24),parts=[];let alive=true,i=0;
   function draw(){ctx.fillStyle='#43698b';ctx.fillRect(0,0,320,180);ctx.fillStyle='#efc075';ctx.fillRect(i++%240,20,80,140);if(alive)requestAnimationFrame(draw)}draw();
   const r=new MediaRecorder(stream,{mimeType:'video/mp4'}),done=new Promise(resolve=>r.onstop=resolve);r.ondataavailable=e=>parts.push(e.data);r.start();await new Promise(resolve=>setTimeout(resolve,2400));r.stop();await done;alive=false;stream.getTracks().forEach(t=>t.stop());
   return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(parts,{type:'video/mp4'}))});
  });
  async function media(p){await p.locator('#main').evaluate(async(v,src)=>{v.src=src;v.volume=.42;v.playbackRate=1.25;await v.play();v.pause();v.currentTime=.5},clip)}
  await media(page);
  const ui=page.locator('ytc-video-bookmarks'),ticks=page.locator('ytc-bookmark-markers');
  const store=()=>admin.evaluate(()=>chrome.storage.local.get('videoBookmarks:lesson'));
  const pinCount=(p,n)=>p.waitForFunction(n=>document.querySelector('ytc-bookmark-markers').shadowRoot.querySelectorAll('.pin').length===n,n);
  async function add(p,time,note){const h=p.locator('ytc-video-bookmarks');await h.locator('#bookmark-time').fill(time);await h.locator('#bookmark-note').fill(note);await h.locator('#bookmark-save').click();await p.waitForFunction(()=>!document.querySelector('ytc-video-bookmarks').shadowRoot.querySelector('#bookmark-save').disabled)}
  const newNote=p=>p.locator('ytc-bookmark-markers #bookmark-add').click();
  const close=p=>p.locator('ytc-video-bookmarks #bookmark-close').click();
  // Direct timeline selection creates a draft at that fraction without changing playback.
  const rail=ticks.locator('#bookmark-rail'),box=await rail.boundingBox();await rail.click({position:{x:box.width*.5,y:5}});
  assert.equal(await ui.evaluate(h=>h.parentElement.id),'movie_player','the note is inside the video, not below it');
  assert.equal(await ui.locator('[data-text="Timeline note"]').textContent(),'时间点小纸条');
  const selected=api.parse(await ui.locator('#bookmark-time').inputValue()),duration=await page.locator('#main').evaluate(v=>v.duration);
  assert.ok(Math.abs(selected-duration*.5)<.02);assert.ok(Math.abs(await page.locator('#main').evaluate(v=>v.currentTime)-.5)<.01);
  await add(page,'0:01.20','<img src=x onerror=alert(1)> turn left\nSecond line');await pinCount(page,1);assert.equal(await ui.locator('img').count(),0);
  await ui.locator('#bookmark-note').press('Enter');assert.equal(await page.evaluate(()=>playerKeys),0,'typing in a sticky note does not trigger player shortcuts');
  await add(page,'0:01.20','<img src=x onerror=alert(1)> turn left\nSecond line');assert.equal((await store())['videoBookmarks:lesson'].points.length,1,'saving an open note twice edits rather than duplicates');
  await close(page);await ticks.locator('.pin').click();assert.ok((await ui.locator('#bookmark-note').inputValue()).includes('\nSecond line'));
  assert.ok(Math.abs(await page.locator('#main').evaluate(v=>v.currentTime)-.5)<.01,'opening a pin reads its note without seeking');
  await ui.locator('[data-action="seek"]').click();assert.ok(Math.abs(await page.locator('#main').evaluate(v=>v.currentTime)-1.2)<.01);
  assert.equal(await page.locator('body').getAttribute('data-native-seek'),null,'note interactions do not trigger native scrubbing');assert.equal(await page.evaluate(()=>playerClicks),0,'note clicks do not toggle playback');
  await add(page,'0:00.80','Footwork\nTurn left');assert.equal((await store())['videoBookmarks:lesson'].points.length,1);
  await page.screenshot({path:path.join(os.tmpdir(),'ytc-timeline-note-desktop.png')});
  // Notes remain visible and editable when YouTube auto-hides its controls.
  await page.locator('#movie_player').evaluate(p=>p.classList.add('autohide'));await ui.locator('#bookmark-note').fill('Footwork\nTurn left');assert.equal(await ui.isVisible(),true);await page.locator('#movie_player').evaluate(p=>p.classList.remove('autohide'));
  await close(page);await page.locator('#main').evaluate(v=>{v.currentTime=.65});await newNote(page);assert.equal(await ui.locator('#bookmark-time').inputValue(),'0:00.65');
  await add(page,'0:00.20','');await pinCount(page,2);await close(page);await newNote(page);
  await add(page,'99:00','bad');assert.equal(await ui.locator('#bookmark-status').getAttribute('class'),'error');assert.equal((await store())['videoBookmarks:lesson'].points.length,2);
  // Ads hide/disable the rail and notes; even submitting a hidden form is rejected.
  await page.locator('#movie_player').evaluate(p=>p.classList.add('ad-showing'));await ui.waitFor({state:'hidden'});await pinCount(page,0);
  await ui.locator('#bookmark-time').evaluate(e=>{e.value='0:00.10'});await ui.locator('#bookmark-form').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>document.querySelector('ytc-video-bookmarks').shadowRoot.querySelector('#bookmark-status').textContent.includes('广告'));
  assert.equal((await store())['videoBookmarks:lesson'].points.length,2);await page.locator('#movie_player').evaluate(p=>p.classList.remove('ad-showing'));await pinCount(page,2);
  await page.reload();await media(page);await pinCount(page,2);await ticks.locator('.pin').nth(1).click();assert.equal(await ui.locator('#bookmark-note').inputValue(),'Footwork\nTurn left','multiline notes survive reload');await close(page);
  assert.deepEqual(await page.locator('#main').evaluate(v=>({volume:v.volume,muted:v.muted,rate:v.playbackRate,src:v.src})),{volume:.42,muted:true,rate:1.25,src:clip});
  // Simultaneous tabs append through the worker without replacing one another's records.
  const second=await context.newPage();await second.goto('https://www.youtube.com/watch?v=lesson');await media(second);await newNote(second);await newNote(page);
  await ui.locator('#bookmark-time').fill('0:00.30');await ui.locator('#bookmark-note').fill('First tab');await second.locator('ytc-video-bookmarks #bookmark-time').fill('0:00.40');await second.locator('ytc-video-bookmarks #bookmark-note').fill('Second tab');
  await Promise.all([ui.locator('#bookmark-form').evaluate(f=>f.requestSubmit()),second.locator('ytc-video-bookmarks #bookmark-form').evaluate(f=>f.requestSubmit())]);
  await admin.waitForFunction(async()=>((await chrome.storage.local.get('videoBookmarks:lesson'))['videoBookmarks:lesson'].points.length===4));await pinCount(page,4);await close(page);
  await admin.evaluate(()=>chrome.runtime.sendMessage({type:'YT_VIDEO_BOOKMARK_WRITE',videoId:'lesson',action:'save',payload:{time:0,note:'untrusted'}}).catch(()=>null));
  await page.evaluate(()=>postMessage({type:'YT_VIDEO_BOOKMARK_WRITE',videoId:'lesson',action:'delete',payload:{id:'fake'}},location.origin));assert.equal((await store())['videoBookmarks:lesson'].points.length,4);
  await page.bringToFront();
  // Stable playback performs no watch-page rescans while the timeline animates.
  await page.locator('#main').evaluate(v=>v.play());await page.waitForTimeout(100);
  const tabId=await admin.evaluate(async()=>{const t=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=lesson'});return t[0].id});
  await admin.evaluate(async tabId=>{await chrome.scripting.executeScript({target:{tabId},func:()=>{globalThis.bookmarkQueries=0;const q=Document.prototype.querySelector;Document.prototype.querySelector=function(s,...a){if(s.includes('ytd-watch-flexy'))bookmarkQueries++;return q.call(this,s,...a)}}})},tabId);
  await page.waitForTimeout(550);assert.equal(await admin.evaluate(async tabId=>(await chrome.scripting.executeScript({target:{tabId},func:()=>bookmarkQueries}))[0].result,tabId),0);assert.equal(await page.locator('#main').evaluate(v=>v.paused),false);await page.locator('#main').evaluate(v=>v.pause());
  // Per-video isolation during SPA navigation clears old drafts and reuses existing local data.
  await newNote(page);await ui.locator('#bookmark-note').fill('old video draft');await page.evaluate(()=>{history.pushState({},'','/watch?v=other');document.dispatchEvent(new Event('yt-navigate-finish'))});await pinCount(page,0);assert.equal(await ui.locator('#bookmark-note').inputValue(),'');assert.equal(await ui.isVisible(),false);
  await newNote(page);await add(page,'0:00.10','Other video');await pinCount(page,1);
  await page.evaluate(()=>{history.pushState({},'','/watch?v=lesson');document.dispatchEvent(new Event('yt-navigate-finish'))});await pinCount(page,4);
  async function fits(){const r=await ui.boundingBox(),p=await page.locator('#movie_player').boundingBox();assert.ok(r.x>=p.x&&r.y>=p.y&&r.x+r.width<=p.x+p.width+1&&r.y+r.height<=p.y+p.height+1,JSON.stringify({r,p}));assert.equal(await ui.locator('.panel').evaluate(e=>e.scrollWidth<=e.clientWidth),true)}
  // A sticky note fits the video at narrow, theater and actual fullscreen sizes.
  await page.setViewportSize({width:360,height:780});await ticks.locator('.pin').first().click();await fits();await page.screenshot({path:path.join(os.tmpdir(),'ytc-timeline-note-360.png')});
  await ui.locator('#bookmark-save').click();await close(page);await page.setViewportSize({width:1200,height:900});await page.locator('#primary').evaluate(e=>e.style.width='1100px');await ticks.locator('.pin').first().click();await fits();
  await page.locator('#movie_player').evaluate(e=>e.requestFullscreen());await page.waitForFunction(()=>Boolean(document.fullscreenElement));await page.waitForTimeout(100);await fits();assert.equal(await ui.evaluate(e=>document.fullscreenElement.contains(e)),true);await ui.locator('#bookmark-note').fill('Fullscreen note');await ui.locator('#bookmark-save').click();await close(page);await page.evaluate(()=>document.exitFullscreen());
  // Keyboard access opens the current-time editor, Escape closes it without escaping to the player.
  await rail.focus();await rail.press('Enter');await ui.locator('#bookmark-note').press('Escape');assert.equal(await ui.isVisible(),false);
  await page.evaluate(()=>{globalThis.originalBookmarkStyle=document.querySelector('#yt-custom-progress-style');globalThis.originalBookmarkCss=originalBookmarkStyle.textContent});
  await admin.evaluate(()=>chrome.storage.sync.set({showVideoBookmarks:false}));await ui.waitFor({state:'detached'});assert.equal(await ticks.count(),0);assert.equal((await store())['videoBookmarks:lesson'].points.length,4);
  await admin.evaluate(()=>chrome.storage.sync.set({showVideoBookmarks:true}));await ticks.waitFor();assert.equal(await page.evaluate(()=>originalBookmarkStyle===document.querySelector('#yt-custom-progress-style')&&originalBookmarkCss===originalBookmarkStyle.textContent),true);
  await ticks.locator('.pin').first().click();await ui.locator('[data-action="delete"]').click();await pinCount(page,3);await page.locator('#like').click();assert.equal(await page.evaluate(()=>nativeClicks),1);
  // Native scrubbing remains available and removing/replacing the track repairs our controls.
  await page.locator('.ytp-progress-bar').click({position:{x:10,y:2}});assert.equal(await page.locator('body').getAttribute('data-native-seek'),'yes');
  await ticks.evaluate(h=>h.remove());await ticks.waitFor();await pinCount(page,3);
  await page.locator('.ytp-progress-bar-container').evaluate(e=>{const clone=e.cloneNode(true);clone.querySelector('ytc-bookmark-markers')?.remove();e.replaceWith(clone)});await ticks.waitFor();await pinCount(page,3);assert.equal(await ui.count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: direct timeline pinning and multiline sticky-note read/edit/delete, explicit seeking, reload/SPA persistence, concurrent tabs, native player isolation, ad guards, keyboard access, autohide, narrow/theater/fullscreen layout, no playback rescans and theme stability.');
 }finally{clearTimeout(deadline);await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
