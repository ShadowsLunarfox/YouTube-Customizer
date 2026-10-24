// Playables must reserve space in the feed before and after native expansion.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const wallpaper = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const cover = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#3c7865"/><circle cx="80" cy="80" r="45" fill="#dba444"/></svg>');
function game(index, artwork) {
  const title = ['One-Way Maze: Tap Grid Puzzle', 'Gym Boss', '2048 Shooter: Number Match', 'My Army Base', 'My Mini Mart', 'Ludo King'][index % 6];
  const content = `${artwork ? `<img class="cover" src="${cover}" alt="${title}">` : ''}<div class="metadata"><a class="game-link" href="#game-${index}"><h3>${title}</h3><span>2.1M plays</span></a><button class="ytSpecButtonShapeNextHost more" aria-label="More actions for game ${index}">⋮</button></div>`;
  const hidden = index >= 6 ? 'hidden' : '';
  if (index % 3 === 2) return `<ytd-mini-game-card-view-model data-game ${hidden}>${content}</ytd-mini-game-card-view-model>`;
  const host = index % 3 === 1 ? 'div' : 'ytd-rich-item-renderer';
  return `<${host} class="ytdRichItemRendererHost" data-game ${hidden}><div id="content"><ytd-mini-game-card-view-model>${content}</ytd-mini-game-card-view-model></div></${host}>`;
}
function fixture(artwork) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:14px Arial;color:#eee} [hidden]{display:none!important}
    ytd-app,ytd-browse,ytd-rich-grid-renderer{display:block} ytd-rich-grid-renderer{box-sizing:border-box;padding:24px;width:100%}
    #feed{display:flex;flex-wrap:wrap;width:100%;--ytd-rich-grid-row-margin:40px}
    .video-row{box-sizing:border-box;width:100%;height:96px;background:#35444c}
    ytd-rich-section-renderer{width:100%;display:flex;justify-content:center}
    ytd-rich-section-renderer>#content{width:100%;min-width:0;margin:0 6px}
    ytd-rich-shelf-renderer{display:flex;width:100%;--ytd-rich-grid-shelf-margin:60px;background:#222}
    ytd-rich-shelf-renderer>#dismissible{position:relative;width:100%;margin-bottom:57px;padding-bottom:37px;border-bottom:1px solid #444}
    ytd-rich-shelf-renderer[is-dismissed]>#dismissible{display:none} ytd-rich-shelf-renderer:not([is-dismissed])>#dismissed{display:none}
    ytd-rich-shelf-renderer #rich-shelf-header{display:flex;justify-content:space-between;margin:0 0 20px 8px}
    h2{display:flex;align-items:center;font-size:20px;line-height:28px;margin:0} #icon{margin-right:8px}
    #title-container{display:flex;flex-direction:column} #subtitle{font-size:12px;line-height:18px}
    #menu-container{display:flex;align-items:center;gap:8px}
    ytd-rich-shelf-renderer #contents-container{margin-top:-12px}
    ytd-rich-shelf-renderer #contents{display:flex;flex-wrap:wrap;margin:0 -6px -12px;padding:12px 0}
    [data-game]{display:block;box-sizing:border-box;align-self:start;width:calc(100% / var(--ytd-rich-grid-mini-game-cards-per-row,6) - 12px);margin:0 6px 24px;background:#333;border-radius:12px}
    ytd-mini-game-card-view-model{display:block;max-width:100%;width:100%}
    .metadata{display:flex;align-items:flex-start;gap:8px;padding:8px} .game-link{flex:1;min-width:0;color:inherit;text-decoration:none}
    h3{font-size:14px;line-height:20px;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .game-link span{font-size:12px;line-height:18px;color:#ccc} .cover{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:cover;border-radius:8px}
    button{cursor:pointer;color:inherit;background:#333;border:0;border-radius:999px;min-height:32px} .more{width:28px;padding:0;font-size:22px;flex-shrink:0}
    ytd-rich-shelf-renderer>.button-container{position:absolute}
    .button-container{position:absolute;bottom:0;left:50%;transform:translate(-50%,50%);width:360px;max-width:100%;background:#111}
    .expand-collapse-button{display:flex;justify-content:center;width:100%;max-width:360px} .expand-collapse-button button{width:100%;height:40px}
    #ordinary{margin-top:16px;padding:3px;border-radius:2px} #ordinary>#dismissible{margin:0;padding:0;border:0}
    #popup{display:none;position:fixed;left:35%;top:100px;width:180px;padding:12px;z-index:3000} #popup.open{display:block}
  </style></head><body><ytd-app><ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="feed">
    <div id="previous-video" class="video-row">Previous videos</div>
    <ytd-rich-section-renderer id="games-section"><div id="content"><ytd-rich-shelf-renderer id="games" is-playables has-expansion-button show-bottom-divider>
      <div id="dismissible"><div id="rich-shelf-header-container"><div id="rich-shelf-header"><h2><span id="icon">🔴</span><span id="title-container"><span id="title">YouTube Playables</span><span id="subtitle">Instant games, no downloads</span></span></h2><div id="menu-container"><button id="view-all">View all</button><button id="close" aria-label="Dismiss Playables">×</button></div></div></div>
        <div id="contents-container"><div id="contents">${Array.from({length:12},(_,i)=>game(i,artwork)).join('')}</div></div>
        <div class="button-container"><ytd-button-renderer class="expand-collapse-button"><button id="expand" class="ytSpecButtonShapeNextHost">Show more</button></ytd-button-renderer></div>
        <div class="button-container" hidden><ytd-button-renderer class="expand-collapse-button"><button>Hidden control</button></ytd-button-renderer></div>
      </div><div id="dismissed">Dismissed</div>
    </ytd-rich-shelf-renderer></div></ytd-rich-section-renderer>
    <div id="following-video" class="video-row">Following videos</div>
    <ytd-rich-shelf-renderer id="ordinary"><div id="dismissible">Ordinary video shelf</div></ytd-rich-shelf-renderer>
  </div></ytd-rich-grid-renderer></ytd-browse><ytd-popup-container><ytd-menu-popup-renderer id="popup" role="menu"><button role="menuitem">Hide this game</button></ytd-menu-popup-renderer></ytd-popup-container></ytd-app>
  <script>
    document.querySelector('#expand').addEventListener('click',event=>{const expanded=document.querySelector('#games').toggleAttribute('is-expanded');document.querySelectorAll('[data-game]').forEach((el,i)=>el.hidden=i>=6&&!expanded);event.target.textContent=expanded?'Show less':'Show more'});
    document.addEventListener('click',event=>{if(event.target.closest('.more'))document.querySelector('#popup').classList.add('open');if(event.target.closest('.game-link'))document.body.dataset.gameClicked='yes'});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('#popup').classList.remove('open')});
    document.querySelector('#close').addEventListener('click',()=>document.querySelector('#games').setAttribute('is-dismissed',''));
  </script></body></html>`;
}
async function state(page) {
  return page.evaluate(()=>{
    const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const panel=document.querySelector('#games'),style=getComputedStyle(panel);
    return{panel:{...box(panel),padding:style.padding,radius:style.borderRadius,blur:style.backdropFilter},
      previous:box(document.querySelector('#previous-video')),following:box(document.querySelector('#following-video')),
      footer:{...box(panel.querySelector('#expand')),position:getComputedStyle(panel.querySelector('.button-container')).position},
      header:box(panel.querySelector('#rich-shelf-header')),controls:box(panel.querySelector('#menu-container')),
      gridGap:getComputedStyle(panel.querySelector('#contents')).gap,
      cards:[...panel.querySelectorAll('[data-game]')].filter(el=>el.getBoundingClientRect().width>0).map(el=>({
        ...box(el),padding:getComputedStyle(el).padding,blur:getComputedStyle(el).backdropFilter,
        artwork:el.querySelector('.cover')?box(el.querySelector('.cover')):null})),
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};
  });
}
function check(s,count,artwork) {
  assert.equal(s.overflow,false,'no horizontal overflow');assert.equal(s.cards.length,count);
  assert.ok(s.panel.y-s.previous.bottom>=16,'the shelf reserves space above for videos');
  assert.ok(s.following.y-s.panel.bottom>=16,'the shelf reserves space below for videos');
  assert.equal(s.panel.padding,'10px 12px');assert.equal(s.panel.radius,'16px');assert.equal(s.panel.blur,'blur(12px)');
  assert.equal(s.footer.position,'static');assert.equal(s.footer.height,32);assert.ok(s.footer.width<=280);
  assert.ok(s.footer.bottom<=s.panel.bottom-10,'footer contributes to the panel height');assert.equal(s.gridGap,'12px');
  assert.ok(s.header.x>=s.panel.x+12&&s.controls.right<=s.panel.right-12,'header and controls stay inset');
  const rows=new Map();
  for(const c of s.cards){
    assert.equal(c.padding,'8px');assert.equal(c.blur,'none','cards share the outer backdrop');
    assert.ok(c.x>=s.panel.x+12&&c.right<=s.panel.right-12&&c.bottom<=s.footer.y,'cards stay inset above the footer');
    if(artwork)assert.ok(c.artwork.width>0&&Math.abs(c.artwork.width-c.artwork.height)<1,'game artwork stays visible and square');
    const row=Math.round(c.y);if(!rows.has(row))rows.set(row,[]);rows.get(row).push(c);
  }
  for(const row of rows.values())for(const c of row){assert.ok(Math.abs(c.height-row[0].height)<1,'game cards have equal row heights');assert.ok(Math.abs(c.width-row[0].width)<1,'game cards have equal widths');}
}

(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:2333,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),60000);
  try{
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(route.request().url().includes('artwork'))}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    for(const artwork of [false,true]){
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,backgroundMode:'color',surfaceColor:'#745532',pageColor:'#684722',uiOpacity:30,uiBlur:12,videosPerRow:6}));
      await page.setViewportSize({width:2333,height:1000});await page.goto('https://www.youtube.com/?playables='+(artwork?'artwork':'text'));
      await page.waitForFunction(()=>document.querySelector('#yt-custom-progress-style'));
      const original=await state(page);
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:true}));
      await page.waitForFunction(()=>document.querySelector('#games>#dismissible').hasAttribute('data-ytc-universal-clear'));
      assert.ok((await state(page)).panel.height<original.panel.height,'compact spacing reduces the original panel height');
      for(const width of [2333,1440,800,390]){
        await page.setViewportSize({width,height:1000});check(await state(page),6,artwork);
        await page.locator('.more:visible').first().click();await page.locator('#popup.open').waitFor();await page.keyboard.press('Escape');
        await page.locator('#expand').click();check(await state(page),12,artwork);
        await page.locator('#expand').click();check(await state(page),6,artwork);
        assert.equal(await page.locator('.button-container[hidden]').evaluate(el=>getComputedStyle(el).display),'none','unused native controls stay hidden');
        if(process.env.YTC_SCREENSHOTS&&[2333,390].includes(width))await page.screenshot({path:path.join(os.tmpdir(),`ytc-playables-${artwork?'artwork':'text'}-${width}.png`),fullPage:true});
      }
      await page.setViewportSize({width:2333,height:1000});
      await page.locator('.game-link:visible').first().click();assert.equal(await page.locator('body').getAttribute('data-game-clicked'),'yes','games stay clickable');
      await popup.evaluate(async image=>{await chrome.storage.local.set({backgroundImageData:image});await chrome.storage.sync.set({backgroundMode:'image',videosPerRow:2});},wallpaper);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-home-glass')&&getComputedStyle(document.querySelector('#games #contents')).gridTemplateColumns.split(' ').length===2);
      check(await state(page),6,artwork);
      await page.locator('#games').evaluate(el=>el.removeAttribute('is-playables'));check(await state(page),6,artwork);
      await page.locator('#games').evaluate(el=>el.querySelectorAll('ytd-mini-game-card-view-model').forEach(game=>game.remove()));
      await page.waitForFunction(()=>!document.querySelector('#games>#dismissible').hasAttribute('data-ytc-universal-clear'));
      assert.equal(await page.locator('#games-section').evaluate(el=>getComputedStyle(el).padding),'0px','recycled non-game shelves release the extra feed spacing');
      await page.locator('#games').evaluate(el=>el.setAttribute('is-playables',''));
      await page.waitForFunction(()=>document.querySelector('#games>#dismissible').hasAttribute('data-ytc-universal-clear'));
      await page.locator('#games').evaluate(el=>el.removeAttribute('is-playables'));
      await page.waitForFunction(()=>!document.querySelector('#games>#dismissible').hasAttribute('data-ytc-universal-clear'));
      // The first game can arrive inside an existing rich-item placeholder.
      await page.locator('#games ytd-rich-item-renderer>#content').first().evaluate(el=>el.innerHTML='<ytd-mini-game-card-view-model>Late game</ytd-mini-game-card-view-model>');
      await page.waitForFunction(()=>document.querySelector('#games>#dismissible').hasAttribute('data-ytc-universal-clear'));
      assert.equal(await page.locator('#games ytd-rich-item-renderer').first().evaluate(el=>getComputedStyle(el).backdropFilter),'none','late game data updates existing card backdrops');
      await page.locator('#games #contents').evaluate((el,html)=>el.innerHTML=html,Array.from({length:12},(_,i)=>game(i,artwork)).join(''));
      await page.waitForFunction(()=>[...document.querySelectorAll('#games [data-game]')].every(el=>el.hasAttribute('data-ytc-universal-glass')));
      check(await state(page),6,artwork);
      assert.equal(await page.locator('#ordinary').evaluate(el=>getComputedStyle(el).padding),'3px','ordinary video shelves keep their spacing');
      await page.locator('#close').click();assert.equal(await page.locator('#games>#dismissible').evaluate(el=>getComputedStyle(el).display),'none','dismissal remains native');
      await page.locator('#games').evaluate(el=>el.removeAttribute('is-dismissed'));
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,backgroundMode:'color',videosPerRow:6}));
      await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme'));
      assert.equal(await page.locator('#games').evaluate(el=>getComputedStyle(el).padding),'0px','theme disable restores native padding');
      assert.equal(await page.locator('#games-section').evaluate(el=>getComputedStyle(el).padding),'0px','theme disable restores native feed spacing');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: Playables reserves 16px above/below adjacent videos, compact inset cards and 32px in-flow footer, collapsed/expanded/dismissed states, artwork, native and modern hosts, 2333/1440/800/390px, late/recycled game data, clicks, column settings, wallpaper and restoration.');
  }finally{clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
