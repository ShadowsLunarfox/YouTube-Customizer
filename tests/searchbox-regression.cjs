// Exercises the real search wrapper geometry and rendered frosted backgrounds without network access.
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve(__dirname, "..");
const fixture = `<!doctype html><html><head><style>
  * { box-sizing:border-box; }
  html, body { margin:0; min-height:100%; background:#111; color:white; font:16px sans-serif; }
  ytd-app { display:block; min-height:700px; }
  #masthead-container { position:fixed; inset:0 0 auto; height:72px; z-index:10; }
  ytd-masthead { display:block; position:relative; z-index:2; height:72px; background:#202020; }
  ytd-masthead > #background { position:absolute; inset:0; z-index:-1; opacity:0; background:#202020; }
  ytd-app.with-chipbar ytd-masthead > #background { display:none; }
  ytd-masthead > #container { position:relative; height:72px; }
  #center { position:absolute; left:240px; top:16px; }
  yt-searchbox { display:block; position:relative; width:632px; }
  .ytSearchboxComponentInputContainer { display:flex; width:632px; height:40px; border-radius:0; }
  .ytSearchboxComponentInputBox { display:flex; align-items:center; flex:1; min-width:0; margin-left:32px;
    border:1px solid #666; border-radius:40px 0 0 40px; background:#121212; padding:0 16px; }
  .ytSearchboxComponentInputBoxHasFocus { margin-left:0; padding-left:48px; border-color:#1684ec; }
  .ytSearchboxComponentInputContainerUnified.ytSearchboxComponentInputContainerIsFocused { border-radius:24px; background:#181818; }
  form { flex:1; margin:0; }
  input { width:100%; border:0; outline:none; background:transparent; color:white; font:16px sans-serif; }
  .ytSearchboxComponentSearchButton { width:64px; border:1px solid #666; border-left:0; border-radius:0 40px 40px 0;
    background:#222; color:white; font:20px sans-serif; cursor:pointer; }
  .ytSearchboxComponentSuggestionsContainer { position:absolute; top:44px; left:0; width:632px; height:216px;
    border-radius:12px; background:#202020; padding:16px; box-shadow:0 2px 8px #0008; }
  [hidden] { display:none !important; }
  #suggestion { background:transparent; color:inherit; border:0; cursor:pointer; font:16px sans-serif; }
</style></head><body><ytd-app class="with-chipbar"><div id="masthead-container"><ytd-masthead>
  <div id="background"></div><div id="container"><div id="center"><yt-searchbox id="search">
    <div class="ytSearchboxComponentInputWrapper"><div class="ytSearchboxComponentInputContainer">
      <div class="ytSearchboxComponentInputBox"><form><input type="text" aria-label="Search" placeholder="Search" autocomplete="off"></form></div>
      <button class="ytSearchboxComponentSearchButton" aria-label="Submit search">⌕</button>
    </div></div>
    <div class="ytSearchboxComponentSuggestionsContainer" hidden><button id="suggestion">Example suggestion</button></div>
  </yt-searchbox></div></div>
</ytd-masthead></div></ytd-app><script>
  const input = document.querySelector('input');
  const box = document.querySelector('.ytSearchboxComponentInputBox');
  const container = document.querySelector('.ytSearchboxComponentInputContainer');
  const suggestions = document.querySelector('.ytSearchboxComponentSuggestionsContainer');
  function showSuggestions() { suggestions.hidden = !input.value || document.activeElement !== input; }
  input.addEventListener('focus', () => {
    container.classList.add('ytSearchboxComponentInputContainerIsFocused');
    box.classList.add('ytSearchboxComponentInputBoxHasFocus');
    showSuggestions();
  });
  input.addEventListener('input', showSuggestions);
  input.addEventListener('blur', () => {
    container.classList.remove('ytSearchboxComponentInputContainerIsFocused');
    box.classList.remove('ytSearchboxComponentInputBoxHasFocus');
    suggestions.hidden = true;
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { input.blur(); event.preventDefault(); }
  });
  document.querySelector('form').addEventListener('submit', event => event.preventDefault());
  document.querySelector('#suggestion').addEventListener('mousedown', event => event.preventDefault());
  document.querySelector('#suggestion').addEventListener('click', () => {
    input.value = 'Example suggestion'; input.blur(); document.body.dataset.selected = 'true';
  });
</script></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome", headless: true, viewport: { width: 1120, height: 700 },
    ignoreDefaultArgs: ["--disable-extensions"], args: ["--enable-unsafe-extension-debugging"]
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    context.setDefaultTimeout(8000);
    await context.route("https://www.youtube.com/**", route => route.fulfill({ contentType: "text/html", body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", { path: root });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("https://www.youtube.com/", { waitUntil: "load" });
    const popup = await context.newPage();
    await popup.goto("chrome-extension://" + id + "/popup.html");
    await popup.waitForSelector("#settings-form:not([inert])");
    await popup.evaluate(async () => {
      // Uniform horizontal stripes make left/right pixel comparisons independent of wallpaper position.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d");
      for (let y = 0; y < 64; y += 8) {
        ctx.fillStyle = y % 16 === 0 ? "#000000" : "#ffffff";
        ctx.fillRect(0, y, 64, 8);
      }
      await chrome.storage.local.set({ backgroundImageData: canvas.toDataURL("image/png") });
      await chrome.storage.sync.set({ themeEnabled: false, backgroundMode: "image", backgroundFit: "tile",
        backgroundOpacity: 100, uiOpacity: 30, uiBlur: 0, surfaceColor: "#212121" });
    });
    await page.bringToFront();
    const tracked = "ytd-masthead, ytd-masthead #background, .ytSearchboxComponentInputContainer, .ytSearchboxComponentInputBox, .ytSearchboxComponentSearchButton, .ytSearchboxComponentSuggestionsContainer";
    const snapshot = () => page.locator(tracked).evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, backdrop: style.backdropFilter, radius: style.borderRadius,
        display: style.display, opacity: style.opacity };
    }));
    const original = await snapshot();

    async function settings(value) {
      await popup.evaluate(value => chrome.storage.sync.set(value), value);
      await page.waitForFunction(value => {
        const root = document.documentElement;
        return (value.themeEnabled === undefined || root.hasAttribute("data-ytc-theme") === value.themeEnabled) &&
          (value.uiOpacity === undefined || root.style.getPropertyValue("--ytc-ui-opacity") === String(value.uiOpacity / 100)) &&
          (value.uiBlur === undefined || root.style.getPropertyValue("--ytc-ui-blur") === value.uiBlur + "px");
      }, value);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    const input = page.getByRole("textbox", { name: "Search", exact: true });
    const suggestions = page.locator(".ytSearchboxComponentSuggestionsContainer");
    async function open() {
      await input.fill("example");
      await suggestions.waitFor({ state: "visible" });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    async function close() {
      await input.press("Escape");
      await suggestions.waitFor({ state: "hidden" });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    async function verifyTint(opacity, unifiedFocused = false) {
      await page.waitForFunction(({ opacity, unifiedFocused }) => {
        const selectors = [".ytSearchboxComponentInputContainer", ".ytSearchboxComponentInputBox", ".ytSearchboxComponentSearchButton", ".ytSearchboxComponentSuggestionsContainer"];
        const expected = unifiedFocused ? [opacity / 100, 0, 0, opacity / 100] : [0, opacity / 100, opacity / 100, opacity / 100];
        return selectors.every((selector, index) => {
          const element = document.querySelector(selector);
          const style = getComputedStyle(element);
          const parts = style.backgroundColor.match(/[\d.]+/g).map(Number);
          return (parts.length === 4 ? parts[3] : 1) === expected[index] && style.opacity === "1";
        });
      }, { opacity, unifiedFocused });
    }
    async function pixels() {
      const png = await page.screenshot();
      return page.evaluate(async data => {
        const image = new Image();
        image.src = "data:image/png;base64," + data;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
        const brightness = (x, y) => {
          const rgba = ctx.getImageData(x, y, 1, 1).data;
          return (rgba[0] + rgba[1] + rgba[2]) / 3;
        };
        const contrast = (x, start, end) => {
          const values = Array.from({ length: end - start }, (_, offset) => brightness(x, start + offset));
          const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
          return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
        };
        return { cornerDifference: Math.abs(brightness(244, 20) - brightness(160, 20)),
          leftMarginDifference: Math.abs(brightness(248, 36) - brightness(160, 36)),
          headerContrast: contrast(100, 8, 64), suggestionContrast: contrast(824, 112, 248) };
      }, png.toString("base64"));
    }

    await settings({ themeEnabled: true });
    await verifyTint(30);
    const idlePixels = await pixels();
    assert.ok(idlePixels.cornerDifference < 2 && idlePixels.leftMarginDifference < 2,
      "the unused left margin has no rectangular paint: " + JSON.stringify(idlePixels));
    await open();
    await verifyTint(30);
    assert.equal(await input.inputValue(), "example", "the focused field remains editable");
    await close();

    // Focus, blur, and native repaint must preserve the selected opacity in both search layouts.
    for (const unified of [false, true]) {
      await page.locator(".ytSearchboxComponentInputContainer").evaluate((element, unified) =>
        element.classList.toggle("ytSearchboxComponentInputContainerUnified", unified), unified);
      for (const opacity of [0, 30, 100]) {
        for (const blur of [0, 12]) {
          await settings({ uiOpacity: opacity, uiBlur: blur });
          await verifyTint(opacity);
          await open();
          await verifyTint(opacity, unified);
          await close();
          await verifyTint(opacity);
        }
      }
      await settings({ uiOpacity: 30, uiBlur: 0 });
      await open();
      await verifyTint(30, unified);
      if (unified) assert.ok((await pixels()).cornerDifference < 2, "unified focus keeps the outer rounded corner clear");
      await page.locator(".ytSearchboxComponentInputBox").evaluate(element => element.style.setProperty("background", "black", "important"));
      await verifyTint(30, unified);
      await page.locator("#suggestion").click();
      assert.equal(await input.inputValue(), "Example suggestion", "suggestions remain clickable");
      assert.equal(await page.locator("body").getAttribute("data-selected"), "true");
      await verifyTint(30);
    }
    await page.locator(".ytSearchboxComponentInputContainer").evaluate(element => element.classList.remove("ytSearchboxComponentInputContainerUnified"));

    // Both areas must visibly blur the wallpaper; computed backdrop-filter cannot detect a compositor boundary.
    await settings({ uiOpacity: 30, uiBlur: 0 });
    const sharpHeader = await pixels();
    await open();
    const sharpSuggestions = await pixels();
    await close();
    await settings({ uiBlur: 24 });
    const frostedHeader = await pixels();
    await open();
    const frostedOpen = await pixels();
    assert.ok(sharpHeader.headerContrast > 35, "the wallpaper has measurable stripe contrast before blur");
    assert.ok(frostedHeader.headerContrast < sharpHeader.headerContrast * 0.35,
      "idle header visibly blurs wallpaper: " + sharpHeader.headerContrast + " -> " + frostedHeader.headerContrast);
    assert.ok(Math.abs(frostedOpen.headerContrast - frostedHeader.headerContrast) < 4,
      "opening search suggestions preserves header frosting: " + frostedHeader.headerContrast + " -> " + frostedOpen.headerContrast);
    assert.ok(sharpSuggestions.suggestionContrast > 35 && frostedOpen.suggestionContrast < sharpSuggestions.suggestionContrast * 0.35,
      "suggestions blur wallpaper below the header: " + sharpSuggestions.suggestionContrast + " -> " + frostedOpen.suggestionContrast);
    await close();
    await open();
    assert.ok(Math.abs((await pixels()).headerContrast - frostedHeader.headerContrast) < 4, "reopening suggestions preserves header frosting");
    await close();

    // Repaints are restored as the latest native inline value, so remove the deliberate override before comparing originals.
    await settings({ themeEnabled: false });
    await page.waitForFunction(() => !document.querySelector("[data-ytc-universal-glass], [data-ytc-universal-clear]"));
    await page.locator(".ytSearchboxComponentInputBox").evaluate(element => element.style.removeProperty("background"));
    assert.deepEqual(await snapshot(), original, "disabling the theme restores the native search and header appearance");
    assert.deepEqual(errors, [], "the fixture has no page errors");
    console.log("PASS: rounded search geometry, standard/unified focus, opacity 0/30/100, blur 0/12/24, native repaints, autocomplete clicks/reopening, visible header/suggestion frost, and theme restoration.");
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
