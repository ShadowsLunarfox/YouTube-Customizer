// Checks that the custom theme keeps the YouTube navigation drawer transparent.
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
    await page.goto("https://www.youtube.com/watch?v=LH-EvEfpZgI", {
      waitUntil: "domcontentloaded", timeout: 40000
    });
    await page.locator("ytd-masthead #guide-button").waitFor({ state: "attached" });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.evaluate(async ({ settings, wallpaper }) => {
      await chrome.storage.sync.set(settings);
      await chrome.storage.local.set({ backgroundImageData: wallpaper });
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/watch*" });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["settings.js", "content/surface-controller.js", "content/shorts-controller.js", "content/homepage-glass.js", "yt.js"]
      });
    }, { settings, wallpaper });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-ytc-custom-background"));
    await page.locator("ytd-masthead #guide-button").click();
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => {
      const describe = element => element && {
        name: element.localName,
        id: element.id,
        className: typeof element.className === "string" ? element.className : "",
        background: getComputedStyle(element).backgroundColor,
        image: getComputedStyle(element).backgroundImage,
        inline: element.style.getPropertyValue("background-color"),
        glass: element.hasAttribute("data-ytc-universal-glass")
      };
      return describe(document.querySelector("ytd-app #guide-content"));
    });
    assert.ok(state, "hamburger menu content should exist");
    assert.equal(state.inline, "transparent", "hamburger menu content should be force-cleared");
    console.log("PASS: hamburger menu content is transparent.");
  } finally {
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
