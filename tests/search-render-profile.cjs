// Profile public search navigation across both SPA and full-document transitions.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),profileRoot=fs.mkdtempSync(path.join(os.tmpdir(),'ytc-search-profile-'));
fs.cpSync(root,profileRoot,{recursive:true,filter:source=>!path.relative(root,source).split(path.sep).some(part=>part.startsWith('.')||part==='tests')});
const manifestPath=path.join(profileRoot,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
manifest.content_scripts[0].js.unshift('search-profile.js');fs.writeFileSync(manifestPath,JSON.stringify(manifest));
fs.writeFileSync(path.join(profileRoot,'search-profile.js'),`(() => {
  const stats=globalThis.__searchWork={frames:{},timers:{},observers:{},writes:0,textWrites:0,queries:0};
  const measure=(group,name,fn,args)=>{const start=performance.now();try{return fn(...args);}finally{const sample=stats[group][name]||={calls:0,ms:0};sample.calls++;sample.ms+=performance.now()-start;}};
  const raf=requestAnimationFrame;globalThis.requestAnimationFrame=callback=>raf(t=>measure('frames',callback.name||'anonymous',callback,[t]));
  const timer=setTimeout;globalThis.setTimeout=(callback,delay,...args)=>timer(typeof callback==='function'&&delay<1000?()=>measure('timers',callback.name||'anonymous',callback,args):callback,delay,...(typeof callback==='function'&&delay<1000?[]:args));
  const MO=MutationObserver;globalThis.MutationObserver=class extends MO{constructor(callback){
    const caller=new Error().stack.split('\\n')[2]?.trim()||'unknown';super(records=>{
      const start=performance.now();try{return callback(records);}finally{const sample=stats.observers[caller]||={calls:0,records:0,ms:0};sample.calls++;sample.records+=records.length;sample.ms+=performance.now()-start;}
    });}};
  const set=Element.prototype.setAttribute;Element.prototype.setAttribute=function(...args){stats.writes++;return set.apply(this,args);};
  const query=Element.prototype.querySelectorAll;Element.prototype.querySelectorAll=function(...args){stats.queries++;return query.apply(this,args);};
  const data=Object.getOwnPropertyDescriptor(CharacterData.prototype,'data');Object.defineProperty(CharacterData.prototype,'data',{...data,set(value){stats.textWrites++;return data.set.call(this,value);}});
})();`);
if(process.env.YTC_NO_DATES==='1'){
  const file=path.join(profileRoot,'content/publication-dates.js');
  fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('function createController() {','function createController() { return {handleMutations(){},dispose(){}};'));
}
(async()=>{
  const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1440,height:1000},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
  const deadline=setTimeout(()=>void context.close(),100000);
  try{
    const browserCDP=await context.browser().newBrowserCDPSession(),{id}=await browserCDP.send('Extensions.loadUnpacked',{path:profileRoot});
    const admin=await context.newPage();await admin.goto('chrome-extension://'+id+'/popup.html');await admin.waitForSelector('#settings-form:not([inert])');
    await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,uiOpacity:30,uiBlur:12}));
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('https://www.youtube.com/',{waitUntil:'domcontentloaded',timeout:30000});
    const input=page.locator('input[name="search_query"]');await input.waitFor({timeout:15000});
    const tabId=await admin.evaluate(async()=>(await chrome.tabs.query({url:'https://www.youtube.com/'}))[0].id);
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
    const snapshot=async label=>{
      const result=await admin.evaluate(async tabId=>(await chrome.scripting.executeScript({target:{tabId},func:()=>({url:location.href,stats:globalThis.__searchWork,results:document.querySelectorAll('ytd-search ytd-video-renderer,ytd-search yt-lockup-view-model').length,dates:document.querySelectorAll('[data-ytc-publication-date]').length,labels:[...document.querySelectorAll('ytd-search #metadata-line,ytd-search .ytContentMetadataViewModelMetadataRow')].slice(0,3).map(n=>n.textContent)})}))[0].result,tabId);
      console.log(label+':',JSON.stringify(result));return result;
    };
    await input.fill('space documentary');await page.waitForTimeout(500);
    await page.locator('button.ytSearchboxComponentSearchButton').click();
    await page.locator('ytd-search').waitFor({state:'visible',timeout:20000}).catch(async()=>console.log('Native navigation:',await page.evaluate(()=>({url:location.href,title:document.title,body:document.body.innerText.slice(-800)})),errors));
    await page.waitForTimeout(8000);await snapshot('After search');
    await admin.evaluate(async tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>{__searchWork.frames={};__searchWork.timers={};__searchWork.observers={};__searchWork.writes=__searchWork.queries=__searchWork.textWrites=0;}}),tabId);
    await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
    await page.waitForTimeout(5000);const{profile}=await cdp.send('Profiler.stop');
    const result=await snapshot('Idle 5s');
    fs.writeFileSync(path.join(os.tmpdir(),'ytc-search-idle'+(process.env.YTC_NO_DATES==='1'?'-no-dates':'')+'.cpuprofile'),JSON.stringify(profile));
    console.log('Metrics:',JSON.stringify((await cdp.send('Performance.getMetrics')).metrics.filter(m=>/Duration|Documents|Nodes/.test(m.name))));
    await page.screenshot({path:path.join(os.tmpdir(),'ytc-search-inspect.png')});
    if(process.env.YTC_ASSERT_IDLE==='1'){
      if(!result?.results)throw Error('Search navigation did not produce results');
      if((result.stats.frames.flush?.calls||0)>15)throw Error('Search date updates do not settle');
    }
  }finally{clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
