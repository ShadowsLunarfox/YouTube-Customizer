// Exercises the actual popup controls, page overrides, section flow and backup files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const sandbox = vm.createContext({ URL });
vm.runInContext(fs.readFileSync(path.join(root, 'settings.js'), 'utf8'), sandbox);
const api = sandbox.YTCustomizer;
const gif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
assert.equal(api.pageScope('https://www.youtube.com/'), 'home');
assert.equal(api.pageScope('https://www.youtube.com/watch?v=x'), 'watch');
assert.equal(api.pageScope('https://www.youtube.com/live_chat?v=x'), 'watch');
assert.equal(api.pageScope('https://music.youtube.com/watch?v=x'), 'music');
assert.equal(api.pageScope('https://www.youtube.com/feed/history'), 'shared');
assert.equal(api.pageScope('https://youtube.com.evil.invalid/'), 'shared');
assert.equal(api.normalize({cardRadius:999,cardGap:-10}).cardRadius,32);
assert.equal(api.normalize({cardRadius:999,cardGap:-10}).cardGap,4);
assert.equal(api.resolveSettings({pageColor:'#111111'},{home:{enabled:true,settings:{pageColor:'#222222'}}},'home').pageColor,'#222222');
assert.equal(api.resolveSettings({pageColor:'#111111'},{home:{enabled:false,settings:{pageColor:'#222222'}}},'home').pageColor,'#111111');
assert.equal(api.resolveAssets({backgroundImageData:gif},{home:{backgroundImageData:''}},{home:{enabled:true}},'home').backgroundImageData,'');
for(const change of [value=>value.schemaVersion=9,value=>value.settings.pageColor='url(https://evil.invalid)',
  value=>value.assets={backgroundImageData:'https://evil.invalid/image.png'},value=>value.pageProfiles={home:{enabled:true,settings:{uiOpacity:null}}}]){
  const backup=JSON.parse(JSON.stringify(api.createBackup({}, {}, {}, {}, false)));change(backup);
  assert.throws(()=>api.parseBackup(JSON.stringify(backup)));
}
assert.equal(api.parseBackup(JSON.stringify(api.createBackup({cardRadius:9},{home:{enabled:true,settings:{uiOpacity:70}}},{backgroundImageData:gif},{},true))).settings.cardRadius,9);
const hiddenBackup=api.parseBackup(JSON.stringify(api.createBackup({hideHomeSingleVideo:true},{home:{enabled:true,settings:{hideHomeSingleVideo:false,hideHomePlayables:true}}},{},{},false)));
assert.equal(hiddenBackup.settings.hideHomeSingleVideo,true);
assert.equal(hiddenBackup.pageProfiles.home.settings.hideHomeSingleVideo,false);
assert.equal(hiddenBackup.pageProfiles.home.settings.hideHomePlayables,true);
assert.equal(api.parseBackup(JSON.stringify({format:'youtube-customizer',schemaVersion:1,settings:{hideHomeFeatured:true}})).settings.hideHomeSingleVideo,false,'older backups keep working without the new switch');

function video(i, tag = 'ytd-rich-grid-media') {
  return `<${tag} data-video><yt-thumbnail-view-model><img src="${gif}" alt="Video ${i}"></yt-thumbnail-view-model><h3 class="ytLockupMetadataViewModelTitle">${i===0?'A long video title that wraps onto several lines to exercise consistent card heights':'Video '+i}</h3></${tag}>`;
}
const native = `<style>
  body{margin:0;font:14px Arial;background:#111;color:#eee} [hidden]{display:none!important}
  ytd-app,ytd-page-manager,ytd-browse,ytd-rich-grid-renderer,ytd-rich-grid-row,ytd-rich-section-renderer,ytd-rich-shelf-renderer,ytd-brand-video-shelf-renderer,ytd-brand-video-singleton-renderer,ytd-statement-banner-renderer,ytd-rich-grid-media,yt-lockup-view-model,yt-thumbnail-view-model,ytmusic-app,ytmusic-carousel-shelf-renderer,ytmusic-two-row-item-renderer{display:block}
  ytd-rich-grid-renderer{padding:24px;box-sizing:border-box;width:100%} ytd-rich-grid-renderer>#contents{display:flex;flex-wrap:wrap}
  ytd-rich-grid-row{width:100%} ytd-rich-grid-row>#contents{display:flex;align-items:flex-start}
  ytd-rich-item-renderer{display:block;box-sizing:border-box;width:calc(100% / var(--ytd-rich-grid-items-per-row,4) - 12px);margin:0 6px 24px}
  ytd-rich-section-renderer{width:100%;display:flex} ytd-rich-section-renderer>#content{width:100%;min-width:0}
  yt-thumbnail-view-model{aspect-ratio:16/9;width:100%;overflow:hidden} yt-thumbnail-view-model img{display:block;width:100%;height:100%;object-fit:cover}
  h3{font-size:16px;line-height:22px;margin:8px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  ytd-rich-shelf-renderer>#dismissible{position:relative;padding-bottom:30px;margin-bottom:30px}
  ytd-rich-shelf-renderer #contents{display:flex;flex-wrap:wrap} .button-container{position:absolute;bottom:0;left:50%;transform:translate(-50%,50%);width:360px}
  button{min-height:32px;color:inherit;background:#333;border:0;cursor:pointer} .button-container button{width:100%}
  ytd-mini-game-card-view-model{display:block;padding:8px}
  ytd-brand-video-shelf-renderer #visible-content-wrapper{display:flex} ytd-brand-video-shelf-renderer #visible-video-container{display:flex;width:100%}
  #related{width:420px;max-width:100%;margin:20px} #related [data-video]{width:100%}
  ytmusic-app{padding:24px} ytmusic-carousel-shelf-renderer #items{display:flex;align-items:start}
  ytmusic-two-row-item-renderer{box-sizing:border-box;width:220px;flex:none;margin-right:16px} .image-wrapper{aspect-ratio:1} .image-wrapper img{width:100%;height:100%}
  ytmusic-responsive-list-item-renderer{display:flex;--ytmusic-list-item-height:48px;height:48px;box-sizing:border-box}
  ytmusic-responsive-list-item-renderer .left-items{width:var(--ytmusic-responsive-list-item-thumbnail-size,48px);height:var(--ytmusic-responsive-list-item-thumbnail-size,48px);flex:none}
</style>`;
const homeBody = `<ytd-app><ytd-page-manager><ytd-browse page-subtype="home"><ytd-rich-grid-renderer><div id="contents">
  <ytd-rich-grid-row><div id="contents">${Array.from({length:4},(_,i)=>`<ytd-rich-item-renderer id="card-${i}"><div id="content">${video(i)}</div></ytd-rich-item-renderer>`).join('')}</div></ytd-rich-grid-row>
  <ytd-rich-section-renderer id="playables-section"><div id="content"><ytd-rich-shelf-renderer is-playables><div id="dismissible"><div id="rich-shelf-header">Playables</div><div id="contents-container"><div id="contents"><ytd-rich-item-renderer><ytd-mini-game-card-view-model>Game</ytd-mini-game-card-view-model></ytd-rich-item-renderer></div></div><div class="button-container"><button>Show more</button></div></div></ytd-rich-shelf-renderer></div></ytd-rich-section-renderer>
  <ytd-rich-section-renderer id="single-video-section"><div id="content"><ytd-brand-video-singleton-renderer><div id="dismissible"><div id="spatial-heading" hidden>Featured video</div><div id="content-wrapper"><div id="thumbnail-container">${video(6)}</div><div id="metadata-container"><div id="metadata-text-container">Watch with Premium</div></div></div></div></ytd-brand-video-singleton-renderer></div></ytd-rich-section-renderer>
  <ytd-rich-section-renderer id="image-promo-section"><div id="content"><ytd-statement-banner-renderer><div id="dismissible">Premium image promotion</div></ytd-statement-banner-renderer></div></ytd-rich-section-renderer>
  <ytd-rich-section-renderer id="featured-section"><div id="content"><ytd-brand-video-shelf-renderer><div id="dismissible"><div id="content-wrapper"><div id="shelf-header-container"><div id="section-header-container">Memberships</div></div><div id="visible-content-wrapper"><div id="metadata-container" hidden></div><div id="visible-video-container">${video(5,'yt-lockup-view-model')}</div></div></div></div></ytd-brand-video-shelf-renderer></div></ytd-rich-section-renderer>
  <ytd-rich-section-renderer id="topics-section"><div id="content"><ytd-chips-shelf-with-video-shelf-renderer>Topic recommendations</ytd-chips-shelf-with-video-shelf-renderer></div></ytd-rich-section-renderer>
  <ytd-rich-section-renderer id="shopping-section"><div id="content"><ytd-brand-video-shelf-renderer has-sku-view-model><div id="dismissible">Shopping recommendations</div></ytd-brand-video-shelf-renderer></div></ytd-rich-section-renderer>
</div></ytd-rich-grid-renderer></ytd-browse></ytd-page-manager></ytd-app>`;
const watchBody = `<ytd-app><ytd-watch-flexy><div id="related"><ytd-watch-next-secondary-results-renderer><div id="items">${video(0,'yt-lockup-view-model')}</div></ytd-watch-next-secondary-results-renderer></div></ytd-watch-flexy></ytd-app>`;
const musicBody = `<ytmusic-app><ytmusic-carousel-shelf-renderer><div id="items">${Array.from({length:2},(_,i)=>`<ytmusic-two-row-item-renderer><div class="image-wrapper"><img src="${gif}" alt="Album ${i}"></div><div class="details"><a class="title">Album ${i}</a></div></ytmusic-two-row-item-renderer>`).join('')}</div></ytmusic-carousel-shelf-renderer><ytmusic-responsive-list-item-renderer height-style="MUSIC_RESPONSIVE_LIST_ITEM_HEIGHT_MEDIUM_COMPACT"><div class="left-items"></div><span>Compact song row</span></ytmusic-responsive-list-item-renderer></ytmusic-app>`;

(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:1440,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),120000);
  try{
    await context.route('https://**.youtube.com/**',route=>{
      const url=new URL(route.request().url());
      const body=url.hostname==='music.youtube.com'?musicBody:url.pathname==='/watch'?watchBody:homeBody;
      return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8">'+native+'</head><body>'+body+'</body></html>'});
    });
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const popup=await context.newPage(),home=await context.newPage();await home.goto('https://www.youtube.com/');
    const errors=[];popup.on('pageerror',e=>errors.push(e.message));home.on('pageerror',e=>errors.push(e.message));
    await popup.goto('chrome-extension://'+id+'/popup.html');await popup.waitForSelector('#settings-form:not([inert])');
    async function edit(key,value){
      await popup.evaluate(({key,value})=>{const el=document.getElementById(key);if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},{key,value});
    }
    async function scope(value){await popup.locator('#editingScope').selectOption(value);await popup.waitForFunction(()=>!document.querySelector('#editingScope').disabled);assert.equal(await popup.locator('#editingScope').inputValue(),value);}
    async function waitColor(page,color){await page.waitForFunction(color=>document.querySelector('#yt-custom-progress-style').textContent.includes(color),color);}
    async function activateHome(){await popup.evaluate(async()=>{const tabs=await chrome.tabs.query({url:'https://www.youtube.com/'});await chrome.tabs.update(tabs[0].id,{active:true});});}
    await activateHome();await edit('themeEnabled',true);await edit('pageColor','#112233');
    await popup.locator('#tab-layout').click();await edit('customizeCards',true);
    const geometrySettings={cardRadius:24,cardBorderWidth:3,cardPadding:14,cardGap:20,shelfSpacing:22,cardTitleLines:3,videosPerRow:4};
    for(const[key,value]of Object.entries(geometrySettings))await edit(key,value);
    await home.waitForFunction(()=>getComputedStyle(document.querySelector('#card-0')).borderTopWidth==='3px');
    for(const width of [1440,800,390]){
      await home.setViewportSize({width,height:1000});
      const geometry=await home.evaluate(()=>{
        const cards=[...document.querySelectorAll('ytd-rich-grid-row ytd-rich-item-renderer')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{y:r.y,width:r.width,height:r.height,padding:s.padding,radius:s.borderRadius,border:s.borderTopWidth}});
        return{cards,gap:getComputedStyle(document.querySelector('ytd-rich-grid-renderer>#contents')).gap,overflow:document.documentElement.scrollWidth>innerWidth,lines:getComputedStyle(document.querySelector('#card-0 h3')).webkitLineClamp};
      });
      assert.equal(geometry.overflow,false);assert.equal(geometry.gap,'20px');assert.equal(geometry.lines,'3');
      for(const card of geometry.cards){assert.equal(card.radius,'24px');assert.equal(card.padding,'14px');assert.equal(card.border,'3px');for(const peer of geometry.cards.filter(p=>p.y===card.y))assert.ok(Math.abs(peer.height-card.height)<1);}
    }
    await home.setViewportSize({width:1440,height:1000});
    await edit('equalCardHeights',false);
    await home.waitForFunction(()=>getComputedStyle(document.querySelector('#card-0 h3')).minHeight==='0px');
    assert.ok(await home.locator('#card-0').evaluate(el=>el.getBoundingClientRect().height>document.querySelector('#card-1').getBoundingClientRect().height),'equal-height can be turned off');
    await edit('equalCardHeights',true);
    for(const[key,section]of Object.entries({hideHomeSingleVideo:'single-video-section',hideHomePlayables:'playables-section',hideHomeFeatured:'featured-section',hideHomeTopicShelves:'topics-section',hideHomeShopping:'shopping-section'})){
      await edit(key,true);await home.waitForFunction(id=>getComputedStyle(document.getElementById(id)).display==='none',section);
      if(key==='hideHomeSingleVideo'||key==='hideHomePlayables'){
        for(const other of [key==='hideHomeSingleVideo'?'playables-section':'single-video-section','featured-section','image-promo-section'])assert.notEqual(await home.locator('#'+other).evaluate(el=>getComputedStyle(el).display),'none','individual switches leave other Home sections visible');
      }
      if(key==='hideHomeFeatured')assert.notEqual(await home.locator('#shopping-section').evaluate(el=>getComputedStyle(el).display),'none','shopping has its own toggle');
      await edit(key,false);await home.waitForFunction(id=>getComputedStyle(document.getElementById(id)).display!=='none',section);
    }
    await edit('themeEnabled',false);await edit('hideHomePlayables',true);
    await home.waitForFunction(()=>getComputedStyle(document.querySelector('#playables-section')).display==='none');
    await edit('hideHomePlayables',false);await edit('themeEnabled',true);
    await popup.locator('#hideHomeSingleVideo').check();await popup.locator('#hideHomePlayables').check();
    await home.waitForFunction(()=>['single-video-section','playables-section'].every(id=>getComputedStyle(document.getElementById(id)).display==='none'));
    await popup.waitForFunction(async()=>{const s=await chrome.storage.sync.get(['hideHomeSingleVideo','hideHomePlayables']);return s.hideHomeSingleVideo&&s.hideHomePlayables});
    assert.equal(await home.locator('#single-video-section').evaluate(el=>el.getBoundingClientRect().height),0,'hidden single-video section leaves no feed height');
    assert.equal(await home.locator('#playables-section').evaluate(el=>el.getBoundingClientRect().height),0,'hidden Playables section leaves no feed height');
    await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');await popup.locator('#tab-layout').click();
    assert.equal(await popup.locator('#hideHomeSingleVideo').isChecked(),true);assert.equal(await popup.locator('#hideHomePlayables').isChecked(),true);
    assert.equal(await popup.locator('#layout-panel fieldset').first().locator('legend').textContent(),'Home sections','the requested switches are easy to find at the top');
    await edit('themeEnabled',false);
    assert.equal(await home.locator('#single-video-section').evaluate(el=>getComputedStyle(el).display),'none','single-video hide works with the theme off');
    await popup.locator('#reset').click();
    await home.waitForFunction(()=>['single-video-section','playables-section'].every(id=>getComputedStyle(document.getElementById(id)).display!=='none'));
    assert.equal(await popup.locator('#hideHomeSingleVideo').isChecked(),false);assert.equal(await popup.locator('#hideHomePlayables').isChecked(),false);
    await edit('customizeCards',true);
    for(const[key,value]of Object.entries(geometrySettings))await edit(key,value);
    await edit('themeEnabled',true);

    await popup.locator('#tab-appearance').click();await popup.locator('#backgroundImage').setInputFiles({name:'shared.gif',mimeType:'image/gif',buffer:Buffer.from(gif.split(',')[1],'base64')});
    await popup.waitForFunction(()=>!document.querySelector('#settings-form').inert&&!document.querySelector('#removeBackground').hidden);
    await popup.locator('#removeBackground').click();
    await popup.waitForFunction(async()=>!document.querySelector('#settings-form').inert&&(await chrome.storage.local.get('backgroundImageData')).backgroundImageData===undefined);
    await popup.locator('#tab-player').click();await popup.locator('#customIcon').setInputFiles({name:'icon.gif',mimeType:'image/gif',buffer:Buffer.from(gif.split(',')[1],'base64')});
    await popup.waitForFunction(()=>!document.querySelector('#settings-form').inert&&!document.querySelector('#removeCustomIcon').hidden);
    await popup.locator('#removeCustomIcon').click();
    await popup.waitForFunction(async()=>!document.querySelector('#settings-form').inert&&(await chrome.storage.local.get('customIconData')).customIconData===undefined);

    await scope('home');await popup.locator('#tab-appearance').click();await edit('pageColor','#345678');
    await popup.waitForFunction(async()=>(await chrome.storage.local.get('pageProfiles')).pageProfiles?.home?.enabled);
    assert.equal(await popup.evaluate(async()=>(await chrome.storage.sync.get('pageColor')).pageColor),'#112233','page edits do not overwrite shared settings');
    await waitColor(home,'#345678');
    await popup.locator('#tab-layout').click();await edit('cardRadius',8);await edit('hideHomePlayables',true);await edit('hideHomeSingleVideo',true);
    assert.equal(await popup.evaluate(async()=>(await chrome.storage.sync.get('hideHomeSingleVideo')).hideHomeSingleVideo),false,'Home-specific hiding preserves the shared switch');
    await home.waitForFunction(()=>getComputedStyle(document.querySelector('#single-video-section')).display==='none');
    await popup.locator('#tab-appearance').click();await popup.locator('#backgroundImage').setInputFiles({name:'home.gif',mimeType:'image/gif',buffer:Buffer.from(gif.split(',')[1],'base64')});
    await popup.waitForFunction(async()=>(await chrome.storage.local.get('pageAssets')).pageAssets?.home?.backgroundImageData?.startsWith('data:image/gif;'));
    await home.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-custom-background'));
    await scope('watch');await edit('pageColor','#5a2340');await edit('uiOpacity',65);
    await popup.locator('#tab-layout').click();await edit('cardRadius',20);
    await scope('music');await popup.locator('#tab-appearance').click();await edit('pageColor','#234a55');await edit('uiOpacity',82);
    await popup.locator('#tab-layout').click();await edit('cardRadius',12);
    const musicImage=await popup.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=2;c.getContext('2d').fillRect(0,0,2,2);return c.toDataURL('image/png')});
    await popup.locator('#tab-appearance').click();await popup.locator('#backgroundImage').setInputFiles({name:'music.png',mimeType:'image/png',buffer:Buffer.from(musicImage.split(',')[1],'base64')});
    await popup.waitForFunction(async()=>(await chrome.storage.local.get('pageAssets')).pageAssets?.music?.backgroundImageData?.startsWith('data:image/png;'));
    await waitColor(home,'#345678');assert.equal(await home.locator('#card-0').evaluate(el=>getComputedStyle(el).borderRadius),'8px');
    await scope('shared');

    const watch=await context.newPage();await watch.goto('https://www.youtube.com/watch?v=profile-fixture');await waitColor(watch,'#5a2340');
    assert.equal(await watch.locator('html').evaluate(el=>el.style.getPropertyValue('--ytc-ui-opacity')),'0.65');
    assert.equal(await watch.locator('[data-video]').first().evaluate(el=>getComputedStyle(el).borderRadius),'20px');
    const music=await context.newPage();await music.goto('https://music.youtube.com/');await waitColor(music,'#234a55');
    assert.equal(await music.locator('html').evaluate(el=>el.style.getPropertyValue('--ytc-ui-opacity')),'0.82');
    assert.equal(await music.locator('ytmusic-two-row-item-renderer').first().evaluate(el=>getComputedStyle(el).borderRadius),'12px');
    assert.equal(await music.locator('ytmusic-responsive-list-item-renderer').evaluate(el=>el.getBoundingClientRect().height),48,'compact music rows keep their native height');
    assert.equal(await music.locator('ytmusic-responsive-list-item-renderer .left-items').evaluate(el=>el.getBoundingClientRect().height),30,'artwork fits between custom padding and borders');
    await music.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-custom-background'));
    const other=await context.newPage();await other.goto('https://www.youtube.com/feed/history');await waitColor(other,'#112233');await other.close();
    await home.evaluate(()=>{history.pushState({},'', '/watch?v=spa');document.querySelector('ytd-browse').hidden=true;document.dispatchEvent(new Event('yt-navigate-finish'));});await waitColor(home,'#5a2340');
    await home.evaluate(()=>{history.pushState({},'', '/');document.querySelector('ytd-browse').hidden=false;window.dispatchEvent(new PopStateEvent('popstate'));});await waitColor(home,'#345678');
    await activateHome();await popup.reload();await popup.waitForSelector('#settings-form:not([inert])');
    assert.equal(await popup.locator('#editingScope').inputValue(),'home','reopening the popup selects the active page override');
    assert.equal(await popup.locator('#pageColor').inputValue(),'#345678','page settings persist across popup reopening');
    await popup.locator('#pageProfileEnabled').uncheck();await waitColor(home,'#112233');
    await popup.locator('#pageProfileEnabled').check();await waitColor(home,'#345678');

    await scope('shared');await popup.locator('#tab-backup').click();
    const downloadPromise=popup.waitForEvent('download');await popup.locator('#exportSettings').click();const download=await downloadPromise;
    const backupPath=path.join(os.tmpdir(),'ytc-configuration-backup.json');await download.saveAs(backupPath);
    const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));
    assert.equal(backup.settings.pageColor,'#112233');assert.equal(backup.pageProfiles.home.settings.pageColor,'#345678');
    assert.equal(backup.settings.hideHomeSingleVideo,false);assert.equal(backup.pageProfiles.home.settings.hideHomeSingleVideo,true);assert.equal(backup.pageProfiles.home.settings.hideHomePlayables,true);
    assert.equal(backup.pageProfiles.watch.settings.uiOpacity,65);assert.equal(backup.pageProfiles.music.settings.uiOpacity,82);
    assert.equal(backup.pageAssets.home.backgroundImageData,gif);assert.equal(backup.pageAssets.music.backgroundImageData,musicImage);
    const storageSnapshot=()=>popup.evaluate(async()=>JSON.stringify(await Promise.all([chrome.storage.sync.get(null),chrome.storage.local.get(null)])));
    const beforeInvalid=await storageSnapshot();
    await popup.locator('#backupFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"something-else"}')});
    await popup.waitForFunction(()=>!document.querySelector('#settings-form').inert&&document.querySelector('#status').classList.contains('error'));
    assert.equal(await storageSnapshot(),beforeInvalid,'invalid imports do not mutate storage');
    const unreadable=JSON.parse(JSON.stringify(backup));unreadable.assets.backgroundImageData='data:image/png;base64,AAAA';
    await popup.locator('#backupFile').setInputFiles({name:'unreadable.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(unreadable))});
    await popup.waitForFunction(()=>!document.querySelector('#settings-form').inert&&document.querySelector('#status').textContent.includes('unreadable'));
    assert.equal(await storageSnapshot(),beforeInvalid,'unreadable media does not mutate storage');
    await popup.locator('#tab-appearance').click();await edit('pageColor','#aa3344');
    await popup.locator('#tab-backup').click();await popup.locator('#backupFile').setInputFiles(backupPath);
    await popup.waitForFunction(async()=>!document.querySelector('#settings-form').inert&&(await chrome.storage.sync.get('pageColor')).pageColor==='#112233');
    await home.waitForFunction(()=>getComputedStyle(document.querySelector('#single-video-section')).display==='none');
    assert.equal(await popup.evaluate(async()=>(await chrome.storage.local.get('pageAssets')).pageAssets.music.backgroundImageData),musicImage);
    await popup.locator('#includeBackupMedia').uncheck();const settingsDownloadPromise=popup.waitForEvent('download');await popup.locator('#exportSettings').click();
    const settingsDownload=await settingsDownloadPromise,settingsPath=path.join(os.tmpdir(),'ytc-configuration-settings-only.json');await settingsDownload.saveAs(settingsPath);
    const settingsOnly=JSON.parse(fs.readFileSync(settingsPath,'utf8'));assert.equal(Object.hasOwn(settingsOnly,'assets'),false);assert.equal(Object.hasOwn(settingsOnly,'pageAssets'),false);
    settingsOnly.settings.pageColor='#abcdef';
    await popup.locator('#backupFile').setInputFiles({name:'settings-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(settingsOnly))});
    await popup.waitForFunction(async()=>!document.querySelector('#settings-form').inert&&(await chrome.storage.sync.get('pageColor')).pageColor==='#abcdef');
    assert.equal(await popup.evaluate(async()=>(await chrome.storage.local.get('pageAssets')).pageAssets.home.backgroundImageData),gif,'settings-only imports preserve media');

    await popup.setViewportSize({width:480,height:720});
    for(const selectedScope of ['shared','home','watch','music']){
      await scope(selectedScope);
      for(const tab of ['appearance','layout','backup']){
        await popup.locator('#tab-'+tab).click();
        const size=await popup.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.querySelector('.panel').getBoundingClientRect().height,overflow:[...document.querySelectorAll('.field,.scope-controls,.tabs')].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+1).map(el=>el.className)}));
        assert.ok(size.width<=480,'popup has no horizontal scroll');assert.ok(size.height<=600,'popup fits the browser height limit: '+size.height);assert.deepEqual(size.overflow,[]);
        if(process.env.YTC_SCREENSHOTS&&selectedScope==='home')await popup.screenshot({path:path.join(os.tmpdir(),`ytc-configuration-${tab}.png`)});
      }
    }
    await popup.locator('#resetAll').click();await home.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme'));
    assert.equal(await popup.evaluate(async()=>Object.keys((await chrome.storage.local.get('pageProfiles')).pageProfiles).length),0,'Reset all clears page overrides');
    assert.deepEqual(errors,[]);
    console.log('PASS: card geometry/title lines/columns, independent single-video and Playables UI switches, no reserved hidden space, saved/reopened switches, theme-off hiding, Layout reset, Home override and backup compatibility, shared/Home/Watch/Music settings and media, SPA switches, full/settings-only backup files, invalid imports, 480px popup and reset.');
  }finally{clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
