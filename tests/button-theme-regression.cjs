// A visual/style audit across native button generations and page-owned tools.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const wav = Buffer.alloc(44 + 16000 * 2);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const native = `<button id="plain" data-audit>Plain</button><button id="inline" data-audit style="background:black!important;color:black!important">Inline</button>
  <yt-icon-button id="legacy-wrap"><button id="legacy" data-audit><svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"></path></svg><span style="color:black">Legacy</span></button></yt-icon-button>
  <tp-yt-paper-button id="paper" data-audit role="button">Classic paper button</tp-yt-paper-button><div id="role-button" role="button" tabindex="0" data-audit>Role button</div>
  <a id="link-button" role="button" href="#" data-audit>Link button</a><input id="input-button" type="button" value="Input" data-audit>
  <button class="ytSpecButtonShapeNextHost ytSpecButtonShapeNextFilled" id="filled" data-audit><span class="ytSpecButtonShapeNextButtonTextContent">Filled</span></button>
  <button class="ytSpecButtonShapeNextHost ytSpecButtonShapeNextOutline" id="outline" data-audit>Outline</button><button id="disabled" disabled data-audit>Disabled</button><button id="pressed" aria-pressed="true" data-audit>Pressed</button>
  <tp-yt-paper-tab id="tab" role="tab" aria-selected="true" data-audit>Tab</tp-yt-paper-tab>
  <tp-yt-paper-item id="paper-item" role="link" data-audit>Classic menu link</tp-yt-paper-item><ytd-guide-entry-renderer id="sidebar" data-audit><a href="#">Sidebar</a></ytd-guide-entry-renderer>`;
const fixture = music => `<!doctype html><meta charset="utf-8"><style>
body{margin:16px;background:#534355;color:#112233;font:14px/20px Arial}ytd-app,ytd-watch-flexy,ytd-watch-metadata,ytd-masthead,ytmusic-app,ytmusic-player-bar,ytmusic-carousel-shelf-renderer{display:block}
button,input[type=button],tp-yt-paper-button,tp-yt-paper-tab,a[role=button],div[role=button]{display:inline-block;box-sizing:border-box;padding:8px;margin:3px;min-height:32px;border:1px solid #666;border-radius:8px;background:white;color:black;cursor:pointer}
button:disabled{opacity:.5}svg{width:14px;height:14px;fill:currentColor}yt-icon-button{display:inline-block;background:black}#buttons{display:flex;justify-content:flex-end;height:48px}#background{position:absolute;inset:0;height:48px;pointer-events:none}ytd-masthead{position:relative;height:48px}
#movie_player{position:relative;width:640px;height:360px;margin-top:18px;background:#222}video{width:100%;height:100%}.ytp-chrome-bottom{position:absolute;bottom:0;width:100%}.ytp-right-controls{display:flex}#movie_player .ytp-button{width:42px;height:36px;padding:0}.ytp-progress-bar-container{position:absolute;bottom:42px;width:100%;height:8px}.ytp-scrubber-button{position:absolute;width:16px;height:16px}.ytp-subtitles-button::after{content:'';display:block;width:12px;height:3px;background:red}
tp-yt-paper-dialog{display:block;width:540px;padding:8px}.ytp-popup{display:block;padding:8px}yt-chip-cloud-renderer{display:block;margin:8px}yt-chip-cloud-chip-renderer{display:inline-block;background:white}#chip-container{display:inline-block;background:white}
</style>${music ? `<ytmusic-app><ytmusic-carousel-shelf-renderer>${native.replace('background:black!important;color:black!important','background:black;color:black')}<div id="next-items-button"><button id="music-next" data-audit>Next</button></div></ytmusic-carousel-shelf-renderer><ytmusic-player-bar><button id="music-play" data-audit>Play</button></ytmusic-player-bar></ytmusic-app>` : `<ytd-app><ytd-masthead><div id="background"></div><div id="end"><div id="buttons"><ytd-topbar-menu-button-renderer><button id="avatar-btn">A</button></ytd-topbar-menu-button-renderer></div></div></ytd-masthead><ytd-watch-flexy><ytd-watch-metadata>${native}</ytd-watch-metadata><div id="related"><ytd-watch-next-secondary-results-renderer><yt-chip-cloud-renderer><yt-chip-cloud-chip-renderer selected><div id="chip-container">Selected chip</div></yt-chip-cloud-chip-renderer><yt-chip-cloud-chip-renderer><button id="chip-button" data-audit>Nested chip</button></yt-chip-cloud-chip-renderer></yt-chip-cloud-renderer><button id="related-button" data-audit>Related</button></ytd-watch-next-secondary-results-renderer></div>
<tp-yt-paper-dialog role="dialog"><button id="popup-button" data-audit>Popup action</button><div id="menu-item" role="menuitem" tabindex="0" data-audit>Menu action</div></tp-yt-paper-dialog>
<div class="html5-video-player" id="movie_player"><video src="/silence.wav" preload="auto" muted></video><div class="ytp-progress-bar-container"><div class="ytp-scrubber-button"></div></div><div class="ytp-chrome-bottom"><div class="ytp-left-controls"><button class="ytp-button ytp-play-button" id="player-play" data-audit>▶</button><a href="#" class="ytp-button" id="player-next" data-audit>Next</a><button class="ytp-button ytp-subtitles-button" id="captions" data-audit>CC</button></div><div class="ytp-right-controls"></div></div><div class="ytp-popup"><div role="menuitem" id="player-menu" data-audit>Quality</div></div></div><yt-live-chat-app id="chat-panel"></yt-live-chat-app><p id="ordinary-text">Ordinary page text</p></ytd-watch-flexy></ytd-app>`}
<script>const chat=document.querySelector('#chat-panel');if(chat)chat.attachShadow({mode:'open'}).innerHTML='<div id="contents"><button>Send</button><tp-yt-paper-button role="button">Chat action</tp-yt-paper-button></div>';window.auditClicks=0;document.addEventListener('click',e=>{if(e.target.closest('[data-audit]:not(:disabled)')){e.preventDefault();auditClicks++}})</script>`;
const snapshot = page => page.locator('[data-audit]').evaluateAll(es => es.map(e => {const s=getComputedStyle(e),r=e.getBoundingClientRect();return {id:e.id,color:s.color,bg:s.backgroundColor,image:s.backgroundImage,blur:s.backdropFilter,width:r.width,height:r.height}}));
(async () => {
  const settingsView = vm.createContext({URL,location:{href:'chrome-extension://settings/popup.html'},
    YTCustomizerContent:new Proxy({}, {get(){throw Error('YouTube page styles accessed in settings view')}})});
  vm.runInContext(fs.readFileSync(path.join(root,'settings.js'),'utf8'),settingsView);
  await vm.runInContext(fs.readFileSync(path.join(root,'yt.js'),'utf8'),settingsView);
  const context = await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1440,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline = setTimeout(() => void context.close(),120000), errors=[];
  context.on('page',p => p.on('pageerror',e => errors.push(e.message)));
  try {
    await context.route('https://*.youtube.com/**',r => r.request().url().endsWith('/silence.wav') ? r.fulfill({contentType:'audio/wav',body:wav}) : r.fulfill({contentType:'text/html',body:fixture(r.request().url().includes('music.youtube.com'))}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const admin=await context.newPage();await admin.goto(`chrome-extension://${id}/popup.html`);await admin.waitForFunction(()=>initialized);
    const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=button-audit');await page.waitForSelector('ytc-settings-entry');await page.waitForSelector('ytc-bookmark-markers');
    await page.locator('#movie_player').evaluate(e=>e.setAttribute('role','button'));
    const before=await snapshot(page);
    await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,textColor:'#112233',surfaceColor:'#253449',uiOpacity:42,uiBlur:12}));
    await page.waitForSelector('#plain[data-ytc-universal-glass]');
    const styled=await snapshot(page);console.log('Button audit:',JSON.stringify({checked:styled.length,whiteLabels:styled.filter(b=>b.color==='rgb(255, 255, 255)').length}));
    assert.deepEqual(await page.locator('#movie_player').evaluate(e=>({background:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter})),{background:'rgb(34, 34, 34)',blur:'none'},'the video surface is never a glass button');
    for(const button of styled){assert.equal(button.color,'rgb(255, 255, 255)',button.id+': white text');assert.notEqual(button.image,'linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0))');}
    for(const name of ['plain','inline','legacy','paper','role-button','input-button','player-play'])assert.equal(styled.find(b=>b.id===name).blur,'blur(12px)',name+': own glass');
    for(const name of ['popup-button','related-button','player-menu'])assert.equal(styled.find(b=>b.id===name).blur,'none',name+': shares its panel blur');
    assert.equal(await page.locator('#legacy-wrap').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','legacy wrapper stays clear');
    assert.equal(await page.locator('#chip-button').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','a nested chip button has only one fill');
    const chipFill=await page.locator('#chip-button').evaluate(e=>getComputedStyle(e.parentElement).backgroundColor);
    await page.locator('#chip-button').evaluate(e=>e.parentElement.setAttribute('role','tab'));
    await page.waitForFunction(()=>document.querySelector('#chip-button').parentElement.style.color.includes('--ytc-button-text'));
    assert.equal(await page.locator('#chip-button').evaluate(e=>getComputedStyle(e.parentElement).backgroundColor),chipFill,'a semantic chip wrapper keeps its one glass surface');
    assert.equal(await page.locator('#captions').evaluate(e=>getComputedStyle(e,'::after').backgroundColor),'rgb(255, 0, 0)','native caption-state mark survives');
    assert.equal(await page.locator('#ordinary-text').evaluate(e=>getComputedStyle(e).color),'rgb(17, 34, 51)','page text keeps its setting');
    for(const b of before){const next=styled.find(x=>x.id===b.id);assert.equal(next.width,b.width,b.id+': width unchanged');assert.equal(next.height,b.height,b.id+': height unchanged');}
    await page.locator('#plain').click();await page.locator('#paper').click();assert.equal(await page.evaluate(()=>auditClicks),2);
    await page.locator('#plain').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('#inline').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
    await page.locator('#inline').evaluate(e=>{e.style.setProperty('background','black','important');e.style.setProperty('color','black','important')});
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#inline')).color==='rgb(255, 255, 255)');
    await page.locator('#legacy-wrap').evaluate(e=>{const b=document.createElement('button');b.id='late-button';b.textContent='Late';e.append(b)});await page.waitForSelector('#late-button[data-ytc-universal-glass]');
    assert.equal(await page.locator('#late-button').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
    await page.evaluate(()=>{const wrapper=document.createElement('yt-icon-button');wrapper.id='late-nested-wrap';wrapper.style.cssText='width:40px;height:40px';wrapper.append(document.createElement('span'));document.body.append(wrapper)});
    await page.waitForSelector('#late-nested-wrap[data-ytc-universal-glass]');
    await page.locator('#late-nested-wrap span').evaluate(e=>{const button=document.createElement('button');button.id='nested-late-button';button.textContent='Late';e.append(button)});
    await page.waitForSelector('#late-nested-wrap[data-ytc-universal-clear]');
    assert.equal(await page.locator('#nested-late-button').evaluate(e=>getComputedStyle(e).backdropFilter),'blur(12px)','a late nested button owns the only blur');
    const entry=page.locator('ytc-settings-entry button');assert.equal(await entry.evaluate(e=>getComputedStyle(e).backdropFilter),'blur(12px)');
    const chat=page.locator('#chat-panel');await page.waitForFunction(()=>document.querySelector('#chat-panel').shadowRoot.querySelector('[data-ytc-live-chat-surface]'));
    assert.equal(await chat.locator('button,tp-yt-paper-button').evaluateAll(es=>es.every(e=>getComputedStyle(e).color==='rgb(255, 255, 255)'&&getComputedStyle(e).backdropFilter==='none')),true,'chat shadow buttons keep white text and share their panel blur');
    assert.equal(await chat.locator('#contents').evaluate(e=>getComputedStyle(e).backdropFilter),'blur(12px)');
    await page.locator('ytc-bookmark-markers #bookmark-add').click();
    const note=page.locator('ytc-video-bookmarks');await note.locator('#bookmark-panel').waitFor();
    assert.equal(await note.locator('button:visible').evaluateAll(es=>es.every(e=>getComputedStyle(e).color==='rgb(255, 255, 255)'&&getComputedStyle(e).backdropFilter==='blur(12px)')),true,'timeline-note actions share the button policy');
    await note.locator('#bookmark-close').click();
    await admin.evaluate(()=>chrome.storage.local.set({'videoBookmarks:button-audit':{schemaVersion:1,points:[{id:'audit-pin',time:.5,note:'Pin',createdAt:1}]}}));
    await page.waitForSelector('ytc-bookmark-markers .pin');
    assert.deepEqual(await page.locator('ytc-bookmark-markers .pin').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter})),{bg:'rgba(0, 0, 0, 0)',blur:'none'},'timeline pins keep their glyph instead of painting a glass rectangle');
    await admin.evaluate(()=>chrome.storage.sync.set({uiOpacity:0,uiBlur:0}));await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--ytc-ui-opacity')==='0');
    for(const b of await snapshot(page)){assert.equal(b.blur,'none',b.id+': blur off');const channels=b.bg.match(/[\d.]+/g).map(Number);assert.equal(channels.length===4?channels[3]:1,0,b.id+': opacity off');}
    await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:false}));await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-ytc-theme'));
    await page.waitForFunction(()=>!document.querySelector('#plain').hasAttribute('data-ytc-universal-glass'));
    const restored=await snapshot(page);for(const b of before){const after=restored.find(x=>x.id===b.id);assert.deepEqual(after,b,b.id+': native style restoration');}
    await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,uiOpacity:42,uiBlur:12}));
    const music=await context.newPage();await music.goto('https://music.youtube.com/');await music.waitForFunction(()=>document.documentElement.hasAttribute('data-ytc-theme'));
    const musicButtons=await snapshot(music);for(const b of musicButtons)assert.equal(b.color,'rgb(255, 255, 255)',b.id+': Music white text');
    assert.equal(await music.locator('#music-play').evaluate(e=>getComputedStyle(e).backdropFilter),'none','player-bar buttons share the Music surface');
    assert.equal(await music.locator('#music-next').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)','carousel child shares one capsule');
    await music.locator('#next-items-button').evaluate(e=>e.setAttribute('role','button'));
    assert.equal(await music.locator('#next-items-button').evaluate(e=>getComputedStyle(e).backdropFilter),'blur(12px)','a semantic carousel wrapper keeps its one glass surface');
    // Settings controls retain their independent light/dark design.
    await admin.evaluate(()=>menuTheme.setPreference('light'));assert.notEqual(await admin.locator('#reset').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 255)');
    assert.deepEqual(errors,[]);
    console.log('PASS: native/legacy/role/player/dialog/Music/chat/owned buttons, white labels, single glass layers, inline repair, geometry/click/focus/state preservation, opacity/blur, full restoration, and independent settings UI.');
  }finally{clearTimeout(deadline);await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
