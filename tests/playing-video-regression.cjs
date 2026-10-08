// Exercise real MP4 playback and pause input while the timeline and wallpaper are updating.
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const shortsRows = Array.from({ length: 6 }, (_, row) => `<div class="ytGridShelfViewModelGridShelfRow">${
  Array.from({ length: 6 }, (_, index) => `<div class="ytGridShelfViewModelGridShelfItem">
    <ytm-shorts-lockup-view-model-v2><ytm-shorts-lockup-view-model><yt-thumbnail-view-model></yt-thumbnail-view-model>
      <h3>Short ${row * 6 + index}</h3></ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2></div>`).join("")
}</div>`).join("");
const fixture = `<!doctype html><html><head><style>
  body { margin:0; background:#333; color:white; }
  ytd-app, ytd-watch-flexy { display:block; }
  #movie_player { position:relative; width:800px; height:450px; margin:64px 20px; }
  #movie_player video { width:100%; height:100%; }
  .ytp-chrome-bottom { position:absolute; bottom:0; left:0; right:0; height:64px; }
  .ytp-progress-bar-container { width:100%; height:8px; }
  .ytp-progress-list { width:100%; height:4px; }
  .ytp-play-progress, .ytp-load-progress { width:100%; height:4px; transform-origin:left; }
  .ytp-play-button { margin:12px; min-width:80px; height:32px; cursor:pointer; }
  #icons { height:1px; overflow:hidden; }
  [hidden] { display:none!important; }
  #home-cache { display:block; margin-top:700px; width:1100px; max-width:100%; }
  grid-shelf-view-model { display:flex; flex-direction:column; }
  .ytGridShelfViewModelGridShelfRow { display:flex; }
  .ytGridShelfViewModelGridShelfItem { width:180px; min-width:0; }
  ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model { display:block; width:180px; }
  yt-thumbnail-view-model { display:block; height:100px; background:#65889e; }
</style></head><body><ytd-app><ytd-watch-flexy>
  <div id="movie_player" class="html5-video-player"><video muted loop></video>
    <div class="ytp-chrome-bottom"><div class="ytp-progress-bar-container" role="slider">
      <div class="ytp-progress-list"><div class="ytp-load-progress"></div><div class="ytp-play-progress"></div></div>
      <div id="icons">${'<span class="yt-icon-shape"><svg><path></path></svg></span>'.repeat(12)}</div>
    </div><button class="ytp-play-button">Pause</button></div>
  </div>
</ytd-watch-flexy><ytd-browse id="home-cache" page-subtype="home"><grid-shelf-view-model>
  <div class="native-rows">${shortsRows}</div></grid-shelf-view-model></ytd-browse></ytd-app><script>
  const primary = document.querySelector('#movie_player video');
  const updates = [...document.querySelectorAll('.ytp-play-progress, .ytp-load-progress, #icons span')];
  let frameCount = 0;
  window.pauseFrame = null;
  function animate() {
    if (!primary.paused) {
      frameCount++;
      for (const [i, element] of updates.entries()) {
        element.style.transform = 'scaleX(' + ((frameCount + i) % 100) / 100 + ')';
        element.className = element.className.split(' state-')[0] + ' state-' + frameCount;
      }
      document.querySelector('[role="slider"]').setAttribute('role', 'slider');
    }
    window.timelineFrames = frameCount;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
  document.querySelector('.ytp-play-button').addEventListener('click', event => {
    primary.pause();
    requestAnimationFrame(() => { window.pauseFrame = performance.now() - event.timeStamp; });
  });
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width: 1200, height: 800 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--enable-unsafe-extension-debugging", "--autoplay-policy=no-user-gesture-required"]
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route("https://www.youtube.com/**", route => route.fulfill({ contentType: "text/html", body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: path.resolve(__dirname, "..") });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");

    // Encode a local MP4 so both videos actually decode frames, without network dependencies.
    const clip = await popup.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d");
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/mp4", videoBitsPerSecond: 600000 });
      const chunks = [];
      let recording = true;
      let frame = 0;
      function draw() {
        ctx.fillStyle = "#31516b";
        ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = "#dfa476";
        ctx.fillRect((frame++ * 16) % 640, 20, 140, 320);
        if (recording) requestAnimationFrame(draw);
      }
      draw();
      recorder.addEventListener("dataavailable", event => chunks.push(event.data));
      const stopped = new Promise(resolve => recorder.addEventListener("stop", resolve, { once: true }));
      recorder.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
      recording = false;
      recorder.stop();
      await stopped;
      stream.getTracks().forEach(track => track.stop());
      const data = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(new Blob(chunks, { type: "video/mp4" }));
      });
      await chrome.storage.local.set({ backgroundImageData: data });
      await chrome.storage.sync.set({ themeEnabled: true, backgroundMode: "image", uiBlur: 12, videosPerRow:6 });
      return data;
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded" });
    await page.bringToFront();
    await page.waitForFunction(() => document.querySelector("#ytc-background-video")?.readyState >= 2);
    await page.waitForFunction(() => document.querySelectorAll('[data-ytc-home-shorts-card]').length === 36);
    assert.equal(await page.evaluate(() => document.querySelector("video").closest("#movie_player") !== null), true,
      "the wallpaper does not become YouTube's first video element");
    await page.evaluate(async clip => {
      const video = document.querySelector("#movie_player video");
      video.src = clip;
      await video.play();
    }, clip);
    await page.waitForFunction(() => document.querySelector("#movie_player video").currentTime > 0.1);
    if (process.env.YTC_AUDIO === '1') {
      await popup.evaluate(() => chrome.storage.sync.set({ audioEnabled: true, volumeBoost:250,
        bassGain:4, midGain:-2, trebleGain:3, audioLimiter:true }));
      await page.locator('#movie_player video').evaluate(video => { video.muted=false; });
      await popup.waitForFunction(async () => {
        const [tab] = await chrome.tabs.query({ url:'https://www.youtube.com/*' });
        const [{ result }] = await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>
          YTCustomizerContent.audioResources.graphs.get(document.querySelector('#movie_player video'))?.route});
        return result === 'processed';
      });
    }
    await page.waitForTimeout(200);
    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        globalThis.__playingWork = { selectorChecks: 0, subtreeScans: 0, homepageChecks: 0, homeGridQueries:0 };
        const matches = Element.prototype.matches;
        Element.prototype.matches = function(selector, ...args) {
          if (selector.includes("data-ytc-universal")) globalThis.__playingWork.selectorChecks++;
          return matches.call(this, selector, ...args);
        };
        const query = Element.prototype.querySelectorAll;
        Element.prototype.querySelectorAll = function(selector, ...args) {
          if (selector.includes("data-ytc-universal")) globalThis.__playingWork.subtreeScans++;
          if (['grid-shelf-view-model, ytd-rich-shelf-renderer[is-shorts]',
            'ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model',
            'ytd-rich-grid-slim-media'].includes(selector)) globalThis.__playingWork.homeGridQueries++;
          return query.call(this, selector, ...args);
        };
        const documentQuery = Document.prototype.querySelector;
        Document.prototype.querySelector = function(selector, ...args) {
          if (selector.startsWith('ytd-browse[page-subtype="home"]')) globalThis.__playingWork.homeGridQueries++;
          return documentQuery.call(this, selector, ...args);
        };
        const closest = Element.prototype.closest;
        Element.prototype.closest = function(selector, ...args) {
          if (selector === 'ytd-browse[page-subtype="home"]') globalThis.__playingWork.homepageChecks++;
          return closest.call(this, selector, ...args);
        };
      }});
    });
    const noWork = { selectorChecks: 0, subtreeScans: 0, homepageChecks: 0, homeGridQueries:0 };
    const pauseTimes = [];
    async function checkPlayback(label) {
      const initialFrames = await page.evaluate(() => window.timelineFrames);
      await page.waitForTimeout(1500);
      assert.ok(await page.evaluate(initial => window.timelineFrames > initial + 20, initialFrames),
        label + ": timeline updates across separate playback frames");
      await page.locator(".ytp-play-button").click();
      await page.waitForFunction(() => window.pauseFrame !== null);
      const state = await page.evaluate(() => ({
      pauseMs: window.pauseFrame,
      primaryPaused: document.querySelector("#movie_player video").paused,
      mainFrames: document.querySelector("#movie_player video").getVideoPlaybackQuality().totalVideoFrames,
      wallpaperPaused: document.querySelector("#ytc-background-video").paused,
      wallpaperFrames: document.querySelector("#ytc-background-video").getVideoPlaybackQuality().totalVideoFrames
      }));
      assert.equal(state.primaryPaused, true, label + ": pause controls the main video");
      assert.equal(state.wallpaperPaused, false, label + ": wallpaper playback remains independent");
      assert.ok(state.mainFrames > 10 && state.wallpaperFrames > 10, label + ": both MP4s decode");
      assert.ok(state.pauseMs < 1000, label + ": pause paints without a 2-3-second stall: " + JSON.stringify(state));
      const work = await popup.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
        const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => globalThis.__playingWork });
        return result;
      });
      assert.deepEqual(work, noWork, label + ": playback does not invoke surface or Home Shorts scans");
      pauseTimes.push(state.pauseMs.toFixed(1));
    }
    await checkPlayback("Home with 36 Shorts");

    // YouTube caches the Home DOM during SPA navigation. Watch playback must not keep its layout active.
    await page.evaluate(() => {
      history.pushState({}, '', '/watch?v=playing-fixture');
      document.querySelector('#home-cache').hidden = true;
      document.dispatchEvent(new Event('yt-navigate-finish'));
    });
    await page.waitForFunction(() => !document.querySelector('[data-ytc-home-shorts-grid]'));
    await page.waitForTimeout(250);
    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/watch*" });
      await chrome.scripting.executeScript({ target:{tabId:tab.id}, func:() => {
        globalThis.__playingWork = { selectorChecks:0, subtreeScans:0, homepageChecks:0, homeGridQueries:0 };
      }});
    });
    await page.evaluate(async () => { window.pauseFrame = null; await document.querySelector('#movie_player video').play(); });
    await checkPlayback("Watch with cached Home DOM");

    // Real role changes must still style and restore nested dialog content.
    await page.evaluate(() => {
      const dialog = document.createElement("div");
      dialog.id = "new-dialog";
      dialog.innerHTML = '<div class="ytSpecDialogLayoutContent">Save</div>';
      dialog.setAttribute("role", "button");
      document.body.append(dialog);
    });
    await page.waitForTimeout(180);
    await page.evaluate(() => document.querySelector("#new-dialog").setAttribute("role", "dialog"));
    await page.waitForFunction(() => document.querySelector("#new-dialog").hasAttribute("data-ytc-universal-glass") &&
      document.querySelector("#new-dialog > div").hasAttribute("data-ytc-universal-clear"));
    await page.evaluate(() => document.querySelector("#new-dialog").setAttribute("role", "slider"));
    await page.waitForFunction(() => !document.querySelector("#new-dialog").hasAttribute("data-ytc-universal-glass") &&
      !document.querySelector("#new-dialog > div").hasAttribute("data-ytc-universal-clear"));
    await page.evaluate(()=>{
      history.pushState({}, '', '/');
      document.querySelector('#home-cache').hidden = false;
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForFunction(()=>document.querySelectorAll('[data-ytc-home-shorts-card="1"]').length===36);
    assert.deepEqual(errors, []);
    console.log("PASS: real MP4 playback/wallpaper with 36 Home Shorts, cached Home on Watch, and back navigation" + (process.env.YTC_AUDIO === '1' ? ', boost/EQ enabled' : '') + "; zero timeline/layout scans, independent media, dialog restoration. Pause frames (Home/Watch): " + pauseTimes.join('/') + " ms.");
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
