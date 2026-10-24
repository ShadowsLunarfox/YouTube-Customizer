// Exercise real extension windows, their retained settings, and live tab targets.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = '<!doctype html><html><body><ytd-app><ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="contents"><ytd-rich-item-renderer><h3>Video</h3></ytd-rich-item-renderer></div></ytd-rich-grid-renderer></ytd-browse></ytd-app></body></html>';
async function ready(page) { await page.waitForSelector('#settings-form:not([inert])'); }
async function edit(page, id, value, commit = true) {
  await page.evaluate(({id,value,commit}) => {
    const el=document.getElementById(id);
    if(el.type==='checkbox')el.checked=value;else el.value=value;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    if(commit)el.dispatchEvent(new Event('change',{bubbles:true}));
  }, {id,value,commit});
}
async function button(page, id) { await page.evaluate(id=>document.getElementById(id).click(),id); }
async function openFrom(context, menu) {
  const pending = context.waitForEvent('page');
  await button(menu,'openWindow');
  const page=await pending;
  await page.waitForURL(/popup\.html\?window=1/);await ready(page);
  return page;
}
async function menuIn(context, controller, windowId, extensionId) {
  const pending=context.waitForEvent('page');
  await controller.evaluate(({windowId,extensionId})=>chrome.tabs.create({windowId,active:false,url:'chrome-extension://'+extensionId+'/popup.html'}),{windowId,extensionId});
  const page=await pending;await ready(page);return page;
}
async function checkSize(page,width,height) {
  await page.setViewportSize({width,height});
  const size=await page.evaluate(()=>({
    page:document.documentElement.scrollWidth,viewport:innerWidth,panel:document.querySelector('.panel').getBoundingClientRect().height,
    viewportHeight:innerHeight,content:document.querySelector('.tab-content').getBoundingClientRect().height,
    overflowing:[...document.querySelectorAll('.field,.tabs,.actions')].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+1).map(el=>el.className)
  }));
  assert.equal(size.page,size.viewport);assert.equal(size.panel,size.viewportHeight);assert.ok(size.content>120);assert.deepEqual(size.overflowing,[]);
}
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1280,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),90000),errors=[];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  try{
    await context.route('https://*.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    let menu=await context.newPage();await menu.goto('chrome-extension://'+id+'/popup.html');await ready(menu);
    const home=await context.newPage();await home.goto('https://www.youtube.com/');
    await home.waitForFunction(()=>document.querySelector('#yt-custom-progress-style'));
    const original=await menu.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/'});await chrome.tabs.update(tab.id,{active:true});return tab});
    await menu.locator('#editingScope').selectOption('home');await ready(menu);
    await edit(menu,'themeEnabled',true);
    await button(menu,'tab-layout');await edit(menu,'customizeCards',true);await edit(menu,'cardRadius',23,false);
    let detached=await openFrom(context,menu);
    if(!menu.isClosed())await menu.waitForEvent('close');
    assert.equal(await detached.locator('#editingScope').inputValue(),'home');
    assert.equal(await detached.locator('#tab-layout').getAttribute('aria-selected'),'true');
    assert.equal(await detached.locator('#cardRadius').inputValue(),'23','unsaved slider survives detaching');
    assert.equal(await detached.locator('#openWindow').isHidden(),true);
    assert.equal(await detached.locator('html').getAttribute('data-settings-window'),'');
    const info=await detached.evaluate(()=>chrome.windows.getCurrent());assert.equal(info.type,'popup');
    assert.equal(new URL(detached.url()).searchParams.get('target'),String(original.id));
    for(const[width,height]of [[520,760],[900,900],[360,640]]){
      await checkSize(detached,width,height);
      for(const tab of ['appearance','player','audio','layout','backup']){
        await button(detached,'tab-'+tab);await checkSize(detached,width,height);
      }
      if(process.env.YTC_SCREENSHOTS)await detached.screenshot({path:path.join(os.tmpdir(),`ytc-settings-window-${width}.png`)});
    }
    await detached.evaluate(async()=>{const win=await chrome.windows.getCurrent();await chrome.windows.update(win.id,{focused:true})});
    await button(detached,'tab-appearance');await edit(detached,'pageColor','#154473');
    await home.waitForFunction(()=>document.querySelector('#yt-custom-progress-style').textContent.includes('#154473'));
    await detached.waitForFunction(()=>!document.querySelector('#status').classList.contains('error'));
    await home.reload();await home.waitForFunction(()=>document.querySelector('#yt-custom-progress-style').textContent.includes('#154473'));
    await edit(detached,'pageColor','#215634');await home.waitForFunction(()=>document.querySelector('#yt-custom-progress-style').textContent.includes('#215634'));

    // A second toolbar menu can edit settings while the independent one stays open.
    menu=await menuIn(context,detached,original.windowId,id);
    await menu.locator('#editingScope').selectOption('shared');await ready(menu);
    await edit(menu,'progressColor','#aa3377');
    await menu.waitForFunction(async()=>(await chrome.storage.sync.get('progressColor')).progressColor==='#aa3377');
    await detached.evaluate(()=>window.dispatchEvent(new Event('focus')));await ready(detached);
    assert.equal(await detached.locator('#progressColor').inputValue(),'#aa3377','returning window reloads saved values');
    await edit(detached,'accentColor','#334455');
    assert.equal(await detached.evaluate(async()=>(await chrome.storage.sync.get('progressColor')).progressColor),'#aa3377','next edit preserves other menu changes');

    const musicPending=context.waitForEvent('page');
    const musicTab=await detached.evaluate(windowId=>chrome.tabs.create({windowId,active:true,url:'https://music.youtube.com/'}),original.windowId);
    const music=await musicPending;await music.waitForURL('https://music.youtube.com/');
    await music.waitForFunction(()=>document.querySelector('#yt-custom-progress-style'));
    await menu.locator('#editingScope').selectOption('music');await ready(menu);await button(menu,'tab-audio');
    await button(menu,'openWindow');
    await detached.waitForFunction(()=>document.querySelector('#editingScope').value==='music'&&document.querySelector('#tab-audio').getAttribute('aria-selected')==='true');
    assert.equal((await detached.evaluate(()=>chrome.windows.getCurrent())).id,info.id,'existing settings window is reused');
    assert.equal(await detached.evaluate(()=>chrome.extension.getViews({type:'tab'}).filter(view=>new URLSearchParams(view.location.search).get('window')==='1').length),1);
    assert.equal(new URL(detached.url()).searchParams.get('target'),String(musicTab.id),'reused window previews the new source tab');
    await button(detached,'tab-appearance');await edit(detached,'pageColor','#764321');
    await music.waitForFunction(()=>document.querySelector('#yt-custom-progress-style').textContent.includes('#764321'));
    assert.ok(await home.locator('#yt-custom-progress-style').evaluate(el=>el.textContent.includes('#215634')),'home override remains intact');

    // Busy file operations keep their window and report why it cannot be reused yet.
    menu=await menuIn(context,detached,original.windowId,id);
    await detached.evaluate(()=>document.querySelector('#settings-form').inert=true);
    await button(menu,'openWindow');await menu.waitForFunction(()=>document.querySelector('#status').textContent.includes('Finish the current operation'));
    assert.equal(detached.isClosed(),false);await detached.evaluate(()=>document.querySelector('#settings-form').inert=false);
    await button(menu,'openWindow');await detached.waitForFunction(()=>document.querySelector('#tab-appearance').getAttribute('aria-selected')==='true');
    menu=await menuIn(context,detached,original.windowId,id);
    await button(detached,'closePopup');if(!detached.isClosed())await detached.waitForEvent('close');
    assert.equal(home.isClosed(),false);assert.equal(music.isClosed(),false);
    detached=await openFrom(context,menu);
    assert.notEqual((await detached.evaluate(()=>chrome.windows.getCurrent())).id,info.id,'closed window can be opened again');

    // All settings remain available even with no YouTube tab to preview.
    menu=await menuIn(context,detached,original.windowId,id);
    await detached.evaluate(async()=>{const win=await chrome.windows.getCurrent();await chrome.windows.remove(win.id)});
    await home.close();await music.close();
    detached=await openFrom(context,menu);
    await detached.waitForFunction(()=>document.querySelector('#status').textContent==='Open YouTube to preview');
    assert.equal(await detached.locator('#settings-form').getAttribute('inert'),null);
    await button(detached,'tab-layout');await edit(detached,'hideHomePlayables',true);
    await detached.waitForFunction(async()=>(await chrome.storage.sync.get('hideHomePlayables')).hideHomePlayables===true);
    assert.deepEqual(errors,[]);
    console.log('PASS: complete resizable settings window, preserved tab/scope/pending edits, live preview with own window focused, navigation, shared changes across menus, existing-window reuse and retargeting, busy-operation protection, close/reopen, 360/520/900px layouts, and editing without YouTube.');
  }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
