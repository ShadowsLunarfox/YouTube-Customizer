// Preserve the classic menu while checking a real customized select picker and bilingual settings search.
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const image='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const fixture='<!doctype html><style>body{margin:0;color:white;background:#333}ytd-app,ytd-browse,ytd-rich-grid-renderer{display:block}</style><ytd-app><ytd-browse page-subtype="home"><ytd-rich-grid-renderer>Home videos</ytd-rich-grid-renderer></ytd-browse></ytd-app><div id="movie_player" class="html5-video-player"><video></video></div>';
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,locale:'en-US',viewport:{width:1200,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 const deadline=setTimeout(()=>void context.close(),90000),errors=[];
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 try{
  await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
  const control=await context.newPage();await control.goto(`chrome-extension://${id}/popup.html`);await control.waitForSelector('#settings-form:not([inert])');
  await control.evaluate(async image=>{await chrome.storage.local.set({menuLanguage:'en',backgroundImageData:image});await chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image',uiOpacity:38,audioEnabled:false,customizeCards:false});},image);
  const page=await context.newPage();await page.goto('https://www.youtube.com/');await page.waitForSelector('#ytc-background-image',{state:'attached'});
  const tab=await control.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/'});return tab});
  const menu=await context.newPage();await menu.goto(`chrome-extension://${id}/popup.html?window=1&target=${tab.id}`);await menu.waitForSelector('#settings-form:not([inert])');
  await menu.setViewportSize({width:480,height:760});
  assert.deepEqual(await menu.locator('[role=tab]').allTextContents(),['Appearance','Player','Audio','Layout','Backup']);
  assert.equal(await menu.locator('#appearance-panel > .theme-preview').count(),1,'the existing layout and preview are preserved');
  assert.equal(await menu.locator('details').count(),0,'no accordion redesign is introduced');
  assert.equal(await menu.locator('#reset').isVisible(),true);assert.equal(await menu.locator('#resetAll').isVisible(),true);
  assert.equal(await menu.evaluate(()=>Object.keys(fields).every(id=>settingsSearch.entries.some(entry=>entry.control.id===id))),true,'all saved settings are searchable');
  assert.equal(await menu.locator('#themePreset').evaluate(select=>getComputedStyle(select).appearance),'base-select');
  await menu.locator('#themePreset').click();await menu.waitForFunction(()=>document.querySelector('#themePreset').matches(':open'));
  const picker=await menu.locator('#themePreset').evaluate(select=>({
   border:getComputedStyle(select,'::picker(select)').borderRadius,
   shadow:getComputedStyle(select,'::picker(select)').boxShadow,
   arrow:getComputedStyle(select,'::picker-icon').backgroundColor,
   selected:getComputedStyle(select.selectedOptions[0]).backgroundColor,
   selectedText:getComputedStyle(select.selectedOptions[0]).color
  }));
  assert.equal(picker.border,'0px');assert.notEqual(picker.shadow,'none');assert.equal(picker.arrow,'rgb(192, 192, 192)');
  assert.equal(picker.selected,'rgb(0, 0, 128)');assert.equal(picker.selectedText,'rgb(255, 255, 255)');
  if(process.env.YTC_SCREENSHOTS)await menu.screenshot({path:path.join(os.tmpdir(),'ytc-classic-dropdown.png')});
  await menu.locator('#themePreset option[value="forest"]').hover();
  assert.equal(await menu.locator('#themePreset option[value="forest"]').evaluate(option=>getComputedStyle(option).backgroundColor),'rgb(0, 0, 128)');
  assert.equal(await menu.locator('#themePreset option[value="custom"]').evaluate(option=>getComputedStyle(option).backgroundColor),'rgb(255, 255, 255)','hover highlights only one row');
  await menu.locator('#themePreset option[value="forest"]').click();await menu.waitForFunction(()=>document.querySelector('#pageColor').value==='#13211b');
  await menu.waitForFunction(()=>!previewInFlight&&!pendingPreview&&saveTimer===undefined);
  await page.waitForFunction(()=>document.querySelector('#yt-custom-progress-style').textContent.includes('#13211b'));
  await menu.locator('#themePreset').focus();await menu.keyboard.press('Space');await menu.waitForFunction(()=>document.querySelector('#themePreset').matches(':open'));
  await menu.keyboard.press('Escape');assert.equal(await menu.locator('#themePreset').inputValue(),'forest','Escape cancels the picker without changing the setting');
  await menu.locator('#themePreset').press('Space');await menu.keyboard.press('ArrowDown');await menu.keyboard.press('Enter');
  await menu.waitForFunction(()=>document.querySelector('#themePreset').value==='classic'&&!previewInFlight&&!pendingPreview&&saveTimer===undefined);
  await page.waitForFunction(()=>document.querySelector('#yt-custom-progress-style').textContent.includes('#008080'));
  const storage=()=>menu.evaluate(async()=>JSON.stringify(await Promise.all([chrome.storage.sync.get(null),chrome.storage.local.get(null)])));
  const before=await storage();
  await page.evaluate(()=>globalThis.__searchAppearance={style:document.querySelector('#yt-custom-progress-style'),css:document.querySelector('#yt-custom-progress-style').textContent,image:document.querySelector('#ytc-background-image')});
  async function find(query,id){await menu.locator('#settingsSearch').fill(query);await menu.locator('.search-result[data-setting-id="'+id+'"]').waitFor();}
  await find('blur','uiBlur');assert.equal(await menu.locator('.search-result').first().getAttribute('data-setting-id'),'uiBlur');
  await menu.locator('#settingsSearch').press('Enter');assert.equal(await menu.locator('#uiBlur').evaluate(el=>el===document.activeElement),true);
  await find('背景','uploadBackground');await menu.locator('[data-setting-id="uploadBackground"]').click();assert.equal(await menu.locator('#uploadBackground').isVisible(),true);
  await find('平铺','backgroundFit');await menu.locator('[data-setting-id="backgroundFit"]').click();assert.equal(await menu.locator('#backgroundFit').isVisible(),true);
  await find('bass','bassGain');await menu.locator('[data-setting-id="bassGain"]').click();assert.equal(await menu.locator('#tab-audio').getAttribute('aria-selected'),'true');assert.equal(await menu.locator('#audioEnabled').evaluate(el=>el===document.activeElement),true);assert.equal(await menu.locator('#bassGain').isDisabled(),true);
  await find('音量条','audioMonitor');await menu.locator('[data-setting-id="audioMonitor"]').click();assert.equal(await menu.locator('.audio-monitor').isVisible(),true);
  await find('快捷键','configureShortcuts');await menu.locator('[data-setting-id="configureShortcuts"]').click();assert.equal(await menu.locator('#tab-player').getAttribute('aria-selected'),'true');assert.equal(await menu.locator('#configureShortcuts').isVisible(),true);
  await find('画中画','pictureInPicture');assert.equal(await menu.locator('.search-result').first().getAttribute('data-setting-id'),'pictureInPicture','the video action ranks ahead of shortcut readouts');
  await find('声音增强','audioEnabled');assert.equal(await menu.locator('.search-result').first().getAttribute('data-setting-id'),'audioEnabled');
  await find('Playables','hideHomePlayables');await menu.locator('[data-setting-id="hideHomePlayables"]').click();assert.equal(await menu.locator('#tab-layout').getAttribute('aria-selected'),'true');assert.equal(await menu.locator('#hideHomePlayables').isVisible(),true);
  await menu.locator('#settingsSearch').fill('<img src=x onerror=alert(1)>');await menu.locator('#settingsSearchEmpty').waitFor();assert.equal(await menu.locator('#settingsSearchResults img').count(),0);
  await menu.locator('#settingsSearch').press('Escape');assert.equal(await menu.locator('#settingsSearch').inputValue(),'');
  await menu.keyboard.press('Control+f');assert.equal(await menu.locator('#settingsSearch').evaluate(el=>el===document.activeElement),true);
  await find('volume','volumeBoost');await menu.locator('#settingsSearch').evaluate(input=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));assert.equal(await menu.locator('#settingsSearchResults').isVisible(),true);
  await menu.locator('#settingsSearch').press('ArrowDown');assert.equal(await menu.locator('.search-result').first().evaluate(el=>el===document.activeElement),true);await menu.keyboard.press('Escape');
  assert.equal(await storage(),before,'search never saves or enables a setting');
  assert.deepEqual(await page.evaluate(()=>({style:document.querySelector('#yt-custom-progress-style')===__searchAppearance.style,css:document.querySelector('#yt-custom-progress-style').textContent===__searchAppearance.css,image:document.querySelector('#ytc-background-image')===__searchAppearance.image})),{style:true,css:true,image:true});
  await menu.locator('#menuLanguage').selectOption('zh-CN');await menu.waitForFunction(()=>document.querySelector('#settingsSearch').placeholder==='搜索设置…');
  await find('透明','uiOpacity');await menu.waitForFunction(()=>document.querySelector('#settingsSearchCount').textContent.includes('找到'));assert.equal(await menu.locator('[data-setting-id="uiOpacity"] strong').textContent(),'界面不透明度');
  for(const width of [360,480,900]){
   await menu.setViewportSize({width,height:760});
   assert.equal(await menu.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('.search-results').scrollWidth<=document.querySelector('.search-results').clientWidth),true);
   if(process.env.YTC_SCREENSHOTS)await menu.screenshot({path:path.join(os.tmpdir(),`ytc-classic-search-${width}.png`)});
   await menu.locator('#clearSettingsSearch').click();
   for(const panel of ['appearance','player','audio','layout','backup']){await menu.locator('#tab-'+panel).click();assert.equal(await menu.evaluate(()=>document.querySelector('.tab-content').scrollWidth<=document.querySelector('.tab-content').clientWidth),true);}
   await find('透明','uiOpacity');
  }
  await menu.locator('#clearSettingsSearch').click();await menu.locator('#tab-layout').click();await menu.locator('#hideHomeSingleVideo').check();
  await menu.waitForFunction(async()=>(await chrome.storage.sync.get('hideHomeSingleVideo')).hideHomeSingleVideo===true);
  await menu.reload();await menu.waitForSelector('#settings-form:not([inert])');await find('单影片','hideHomeSingleVideo');await menu.locator('[data-setting-id="hideHomeSingleVideo"]').click();assert.equal(await menu.locator('#hideHomeSingleVideo').isChecked(),true);
  await control.reload();await control.waitForSelector('#settings-form:not([inert])');assert.ok(await control.locator('.panel').evaluate(el=>el.getBoundingClientRect().height)<=600,'search preserves the browser popup height limit');
  assert.deepEqual(errors,[]);
  console.log('PASS: classic field/picker bevels, gray arrows and navy selections; native pointer/keyboard/cancel behavior; existing layout retained; bilingual/alias/option search and focus, no search writes/theme restart, live changes/persistence, IME handling and 360/480/900px layouts.');
 }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
