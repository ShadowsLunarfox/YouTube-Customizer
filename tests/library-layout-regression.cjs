// Browser checks for library surfaces, native list controls, route changes, and restoration.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const wallpaper = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const routes = [
  ['/feed/history', 'history', 'ytd-item-section-renderer', 'ytd-video-renderer'],
  ['/feed/playlists', 'playlists', 'ytd-item-section-renderer', 'ytd-grid-playlist-renderer'],
  ['/playlist?list=WL', 'watch-later', 'ytd-playlist-video-list-renderer', 'ytd-playlist-video-renderer'],
  ['/playlist?list=LL', 'liked', 'ytd-playlist-video-list-renderer', 'ytd-playlist-video-renderer'],
  ['/feed/downloads', 'downloads', 'ytd-downloads-page-renderer', 'ytd-offline-video-renderer'],
  ['/feed/courses', 'courses', 'ytd-course-section-renderer', 'ytd-course-renderer'],
  ['/feed/clips', 'clips', 'ytd-clip-section-renderer', 'ytd-clip-renderer']
];
const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#33777d"/><circle cx="490" cy="160" r="130" fill="#e8c873"/><text x="24" y="190" fill="white" font-size="54" font-family="Arial">Library cover</text></svg>');
const thumbnail = `<ytd-thumbnail data-cover><a href="/watch?v=fixture"><img class="ytThumbnailViewModelCinematic" src="${cover}" alt="Video cover"></a></ytd-thumbnail>`;
const menu = '<button class="ytSpecButtonShapeNextHost more" aria-label="More actions">&#8942;</button>';
function classicCard(tag, index = 0) {
  const drag = tag === 'ytd-playlist-video-renderer' ? '<button class="drag" aria-label="Reorder video">&#8645;</button>' : '';
  return `<${tag} data-card style="background:rgb(28,29,30)!important"><div id="dismissible" data-clear>${drag}${thumbnail}<div id="meta" data-clear><a href="/watch?v=fixture">A library video with a long title that wraps within its native row ${index}</a><p>Channel name · 12K views</p></div>${menu}</div></${tag}>`;
}
function modernCard(nested = false) {
  const lockup = `<yt-lockup-view-model ${nested ? '' : 'data-card'}><div class="ytLockupViewModelHost" data-clear><a class="ytLockupViewModelContentImage" href="/watch?v=fixture"><yt-thumbnail-view-model data-cover><img class="ytThumbnailViewModelCinematic" src="${cover}" alt="Playlist cover"></yt-thumbnail-view-model></a><yt-lockup-metadata-view-model class="ytLockupMetadataViewModelHost ytLockupMetadataViewModelHasMenuButton" data-clear><div class="ytLockupMetadataViewModelTextContainer" data-clear><h3 class="ytLockupMetadataViewModelTitle">Modern collection with enough text to test the menu column</h3><p>Channel · 8 videos</p></div><div class="ytLockupMetadataViewModelMenuButton">${menu}</div></yt-lockup-metadata-view-model></div></yt-lockup-view-model>`;
  return nested ? `<ytd-rich-item-renderer data-card><div id="content" data-clear>${lockup}</div></ytd-rich-item-renderer>` : lockup;
}
function fixture(route) {
  const [, kind, panelTag, cardTag] = route;
  const playlist = ['watch-later', 'liked'].includes(kind);
  const secondary = kind === 'history' ? '<aside id="secondary" data-surface><div id="contents" data-clear><h2>History controls</h2><button class="ytSpecButtonShapeNextHost" id="clear-history">Clear history</button></div></aside>' : '';
  const sidebar = playlist ? `<ytd-playlist-sidebar-renderer id="playlist-sidebar" data-surface><div id="background" data-clear></div><div id="primary" data-clear><img src="${cover}" alt="Playlist artwork"><h2>${kind === 'liked' ? 'Liked videos' : 'Watch later'}</h2><button class="ytSpecButtonShapeNextHost" id="play-all">Play all</button></div></ytd-playlist-sidebar-renderer>` : '';
  const subtype = kind === 'history' ? 'history' : playlist ? 'playlist' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;color:#eee;font:14px Arial} [hidden]{display:none!important}
    ytd-app,ytd-page-manager,ytd-browse,ytd-tabbed-page-header,yt-page-header-portal,yt-page-header-renderer,yt-page-header-view-model,[data-surface],[data-card],[data-clear],ytd-thumbnail,yt-thumbnail-view-model{display:block}
    ytd-tabbed-page-header{padding:20px 24px 0;box-sizing:border-box} yt-page-header-renderer{background:#111} yt-page-header-view-model{padding:8px} h1,h2{margin:0 0 12px} h1{font-size:26px} h2{font-size:18px}
    [data-surface]{background:#181818;border-radius:2px;padding:3px;box-sizing:border-box} [data-clear]{background:#111!important;backdrop-filter:blur(8px)}
    #active{padding:12px 24px;box-sizing:border-box} ytd-two-column-browse-results-renderer{display:flex;align-items:flex-start;gap:20px} #primary-column{flex:1;min-width:0} #secondary,#playlist-sidebar{width:280px;flex-shrink:0}
    #playlist-sidebar{position:relative} #playlist-sidebar #background{position:absolute;inset:0;z-index:-1;background:linear-gradient(#222,#333)!important} #playlist-sidebar #background::before{content:'';position:absolute;inset:0;background:linear-gradient(black,transparent)} #playlist-sidebar img{width:100%;border-radius:4px}
    #panel>#contents{display:flex;flex-direction:column;gap:12px} [data-card]{padding:0;border-radius:2px;box-sizing:content-box;width:100%;background:#222}
    [data-card]>#dismissible{display:flex;align-items:flex-start;gap:10px;width:100%;min-width:0} ytd-thumbnail{flex:0 0 38%;aspect-ratio:16/9;overflow:hidden} ytd-thumbnail a{display:block;width:100%;height:100%} img{display:block;width:100%;height:100%;object-fit:cover}
    [data-card] #meta{flex:1;min-width:0} a{color:inherit;text-decoration:none;line-height:20px} p{font-size:12px;line-height:18px;margin:8px 0} button{cursor:pointer;color:inherit;background:#222;border:0;padding:8px;border-radius:4px} .more{flex:0 0 32px;font-size:22px;width:32px;height:32px;padding:0} .drag{flex:0 0 24px;width:24px;padding:0;height:32px}
    ytd-playlist-video-renderer{height:70px;overflow:visible} ytd-playlist-video-renderer ytd-thumbnail{flex-basis:30%}
    .ytLockupViewModelHost{display:flex;width:100%;gap:12px} .ytLockupViewModelContentImage{display:block;flex:0 0 38%;min-width:0} yt-thumbnail-view-model{aspect-ratio:16/9;width:100%}
    .ytLockupMetadataViewModelHost{position:relative;flex:1;min-width:0} .ytLockupMetadataViewModelTextContainer{width:100%} .ytLockupMetadataViewModelTitle{font-size:16px;line-height:22px;margin:0;padding-right:24px} .ytLockupMetadataViewModelMenuButton{position:absolute;top:0;right:-6px}
    #preview{margin-top:12px;height:30px;position:relative;background:#000} .ytp-progress-bar{height:5px;background:#444} .ytp-play-progress{height:5px;width:40%;background:red} #preview button{height:24px}
    #popup{display:none;position:fixed;inset:140px 24px auto auto;width:180px;height:100px;z-index:5000;padding:12px;background:#111} #popup.open{display:block}
    @media(max-width:800px){ytd-two-column-browse-results-renderer{flex-direction:column} #secondary,#playlist-sidebar{width:100%} #active{padding:12px} ytd-tabbed-page-header{padding:12px 12px 0}}
  </style></head><body><ytd-app>
    <ytd-tabbed-page-header id="header-wrapper"><yt-page-header-portal><yt-page-header-renderer id="library-header" data-surface><yt-page-header-view-model data-clear><h1>${kind}</h1><button id="header-action" class="ytSpecButtonShapeNextHost">Page action</button></yt-page-header-view-model></yt-page-header-renderer></yt-page-header-portal></ytd-tabbed-page-header>
    <ytd-page-manager><ytd-browse id="active" ${subtype ? `page-subtype="${subtype}"` : ''}>
      <ytd-two-column-browse-results-renderer>${sidebar}<div id="primary-column"><${panelTag} id="panel" data-surface><div id="contents" data-clear>
        ${classicCard(cardTag)}${modernCard()}${modernCard(true)}
      </div></${panelTag}><ytd-message-renderer id="empty-state" data-surface>No more items</ytd-message-renderer></div>${secondary}</ytd-two-column-browse-results-renderer>
    </ytd-browse><ytd-browse id="cached" hidden><ytd-playlist-video-renderer id="cached-row" style="background:rgb(10,20,30)!important">Cached row</ytd-playlist-video-renderer></ytd-browse></ytd-page-manager>
    <ytd-popup-container><ytd-menu-popup-renderer id="popup" role="menu"><button role="menuitem">Save to playlist</button></ytd-menu-popup-renderer></ytd-popup-container>
  </ytd-app><script>window.fixtureActions=0;document.addEventListener('click',event=>{if(event.target.closest('.more'))document.querySelector('#popup').classList.add('open');if(event.target.closest('#header-action,#play-all,#clear-history,.drag'))window.fixtureActions++});document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('#popup').classList.remove('open')});</script></body></html>`;
}
async function readLayout(page) {
  return page.evaluate(() => {
    const box = element => {const rect=element.getBoundingClientRect();return {x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height};};
    const visible = element => element.getBoundingClientRect().width > 0;
    const style = element => {const css=getComputedStyle(element);return {background:css.backgroundColor,radius:css.borderRadius,blur:css.backdropFilter,padding:css.padding};};
    return {
      kind:document.documentElement.getAttribute('data-ytc-library'),overflow:document.documentElement.scrollWidth>innerWidth,
      surfaces:[...document.querySelectorAll('[data-surface]')].filter(visible).map(element=>({id:element.id,...box(element),...style(element)})),
      cards:[...document.querySelectorAll('#active [data-card]')].map(element=>({tag:element.localName,...box(element),...style(element),cover:box(element.querySelector('[data-cover]')),coverRadius:getComputedStyle(element.querySelector('[data-cover]')).borderRadius,menu:box(element.querySelector('.more'))})),
      inner:[...document.querySelectorAll('#active [data-clear],#library-header [data-clear]')].map(style),
      artVisible:[...document.querySelectorAll('.ytThumbnailViewModelCinematic')].every(element=>!element.hasAttribute('data-ytc-ambient-blocked')&&getComputedStyle(element).display!=='none'),
      wrapperBlur:getComputedStyle(document.querySelector('#header-wrapper')).backdropFilter,
      cached:document.querySelector('#cached-row').getAttribute('style')
    };
  });
}
function checkLayout(state,kind,width,alpha=.3,blur='blur(12px)') {
  assert.equal(state.kind,kind);assert.equal(state.overflow,false,`${kind} fits at ${width}px`);
  assert.equal(state.wrapperBlur,'none','portaled header wrappers do not add a containing block');
  assert.equal(state.cached,'background:rgb(10,20,30)!important','cached hidden rows are untouched');
  assert.equal(state.artVisible,true,'cover art survives ambient suppression');
  for(const surface of state.surfaces) {
    assert.equal(surface.radius,'16px',`${surface.id} has rounded corners`);assert.equal(surface.blur,blur);
    assert.ok(surface.background.endsWith(alpha===1?'105, 76, 45)':`, ${alpha})`),`${surface.id} follows shared tint and opacity: ${surface.background}`);
    assert.ok(surface.x>=0&&surface.right<=width,`${surface.id} stays within the viewport`);
  }
  const panel=state.surfaces.find(surface=>surface.id==='panel');
  for(const card of state.cards) {
    assert.equal(card.radius,'16px');assert.equal(card.padding,'10px');assert.equal(card.coverRadius,'12px');assert.equal(card.blur,'none','cards share their panel backdrop');
    assert.ok(card.x>=panel.x+12&&card.right<=panel.right-12&&card.bottom<=panel.bottom-12,'native rows stay inside their panel');
    assert.ok(card.cover.x>=card.x+9.5&&card.cover.right<=card.right-9.5&&card.cover.bottom<=card.bottom-9.5,`covers fit the padded row: ${JSON.stringify(card)}`);
    assert.ok(card.menu.right<=card.right-10&&card.menu.bottom<=card.bottom-10,'more-actions controls remain inside their cards');
  }
  assert.ok(state.inner.every(css=>css.background==='rgba(0, 0, 0, 0)'&&css.blur==='none'),'inner layouts are clear without stacked filters');
}
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1440,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),120000);
  try {
    await context.route('https://www.youtube.com/**',route=>{
      const url=new URL(route.request().url());const spec=routes.find(([pathname])=>pathname===url.pathname+url.search)||routes[0];
      return route.fulfill({contentType:'text/html',body:fixture(spec)});
    });
    const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,surfaceColor:'#694c2d',pageColor:'#503e2a',uiOpacity:30,uiBlur:12,progressColor:'#19bca8',progressEffect:'solid'}));
    await popup.evaluate(wallpaper=>chrome.storage.local.set({backgroundImageData:wallpaper}),wallpaper);
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    for(const spec of routes) {
      const [pathname,kind,,cardTag]=spec;
      await page.setViewportSize({width:1440,height:1000});await page.goto('https://www.youtube.com'+pathname);
      await page.waitForSelector('#yt-custom-progress-style',{state:'attached'});
      const native=await page.locator('#active [data-card]').first().evaluate(element=>({style:element.getAttribute('style'),radius:getComputedStyle(element).borderRadius,padding:getComputedStyle(element).padding}));
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image'}));
      await page.waitForFunction(kind=>document.documentElement.getAttribute('data-ytc-library')===kind&&document.querySelector('#panel').hasAttribute('data-ytc-universal-glass'),kind);
      for(const width of [1440,800,390]) {
        await page.setViewportSize({width,height:1000});checkLayout(await readLayout(page),kind,width);
        await page.locator('#active .more').first().click();await page.locator('#popup.open').waitFor();await page.keyboard.press('Escape');
        if(process.env.YTC_SCREENSHOTS&&[1440,390].includes(width))await page.screenshot({path:path.join(os.tmpdir(),`ytc-library-${kind}-${width}.png`),fullPage:true});
      }
      await page.locator('#header-action').click();
      if(kind==='history')await page.locator('#clear-history').click();
      if(['watch-later','liked'].includes(kind)){await page.locator('#play-all').click();await page.locator('.drag').click();}
      assert.ok(await page.evaluate(()=>window.fixtureActions)>0,'native library actions remain clickable');
      await page.locator('#panel>#contents').evaluate((element,markup)=>element.insertAdjacentHTML('beforeend',markup),classicCard(cardTag,1));
      await page.waitForFunction(()=>document.querySelector('#panel [data-card]:last-child').hasAttribute('data-ytc-universal-glass'));
      checkLayout(await readLayout(page),kind,390);
      await page.locator('#panel [data-card]').first().evaluate(element=>element.style.setProperty('background','rgb(4,5,6)','important'));
      await page.waitForFunction(()=>document.querySelector('#panel [data-card]').style.background==='var(--ytc-universal-glass)');
      for(const [opacity,blur] of [[0,0],[70,12],[100,12],[30,12]]) {
        await popup.evaluate(([uiOpacity,uiBlur])=>chrome.storage.sync.set({uiOpacity,uiBlur}),[opacity,blur]);
        await page.waitForFunction(([opacity,blur])=>document.documentElement.style.getPropertyValue('--ytc-ui-opacity')===String(opacity/100)&&document.documentElement.style.getPropertyValue('--ytc-ui-blur')===blur+'px',[opacity,blur]);
        const state=await readLayout(page);checkLayout(state,kind,390,opacity/100,blur?'blur(12px)':'none');
      }
      await page.evaluate(()=>{history.pushState({},'', '/watch?v=fixture');document.querySelector('#active').hidden=true;document.dispatchEvent(new Event('yt-navigate-finish'));});
      await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-library'));
      assert.equal(await page.locator('#panel').evaluate(element=>getComputedStyle(element).borderRadius),'2px','library geometry is released on watch navigation');
      assert.equal(await page.locator('#panel').getAttribute('data-ytc-universal-glass'),null,'library-only panel styles are restored on navigation');
      await page.evaluate(pathname=>{history.pushState({},'',pathname);document.querySelector('#active').hidden=false;document.dispatchEvent(new Event('yt-navigate-finish'));},pathname);
      await page.waitForFunction(()=>document.querySelector('#panel').hasAttribute('data-ytc-universal-glass'));
      checkLayout(await readLayout(page),kind,390);
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,backgroundMode:'color'}));
      await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme')&&!document.documentElement.hasAttribute('data-ytc-library'));
      const restored=await page.locator('#active [data-card]').first().evaluate(element=>({style:element.getAttribute('style'),radius:getComputedStyle(element).borderRadius,padding:getComputedStyle(element).padding}));
      assert.equal(restored.radius,native.radius);assert.equal(restored.padding,native.padding);
      assert.match(restored.style,/background:\s*rgb\(4, 5, 6\)\s*!important/,'latest native inline paint is restored');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: seven library routes; classic/modern/nested cards, portaled headers, history controls, playlist rows, empty states, responsive insets, opacity/blur, menus, lazy cards, cached pages, navigation, and native restoration.');
  } finally {clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
