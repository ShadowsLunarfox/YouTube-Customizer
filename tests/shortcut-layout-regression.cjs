// Check rendered text against real scroll clipping boundaries, not only scrollWidth.
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1040,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),90000);
  try{
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
    const page=await context.newPage();await page.goto(`chrome-extension://${id}/popup.html?window=1&panel=shortcuts`);await page.waitForFunction(()=>typeof initialized!=='undefined'&&initialized);
    assert.equal(await page.locator('#tab-shortcuts').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#shortcuts-panel #configureShortcuts').count(),1);assert.equal(await page.locator('#player-panel #configureShortcuts').count(),0);
    await page.locator('#useDefaultShortcuts').uncheck();await page.waitForFunction(async()=>(await chrome.storage.sync.get('useDefaultShortcuts')).useDefaultShortcuts===false);await page.locator('#tab-player').click();await page.locator('#reset').click();assert.equal(await page.locator('#useDefaultShortcuts').isChecked(),false,'Player reset does not change shortcut preferences');await page.locator('#tab-shortcuts').click();await page.locator('#reset').click();await page.waitForFunction(async()=>(await chrome.storage.sync.get('useDefaultShortcuts')).useDefaultShortcuts===true);
    await page.locator('#menuTheme').selectOption('dark');
    for(const language of ['en','zh-CN']){
      await page.locator('#menuLanguage').selectOption(language);
      for(const[width,height]of [[360,320],[360,640],[648,600],[1040,900]]){
        await page.setViewportSize({width,height});
        const text=page.locator('.shortcuts-group legend,.shortcut-row > span,.shortcut-value,.shortcut-source:visible,#configureShortcuts > span,.shortcuts-group .check-field > span,.shortcuts-group .field-hint');
        for(const element of await text.all()){
          await element.scrollIntoViewIfNeeded();
          const clipped=await element.evaluate(element=>{
            const range=document.createRange();range.selectNodeContents(element);const lines=[...range.getClientRects()].filter(r=>r.width&&r.height),bad=[];
            for(let p=element;p;p=p.parentElement){
              const s=getComputedStyle(p),r=p.getBoundingClientRect();
              const clipX=['auto','scroll','hidden','clip'].includes(s.overflowX),clipY=['auto','scroll','hidden','clip'].includes(s.overflowY);
              if(lines.some(line=>clipX&&(line.left<r.left-1||line.right>r.right+1)||clipY&&(line.top<r.top-1||line.bottom>r.bottom+1)))bad.push(p.id||p.className||p.tagName);
            }
            return {text:element.textContent,ancestors:bad};
          });
          assert.deepEqual(clipped.ancestors,[],JSON.stringify({language,width,height,...clipped}));
        }
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      }
    }
    await page.locator('#menuLanguage').selectOption('en');await page.setViewportSize({width:648,height:1000});await page.locator('.shortcuts-group').scrollIntoViewIfNeeded();
    await page.locator('.shortcuts-group').screenshot({path:path.join(os.tmpdir(),'ytc-shortcuts-defaults-unclipped.png')});
    console.log('PASS: all shortcut labels, keycaps, defaults, button and help text remain fully reachable without text clipping in English/Chinese at 360–1040 px and 320–900 px heights.');
  }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
