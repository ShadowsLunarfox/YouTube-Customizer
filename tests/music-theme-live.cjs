// Optional network-dependent smoke check against YouTube Music's current UI.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const context = await chromium.launchPersistentContext('', {
    channel:'chrome',headless:true,viewport:{width:1440,height:1000},
    ignoreDefaultArgs:['--disable-extensions'],
    args:['--enable-unsafe-extension-debugging']
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const {id} = await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
    const popup = await context.newPage();
    await popup.goto('chrome-extension://' + id + '/popup.html');
    await popup.waitForSelector('#settings-form:not([inert])');
    await popup.evaluate(async () => {
      const canvas = document.createElement('canvas');canvas.width=1440;canvas.height=1000;
      // A uniform wallpaper makes any remaining page-wide gradient measurable.
      const ctx=canvas.getContext('2d');ctx.fillStyle='#3c8ca0';ctx.fillRect(0,0,1440,1000);
      await chrome.storage.local.set({backgroundImageData:canvas.toDataURL()});
      await chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image',backgroundOpacity:100,
        uiOpacity:45,uiBlur:12,textColor:'#f5f5f5'});
    });
    const page = await context.newPage();
    // Music rejects the HeadlessChrome product token before loading its app.
    const session = await context.newCDPSession(page);
    const userAgent = await page.evaluate(() => navigator.userAgent);
    await session.send('Network.setUserAgentOverride',{userAgent:userAgent.replace('HeadlessChrome/','Chrome/'),platform:'Windows'});
    await page.goto('https://music.youtube.com/',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('ytmusic-carousel-shelf-renderer',{timeout:15000});
    await page.waitForSelector('ytmusic-responsive-list-item-renderer',{timeout:15000});
    await page.waitForSelector('ytmusic-two-row-item-renderer',{timeout:15000});
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-ytc-custom-background'));
    await page.bringToFront();
    await page.waitForTimeout(1000);
    const info = () => page.evaluate(() => {
      const style = selector => {
        const node=document.querySelector(selector);
        if (!node) return null;
        const css=getComputedStyle(node);
        return {color:css.color,background:css.backgroundColor,blur:css.backdropFilter,display:css.display};
      };
      return {
        title:style('ytmusic-carousel-shelf-basic-header-renderer .title'),
        track:style('ytmusic-responsive-list-item-renderer .title'),
        songCard:style('ytmusic-responsive-list-item-renderer'),
        albumCard:style('ytmusic-two-row-item-renderer'),
        shelf:style('ytmusic-carousel-shelf-renderer'),sidebar:style('#guide #contentContainer'),
        ambient:[...document.querySelectorAll('ytmusic-fullbleed-thumbnail-renderer')].map(node=>({
          parent:node.parentElement.localName,display:getComputedStyle(node).display
        })),
        overflow:document.documentElement.scrollWidth>innerWidth,
        search:document.querySelector('ytmusic-search-box')?.innerHTML.slice(0,3000),
        header:document.querySelector('ytmusic-carousel-shelf-basic-header-renderer')?.innerHTML.slice(0,1500),
        layout:document.querySelector('ytmusic-app-layout').getAttributeNames().map(key=>[key,document.querySelector('ytmusic-app-layout').getAttribute(key)]),
        playerPage:document.querySelector('ytmusic-player-page').getAttributeNames().map(key=>[key,document.querySelector('ytmusic-player-page').getAttribute(key)]),
        content:style('ytmusic-app-layout > #content'),
        controls:[...document.querySelectorAll('ytmusic-carousel-shelf-basic-header-renderer button, ytmusic-guide-signin-promo-renderer button, ytmusic-chip-cloud-chip-renderer a')].slice(0,8).map(node=>({tag:node.localName,class:node.className,text:node.innerText,color:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor})),
        captions:[...document.querySelectorAll('ytmusic-two-row-item-renderer .subtitle, ytmusic-responsive-list-item-renderer .secondary-flex-columns, ytmusic-two-row-item-renderer .subtitle *')].slice(0,6).map(node=>({tag:node.localName,class:node.className,color:getComputedStyle(node).color})),
        logo:document.querySelector('ytmusic-logo')?.outerHTML.slice(0,1800),
        rowControls:[...document.querySelector('ytmusic-responsive-list-item-renderer')?.querySelectorAll('a,button,tp-yt-paper-icon-button,ytmusic-play-button-renderer') || []].map(node=>({tag:node.localName,id:node.id,href:node.getAttribute('href'),label:node.getAttribute('aria-label')}))
      };
    });
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-music-themed-dark.png')});
    let state = await info();
    console.log('Dark: ' + JSON.stringify(process.env.YTC_MUSIC_LIVE_DEBUG ? state : {song:state.songCard,album:state.albumCard,shelf:state.shelf,overflow:state.overflow}));
    assert.equal(state.shelf.blur,'none');
    assert.equal(state.shelf.background,'rgba(0, 0, 0, 0)');
    assert.equal(state.songCard.blur,'blur(12px)');
    assert.equal(state.albumCard.blur,'blur(12px)');
    assert.equal(state.overflow,false);
    const insetCards=await page.locator('ytmusic-two-row-item-renderer').evaluateAll(elements=>elements.map(el=>{
      const image=el.querySelector('.image-wrapper');
      if(!image)return null;
      const card=el.getBoundingClientRect(),art=image.getBoundingClientRect(),css=getComputedStyle(el);
      return card.width>0 ? {left:art.left-card.left,right:card.right-art.right,top:art.top-card.top,
        radius:getComputedStyle(image).borderRadius,clip:css.overflow} : null;
    }).filter(Boolean));
    assert.ok(insetCards.length>0);
    for(const card of insetCards){
      assert.ok([card.left,card.right,card.top].every(gap=>gap>=7.5),'real Music artwork is inset within its card: '+JSON.stringify(card));
      assert.equal(card.radius,'10px');assert.equal(card.clip,'clip');
    }
    const titleBorder=await page.locator('ytmusic-carousel-shelf-basic-header-renderer .title').first().evaluate(el=>({
      border:getComputedStyle(el).borderTopWidth,radius:getComputedStyle(el).borderRadius,
      width:el.getBoundingClientRect().width,parent:el.parentElement.getBoundingClientRect().width
    }));
    assert.equal(titleBorder.border,'1px');assert.equal(titleBorder.radius,'12px');
    assert.ok(titleBorder.width<titleBorder.parent,'title border stays separate from shelf navigation');
    const compactRows=await page.locator('ytmusic-responsive-list-item-renderer[height-style="MUSIC_RESPONSIVE_LIST_ITEM_HEIGHT_MEDIUM_COMPACT"]').evaluateAll(elements=>elements.map(el=>{
      const row=el.getBoundingClientRect(),art=el.querySelector('.left-items').getBoundingClientRect();
      return row.width>0 ? {height:row.height,artWidth:art.width,top:art.top-row.top,bottom:row.bottom-art.bottom,left:art.left-row.left,
        radius:getComputedStyle(el.querySelector('.left-items')).borderRadius} : null;
    }).filter(Boolean));
    assert.ok(compactRows.length>0);
    for(const row of compactRows){
      assert.equal(row.height,48);assert.equal(row.artWidth,36);assert.equal(row.radius,'8px');
      assert.ok([row.top,row.bottom].every(gap=>gap>=5.5)&&row.left>=7.5,'compact native rows keep the artwork inside their borders: '+JSON.stringify(row));
    }
    assert.ok(state.ambient.every(node => node.display === 'none'),'native decorative backdrops do not cover wallpaper');
    const nativeFade = page.locator('ytmusic-browse-response .background-gradient.ytmusic-browse-response');
    assert.ok(await nativeFade.count(),'exercise the real native browse gradient');
    assert.equal(await nativeFade.first().evaluate(el => getComputedStyle(el).backgroundImage),'none');
    async function checkWallpaperBands(label) {
      const png=await page.screenshot();
      const samples=await page.evaluate(async data=>{
        const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        // This margin is outside cards and the sidebar. Sample both sides of
        // the native 500px seam, rather than accepting computed CSS alone.
        return [100,250,499,501,750,900].map(y=>[...ctx.getImageData(260,y,1,1).data].slice(0,3));
      },png.toString('base64'));
      for(const rgb of samples) assert.ok(rgb.every((value,i)=>Math.abs(value-[60,140,160][i])<=2),
        label+': unshaded wallpaper at every sampled height: '+JSON.stringify(samples));
    }
    await checkWallpaperBands('Home at top');
    await page.evaluate(()=>window.scrollTo(0,600));
    await checkWallpaperBands('Home after scrolling');
    await page.evaluate(()=>window.scrollTo(0,0));
    await popup.evaluate(() => chrome.storage.sync.set({pageColor:'#f7f8fa',surfaceColor:'#ffffff',textColor:'#142638',accentColor:'#006d77',uiOpacity:65}));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('ytmusic-app')).color==='rgb(20, 38, 56)');
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-music-themed-light.png')});
    state = await info();
    console.log('Light: ' + JSON.stringify(process.env.YTC_MUSIC_LIVE_DEBUG ? state : {title:state.title,song:state.songCard,album:state.albumCard,shelf:state.shelf}));
    assert.equal(state.track.color,'rgb(20, 38, 56)');
    assert.equal(state.songCard.background,'rgba(255, 255, 255, 0.65)');
    assert.equal(state.albumCard.background,'rgba(255, 255, 255, 0.65)');
    assert.equal(state.shelf.background,'rgba(0, 0, 0, 0)');
    const song = await page.locator('ytmusic-responsive-list-item-renderer a[href*="watch?"]').first().getAttribute('href');
    await page.goto(new URL(song,'https://music.youtube.com/').href,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('ytmusic-app-layout[player-page-open]',{timeout:15000});
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-ytc-custom-background'));
    await page.waitForTimeout(600);
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-music-themed-player.png')});
    assert.equal(await page.locator('ytmusic-player-page').evaluate(el => getComputedStyle(el).visibility),'visible','expanded player stays open');
    assert.equal(await page.locator('ytmusic-app-layout > #content').evaluate(el => getComputedStyle(el).visibility),'hidden','underlying browse page is hidden');
    assert.equal(await page.locator('ytmusic-player-page #side-panel').evaluate(el => getComputedStyle(el).backdropFilter),'blur(12px)');
    const selectedTab = page.locator('ytmusic-player-page #side-panel [role="tab"][aria-selected="true"]').first();
    if (await selectedTab.count()) assert.equal(await selectedTab.evaluate(el => getComputedStyle(el).color),'rgb(20, 38, 56)');
    await page.setViewportSize({width:768,height:1000});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:1440,height:1000});
    await popup.evaluate(()=>chrome.storage.sync.set({surfaceColor:'#212121',textColor:'#f5f5f5',uiOpacity:45}));
    await page.goto('https://music.youtube.com/explore',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('ytmusic-navigation-button-renderer[button-style="STYLE_SOLID"]');
    await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-custom-background'));
    const tiles=await page.locator('ytmusic-navigation-button-renderer > button').evaluateAll(es=>es.map(el=>{
      const css=getComputedStyle(el),host=el.parentElement;
      return {style:host.getAttribute('button-style'),background:css.backgroundColor,blur:css.backdropFilter,
        radius:css.borderRadius,stripe:css.borderInlineStartColor,expectedStripe:getComputedStyle(host).getPropertyValue('--ytmusic-navigation-button-left-stripe-color').trim(),stripeWidth:css.borderInlineStartWidth};
    }));
    assert.ok(tiles.some(tile=>tile.style==='STYLE_ICON')&&tiles.some(tile=>tile.style==='STYLE_SOLID'));
    for(const tile of tiles){
      assert.equal(tile.background,'rgba(33, 33, 33, 0.45)');assert.equal(tile.blur,'blur(12px)');assert.equal(tile.radius,'12px');
      if(tile.style==='STYLE_SOLID'){
        assert.equal(tile.stripeWidth,'4px');
        assert.ok(tile.expectedStripe,'native category color exists');
        // The browser normalizes native rgba(...,1) into rgb(...).
        assert.equal(tile.stripe.replace(/[^\d,]/g,''),tile.expectedStripe.replace(/,1(?:\.0+)?\)/,')').replace(/[^\d,]/g,''));
      }
    }
    const genreShelf=page.locator('ytmusic-carousel-shelf-renderer').filter({has:page.locator('ytmusic-navigation-button-renderer')}).first();
    const firstGenre=genreShelf.locator('ytmusic-navigation-button-renderer').first();
    const nextArrow=genreShelf.locator('#next-items-button');
    assert.equal(await nextArrow.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(33, 33, 33, 0.45)');
    const originalPosition=await firstGenre.evaluate(el=>el.getBoundingClientRect().x);
    await nextArrow.locator('button').click();
    await page.waitForFunction(original=>document.querySelector('ytmusic-carousel-shelf-renderer ytmusic-navigation-button-renderer').getBoundingClientRect().x<original-20,originalPosition);
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-music-themed-explore.png')});
    const shelfActions=await page.locator('ytmusic-carousel-shelf-basic-header-renderer button.ytSpecButtonShapeNextHost').evaluateAll(es=>es.map(el=>({
      background:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter,radius:getComputedStyle(el).borderRadius
    })));
    assert.ok(shelfActions.length>0);
    shelfActions.forEach(action=>assert.deepEqual(action,{background:'rgba(33, 33, 33, 0.45)',blur:'blur(12px)',radius:'12px'}));
    await page.goto('https://music.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('ytmusic-visual-header-renderer .title');
    await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-custom-background'));
    const channel=await page.locator('ytmusic-visual-header-renderer').evaluate(el=>{
      const gradient=el.querySelector('.gradient-container'),title=el.querySelector('.title'),css=getComputedStyle(title);
      return {gradient:getComputedStyle(gradient).backgroundImage,shade:getComputedStyle(gradient).backgroundColor,
        border:css.borderTopWidth,radius:css.borderRadius,width:title.getBoundingClientRect().width,parent:title.closest('.metadata').getBoundingClientRect().width,
        avatar:el.querySelector('#foreground-thumbnail').getBoundingClientRect().width,
        actions:[...el.querySelectorAll('.buttons button')].map(button=>({background:getComputedStyle(button).backgroundColor,color:getComputedStyle(button).color}))};
    });
    assert.equal(channel.gradient,'none');assert.equal(channel.shade,'rgba(0, 0, 0, 0)');
    assert.equal(channel.border,'1px');assert.equal(channel.radius,'12px');assert.ok(channel.width<channel.parent);
    assert.ok(channel.avatar>0&&channel.actions.length>=2,'native channel content is retained');
    channel.actions.forEach(action=>assert.deepEqual(action,{background:'rgba(33, 33, 33, 0.45)',color:'rgb(245, 245, 245)'}));
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-music-themed-channel.png')});
    await checkWallpaperBands('Channel header');
    await page.setViewportSize({width:430,height:1000});
    // Let Music finish collapsing its desktop guide before inspecting mobile.
    await page.waitForTimeout(600);
    const closeGuide=page.locator('ytmusic-guide-renderer #guide-button button').first();
    if(await closeGuide.isVisible()) await closeGuide.click({timeout:3000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'channel header fits a phone viewport');
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-music-themed-channel-mobile.png')});
    console.log('PASS: live Music wallpaper, dark/light cards, expanded player, Explore/genre tiles, native carousel clicks, header controls, channel decoration, and responsive layout. Screenshots: ' + os.tmpdir());
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
