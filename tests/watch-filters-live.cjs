// Exercise the site's actual chip component on the reported watch page.
// Logged-out recommendations may omit it; in that case supply native renderer data locally.
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1600,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 const deadline=setTimeout(()=>void context.close(),90000);
 try{
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
  const admin=await context.newPage();await admin.goto(`chrome-extension://${id}/popup.html`);await admin.waitForFunction(()=>typeof initialized!=='undefined'&&initialized);
  await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,pageColor:'#47351f',surfaceColor:'#6d5026',uiOpacity:42,uiBlur:18,textColor:'#f1f1f1'}));
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=LH-EvEfpZgI',{waitUntil:'domcontentloaded'});await page.waitForSelector('ytd-watch-next-secondary-results-renderer');
  const supplied=await page.evaluate(()=>{
    if(document.querySelector('ytd-watch-next-secondary-results-renderer yt-chip-cloud-renderer'))return false;
    const bar=document.createElement('yt-chip-cloud-renderer');bar.setAttribute('data-ytc-filter-test','');document.querySelector('ytd-watch-next-secondary-results-renderer').prepend(bar);
    bar.set('data',{chips:['All','From •ᴛʙ.ᴛᴇᴅᴅʏʙᴇᴀʀ•','Japanese Music','Asian music','Related','For you','Recently uploaded','Watched'].map((text,i)=>({chipCloudChipRenderer:{text:{simpleText:text},isSelected:i===0,chipStyleType:'STYLE_DEFAULT',navigationEndpoint:{watchEndpoint:{videoId:'LH-EvEfpZgI'}}}})),horizontalScrollable:true});
    const controller=bar.polymerController||bar;
    for(const[side,label,method]of [['left','Previous','onPreviousButtonClick'],['right','Next','onNextButtonClick']]){
      const button=document.createElement('button');button.className='ytSpecButtonShapeNextHost';button.setAttribute('aria-label',label);button.textContent=side==='left'?'‹':'›';
      button.addEventListener('click',event=>{event.stopPropagation();controller[method](event)});bar.querySelector('#'+side+'-arrow-button').append(button);
    }
    return true;
  });
  const bar=page.locator('ytd-watch-next-secondary-results-renderer yt-chip-cloud-renderer').first();await bar.locator('yt-chip-cloud-chip-renderer').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('ytd-watch-next-secondary-results-renderer yt-chip-cloud-renderer')?.hasAttribute('data-ytc-universal-clear'));
  const state=await bar.evaluate(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return{width:b.width,height:b.height,radius:s.borderRadius,fill:s.backgroundColor,blur:s.backdropFilter,chips:[...e.querySelectorAll('yt-chip-cloud-chip-renderer')].map(chip=>{const r=chip.getBoundingClientRect(),c=getComputedStyle(chip),text=chip.querySelector('button')||chip;return{height:r.height,radius:c.borderRadius,blur:c.backdropFilter,color:getComputedStyle(text).color,y:r.y}})}});
  assert.equal(state.radius,'12px');assert.equal(state.fill,'rgba(0, 0, 0, 0)');assert.equal(state.blur,'none');assert.ok(state.chips.every(c=>c.height===32&&c.radius==='8px'&&c.blur==='none'&&c.color==='rgb(255, 255, 255)'));assert.ok(state.chips.every(c=>Math.abs(c.y-state.chips[0].y)<1));
  await bar.screenshot({path:path.join(os.tmpdir(),'ytc-watch-filters-native-after.png')});
  const before=await bar.locator('#chips').evaluate(e=>getComputedStyle(e).transform);await bar.locator('#right-arrow button').click();await page.waitForTimeout(250);const after=await bar.locator('#chips').evaluate(e=>getComputedStyle(e).transform);assert.notEqual(after,before,'native next-arrow behavior still moves the strip');
  await bar.locator('#left-arrow button').click();await page.waitForTimeout(250);
  await admin.evaluate(()=>chrome.storage.sync.set({hideHomeTopicBar:true}));
  await bar.waitFor({state:'hidden'});assert.equal(await bar.evaluate(e=>e.getBoundingClientRect().height),0,'hidden native filter leaves no frame or space');
  await admin.evaluate(()=>chrome.storage.sync.set({hideHomeTopicBar:false}));
  await bar.waitFor({state:'visible'});assert.equal(await bar.evaluate(e=>getComputedStyle(e).borderRadius),'12px');
  console.log('PASS: actual YouTube chip renderer, rounded/inset aligned chips, readable colors, shared single backdrop, native arrows and hide/show without reserved space. '+(supplied?'Native data supplied because logged-out recommendations omitted the filter row.':'Original filter row used.'));
 }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
