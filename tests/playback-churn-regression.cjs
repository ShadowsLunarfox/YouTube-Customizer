// Small player updates must not recheck every retained comment/recommendation.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage();
    await page.route('https://www.youtube.com/**', route => route.fulfill({contentType:'text/html',body:`<!doctype html><style>[hidden]{display:none!important}</style><ytd-app><div id="movie_player" class="html5-video-player"><button class="ytp-button ytp-play-button"><span>Play</span></button></div><ytd-comments id="cached" hidden></ytd-comments></ytd-app>`}));
    await page.goto('https://www.youtube.com/watch?v=playback-churn');
    for (const file of ['settings.js','content/surface-controller.js']) await page.addScriptTag({path:path.join(root,file)});
    const result = await page.evaluate(async () => {
      const NativeMap = Map, stores = [];
      globalThis.Map = class extends NativeMap {constructor(...args){super(...args);stores.push(this);}};
      const controller = YTCustomizerContent.createSurfaceController(); globalThis.Map = NativeMap;
      document.documentElement.setAttribute('data-ytc-theme','');
      document.documentElement.setAttribute('data-ytc-custom-background','');
      const observer = new MutationObserver(records => controller.handleMutations(records));
      const observe = () => observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','role','hidden']});
      const settle = () => new Promise(resolve => setTimeout(resolve,140));
      const cached = document.getElementById('cached'), button = document.querySelector('.ytp-play-button');
      const descriptor = Object.getOwnPropertyDescriptor(Node.prototype,'isConnected');
      let checks = 0, counting = false;
      Object.defineProperty(Node.prototype,'isConnected',{...descriptor,get(){
        if(counting && this.nodeType===1 && this.hasAttribute('data-retained'))checks++;
        return descriptor.get.call(this);
      }});
      const measure = async () => {
        checks = 0; counting = true;
        for(let cycle=0;cycle<8;cycle++) {
          const span = document.createElement('span'); span.textContent = cycle%2?'Pause':'Play';
          button.replaceChildren(span); button.className='ytp-button ytp-play-button state-'+cycle;
          await settle();
        }
        counting = false; return checks;
      };
      const sizes = [];
      for(const size of [12,900]) {
        observer.disconnect();
        cached.innerHTML=Array.from({length:size},()=>'<ytd-comment-thread-renderer data-retained><ytd-comment-view-model data-retained><button data-retained>Reply</button></ytd-comment-view-model></ytd-comment-thread-renderer>').join('');
        controller.apply(true); observe(); await settle();
        const visible = await measure();
        Object.defineProperty(document,'hidden',{configurable:true,value:true}); document.dispatchEvent(new Event('visibilitychange'));
        const hidden = await measure();
        const removed=cached.firstElementChild, removedButton=removed.querySelector('button'); removed.remove(); await settle();
        const hiddenReleased=stores.every(store=>!store.has(removed)&&!store.has(removedButton));
        delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); await settle();
        sizes.push({size,visible,hidden,hiddenReleased});
      }
      // Removed comments must still be released, while moved nodes remain owned.
      const moved=cached.firstElementChild; cached.append(moved); await settle();
      const kept=moved.querySelector('button').hasAttribute('data-ytc-universal-glass');
      cached.replaceChildren(); await settle();
      const retired=stores.reduce((count,store)=>count+[...store.keys()].filter(node=>!node.isConnected).length,0);
      observer.disconnect(); controller.dispose(); Object.defineProperty(Node.prototype,'isConnected',descriptor);
      return {sizes,kept,retired};
    });
    console.log('Playback ownership checks:',JSON.stringify(result));
    for(const phase of ['visible','hidden'])assert.ok(result.sizes[1][phase]<=result.sizes[0][phase]+80,phase+': player work must not grow with retained page size');
    assert.ok(result.sizes.every(sample=>sample.hiddenReleased),'removing cached comments in a background tab releases their ownership');
    assert.equal(result.kept,true);assert.equal(result.retired,0,'removed comment surfaces are still released');
    console.log('PASS: player-only DOM churn stays local in visible/background tabs, without retaining removed comments or resetting moved nodes.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
