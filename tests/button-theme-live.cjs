// Audit actual YouTube controls, a native actions menu and the player's menu.
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function audit(page,label){
  const controls=await page.evaluate(()=>[...document.querySelectorAll('button,.ytp-button,tp-yt-paper-button,tp-yt-paper-icon-button,yt-icon-button,tp-yt-paper-item,ytd-guide-entry-renderer,ytd-mini-guide-entry-renderer,ytd-menu-service-item-renderer,ytd-menu-navigation-item-renderer,ytd-compact-link-renderer,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="tab"]')]
    .filter(e=>e.checkVisibility({opacityProperty:true,visibilityProperty:true})&&e.getBoundingClientRect().width>0&&!e.querySelector('button,[role="button"],[role="menuitem"],[role="tab"],tp-yt-paper-item')&&!e.closest('ytd-thumbnail,yt-thumbnail-view-model,.ytp-progress-bar,.ytp-scrubber-button'))
    .map(e=>{const s=getComputedStyle(e);let blur=false;for(let p=e;p;p=p.parentElement)if(getComputedStyle(p).backdropFilter.includes('blur(')){blur=true;break}
      const rect=e.getBoundingClientRect();return{label:(e.getAttribute('aria-label')||e.textContent).trim().slice(0,60),tag:e.tagName,classes:e.className,color:s.color,bg:s.backgroundColor,blur:s.backdropFilter,hasBlur:blur,onscreen:rect.y<innerHeight&&rect.bottom>0};}));
  const bad=controls.filter(c=>c.color!=='rgb(255, 255, 255)'||!c.hasBlur);
  assert.deepEqual(bad,[],label+': all native controls have white text and their own/shared blur');
  assert.ok(controls.length>5,label+': actual controls inspected');
  console.log(label+': '+controls.length+' native controls passed');
}
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1600,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 const deadline=setTimeout(()=>void context.close(),100000);
 try{
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
  const admin=await context.newPage();await admin.goto(`chrome-extension://${id}/popup.html`);await admin.waitForFunction(()=>initialized);
  await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,textColor:'#112233',surfaceColor:'#253449',uiOpacity:42,uiBlur:12}));
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=LH-EvEfpZgI',{waitUntil:'domcontentloaded',timeout:45000});await page.locator('ytd-watch-metadata').waitFor({state:'visible',timeout:25000});await page.mouse.move(600,400);
  await audit(page,'Watch page');
  await page.locator('ytd-masthead #guide-button button').click();await page.locator('ytd-guide-renderer').waitFor({state:'visible'});await audit(page,'Sidebar navigation');await page.mouse.click(1400,900);await page.locator('tp-yt-app-drawer[opened]').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'More actions',exact:true}).first().click();await page.locator('ytd-menu-popup-renderer').first().waitFor({state:'visible'});await audit(page,'Actions menu');await page.keyboard.press('Escape');
  await page.locator('ytd-masthead button[aria-label="Settings"]').click();await page.locator('ytd-multi-page-menu-renderer').waitFor({state:'visible'});await audit(page,'Header menu');await page.keyboard.press('Escape');
  await page.locator('.ytp-settings-button').click();await page.locator('.ytp-settings-menu').waitFor({state:'visible'});await audit(page,'Player settings');
  await page.screenshot({path:path.join(os.tmpdir(),'ytc-white-glass-buttons.png')});
  console.log('PASS: current native YouTube buttons and menu rows keep white text over transparent glass, including legacy and player controls.');
 }finally{clearTimeout(deadline);await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
