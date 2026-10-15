// Music appearance is CSS-driven: real controls keep working while queue,
// navigation, and progress updates do no YouTube surface/layout scanning.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const fixture = `<!doctype html><html><head><style>
  body { margin:0; font:16px Arial; }
  ytmusic-app { display:block; --ytmusic-text-primary:#fff; --ytmusic-text-secondary:#aaa; background:#030303; }
  ytmusic-app-layout, ytmusic-section-list-renderer, ytmusic-player-page { display:block; }
  #nav-bar-background, ytmusic-nav-bar { position:fixed; top:0; height:64px; left:0; right:0; z-index:3; }
  #nav-bar-background { background:#030303; }
  ytmusic-nav-bar { display:flex; gap:30px; align-items:center; padding-inline:24px; }
  #guide { position:fixed; inset:64px auto 80px 0; width:200px; }
  #contentContainer { height:100%; background:#030303; }
  ytmusic-guide-entry-renderer { display:block; padding:16px; }
  ytmusic-search-box { width:360px; max-width:65vw; }
  ytmusic-search-box input { width:100%; box-sizing:border-box; padding:10px; }
  #suggestion-list { position:absolute; width:360px; height:80px; }
  #content { margin:80px 24px 100px 224px; }
  ytmusic-fullbleed-thumbnail-renderer { position:fixed; inset:64px 0 0; background:#000; pointer-events:none; }
  .background-gradient.ytmusic-browse-response { position:absolute; top:0; left:0; width:100%; height:2000px;
    pointer-events:none; background-image:linear-gradient(rgba(0,0,0,.6),transparent); background-size:100% 500px; }
  ytmusic-carousel-shelf-renderer, ytmusic-shelf-renderer, ytmusic-playlist-shelf-renderer { display:block; margin-bottom:20px; }
  .carousel { display:flex; gap:16px; overflow:auto; }
  ytmusic-two-row-item-renderer { display:block; flex:none; width:160px; }
  ytmusic-two-row-item-renderer .image-wrapper { display:block; position:relative; height:0; padding-top:100%; }
  ytmusic-two-row-item-renderer[aspect-ratio="MUSIC_TWO_ROW_ITEM_THUMBNAIL_ASPECT_RATIO_RECTANGLE_16_9"] { width:320px; }
  ytmusic-two-row-item-renderer[aspect-ratio="MUSIC_TWO_ROW_ITEM_THUMBNAIL_ASPECT_RATIO_RECTANGLE_16_9"] .image-wrapper { padding-top:56.25%; }
  ytmusic-thumbnail-renderer { display:block; position:absolute; inset:0; width:100%; height:100%; }
  .title-group { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; overflow-wrap:break-word; }
  ytmusic-two-row-item-renderer .subtitle { overflow:hidden; }
  .thumbnail-corner-overlay { position:absolute; width:24px; height:24px; left:8px; bottom:8px; }
  ytmusic-carousel-shelf-basic-header-renderer { display:block; }
  ytmusic-carousel-shelf-basic-header-renderer .details { display:flex; align-items:center; gap:16px; }
  ytmusic-carousel-shelf-basic-header-renderer .title { flex:1; }
  #button-group { display:flex; align-items:center; gap:8px; }
  .ytSpecButtonShapeNextHost, .yt-spec-button-shape-next { height:36px; white-space:nowrap; background:transparent; color:white; border:1px solid #ffffff30; border-radius:18px; }
  #previous-items-button, #next-items-button { display:flex; align-items:center; justify-content:center; flex:none; width:36px; height:36px; border:1px solid #ffffff30; border-radius:50%; }
  #previous-items-button button, #next-items-button button { width:18px; height:18px; border:0; padding:0; background:transparent; }
  .explore-tiles { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
  ytmusic-navigation-button-renderer { display:block; min-width:0; }
  ytmusic-navigation-button-renderer > button { display:flex; align-items:center; width:100%; height:48px; padding:8px 16px; border:0; border-radius:8px; background:#ffffff26; color:white; }
  ytmusic-navigation-button-renderer[button-style="STYLE_SOLID"] > button { border-left:4px solid var(--ytmusic-navigation-button-left-stripe-color); }
  ytmusic-visual-header-renderer { display:block; }
  .gradient-container.ytmusic-visual-header-renderer { padding:24px 0; background:linear-gradient(360deg,#030303,transparent) #0006; transition:background-color 1s; }
  ytmusic-visual-header-renderer .content-container { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  ytmusic-visual-header-renderer .metadata { min-width:0; flex:1; }
  ytmusic-visual-header-renderer .buttons { display:flex; gap:8px; }
  img { width:100%; height:100%; object-fit:cover; }
  .title, h2 { color:var(--ytmusic-text-primary); }
  .subtitle { color:var(--ytmusic-text-secondary); }
  ytmusic-responsive-list-item-renderer { display:flex; height:48px; min-height:48px; align-items:center;
    --ytmusic-list-item-height:48px; --ytmusic-responsive-list-item-thumbnail-size:48px; }
  ytmusic-responsive-list-item-renderer .left-items { position:relative; flex:none; width:var(--ytmusic-responsive-list-item-thumbnail-size);
    height:var(--ytmusic-responsive-list-item-thumbnail-size); margin-inline-end:16px; }
  ytmusic-responsive-list-item-renderer .flex-columns { flex:1; min-width:0; }
  ytmusic-responsive-list-item-renderer .flex-columns > * { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .thumbnail-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
  .row-play { width:28px; height:28px; padding:0; font-size:10px; }
  #pixel-panel { display:block; width:200px; height:90px; margin-top:10px; }
  ytmusic-player-page #main-panel { width:55%; }
  ytmusic-player-page #side-panel { width:100%; height:200px; overflow:auto; }
  #movie_player video { width:240px; height:135px; }
  #player-bar-background, ytmusic-player-bar { position:fixed; bottom:0; height:72px; left:0; right:0; z-index:4; }
  #player-bar-background, ytmusic-player-bar { background:#212121; }
  ytmusic-player-bar { display:flex; align-items:center; gap:16px; padding-inline:16px; }
  #progress-bar { position:absolute; top:0; width:100%; height:5px; }
  #primaryProgress { height:100%; background:var(--paper-slider-active-color,red); }
  button { cursor:pointer; padding:8px; }
  ytmusic-menu-popup-renderer { display:block; position:fixed; top:100px; right:20px; width:220px; padding:16px; }
  [hidden] { display:none!important; }
  @media(max-width:800px) { #guide { display:none; } #content { margin-inline:16px; } }
</style></head><body><ytmusic-app><ytmusic-app-layout>
  <div id="nav-bar-background"></div><ytmusic-nav-bar>
    <button id="home">Home</button><ytmusic-search-box><input placeholder="Search music">
      <div id="suggestion-list" hidden>Search results</div></ytmusic-search-box>
  </ytmusic-nav-bar>
  <div id="guide"><div id="contentContainer"><ytmusic-guide-renderer>
    <ytmusic-guide-entry-renderer>Home</ytmusic-guide-entry-renderer><ytmusic-guide-entry-renderer>Library</ytmusic-guide-entry-renderer>
  </ytmusic-guide-renderer></div></div>
  <div id="content"><ytmusic-browse-response><div class="background-gradient style-scope ytmusic-browse-response"></div><ytmusic-fullbleed-thumbnail-renderer></ytmusic-fullbleed-thumbnail-renderer>
    <ytmusic-section-list-renderer><ytmusic-chip-cloud-renderer>Focus · Relax · Workout</ytmusic-chip-cloud-renderer>
      <ytmusic-carousel-shelf-renderer><ytmusic-carousel-shelf-basic-header-renderer><div class="details"><h2 class="title">Albums</h2><div id="button-group"><button class="ytSpecButtonShapeNextHost ytSpecButtonShapeNextOutline">More</button><button class="yt-spec-button-shape-next yt-spec-button-shape-next--outline">Play all</button><yt-icon-button id="previous-items-button" disabled><button disabled aria-label="Previous">←</button></yt-icon-button><yt-icon-button id="next-items-button"><button aria-label="Next">→</button></yt-icon-button></div></div></ytmusic-carousel-shelf-basic-header-renderer><div class="carousel">${Array.from({length:10}, (_, i) => `
        <ytmusic-two-row-item-renderer><a class="image-wrapper"><ytmusic-thumbnail-renderer><img alt="Album ${i}"></ytmusic-thumbnail-renderer>${i === 1 ? '<span class="thumbnail-corner-overlay"><img alt="Playlist owner"></span>' : ''}</a>
          <div class="details"><div class="title-group"><span class="title">${i === 1 ? 'A community playlist with a long title that must stay inside its card' : 'Album ' + i}</span></div><div class="subtitle"><a style="color:white">Artist ${i}</a></div></div></ytmusic-two-row-item-renderer>`).join('')}
      </div></ytmusic-carousel-shelf-renderer>
      <ytmusic-carousel-shelf-renderer><ytmusic-carousel-shelf-basic-header-renderer><div class="details"><h2 class="title">Music videos for you</h2></div></ytmusic-carousel-shelf-basic-header-renderer><div class="carousel">
        <ytmusic-two-row-item-renderer id="wide-card" aspect-ratio="MUSIC_TWO_ROW_ITEM_THUMBNAIL_ASPECT_RATIO_RECTANGLE_16_9"><a class="image-wrapper"><ytmusic-thumbnail-renderer><img alt="Music video"></ytmusic-thumbnail-renderer></a><div class="details"><div class="title-group"><span class="title">A music video with a long title that wraps to a second line within the card</span></div><div class="subtitle">Artist · 1M views</div></div></ytmusic-two-row-item-renderer>
      </div></ytmusic-carousel-shelf-renderer>
      <ytmusic-playlist-shelf-renderer><h2>Playlist</h2>${Array.from({length:5}, (_, i) => `
        <ytmusic-responsive-list-item-renderer height-style="MUSIC_RESPONSIVE_LIST_ITEM_HEIGHT_MEDIUM_COMPACT"><div class="left-items"><ytmusic-thumbnail-renderer><img alt="Song art"></ytmusic-thumbnail-renderer><div class="thumbnail-overlay"><button class="row-play">Play</button></div></div><div class="flex-columns"><span class="title">Song ${i}</span>
          <span class="subtitle">Artist ${i}</span></div><button class="song-menu">More</button></ytmusic-responsive-list-item-renderer>`).join('')}
      </ytmusic-playlist-shelf-renderer>
      <div class="explore-tiles"><ytmusic-navigation-button-renderer button-style="STYLE_ICON"><button><yt-icon>↗</yt-icon>New releases</button></ytmusic-navigation-button-renderer>
        <ytmusic-navigation-button-renderer button-style="STYLE_SOLID" style="--ytmusic-navigation-button-left-stripe-color:rgb(164,197,255)"><button>Chill</button></ytmusic-navigation-button-renderer></div>
      <ytmusic-visual-header-renderer><div class="gradient-container style-scope ytmusic-visual-header-renderer"><div class="content-container"><div id="foreground-thumbnail" style="width:80px;height:80px;border-radius:50%;background:#999"></div><div class="metadata"><h2><span class="title">Creator channel</span></h2><div class="buttons"><button class="ytSpecButtonShapeNextHost ytSpecButtonShapeNextOutline">Subscribe</button><button class="ytSpecButtonShapeNextHost ytSpecButtonShapeNextFilled" style="background:white;color:black">Share</button></div></div></div></div></ytmusic-visual-header-renderer>
      <ytmusic-shelf-renderer><ytmusic-two-row-item-renderer id="pixel-panel"></ytmusic-two-row-item-renderer></ytmusic-shelf-renderer>
    </ytmusic-section-list-renderer></ytmusic-browse-response></div>
    <ytmusic-player-page><div id="main-panel"><ytmusic-player><div id="movie_player" class="html5-video-player"><video muted></video></div></ytmusic-player></div>
      <div id="side-panel"><ytmusic-tab-renderer><tp-yt-paper-tab role="tab" aria-selected="true" style="color:white">Up next</tp-yt-paper-tab></ytmusic-tab-renderer><ytmusic-player-queue>
        <ytmusic-player-queue-item class="title">Playing song<span class="duration" style="color:white">3:33</span></ytmusic-player-queue-item>
      </ytmusic-player-queue></div>
    </ytmusic-player-page>
  <div id="player-bar-background"></div><ytmusic-player-bar>
    <tp-yt-paper-slider id="progress-bar"><div id="primaryProgress"></div></tp-yt-paper-slider>
    <button id="play-pause">Pause</button><button id="next">Next</button><span id="time">0:00</span>
  </ytmusic-player-bar>
</ytmusic-app-layout><ytmusic-popup-container></ytmusic-popup-container></ytmusic-app><script>
 const video = document.querySelector('video');
 document.querySelector('#play-pause').onclick = () => video.paused ? video.play() : video.pause();
 document.querySelector('#next').onclick = () => { window.nextClicks = (window.nextClicks || 0) + 1; };
 document.querySelectorAll('#previous-items-button button, #next-items-button button').forEach(button => button.onclick = () => { window.carouselClicks = (window.carouselClicks || 0) + 1; });
 document.querySelectorAll('ytmusic-navigation-button-renderer button').forEach(button => button.onclick = () => { window.tileClicks = (window.tileClicks || 0) + 1; });
 document.querySelectorAll('.row-play').forEach(button => button.onclick = () => { window.rowPlays = (window.rowPlays || 0) + 1; video.play(); });
 document.querySelectorAll('.song-menu').forEach(button => button.onclick = () => {
   document.querySelector('ytmusic-popup-container').innerHTML = '<ytmusic-menu-popup-renderer><span class="title">Add to playlist</span></ytmusic-menu-popup-renderer>';
   window.menuPaint = new Promise(resolve => requestAnimationFrame(() => resolve(getComputedStyle(document.querySelector('ytmusic-menu-popup-renderer')).backdropFilter)));
 });
 document.querySelector('#home').onclick = () => {
   history.pushState({}, '', '/browse/test-library');
   document.dispatchEvent(new Event('yt-navigate-finish'));
 };
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext('', {
    channel:'chrome', headless:true, viewport:{width:1440,height:1000},
    ignoreDefaultArgs:['--disable-extensions'],
    args:['--enable-unsafe-extension-debugging','--autoplay-policy=no-user-gesture-required']
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route('https://music.youtube.com/**', route => route.fulfill({contentType:'text/html',body:fixture}));
    const cdp = await context.browser().newBrowserCDPSession();
    const {id} = await cdp.send('Extensions.loadUnpacked', {path:root});
    const popup = await context.newPage();
    await popup.goto('chrome-extension://' + id + '/popup.html');
    await popup.waitForSelector('#settings-form:not([inert])');
    const wallpaper = await popup.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      for (let x = 0; x < 64; x += 4) { ctx.fillStyle = x % 8 ? '#fff' : '#000'; ctx.fillRect(x,0,4,64); }
      const data = canvas.toDataURL();
      await chrome.storage.local.set({backgroundImageData:data});
      await chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image',backgroundFit:'tile',backgroundOpacity:100,uiBlur:12,
        surfaceColor:'#212121',textColor:'#f5f5f5',progressColor:'#00ccff',uiOpacity:30});
      return data;
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://music.youtube.com/');
    await page.waitForSelector('#ytc-background-image', {state:'attached'});
    await page.bringToFront();
    await page.evaluate(async wallpaper => {
      document.querySelectorAll('img').forEach(image => image.src = wallpaper);
      const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 135;
      const ctx = canvas.getContext('2d');
      function draw() { ctx.fillStyle = Math.floor(performance.now()/100)%2 ? '#ffb900' : '#21a366';ctx.fillRect(0,0,240,135);requestAnimationFrame(draw); }
      draw(); video.srcObject = canvas.captureStream(30); await video.play(); window.primaryVideo = video;
    }, wallpaper);
    const background = selector => page.locator(selector).first().evaluate(element => ({
      color:getComputedStyle(element).backgroundColor,blur:getComputedStyle(element).backdropFilter
    }));
    const frosted = {color:'rgba(33, 33, 33, 0.3)',blur:'blur(12px)'};
    for (const selector of ['#nav-bar-background','#guide #contentContainer','#player-bar-background',
      'ytmusic-two-row-item-renderer','ytmusic-responsive-list-item-renderer','#side-panel']) assert.deepEqual(await background(selector),frosted,selector);
    for (const selector of ['ytmusic-app','ytmusic-player-page','ytmusic-player-bar','ytmusic-nav-bar','ytmusic-player-queue',
      'ytmusic-carousel-shelf-renderer','ytmusic-playlist-shelf-renderer','ytmusic-shelf-renderer']) {
      assert.deepEqual(await background(selector), {color:'rgba(0, 0, 0, 0)',blur:'none'},selector + ' shares a background without an extra backdrop surface');
    }
    const individualCards = await page.locator('ytmusic-two-row-item-renderer, ytmusic-responsive-list-item-renderer').evaluateAll(elements =>
      elements.map(el => ({color:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter})));
    assert.ok(individualCards.length > 10);
    individualCards.forEach(card => assert.deepEqual(card,frosted,'every song/album has its own glass background'));
    assert.equal(await page.locator('.background-gradient').evaluate(el => getComputedStyle(el).backgroundImage),'none',
      'native 500px repeating black fade is cleared independently of music cards');
    assert.equal(await page.locator('ytmusic-fullbleed-thumbnail-renderer').evaluate(el => getComputedStyle(el).display),'none');
    assert.equal(await page.locator('#primaryProgress').evaluate(el => getComputedStyle(el).backgroundColor),'rgb(0, 204, 255)');
    assert.equal(await page.locator('.title').first().evaluate(el => getComputedStyle(el).color),'rgb(245, 245, 245)');
    const art = await page.locator('img').first().evaluate(el => ({width:el.clientWidth,height:el.clientHeight,filter:getComputedStyle(el).filter,opacity:getComputedStyle(el).opacity}));
    assert.deepEqual(art,{width:144,height:144,filter:'none',opacity:'1'},'square artwork stays sharp and fits the 8px card inset');
    const geometry = await page.locator('ytmusic-two-row-item-renderer:not(#pixel-panel)').evaluateAll(elements => elements.map(el => {
      const card=el.getBoundingClientRect(), image=el.querySelector('.image-wrapper').getBoundingClientRect(), details=el.querySelector('.details').getBoundingClientRect();
      return {padding:getComputedStyle(el).padding,clip:getComputedStyle(el).overflow,
        radius:getComputedStyle(el.querySelector('.image-wrapper')).borderRadius,
        left:image.left-card.left,right:card.right-image.right,top:image.top-card.top,bottom:card.bottom-details.bottom,
        ratio:image.width/image.height,width:card.width};
    }));
    for(const card of geometry) {
      assert.equal(card.padding,'8px');assert.equal(card.clip,'clip');assert.equal(card.radius,'10px');
      assert.ok([card.left,card.right,card.top,card.bottom].every(gap => gap >= 7.5),'art and captions stay inside every card: '+JSON.stringify(card));
      assert.ok(Math.abs(card.ratio-(card.width===320 ? 16/9 : 1))<.01,'native artwork aspect ratio is preserved');
    }
    const titleBox=await page.locator('ytmusic-carousel-shelf-basic-header-renderer .title').first().evaluate(el => ({
      border:getComputedStyle(el).borderTopWidth,radius:getComputedStyle(el).borderRadius,
      width:el.getBoundingClientRect().width,parentWidth:el.parentElement.getBoundingClientRect().width
    }));
    assert.equal(titleBox.border,'1px');assert.equal(titleBox.radius,'12px');
    assert.ok(titleBox.width<titleBox.parentWidth/2,'section border fits the title rather than spanning the shelf');
    for(const selector of ['#button-group > button','#previous-items-button','#next-items-button',
      'ytmusic-navigation-button-renderer > button','ytmusic-visual-header-renderer .buttons button']) {
      for(const control of await page.locator(selector).all()) {
        assert.deepEqual(await control.evaluate(el=>({color:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter})),frosted,
          'each native control has one themed surface: '+selector);
      }
    }
    assert.equal(await page.locator('ytmusic-navigation-button-renderer[button-style="STYLE_SOLID"] > button').evaluate(el=>getComputedStyle(el).borderLeft),'4px solid rgb(164, 197, 255)',
      'genre tiles retain their native category stripe');
    const arrows=await page.locator('#previous-items-button, #next-items-button').evaluateAll(es=>es.map(el=>({
      width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,radius:getComputedStyle(el).borderRadius,opacity:getComputedStyle(el).opacity
    })));
    assert.deepEqual(arrows,[{width:36,height:36,radius:'50%',opacity:'0.4'},{width:36,height:36,radius:'50%',opacity:'1'}],
      'carousel arrows preserve native targets and distinguish the disabled direction');
    assert.equal(await page.locator('#previous-items-button button').isDisabled(),true);
    await page.locator('#previous-items-button button').evaluate(el=>el.click());
    await page.locator('#next-items-button button').click();
    assert.equal(await page.evaluate(()=>window.carouselClicks),1,'only the enabled native arrow accepts a click');
    await page.locator('ytmusic-navigation-button-renderer button').first().click();
    assert.equal(await page.evaluate(()=>window.tileClicks),1,'Explore tiles still receive native clicks');
    assert.deepEqual(await background('ytmusic-visual-header-renderer .gradient-container'),{color:'rgba(0, 0, 0, 0)',blur:'none'},
      'channel decoration does not create a page-wide dark band');
    assert.equal(await page.locator('ytmusic-visual-header-renderer .title').evaluate(el=>getComputedStyle(el).borderTopWidth),'1px');
    assert.equal(await page.locator('#foreground-thumbnail').isVisible(),true,'clearing the channel gradient keeps its avatar and metadata');
    const rows=await page.locator('ytmusic-responsive-list-item-renderer').evaluateAll(elements=>elements.map(el=>{
      const row=el.getBoundingClientRect(),art=el.querySelector('.left-items').getBoundingClientRect();
      return {height:row.height,artWidth:art.width,top:art.top-row.top,bottom:row.bottom-art.bottom,left:art.left-row.left,
        clip:getComputedStyle(el).overflow,radius:getComputedStyle(el.querySelector('.left-items')).borderRadius};
    }));
    for(const row of rows) assert.deepEqual(row,{height:48,artWidth:36,top:6,bottom:6,left:8,clip:'clip',radius:'8px'},
      'compact rows inset their artwork without changing the native row height');
    await page.locator('.row-play').first().click();
    assert.equal(await page.evaluate(()=>window.rowPlays),1,'inset artwork still receives play clicks');
    await page.locator('.song-menu').first().click();
    assert.equal(await page.evaluate(() => window.menuPaint),'blur(12px)','new menus are styled on their first frame');
    await page.locator('ytmusic-menu-popup-renderer').evaluate(el => el.remove());

    // Verify painted wallpaper through Music panels, rather than just computed CSS.
    async function contrast() {
      const png = await page.locator('#pixel-panel').screenshot();
      return page.evaluate(async data => {
        const image = new Image();image.src = 'data:image/png;base64,' + data;await image.decode();
        const canvas = document.createElement('canvas');canvas.width = image.width;canvas.height = image.height;
        const ctx = canvas.getContext('2d');ctx.drawImage(image,0,0);
        const pixels = ctx.getImageData(24,45,image.width-48,1).data, values = [];
        for(let i=0;i<pixels.length;i+=4) values.push(pixels[i]);
        const mean = values.reduce((sum,value) => sum+value,0)/values.length;
        return Math.sqrt(values.reduce((sum,value) => sum+(value-mean)**2,0)/values.length);
      },png.toString('base64'));
    }
    const blurredContrast = await contrast();
    const originalCss = await page.locator('#yt-custom-progress-style').textContent();
    await popup.evaluate(() => chrome.storage.sync.set({uiBlur:0}));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#pixel-panel')).backdropFilter === 'none');
    const clearContrast = await contrast();
    assert.ok(clearContrast > 40 && blurredContrast < clearContrast*.35, 'Music glass visibly samples wallpaper: ' + clearContrast + ' -> ' + blurredContrast);
    assert.equal(await page.locator('#yt-custom-progress-style').textContent(),originalCss,'blur slider only changes root tokens');

    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({url:'https://music.youtube.com/*'});
      await chrome.scripting.executeScript({target:{tabId:tab.id},func:() => {
        globalThis.musicWork = {queries:0,selectorChecks:0};
        for (const prototype of [Document.prototype,Element.prototype]) {
          for (const method of ['querySelector','querySelectorAll']) {
            const original = prototype[method];
            prototype[method] = function(...args) { musicWork.queries++;return original.apply(this,args); };
          }
        }
        const matches = Element.prototype.matches;
        Element.prototype.matches = function(selector,...args) {
          if (/data-ytc-universal|ytd-browse/.test(selector)) musicWork.selectorChecks++;
          return matches.call(this,selector,...args);
        };
      }});
    });
    const initialTime = await page.locator('video').evaluate(el => el.currentTime);
    await page.evaluate(async () => {
      for(let frame=0;frame<30;frame++) {
        document.querySelector('#primaryProgress').style.width = frame+'%';
        document.querySelector('#time').textContent = '0:'+frame;
        document.querySelector('ytmusic-player-queue-item').className = 'title state-'+frame;
        await new Promise(requestAnimationFrame);
      }
    });
    await page.locator('#home').click();
    await page.locator('#next').click();
    assert.equal(await page.evaluate(() => window.nextClicks),1);
    await page.waitForTimeout(150);
    const work = await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({url:'https://music.youtube.com/*'});
      const [{result}] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:() => musicWork});return result;
    });
    assert.deepEqual(work,{queries:0,selectorChecks:0},'progress, queue, and SPA navigation do no extension DOM scanning');
    assert.equal(await page.evaluate(() => window.primaryVideo === document.querySelector('video') && !primaryVideo.paused && primaryVideo.currentTime > 0),true);
    assert.ok(await page.locator('video').evaluate((el,time) => el.currentTime > time,initialTime));
    await page.locator('#play-pause').click();assert.equal(await page.locator('video').evaluate(el => el.paused),true);
    await popup.evaluate(() => chrome.storage.sync.set({pageColor:'#fafafa',surfaceColor:'#ffffff',textColor:'#112233',uiOpacity:70,uiBlur:12,hideHomeTopicBar:true}));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.title')).color === 'rgb(17, 34, 51)');
    assert.deepEqual(await background('ytmusic-two-row-item-renderer'),{color:'rgba(255, 255, 255, 0.7)',blur:'blur(12px)'});
    assert.deepEqual(await background('ytmusic-carousel-shelf-renderer'),{color:'rgba(0, 0, 0, 0)',blur:'none'});
    assert.notEqual(await page.locator('.subtitle a').first().evaluate(el => getComputedStyle(el).color),'rgb(255, 255, 255)','native white captions adopt the light theme');
    assert.equal(await page.locator('[role="tab"]').evaluate(el => getComputedStyle(el).color),'rgb(17, 34, 51)','selected queue tab stays readable');
    assert.notEqual(await page.locator('.duration').evaluate(el => getComputedStyle(el).color),'rgb(255, 255, 255)','queue timestamps adopt the light theme');
    assert.equal(await page.locator('ytmusic-visual-header-renderer .buttons button').last().evaluate(el=>getComputedStyle(el).color),'rgb(17, 34, 51)',
      'filled native channel actions adopt readable theme text with their themed background');
    await page.locator('ytmusic-app-layout').evaluate(el => el.setAttribute('player-page-open',''));
    assert.equal(await page.locator('#content').evaluate(el => getComputedStyle(el).visibility),'hidden','browse cards do not bleed through the expanded player');
    assert.equal(await page.locator('ytmusic-player-page').evaluate(el => getComputedStyle(el).visibility),'visible');
    await page.locator('ytmusic-app-layout').evaluate(el => el.removeAttribute('player-page-open'));
    assert.equal(await page.locator('#content').evaluate(el => getComputedStyle(el).visibility),'visible','closing the player restores the existing browse page');
    assert.equal(await page.locator('ytmusic-chip-cloud-renderer').evaluate(el => getComputedStyle(el).display),'none');
    for (const width of [1024,768,430]) {
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,'native carousels and panels fit '+width+'px');
    }
    await popup.evaluate(() => chrome.storage.sync.set({themeEnabled:false}));
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-theme') && !document.querySelector('#ytc-background-image'));
    assert.equal(await page.locator('ytmusic-app').evaluate(el => getComputedStyle(el).backgroundColor),'rgb(3, 3, 3)','disabling theme restores native Music background');
    assert.equal(await page.locator('ytmusic-fullbleed-thumbnail-renderer').evaluate(el => getComputedStyle(el).display),'block','native decorative background returns');
    assert.match(await page.locator('.background-gradient').evaluate(el => getComputedStyle(el).backgroundImage),/linear-gradient/,
      'disabling the theme restores native browse shading');
    assert.match(await page.locator('ytmusic-visual-header-renderer .gradient-container').evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/,
      'disabling the theme restores native channel decoration');
    assert.equal(await page.locator('ytmusic-navigation-button-renderer button').first().evaluate(el=>getComputedStyle(el).borderRadius),'8px');
    assert.deepEqual(errors,[]);
    console.log('PASS: individual Music cards, wallpaper pixels, light/dark colors, native artwork, carousel/Explore controls, genre stripes, channel decoration, responsive layout, CSS-only navigation/progress/queue, playback, and theme restoration.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
