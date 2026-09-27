// Checks chat-frame styling and transparency with a custom page background enabled.
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
    await page.goto("https://www.youtube.com/watch?v=RDD9lKvjrc8", {
      waitUntil: "domcontentloaded", timeout: 40000
    });
    await page.locator("ytd-live-chat-frame iframe").waitFor({ state: "attached", timeout: 40000 });

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

    await page.waitForTimeout(12000);
    const chatFrame = page.frames().find(frame => frame.url().includes("live_chat"));
    assert.ok(chatFrame, "live chat iframe should load");
    const state = await chatFrame.evaluate(() => {
      const renderer = document.querySelector("yt-live-chat-renderer");
      const shadow = renderer?.shadowRoot;
      const describe = element => element && {
        name: element.localName,
        id: element.id,
        background: getComputedStyle(element).backgroundColor,
        image: getComputedStyle(element).backgroundImage
      };
      return {
        themed: document.documentElement.hasAttribute("data-ytc-theme"),
        bodyText: document.body.innerText.slice(0, 500),
        bodyChildren: [...document.body.children].map(element => ({
          name: element.localName,
          id: element.id,
          className: typeof element.className === "string" ? element.className : ""
        })),
        renderer: describe(renderer),
        forcedBackground: renderer?.style.getPropertyValue("background-color"),
        forcedBackgroundPriority: renderer?.style.getPropertyPriority("background-color"),
        universalGlass: renderer?.hasAttribute("data-ytc-universal-glass"),
        shadowStyle: Boolean(shadow?.querySelector("style[data-ytc-live-chat-surface]")),
        surfaces: shadow ? ["#contents", "#chat-messages", "#item-scroller", "#panel-pages", "#header", "#input-panel"]
          .map(selector => describe(shadow.querySelector(selector))).filter(Boolean) : []
      };
    });
    assert.equal(state.themed, true, "chat iframe should receive the theme");
    assert.ok(state.renderer, "live chat renderer should exist");
    assert.equal(state.forcedBackground, "var(--ytc-universal-glass)", "renderer background should use the universal glass override");
    assert.equal(state.forcedBackgroundPriority, "important", "renderer override should outrank YouTube styles");
    assert.equal(state.universalGlass, true, "renderer should be marked by the universal glass scan");
    console.log("PASS: live chat iframe forced surface override (" + state.renderer.background + ").");
  } finally {
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
