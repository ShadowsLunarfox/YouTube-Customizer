// Real embedded extension UI: avatar placement, authenticated source binding and modal lifecycle.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const gif='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const header=`<ytd-masthead><div id="logo">YouTube</div><div id="search">Search</div><div id="end"><div id="buttons"><button id="native-create">＋</button><button id="native-notifications">♧</button><ytd-topbar-menu-button-renderer><button id="avatar-btn" aria-label="Account">A</button></ytd-topbar-menu-button-renderer></div></div></ytd-masthead>`;
function fixture(music=false){return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#181818;color:white;font:14px Arial}ytd-app{display:block}ytd-masthead,ytmusic-nav-bar{display:flex;align-items:center;height:56px;padding:0 16px;gap:12px;background:#222}#logo{font-weight:bold;font-size:20px}#search{flex:1;min-width:0;padding:8px;background:#333}#end #buttons,#right-content{display:flex;align-items:center}#end button,ytmusic-settings-button button{width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:inherit;font:16px Arial;cursor:pointer}#avatar-btn{background:#675395!important;width:32px!important;height:32px!important}#movie_player{position:relative;width:800px;max-width:100%;aspect-ratio:16/9;margin:24px auto;background:#111}video{width:100%;height:100%}.content{height:900px;margin:16px}ytmusic-settings-button{display:flex} @media(max-width:440px){#search{display:none}#logo{flex:1}#native-create{display:none}}
</style><ytd-app>${music?'<ytmusic-nav-bar><div id="logo">YouTube Music</div><div id="search">Search</div><div id="right-content"><ytmusic-settings-button><button aria-label="Account">A</button></ytmusic-settings-button></div></ytmusic-nav-bar>':header}<div id="movie_player" class="html5-video-player"><video id="main" muted loop playsinline></video></div><div class="content">Page content</div></ytd-app><script>window.nativeClicks={};document.addEventListener('click',e=>{const b=e.target.closest('#avatar-btn,#native-notifications,#native-create');if(b)nativeClicks[b.id]=(nativeClicks[b.id]||0)+1});window.headerMarkup=${JSON.stringify(header)};</script>`}
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1280,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--autoplay-policy=no-user-gesture-required']});
 const deadline=setTimeout(()=>void context.close(),180000),errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 try{
  await context.route('https://*.youtube.com/**',r=>r.fulfill({contentType:'text/html',body:fixture(r.request().url().includes('music.youtube.com'))}));
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
  const admin=await context.newPage();await admin.goto(`chrome-extension://${id}/popup.html`);await admin.waitForFunction(()=>initialized);
  await admin.evaluate(gif=>Promise.all([chrome.storage.local.set({backgroundImageData:gif,menuLanguage:'zh-CN'}),chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image',pageColor:'#3c2818',uiOpacity:37,uiBlur:8})]),gif);
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=menu');await page.waitForSelector('ytc-settings-entry');
  const entry=page.locator('ytc-settings-entry'),button=entry.locator('button'),modal=page.locator('ytc-settings-modal'),dialog=modal.locator('dialog');
  await page.waitForFunction(()=>document.querySelector('#ytc-background-image')?.style.backgroundImage);
  await page.evaluate(()=>{window.appearance={style:document.querySelector('#yt-custom-progress-style'),css:document.querySelector('#yt-custom-progress-style').textContent,image:document.querySelector('#ytc-background-image')};window.avatar=document.querySelector('#avatar-btn')});
  assert.equal(await entry.evaluate(h=>h.nextElementSibling?.querySelector('#avatar-btn')?.id),'avatar-btn');
  const eb=await entry.boundingBox(),ab=await page.locator('#avatar-btn').boundingBox();assert.ok(eb.x+eb.width<=ab.x+1);assert.equal(eb.height,40);assert.ok(Math.abs(eb.y+20-ab.y-16)<1);
  assert.equal(await button.getAttribute('aria-label'),'YouTube Customizer 设置');
  const stored=()=>admin.evaluate(async()=>JSON.stringify(await Promise.all([chrome.storage.sync.get(null),chrome.storage.local.get(null)])));
  const initialStored=await stored();
  async function open(){await button.click();await dialog.waitFor({state:'visible'});let view;await page.waitForFunction(()=>Boolean(document.querySelector('ytc-settings-modal')?.shadowRoot.querySelector('iframe')?.src));const url=await modal.locator('iframe').getAttribute('src');for(let i=0;i<50;i++){view=page.frames().find(f=>f.url()===url);if(view)break;await page.waitForTimeout(30)}assert.ok(view,'extension settings iframe exists');await view.waitForFunction(()=>typeof initialized!=='undefined'&&initialized&&!form.inert&&!document.body.inert);return view}
  const originalPageCount=context.pages().length;
  let view=await open();assert.equal(context.pages().length,originalPageCount,'opening the menu creates no browser window/tab');
  assert.equal(await stored(),initialStored,'opening the dialog changes no saved appearance');
  assert.deepEqual(await page.evaluate(()=>({style:appearance.style===document.querySelector('#yt-custom-progress-style'),css:appearance.css===document.querySelector('#yt-custom-progress-style').textContent,image:appearance.image===document.querySelector('#ytc-background-image'),avatar:avatar===document.querySelector('#avatar-btn')})),{style:true,css:true,image:true,avatar:true});
  assert.equal(await view.locator('#closeInPage').isVisible(),true);assert.equal(await view.locator('#openWindow').isVisible(),true);
  // Verify real composited glass through the cross-origin iframe, including blur across an edge.
  // A CSS filter alone would pass even if an opaque iframe hid the page completely.
  const glassBox=await dialog.boundingBox(),probe={x:Math.floor(glassBox.x+50),y:Math.floor(glassBox.y+glassBox.height-150),width:1,height:1};
  await page.evaluate(()=>{const e=document.createElement('div');e.id='menu-glass-witness';e.style.cssText='position:fixed;inset:0;z-index:2147483000;pointer-events:none;background:rgb(20,90,210)';document.body.append(e)});
  async function sampleGlass(){const png=await page.screenshot();return admin.evaluate(async({url,x,y})=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.drawImage(img,-x,-y);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)},{url:'data:image/png;base64,'+png.toString('base64'),x:probe.x,y:probe.y})}
  const blue=await sampleGlass();await page.locator('#menu-glass-witness').evaluate(e=>e.style.background='rgb(220,70,100)');const coral=await sampleGlass();
  const delta=coral.map((v,i)=>v-blue[i]),length=delta.reduce((s,v)=>s+v*v,0);assert.ok(length>500,'page colors remain visible through the menu and iframe');
  await page.locator('#menu-glass-witness').evaluate((e,edge)=>e.style.background=`linear-gradient(90deg,rgb(20,90,210) ${edge}px,rgb(220,70,100) ${edge}px)`,probe.x+10);
  const mixed=await sampleGlass(),fraction=mixed.reduce((s,v,i)=>s+(v-blue[i])*delta[i],0)/length;
  assert.ok(fraction>.12&&fraction<.48,'the page edge is blurred behind the transparent menu: '+JSON.stringify({blue,coral,mixed,fraction}));
  await page.locator('#menu-glass-witness').evaluate(e=>e.style.background='radial-gradient(ellipse at 20% 65%,#476cc9 0,transparent 65%),radial-gradient(ellipse at 85% 25%,#e66c92 0,transparent 65%),#afc9cb');
  await page.screenshot({path:path.join(os.tmpdir(),'ytc-settings-frosted-glass.png')});await page.locator('#menu-glass-witness').evaluate(e=>e.remove());
  // Parent-page messages cannot close or command the privileged settings view.
  await page.evaluate(()=>{const f=document.querySelector('ytc-settings-modal').shadowRoot.querySelector('iframe'),token=new URL(f.src).searchParams.get('token');postMessage({type:'YT_SETTINGS_CLOSE',token},location.origin);postMessage({type:'YT_PROGRESS_LIVE_PREVIEW',settings:{uiOpacity:99}},location.origin)});
  assert.equal(await dialog.isVisible(),true);assert.equal(await stored(),initialStored);
  // A second iframe cannot reuse the legitimate frame's ticket.
  const clonedURL=await modal.locator('iframe').getAttribute('src');
  await page.evaluate(url=>{const f=document.createElement('iframe');f.id='untrusted-menu';f.src=url;document.body.append(f)},clonedURL);
  await page.waitForTimeout(100);const clone=page.frames().filter(f=>f.url()===clonedURL).find(f=>f!==view);assert.ok(clone);await clone.waitForFunction(()=>document.querySelector('#status').textContent.includes('无法加载')||document.querySelector('#status').textContent.includes('Could not load'),null,{polling:100});
  assert.equal(await clone.evaluate(()=>document.body.inert),true);await page.locator('#untrusted-menu').evaluate(f=>f.remove());
  // Search remains usable; one Escape clears search and the next closes the modal.
  await view.locator('#settingsSearch').fill('透明');await view.locator('[data-setting-id="uiOpacity"]').waitFor();await view.locator('#settingsSearch').press('Escape');assert.equal(await dialog.isVisible(),true);assert.equal(await view.locator('#settingsSearch').inputValue(),'');
  await view.locator('#settingsSearch').press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await button.evaluate(b=>b===b.getRootNode().activeElement),true);
  view=await open();await view.locator('#uiOpacity').evaluate(el=>{el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}))});await view.locator('#closeInPage').click();await dialog.waitFor({state:'hidden'});
  assert.equal(await admin.evaluate(async()=>(await chrome.storage.sync.get('uiOpacity')).uiOpacity),42,'closing flushes pending slider edits');
  view=await open();assert.equal(await view.locator('#uiOpacity').inputValue(),'42');
  // A busy upload/import cannot be discarded by an outside click.
  await view.evaluate(()=>{form.inert=true});await page.mouse.click(2,2);await page.waitForTimeout(80);assert.equal(await dialog.isVisible(),true);await view.evaluate(()=>{form.inert=false});await page.mouse.click(2,2);await dialog.waitFor({state:'hidden'});
  // The iframe always targets its owner, even while another tab becomes active.
  view=await open();const own=await view.evaluate(()=>getPreviewTab());
  const other=await context.newPage();await other.goto('https://www.youtube.com/');assert.equal(await view.evaluate(async()=>(await getPreviewTab()).id),own.id);await other.close();await page.bringToFront();
  assert.equal(await view.evaluate(async()=>{await checkCurrentTabConnection();return applicationError}), '', 'the embedded view has an authenticated live-preview connection');
  // Menu theme is independent of page settings and stays consistent across the host and iframe.
  await page.evaluate(()=>{window.menuThemeAppearance={style:document.querySelector('#yt-custom-progress-style'),css:document.querySelector('#yt-custom-progress-style').textContent,image:document.querySelector('#ytc-background-image')}});
  await page.emulateMedia({colorScheme:'dark'});await view.waitForFunction(()=>document.documentElement.dataset.menuTheme==='dark');await page.waitForFunction(()=>document.querySelector('ytc-settings-modal').shadowRoot.querySelector('dialog').dataset.menuTheme==='dark');
  assert.equal(await view.locator('#menuTheme').inputValue(),'auto','the default follows the system');
  await view.locator('#menuTheme').selectOption('light');await view.waitForFunction(()=>document.documentElement.dataset.menuTheme==='light');await page.waitForFunction(()=>document.querySelector('ytc-settings-modal').shadowRoot.querySelector('dialog').dataset.menuTheme==='light');
  await page.emulateMedia({colorScheme:'light'});await page.emulateMedia({colorScheme:'dark'});assert.equal(await view.locator('html').getAttribute('data-menu-theme'),'light','an explicit choice overrides system changes');
  await view.locator('#menuTheme').selectOption('auto');await view.waitForFunction(()=>document.documentElement.dataset.menuTheme==='dark');await page.emulateMedia({colorScheme:'light'});await view.waitForFunction(()=>document.documentElement.dataset.menuTheme==='light');
  await view.locator('#menuTheme').selectOption('dark');await view.waitForFunction(()=>document.documentElement.dataset.menuTheme==='dark');await admin.waitForFunction(()=>document.documentElement.dataset.menuTheme==='dark');
  assert.equal(await view.locator('html').evaluate(e=>getComputedStyle(e).color),'rgb(233, 237, 245)');
  for(const panel of ['appearance','player','records','shortcuts','audio','layout','backup']){
    await view.locator('#tab-'+panel).click();
    assert.equal(await view.locator('fieldset:visible').evaluateAll(nodes=>nodes.every(e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(e).boxShadow==='none')),true,'groups do not add overlapping glass layers');
  }
  for(const selector of ['.panel','.title-bar','.scope-controls','.tabs'])assert.equal(await view.locator(selector).evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  await view.locator('#tab-audio').click();
  await page.evaluate(()=>{const e=document.createElement('div');e.id='menu-glass-stress';e.style.cssText='position:fixed;inset:0;z-index:2147483000;pointer-events:none;background:repeating-conic-gradient(#c00080 0 25%,#9db4c7 0 50%) 0/320px 240px';document.body.append(e)});
  await page.screenshot({path:path.join(os.tmpdir(),'ytc-settings-dark-single-glass.png')});
  await view.locator('#menuTheme').selectOption('light');await page.waitForFunction(()=>document.querySelector('ytc-settings-modal').shadowRoot.querySelector('dialog').dataset.menuTheme==='light');await page.screenshot({path:path.join(os.tmpdir(),'ytc-settings-light-single-glass.png')});
  assert.equal(await view.locator('#reset').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)','theme switches do not retain dark button layers');
  assert.equal(await view.locator('#tab-audio').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 240, 243)','the selected category updates without a lingering previous highlight');
  await view.locator('#menuTheme').selectOption('dark');await page.waitForFunction(()=>document.querySelector('ytc-settings-modal').shadowRoot.querySelector('dialog').dataset.menuTheme==='dark');await page.locator('#menu-glass-stress').evaluate(e=>e.remove());
  await view.locator('#settingsSearch').fill('菜单主题');await view.locator('[data-setting-id="menuTheme"]').click();assert.equal(await view.locator('#menuTheme').evaluate(e=>e===document.activeElement),true);
  assert.deepEqual(await page.evaluate(()=>({style:menuThemeAppearance.style===document.querySelector('#yt-custom-progress-style'),css:menuThemeAppearance.css===document.querySelector('#yt-custom-progress-style').textContent,image:menuThemeAppearance.image===document.querySelector('#ytc-background-image')})),{style:true,css:true,image:true},'menu theme changes do not restart page effects');
  await view.locator('#closeInPage').click();await dialog.waitFor({state:'hidden'});view=await open();assert.equal(await view.locator('#menuTheme').inputValue(),'dark');assert.equal(await dialog.getAttribute('data-menu-theme'),'dark','reopening restores the persisted dark surface');
  // Real video/PiP and native upload/download dialogs still work inside the iframe.
  const clip=await page.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=320;c.height=180;const stream=c.captureStream(24),ctx=c.getContext('2d'),chunks=[];let running=true;
    function draw(){ctx.fillStyle='#316a85';ctx.fillRect(0,0,320,180);if(running)requestAnimationFrame(draw)}draw();
    const r=new MediaRecorder(stream,{mimeType:'video/mp4'}),stopped=new Promise(resolve=>r.onstop=resolve);r.ondataavailable=e=>chunks.push(e.data);r.start();await new Promise(resolve=>setTimeout(resolve,1000));r.stop();await stopped;running=false;stream.getTracks().forEach(t=>t.stop());
    return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/mp4'}))});
  });
  await page.locator('#main').evaluate(async(v,src)=>{v.src=src;await v.play()},clip);
  await view.locator('#tab-player').click();await view.locator('#pictureInPicture').click();await page.waitForFunction(()=>document.pictureInPictureElement?.id==='main');await view.locator('#pictureInPicture').click();await page.waitForFunction(()=>!document.pictureInPictureElement);assert.equal(await page.locator('#main').evaluate(v=>v.paused),false);
  await view.locator('#tab-appearance').click();const chooser=page.waitForEvent('filechooser');await view.locator('#uploadBackground').click();await(await chooser).setFiles({name:'wallpaper.gif',mimeType:'image/gif',buffer:Buffer.from(gif.split(',')[1],'base64')});await view.waitForFunction(()=>!form.inert&&!document.querySelector('#uploadBackground').disabled);
  await view.locator('#tab-backup').click();const download=page.waitForEvent('download');await view.locator('#exportSettings').click();assert.match((await download).suggestedFilename(),/\.json$/);
  const responsiveSizes=[];
  await view.locator('#tab-appearance').click();
  for(const [width,height] of [[360,640],[507,700],[768,1024],[1280,900],[1920,1080],[900,360],[360,320]]){
    await page.setViewportSize({width,height});
    const b=await dialog.boundingBox();
    const elements=await view.evaluate(()=>{
      const style=selector=>getComputedStyle(document.querySelector(selector));
      return {font:parseFloat(style('#appearance-panel .check-field').fontSize),button:parseFloat(style('#reset').minHeight),checkbox:parseFloat(style('#themeEnabled').width),icon:parseFloat(style('.app-icon').width),select:parseFloat(style('#themePreset').height),spacing:parseFloat(style('#appearance-panel .field-list').gap),preview:parseFloat(style('.theme-preview').height),thumb:parseFloat(getComputedStyle(document.querySelector('#uiOpacity'),'::-webkit-slider-thumb').height)};
    });
    responsiveSizes.push({width,height,dialog:b,elements});
    assert.ok(b.x>=11&&b.x+b.width<=width-11&&b.y>=11&&b.y+b.height<=height-11,JSON.stringify(b));
    assert.ok(Math.abs(b.x-(width-b.width)/2)<1&&Math.abs(b.y-(height-b.height)/2)<1,'dialog stays centered');
    assert.equal(await view.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await view.locator('#uiOpacity').inputValue(),'42','resizing preserves settings in the current frame');
    assert.equal(await modal.locator('iframe').getAttribute('src'),view.url(),'resizing does not reload the menu');
    assert.equal(await view.locator('#closeInPage').isVisible(),true);
    if(height<480){await view.locator('#closePopup').scrollIntoViewIfNeeded();const close=await view.locator('#closePopup').boundingBox();assert.ok(close.y>=0&&close.y+close.height<=b.height,'footer controls remain reachable in short windows');await view.locator('#tab-appearance').scrollIntoViewIfNeeded()}
    if(width===507||width===1280||width===1920)await page.screenshot({path:path.join(os.tmpdir(),`ytc-in-page-responsive-${width}.png`)});
  }
  assert.ok(responsiveSizes[3].dialog.width>responsiveSizes[1].dialog.width*1.7,'desktop menu grows with available width');
  assert.ok(responsiveSizes[4].dialog.height>responsiveSizes[0].dialog.height*1.5,'menu height grows with the viewport');
  for(const key of Object.keys(responsiveSizes[0].elements))assert.ok(responsiveSizes[3].elements[key]>responsiveSizes[0].elements[key]*1.4,`${key} grows together with the dialog: ${JSON.stringify(responsiveSizes.map(s=>s.elements))}`);
  assert.ok(responsiveSizes[0].elements.font>=13,'small windows retain readable text');
  await view.locator('#closeInPage').click();await dialog.waitFor({state:'hidden'});await page.setViewportSize({width:1280,height:900});
  // Native header actions remain usable and SPA header replacement restores exactly one entry.
  await page.locator('#avatar-btn').click();await page.locator('#native-notifications').click();assert.deepEqual(await page.evaluate(()=>nativeClicks),{'avatar-btn':1,'native-notifications':1});
  await page.locator('ytd-masthead').evaluate(h=>{h.outerHTML=headerMarkup});await page.waitForFunction(()=>document.querySelector('ytc-settings-entry')?.nextElementSibling?.querySelector('#avatar-btn'));
  assert.equal(await entry.count(),1);await entry.evaluate(h=>h.remove());await entry.waitFor();assert.equal(await entry.count(),1);
  // The old browser action routes into the same page dialog, including clean close.
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(tab=>openPageSettings(tab),own);await dialog.waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('ytc-settings-modal').shadowRoot.querySelector('#loading').hidden);
  await worker.evaluate(tab=>openPageSettings(tab),own);await dialog.waitFor({state:'hidden'});
  // Detached-window action still preserves the active settings panel and closes the iframe.
  view=await open();await view.locator('#tab-records').click();const created=context.waitForEvent('page');await view.locator('#openWindow').click();const detached=await created;await detached.waitForFunction(()=>typeof initialized!=='undefined'&&initialized);await dialog.waitFor({state:'hidden'});assert.equal(await detached.locator('#tab-records').getAttribute('aria-selected'),'true');assert.equal(new URL(detached.url()).searchParams.get('panel'),'records');assert.equal(await detached.locator('html').getAttribute('data-menu-theme'),'dark');await detached.close();
  // Music's account button uses the same placement.
  const music=await context.newPage();await music.goto('https://music.youtube.com/watch?v=menu');await music.waitForSelector('ytc-settings-entry');assert.equal(await music.locator('ytc-settings-entry').evaluate(h=>h.nextElementSibling.tagName),'YTMUSIC-SETTINGS-BUTTON');
  assert.deepEqual(errors,[]);
  console.log('PASS: avatar entry, authenticated complete settings, pixel-verified single glass surface, system/light/dark themes with persistence and host/iframe/window sync, immediate highlight updates, no theme restart, search/Escape/pending saves, owner-tab binding, responsive 360–1920px and short windows, native header/SPA repair, detached-window handoff and Music placement.');
 }finally{clearTimeout(deadline);await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
