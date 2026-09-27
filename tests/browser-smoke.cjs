// Exercises extension installation, popup workflows, and core YouTube page behavior in Chromium.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const animatedGif = Buffer.from(
  "4749463839610100010080000000ff000000ff" +
  "21ff0b4e45545343415045322e300301000000" +
  "21f904000a0000002c0000000001000100000202440100" +
  "21f904000a0000002c00000000010001000002024c01003b",
  "hex"
);

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--enable-unsafe-extension-debugging"]
  });
  try {
    // Open YouTube before loading the extension to exercise a missing content script.
    const player = await context.newPage();
    await player.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw", {
      waitUntil: "domcontentloaded", timeout: 40000
    });
    await player.locator(".ytp-scrubber-button").waitFor({ state: "attached" });
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: root });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");
    const tabId = await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/watch*" });
      await chrome.tabs.update(tab.id, { active: true });
      return tab.id;
    });
    const png = await popup.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 24;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(0, 0, 24, 24);
      return canvas.toDataURL();
    });
    async function upload(mime, base64, inputId = "customIcon") {
      await popup.evaluate(({ mime, base64, inputId }) => {
        const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], "icon." + mime.split("/")[1], { type: mime }));
        const input = document.getElementById(inputId);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, { mime, base64, inputId });
    }
    async function waitForIcon(data) {
      await player.waitForFunction(expected => {
        const button = document.querySelector(".ytp-scrubber-button");
        return button && getComputedStyle(button).backgroundImage.includes(expected);
      }, data);
      assert.equal(await player.evaluate(async expected => {
        const image = new Image();
        image.src = expected;
        await image.decode();
        return image.naturalWidth > 0;
      }, data), true);
    }
    await upload("image/png", png.split(",")[1]);
    await waitForIcon(png);
    await popup.waitForFunction(() => !document.querySelector("#status").classList.contains("error"));
    assert.equal(await popup.evaluate(async () =>
      (await chrome.storage.local.get("customIconData")).customIconData
    ), png);

    // Reopening must re-send the stored custom image without requiring another upload.
    await popup.reload();
    await popup.waitForSelector("#settings-form:not([inert])");
    await popup.evaluate(async tabId => {
      await chrome.tabs.update(tabId, { active: true });
      document.querySelector("#thumbSize").value = "34";
      document.querySelector("#thumbSize").dispatchEvent(new Event("input", { bubbles: true }));
    }, tabId);
    await waitForIcon(png);
    await player.waitForFunction(() =>
      getComputedStyle(document.querySelector(".ytp-scrubber-button")).width === "34px"
    );

    // Replaced native decorations must not cover the imported icon.
    await player.evaluate(() => {
      const container = document.querySelector(".ytp-scrubber-container");
      container.classList.add("ytp-decorated-scrubber-container");
      document.querySelector(".ytp-decorated-scrubber-button").src =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    });
    assert.equal(await player.locator(".ytp-decorated-scrubber-button").evaluate(
      el => getComputedStyle(el).display
    ), "none");

    const gif = "data:image/gif;base64," + animatedGif.toString("base64");
    await upload("image/gif", animatedGif.toString("base64"));
    await waitForIcon(gif);
    await player.locator(".ytp-progress-bar").hover({ force: true });
    const frames = [];
    for (const delay of [37, 83, 131, 59, 107, 43]) {
      frames.push(await player.locator(".ytp-scrubber-button").screenshot({ animations: "allow" }));
      await player.waitForTimeout(delay);
    }
    assert.ok(frames.some(frame => !frame.equals(frames[0])), "GIF should animate on YouTube");
    await player.locator(".html5-video-player").screenshot({
      path: path.join(os.tmpdir(), "youtube-custom-icon-fixed.png")
    });

    // The observer must reattach a removed style element, and reinjection must be idempotent.
    await player.evaluate(() => document.getElementById("yt-custom-progress-style").remove());
    await player.waitForSelector("#yt-custom-progress-style", { state: "attached" });
    await waitForIcon(gif);
    await popup.evaluate(async tabId => {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["yt.js"] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ["yt.js"] });
    }, tabId);
    assert.equal(await player.locator("#yt-custom-progress-style").count(), 1);

    await popup.evaluate(() => document.querySelector("#removeCustomIcon").click());
    await player.waitForFunction(() =>
      getComputedStyle(document.querySelector(".ytp-scrubber-button")).backgroundImage.includes("data:image/svg+xml")
    );
    assert.equal(await popup.evaluate(async () =>
      (await chrome.storage.local.get("customIconData")).customIconData
    ), undefined);
    console.log("PASS: player icons, animation, reconnect, persistence, remove.");

    async function edit(id, value) {
      await popup.evaluate(({ id, value }) => {
        const input = document.getElementById(id);
        if (input.type === "checkbox") input.checked = value;
        else input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, { id, value });
    }
    await edit("themePreset", "classic");
    await player.waitForFunction(() => getComputedStyle(document.documentElement).backgroundColor === "rgb(0, 128, 128)");
    await player.waitForFunction(() => getComputedStyle(document.querySelector("ytd-masthead")).backgroundColor === "rgb(192, 192, 192)");
    await edit("themePreset", "charcoal");
    await player.waitForFunction(() => getComputedStyle(document.documentElement).backgroundColor === "rgb(21, 21, 21)");
    for (const selector of ["ytd-watch-metadata h1", "yt-lockup-metadata-view-model h3 a",
      "ytd-masthead #guide-button", 'yt-searchbox input[type="text"]']) {
      assert.equal(await player.locator(selector).first().evaluate(el => getComputedStyle(el).color), "rgb(245, 245, 245)");
    }
    await player.screenshot({ path: path.join(os.tmpdir(), "youtube-theme-dark.png") });
    await edit("themePreset", "classic");
    await edit("textColor", "#112233");
    await player.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--yt-spec-text-primary").trim() === "#112233");
    const beforePlayerSize = await player.locator(".html5-video-player").boundingBox();
    await player.evaluate(() => {
      document.querySelector("#cinematics-container").style.display = "block";
    });
    await upload("image/png", png.split(",")[1], "backgroundImage");
    await player.waitForFunction(expected => getComputedStyle(document.documentElement).backgroundImage.includes(expected), png);
    await player.waitForFunction(() =>
      document.documentElement.hasAttribute("data-ytc-custom-background") &&
      getComputedStyle(document.querySelector("#cinematics-container")).display === "none"
    );
    await player.evaluate(() => {
      const container = document.querySelector("#cinematics-container");
      container.style.display = "block";
      const replacement = document.createElement("div");
      replacement.id = "cinematics-reenabled-by-youtube";
      replacement.className = "ytp-cinematic-ambient-light";
      replacement.style.cssText = "display:block;width:640px;height:360px;background:#000";
      const host = document.createElement("div");
      host.id = "ambient-test-player";
      host.className = "html5-video-player";
      host.append(replacement);
      document.body.append(host);
    });
    await player.waitForFunction(() => {
      const replacement = document.querySelector("#cinematics-reenabled-by-youtube");
      return replacement?.hasAttribute("data-ytc-ambient-blocked") &&
        getComputedStyle(replacement).display === "none";
    });
    await player.evaluate(() => document.querySelector("#ambient-test-player")?.remove());
    await edit("backgroundFit", "tile");
    await player.waitForFunction(() => getComputedStyle(document.documentElement).backgroundRepeat.includes("repeat"));
    assert.equal(await popup.evaluate(async () =>
      (await chrome.storage.local.get("backgroundImageData")).backgroundImageData
    ), png);
    assert.equal((await player.locator(".html5-video-player").boundingBox()).height, beforePlayerSize.height);
    await edit("hideComments", true);
    await player.waitForFunction(() => getComputedStyle(document.querySelector("ytd-comments")).display === "none");
    await edit("hideRelated", true);
    await player.waitForFunction(() => getComputedStyle(document.querySelector("ytd-watch-next-secondary-results-renderer")).display === "none");
    await popup.evaluate(() => {
      document.querySelector("#tab-layout").click();
      document.querySelector("#reset").click();
    });
    await player.waitForFunction(() => getComputedStyle(document.querySelector("ytd-comments")).display !== "none");
    assert.equal(await player.evaluate(() => document.documentElement.hasAttribute("data-ytc-theme")), true);

    // Restore the original YouTube appearance without altering the player preferences.
    await edit("themeEnabled", false);
    await player.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-theme"));
    assert.deepEqual(await player.evaluate(() => ({
      attribute: document.documentElement.hasAttribute("data-ytc-custom-background"),
      display: getComputedStyle(document.querySelector("#cinematics-container")).display,
      replacementBlocked: document.querySelector("#cinematics-reenabled-by-youtube")?.hasAttribute("data-ytc-ambient-blocked") || false
    })), { attribute: false, display: "block", replacementBlocked: false });
    assert.ok(!(await player.evaluate(() => getComputedStyle(document.documentElement).backgroundImage)).includes(png));
    await edit("themeEnabled", true);
    await player.waitForFunction(expected => getComputedStyle(document.documentElement).backgroundImage.includes(expected), png);
    await player.waitForFunction(() =>
      getComputedStyle(document.querySelector("#cinematics-container")).display === "none"
    );

    await require("./shorts-regression.cjs")({ context, popup });
    await popup.evaluate(tabId => chrome.tabs.update(tabId, { active: true }), tabId);

    await popup.evaluate(() => document.querySelector("#removeBackground").click());
    await player.waitForFunction(() => getComputedStyle(document.documentElement).backgroundImage === "none");
    assert.deepEqual(await player.evaluate(() => ({
      attribute: document.documentElement.hasAttribute("data-ytc-custom-background"),
      display: getComputedStyle(document.querySelector("#cinematics-container")).display
    })), { attribute: false, display: "block" });
    assert.equal(await popup.evaluate(async () =>
      (await chrome.storage.local.get("backgroundImageData")).backgroundImageData
    ), undefined);
    await player.screenshot({ path: path.join(os.tmpdir(), "youtube-theme-watch.png") });

    // Page themes must also apply after a full navigation to the homepage.
    await player.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 40000 });
    await player.waitForFunction(() => document.documentElement.hasAttribute("data-ytc-theme"));
    await player.locator("ytd-masthead #logo").first().waitFor({ state: "visible" });
    await player.locator("ytd-rich-grid-renderer").waitFor({ state: "visible" });
    assert.equal(await player.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), "rgb(0, 128, 128)");
    await edit("pageColor", "#008081");
    await player.waitForFunction(() => getComputedStyle(document.documentElement).backgroundColor === "rgb(0, 128, 129)");
    await popup.waitForFunction(() => !document.querySelector("#status").classList.contains("error"));
    const shortsLink = player.locator('ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])').first();
    await shortsLink.waitFor({ state: "attached" });
    await edit("hideShorts", true);
    await player.waitForFunction(() =>
      getComputedStyle(document.querySelector('ytd-mini-guide-entry-renderer:has(a[href^="/shorts"])')).display === "none"
    );
    await player.screenshot({ path: path.join(os.tmpdir(), "youtube-theme-home.png") });

    // Playlist pages use their own cinematic header and touch-feedback row surfaces.
    await player.goto("https://www.youtube.com/playlist?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj", {
      waitUntil: "domcontentloaded", timeout: 40000
    });
    await player.locator('ytd-browse[page-subtype="playlist"]').waitFor({ state: "visible" });
    for (const selector of [
      'ytd-browse[page-subtype="playlist"] cinematic-container-view-model',
      'ytd-browse[page-subtype="playlist"] .ytPageHeaderViewModelBackground',
      'ytd-browse[page-subtype="playlist"] .ytSpecTouchFeedbackShapeFill'
    ]) {
      assert.equal(
        await player.locator(selector).first().evaluate(element => getComputedStyle(element).backgroundColor),
        "rgba(0, 0, 0, 0)"
      );
    }
    await player.screenshot({ path: path.join(os.tmpdir(), "youtube-theme-playlist.png") });

    // Channel chrome should reveal the customized page background instead of an opaque block.
    await player.goto("https://www.youtube.com/@StephyFilm", {
      waitUntil: "domcontentloaded", timeout: 40000
    });
    await player.locator("ytd-tabbed-page-header #page-header-container").waitFor({ state: "visible" });
    for (const selector of [
      "ytd-tabbed-page-header #page-header-container",
      "ytd-tabbed-page-header #page-header",
      "ytd-tabbed-page-header #tabs-container"
    ]) {
      assert.equal(
        await player.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor),
        "rgba(0, 0, 0, 0)"
      );
    }

    for (const width of [480]) {
      await popup.setViewportSize({ width, height: 600 });
      for (const tab of ["appearance", "player", "layout"]) {
        await popup.evaluate(tab => document.getElementById("tab-" + tab).click(), tab);
        const overflow = await popup.evaluate(() => [...document.querySelectorAll('button, .field, [role="tabpanel"]')]
          .filter(el => el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
          .map(el => el.id || el.className));
        assert.deepEqual(overflow, [], "Popup layout overflow");
        assert.ok(await popup.evaluate(() =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth
        ), "Popup must not have a horizontal page scrollbar");
        await popup.locator(".panel").screenshot({ path: path.join(os.tmpdir(), "youtube-customizer-" + tab + "-" + width + ".png") });
      }
    }
    await popup.evaluate(() => document.querySelector("#resetAll").click());
    await player.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-theme"));
    console.log("PASS: theme preset/colors, wallpaper/fit/remove, layout/reset, theme disable, home navigation, fixed 480px popup without horizontal scrolling.");
  } finally {
    await context.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
