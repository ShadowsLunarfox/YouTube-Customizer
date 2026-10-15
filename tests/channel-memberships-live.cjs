// Optional live check of the real channel memberships shopfront and its native controls.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const scope = 'ytd-browse[page-subtype="channel-memberships-shopfront"]';

(async () => {
  const context = await chromium.launchPersistentContext('', {
    channel:'chrome',headless:true,viewport:{width:1600,height:1100},
    ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']
  });
  const deadline=setTimeout(()=>void context.close(),90000);
  try {
    const cdp=await context.browser().newBrowserCDPSession();
    const {id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
    const popup=await context.newPage();
    await popup.goto('chrome-extension://'+id+'/popup.html');
    await popup.waitForSelector('#settings-form:not([inert])');
    await popup.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
      const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,1200,900);
      gradient.addColorStop(0,'#314a5a');gradient.addColorStop(.5,'#72563a');gradient.addColorStop(1,'#244f50');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,900);
      await chrome.storage.local.set({backgroundImageData:canvas.toDataURL()});
      await chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image',backgroundOpacity:100,
        surfaceColor:'#212121',textColor:'#f5f5f5',accentColor:'#65cec4',uiOpacity:45,uiBlur:12});
    });
    const page=await context.newPage();
    page.on('pageerror',error=>console.log('Page error: '+error.message));
    await page.goto('https://www.youtube.com/channel_memberships',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector(scope+' .ytLockupViewModelHost',{state:'attached',timeout:15000}).catch(async error=>{
      console.log('Page state: '+JSON.stringify(await page.evaluate(()=>({url:location.href,text:document.body.innerText.slice(0,1200),browse:[...document.querySelectorAll('ytd-browse')].map(e=>e.getAttribute('page-subtype'))}))));
      await page.screenshot({path:path.join(os.tmpdir(),'ytc-channel-memberships-failed.png')});throw error;
    });
    await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-custom-background'));
    await page.waitForTimeout(800);
    const info=()=>page.locator(scope).evaluate(root=>{
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const css=e=>{const c=getComputedStyle(e);return {background:c.backgroundColor,blur:c.backdropFilter,radius:c.borderRadius,padding:c.padding,display:c.display,color:c.color};};
      const hero=root.querySelector('yt-sponsorships-destination-hub-header-view-model');
      return {overflow:document.documentElement.scrollWidth>innerWidth,hero:{...css(hero),...box(hero)},
        chips:[...root.querySelectorAll('chip-shape button')].map(e=>({...box(e),selected:e.getAttribute('aria-selected')})),
        cards:[...root.querySelectorAll('.ytLockupViewModelHost')].map(e=>({
          ...box(e),...css(e),blocked:e.hasAttribute('data-ytc-ambient-blocked'),
          wrapperDisplay:getComputedStyle(e.parentElement).display,
          art:box(e.querySelector('.ytLockupViewModelContentImage')),
          text:box(e.querySelector('yt-lockup-metadata-view-model')),
          creator:e.classList.contains('ytLockupViewModelMetadataOnThumbnail')
        }))};
    });
    let state=await info();
    if(process.env.YTC_MEMBERSHIPS_DEBUG)console.log('Video track: '+JSON.stringify(await page.locator(scope+' ytd-shelf-renderer').first().evaluate(root=>
      [...root.querySelectorAll('#items,#scroll-container,#scroll-outer-container'),...root.querySelectorAll('#items > yt-lockup-view-model')].slice(0,6).map(e=>{
        const c=getComputedStyle(e);return {tag:e.localName,id:e.id,height:c.height,display:c.display,align:c.alignItems,self:c.alignSelf,inline:e.getAttribute('style')};
      }))));
    console.log('Layout: '+JSON.stringify({hero:state.hero,overflow:state.overflow,video:state.cards.find(card=>!card.creator),creator:state.cards.find(card=>card.creator)}));
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-channel-memberships-dark.png')});
    assert.equal(state.overflow,false);
    assert.equal(state.hero.radius,'20px');assert.equal(state.hero.blur,'blur(12px)');
    assert.ok(state.cards.length>10);
    for(const card of state.cards){
      assert.equal(card.radius,'16px');assert.equal(card.blur,'blur(12px)');assert.equal(card.blocked,false,'cinematic creator artwork is content');
      assert.ok(card.art.x>=card.x+9&&card.art.right<=card.right-9,'art stays within the card: '+JSON.stringify(card));
      assert.ok(card.text.x>=card.x&&card.text.right<=card.right+1,'metadata stays inside its card');
      if(card.creator)assert.ok(card.text.y>=card.art.bottom,'creator names/prices sit below their art');
    }
    for(const kind of [true,false]){
      const row=state.cards.filter(card=>card.creator===kind);
      const firstY=row[0].y;
      assert.ok(row.filter(card=>Math.abs(card.y-firstY)<1).every(card=>Math.abs(card.height-row[0].height)<1),'cards in the same row have equal heights');
      if(kind)row.forEach(card=>assert.ok(Math.abs(card.art.width/card.art.height-4/3)<.02,'creator art keeps the new compact ratio'));
    }
    assert.ok(new Set(state.chips.map(chip=>Math.round(chip.y))).size>1,'topics wrap into visible rows');
    assert.ok(state.chips.every(chip=>chip.x>=0&&chip.right<=1600),'all topic labels fit the viewport');
    const videoShelf=page.locator(scope+' ytd-shelf-renderer').first();
    const video=videoShelf.locator('.ytLockupViewModelHost').first();
    const originalX=await video.evaluate(e=>e.getBoundingClientRect().x);
    await videoShelf.locator('#right-arrow button').click();
    await page.waitForFunction(({scope,x})=>document.querySelector(scope+' ytd-shelf-renderer .ytLockupViewModelHost').getBoundingClientRect().x<x-20,{scope,x:originalX});
    const creatorShelf=page.locator(scope+' horizontal-shelf-view-model').first();
    const track=creatorShelf.locator('.ytwHorizontalShelfViewModelItems');
    const originalTransform=await track.evaluate(e=>e.style.transform);
    await creatorShelf.locator('.ytwHorizontalShelfViewModelRightArrow button').click();
    await page.waitForFunction(({scope,transform})=>document.querySelector(scope+' .ytwHorizontalShelfViewModelItems').style.transform!==transform,{scope,transform:originalTransform});
    async function checkCarouselEnd(shelf,next,clipSelector){
      for(let step=0;step<10&&await next.isVisible();step++){
        if(await next.getAttribute('aria-disabled')==='true')break;
        await next.click();await page.waitForTimeout(300);
      }
      const bounds=await shelf.evaluate((root,selector)=>{
        const last=[...root.querySelectorAll('.ytLockupViewModelHost')].at(-1).getBoundingClientRect();
        const clip=root.querySelector(selector).getBoundingClientRect();return {last:last.right,edge:clip.right};
      },clipSelector);
      assert.ok(bounds.last<=bounds.edge+2&&bounds.last>=bounds.edge-24,'native paging reaches the last full card: '+JSON.stringify(bounds));
    }
    await checkCarouselEnd(videoShelf,videoShelf.locator('#right-arrow button'),'#scroll-container');
    await checkCarouselEnd(creatorShelf,creatorShelf.locator('.ytwHorizontalShelfViewModelRightArrow button'),'.ytwHorizontalShelfViewModelHorizontalContainer');
    await videoShelf.locator('.ytLockupViewModelHost').last().locator('.ytLockupMetadataViewModelMenuButton button').click();
    await page.waitForFunction(()=>[...document.querySelectorAll('ytd-popup-container :is(yt-sheet-view-model,ytd-menu-popup-renderer)')].some(e=>e.checkVisibility()),null,{timeout:5000});
    await page.keyboard.press('Escape');
    const topic=page.locator(scope+' chip-shape button[aria-label="Comedy"]');
    await topic.click();
    await page.waitForFunction(scope=>document.querySelector(scope+' chip-shape button[aria-label="Comedy"]')?.getAttribute('aria-selected')==='true',scope);
    await page.waitForTimeout(400);
    const cssBefore=await page.locator('#yt-custom-progress-style').textContent();
    await popup.evaluate(()=>chrome.storage.sync.set({uiOpacity:70,uiBlur:0}));
    await page.waitForFunction(scope=>getComputedStyle(document.querySelector(scope+' .ytLockupViewModelHost')).backdropFilter==='none',scope);
    assert.equal(await page.locator('#yt-custom-progress-style').textContent(),cssBefore,'sliders only update shared tokens');
    await popup.evaluate(()=>chrome.storage.sync.set({pageColor:'#f7f8fa',surfaceColor:'#ffffff',textColor:'#172b3a',accentColor:'#006d77',uiBlur:12}));
    await page.waitForFunction(scope=>getComputedStyle(document.querySelector(scope+' .ytLockupMetadataViewModelTitle')).color==='rgb(23, 43, 58)',scope);
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-channel-memberships-light.png')});
    for(const width of [1024,768,430]){
      await page.setViewportSize({width,height:1100});await page.waitForTimeout(600);
      state=await info();assert.equal(state.overflow,false,'memberships page fits '+width+'px');
      assert.ok(state.chips.every(chip=>chip.x>=0&&chip.right<=width),'wrapping topics fit '+width+'px');
      if(width===430)assert.ok(state.hero.width>width*.8,'phone layout uses the available width');
    }
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-channel-memberships-mobile.png')});
    await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false}));
    await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme'));
    assert.notEqual(await page.locator(scope+' yt-sponsorships-destination-hub-header-view-model').evaluate(e=>getComputedStyle(e).borderRadius),'20px','native header is restored');
    console.log('PASS: real memberships hero, wrapping filters, creator/video cards, native carousels/menus/filter selection, dark/light colors, opacity/blur, responsive layout, and theme restoration. Screenshots: '+os.tmpdir());
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
