// Complete offline catalogs, language resolution, live menu/search/YouTube control switching.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8')
  .replace('const languages =', 'globalThis.catalogs = dictionaries; const languages ='), sandbox);
const i18n = sandbox.YTCustomizerI18n, codes = i18n.languages.map(language => language.code);
const expected = ['en', 'zh-CN', 'zh-TW', 'yue-Hant', 'ja', 'ko', 'th', 'ms-MY', 'id'];
assert.equal(JSON.stringify(codes), JSON.stringify(expected));
for (const [locale, messages] of Object.entries(sandbox.catalogs)) {
  assert.deepEqual(Object.keys(messages).sort(), [...i18n.messageKeys].sort(), locale + ': complete message catalog');
  for (const [key, value] of Object.entries(messages)) {
    assert.ok(typeof value === 'string' && value.trim(), locale + ': ' + key);
    assert.deepEqual(value.match(/\{\w+\}/g)?.sort() || [], key.match(/\{\w+\}/g)?.sort() || [], locale + ': placeholders in ' + key);
    assert.equal(i18n.translate(key, locale), value, locale + ': static lookup for ' + key);
  }
  for (const source of ['12 records in this video', '12 settings found', '12 videos', '12 lines',
    'YouTube volume: 12%', 'Left 12%', 'R 12%', 'Reduction 12 dB', 'RMS -12 dBFS, peak -3 dBFS',
    'Choose a file no larger than 12 MB', 'Invalid backup setting: test12', 'Invalid page profile: test12', 'Invalid backup media: test12']) {
    const result = i18n.translate(source, locale);
    assert.notEqual(result, source, locale + ': dynamic copy ' + source);
    assert.ok(result.includes('12'), locale + ': preserves numbers');
    assert.ok(!/\{\w+\}/.test(result), locale + ': substitutes placeholders');
  }
  assert.equal(i18n.translate('constructor', locale), 'constructor');
  assert.equal(i18n.translate('__proto__', locale), '__proto__');
  assert.equal(i18n.translate('  Close  ', locale), '  ' + messages.Close + '  ');
  assert.equal(i18n.translate('On · Reduction 3.5 dB', locale), messages.On + ' · ' + i18n.translate('Reduction 3.5 dB', locale));
}
for (const [tag, language] of Object.entries({ 'zh-CN':'zh-CN', 'zh-SG':'zh-CN', 'zh-Hans-HK':'zh-CN',
  'zh-TW':'zh-TW', 'zh-HK':'zh-TW', 'zh-MO':'zh-TW', 'zh-Hant':'zh-TW', 'zh-Hant-CN':'zh-TW',
  'yue-HK':'yue-Hant', 'yue-Hant-HK':'yue-Hant', 'zh-yue':'yue-Hant', 'ja-JP':'ja', 'ko-KR':'ko',
  'th-TH':'th', 'ms-MY':'ms-MY', 'ms':'ms-MY', 'id-ID':'id', 'in-ID':'id', 'en-GB':'en', 'fr-FR':'en' })) {
  assert.equal(i18n.resolveLanguage('auto', tag), language, tag);
}
assert.equal(i18n.resolveLanguage('en', 'ja-JP'), 'en', 'explicit choices override automatic detection');
assert.equal(i18n.resolveLanguage('auto', ['fr-FR', 'ko-KR']), 'ko');
assert.equal(i18n.translate('Not a message', 'th'), 'Not a message');

const wallpaper = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const wav = Buffer.alloc(44 + 48000 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const fixture = `<!doctype html><html><head><style>
body{margin:0;background:#333;color:white;font:14px Arial}ytd-masthead{display:block;height:64px}
#buttons{display:flex;justify-content:flex-end}.html5-video-player{position:relative;margin:20px;width:640px;height:360px}
video{width:100%;height:100%}.ytp-progress-bar-container{position:absolute;bottom:40px;left:0;width:100%;height:8px}
.ytp-right-controls{position:absolute;bottom:0;right:0;height:32px}.ytp-button{height:32px;width:40px}
</style></head><body><ytd-app><ytd-masthead><div id="end"><div id="buttons"><button id="avatar-btn">Avatar</button></div></div></ytd-masthead>
<ytd-watch-flexy><div id="movie_player" class="html5-video-player"><video muted src="/tone.wav"></video>
<div class="ytp-progress-bar-container"></div><div class="ytp-right-controls"><button class="ytp-button">CC</button></div>
</div></ytd-watch-flexy><p id="native-copy">Native YouTube copy</p></ytd-app></body></html>`;

(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true, locale:'en-US',
    viewport:{ width:1000, height:900 }, ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 360000), errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill(route.request().url().endsWith('/tone.wav')
      ? { contentType:'audio/wav', body:wav } : { contentType:'text/html', body:fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path:root });
    const menu = await context.newPage(); await menu.goto(`chrome-extension://${id}/popup.html`);
    await menu.waitForSelector('#settings-form:not([inert])');
    await menu.evaluate(async image => {
      await chrome.storage.local.set({ menuLanguage:'en', backgroundImageData:image,
        'videoBookmarks:languages': { schemaVersion:1, points:[{ id:'saved-note', time:.25, note:'Close', createdAt:1 }] } });
      await chrome.storage.sync.set({ themeEnabled:true, backgroundMode:'image', showVideoBookmarks:true });
    }, wallpaper);
    const page = await context.newPage(); await page.goto('https://www.youtube.com/watch?v=languages');
    await page.waitForSelector('ytc-settings-entry'); await page.waitForSelector('ytc-bookmark-markers');
    await page.locator('ytc-bookmark-markers .pin').click();
    await page.evaluate(() => {
      window.originalLanguageAppearance = { image:document.querySelector('#ytc-background-image'),
        style:document.querySelector('#yt-custom-progress-style'), css:document.querySelector('#yt-custom-progress-style').textContent };
    });
    const tabId = await menu.evaluate(async () => (await chrome.tabs.query({ url:'https://www.youtube.com/watch?v=languages' }))[0].id);
    await menu.goto(`chrome-extension://${id}/popup.html?window=1&target=${tabId}`);
    await menu.waitForSelector('#settings-form:not([inert])');
    const other = await context.newPage(); await other.goto(`chrome-extension://${id}/popup.html?window=1&target=${tabId}`);
    await other.waitForSelector('#settings-form:not([inert])');
    const queries = { 'zh-CN':'界面模糊', 'zh-TW':'介面模糊', 'yue-Hant':'介面模糊', ja:'UIのぼかし', ko:'UI 흐림', th:'ความเบลอ UI',
      'ms-MY':'Kabur UI', id:'Keburaman UI', en:'UI blur' };
    for (const language of expected) {
      await menu.locator('#menuLanguage').selectOption(language);
      await menu.waitForFunction(code => document.documentElement.lang === code, language);
      await other.waitForFunction(code => document.documentElement.lang === code && document.querySelector('#menuLanguage').value === code, language);
      const t = source => i18n.translate(source, language);
      assert.deepEqual(await menu.locator('[role=tab]').allTextContents(), ['Appearance','Player','Records','Shortcuts','Audio','Layout','Backup'].map(t));
      assert.equal(await menu.locator('#settingsSearch').getAttribute('placeholder'), t('Search settings...'));
      await page.waitForFunction(label => document.querySelector('ytc-settings-entry').shadowRoot.querySelector('button').title === label, t('YouTube Customizer settings'));
      assert.equal(await page.locator('.ytc-pip-button').getAttribute('title'), t('Picture-in-picture'));
      assert.equal(await page.locator('ytc-bookmark-markers #bookmark-add span').textContent(), t('Add timeline note'));
      assert.equal(await page.locator('ytc-video-bookmarks #bookmark-note').getAttribute('placeholder'), t('Write a note...'));
      assert.equal(await page.locator('ytc-video-bookmarks #bookmark-note').inputValue(), 'Close', 'language switches preserve the open user note');
      await menu.locator('#settingsSearch').fill(queries[language]);
      await menu.locator('.search-result[data-setting-id="uiBlur"]').waitFor();
      assert.equal(await menu.locator('.search-result[data-setting-id="uiBlur"] strong').textContent(), t('UI blur'));
      await menu.locator('#clearSettingsSearch').click();
      await menu.locator('#tab-audio').click();
      await menu.waitForFunction(label => document.querySelector('#audioAppliedBalance').textContent === label, t('Center'));
      for (const width of [480, 360]) {
        await menu.setViewportSize({ width, height:760 });
        for (const tab of ['appearance','player','records','shortcuts','audio','layout','backup']) {
          await menu.locator('#tab-' + tab).click();
          assert.equal(await menu.evaluate(() => document.documentElement.scrollWidth <= innerWidth &&
            document.querySelector('.tab-content').scrollWidth <= document.querySelector('.tab-content').clientWidth), true, language + ': no horizontal clipping at ' + width + ' in ' + tab);
        }
      }
      if (['th','ms-MY'].includes(language)) {
        await menu.locator('#tab-appearance').click();
        await menu.screenshot({ path:path.join(os.tmpdir(), `ytc-language-${language}.png`) });
      }
      await menu.locator('#tab-backup').click();
      await menu.locator('#backupFile').setInputFiles({ name:'invalid.json', mimeType:'application/json', buffer:Buffer.from('{}') });
      await menu.waitForFunction(message => document.querySelector('#status').textContent === message, t('Unsupported YouTube Customizer backup'));
      await menu.reload(); await menu.waitForSelector('#settings-form:not([inert])');
      assert.equal(await menu.locator('#menuLanguage').inputValue(), language, language + ': persists after reopening');
      console.log('PASS language:', language);
    }
    // A selected language must reach the authenticated in-page iframe as well.
    await menu.locator('#menuLanguage').selectOption('ja');
    await page.locator('ytc-settings-entry button').click();
    const embedded = page.frameLocator('ytc-settings-modal iframe');
    await embedded.locator('#settings-form:not([inert])').waitFor();
    await embedded.locator('html[lang="ja"]').waitFor();
    assert.equal(await embedded.locator('#tab-appearance').textContent(), '外観');
    await embedded.locator('#menuLanguage').selectOption('th');
    await menu.waitForFunction(() => document.documentElement.lang === 'th');
    await embedded.locator('#closePopup').click();
    await menu.locator('#menuLanguage').selectOption('en');
    await page.waitForFunction(() => document.querySelector('ytc-bookmark-markers').shadowRoot.querySelector('#bookmark-add span').textContent === 'Add timeline note');
    const stable = await page.evaluate(() => ({
      image:document.querySelector('#ytc-background-image') === originalLanguageAppearance.image,
      style:document.querySelector('#yt-custom-progress-style') === originalLanguageAppearance.style,
      css:document.querySelector('#yt-custom-progress-style').textContent === originalLanguageAppearance.css,
      native:document.querySelector('#native-copy').textContent
    }));
    assert.deepEqual(stable, { image:true, style:true, css:true, native:'Native YouTube copy' });
    assert.equal(await menu.evaluate(async () => (await chrome.storage.local.get('videoBookmarks:languages'))['videoBookmarks:languages'].points[0].note), 'Close', 'saved user notes stay untouched');
    assert.deepEqual(errors, []);
    console.log('PASS: nine complete catalogs, automatic script/region detection, dynamic messages, search, live cross-window/page/embedded controls, persistence, narrow layouts, unchanged notes and appearance.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
