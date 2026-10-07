// Checks hostile inputs, extension boundaries, media handling, and content-script ownership.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const sandbox = vm.createContext({ URL });
vm.runInContext(fs.readFileSync(path.join(root, "settings.js"), "utf8"), sandbox);
const settings = sandbox.YTCustomizer;
const gif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
assert.ok(manifest.host_permissions.every(pattern => pattern.startsWith('https://')));
assert.ok(manifest.content_scripts.every(script => script.matches.every(pattern => pattern.startsWith('https://'))));

for (const payload of ["A", "A=", "A==", "AAAA=", "AAA==", "AAAA===", "AA=A", "", "AA\nAA", "AA;AA"]) {
  assert.equal(settings.isBackgroundData("data:image/png;base64," + payload), false, "reject malformed Base64: " + payload);
}
for (const value of [null, {}, [], "https://example.invalid/image.png", "javascript:alert(1)",
  "data:text/html;base64,AAAA", "data:image/svg+xml;base64,AAAA"]) {
  assert.equal(settings.isImageData(value), false);
  assert.equal(settings.isBackgroundData(value), false);
}
for (const payload of ["AA", "AAA", "AAAA", "AA==", "AAA="]) {
  assert.equal(settings.isImageData("data:image/png;base64," + payload), true, "accept valid padded/unpadded Base64");
}
assert.equal(settings.isImageData("data:video/mp4;base64,AAAA"), false);
assert.equal(settings.isBackgroundData("data:video/mp4;base64,AAAA"), true);
for (const [size, validate] of [[5 * 1024 * 1024, settings.isImageData], [20 * 1024 * 1024, settings.isBackgroundData]]) {
  assert.equal(validate("data:image/png;base64," + Buffer.alloc(size).toString("base64")), true, "accept the documented byte limit");
  assert.equal(validate("data:image/png;base64," + Buffer.alloc(size + 1).toString("base64")), false, "reject one byte over the limit");
}
assert.equal(settings.normalizeAssets({ backgroundImageData: gif.replace("data:image/gif;base64", "DATA:IMAGE/GIF;BASE64") }).backgroundImageData, gif);
assert.equal(settings.normalizeAssets(Object.create({ backgroundImageData: gif })).backgroundImageData, "");
assert.equal(settings.normalize({ videosPerRow: 3.7 }).videosPerRow, 4);
assert.equal(settings.normalize({ uiOpacity: null, uiBlur: false, videosPerRow: [2] }).uiOpacity, 30);
assert.equal(settings.normalize({ uiOpacity: "", uiBlur: false, videosPerRow: [2] }).uiBlur, 12);
assert.equal(settings.normalize({ videosPerRow: [2] }).videosPerRow, 6);
assert.equal(settings.normalize(Object.create({ themeEnabled: true })).themeEnabled, false);
assert.equal(settings.normalize({ progressColor: "#fff;url(https://example.invalid)" }).progressColor, settings.defaults.progressColor);
assert.ok(decodeURIComponent(settings.iconDataUri("constructor", "#ffffff")).includes('<circle cx="32"'));
for (const value of ["https://www.youtube.com/watch?v=1", "https://youtube.com/", "https://music.youtube.com/"]) {
  assert.equal(settings.isYouTubeUrl(value), true);
}
for (const value of ["http://www.youtube.com/", "https://youtube.com.example.invalid/", "https://youtube.com@example.invalid/",
  "https://example.invalid@youtube.com/", "javascript:alert(1)", "not a URL", null]) {
  assert.equal(settings.isYouTubeUrl(value), false);
}
console.log("PASS: bounded media validation, MIME normalization, strict settings, safe icons, and YouTube URL validation.");

const fixture = `<!doctype html><style>
  #shorts-player { position:relative; width:600px; height:480px; margin:100px; background:#111; }
  #shorts-player video { position:absolute; left:210px; top:80px; width:180px; height:320px; }
  #ytc-background-video { position:fixed; inset:0; width:100vw; height:100vh; }
  .ytp-play-progress { background:#123456; }
</style><textarea id="yt-custom-progress-style">Page-owned content</textarea>
<video id="ytc-background-video" muted></video><ytd-shorts>
  <div id="shorts-player" class="html5-video-player"><video muted></video><div class="ytp-play-progress">Progress</div></div>
</ytd-shorts>`;

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width:1200, height:900 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route(/https?:\/\/www\.youtube\.com\//, route => route.fulfill({ contentType:"text/html", body:fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path:root });
    const popupUrl = "chrome-extension://" + id + "/popup.html";
    const popup = await context.newPage();
    const errors = [];
    popup.on("pageerror", error => errors.push(error.message));
    await popup.goto(popupUrl);
    await popup.waitForSelector("#settings-form:not([inert])");
    await popup.evaluate(async () => {
      await chrome.storage.local.set({backgroundImageData:"data:image/png;base64,A=",customIconData:"data:image/png;base64,A"});
      await chrome.storage.sync.set({themeEnabled:true,backgroundMode:"image",thumbStyle:"custom",uiOpacity:null,videosPerRow:3.7});
    });
    await popup.reload();
    await popup.waitForSelector("#settings-form:not([inert])");
    assert.deepEqual(await popup.evaluate(() => [document.querySelector('#uiOpacity').value,document.querySelector('#videosPerRow').value,
      document.querySelector('#thumbStyle').value,document.querySelector('#backgroundMode').value]), ["30","4","circle","color"], "corrupt storage cannot break popup initialization");
    await popup.evaluate(async gif => {
      await chrome.storage.local.set({backgroundImageData:gif.replace("data:image/gif;base64","DATA:IMAGE/GIF;BASE64")});
      await chrome.storage.sync.set({uiOpacity:30,videosPerRow:6,backgroundMode:"image",thumbStyle:"circle"});
    }, gif);
    await popup.reload();
    await popup.waitForSelector("#settings-form:not([inert])");
    assert.ok(await popup.locator('.theme-preview').evaluate(el => el.style.backgroundImage.includes('blob:')), "local media previews work under the CSP");

    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://www.youtube.com/shorts/security-fixture");
    await page.waitForFunction(() => document.querySelectorAll('.ytc-shorts-gutter-mask').length===2);
    assert.equal(await page.locator('#yt-custom-progress-style').first().inputValue(), "Page-owned content", "a page-owned ID cannot be adopted as the extension stylesheet");
    assert.equal(await page.locator('style#yt-custom-progress-style').count(), 1);
    assert.equal(await page.locator('.ytp-play-progress').evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 51, 102)");
    assert.deepEqual(await page.locator('.ytc-shorts-gutter-mask').evaluateAll(masks => masks.map(mask => mask.style.width)), ["210px","210px"], "Shorts geometry uses its player instead of the full-screen wallpaper video");

    const send = (view, message) => view.evaluate(async message => {
      const [tab] = await chrome.tabs.query({url:"https://www.youtube.com/shorts/security-fixture"});
      return chrome.tabs.sendMessage(tab.id,message).then(reply => reply ?? null).catch(() => null);
    }, message);
    const ping = await send(popup, {type:"YT_PROGRESS_PING"});
    assert.equal(ping.applied, true);
    assert.equal(ping.version, settings.version);
    const preferences = { ...settings.defaults,themeEnabled:true,backgroundMode:"image",uiOpacity:42 };
    assert.equal((await send(popup,{type:"YT_PROGRESS_LIVE_PREVIEW",settings:preferences,assets:{}})).applied, true);
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--ytc-ui-opacity')), "0.42");
    for (const message of [
      {type:"YT_PROGRESS_LIVE_PREVIEW",settings:[],assets:{}},
      {type:"YT_PROGRESS_LIVE_PREVIEW",settings:{...preferences,uiOpacity:77},assets:[]},
      {type:"YT_PROGRESS_LIVE_PREVIEW",settings:{...preferences,uiOpacity:77},assets:null}
    ]) assert.equal(await send(popup,message), null, "malformed message envelopes are rejected");
    const untrustedView = await context.newPage();
    await untrustedView.goto(popupUrl + "?untrusted-view=1");
    await untrustedView.waitForSelector("#settings-form:not([inert])");
    assert.equal(await send(untrustedView,{type:"YT_PROGRESS_LIVE_PREVIEW",settings:{...preferences,uiOpacity:77},assets:{}}), null, "only the exact popup entry point can send control messages");
    await untrustedView.close();
    await page.evaluate(() => postMessage({type:"YT_PROGRESS_LIVE_PREVIEW",settings:{uiOpacity:77}},"*"));
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--ytc-ui-opacity')), "0.42", "page messages cannot change extension state");

    await popup.evaluate(async () => {
      window.policyViolations = [];
      document.addEventListener('securitypolicyviolation', event => window.policyViolations.push(event.effectiveDirective));
      const image=document.createElement('img');image.src='https://example.invalid/audit.png';document.body.append(image);
      const script=document.createElement('script');script.src='https://example.invalid/audit.js';document.body.append(script);
      await fetch('https://example.invalid/audit').catch(() => {});
    });
    await popup.waitForFunction(() => ['img-src','script-src-elem','connect-src'].every(d => window.policyViolations.includes(d)));
    // Debugger evaluation bypasses unsafe-eval CSP by default; disable that bypass for this check.
    const popupCdp = await context.newCDPSession(popup);
    const evaluation = await popupCdp.send('Runtime.evaluate', {
      expression: "try { new Function('return 1')(); false; } catch { true; }",
      allowUnsafeEvalBlockedByCSP:false, returnByValue:true
    });
    assert.equal(evaluation.result.value, true, 'the actual extension CSP blocks dynamic code execution');

    const insecurePage = await context.newPage();
    await insecurePage.goto("http://www.youtube.com/shorts/security-fixture");
    if (insecurePage.url().startsWith('http:')) {
      assert.equal(await insecurePage.evaluate(() => document.documentElement.hasAttribute('data-ytc-theme')), false, "content scripts do not run on insecure HTTP pages");
    } else {
      assert.ok(insecurePage.url().startsWith('https://www.youtube.com/'), "Chrome can upgrade preloaded HSTS hosts to HTTPS");
    }
    await insecurePage.close();
    const inject = files => popup.evaluate(async files => {
      const [tab] = await chrome.tabs.query({url:"https://www.youtube.com/shorts/security-fixture"});
      await chrome.scripting.executeScript({target:{tabId:tab.id},files});
    }, files);
    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({url:"https://www.youtube.com/shorts/security-fixture"});
      await chrome.scripting.executeScript({target:{tabId:tab.id},func:() => globalThis.__ytProgressCustomizer.dispose()});
    });
    assert.equal(await page.locator('style#yt-custom-progress-style').count(), 0, "dispose removes only its owned stylesheet");
    assert.equal(await page.locator('#yt-custom-progress-style').inputValue(), "Page-owned content");
    await inject(["settings.js","content/surface-controller.js","content/shorts-controller.js","content/homepage-glass.js","yt.js"]);
    await page.waitForFunction(() => document.querySelectorAll('.ytc-shorts-gutter-mask').length===2);
    assert.equal((await send(popup,{type:"YT_PROGRESS_PING"})).applied, true, "a disposed script can be initialized again");
    assert.deepEqual(errors, []);
    console.log("PASS: corrupt-storage recovery, local previews, stylesheet ownership, Shorts with video wallpaper, authenticated messages, popup CSP, HTTPS-only injection, disposal, and reinjection.");
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
