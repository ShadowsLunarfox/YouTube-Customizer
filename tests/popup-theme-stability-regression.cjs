// Opening/focusing the menu is a read-only operation. An iframe's stale reply
// must never restart the correctly themed main document.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const image='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const fixture=`<!doctype html><html><head><style>
  body{margin:0;background:#111;color:white} ytd-app,ytd-masthead,ytd-watch-flexy{display:block}
  ytd-masthead{height:50px;background:#111}#movie_player{width:640px;height:360px;background:#111}
  .ytp-play-progress{height:5px;width:50%;background:red}ytd-comments{display:block;background:#111;padding:20px}
  iframe{width:300px;height:120px}
</style></head><body><ytd-app><ytd-masthead><div id="background">Header</div></ytd-masthead><ytd-watch-flexy>
  <div id="movie_player" class="html5-video-player"><video muted></video><div class="ytp-play-progress"></div></div>
  <ytd-comments id="panel">Comments</ytd-comments><ytd-live-chat-frame><iframe src="/live_chat?v=stability"></iframe></ytd-live-chat-frame>
</ytd-watch-flexy></ytd-app></body></html>`;
const chat='<!doctype html><html><body><yt-live-chat-app><yt-live-chat-renderer><div id="contents">Chat</div></yt-live-chat-renderer></yt-live-chat-app></body></html>';
async function ready(page){await page.waitForSelector('#settings-form:not([inert])')}
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1200,height:900},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),90000),errors=[];
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  try{
    await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:route.request().url().includes('/live_chat')?chat:fixture}));
    const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
    const controller=await context.newPage();await controller.goto('chrome-extension://'+id+'/popup.html');await ready(controller);
    await controller.evaluate(async image=>{
      await chrome.storage.local.set({backgroundImageData:image,pageProfiles:{watch:{enabled:true,settings:{themeEnabled:true,surfaceColor:'#325877',uiOpacity:43,uiBlur:9,backgroundMode:'image'}}}});
      await chrome.storage.sync.set({themeEnabled:true,backgroundMode:'image',progressColor:'#a15cd3',surfaceColor:'#173645',uiOpacity:28});
    },image);
    const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=theme-stability');
    await page.waitForFunction(()=>document.querySelector('#ytc-background-image'));
    const tab=await controller.evaluate(async()=>{const[tab]=await chrome.tabs.query({url:'https://www.youtube.com/watch?v=theme-stability'});await chrome.tabs.update(tab.id,{active:true});return tab});
    // Recreate real frame-response contention: delay the main script's ping,
    // while a child frame replies immediately with another script version.
    await controller.evaluate(async tabId=>{
      await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>{
        globalThis.__ytProgressCustomizer.dispose();
        const event=chrome.runtime.onMessage,add=event.addListener.bind(event),remove=event.removeListener.bind(event),wrapped=new Map();
        globalThis.__menuMessages={ping:0,preview:0,dispose:0};
        event.addListener=listener=>{
          const handler=(message,sender,reply)=>{
            if(message?.type==='YT_PROGRESS_PING'){__menuMessages.ping++;setTimeout(()=>listener(message,sender,response=>reply(
              __menuMessages.forceVersion?{...response,version:__menuMessages.forceVersion}:response)),60);return true}
            if(message?.type==='YT_PROGRESS_LIVE_PREVIEW')__menuMessages.preview++;
            return listener(message,sender,reply);
          };wrapped.set(listener,handler);add(handler);
        };
        event.removeListener=listener=>{remove(wrapped.get(listener)||listener);wrapped.delete(listener)};
        globalThis.__listenerPatched=event.addListener.toString().includes('__menuMessages');
      }});
      await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},files:['yt.js']});
      await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:()=>{
        if(window===window.top){const instance=globalThis.__ytProgressCustomizer,dispose=instance.dispose;instance.dispose=function(){__menuMessages.dispose++;return dispose.call(this)}}
        else{globalThis.__childMenuMessages={ping:0,preview:0};chrome.runtime.onMessage.addListener((message,sender,reply)=>{
          if(message?.type==='YT_PROGRESS_PING'){__childMenuMessages.ping++;reply({version:'stale-frame',applied:true});return false}
          if(message?.type==='YT_PROGRESS_LIVE_PREVIEW')__childMenuMessages.preview++;
        })}
      }});
    },tab.id);
    await page.waitForFunction(()=>document.querySelector('#ytc-background-image')&&document.documentElement.style.getPropertyValue('--ytc-ui-opacity')==='0.43');
    await page.evaluate(()=>{
      const background=document.querySelector('#ytc-background-image'),style=document.querySelector('style#yt-custom-progress-style');
      const panel=document.querySelector('#panel'),progress=document.querySelector('.ytp-play-progress');
      const original={background:background.style.backgroundImage,panel:getComputedStyle(panel).backgroundColor,progress:getComputedStyle(progress).backgroundColor};
      globalThis.__themeGuard={removed:[],frames:0,badFrames:[],running:true,background,style,original};
      const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.removedNodes)if(node===background||node===style)__themeGuard.removed.push(node.id)});
      observer.observe(document.documentElement,{childList:true,subtree:true});__themeGuard.observer=observer;
      function sample(){if(!__themeGuard.running)return;__themeGuard.frames++;
        if(!background.isConnected||!style.isConnected||!document.documentElement.hasAttribute('data-ytc-theme')||
          background.style.backgroundImage!==original.background||getComputedStyle(panel).backgroundColor!==original.panel||
          getComputedStyle(progress).backgroundColor!==original.progress)__themeGuard.badFrames.push(__themeGuard.frames);
        requestAnimationFrame(sample);
      }requestAnimationFrame(sample);
    });
    async function openMenu(){
      await controller.evaluate(tabId=>chrome.tabs.update(tabId,{active:true}),tab.id);
      const pending=context.waitForEvent('page');
      await controller.evaluate(windowId=>chrome.tabs.create({windowId,active:false,url:chrome.runtime.getURL('popup.html')}),tab.windowId);
      const menu=await pending;await ready(menu);
      await menu.waitForFunction(()=>!document.querySelector('#status').textContent.includes('Loading'));
      return menu;
    }
    for(let i=0;i<4;i++){
      const menu=await openMenu();
      await menu.waitForFunction(()=>['Applied','Ready','Connected','Refresh YouTube and try again'].includes(document.querySelector('#status').textContent));
      await menu.evaluate(()=>window.dispatchEvent(new Event('focus')));await ready(menu);
      await menu.close();
    }
    const countsBeforeEdit=await controller.evaluate(async tabId=>{
      const[{result}]=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>({...__menuMessages,patched:__listenerPatched})});return result;
    },tab.id);
    const stable={...countsBeforeEdit,...await page.evaluate(()=>({
        removed:__themeGuard.removed,badFrames:__themeGuard.badFrames,frames:__themeGuard.frames,
        backgroundSame:document.querySelector('#ytc-background-image')===__themeGuard.background,
        styleSame:document.querySelector('style#yt-custom-progress-style')===__themeGuard.style
      }))};
    assert.equal(stable.patched,true,'real main-frame replies are delayed in this fixture');
    assert.ok(stable.ping>=4,'each opened menu checks the main document');
    assert.equal(stable.dispose,0,'opening/focusing a menu never restarts the main script: '+JSON.stringify(stable));
    assert.equal(stable.preview,0,'opening/focusing a menu does not reapply configuration');
    assert.deepEqual(stable.removed,[]);assert.deepEqual(stable.badFrames,[]);assert.ok(stable.frames>0);assert.equal(stable.backgroundSame,true);assert.equal(stable.styleSame,true);

    // A genuine version upgrade waits for slow storage while the old appearance
    // remains visible, then transfers already decoded background/style nodes.
    await controller.evaluate(async tabId=>{
      await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>{
        const instance=globalThis.__ytProgressCustomizer,release=instance.releaseAppearance;
        const get=chrome.storage.local.get.bind(chrome.storage.local);
        instance.version='previous-generation';__menuMessages.forceVersion='previous-generation';
        chrome.storage.local.get=(...args)=>get(...args).then(value=>new Promise(resolve=>setTimeout(()=>resolve(value),150)));
        instance.releaseAppearance=function(){__menuMessages.forceVersion='';chrome.storage.local.get=get;return release.call(this)};
      }});
    },tab.id);
    const upgrade=await openMenu();await upgrade.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
    const afterUpgrade=await page.evaluate(()=>({removed:__themeGuard.removed,badFrames:__themeGuard.badFrames,
      backgroundSame:document.querySelector('#ytc-background-image')===__themeGuard.background,
      styleSame:document.querySelector('style#yt-custom-progress-style')===__themeGuard.style}));
    assert.deepEqual(afterUpgrade,{removed:[],badFrames:[],backgroundSame:true,styleSame:true},'upgrading does not blank or reload the wallpaper');
    await upgrade.close();
    const menu=await openMenu();
    await page.evaluate(()=>{__themeGuard.running=false;__themeGuard.observer.disconnect()});
    await menu.evaluate(()=>{const input=document.querySelector('#uiOpacity');input.value=67;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))});
    await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--ytc-ui-opacity')==='0.67');
    const child=page.frames().find(frame=>frame.url().includes('/live_chat'));
    await child.waitForFunction(()=>document.documentElement.style.getPropertyValue('--ytc-ui-opacity')==='0.67');
    await menu.waitForFunction(()=>document.querySelector('#status').textContent==='Applied');
    const counts=await controller.evaluate(async tabId=>{
      const replies=await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:()=>window===window.top?__menuMessages:__childMenuMessages});return replies.map(reply=>({frameId:reply.frameId,...reply.result}));
    },tab.id);
    assert.equal(counts.find(reply=>reply.frameId===0).dispose,1,'only the deliberate upgrade replaces the script');assert.ok(counts.find(reply=>reply.frameId===0).preview>0);
    assert.equal(counts.find(reply=>reply.frameId!==0).ping,0,'connection checks target only the main frame');
    assert.equal(counts.find(reply=>reply.frameId!==0).preview,0,'live-preview acknowledgements target only the main frame');
    assert.equal(await page.evaluate(()=>document.querySelector('#ytc-background-image')===__themeGuard.background),true,'editing opacity keeps the background instance');
    assert.deepEqual(errors,[]);
    console.log('PASS: menu open/focus is read-only, main-frame messaging ignores stale iframe replies, slow-storage upgrades retain image/style nodes, per-frame colors/opacity stay stable, actual edits still preview and update chat through storage.');
  }finally{clearTimeout(deadline);await context.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
