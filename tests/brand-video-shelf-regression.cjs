// The user's XPath ends at the brand shelf's #visible-video-container. Its cards
// are direct children, unlike ytd-rich-shelf-renderer's rich-item wrappers.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const wallpaper = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
function card(index, modern) {
  const title = ['Paradoxx S26 Stage Clear? by s34n | Pump It Up FINAL BOSS',
    'X-Tream NM NO BAR by s34n | Pump It Up', '1949 D26 Stage Clear!', 'Only OLD SCHOOL Dance Gamers Remember This!'][index % 4];
  const cover = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${['#724a2b', '#287d9a', '#237834', '#9030aa'][index % 4]}"/><text x="32" y="188" fill="white" font-size="54" font-family="Arial">VIDEO ${index + 1}</text></svg>`);
  const thumbnail = `<a class="ytLockupViewModelContentImage" href="#video-${index}"><yt-thumbnail-view-model><img src="${cover}" alt="Video ${index + 1}"></yt-thumbnail-view-model></a>`;
  const avatar = `<a class="avatar" href="#channel-${index}" aria-label="Channel ${index}"><img src="${cover}" alt=""></a>`;
  const text = `<h3 class="ytLockupMetadataViewModelTitle">${title}</h3><p>s34nVideos · 11 days ago</p><span class="members-badge">Members only</span>`;
  const button = `<button class="ytSpecButtonShapeNextHost more" aria-label="More actions for video ${index}">⋮</button>`;
  return modern
    ? `<yt-lockup-view-model data-card><div class="ytLockupViewModelHost ytLockupViewModelVertical">${thumbnail}<yt-lockup-metadata-view-model class="ytLockupMetadataViewModelHost">${avatar}<div class="ytLockupMetadataViewModelTextContainer" data-text>${text}</div><div class="ytLockupMetadataViewModelMenuButton">${button}</div></yt-lockup-metadata-view-model></div></yt-lockup-view-model>`
    : `<ytd-rich-grid-media data-card><div id="dismissible">${thumbnail}<div id="details">${avatar}<div id="meta" data-text>${text}</div><div id="menu"><ytd-menu-renderer>${button}</ytd-menu-renderer></div></div></div></ytd-rich-grid-media>`;
}

function fixture(modern) {
  // IDs, hierarchy, fixed native card widths, negative wrapper margins, start
  // alignment, and the is-expanded row follow YouTube's native brand component.
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font:14px Arial;color:#eee} [hidden]{display:none!important}
    ytd-app,ytd-browse,ytd-rich-grid-renderer,ytd-rich-section-renderer,ytd-menu-renderer,ytd-button-renderer{display:block}
    ytd-rich-grid-renderer{box-sizing:border-box;width:100%;padding:24px}
    ytd-brand-video-shelf-renderer{display:block;border-block:4px solid #333;--ytd-brand-video-shelf-item-width:calc(100% / var(--ytd-rich-grid-items-per-row,6) - 12px)}
    ytd-brand-video-shelf-renderer[rounded-container]{border:none}
    ytd-brand-video-shelf-renderer>#dismissible{position:relative;display:flex;flex-direction:column;align-items:center;margin-inline:-16px;padding-inline:12px;border-radius:8px;overflow:hidden}
    ytd-brand-video-shelf-renderer[is-dismissed]>#dismissible{display:none}
    ytd-brand-video-shelf-renderer:not([is-dismissed])>#dismissed{display:none}
    #content-wrapper{display:flex;flex-direction:column;align-items:center;width:calc(100% + 12px);margin-inline:-6px;background:linear-gradient(#352111,#111)}
    #shelf-header-container{align-self:flex-start;width:100%;margin-left:6px}
    #top-level-header-container{display:flex;justify-content:space-between;width:100%} #section-header-container{width:100%}
    h2{font-size:20px;margin:0 0 4px} #badge{font-size:12px} #subtitle-container{font-size:13px;margin-top:8px}
    #visible-content-wrapper{display:flex;align-items:flex-start;width:100%;margin-bottom:16px}
    #visible-video-container{display:flex;flex:1;align-items:flex-start;width:100%;margin-top:16px}
    #hidden-video-container{display:none;width:100%} ytd-brand-video-shelf-renderer[is-expanded] #hidden-video-container{display:flex;flex-wrap:wrap}
    [data-card]{display:block;align-self:start;flex-shrink:0;height:fit-content;width:var(--ytd-brand-video-shelf-item-width);margin:0 6px 16px;background:#222}
    yt-lockup-view-model{display:flex} .ytLockupViewModelHost{display:flex;flex-direction:column;flex:none;width:360px}
    .ytLockupViewModelContentImage,yt-thumbnail-view-model{display:block;width:100%} yt-thumbnail-view-model{aspect-ratio:16/9}
    yt-thumbnail-view-model img{display:block;width:100%;height:100%;object-fit:cover}
    .ytLockupMetadataViewModelHost,#details{display:flex;position:relative;margin-top:12px;min-width:0}
    .avatar{flex:0 0 36px;width:36px;height:36px;margin-right:12px;border-radius:50%;overflow:hidden} .avatar img{width:100%;height:100%;object-fit:cover}
    .ytLockupMetadataViewModelTextContainer{display:flex;flex-direction:column;min-width:0} #meta{overflow-x:hidden;padding-right:24px}
    h3{font-size:16px;line-height:22px;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}
    p{font-size:12px;line-height:18px;margin:4px 0} .members-badge{font-size:12px;line-height:18px;color:#4ee173}
    .ytLockupMetadataViewModelMenuButton,#menu{position:absolute;top:4px;right:-12px}
    button{color:inherit;border:0;background:#333;cursor:pointer} .more{width:32px;height:32px;padding:0;font-size:24px}
    #show-more-button-container{display:flex;align-self:stretch;justify-content:center;margin-inline:6px}
    #show-more-button{display:flex;justify-content:center;width:100%;max-width:320px;margin-bottom:16px} #show-more-button button{height:40px;width:100%}
    #popup{display:none;position:fixed;inset:100px auto auto 30%;width:200px;height:100px;z-index:3000;padding:12px} #popup.open{display:block}
    @media(max-width:799px){#visible-video-container{display:block} #visible-content-wrapper{margin-top:24px}}
  </style></head><body><ytd-app><ytd-page-manager><ytd-browse page-subtype="home"><ytd-two-column-browse-results-renderer><div><ytd-rich-grid-renderer><div id="contents"><ytd-rich-section-renderer><div id="content">
    <ytd-brand-video-shelf-renderer id="brand" modern rounded-container has-section-header>
      <div id="dismissible"><div id="hidden-shelf-title" hidden></div><div id="content-wrapper">
        <div id="shelf-header-container"><div id="top-level-header-container"><div id="section-header-container"><h2>Get more from memberships</h2><span id="badge">YouTube featured</span></div><div id="top-buttons-container"></div></div><div id="subtitle-container">Enjoy perks like members-only videos and much more</div></div>
        <div id="visible-content-wrapper"><div id="metadata-container" hidden></div><div id="visible-video-container">${Array.from({length:4},(_,i)=>card(i,modern)).join('')}</div></div>
        <div id="hidden-video-container">${Array.from({length:4},(_,i)=>card(i+4,modern)).join('')}</div><div id="bottom-button-container" hidden></div>
      </div><div id="show-more-button-container"><ytd-button-renderer id="show-more-button"><button class="ytSpecButtonShapeNextHost">Show more</button></ytd-button-renderer></div><div id="dismiss-button"></div></div><div id="dismissed">Dismissed</div>
    </ytd-brand-video-shelf-renderer>
  </div></ytd-rich-section-renderer></div></ytd-rich-grid-renderer></div></ytd-two-column-browse-results-renderer></ytd-browse></ytd-page-manager>
  <ytd-popup-container><ytd-menu-popup-renderer id="popup" role="menu"><button role="menuitem">Save to playlist</button></ytd-menu-popup-renderer></ytd-popup-container></ytd-app>
  <script>
    document.querySelector('#show-more-button button').addEventListener('click',event=>{const expanded=document.querySelector('#brand').toggleAttribute('is-expanded');event.target.textContent=expanded?'Show less':'Show more'});
    document.addEventListener('click',event=>{if(event.target.closest('.more'))document.querySelector('#popup').classList.add('open')});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelector('#popup').classList.remove('open')});
  </script></body></html>`;
}

async function state(page) {
  return page.evaluate(()=>{
    const box=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const host=document.querySelector('#brand'),grid=host.querySelector('#visible-video-container');
    const appearance=el=>{const s=getComputedStyle(el);return{radius:s.borderRadius,border:s.borderTopWidth,background:s.backgroundColor,blur:s.backdropFilter}};
    return{host:{...box(host),...appearance(host)},grid:box(grid),header:box(host.querySelector('#shelf-header-container')),
      title:appearance(host.querySelector('#section-header-container')),footer:box(host.querySelector('#show-more-button button')),
      wrappers:[...host.querySelectorAll(':scope > #dismissible, #content-wrapper, #visible-content-wrapper, #visible-video-container, #hidden-video-container')].map(appearance),
      cards:[...host.querySelectorAll('[data-card]')].filter(el=>el.getBoundingClientRect().width>0).map(el=>({...box(el),...appearance(el),
        thumbnail:{...box(el.querySelector('yt-thumbnail-view-model')),...appearance(el.querySelector('yt-thumbnail-view-model'))},
        text:box(el.querySelector('[data-text]')),menu:box(el.querySelector('.more')),avatar:box(el.querySelector('.avatar'))})),
      hiddenDisplay:getComputedStyle(host.querySelector('#hidden-video-container')).display,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};
  });
}

function check(s,count) {
  assert.equal(s.overflow,false,'no horizontal overflow');
  assert.equal(s.host.radius,'16px');assert.equal(s.host.border,'1px');assert.equal(s.host.blur,'blur(12px)');
  assert.equal(s.title.border,'1px');assert.equal(s.title.radius,'12px');
  assert.equal(s.cards.length,count,'native collapsed/expanded visibility survives');
  assert.ok(s.header.x>=s.host.x+12&&s.header.right<=s.host.right-12,'header stays inset');
  assert.ok(s.footer.bottom<=s.host.bottom-12,'Show more stays inside the panel');
  assert.ok(Math.abs((s.footer.x+s.footer.right)-(s.host.x+s.host.right))<2,`Show more is centered: ${JSON.stringify({host:s.host,footer:s.footer})}`);
  for(const wrapper of s.wrappers){assert.equal(wrapper.background,'rgba(0, 0, 0, 0)','wrappers share one backdrop');assert.equal(wrapper.blur,'none');}
  const rows=new Map();
  for(const c of s.cards){
    assert.equal(c.radius,'16px');assert.equal(c.border,'1px');assert.equal(c.blur,'none');assert.equal(c.thumbnail.radius,'12px');
    assert.ok(c.x>=s.host.x+12&&c.right<=s.host.right-12&&c.bottom<=s.host.bottom-12,'card stays inside the panel');
    assert.ok(c.thumbnail.x>=c.x+10&&c.thumbnail.right<=c.right-10,'thumbnail stays inset');
    assert.ok(Math.abs(c.thumbnail.width/c.thumbnail.height-16/9)<.01,'video aspect ratio is preserved');
    assert.ok(c.menu.width>=40&&c.menu.height>=40&&c.menu.right<=c.right-10,'menu has an inset click target');
    assert.ok(c.avatar.right<=c.text.x&&c.text.right<=c.menu.x,'avatar, title, badge and menu do not overlap');
    const key=Math.round(c.y);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(c);
  }
  for(const row of rows.values())for(const c of row){assert.ok(Math.abs(c.height-row[0].height)<1,'equal card heights per row');assert.ok(Math.abs(c.width-row[0].width)<1,'equal card widths');}
}

(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1776,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),60000);
  try{
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(route.request().url().includes('modern'))}));
    const cdp=await context.browser().newBrowserCDPSession();const{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage();await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    for(const modern of [false,true]){
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,backgroundMode:'color',surfaceColor:'#745532',pageColor:'#684722',uiOpacity:30,uiBlur:12,videosPerRow:6}));
      await page.goto('https://www.youtube.com/?brand='+(modern?'modern':'classic'));
      await page.waitForFunction(()=>document.querySelector('#yt-custom-progress-style'));
      const original=await page.locator('#brand').evaluate(el=>({radius:getComputedStyle(el).borderRadius,style:el.getAttribute('style')||'',wrapper:el.querySelector('#content-wrapper').getAttribute('style')||''}));
      assert.equal(await page.locator('#brand').evaluate(el=>document.evaluate('./div[1]/div[2]/div[2]/div[2]',el,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue.id),'visible-video-container','fixture follows the reported XPath');
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:true}));
      await page.waitForFunction(()=>document.querySelector('#brand').hasAttribute('data-ytc-universal-glass'));
      for(const width of [1776,1440,800,390]){
        await page.setViewportSize({width,height:1000});check(await state(page),4);
        assert.equal((await state(page)).hiddenDisplay,'none','collapsed cards stay hidden');
        await page.locator('.more:visible').first().click();await page.locator('#popup.open').waitFor();await page.keyboard.press('Escape');
        await page.locator('#show-more-button button').click();check(await state(page),8);
        await page.locator('#show-more-button button').click();check(await state(page),4);
        if(process.env.YTC_SCREENSHOTS&&[1776,390].includes(width))await page.locator('#brand').screenshot({path:path.join(os.tmpdir(),`ytc-brand-${modern?'modern':'classic'}-${width}.png`)});
      }
      await page.setViewportSize({width:1776,height:1000});
      await popup.evaluate(()=>chrome.storage.sync.set({videosPerRow:2}));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#visible-video-container')).gridTemplateColumns.split(' ').length===2);
      check(await state(page),4);
      await popup.evaluate(async image=>{await chrome.storage.local.set({backgroundImageData:image});await chrome.storage.sync.set({videosPerRow:6,backgroundMode:'image'});},wallpaper);
      await page.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-home-glass'));check(await state(page),4);
      await page.locator('#visible-video-container').evaluate((el,html)=>el.insertAdjacentHTML('beforeend',html),card(8,modern));
      await page.waitForFunction(()=>[...document.querySelectorAll('#visible-video-container>[data-card]')].every(el=>el.hasAttribute('data-ytc-universal-glass')));
      check(await state(page),5);
      await page.locator('#visible-video-container>[data-card]').last().evaluate(el=>el.remove());
      await page.locator('#visible-video-container').evaluate(el=>el.hidden=true);
      assert.equal(await page.locator('#visible-video-container').evaluate(el=>getComputedStyle(el).display),'none','hidden row is never forced visible');
      await page.locator('#visible-video-container').evaluate(el=>el.hidden=false);check(await state(page),4);
      await popup.evaluate(()=>chrome.storage.sync.set({uiOpacity:0}));
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#brand')).borderTopColor==='rgba(255, 255, 255, 0)');
      await page.locator('#brand').evaluate(el=>el.setAttribute('is-dismissed',''));
      assert.equal(await page.locator('#brand>#dismissible').evaluate(el=>getComputedStyle(el).display),'none','native dismissal survives');
      await page.locator('#brand').evaluate(el=>el.removeAttribute('is-dismissed'));
      await popup.evaluate(()=>chrome.storage.sync.set({themeEnabled:false,backgroundMode:'color'}));
      await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme'));
      assert.deepEqual(await page.locator('#brand').evaluate(el=>({radius:getComputedStyle(el).borderRadius,style:el.getAttribute('style')||'',wrapper:el.querySelector('#content-wrapper').getAttribute('style')||''})),original,'theme disable restores native surfaces');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: brand shelf XPath, direct classic/modern cards, rounded single-backdrop panel, equal row heights, native expansion/dismissal/hidden states, 1776/1440/800/390px, menu clicks, dynamic cards, columns, wallpaper, opacity and restoration.');
  }finally{clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
