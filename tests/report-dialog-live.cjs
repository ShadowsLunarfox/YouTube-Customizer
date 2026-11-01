// Open Report and dismiss it without selecting a reason or submitting anything.
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,locale:'en-US',viewport:{width:1440,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 const deadline=setTimeout(()=>void context.close(),90000);
 try{
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
  const admin=await context.newPage();await admin.goto(`chrome-extension://${id}/popup.html`);await admin.waitForFunction(()=>initialized);
  await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,customizeCards:true,uiOpacity:42,uiBlur:12}));
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=LH-EvEfpZgI',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('ytd-watch-metadata').waitFor({state:'visible',timeout:25000});await page.evaluate(()=>document.querySelector('#movie_player video')?.pause());
  await page.getByRole('button',{name:'More actions',exact:true}).first().click();
  const menu=page.locator('ytd-menu-popup-renderer:visible').first();await menu.waitFor();
  await menu.getByText('Report',{exact:true}).click();
  const dialog=page.locator('tp-yt-paper-dialog:visible,[role="dialog"]:visible').first();await dialog.waitFor({timeout:15000});
  const dialogHandle=await dialog.elementHandle();
  console.log('Report entry:',await dialog.innerText());
  console.log('Open structure:',JSON.stringify(await dialog.evaluate(root=>[root,...root.querySelectorAll('tp-yt-paper-dialog,[role="dialog"],iframe')].map(el=>({tag:el.localName,role:el.getAttribute('role'),style:el.getAttribute('style'),hidden:el.getAttribute('aria-hidden'),url:el.getAttribute('src')})))));
  await page.evaluate(root=>{
    const counts=new Map();globalThis.__reportProbe={count:0,dialogPaints:0,counts};
    __reportProbe.observer=new MutationObserver(records=>{for(const r of records){const el=r.target;if(!(el instanceof Element)||el.closest('.html5-video-player'))continue;__reportProbe.count++;if(r.type==='attributes'&&r.attributeName==='style'&&(el===root||root.contains(el)))__reportProbe.dialogPaints++;const key=el.localName+'#'+el.id+'.'+el.className+':'+r.attributeName;counts.set(key,(counts.get(key)||0)+1);}});
    __reportProbe.observer.observe(document.documentElement,{attributes:true,childList:true,subtree:true,attributeFilter:['style','class','hidden','aria-hidden']});
  },dialogHandle);
  const dismiss=dialog.getByRole('button',{name:/^(cancel|close|not now)$/i}).first();
  if(await dismiss.count())await dismiss.click();else await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  await page.waitForFunction(root=>!root.matches('[data-ytc-universal-glass],[data-ytc-universal-clear]')&&!root.querySelector('[data-ytc-universal-glass],[data-ytc-universal-clear]'),dialogHandle);
  const closed=await dialogHandle.evaluate(root=>({managed:root.hasAttribute('data-ytc-universal-glass'),inlineBlur:root.style.backdropFilter,blur:getComputedStyle(root).backdropFilter}));
  assert.equal(closed.managed,false,'cached native dialogs release surface ownership after dismissal');
  assert.equal(closed.inlineBlur,'','dismissal removes the plugin inline backdrop');
  assert.equal(closed.blur,'none','closed native dialogs no longer receive CSS blur');
  await page.waitForTimeout(300);await page.evaluate(()=>{__reportProbe.count=0;__reportProbe.dialogPaints=0;__reportProbe.counts.clear();});
  await page.waitForTimeout(1800);
  const settled=await page.evaluate(()=>{__reportProbe.observer.disconnect();return{count:__reportProbe.count,dialogPaints:__reportProbe.dialogPaints,top:[...__reportProbe.counts].sort((a,b)=>b[1]-a[1]).slice(0,8),dialogs:[...document.querySelectorAll('ytd-report-form-modal-renderer,tp-yt-paper-dialog')].map(el=>({tag:el.localName,hidden:el.getAttribute('aria-hidden'),style:el.getAttribute('style')}))};});
  console.log('After dismiss:',JSON.stringify(settled));
  await page.screenshot({path:path.join(os.tmpdir(),'ytc-report-dismissed.png')});
  // Recommendations and native icons can keep loading independently of the dialog.
  assert.equal(settled.dialogPaints,0,'the closed report is idle instead of repeatedly rewriting its styles');
  console.log('PASS: native Report entry dismissed without a submission; cached dialog styling is released and page mutations settle.');
 }finally{clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
