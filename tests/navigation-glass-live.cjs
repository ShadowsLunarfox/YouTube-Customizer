// Inspects the live YouTube navigation surfaces after the theme is applied.
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  const deadline = setTimeout(() => void context.close(), 55000);
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: path.resolve(__dirname, "..") });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");
    await popup.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 360;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      for (let x = 0; x < 360; x += 60) {
        ctx.fillStyle = ["#0d8c6e", "#c3507a", "#345dcc", "#c3a332", "#559181", "#b767cf"][x / 60];
        ctx.fillRect(x, 0, 60, 240);
      }
      await chrome.storage.local.set({ backgroundImageData: canvas.toDataURL() });
      await chrome.storage.sync.set({ themeEnabled: true, backgroundMode: "image", backgroundOpacity: 100,
        surfaceColor: "#212121", uiOpacity: 30 });
    });
    const page = await context.newPage();
    await page.goto(process.env.YT_TEST_URL || "https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.locator("ytd-masthead").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-ytc-theme"));
    await page.waitForTimeout(2500);
    if (process.env.YT_GLASS_DEBUG) {
    const info = await page.evaluate(() => {
      const describe = el => {
        const style = getComputedStyle(el);
        const bounds = el.getBoundingClientRect();
        const pseudo = name => {
          const s = getComputedStyle(el, name);
          return { content: s.content, color: s.backgroundColor, image: s.backgroundImage, filter: s.backdropFilter,
            height: s.height, position: s.position, opacity: s.opacity };
        };
        return { tag: el.localName, id: el.id, class: typeof el.className === "string" ? el.className : "",
          color: style.backgroundColor, image: style.backgroundImage.slice(0, 240), filter: style.backdropFilter,
          opacity: style.opacity, position: style.position, zIndex: style.zIndex,
          rect: { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height }, inline: el.getAttribute("style"),
          before: pseudo("::before"), after: pseudo("::after") };
      };
      const nodes = new Set();
      for (const y of [20, 65, 100]) for (const x of [50, 300, 800, 1300]) {
        document.elementsFromPoint(x, y).forEach(el => nodes.add(el));
      }
      document.querySelectorAll('[id*="frost" i], [class*="frost" i], yt-frosted-glass, ytd-masthead, ytd-feed-filter-chip-bar-renderer').forEach(el => nodes.add(el));
      return [...nodes].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 150 && r.height > 20 && r.y < 130;
      }).map(describe);
    });
    console.log(JSON.stringify(info.filter(item => item.filter !== "none" || /masthead|frost|chip/.test(item.tag + item.id + item.class)), null, 2));
    const layers = await page.evaluate(() => {
      const rules = [];
      const visit = list => {
        for (const rule of list) {
          if (rule.selectorText && /frost|with-chipbar|chips-wrapper|masthead-container|#background.*ytd-masthead/i.test(rule.selectorText)) {
            rules.push(rule.cssText.slice(0, 1300));
          }
          if (rule.cssRules) visit(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        if (sheet.ownerNode?.id === "yt-custom-progress-style") continue;
        try { visit(sheet.cssRules); } catch {}
      }
      let el = document.querySelector("#masthead-container");
      const parents = [];
      while (el) { parents.push(el.localName + "#" + el.id + "." + el.className); el = el.parentElement; }
      return { parents, rules: rules.slice(0, 70) };
    });
    console.log(JSON.stringify(layers, null, 2));
    }
    const realChipBar = await page.locator("ytd-feed-filter-chip-bar-renderer #chips-wrapper").count();
    // Logged-out home can omit chips; exercise its shared backing using the site's loaded CSS.
    await page.evaluate(() => {
      let frosted = document.querySelector("ytd-app #frosted-glass");
      if (!frosted) {
        frosted = document.createElement("div");
        frosted.id = "frosted-glass";
        document.querySelector("ytd-app #content").prepend(frosted);
      }
      frosted.className = "with-chipbar style-scope ytd-app";
      for (const selector of ["ytd-app #frosted-glass", "ytd-masthead #background", "ytd-app #masthead-container"]) {
        const element = document.querySelector(selector);
        element.style.setProperty("background", "black", "important");
        element.style.setProperty("backdrop-filter", "blur(48px)", "important");
      }
    });
    await page.waitForFunction(() => {
      const style = getComputedStyle(document.querySelector("#frosted-glass"));
      return style.backgroundColor === "rgba(0, 0, 0, 0)" && style.backdropFilter === "none";
    });
    for (const opacity of [0, 70, 30]) {
      await popup.evaluate(value => chrome.storage.sync.set({ uiOpacity: value }), opacity);
      await page.waitForFunction(value => document.documentElement.style.getPropertyValue("--ytc-ui-opacity") === String(value / 100), opacity);
      const state = await page.evaluate(() => {
        const masthead = getComputedStyle(document.querySelector("ytd-masthead"));
        const layers = [...document.querySelectorAll("ytd-app #frosted-glass, ytd-app #masthead-container, ytd-masthead #background")];
        const chips = document.querySelector("ytd-feed-filter-chip-bar-renderer #chips-wrapper");
        return { background: masthead.backgroundColor, opacity: masthead.opacity, blur: masthead.backdropFilter,
          chips: chips && { background: getComputedStyle(chips).backgroundColor, blur: getComputedStyle(chips).backdropFilter },
          layers: layers.map(el => ({ id: el.id, background: getComputedStyle(el).backgroundColor,
            blur: getComputedStyle(el).backdropFilter, image: getComputedStyle(el).backgroundImage })) };
      });
      assert.equal(state.background, `rgba(33, 33, 33, ${opacity / 100})`);
      assert.equal(state.opacity, "1");
      assert.equal(state.blur, "blur(12px)", "masthead uses the selected frosted-glass blur");
      if (state.chips) {
        assert.equal(state.chips.background, state.background);
        assert.equal(state.chips.blur, "blur(12px)", "chip bar uses the same frosted-glass blur");
      }
      for (const layer of state.layers) {
        assert.equal(layer.background, "rgba(0, 0, 0, 0)", layer.id);
        assert.equal(layer.blur, "none", layer.id);
        assert.equal(layer.image, "none", layer.id);
      }
    }
    await page.screenshot({ path: path.join(os.tmpdir(), "youtube-navigation-live.png") });
    console.log("PASS: live YouTube masthead, nested fixed container, frosted-glass repaint and opacity changes. Real chip bars: " + realChipBar);
    console.log("Screenshot: " + path.join(os.tmpdir(), "youtube-navigation-live.png"));
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
