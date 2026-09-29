// Verifies Save-to-playlist dialog transparency with nested and dynamically replaced surfaces.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const thumbnail = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const darkStyle = "background:rgb(38,38,38) linear-gradient(#262626,#181818)!important;box-shadow:0 2px 8px black!important";
const fixture = `<!doctype html><html><head><style>
  body { margin:24px; color:#f1f1f1; font:14px sans-serif; }
  ytd-popup-container, [data-layer] { display:block; }
  [data-panel] { width:300px; margin:16px; border-radius:12px; overflow:hidden; }
  .ytSheetViewModelContextual { backdrop-filter:blur(8px); border-radius:12px; overflow:hidden; }
  [data-row] { display:flex; align-items:center; gap:12px; padding:12px; }
  img { width:44px; height:30px; object-fit:cover; }
  button { color:inherit; padding:8px; border:0; cursor:pointer; }
  svg { width:18px; height:18px; fill:currentColor; }
</style></head><body><ytd-app><ytd-popup-container>
  <tp-yt-paper-dialog id="modern-panel" data-panel data-layer style="${darkStyle}" role="dialog">
    <yt-dialog-view-model class="ytDialogViewModelHost" data-layer style="${darkStyle}">
      <div class="ytSpecDialogLayoutHost" data-layer style="${darkStyle}">
        <yt-sheet-view-model class="ytSheetViewModelHost ytSheetViewModelContextual" data-layer style="${darkStyle}">
          <yt-contextual-sheet-layout class="ytContextualSheetLayoutHost" data-layer style="${darkStyle}">
            <h2>Save to...</h2>
            <div class="ytContextualSheetLayoutContentContainer" data-layer style="${darkStyle}">
              <div data-row><img id="playlist-thumbnail" src="${thumbnail}" alt="Playlist thumbnail">
                <span id="playlist-label">Watch later</span>
                <button id="playlist-toggle" aria-label="Save to Watch later" aria-pressed="false">
                  <svg id="playlist-icon" viewBox="0 0 24 24"><path d="M5 3h14v18l-7-5-7 5z"></path></svg>
                </button>
              </div>
            </div>
            <div class="ytContextualSheetLayoutFooterContainer" data-layer style="${darkStyle}">
              <button id="new-playlist" class="ytSpecButtonShapeNextHost">+ New playlist</button>
            </div>
          </yt-contextual-sheet-layout>
        </yt-sheet-view-model>
      </div>
    </yt-dialog-view-model>
  </tp-yt-paper-dialog>
  <tp-yt-paper-dialog id="legacy-panel" data-panel data-layer style="${darkStyle}" role="dialog">
    <ytd-add-to-playlist-renderer data-layer style="${darkStyle}">
      <div id="playlists" data-layer style="${darkStyle}">
        <ytd-playlist-add-to-option-renderer data-layer style="${darkStyle}">Watch later</ytd-playlist-add-to-option-renderer>
      </div>
    </ytd-add-to-playlist-renderer>
  </tp-yt-paper-dialog>
  <div id="standalone-panel" class="ytContextualSheetLayoutHost" data-panel data-layer style="${darkStyle}">
    <div class="ytContextualSheetLayoutContentContainer" data-layer style="${darkStyle}">Standalone Save dialog</div>
    <div class="ytContextualSheetLayoutFooterContainer" data-layer style="${darkStyle}">New playlist</div>
  </div>
  <div id="bottom-sheet-panel" class="ytSpecBottomSheetLayoutContainer" data-panel data-layer style="${darkStyle}">
    <div class="ytSpecBottomSheetLayoutHeaderWrapper" data-layer style="${darkStyle}">Save to...</div>
    <div class="ytSpecBottomSheetLayoutContentWrapper" data-layer style="${darkStyle}">
      <yt-list-view-model class="ytListViewModelHost" data-layer style="${darkStyle}">Watch later</yt-list-view-model>
    </div>
    <div class="ytSpecBottomSheetLayoutFooterWrapper" data-layer style="${darkStyle}">New playlist</div>
  </div>
  <tp-yt-paper-dialog id="download-quality-panel" data-panel data-layer role="dialog" style="${darkStyle}">
    <ytd-download-quality-selector-renderer data-layer style="${darkStyle}">
      <yt-formatted-string id="title">Download Quality</yt-formatted-string>
      <ytd-download-quality-selector-content data-layer style="${darkStyle}">
        <div id="quality-options" data-layer style="${darkStyle}">Standard (480p)</div>
        <div id="upsell-section" data-layer style="${darkStyle}">Premium</div>
      </ytd-download-quality-selector-content>
      <div class="buttons" data-layer style="${darkStyle}">
        <button id="download-quality-cancel">Cancel</button><button>Download</button>
      </div>
    </ytd-download-quality-selector-renderer>
  </tp-yt-paper-dialog>
</ytd-popup-container></ytd-app><script>
  document.getElementById("playlist-toggle").addEventListener("click", event => {
    const button = event.currentTarget;
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
  });
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width: 1100, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route("https://www.youtube.com/**", route => route.fulfill({ contentType: "text/html", body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: root });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://www.youtube.com/watch?v=save-dialog-fixture", { waitUntil: "load" });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");
    await popup.evaluate(async wallpaper => {
      await chrome.storage.local.set({ backgroundImageData: wallpaper });
      await chrome.storage.sync.set({ themeEnabled: true, surfaceColor: "#212121", uiOpacity: 30, uiBlur: 12,
        backgroundMode: "image", textColor: "#f1f1f1" });
    }, thumbnail);

    async function setOpacity(value) {
      await popup.evaluate(uiOpacity => chrome.storage.sync.set({ uiOpacity }), value);
      await verifyLayers(value);
    }

    async function verifyLayers(value) {
      await page.waitForFunction(expected => {
        if (document.documentElement.style.getPropertyValue("--ytc-ui-opacity") !== String(expected / 100)) return false;
        return [...document.querySelectorAll("[data-panel]")].every(panel => {
          const layers = [panel, ...panel.querySelectorAll("[data-layer]")];
          const alpha = layers.map(element => {
            const parts = getComputedStyle(element).backgroundColor.match(/[\d.]+/g).map(Number);
            return parts.length === 4 ? parts[3] : 1;
          });
          return alpha.filter(value => value !== 0).length === (expected ? 1 : 0) &&
            alpha.every(value => value === 0 || value === expected / 100) &&
            getComputedStyle(panel).backdropFilter === "blur(12px)" &&
            layers.slice(1).every(element => getComputedStyle(element).backdropFilter === "none") &&
            layers.every(element => getComputedStyle(element).backgroundImage === "none");
        });
      }, value);
      const layers = await page.locator("[data-layer]").evaluateAll(elements => elements.map(element => ({
        name: element.localName + "." + element.className,
        opacity: getComputedStyle(element).opacity,
        image: getComputedStyle(element).backgroundImage
      })));
      for (const layer of layers) {
        assert.equal(layer.opacity, "1", layer.name + " does not fade its contents");
        assert.equal(layer.image, "none", layer.name + " clears opaque background images");
      }
    }

    for (const value of [0, 30, 70, 100]) {
      await setOpacity(value);
      if (value === 0 || value === 30) await page.screenshot({
        path: path.join(os.tmpdir(), "youtube-save-dialog-opacity-" + value + ".png"), fullPage: true
      });
    }
    await setOpacity(30);
    assert.equal(await page.locator(".ytSheetViewModelContextual").evaluate(element => getComputedStyle(element).backdropFilter), "none", "nested sheet blur does not obscure transparency");
    const legibility = await page.evaluate(() => ["playlist-thumbnail", "playlist-label", "playlist-toggle", "playlist-icon", "new-playlist"]
      .map(id => {
        const element = document.getElementById(id);
        const style = getComputedStyle(element);
        return { id, opacity: style.opacity, visibility: style.visibility, color: style.color,
          displayed: element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
          imageLoaded: !(element instanceof HTMLImageElement) || element.complete && element.naturalWidth > 0 };
      }));
    for (const item of legibility) {
      assert.equal(item.opacity, "1", item.id + " remains opaque");
      assert.equal(item.visibility, "visible", item.id + " remains visible");
      assert.equal(item.displayed, true, item.id + " retains its layout");
      assert.equal(item.imageLoaded, true, item.id + " preserves its media");
    }
    await page.locator("#playlist-toggle").click();
    assert.equal(await page.locator("#playlist-toggle").getAttribute("aria-pressed"), "true", "playlist controls remain clickable");

    // Some layouts are inserted before YouTube assigns their identifying class or dialog role.
    await page.evaluate(async darkStyle => {
      const pending = ["late-class-panel", "late-role-panel"].map(id => {
        const element = document.createElement("div");
        element.id = id;
        element.style.cssText = darkStyle;
        element.textContent = "Late dialog surface";
        document.querySelector("ytd-popup-container").append(element);
        return element;
      });
      await new Promise(resolve => setTimeout(resolve, 160));
      pending[0].className = "ytContextualSheetLayoutHost";
      pending[1].setAttribute("role", "dialog");
      for (const element of pending) {
        element.dataset.panel = "";
        element.dataset.layer = "";
      }
    }, darkStyle);
    await verifyLayers(30);
    await page.evaluate(() => {
      document.getElementById("late-class-panel").removeAttribute("class");
      document.getElementById("late-role-panel").removeAttribute("role");
    });
    await page.waitForFunction(() => ["late-class-panel", "late-role-panel"].every(id => {
      const element = document.getElementById(id);
      const style = getComputedStyle(element);
      return style.backgroundColor === "rgb(38, 38, 38)" && style.backgroundImage !== "none" &&
        !element.hasAttribute("data-ytc-universal-glass") && !element.hasAttribute("data-ytc-universal-clear");
    }));
    await page.locator("#late-class-panel, #late-role-panel").evaluateAll(elements => elements.forEach(element => element.remove()));

    // YouTube can repaint existing wrappers or replace their contents after the popup opens.
    await page.locator("[data-layer]").evaluateAll(elements => {
      for (const element of elements) element.style.setProperty("background", "rgb(12, 13, 14)", "important");
    });
    await verifyLayers(30);
    await page.evaluate(darkStyle => {
      const previous = document.querySelector("#modern-panel .ytContextualSheetLayoutContentContainer");
      const replacement = document.createElement("div");
      replacement.className = previous.className;
      replacement.dataset.layer = "";
      replacement.id = "replacement-playlists";
      replacement.style.cssText = darkStyle;
      replacement.textContent = "Replacement playlists";
      previous.replaceWith(replacement);
    }, darkStyle);
    await verifyLayers(30);
    await setOpacity(70);

    const mutations = await page.evaluate(() => new Promise(resolve => {
      let count = 0;
      const observer = new MutationObserver(records => { count += records.length; });
      observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(count); }, 400);
    }));
    assert.ok(mutations < 50, "dialog style enforcement settles, observed mutations: " + mutations);

    await popup.evaluate(() => chrome.storage.sync.set({ themeEnabled: false }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-theme") &&
      [...document.querySelectorAll("[data-layer]")].every(element =>
        !element.hasAttribute("data-ytc-universal-glass") && !element.hasAttribute("data-ytc-universal-clear")));
    const restored = await page.locator("[data-layer]").evaluateAll(elements => elements.map(element => ({
      replacement: element.id === "replacement-playlists", color: getComputedStyle(element).backgroundColor,
      priority: element.style.getPropertyPriority("background"), shadow: getComputedStyle(element).boxShadow
    })));
    for (const layer of restored) {
      assert.equal(layer.color, layer.replacement ? "rgb(38, 38, 38)" : "rgb(12, 13, 14)", "theme disable restores the latest YouTube paint");
      assert.equal(layer.priority, "important", "original inline background priority is restored");
      assert.notEqual(layer.shadow, "none", "original shadow is restored");
    }
    assert.equal(await page.locator(".ytSheetViewModelContextual").evaluate(element => getComputedStyle(element).backdropFilter), "blur(8px)", "theme disable restores the original sheet blur");
    await popup.evaluate(() => chrome.storage.sync.set({ themeEnabled: true }));
    await verifyLayers(70);
    assert.deepEqual(errors, []);
    console.log("PASS: Save and Download Quality dialogs use one shared-opacity layer, survive repaint/replacement, preserve controls/media, and restore original surfaces when disabled.");
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
