// Verifies that navigation surfaces reveal the wallpaper instead of reverting to opaque fills.
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const wallpaper = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const settings = {
  themeEnabled: true,
  pageColor: "#101010",
  surfaceColor: "#202020",
  textColor: "#f1f1f1",
  accentColor: "#3ea6ff",
  backgroundMode: "image",
  backgroundFit: "cover",
  backgroundOpacity: 40,
  panelOpacity: 60
};
const selectors = [
  "ytd-masthead", "ytd-masthead #background", "ytd-masthead #container",
  "ytd-mini-guide-renderer", "ytd-mini-guide-renderer #items",
  "ytd-guide-renderer", "ytd-guide-renderer #guide-inner-content",
  "ytd-guide-renderer #sections", "ytd-guide-renderer #guide-content",
  "ytd-feed-filter-chip-bar-renderer", "ytd-feed-filter-chip-bar-renderer #chips-wrapper",
  "yt-chip-cloud-renderer"
];

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome",
    headless: true,
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--enable-unsafe-extension-debugging"]
  });
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: root });
    const page = await context.newPage();
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.evaluate(async ({ settings, wallpaper }) => {
      await chrome.storage.sync.set(settings);
      await chrome.storage.local.set({ backgroundImageData: wallpaper });
    }, { settings, wallpaper });

    async function inject(url, expectChips = false) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
      await page.locator("ytd-masthead #guide-button").waitFor({ state: "attached" });
      await popup.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["settings.js", "content/surface-controller.js", "content/shorts-controller.js", "content/homepage-glass.js", "content/home-shorts-grid.js", "content/audio-controller.js", "yt.js"]
        });
      });
      await page.waitForFunction(() => document.documentElement.hasAttribute("data-ytc-theme"));
      await page.locator("ytd-masthead #guide-button").click();
      await page.waitForTimeout(1200);
      const state = await page.evaluate(selectors => Object.fromEntries(selectors.map(selector => {
        const element = document.querySelector(selector);
        const style = element && getComputedStyle(element);
        return [selector, element && {
          background: style.backgroundColor,
          image: style.backgroundImage,
          inlineBackground: element.style.getPropertyValue("background-color"),
          inlinePriority: element.style.getPropertyPriority("background-color"),
          universalGlass: element.hasAttribute("data-ytc-universal-glass"),
          visible: element.getBoundingClientRect().width >= 2 && element.getBoundingClientRect().height >= 2
        }];
      })), selectors);
      const customBackgroundEnabled = await page.evaluate(() =>
        document.documentElement.hasAttribute("data-ytc-custom-background")
      );
      const expectedPanels = ["ytd-masthead", "ytd-masthead #background", "ytd-mini-guide-renderer", "ytd-guide-renderer"];
      const chipPanels = ["ytd-feed-filter-chip-bar-renderer", "ytd-feed-filter-chip-bar-renderer #chips-wrapper", "yt-chip-cloud-renderer"];
      if (expectChips) {
        const renderedChips = chipPanels.filter(selector => state[selector]);
        expectedPanels.push(...renderedChips);
      }
      for (const selector of expectedPanels.filter(selector => state[selector]?.visible)) {
        assert.equal(state[selector].inlineBackground, "var(--ytc-universal-glass)",
          selector + " should use the forced universal glass layer (custom background: " + customBackgroundEnabled +
          ", glass mark: " + state[selector].universalGlass + ")");
        assert.equal(state[selector].inlinePriority, "important", selector + " should override YouTube backgrounds");
        assert.equal(state[selector].universalGlass, true, selector + " should be marked by the universal glass scan");
      }
      await page.locator("ytd-masthead #background").evaluate(element =>
        element.style.setProperty("background", "#000000", "important")
      );
      await page.waitForFunction(() => {
        const background = document.querySelector("ytd-masthead #background");
        if (!background) return false;
        const style = getComputedStyle(background);
        return !/#000|rgb\(0,\s*0,\s*0\)/i.test(background.style.getPropertyValue("background")) &&
          background.style.getPropertyValue("background-color") === "var(--ytc-universal-glass)" &&
          background.style.getPropertyPriority("background-color") === "important" &&
          style.backgroundColor === "rgba(32, 32, 32, 0.3)" && style.backgroundImage === "none";
      });
      return state;
    }

    await inject("https://www.youtube.com/", true);
    await inject("https://www.youtube.com/watch?v=jNQXAC9IVRw");
    console.log("PASS: homepage and watch-page navigation use one forced transparent panel.");
  } finally {
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
