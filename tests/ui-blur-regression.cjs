// Checks adjustable frosted surfaces, live slider updates, clear wrappers, and restoration.
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const wallpaper = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const fixture = `<!doctype html><html><head><style>
  body { margin:0; color:white; font:16px sans-serif; }
  ytd-app, [data-blurred], [data-clear] { display:block; }
  [data-blurred] { padding:8px; background:#222; backdrop-filter:blur(5px); }
  [data-clear] { background:#111; backdrop-filter:blur(7px); }
  #frosted-glass::before { content:""; position:absolute; inset:0; background:linear-gradient(black,transparent); backdrop-filter:blur(48px); }
  #fixture-video { width:160px; height:90px; } img { width:80px; height:50px; }
  iframe { width:300px; height:100px; border:0; }
  ytd-watch-flexy { display:flex; gap:24px; }
  ytd-watch-flexy #below { view-transition-name:metadata; }
  ytd-watch-flexy #secondary { view-transition-name:secondary-column; }
  .watch-panel { width:360px; height:160px; box-sizing:border-box; margin-bottom:16px; }
</style></head><body><ytd-app class="with-chipbar">
  <div id="frosted-glass" data-clear></div><div id="masthead-container" data-clear>
    <ytd-masthead id="masthead" data-clear style="backdrop-filter:blur(9px)!important">
      <div id="background" data-frosted-wrapper style="display:none;opacity:0"></div><div id="container" data-clear>Navigation</div>
    </ytd-masthead>
  </div>
  <ytd-feed-filter-chip-bar-renderer data-clear><div id="chips-wrapper" data-blurred>Topics</div></ytd-feed-filter-chip-bar-renderer>
  <ytd-guide-renderer id="guide" data-blurred><div id="guide-inner-content" data-clear>Home</div></ytd-guide-renderer>
  <ytd-page-manager><ytd-browse page-subtype="home">
    <ytd-rich-item-renderer id="video-card" data-blurred>
      <yt-lockup-view-model id="nested-lockup" data-clear><img id="thumbnail" src="${wallpaper}" alt="Thumbnail"><span id="video-title">Video title</span></yt-lockup-view-model>
    </ytd-rich-item-renderer>
    <ytd-rich-shelf-renderer id="shelf" data-blurred>Video shelf</ytd-rich-shelf-renderer>
    <ytd-feed-nudge-renderer><div id="content-wrapper" data-blurred>Feed message</div></ytd-feed-nudge-renderer>
  </ytd-browse></ytd-page-manager>
  <ytd-search><ytd-video-renderer id="search-result" data-blurred>Search result</ytd-video-renderer></ytd-search>
  <ytd-watch-next-secondary-results-renderer data-blurred>
    <ytd-compact-video-renderer id="related-video" data-clear>Related video</ytd-compact-video-renderer>
    <yt-lockup-view-model id="standalone-lockup" data-clear>Related video card</yt-lockup-view-model>
  </ytd-watch-next-secondary-results-renderer>
  <ytd-watch-flexy>
    <div id="below">
      <ytd-watch-metadata><div id="description" class="watch-panel" data-blurred>Description</div></ytd-watch-metadata>
      <ytd-comments id="watch-comments" class="watch-panel" data-blurred>
        <div id="header" data-clear>Comments and input</div>
        <div id="contents" data-clear><ytd-comment-thread-renderer data-clear><div id="body" data-clear>Comment</div></ytd-comment-thread-renderer></div>
      </ytd-comments>
    </div>
    <div id="secondary">
      <ytd-playlist-panel-renderer id="watch-playlist" class="watch-panel" data-blurred>
        <div class="header" data-clear>Playlist</div><div class="playlist-items" data-clear>Video</div>
      </ytd-playlist-panel-renderer>
      <ytd-watch-next-secondary-results-renderer id="watch-related" class="watch-panel" data-blurred>
        <div id="items" data-clear><yt-lockup-view-model data-clear>
          <a id="watch-thumbnail" class="yt-lockup-view-model__content-image"><img src="${wallpaper}" alt="Related video"></a>
          <yt-lockup-metadata-view-model data-clear>Related title</yt-lockup-metadata-view-model>
        </yt-lockup-view-model></div>
      </ytd-watch-next-secondary-results-renderer>
    </div>
  </ytd-watch-flexy>
  <yt-page-header-renderer id="modern-header" data-blurred>
    <yt-page-header-view-model data-clear><div class="ytPageHeaderViewModelBackground" data-clear>Channel header</div></yt-page-header-view-model>
  </yt-page-header-renderer>
  <ytd-menu-popup-renderer id="menu" data-blurred>Menu</ytd-menu-popup-renderer>
  <ytd-menu-popup-renderer id="pixel-panel" data-blurred style="width:256px;height:96px;padding:0"></ytd-menu-popup-renderer>
  <tp-yt-paper-dialog id="dialog" data-blurred role="dialog">
    <yt-sheet-view-model class="ytSheetViewModelHost" data-clear>
      <yt-contextual-sheet-layout class="ytContextualSheetLayoutHost" data-clear>Save to...</yt-contextual-sheet-layout>
    </yt-sheet-view-model>
  </tp-yt-paper-dialog>
  <button id="control" class="ytSpecButtonShapeNextHost" data-blurred aria-pressed="false">Save</button>
  <div class="html5-video-player"><video id="fixture-video"></video><div class="ytp-tooltip-text" id="tooltip" data-blurred>Seek</div></div>
  <ytd-live-chat-frame data-frosted-wrapper><div id="chat" data-clear><iframe data-clear src="/live_chat?v=blur-fixture"></iframe></div></ytd-live-chat-frame>
</ytd-app><script>
  document.getElementById("control").addEventListener("click", event => event.currentTarget.setAttribute("aria-pressed", "true"));
</script></body></html>`;
const chatFixture = `<!doctype html><html><head><style>
  yt-live-chat-renderer { display:block; background:#222; backdrop-filter:blur(5px); }
  #contents { background:#111; backdrop-filter:blur(7px); }
</style></head><body><yt-live-chat-app><yt-live-chat-renderer id="chat-renderer" data-blurred>
  <div id="contents" data-clear>Chat message</div>
</yt-live-chat-renderer></yt-live-chat-app><script>
  document.querySelector("yt-live-chat-renderer").attachShadow({mode:"open"}).innerHTML =
    '<style>#contents{background:#111;backdrop-filter:blur(3px)}</style><div id="contents"><slot></slot></div>';
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width: 1280, height: 1000 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route("https://www.youtube.com/**", route => route.fulfill({ contentType: "text/html",
      body: route.request().url().includes("/live_chat") ? chatFixture : fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: root });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://www.youtube.com/", { waitUntil: "load" });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");
    assert.deepEqual(await popup.evaluate(() => [YTCustomizer.defaults.uiBlur,
      YTCustomizer.normalize({ uiBlur: -1 }).uiBlur, YTCustomizer.normalize({ uiBlur: 50 }).uiBlur,
      YTCustomizer.normalize({ uiBlur: "bad" }).uiBlur]), [12, 0, 30, 12]);
    await popup.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d");
      for (let x = 0; x < canvas.width; x += 8) {
        ctx.fillStyle = x % 16 === 0 ? "#000000" : "#ffffff";
        ctx.fillRect(x, 0, 8, canvas.height);
      }
      await chrome.storage.local.set({ backgroundImageData: canvas.toDataURL("image/png") });
      await chrome.storage.sync.set({ themeEnabled: false, backgroundMode: "image", backgroundFit: "tile", backgroundOpacity: 100, uiOpacity: 30 });
    });
    await popup.reload();
    await popup.waitForSelector("#settings-form:not([inert])");
    const activate = () => popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/" });
      await chrome.tabs.update(tab.id, { active: true });
    });
    await activate();
    const chat = page.frames().find(frame => frame.url().includes("/live_chat"));
    assert.ok(chat, "chat frame is available");
    const scopes = [page, chat];
    const originals = [];
    for (const scope of scopes) originals.push(await scope.locator("[data-blurred], [data-clear], [data-frosted-wrapper]").evaluateAll(elements =>
      elements.map(element => ({ blur: getComputedStyle(element).backdropFilter,
        inline: element.style.getPropertyValue("backdrop-filter"), priority: element.style.getPropertyPriority("backdrop-filter") }))));
    assert.equal(await popup.locator("#uiBlur").getAttribute("min"), "0");
    assert.equal(await popup.locator("#uiBlur").getAttribute("max"), "30");

    async function edit(id, value) {
      await popup.evaluate(({ id, value }) => {
        const input = document.getElementById(id);
        if (input.type === "checkbox") input.checked = value;
        else input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }, { id, value });
    }
    async function verify(value, opacity = 30) {
      for (const scope of scopes) {
        await scope.waitForFunction(({ value, opacity }) => {
          const root = document.documentElement;
          const expectedBlur = "blur(" + value + "px)";
          return root.style.getPropertyValue("--ytc-ui-blur") === value + "px" &&
            root.style.getPropertyValue("--ytc-ui-opacity") === String(opacity / 100) &&
            [...document.querySelectorAll("[data-blurred]")].every(element => {
              const style = getComputedStyle(element);
              const parts = style.backgroundColor.match(/[\d.]+/g).map(Number);
              return element.hasAttribute("data-ytc-universal-glass") &&
                (style.backdropFilter === expectedBlur || value === 0 && style.backdropFilter === "none") &&
                (parts.length === 4 ? parts[3] : 1) === opacity / 100 && style.filter === "none" && style.opacity === "1";
            }) && [...document.querySelectorAll("[data-frosted-wrapper]")].every(element => {
              const style = getComputedStyle(element);
              return (style.backdropFilter === expectedBlur || value === 0 && style.backdropFilter === "none") &&
                style.backgroundColor === "rgba(0, 0, 0, 0)";
            }) && [...document.querySelectorAll("[data-clear]")].every(element =>
              getComputedStyle(element).backdropFilter === "none");
        }, { value, opacity });
      }
      assert.equal(await popup.locator("#uiBlurValue").textContent(), String(value));
      assert.deepEqual(await page.locator("#below, #secondary").evaluateAll(elements =>
        elements.map(element => getComputedStyle(element).viewTransitionName)),
      value === 0 ? ["metadata", "secondary-column"] : ["none", "none"],
      "watch backdrop boundaries are released only while blur is on");
      assert.equal(await chat.evaluate(() => getComputedStyle(document.querySelector("yt-live-chat-renderer").shadowRoot.querySelector("#contents")).backdropFilter), "none", "chat shadow wrappers do not add a second blur");
      assert.equal(await page.locator("#frosted-glass").evaluate(element => getComputedStyle(element, "::before").backdropFilter), "none", "native dark overlay blur stays cleared");
    }

    await edit("uiBlur", 12);
    await verify(12);
    assert.equal(await popup.locator("#themeEnabled").isChecked(), true, "editing blur enables the theme");
    const originalCss = await Promise.all(scopes.map(scope => scope.locator("#yt-custom-progress-style").textContent()));
    for (const scope of scopes) await scope.evaluate(() => {
      window.surfaceWrites = 0;
      window.blurObserver = new MutationObserver(records => {
        window.surfaceWrites += records.filter(record => record.target !== document.documentElement).length;
      });
      window.blurObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style"], childList: true, subtree: true });
    });
    for (const value of [0, 24, 30, 12]) {
      await edit("uiBlur", value);
      await verify(value);
    }
    await edit("uiOpacity", 70);
    await verify(12, 70);
    for (const [index, scope] of scopes.entries()) {
      assert.equal(await scope.locator("#yt-custom-progress-style").textContent(), originalCss[index], "blur/opacity sliders keep the main CSS intact");
      assert.equal(await scope.evaluate(() => { window.blurObserver.disconnect(); return window.surfaceWrites; }), 0,
        "live sliders only update root tokens, without rewriting descendant styles");
    }

    for (const selector of ["#thumbnail", "#video-title", "#fixture-video", "#control"]) {
      const state = await page.locator(selector).evaluate(element => {
        const style = getComputedStyle(element);
        return { filter: style.filter, opacity: style.opacity, visibility: style.visibility,
          imageLoaded: !(element instanceof HTMLImageElement) || element.complete && element.naturalWidth > 0 };
      });
      assert.deepEqual(state, { filter: "none", opacity: "1", visibility: "visible", imageLoaded: true }, selector + " stays sharp and visible");
    }
    await page.locator("#control").click();
    assert.equal(await page.locator("#control").getAttribute("aria-pressed"), "true");

    // Measure actual rendered contrast: the striped wallpaper must blur behind an empty panel.
    async function panelContrast(selector = "#pixel-panel") {
      const png = await page.locator(selector).screenshot();
      return page.evaluate(async pngData => {
        const image = new Image();
        image.src = "data:image/png;base64," + pngData;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(32, Math.floor(image.height / 2), image.width - 64, 1).data;
        const values = [];
        for (let index = 0; index < pixels.length; index += 4) values.push((pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
      }, png.toString("base64"));
    }
    await edit("uiOpacity", 30);
    await edit("uiBlur", 0);
    await verify(0);
    const clearContrast = await panelContrast();
    const watchPanels = ["#description", "#watch-comments", "#watch-playlist", "#watch-related"];
    const sharpWatch = [];
    for (const selector of watchPanels) sharpWatch.push(await panelContrast(selector));
    await edit("uiBlur", 24);
    await verify(24);
    const frostedContrast = await panelContrast();
    for (const [index, selector] of watchPanels.entries()) {
      const frosted = await panelContrast(selector);
      assert.ok(sharpWatch[index] > 25 && frosted < sharpWatch[index] * 0.35,
        selector + " visibly blurs the wallpaper: " + sharpWatch[index] + " -> " + frosted);
    }
    // Reproduce the native compositor boundary: computed blur alone must not count as a pass.
    await page.locator("#below").evaluate(element => element.style.setProperty("view-transition-name", "metadata", "important"));
    assert.equal(await page.locator("#description").evaluate(element => getComputedStyle(element).backdropFilter), "blur(24px)");
    assert.ok(await panelContrast("#description") > 25, "native view-transition boundary blocks the visible blur");
    await page.locator("#below").evaluate(element => element.style.removeProperty("view-transition-name"));
    assert.equal(await page.locator("#watch-thumbnail").evaluate(element => getComputedStyle(element, "::after").content), "none",
      "recommended thumbnails have no frosted overlay over the image");
    assert.ok(clearContrast > 25, "0 px leaves visible wallpaper stripes, contrast: " + clearContrast);
    assert.ok(frostedContrast < clearContrast * 0.35,
      "frost visibly softens background contrast: " + clearContrast + " → " + frostedContrast);
    await edit("uiOpacity", 70);
    await edit("uiBlur", 12);
    await verify(12, 70);
    await popup.reload();
    await popup.waitForSelector("#settings-form:not([inert])");
    await activate();
    assert.equal(await popup.locator("#uiBlur").inputValue(), "12", "blur persists after reopening the popup");
    assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "new slider fits popup width");
    await edit("uiBlur", 24);
    await verify(24, 70);
    await edit("themeEnabled", false);
    for (const [index, scope] of scopes.entries()) {
      await scope.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-theme") &&
        !document.querySelector("[data-ytc-universal-glass], [data-ytc-universal-clear]"));
      const restored = await scope.locator("[data-blurred], [data-clear], [data-frosted-wrapper]").evaluateAll(elements => elements.map(element => ({
        blur: getComputedStyle(element).backdropFilter, inline: element.style.getPropertyValue("backdrop-filter"),
        priority: element.style.getPropertyPriority("backdrop-filter")
      })));
      assert.deepEqual(restored, originals[index], "theme disable restores original blur and inline priorities");
      assert.equal(await scope.locator("html").evaluate(element => element.style.getPropertyValue("--ytc-ui-blur")), "", "theme disable removes the blur token");
    }
    assert.equal(await chat.evaluate(() => getComputedStyle(document.querySelector("yt-live-chat-renderer").shadowRoot.querySelector("#contents")).backdropFilter), "blur(3px)", "theme disable restores shadow content blur");
    assert.deepEqual(await page.locator("#below, #secondary").evaluateAll(elements =>
      elements.map(element => getComputedStyle(element).viewTransitionName)), ["metadata", "secondary-column"],
    "theme disable restores native view transitions");
    await edit("themeEnabled", true);
    await verify(24, 70);
    await popup.locator("#reset").click();
    await popup.waitForFunction(() => document.getElementById("uiBlur").value === "12");
    assert.deepEqual(errors, []);
    console.log("PASS: 0–30px UI blur, live root-token updates, opacity independence, navigation/cards/menu/dialog/chat surfaces, sharp controls/media, persistence/reset, and original-style restoration.");
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
