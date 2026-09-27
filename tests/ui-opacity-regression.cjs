// Verifies shared UI opacity, live updates, persistence, and observer stability on a local fixture.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const wallpaper = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const fixture = `<!doctype html><html><head><style>
  body { margin:0; background:#111; color:white; font:16px sans-serif; }
  [data-surface] { display:block; background:#111; padding:6px; }
  ytd-app { display:block; } #fixture-video { width:240px; height:135px; background:#111; }
  iframe { width:300px; height:150px; border:0; }
  #frosted-glass { position:fixed; top:0; width:100%; height:112px; background:#111; backdrop-filter:blur(48px); }
  #frosted-glass::before { content:""; position:absolute; inset:0; background:linear-gradient(black, transparent); backdrop-filter:blur(48px); }
  ytd-masthead #background { backdrop-filter:blur(48px); }
  #chips-wrapper { position:fixed; top:56px; width:100%; background:#111; backdrop-filter:blur(48px); }
</style></head><body><ytd-app class="with-chipbar">
  <div id="content"><div id="frosted-glass" class="with-chipbar style-scope ytd-app"></div>
  <div id="masthead-container"><ytd-masthead data-surface>
    <div id="background" style="background:#111"></div>
    <div id="container" style="background:#111"><span id="fixture-text">YouTube</span>
      <div id="center" style="background:#111"><yt-searchbox id="search">
        <div class="ytSearchboxComponentInputContainer" data-surface>
          <div class="ytSearchboxComponentInputBox"><input aria-label="Search" placeholder="Search"></div>
        </div><button class="ytSearchboxComponentSearchButton" data-surface>Search</button>
      </yt-searchbox></div>
    </div>
  </ytd-masthead></div></div>
  <ytd-guide-renderer data-surface><div id="guide"><div id="guide-inner-content">Home</div></div></ytd-guide-renderer>
  <ytd-feed-filter-chip-bar-renderer><div id="chips-wrapper" data-surface><yt-chip-cloud-renderer>
    <yt-chip-cloud-chip-renderer selected data-surface><div id="chip-container">Music</div></yt-chip-cloud-chip-renderer>
  </yt-chip-cloud-renderer></div></ytd-feed-filter-chip-bar-renderer>
  <ytd-page-manager><ytd-browse page-subtype="home"><ytd-rich-section-renderer>
    <ytd-rich-item-renderer data-surface><img id="thumbnail" alt="Thumbnail" src="${wallpaper}"></ytd-rich-item-renderer>
  </ytd-rich-section-renderer></ytd-browse></ytd-page-manager>
  <div class="html5-video-player"><video id="fixture-video"></video><div class="ytp-play-progress"></div></div>
  <ytd-watch-metadata><div id="description" data-surface>Description</div></ytd-watch-metadata>
  <ytd-comments><div id="contents" data-surface>Comments</div></ytd-comments>
  <ytd-playlist-panel-renderer data-surface><div id="header">Playlist</div><div id="items">Track</div></ytd-playlist-panel-renderer>
  <ytd-tabbed-page-header data-surface><div id="page-header-container">Channel</div></ytd-tabbed-page-header>
  <ytd-menu-popup-renderer data-surface>Menu</ytd-menu-popup-renderer>
  <button class="ytSpecButtonShapeNextHost" data-surface>Like<span class="ytSpecTouchFeedbackShapeFill"></span></button>
  <ytd-live-chat-frame><div id="chat"><iframe src="/live_chat?v=fixture"></iframe></div></ytd-live-chat-frame>
</ytd-app></body></html>`;
const chatFixture = `<!doctype html><html><head><style>
  html, body, yt-live-chat-app, yt-live-chat-renderer, #contents { background:#111; }
  yt-live-chat-renderer { display:block; min-height:100px; color:white; }
</style></head><body><yt-live-chat-app><yt-live-chat-renderer>
  <div id="contents"><yt-live-chat-header-renderer>Top chat</yt-live-chat-header-renderer>Message</div>
</yt-live-chat-renderer></yt-live-chat-app><script>
  document.querySelector('yt-live-chat-renderer').attachShadow({mode:'open'}).innerHTML =
    '<style>#contents {background:#111}</style><div id="contents"><slot></slot></div>';
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width: 1280, height: 900 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    // Use deterministic YouTube-shaped documents; the suite requires no external network.
    await context.route("https://www.youtube.com/**", route => route.fulfill({
      contentType: "text/html", body: route.request().url().includes("/live_chat") ? chatFixture : fixture
    }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: root });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://www.youtube.com/", { waitUntil: "load" });
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 480, height: 600 });
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");
    const activate = () => popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
      await chrome.tabs.update(tab.id, { active: true });
      return tab.id;
    });
    const tabId = await activate();
    let chat = page.frames().find(frame => frame.url().includes("/live_chat"));
    assert.ok(chat, "chat frame loaded");
    assert.equal(await popup.locator("#uiOpacity").isEnabled(), true);
    assert.equal(await popup.locator("#panelOpacity").count(), 0, "removed slider stays removed");
    assert.deepEqual(await popup.evaluate(() => [
      YTCustomizer.normalize({ uiOpacity: -10 }).uiOpacity,
      YTCustomizer.normalize({ uiOpacity: 130 }).uiOpacity,
      YTCustomizer.normalize({ uiOpacity: "bad" }).uiOpacity
    ]), [0, 100, 30]);

    async function edit(id, value, commit = true) {
      await popup.evaluate(({ id, value, commit }) => {
        const input = document.getElementById(id);
        if (input.type === "checkbox") input.checked = value;
        else input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        if (commit) input.dispatchEvent(new Event("change", { bubbles: true }));
      }, { id, value, commit });
    }
    async function verifyOpacity(value) {
      for (const frame of [page, chat]) await frame.waitForFunction(expected =>
        document.documentElement.style.getPropertyValue("--ytc-ui-opacity") === String(expected / 100), value);
      const states = await page.locator("[data-surface]").evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element);
        const parts = style.backgroundColor.match(/[\d.]+/g).map(Number);
        return { name: element.localName + "." + element.className, alpha: parts.length === 4 ? parts[3] : 1, opacity: style.opacity };
      }));
      for (const state of states) {
        assert.equal(state.alpha, value / 100, state.name + " uses shared background opacity");
        assert.equal(state.opacity, "1", state.name + " does not fade its contents");
      }
      assert.equal(await chat.locator("yt-live-chat-renderer").evaluate(element => {
        const parts = getComputedStyle(element).backgroundColor.match(/[\d.]+/g).map(Number);
        return parts.length === 4 ? parts[3] : 1;
      }), value / 100, "chat iframe uses the same opacity");
      assert.equal(await popup.locator("#uiOpacityValue").textContent(), String(value));
    }
    await edit("uiOpacity", 55);
    await verifyOpacity(55);
    assert.equal(await popup.locator("#themeEnabled").isChecked(), true, "drag enables page theme");
    const originalCss = await page.locator("#yt-custom-progress-style").textContent();
    for (const value of [0, 30, 70, 100]) {
      await edit("uiOpacity", value);
      await verifyOpacity(value);
      assert.equal(await page.locator("#yt-custom-progress-style").textContent(), originalCss, "slider leaves the main stylesheet intact");
    }
    for (const selector of ["#fixture-video", "#fixture-text", "#thumbnail"]) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).opacity), "1");
    }
    const clearSelectors = ["ytd-masthead #background", "ytd-masthead #container", "ytd-masthead #center",
      "ytd-guide-renderer #guide-inner-content", "ytd-feed-filter-chip-bar-renderer", "#chip-container",
      "#frosted-glass", "#masthead-container",
      "ytd-live-chat-frame", "ytd-live-chat-frame #chat", "ytd-live-chat-frame iframe"];
    for (const selector of clearSelectors) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)", selector);
    }
    for (const selector of ["#frosted-glass", "#masthead-container", "ytd-masthead #background", "#chips-wrapper"]) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).backdropFilter),
        selector === "#chips-wrapper" ? "blur(12px)" : "none", selector + " uses the selected blur only on its painted panel");
    }
    assert.equal(await page.locator("#frosted-glass").evaluate(el => getComputedStyle(el, "::before").backgroundImage), "none");
    assert.equal(await page.locator("#frosted-glass").evaluate(el => getComputedStyle(el, "::before").backdropFilter), "none");
    assert.equal(await page.locator("yt-chip-cloud-chip-renderer[selected]").evaluate(el => getComputedStyle(el).color), "rgb(241, 241, 241)");
    assert.equal(await chat.locator("html").evaluate(el => getComputedStyle(el).backgroundImage), "none");
    assert.equal(await chat.evaluate(() => getComputedStyle(document.querySelector("yt-live-chat-renderer").shadowRoot.querySelector("#contents")).backgroundColor), "rgba(0, 0, 0, 0)");

    await popup.evaluate(async wallpaper => {
      await chrome.storage.local.set({ backgroundImageData: wallpaper });
    }, wallpaper);
    await edit("backgroundMode", "image");
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-ytc-home-glass"));
    await edit("uiOpacity", 40);
    await verifyOpacity(40);
    const beforeImage = await page.locator("html").evaluate(el => getComputedStyle(el).backgroundImage);
    await edit("uiOpacity", 0);
    await verifyOpacity(0);
    assert.equal(await page.locator("html").evaluate(el => getComputedStyle(el).backgroundImage), beforeImage);
    assert.equal(await chat.locator("html").evaluate(el => getComputedStyle(el).backgroundImage), "none", "wallpaper is not duplicated inside chat");

    // Reproduce YouTube repainting clear wrappers and verify the observer settles.
    await page.evaluate(() => {
      document.querySelector("ytd-masthead #center").style.setProperty("background", "black", "important");
      document.querySelector("ytd-masthead #container").style.setProperty("background", "black", "important");
      document.querySelector("ytd-masthead").style.setProperty("background", "black", "important");
      for (const selector of ["#frosted-glass", "#masthead-container", "ytd-masthead #background", "#chips-wrapper"]) {
        const element = document.querySelector(selector);
        element.style.setProperty("background", "black", "important");
        element.style.setProperty("backdrop-filter", "blur(48px)", "important");
        element.style.setProperty("filter", "brightness(0.1)", "important");
      }
      const item = document.createElement("ytd-menu-popup-renderer");
      item.id = "late-menu";
      item.style.background = "black";
      document.body.append(item);
    });
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#late-menu")).backgroundColor === "rgba(33, 33, 33, 0)");
    const mutations = await page.evaluate(() => new Promise(resolve => {
      let count = 0;
      const observer = new MutationObserver(records => { count += records.length; });
      observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(count); }, 600);
    }));
    assert.ok(mutations < 100, "repaint must settle, observed mutations: " + mutations);
    for (const selector of ["ytd-masthead #center", "ytd-masthead #container"]) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
    }
    for (const selector of ["#frosted-glass", "#masthead-container", "ytd-masthead #background", "#chips-wrapper"]) {
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).backdropFilter),
        selector === "#chips-wrapper" ? "blur(12px)" : "none", "repaint restores the selected panel blur and clears decorative blur");
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).filter), "none");
    }
    await page.evaluate(() => {
      const previous = document.querySelector("#frosted-glass");
      const replacement = document.createElement("div");
      replacement.id = "frosted-glass";
      replacement.className = "loading-with-chipbar style-scope ytd-app";
      replacement.style.cssText = "background:black!important;backdrop-filter:blur(48px)!important";
      previous.replaceWith(replacement);
      replacement.className = "with-chipbar style-scope ytd-app";
    });
    await page.waitForFunction(() => {
      const style = getComputedStyle(document.querySelector("#frosted-glass"));
      return style.backgroundColor === "rgba(0, 0, 0, 0)" && style.backdropFilter === "none";
    });
    await edit("uiOpacity", 70);
    await verifyOpacity(70);
    await popup.reload();
    await popup.waitForSelector("#settings-form:not([inert])");
    await activate();
    assert.equal(await popup.locator("#uiOpacity").inputValue(), "70", "saved across reopen");
    await popup.locator(".panel").screenshot({ path: path.join(os.tmpdir(), "youtube-ui-opacity-popup.png") });
    assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);

    // Navigation and Shorts cleanup must keep the same opacity for UI controls.
    await page.goto("https://www.youtube.com/watch?v=fixture", { waitUntil: "load" });
    chat = page.frames().find(frame => frame.url().includes("/live_chat"));
    await verifyOpacity(70);
    await activate();
    await page.evaluate(() => {
      history.pushState({}, "", "/shorts/fixture");
      const shorts = document.createElement("ytd-shorts");
      const renderer = document.createElement("ytd-reel-video-renderer");
      const player = document.querySelector(".html5-video-player");
      player.id = "shorts-player";
      renderer.append(player);
      shorts.append(renderer);
      document.querySelector("ytd-app").prepend(shorts);
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-ytc-shorts-clean"));
    await edit("uiOpacity", 25);
    await verifyOpacity(25);
    await page.evaluate(() => {
      history.pushState({}, "", "/playlist?list=fixture");
      document.querySelector("ytd-browse").setAttribute("page-subtype", "playlist");
      document.dispatchEvent(new Event("yt-navigate-finish"));
    });
    await edit("uiOpacity", 70);
    await verifyOpacity(70);
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-shorts-clean"));

    await page.evaluate(() => {
      window.surfaceWrites = 0;
      window.surfaceObserver = new MutationObserver(records => {
        window.surfaceWrites += records.filter(record => record.target !== document.documentElement).length;
      });
      window.surfaceObserver.observe(document.documentElement, { attributes:true, attributeFilter:["style"], childList:true, subtree:true });
    });
    for (const value of [15, 45, 85, 70]) await edit("uiOpacity", value, false);
    await verifyOpacity(70);
    await popup.waitForFunction(async () => (await chrome.storage.sync.get("uiOpacity")).uiOpacity === 70);
    const surfaceWrites = await page.evaluate(() => {
      window.surfaceObserver.disconnect();
      return window.surfaceWrites;
    });
    assert.equal(surfaceWrites, 0, "slider only updates the root opacity token");

    await edit("themeEnabled", false);
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-ytc-theme"));
    assert.equal(await page.locator("ytd-masthead").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(17, 17, 17)", "restore original YouTube style");
    assert.equal(await page.locator("html").evaluate(el => el.style.getPropertyValue("--ytc-ui-opacity")), "");
    assert.equal(await page.locator("#frosted-glass").evaluate(el => getComputedStyle(el).backdropFilter), "blur(48px)", "theme off restores YouTube blur");
    await edit("themeEnabled", true);
    await verifyOpacity(70);
    await popup.evaluate(async tabId => {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true },
        files: ["settings.js", "content/surface-controller.js", "content/shorts-controller.js", "content/homepage-glass.js", "yt.js"] });
    }, tabId);
    await verifyOpacity(70);
    assert.equal(await page.locator("#yt-custom-progress-style").count(), 1);
    await popup.locator("#reset").click();
    await popup.waitForFunction(() => document.getElementById("uiOpacity").value === "30");
    assert.deepEqual(errors, []);
    console.log("PASS: 0-100% shared UI backgrounds, live slider with no surface rewrites, chat iframe/shadow root, no wallpaper duplication, frosted/sticky navigation cleanup, stable repaint/replacement, persistence, home/watch/Shorts/playlist navigation, reset, theme toggle, reinjection and popup layout.");
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
