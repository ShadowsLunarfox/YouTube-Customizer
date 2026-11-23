// Share's native layout and controls must not compete with inline theme repair.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const origin = 'https://www.youtube.com';
const link = 'https://youtu.be/share-fixture';
const fixture = `<!doctype html><style>
  body { margin: 24px; }
  tp-yt-paper-dialog { display: block; width: 320px; padding: 16px; }
  [hidden] { display: none !important; }
</style><ytd-app>
  <button id="share">Share</button><ytd-popup-container></ytd-popup-container>
</ytd-app><script>
  const popup = document.querySelector('ytd-popup-container');
  const wrap = () => {
    const dialog = document.createElement('tp-yt-paper-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.style.top = '10px';
    return dialog;
  };
  window.makeDialog = wrap;
  document.querySelector('#share').onclick = () => {
    const dialog = popup.firstElementChild || popup.appendChild(wrap());
    dialog.hidden = false;
    const panel = document.createElement('yt-unified-share-panel-renderer');
    panel.innerHTML = '<div role="button" id="target"><button>Share target</button></div>' +
      '<yt-copy-link-renderer><input readonly aria-label="Link" value="${link}"><button>Copy</button></yt-copy-link-renderer>' +
      '<button>Close</button>';
    panel.querySelector('yt-copy-link-renderer button').onclick = () => navigator.clipboard.writeText('${link}');
    panel.lastElementChild.onclick = () => { dialog.hidden = true; };
    dialog.replaceChildren(panel);
  };
</script>`;

(async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging']
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await context.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve(__dirname, '..') });
    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${id}/popup.html`);
    await settings.waitForFunction(() => initialized);
    await settings.evaluate(() => chrome.storage.sync.set({ themeEnabled: true, uiBlur: 12 }));

    const page = await context.newPage();
    await page.goto(`${origin}/watch?v=share-fixture`);
    await page.waitForSelector('#share[data-ytc-universal-glass]');
    const dialog = page.locator('tp-yt-paper-dialog');
    // YouTube can use a popup shell before it attaches the Share renderer.
    await page.evaluate(() => document.querySelector('ytd-popup-container').append(makeDialog()));
    await dialog.locator('xpath=self::*[@data-ytc-universal-glass]').waitFor();

    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => navigator.clipboard.writeText(''));
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      await page.getByRole('button', { name: 'Copy', exact: true }).click();
      await page.waitForFunction(async expected => await navigator.clipboard.readText() === expected, link);
      const work = await dialog.evaluate(root => new Promise(resolve => {
        const styleChanges = [];
        const observer = new MutationObserver(records => styleChanges.push(...records.map(record => record.target.localName)));
        observer.observe(root, { subtree: true, attributes: true, attributeFilter: ['style'] });
        // Model the native dialog's refit discarding and rewriting its inline styles.
        root.style.cssText = 'position: fixed; top: 24px; left: 48px';
        const target = root.querySelector('#target');
        target.style.background = 'rgb(45, 65, 85)';
        target.classList.add('hydrated');
        setTimeout(() => {
          observer.disconnect();
          const managed = '[data-ytc-universal-glass], [data-ytc-universal-clear]';
          resolve({ styleChanges, inlineManaged: root.matches(managed) || Boolean(root.querySelector(managed)),
            position: [root.style.top, root.style.left], targetPaint: target.style.backgroundColor,
            blur: getComputedStyle(root).backdropFilter });
        }, 250);
      }));
      assert.deepEqual(work, { styleChanges: ['tp-yt-paper-dialog', 'div'], inlineManaged: false,
        position: ['24px', '48px'], targetPaint: 'rgb(45, 65, 85)', blur: 'blur(12px)' });
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
    }

    // Once recycled for other content, the same shell should regain inline repair.
    await dialog.evaluate(root => { root.replaceChildren(); root.hidden = false; });
    await page.waitForSelector('tp-yt-paper-dialog[data-ytc-universal-glass]');
    console.log('PASS: Share copies on the first click, uses CSS glass, and leaves native layout and icon styles alone.');
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
