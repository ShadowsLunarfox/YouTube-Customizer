// Audit actual YouTube controls, a native actions menu and the player's menu.
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function audit(page,label){
  const controls=await page.evaluate(()=>[...document.querySelectorAll('button,.ytp-button,tp-yt-paper-button,tp-yt-paper-icon-button,yt-icon-button,tp-yt-paper-item,ytd-guide-entry-renderer,ytd-mini-guide-entry-renderer,ytd-menu-service-item-renderer,ytd-menu-navigation-item-renderer,ytd-compact-link-renderer,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="tab"]')]
    .filter(e=>e.checkVisibility({opacityProperty:true,visibilityProperty:true})&&e.getBoundingClientRect().width>0&&!e.querySelector('button,[role="button"],[role="menuitem"],[role="tab"],tp-yt-paper-item')&&!e.closest('ytd-thumbnail,yt-thumbnail-view-model,.ytp-progress-bar,.ytp-scrubber-button'))
    .map(e=>{const s=getComputedStyle(e);let blur=false;for(let p=e;p;p=p.parentElement)if(getComputedStyle(p).backdropFilter.includes('blur(')){blur=true;break}
      const rect=e.getBoundingClientRect();return{label:(e.getAttribute('aria-label')||e.textContent).trim().slice(0,60),tag:e.tagName,classes:e.className,color:s.color,bg:s.backgroundColor,images:[s.backgroundImage,getComputedStyle(e,'::before').backgroundImage,getComputedStyle(e,'::after').backgroundImage],blur:s.backdropFilter,radius:s.borderRadius,hasBlur:blur,onscreen:rect.y<innerHeight&&rect.bottom>0};}));
  const bad=controls.filter(c=>c.color!=='rgb(255, 255, 255)'||!c.hasBlur||parseFloat(c.radius)<=0||c.images.some(image=>/gradient\(/i.test(image)));
  assert.equal(await page.locator(':is(button,button-view-model,yt-button-view-model,segmented-like-dislike-button-view-model) :is(yt-light-shape,.contribYtLightShapeHost)').evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).display==='none')),true,label+': decorative lighting overlays are disabled');
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
  await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,customizeCards:true,textColor:'#edf1f8',surfaceColor:'#253449',uiOpacity:42,uiBlur:12}));
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=LH-EvEfpZgI',{waitUntil:'domcontentloaded',timeout:45000});await page.locator('ytd-watch-metadata').waitFor({state:'visible',timeout:25000});await page.mouse.move(600,400);
  await page.evaluate(()=>document.querySelector('#movie_player video')?.pause());
  if(process.env.YTC_INSPECT==='1')console.log(JSON.stringify(await page.evaluate(()=>({
    actions:document.querySelector('ytd-watch-metadata #actions')?.outerHTML.slice(0,24000),
    effects:[...document.querySelectorAll('ytd-watch-metadata #actions button, ytd-watch-metadata #actions yt-light-shape, ytd-watch-metadata #actions yt-light-shape *')].flatMap(el=>['','::before','::after'].map(pseudo=>{const s=getComputedStyle(el,pseudo||null);return{tag:el.localName,classes:el.className,pseudo,display:s.display,content:s.content,background:s.backgroundImage,color:s.backgroundColor,mask:s.maskImage,shadow:s.boxShadow,opacity:s.opacity};})).filter(s=>s.background!=='none'||s.mask!=='none'||s.shadow!=='none'),
    controls:[...document.querySelectorAll('.ytp-left-controls,.ytp-right-controls')].map(el=>({html:el.outerHTML.slice(0,700),display:getComputedStyle(el).display,gap:getComputedStyle(el).gap}))
  }))));
  await audit(page,'Watch page');
  await page.locator('ytd-masthead #guide-button button').click();await page.locator('ytd-guide-renderer').waitFor({state:'visible'});await audit(page,'Sidebar navigation');await page.mouse.click(1400,900);await page.locator('tp-yt-app-drawer[opened]').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'More actions',exact:true}).first().click();await page.locator('ytd-menu-popup-renderer').first().waitFor({state:'visible'});await audit(page,'Actions menu');await page.keyboard.press('Escape');
  await page.locator('ytd-masthead button[aria-label="Settings"]').click();await page.locator('ytd-multi-page-menu-renderer').waitFor({state:'visible'});await audit(page,'Header menu');await page.keyboard.press('Escape');
  await page.locator('.ytp-settings-button').click();await page.locator('.ytp-settings-menu').waitFor({state:'visible'});await audit(page,'Player settings');
  const rows=await page.locator('.ytp-settings-menu .ytp-menuitem:visible').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{top:r.top,bottom:r.bottom}}));
  for(let i=1;i<rows.length;i++)assert.ok(rows[i].top-rows[i-1].bottom>=2,'player menu rows have independent rounded backgrounds and spacing');
  await page.screenshot({path:path.join(os.tmpdir(),'ytc-white-glass-buttons.png'),animations:'disabled'});
  const playbackRate=await page.locator('#movie_player video').evaluate(video=>video.playbackRate);
  await page.locator('.ytp-settings-menu .ytp-menuitem').filter({hasText:'Playback speed'}).click();
  await page.screenshot({path:path.join(os.tmpdir(),'ytc-rounded-speed-menu.png'),animations:'disabled'});
  const options=page.locator('.ytp-settings-menu :is([role="menuitemradio"],[role="slider"],input[type="range"],button:not(.ytp-panel-back-button)):visible');
  await options.first().waitFor({state:'visible'});assert.ok(await options.count()>=2,'native speed controls remain available');
  await options.last().scrollIntoViewIfNeeded();await audit(page,'Playback speed submenu');
  assert.equal(await page.locator('#movie_player video').evaluate(video=>video.playbackRate),playbackRate,'submenu inspection never changes playback speed');
  await page.keyboard.press('Escape');
  const compound=page.locator('ytd-watch-metadata .ytSegmentedLikeDislikeButtonViewModelSegmentedButtonsWrapper button');
  const like=await compound.nth(0).boundingBox(),dislike=await compound.nth(1).boundingBox();
  assert.ok(dislike.x-like.x-like.width>=4,'native like/dislike buttons have a visible gap');
  await page.locator('ytd-watch-metadata #actions').scrollIntoViewIfNeeded();
  await page.locator('ytd-watch-metadata #actions').screenshot({path:path.join(os.tmpdir(),'ytc-separated-actions.png'),animations:'disabled'});
  console.log('PASS: current native YouTube buttons and menu rows keep white text over transparent glass, including legacy and player controls.');
 }finally{clearTimeout(deadline);await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
