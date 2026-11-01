// Inspect and verify the themed comments against YouTube's current native DOM.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true,
    viewport:{ width:1440, height:1000 }, ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 120000);
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path:root });
    const menu = await context.newPage(); await menu.goto(`chrome-extension://${id}/popup.html`);
    await menu.waitForSelector('#settings-form:not([inert])');
    await menu.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 640;
      const ctx = canvas.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 640, 640);
      gradient.addColorStop(0, '#112e46'); gradient.addColorStop(.5, '#3c3049'); gradient.addColorStop(1, '#264652');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 640, 640);
      await chrome.storage.local.set({ backgroundImageData:canvas.toDataURL() });
      await chrome.storage.sync.set({ themeEnabled:true, customizeCards:true, backgroundMode:'image', uiOpacity:42, uiBlur:12, textColor:'#edf1f8', surfaceColor:'#17202c', accentColor:'#f04464' });
    });
    const page = await context.newPage();
    await page.goto(process.env.YTC_VIDEO_URL || 'https://www.youtube.com/watch?v=LH-EvEfpZgI', { waitUntil:'domcontentloaded', timeout:45000 });
    await page.locator('ytd-watch-metadata').waitFor({ state:'visible', timeout:25000 });
    await page.evaluate(() => document.querySelector('#movie_player video')?.pause());
    if (!await page.locator('ytd-comments:visible').count()) {
      const opener = page.locator('ytd-comments-entry-point-header-renderer, ytd-comments-entry-point-teaser-renderer').filter({ visible:true }).first();
      if (await opener.count()) await opener.click();
    }
    const comments = page.locator('ytd-comments:visible').first();
    await comments.scrollIntoViewIfNeeded();
    await comments.locator('ytd-comment-thread-renderer').first().waitFor({ state:'visible', timeout:25000 });
    if (process.env.YTC_INSPECT === '1') {
      console.log(await comments.evaluate(comments => {
        const summarize = root => [...root.querySelectorAll('*')].filter(el => el.id || ['YTD-COMMENT-VIEW-MODEL','YTD-COMMENT-RENDERER','YTD-COMMENT-ACTION-BUTTONS-RENDERER','YTD-COMMENT-ENGAGEMENT-BAR'].includes(el.tagName))
          .slice(0, 100).map(el => ({ tag:el.localName, id:el.id, class:el.className, parent:el.parentElement?.id || el.parentElement?.localName }));
        const thread = comments.querySelector('ytd-comment-thread-renderer');
        const replyThread = [...comments.querySelectorAll('ytd-comment-thread-renderer')].find(thread => thread.querySelector('ytd-comment-replies-renderer'));
        return JSON.stringify({ actions:thread.querySelector('#action-buttons')?.outerHTML.slice(0, 18000), composer:comments.querySelector('ytd-comment-simplebox-renderer')?.outerHTML.slice(0, 9500),
          replies:replyThread?.querySelector('ytd-comment-replies-renderer')?.outerHTML.slice(0, 8000), replyStructure:replyThread && summarize(replyThread).slice(-45),
          panel:comments.parentElement.outerHTML.slice(0, 300),
          textStyle:(() => { const el = thread.querySelector('#content-text'), s = getComputedStyle(el); return { font:s.fontSize, lineHeight:s.lineHeight, parent:el.parentElement.outerHTML.slice(0, 2000) }; })() });
      }));
    }
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-ytc-theme'));
    const thread = comments.locator('ytd-comment-thread-renderer').first();
    const metrics = await comments.evaluate(root => {
      const style = selector => getComputedStyle(root.querySelector(selector));
      return { header:style('#count span').color, body:style('#content-text').color,
        font:style('#content-text').fontSize, lineHeight:style('#content-text').lineHeight,
        radius:style('ytd-comment-thread-renderer').borderRadius,
        threadBlur:style('ytd-comment-thread-renderer').backdropFilter,
        composerBlur:style('ytd-comment-simplebox-renderer').backdropFilter,
        composerUnderline:style('#simplebox-placeholder').borderBottomWidth };
    });
    assert.equal(metrics.header, 'rgb(237, 241, 248)'); assert.equal(metrics.body, metrics.header);
    assert.equal(metrics.font, '14px'); assert.equal(metrics.lineHeight, '20px');
    assert.equal(metrics.radius, '16px'); assert.equal(metrics.threadBlur, 'none');
    assert.equal(metrics.composerBlur, 'none'); assert.equal(metrics.composerUnderline, '0px');
    for (const avatar of await comments.locator(':is(#author-thumbnail,#author-thumbnail-button,#creator-heart-button,#hearted-thumbnail), :is(#author-thumbnail,#creator-heart-button) :is(button,yt-img-shadow)').evaluateAll(nodes => nodes.map(el => {
      const s = getComputedStyle(el); return { background:s.backgroundColor, blur:s.backdropFilter, radius:s.borderRadius };
    }))) {
      assert.equal(avatar.background, 'rgba(0, 0, 0, 0)', 'native avatar corners stay transparent');
      assert.equal(avatar.blur, 'none'); assert.equal(avatar.radius, '50%');
    }
    const sort = comments.locator('#sort-menu tp-yt-paper-button.dropdown-trigger');
    await sort.click();
    const sortMenu = comments.locator('yt-sort-filter-sub-menu-renderer tp-yt-iron-dropdown');
    await sortMenu.waitFor({ state:'visible' }); await page.keyboard.press('Escape');
    await sortMenu.waitFor({ state:'hidden' });
    const reply = comments.locator('ytd-comment-replies-renderer #more-replies-sub-thread button:visible, ytd-comment-replies-renderer #more-replies button:visible').first();
    if (await reply.count()) {
      const replyThread = await reply.locator('xpath=ancestor::ytd-comment-thread-renderer').elementHandle();
      const before = await replyThread.$$eval('ytd-comment-view-model, ytd-comment-renderer', nodes => nodes.filter(node => node.checkVisibility()).length);
      await reply.click();
      await page.waitForFunction(({ thread, before }) => [...thread.querySelectorAll('ytd-comment-view-model, ytd-comment-renderer')].filter(node => node.checkVisibility()).length > before,
        { thread:replyThread, before }, { timeout:25000 });
    }
    const focusComments = async () => {
      await comments.evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 80));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    await focusComments();
    await page.screenshot({ path:path.join(os.tmpdir(), 'ytc-comments-desktop.png'), animations:'disabled' });
    // Keep the real desktop site above its native minimum player width.
    // The fixture separately verifies comment layouts down to 320px.
    await page.setViewportSize({ width:480, height:900 });
    await focusComments();
    assert.equal(await thread.evaluate(el => getComputedStyle(el).padding), '10px');
    assert.equal(await thread.evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await sort.click(); await sortMenu.waitFor({ state:'visible' });
    assert.equal(await sortMenu.locator('tp-yt-paper-listbox').evaluate(el => {
      const bounds = el.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth;
    }), true, 'narrow sort popup stays in the viewport');
    await page.keyboard.press('Escape'); await sortMenu.waitFor({ state:'hidden' });
    await focusComments();
    assert.equal(await comments.evaluate(el => { const bounds = el.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }), true, 'comment frame fits the narrow viewport');
    await page.screenshot({ path:path.join(os.tmpdir(), 'ytc-comments-mobile.png'), animations:'disabled' });
    await page.setViewportSize({ width:1440, height:1000 });
    await menu.evaluate(() => chrome.storage.sync.set({ textColor:'#17202c', pageColor:'#f4f7fb', surfaceColor:'#e7edf4', uiOpacity:42, backgroundMode:'none' }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('ytd-comments-header-renderer #count span')).color === 'rgb(23, 32, 44)');
    await focusComments();
    await page.screenshot({ path:path.join(os.tmpdir(), 'ytc-comments-light.png'), animations:'disabled' });
    await sort.click(); await sortMenu.waitFor({ state:'visible' });
    await sortMenu.locator('tp-yt-paper-item').first().waitFor({ state:'visible' });
    assert.ok(await sortMenu.locator('tp-yt-paper-listbox').evaluate(el => el.getBoundingClientRect().width >= 220), 'sort descriptions have room to wrap naturally');
    await page.screenshot({ path:path.join(os.tmpdir(), 'ytc-comments-light-menu.png'), animations:'disabled' });
    const visibility = await sortMenu.locator('tp-yt-paper-listbox').evaluate(el => {
      const bounds = el.getBoundingClientRect(), hit = document.elementFromPoint(bounds.right - 6, bounds.top + 12);
      return { visible:el.contains(hit), hit:hit?.outerHTML.slice(0, 300), bounds:bounds.toJSON() };
    });
    assert.equal(visibility.visible, true, 'sort popup remains uncovered: ' + JSON.stringify(visibility));
    await page.keyboard.press('Escape'); await sortMenu.waitFor({ state:'hidden' });
    console.log('PASS: live YouTube comments keep native text metrics, sorting and public reply expansion; desktop, narrow and light previews saved.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
