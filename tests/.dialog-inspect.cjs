const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: path.resolve(__dirname, "..") });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.evaluate(() => chrome.storage.sync.set({ themeEnabled: true, uiOpacity: 30, uiBlur: 12 }));
    const page = await context.newPage();
    await page.goto("https://www.youtube.com/watch?v=jNQXAC9IVRw", { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.locator("ytd-watch-metadata").waitFor({ state: "attached", timeout: 30000 });
    await page.waitForTimeout(1500);
    async function inspect(label, selector) {
      console.log(JSON.stringify({ label, state: await page.evaluate(selector => {
        const visible = el => { const r = el.getBoundingClientRect(); return r.width > 50 && r.height > 30; };
        const description = el => {
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          return { tag: el.localName, id: el.id, cls: typeof el.className === "string" ? el.className.slice(0, 100) : "",
            role: el.getAttribute("role"), attr: el.hasAttribute("data-ytc-universal-glass") ? "glass" : el.hasAttribute("data-ytc-universal-clear") ? "clear" : "",
            background: s.backgroundColor, image: s.backgroundImage.slice(0, 120), blur: s.backdropFilter,
            position: s.position, size: [Math.round(r.width), Math.round(r.height)] };
        };
        return [...document.querySelectorAll(selector)].filter(visible).slice(0, 5).map(root => ({
          root: description(root), ancestors: [...(function* () { for (let el = root.parentElement, i = 0; el && i < 5; el = el.parentElement, i++) yield el; })()].map(description),
          paints: [...root.querySelectorAll("*")].filter(visible).map(description).filter(d =>
            d.background !== "rgba(0, 0, 0, 0)" || d.image !== "none").sort((a, b) => b.size[0] * b.size[1] - a.size[0] * a.size[1]).slice(0, 25),
          text: root.textContent.trim().replace(/\s+/g, " ").slice(0, 180)
        }));
      }, selector) }, null, 2));
    }
    await page.getByRole("button", { name: "Search with your voice" }).click();
    await page.waitForTimeout(800);
    await inspect("voice", "ytd-voice-search-dialog-renderer, ytd-voice-search-dialog-renderer #voice-search-dialog, tp-yt-paper-dialog");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    console.log("more actions", await page.locator('ytd-watch-metadata button[aria-label="More actions"]').count());
    await page.locator('ytd-watch-metadata button[aria-label="More actions"]').first().click();
    await page.waitForTimeout(500);
    console.log("menu text", await page.locator("ytd-menu-popup-renderer").last().textContent());
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
