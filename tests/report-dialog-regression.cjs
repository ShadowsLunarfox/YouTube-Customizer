// Cached Report dialogs must stop competing with native styles after Cancel.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=`<!doctype html><style>body{margin:20px;color:white;background:#222}ytd-app,ytd-popup-container,ytd-report-form-modal-renderer,tp-yt-paper-dialog{display:block}tp-yt-paper-dialog{padding:16px;width:380px;background:#222;backdrop-filter:none}[hidden],[aria-hidden=true]{display:none!important}button{padding:8px;border:0}</style>
<ytd-app><button id="open">Report</button><button id="play">Play/Pause</button><ytd-popup-container><tp-yt-paper-dialog id="report" role="dialog" aria-hidden="true" style="background:rgb(34,34,34)!important;display:none"><ytd-report-form-modal-renderer><div id="report-form"><label><input type="radio" name="reason">Reason</label><button id="cancel">Cancel</button><button id="submit">Submit</button></div></ytd-report-form-modal-renderer></tp-yt-paper-dialog></ytd-popup-container></ytd-app>
<script>const report=document.getElementById('report');window.submissions=0;window.closedWrites=0;
document.getElementById('open').onclick=()=>{report.removeAttribute('hidden');report.removeAttribute('aria-hidden');report.style.display='block'};
document.getElementById('cancel').onclick=()=>{report.setAttribute('aria-hidden','true');report.style.display='none';report.style.setProperty('background','rgb(34,34,34)','important')};
document.getElementById('submit').onclick=()=>submissions++;
document.getElementById('play').onclick=event=>requestAnimationFrame(()=>window.pauseMs=performance.now()-event.timeStamp);
new MutationObserver(records=>{if(report.getAttribute('aria-hidden')==='true'||report.hidden||report.style.display==='none'){closedWrites+=records.length;if(report.style.background!=='rgb(34, 34, 34)')report.style.setProperty('background','rgb(34,34,34)','important')}}).observe(report,{attributes:true,attributeFilter:['style']});
</script>`;
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:'chrome',headless:true,viewport:{width:1100,height:850},ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 const deadline=setTimeout(()=>void context.close(),60000);
 try{
  await context.route('https://www.youtube.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve(__dirname,'..')});
  const admin=await context.newPage();await admin.goto(`chrome-extension://${id}/popup.html`);await admin.waitForFunction(()=>initialized);
  await admin.evaluate(()=>chrome.storage.sync.set({themeEnabled:true,uiBlur:12,uiOpacity:42}));
  const page=await context.newPage();await page.goto('https://www.youtube.com/watch?v=report-cancel');
  await page.locator('#open').click();await page.waitForSelector('#report[data-ytc-universal-glass]');
  await page.locator('#cancel').click();await page.waitForTimeout(250);await page.evaluate(()=>closedWrites=0);await page.waitForTimeout(1000);
  const result=await page.evaluate(()=>({writes:closedWrites,managed:report.hasAttribute('data-ytc-universal-glass'),blur:getComputedStyle(report).backdropFilter}));
  console.log('Cancelled Report:',JSON.stringify(result));
  assert.ok(result.writes<5,'native cancellation and glass styling must settle instead of repeatedly rewriting the closed report');
  assert.equal(result.managed,false);assert.equal(result.blur,'none');
  for(const method of ['aria','hidden','display']){
   await page.locator('#open').click();await page.waitForSelector('#report[data-ytc-universal-glass]');
   await page.evaluate(method=>{if(method==='aria')report.setAttribute('aria-hidden','true');else if(method==='hidden')report.hidden=true;else report.style.display='none'},method);
   await page.waitForFunction(()=>!report.hasAttribute('data-ytc-universal-glass')&&!report.querySelector('[data-ytc-universal-glass],[data-ytc-universal-clear]'));
   await page.evaluate(()=>delete window.pauseMs);await page.locator('#play').click();await page.waitForFunction(()=>window.pauseMs!==undefined);assert.ok(await page.evaluate(()=>pauseMs<250));
  }
  assert.equal(await page.evaluate(()=>submissions),0,'no report is submitted');
  await page.locator('#open').click();await page.waitForSelector('#report[data-ytc-universal-glass]');
  assert.equal(await page.locator('#report').evaluate(el=>getComputedStyle(el).backdropFilter),'blur(12px)','reopened reports regain the shared glass surface');
  console.log('PASS: Cancel releases report ownership, hidden/style/ARIA dismissal stays idle, reopening restores styling, and page controls remain responsive.');
 }finally{clearTimeout(deadline);await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
