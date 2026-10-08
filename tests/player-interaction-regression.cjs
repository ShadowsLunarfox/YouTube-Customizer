// Player controls must paint immediately inside Home, without whole-feed scans on preview updates.
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const wallpaper = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const cards = Array.from({ length: 120 }, (_, i) => `<ytd-rich-item-renderer>
  <yt-lockup-view-model>Video ${i}${'<span><svg><path></path></svg></span>'.repeat(30)}</yt-lockup-view-model>
</ytd-rich-item-renderer>`).join("");
const fixture = `<!doctype html><html><head><style>
  body { margin:0; color:white; font:16px sans-serif; }
  ytd-app, ytd-browse, ytd-rich-grid-renderer { display:block; }
  ytd-rich-item-renderer { display:block; height:20px; overflow:hidden; }
  .ytp-play-progress { background:red; height:4px; width:40%; }
  .ytp-load-progress { background:gray; height:4px; width:75%; }
  .native-control { background:white; width:40px; height:20px; }
  .native-control::before { content:""; background:lime; width:4px; height:4px; }
  .native-control::after { content:""; background:blue; width:4px; height:4px; }
  .preview-fixture { position:fixed; top:60px; left:10px; width:300px; height:180px; }
  #controls { position:fixed; top:0; left:0; z-index:10; }
</style></head><body><ytd-app><ytd-browse page-subtype="home">
  <div id="controls"><button id="mount-preview">Preview</button><button id="mount-dialog">Save</button></div>
  <div id="preview-mount"></div><ytd-rich-grid-renderer>${cards}</ytd-rich-grid-renderer>
</ytd-browse><div id="portal"></div></ytd-app><script>
  document.getElementById("mount-preview").addEventListener("click", () => {
    document.querySelector(".preview-fixture")?.remove();
    const player = document.createElement("div");
    player.className = "preview-fixture " + (window.playerClass || "");
    player.id = window.playerId || "test-player";
    player.innerHTML = '<div class="ytp-play-progress" style="background:red"></div>' +
      '<div class="ytp-load-progress" style="background:gray"></div>' +
      '<div class="native-control" style="background:white"></div>';
    document.getElementById(window.playerMount || "preview-mount").append(player);
    window.firstPaint = new Promise(resolve => requestAnimationFrame(() => {
      const color = (selector, pseudo) => getComputedStyle(player.querySelector(selector), pseudo).backgroundColor;
      resolve([color(".ytp-play-progress"), color(".ytp-load-progress"), color(".native-control"),
        color(".native-control", "::before"), color(".native-control", "::after")]);
    }));
  });
  document.getElementById("mount-dialog").addEventListener("click", () => {
    const dialog = document.createElement("div");
    dialog.id = "save-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.innerHTML = '<div class="ytSpecDialogLayoutContent">Save to playlist</div>';
    document.body.append(dialog);
  });
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route("https://www.youtube.com/**", route => route.fulfill({ contentType: "text/html", body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: root });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");
    await popup.evaluate(async wallpaper => {
      await chrome.storage.local.set({ backgroundImageData: wallpaper });
      await chrome.storage.sync.set({ themeEnabled: true, backgroundMode: "image", uiBlur: 12,
        progressColor: "#00ccff", bufferColor: "#999999", disableVideoPreviews: false });
    }, wallpaper);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://www.youtube.com/");
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-ytc-home-glass"));
    await page.waitForTimeout(350);

    // Count extension-world DOM work, independently of the page's own scripts and rendering.
    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/" });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        globalThis.__playerWork = { documentScans: 0, repeatedGlassMatches: 0 };
        const query = document.querySelectorAll;
        document.querySelectorAll = function(selector, ...args) {
          if (/cinematic|live-chat|data-ytc-universal/.test(selector)) globalThis.__playerWork.documentScans++;
          return query.call(this, selector, ...args);
        };
        const matches = Element.prototype.matches;
        Element.prototype.matches = function(selector, ...args) {
          if (selector.includes("data-ytc-universal")) globalThis.__playerWork.repeatedGlassMatches++;
          return matches.call(this, selector, ...args);
        };
      }});
    });
    const resetWork = () => popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/" });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
        globalThis.__playerWork = { documentScans: 0, repeatedGlassMatches: 0 };
      }});
    });
    const readWork = () => popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/" });
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => globalThis.__playerWork });
      return result;
    });
    const expectedColors = ["rgb(0, 204, 255)", "rgb(153, 153, 153)", "rgb(255, 255, 255)",
      "rgb(0, 255, 0)", "rgb(0, 0, 255)"];
    for (const config of [
      { playerClass: "html5-video-player", playerId: "test-player", playerMount: "preview-mount" },
      { playerClass: "", playerId: "inline-player", playerMount: "preview-mount" },
      { playerClass: "", playerId: "inline-preview-player", playerMount: "preview-mount" },
      { playerClass: "html5-video-player", playerId: "inline-preview-player", playerMount: "portal" }
    ]) {
      await resetWork();
      await page.evaluate(config => Object.assign(window, config), config);
      await page.locator("#mount-preview").click();
      assert.deepEqual(await page.evaluate(() => window.firstPaint), expectedColors,
        "progress and native controls are visible on the first painted frame: " + config.playerId);
      await page.waitForTimeout(180);
      assert.deepEqual(await page.evaluate(() => {
        const p = document.querySelector(".preview-fixture");
        const color = (selector, pseudo) => getComputedStyle(p.querySelector(selector), pseudo).backgroundColor;
        return [color(".ytp-play-progress"), color(".ytp-load-progress"), color(".native-control"),
          color(".native-control", "::before"), color(".native-control", "::after")];
      }), expectedColors, "delayed surface enforcement also leaves player controls intact");
      assert.equal((await readWork()).documentScans, 0, "mounting a preview does not rescan the feed");
    }
    await resetWork();
    await page.evaluate(() => {
      const progress = document.querySelector(".ytp-play-progress");
      for (let i = 0; i < 150; i++) {
        progress.style.width = (i % 100) + "%";
        progress.className = "ytp-play-progress state-" + i;
      }
    });
    await page.waitForTimeout(180);
    const work = await readWork();
    assert.equal(work.documentScans, 0);
    assert.ok(work.repeatedGlassMatches <= 2, "repeated progress writes are coalesced: " + JSON.stringify(work));

    // Incremental scans must still handle real new dialogs, ambient layers, and chat shadow roots.
    await page.locator("#mount-dialog").click();
    await page.waitForFunction(() => document.querySelector("#save-dialog").hasAttribute("data-ytc-universal-glass"));
    await page.evaluate(() => {
      const ambient = document.createElement("div");
      ambient.id = "ambient-test";
      document.body.append(ambient);
      const host = document.createElement("yt-live-chat-renderer");
      host.id = "chat-test";
      host.attachShadow({ mode: "open" }).innerHTML = '<div id="contents">Messages</div>';
      document.body.append(host);
    });
    await page.waitForFunction(() => document.querySelector("#ambient-test").hasAttribute("data-ytc-ambient-blocked") &&
      document.querySelector("#chat-test").shadowRoot.querySelector("style[data-ytc-live-chat-surface]"));
    await page.evaluate(() => {
      const thumbnail = document.createElement("ytd-thumbnail");
      document.body.append(thumbnail);
      thumbnail.append(document.querySelector("#ambient-test"));
    });
    await page.waitForFunction(() => !document.querySelector("#ambient-test").hasAttribute("data-ytc-ambient-blocked"));
    await page.evaluate(() => document.body.append(document.querySelector("#ambient-test")));
    await page.waitForFunction(() => document.querySelector("#ambient-test").hasAttribute("data-ytc-ambient-blocked"));
    await popup.evaluate(async () => { await chrome.storage.sync.set({ themeEnabled: false }); });
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-theme") &&
      !document.querySelector("#ambient-test").hasAttribute("data-ytc-ambient-blocked"));
    assert.deepEqual(errors, []);
    console.log("PASS: first-frame progress/control colors, inline enforcement, preview portals, coalesced mutations, scoped scans, dialogs, ambient moves, and chat shadows.");
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
