// Exercise bilingual menus and the registered shortcut handlers with a real MV3 worker.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root,'i18n.js'),'utf8'),sandbox);
const i18n = sandbox.YTCustomizerI18n;
assert.equal(i18n.resolveLanguage('auto','zh-TW'),'zh-CN');
assert.equal(i18n.resolveLanguage('en','zh-CN'),'en');
assert.equal(i18n.translate('constructor','zh-CN'),'constructor');
assert.equal(i18n.translate('On · Reduction 3.5 dB','zh-CN'),'开启 · 衰减 3.5 dB');
const image='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const fixture=`<!doctype html><html><head><style>
body{margin:20px;background:#333;color:white;font:14px Arial}.html5-video-player{position:relative;width:640px;height:360px;background:#111}video{width:100%;height:100%}.ytp-right-controls{height:40px}.ytp-button{width:40px;height:40px}.ytp-play-progress{height:4px;width:50%;background:red}
</style></head><body><ytd-app><ytd-watch-flexy><div id="movie_player" class="html5-video-player"><video id="main" loop muted></video><div class="ytp-play-progress"></div><div class="ytp-right-controls"><button class="ytp-button">CC</button></div></div></ytd-watch-flexy></ytd-app>
<input id="search" aria-label="Search"><textarea id="comment"></textarea><div id="editor" contenteditable="true">Comment</div><div id="shadow"></div><iframe id="chat" srcdoc="<textarea></textarea>"></iframe><div id="inline-player"><video muted></video></div></body></html>`;

(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,locale:'en-US',viewport:{width:1200,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 const deadline=setTimeout(()=>void context.close(),120000),errors=[];
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 try{
  await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
  const worker=context.serviceWorkers().find(w=>w.url().includes(id))||await context.waitForEvent('serviceworker');
  const control=await context.newPage();await control.goto(`chrome-extension://${id}/popup.html`);await control.waitForSelector('#settings-form:not([inert])');
  await control.evaluate(async image=>{await chrome.storage.local.set({menuLanguage:'en',backgroundImageData:image});await chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image',uiOpacity:35,audioEnabled:false});},image);
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=language-shortcuts');await page.waitForSelector('#ytc-background-image',{state:'attached'});
  const tab=await control.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=language-shortcuts'});return tab;});
  const menu=await context.newPage();await menu.goto(`chrome-extension://${id}/popup.html?window=1&target=${tab.id}&panel=player`);await menu.waitForSelector('#settings-form:not([inert])');
  await page.evaluate(()=>globalThis.__languageAppearance={image:document.querySelector('#ytc-background-image'),style:document.querySelector('#yt-custom-progress-style'),css:document.querySelector('#yt-custom-progress-style').textContent});
  const untranslated=await menu.evaluate(()=>{
   const allowed=new Set(['YouTube Customizer','YouTube','YouTube Music','Auto / 自动','English','px','dB','-- dBFS','0 dBFS','Ctrl+F']);
   const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),missing=new Set();
   while(walker.nextNode()){const node=walker.currentNode,text=node.data.trim();if(!node.parentElement.closest('script,style')&&/[A-Za-z]/.test(text)&&!allowed.has(text)&&!/^\d/.test(text)&&!/^(Alt|Ctrl|Shift|Command|MacCtrl)\+/.test(text)&&YTCustomizerI18n.translate(text,'zh-CN')===text)missing.add(text)}
   return [...missing];
  });
  assert.deepEqual(untranslated,[],'all menu copy has a Chinese translation');
  await menu.locator('#menuLanguage').selectOption('zh-CN');await menu.waitForFunction(()=>document.documentElement.lang==='zh-CN'&&document.querySelector('#tab-player').textContent==='播放器');
  assert.deepEqual(await menu.locator('[role=tab]').allTextContents(),['外观','播放器','声音','布局','备份']);
  assert.equal(await menu.locator('#menuLanguage').getAttribute('aria-label'),'菜单语言');
  assert.equal(await menu.locator('.theme-preview').getAttribute('aria-label'),'页面主题预览');
  await menu.locator('#tab-layout').click();assert.equal(await menu.locator('#hideHomeSingleVideo').locator('..').innerText(),'隐藏单影片推广');
  await menu.locator('#tab-audio').click();await menu.waitForFunction(()=>document.querySelector('#audioMeterState').textContent.includes('增强已关闭'));
  assert.equal(await menu.locator('#audioAppliedBalance').textContent(),'居中');
  await menu.locator('#tab-backup').click();await menu.locator('#backupFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await menu.waitForFunction(()=>document.querySelector('#status').textContent==='不支持此 YouTube Customizer 备份');
  await menu.reload();await menu.waitForSelector('#settings-form:not([inert])');await menu.waitForFunction(()=>document.documentElement.lang==='zh-CN');
  assert.equal(await menu.locator('#menuLanguage').inputValue(),'zh-CN','language persists after reopening');
  for(const width of [480,360]){
   await menu.setViewportSize({width,height:760});
   for(const panel of ['appearance','player','audio','layout','backup']){
    await menu.locator('#tab-'+panel).click();assert.equal(await menu.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.tab-content').scrollWidth<=document.querySelector('.tab-content').clientWidth),true,'Chinese tabs and fields fit narrow windows');
   }
   await menu.locator('#tab-player').click();
   if(process.env.YTC_SCREENSHOTS)await menu.screenshot({path:path.join(os.tmpdir(),`ytc-chinese-shortcuts-${width}.png`)});
  }
  await menu.locator('#menuLanguage').selectOption('en');await menu.waitForFunction(()=>document.querySelector('#tab-appearance').textContent==='Appearance');
  assert.equal(await menu.locator('#reset').textContent(),'Reset tab','switching back restores original text');
  const stable=await page.evaluate(()=>({image:document.querySelector('#ytc-background-image')===__languageAppearance.image,style:document.querySelector('#yt-custom-progress-style')===__languageAppearance.style,css:document.querySelector('#yt-custom-progress-style').textContent===__languageAppearance.css}));
  assert.deepEqual(stable,{image:true,style:true,css:true},'language choices do not reapply appearance');
  const commands=await menu.evaluate(()=>chrome.commands.getAll());
  assert.deepEqual(commands.map(c=>c.name).sort(),['_execute_action','toggle-audio-enhancement','toggle-picture-in-picture']);
  for(const[name,output]of [['_execute_action','shortcutMenu'],['toggle-picture-in-picture','shortcutPictureInPicture'],['toggle-audio-enhancement','shortcutAudio']])assert.equal(await menu.locator('#'+output).textContent(),commands.find(c=>c.name===name).shortcut||'Not assigned');
  const pending=context.waitForEvent('page');await menu.locator('#configureShortcuts').click();const shortcuts=await pending;await shortcuts.waitForURL('chrome://extensions/shortcuts');
  const audioEditor=shortcuts.locator('cr-shortcut-input[input-aria-label*="Toggle audio enhancement"]');
  await audioEditor.locator('#edit').click();await audioEditor.locator('input').press('Control+Shift+9');
  const pipEditor=shortcuts.locator('cr-shortcut-input[input-aria-label*="Toggle video picture-in-picture"]');
  await pipEditor.locator('#edit').click();await pipEditor.locator('input').press('Control+Shift+8');
  await menu.waitForFunction(async()=>{const commands=await chrome.commands.getAll();return commands.find(c=>c.name==='toggle-audio-enhancement').shortcut==='Ctrl+Shift+9'&&commands.find(c=>c.name==='toggle-picture-in-picture').shortcut==='Ctrl+Shift+8'});
  await menu.bringToFront();await menu.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await menu.waitForFunction(()=>document.querySelector('#shortcutAudio').textContent==='Ctrl+Shift+9');
  await shortcuts.bringToFront();await audioEditor.locator('#clear').click();
  await menu.bringToFront();await menu.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await menu.waitForFunction(()=>document.querySelector('#shortcutAudio').textContent==='Not assigned');
  await shortcuts.close();
  const run=command=>worker.evaluate(({command,tab})=>handleShortcutCommand(command,tab),{command,tab});
  const audio=()=>menu.evaluate(async()=>(await chrome.storage.sync.get('audioEnabled')).audioEnabled);
  await page.bringToFront();await page.locator('#movie_player').click({position:{x:10,y:10}});
  await run('toggle-audio-enhancement');assert.equal(await audio(),true);
  await run('toggle-audio-enhancement');assert.equal(await audio(),false);
  for(const selector of ['#search','#comment','#editor']){await page.locator(selector).focus();await run('toggle-audio-enhancement');assert.equal(await audio(),false,'typing does not change audio settings');}
  await page.evaluate(()=>{const root=document.querySelector('#shadow').attachShadow({mode:'open'}),input=document.createElement('input');root.append(input);input.focus()});
  await run('toggle-audio-enhancement');assert.equal(await audio(),false,'shadow-root editors are protected');
  await page.locator('#chat').evaluate(iframe=>iframe.focus());await run('toggle-audio-enhancement');assert.equal(await audio(),false,'chat iframe focus is protected');
  await worker.evaluate(tab=>handleShortcutCommand('toggle-audio-enhancement',{...tab,url:'https://example.invalid/'}),tab);assert.equal(await audio(),false,'other sites cannot change shared audio');
  await page.locator('#search').evaluate(input=>input.blur());await page.evaluate(()=>document.activeElement.blur());
  const clip=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
   const stream=canvas.captureStream(30),ctx=canvas.getContext('2d'),chunks=[];let running=true,frame=0;
   function draw(){ctx.fillStyle='#31516b';ctx.fillRect(0,0,640,360);ctx.fillStyle='#dfa476';ctx.fillRect((frame++*16)%640,20,140,320);if(running)requestAnimationFrame(draw)}draw();
   const recorder=new MediaRecorder(stream,{mimeType:'video/mp4'});recorder.ondataavailable=e=>chunks.push(e.data);const stopped=new Promise(resolve=>recorder.onstop=resolve);
   recorder.start();await new Promise(resolve=>setTimeout(resolve,1000));recorder.stop();await stopped;running=false;stream.getTracks().forEach(t=>t.stop());
   return new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/mp4'}))});
  });
  await page.locator('#main').evaluate(async(video,clip)=>{video.src=clip;await video.play()},clip);
  await run('toggle-picture-in-picture');
  const pip=await page.evaluate(()=>({active:document.pictureInPictureElement?.id,notice:document.querySelector('[data-ytc-shortcut-notice]')?.textContent}));
  assert.equal(pip.active,'main','the real worker action opens native PiP');
  await run('toggle-picture-in-picture');assert.equal(await page.evaluate(()=>document.pictureInPictureElement),null);
  await menu.locator('#menuLanguage').selectOption('zh-CN');await menu.waitForFunction(async()=>(await chrome.storage.local.get('menuLanguage')).menuLanguage==='zh-CN');
  await page.evaluate(()=>document.activeElement.blur());await run('toggle-audio-enhancement');
  assert.equal(await page.locator('[data-ytc-shortcut-notice]').textContent(),'声音增强已开启。','shortcut feedback uses the selected language');
  assert.deepEqual(errors,[]);
  console.log('PASS: complete Chinese/English menus and dynamic/errors/accessibility text, persistence, 360/480px layouts, unchanged page appearance, actual browser shortcut editing/clearing and refreshed bindings, real-worker audio/PiP actions, localized feedback, input/shadow-editor/chat guards and YouTube-only scope.');
 }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
