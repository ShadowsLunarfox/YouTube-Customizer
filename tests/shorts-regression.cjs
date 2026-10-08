// Checks Shorts cleanup, layering, and visual effects across player transitions.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function checkShorts({ context, popup }) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const settings = await popup.evaluate(() => chrome.storage.sync.get(null));
  try {
    await page.setViewportSize({ width: 2347, height: 1231 });
    await page.goto(process.env.SHORTS_URL || "https://www.youtube.com/shorts/7AlJpFdhj4w", {
      waitUntil: "domcontentloaded", timeout: 40000
    });
    // A visible #shorts-player alone can still be YouTube's loading skeleton.
    await page.locator("ytd-shorts ytd-reel-video-renderer").waitFor({ state: "visible" });
    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/shorts*" });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["settings.js", "content/surface-controller.js", "content/shorts-controller.js", "content/homepage-glass.js", "content/home-shorts-grid.js", "content/audio-controller.js", "yt.js"]
      });
      await chrome.storage.sync.set({ themeEnabled: true, backgroundMode: "image", backgroundOpacity: 100 });
    });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-ytc-shorts-clean"));
    await page.locator("video").first().evaluate(video => {
      video.muted = true;
      return video.play();
    });
    await page.waitForFunction(() => [...document.querySelectorAll("video")].some(video =>
      video.videoWidth > 0 && video.readyState >= 2 && !video.paused && video.currentTime > 0.5
    ));
    const native = await page.evaluate(() => {
      const video = document.querySelector("video");
      const button = document.querySelector('button[aria-label*="Full Screen"]');
      return { width: video.clientWidth, height: video.clientHeight,
        button: button && getComputedStyle(button).backgroundColor };
    });

    async function assertPlayer() {
      await page.waitForFunction(() => {
        const player = document.querySelector("#shorts-player");
        return player && getComputedStyle(player).backgroundColor === "rgba(0, 0, 0, 0)";
      });
      assert.equal(await page.locator("video").first().evaluate(video => video.paused), false);
    }
    await assertPlayer();
    await page.screenshot({ path: path.join(os.tmpdir(), "youtube-shorts-playing.png") });

    await page.getByRole("button", { name: /enter full.?screen/i }).first().click({ force: true });
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
    await assertPlayer();
    await page.screenshot({ path: path.join(os.tmpdir(), "youtube-shorts-fullscreen.png") });

    // Unknown, non-interactive siblings outside the player must also stay transparent.
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "fixture-style";
      style.textContent = `
        #fixture-top::before { content:""; position:absolute; inset:0 0 auto;
          height:100px; background:linear-gradient(#000,transparent) !important; }
        #fixture-top-zero::after { content:""; position:absolute; inset:0 0 auto;
          height:100px; background:linear-gradient(#000,transparent) !important; }
      `;
      const rect = document.querySelector("video").getBoundingClientRect();
      const create = (id, css) => {
        const layer = document.createElement("div");
        layer.id = id;
        layer.style.cssText = "position:fixed;z-index:9999;pointer-events:none;" + css;
        return layer;
      };
      const left = create("fixture-left", `left:${rect.left - 180}px;top:240px;width:150px;height:360px;background:#080808 !important`);
      const right = create("fixture-right", `left:${rect.right + 30}px;top:240px;width:150px;height:360px;background:#161616 !important`);
      const top = create("fixture-top", "inset:0;background:transparent");
      const zero = create("fixture-top-zero", "top:0;left:0;width:100%;height:0");
      const button = document.createElement("button");
      button.id = "fixture-button";
      button.style.cssText = "position:fixed;left:20px;bottom:20px;width:44px;height:44px;background:#111";
      button.textContent = "Test";
      document.head.append(style);
      document.body.append(left, right, top, zero, button);
    });
    async function assertLayers() {
      await page.waitForFunction(() => ["fixture-left", "fixture-right"].every(id => {
        const layer = document.getElementById(id);
        return layer && getComputedStyle(layer).backgroundColor === "rgba(0, 0, 0, 0)";
      }) && getComputedStyle(document.querySelector("#fixture-top"), "::before").backgroundImage === "none" &&
        getComputedStyle(document.querySelector("#fixture-top-zero"), "::after").backgroundImage === "none");
    }
    await assertLayers();
    // Previously each subsequent scan removed its own override and brought the black back.
    for (let index = 0; index < 8; index++) {
      await page.evaluate(index => {
        const marker = document.createElement("span");
        marker.hidden = true;
        marker.textContent = String(index);
        document.body.append(marker);
        marker.remove();
      }, index);
      await page.waitForTimeout(160);
      assert.deepEqual(await page.evaluate(() => ["fixture-left", "fixture-right"].map(id =>
        getComputedStyle(document.getElementById(id)).backgroundColor
      )), ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)"]);
    }
    await page.evaluate(() => {
      document.querySelector("#fixture-left").style.setProperty("background", "#050505", "important");
      const right = document.querySelector("#fixture-right");
      const replacement = right.cloneNode();
      replacement.removeAttribute("data-ytc-shorts-layer");
      replacement.style.setProperty("background", "#161616", "important");
      right.replaceWith(replacement);
    });
    await assertLayers();
    assert.equal(await page.locator("#fixture-button").evaluate(button => getComputedStyle(button).backgroundColor), "rgb(17, 17, 17)");

    // Compare painted pixels, not only the presence of a class or an injected style rule.
    const pixels = await page.screenshot();
    const samples = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const read = (x, y) => [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
      const left = document.querySelector("#fixture-left").getBoundingClientRect();
      const right = document.querySelector("#fixture-right").getBoundingClientRect();
      return {
        wallpaper: read(100, 300), left: read(left.x + 75, 300), right: read(right.x + 75, 300),
        top: read(100, 20)
      };
    }, pixels.toString("base64"));
    assert.deepEqual(samples.left, samples.wallpaper, "Left gutter should reveal the wallpaper");
    assert.deepEqual(samples.right, samples.wallpaper, "Right gutter should reveal the wallpaper");
    assert.deepEqual(samples.top, samples.wallpaper, "The top gradient should not darken the wallpaper");

    await popup.evaluate(() => chrome.storage.sync.set({ themeEnabled: false }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-shorts-clean"));
    assert.deepEqual(await page.evaluate(() => ({
      left: getComputedStyle(document.querySelector("#fixture-left")).backgroundColor,
      right: getComputedStyle(document.querySelector("#fixture-right")).backgroundColor,
      pseudo: getComputedStyle(document.querySelector("#fixture-top"), "::before").backgroundImage,
      marked: document.querySelectorAll("[data-ytc-shorts-layer]").length
    })), {
      left: "rgb(5, 5, 5)", right: "rgb(22, 22, 22)",
      pseudo: "linear-gradient(rgb(0, 0, 0), rgba(0, 0, 0, 0))", marked: 0
    });
    await popup.evaluate(() => chrome.storage.sync.set({ themeEnabled: true }));
    await assertLayers();
    await page.evaluate(() => {
      for (const id of ["fixture-left", "fixture-right", "fixture-top", "fixture-top-zero", "fixture-button", "fixture-style"]) {
        document.getElementById(id).remove();
      }
      return document.exitFullscreen();
    });
    await page.waitForFunction(() => !document.fullscreenElement);
    await assertPlayer();
    assert.deepEqual(await page.locator("video").first().evaluate(video => ({
      width: video.clientWidth, height: video.clientHeight
    })), { width: native.width, height: native.height });
    assert.equal(await page.locator('button[aria-label*="Full Screen"]').first().evaluate(button =>
      getComputedStyle(button).backgroundColor
    ), native.button);

    // YouTube retains old players during SPA navigation: the URL must end cleanup immediately.
    await page.evaluate(() => {
      history.pushState({}, "", "/watch?v=jNQXAC9IVRw");
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-shorts-clean"));
    assert.equal(await page.locator("[data-ytc-shorts-layer]").count(), 0);
    console.log("PASS: loaded Shorts playback/fullscreen, persistent transparent gutters, pseudo-gradient, site rewrites, pixels, controls, restore/navigation.");
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: location.href, active: document.documentElement.hasAttribute("data-ytc-shorts-clean"),
      layers: ["fixture-left", "fixture-right", "fixture-top"].map(id => {
        const el = document.getElementById(id);
        return el && { id, mark: el.getAttribute("data-ytc-shorts-layer"),
          color: getComputedStyle(el).backgroundColor,
          pseudo: getComputedStyle(el, "::before").backgroundImage };
      })
    })).catch(() => null);
    console.error("Shorts state:", state);
    throw error;
  } finally {
    await popup.evaluate(settings => chrome.storage.sync.set(settings), settings);
    await page.close();
  }
}

module.exports = checkShorts;

if (require.main === module) {
  (async () => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chrome", headless: true, ignoreDefaultArgs: ["--disable-extensions"],
      args: ["--enable-unsafe-extension-debugging", "--autoplay-policy=no-user-gesture-required"]
    });
    try {
      const cdp = await context.browser().newBrowserCDPSession();
      const { id } = await cdp.send("Extensions.loadUnpacked", { path: path.resolve(__dirname, "..") });
      const popup = await context.newPage();
      await popup.goto("chrome-extension://" + id + "/popup.html");
      await popup.waitForSelector("#settings-form:not([inert])");
      await popup.evaluate(async () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 16;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#48b9a6";
        ctx.fillRect(0, 0, 16, 16);
        await chrome.storage.local.set({ backgroundImageData: canvas.toDataURL() });
      });
      await checkShorts({ context, popup });
    } finally {
      await context.close();
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
