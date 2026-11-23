// Native menu updates should use the stylesheet without extra inline writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const fixture = `<!doctype html><style>
  body { margin: 20px; }
  ytd-menu-popup-renderer, ytd-multi-page-menu-renderer, tp-yt-iron-dropdown,
  ytd-compact-link-renderer, tp-yt-paper-item, .ytp-popup { display: block; }
  [hidden] { display: none !important; }
</style><ytd-app>
  <button data-opens="actions">More actions</button>
  <button data-opens="settings">Settings</button>
  <div class="html5-video-player" id="movie_player">
    <button data-opens="player-menu">Player settings</button>
    <div class="ytp-popup ytp-settings-menu" id="player-menu" hidden>
      <button data-submenu>Playback speed</button>
    </div>
  </div>
  <ytd-popup-container><tp-yt-iron-dropdown>
    <ytd-menu-popup-renderer role="menu" id="actions" hidden></ytd-menu-popup-renderer>
  </tp-yt-iron-dropdown><tp-yt-iron-dropdown>
    <ytd-multi-page-menu-renderer id="settings" hidden><button data-submenu>Appearance</button></ytd-multi-page-menu-renderer>
  </tp-yt-iron-dropdown></ytd-popup-container>
</ytd-app><script>
  const addOption = (menu, label) => {
    const row = document.createElement('ytd-compact-link-renderer');
    row.setAttribute('role', 'menuitem');
    row.innerHTML = '<tp-yt-paper-item role="menuitemcheckbox" aria-checked="false" tabindex="0">' + label + '</tp-yt-paper-item>';
    const option = row.firstElementChild;
    option.onclick = () => option.setAttribute('aria-checked', 'true');
    menu.append(row);
  };
  for (const button of document.querySelectorAll('[data-opens]')) {
    button.onclick = () => {
      const menu = document.getElementById(button.dataset.opens);
      menu.hidden = false;
      if (menu.id === 'actions' && !menu.firstElementChild) addOption(menu, 'Save');
    };
  }
  for (const button of document.querySelectorAll('[data-submenu]')) {
    button.onclick = () => addOption(button.parentElement, button.textContent + ' option');
  }
  window.redrawMenu = async menu => {
    const writes = [];
    const observer = new MutationObserver(records => {
      for (const record of records) writes.push(record.attributeName);
    });
    observer.observe(menu, { subtree: true, attributes: true,
      attributeFilter: ['style', 'data-ytc-universal-glass', 'data-ytc-universal-clear'] });
    for (const size of [180, 220, 240]) {
      menu.style.cssText = 'width: ' + size + 'px;';
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    observer.disconnect();
    return writes;
  };
</script>`;

(async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging']
  });
  const deadline = setTimeout(() => void context.close(), 60000);
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve(__dirname, '..') });
    const admin = await context.newPage();
    await admin.goto(`chrome-extension://${id}/popup.html`);
    await admin.waitForFunction(() => initialized);
    await admin.evaluate(() => chrome.storage.sync.set({ themeEnabled: true, uiOpacity: 42, uiBlur: 12 }));
    const page = await context.newPage();
    await page.goto('https://www.youtube.com/watch?v=native-menu');
    await page.waitForSelector('[data-opens="actions"][data-ytc-universal-glass]');

    for (const [id, button, submenu, label] of [
      ['actions', 'More actions', '', 'Save'],
      ['settings', 'Settings', 'Appearance', 'Appearance option'],
      ['player-menu', 'Player settings', 'Playback speed', 'Playback speed option']
    ]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      const menu = page.locator('#' + id);
      if (submenu) await menu.getByRole('button', { name: submenu, exact: true }).click();
      const option = menu.getByRole('menuitemcheckbox', { name: label });
      await option.click();
      assert.equal(await option.getAttribute('aria-checked'), 'true');
      assert.equal(await menu.evaluate(el => getComputedStyle(el).backdropFilter), 'blur(12px)');
      assert.equal(await option.evaluate(el => getComputedStyle(el).backdropFilter), 'none');
      assert.equal(await option.evaluate(el => getComputedStyle(el).color), 'rgb(255, 255, 255)');
      assert.deepEqual(await menu.evaluate(el => redrawMenu(el)), ['style', 'style', 'style'], `${label}: only native resize writes`);
      assert.equal(await menu.locator('[data-ytc-universal-glass], [data-ytc-universal-clear]').count(), 0);
    }

    const menu = page.locator('#actions');
    await menu.evaluate(el => el.style.setProperty('background', 'black', 'important'));
    await page.waitForFunction(() => document.querySelector('#actions').style.background === 'var(--ytc-universal-glass)');
    await menu.evaluate(el => el.style.removeProperty('background'));
    await page.waitForFunction(() => !document.querySelector('#actions').hasAttribute('data-ytc-universal-glass'));
    assert.deepEqual(await menu.evaluate(el => ({ width: el.style.width, blur: getComputedStyle(el).backdropFilter })),
      { width: '240px', blur: 'blur(12px)' });
    console.log('PASS: actions, header, and player submenus stay interactive with one CSS backdrop and no inline theme rewrites.');
  } finally {
    clearTimeout(deadline);
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
