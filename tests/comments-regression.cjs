// Comments stay native and interactive while sharing a single frosted surface.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const avatar = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
function model(tag, id) {
  const image = `<yt-img-shadow><img src="${avatar}" alt="Author"></yt-img-shadow>`;
  const author = tag === 'ytd-comment-view-model'
    ? `<div id="author-thumbnail"><button id="author-thumbnail-button" type="button" aria-label="View author">${image}</button></div>`
    : `<a id="author-thumbnail" href="#author" aria-label="View author">${image}</a>`;
  return `<${tag} id="${id}"><div id="body">${author}<div id="main">
    <div id="header"><div id="header-author"><h3><a id="author-text">@A_very_long_comment_author_name</a></h3><span id="published-time-text"><a>2 days ago</a></span></div></div>
    <ytd-expander><div id="content-text" class="collapsed"><span>Original text 一段中文コメント 한국어 ภาษาไทย<br>More lines<br><a href="#timestamp">03:25</a> and <span role="link">@mention</span><br>Final line</span></div>
      <tp-yt-paper-button id="more" tabindex="0">Read more</tp-yt-paper-button><tp-yt-paper-button id="less" tabindex="0" hidden>Show less</tp-yt-paper-button></ytd-expander>
    <ytd-comment-engagement-bar id="action-buttons"><div id="toolbar"><button class="like" aria-pressed="false">Like</button><span id="vote-count-middle">3</span><button class="reply">Reply</button><ytd-creator-heart-renderer><yt-icon-button id="creator-heart-button"><button disabled aria-label="Heart"><yt-img-shadow id="hearted-thumbnail"><img src="${avatar}" alt="Creator"></yt-img-shadow></button></yt-icon-button><span class="creator-heart" style="color:rgb(220,0,0)">♥</span></ytd-creator-heart-renderer></div></ytd-comment-engagement-bar>
    </div><div id="action-menu"><button class="more-menu">More</button><div class="popup" role="menu" hidden>Native menu</div></div></div></${tag}>`;
}
function comments(id, modern = false, panel = false) {
  return `<ytd-comments id="${id}" ${panel ? 'engagement-panel' : ''}><ytd-comments-header-renderer>
    <div id="title"><div id="leading-section"><h2 id="count"><yt-formatted-string><span>48 Comments</span></yt-formatted-string></h2></div>
    <div id="additional-section"><span id="sort-menu"><tp-yt-paper-button class="dropdown-trigger" role="button" tabindex="0">Sort by</tp-yt-paper-button><tp-yt-paper-listbox class="sort-popup" hidden><tp-yt-paper-item>Top</tp-yt-paper-item><tp-yt-paper-item>Newest first</tp-yt-paper-item></tp-yt-paper-listbox></span></div></div>
    <ytd-comment-simplebox-renderer><yt-img-shadow id="author-thumbnail"><img src="${avatar}" alt="My avatar"></yt-img-shadow><div id="placeholder-area"><div id="simplebox-placeholder" role="textbox" tabindex="0"><span>Add a comment...</span></div></div>
      <div id="comment-dialog" hidden><ytd-comment-dialog-renderer style="background:white!important"><div id="contenteditable-root" contenteditable="true" role="textbox"></div><button class="cancel">Cancel</button><button class="submit">Comment</button></ytd-comment-dialog-renderer></div>
    </ytd-comment-simplebox-renderer></ytd-comments-header-renderer>
    <div id="contents"><ytd-comment-thread-renderer id="${id}-thread"><div id="comment-container">${model(modern ? 'ytd-comment-view-model' : 'ytd-comment-renderer', id + '-model')}</div>
      <div id="replies"><ytd-comment-replies-renderer><yt-sub-thread><div class="ytSubThreadThreadline"><div class="ytSubThreadConnection"></div></div><div class="ytSubThreadSubThreadContent">
        <button class="show-replies" aria-expanded="false">1 reply</button><div class="reply-list" hidden></div></div></yt-sub-thread></ytd-comment-replies-renderer></div>
    </ytd-comment-thread-renderer></div></ytd-comments>`;
}
const fixture = `<!doctype html><html><head><style>
body{margin:0;font:14px/20px Arial;color:#111}ytd-app,ytd-watch-flexy,ytd-watch-grid,ytd-comments,ytd-comments-header-renderer,ytd-comment-thread-renderer,ytd-comment-renderer,ytd-comment-view-model,ytd-expander,ytd-comment-replies-renderer,ytd-comment-dialog-renderer{display:block}
ytd-watch-flexy{width:820px;max-width:100%;margin:auto}ytd-watch-grid{width:420px;max-width:100%;margin:auto}ytd-comments{margin:20px 0;background:#eee}
ytd-comments-header-renderer #title{display:flex;align-items:center;gap:24px;margin-bottom:20px}#count{margin:0;font-size:20px}#count span,#content-text>span{color:#111}
ytd-comment-simplebox-renderer{display:flex;margin-bottom:24px}ytd-comment-simplebox-renderer>#author-thumbnail{width:24px;height:24px;margin-right:16px;flex:none}ytd-comment-simplebox-renderer img{width:100%;height:100%}#placeholder-area,#comment-dialog{flex:1}
#simplebox-placeholder{border-bottom:1px solid #777}#contenteditable-root{min-height:64px;padding:6px;border:1px solid #777}
ytd-comment-thread-renderer{margin-bottom:20px}#body{display:flex}#body>#author-thumbnail{width:40px;height:40px;flex:none;margin-right:16px}#body>#author-thumbnail img{width:40px;height:40px;border-radius:50%}#main{flex:1}#header-author{display:flex;gap:4px}h3{margin:0;font-size:13px}#published-time-text a{font-size:12px;color:#777}#content-text{font-size:14px;line-height:20px}.collapsed{max-height:40px;overflow:hidden}
#toolbar{display:flex;gap:0}button,tp-yt-paper-button{font:inherit;cursor:pointer}tp-yt-paper-button{display:inline-block;padding:4px 8px}#action-menu{position:relative;opacity:0}#action-menu .popup{position:absolute;right:0;top:32px;width:120px;background:#eee;border:1px solid #777;z-index:99}
yt-img-shadow{display:block}#author-thumbnail,#author-thumbnail :is(button,yt-img-shadow),#creator-heart-button,#creator-heart-button button,#hearted-thumbnail{background:#777;border-radius:0}
#author-thumbnail button,#author-thumbnail yt-img-shadow{width:100%;height:100%;padding:0;border:0;box-sizing:border-box}#creator-heart-button{display:inline-block;width:20px;height:20px}#creator-heart-button button,#hearted-thumbnail,#hearted-thumbnail img{width:20px;height:20px;padding:0;border:0}
yt-sub-thread{display:flex;position:relative;margin-left:20px}.ytSubThreadThreadline{width:36px;flex:none}.ytSubThreadConnection{width:28px;height:30px;border-left:1px solid #777;border-bottom:1px solid #777;border-radius:0 0 0 16px}.ytSubThreadSubThreadContent{min-width:0;flex:1}
.reply-list{padding-top:10px}.reply-list #body>#author-thumbnail,.reply-list #body>#author-thumbnail img{width:24px;height:24px}.reply-list #body>#author-thumbnail{margin-right:8px}
[hidden]{display:none!important}
</style></head><body><ytd-app><ytd-watch-flexy>${comments('classic')}</ytd-watch-flexy><ytd-watch-grid><ytd-engagement-panel-section-list-renderer><div id="content">${comments('modern', true, true)}</div></ytd-engagement-panel-section-list-renderer></ytd-watch-grid></ytd-app><script>
window.events=[];window.firstThread=document.querySelector('ytd-comment-thread-renderer');
document.querySelectorAll('#author-thumbnail-button,a#author-thumbnail').forEach(avatar=>avatar.onclick=event=>{event.preventDefault();events.push('author')});
document.querySelectorAll('ytd-comments').forEach(comments=>{
 const composer=comments.querySelector('ytd-comment-simplebox-renderer'),placeholder=composer.querySelector('#placeholder-area'),dialog=composer.querySelector('#comment-dialog'),editor=composer.querySelector('[contenteditable]');
 composer.querySelector('#simplebox-placeholder').onclick=()=>{placeholder.hidden=true;dialog.hidden=false;editor.focus()};
 composer.querySelector('.cancel').onclick=()=>{dialog.hidden=true;placeholder.hidden=false};
 composer.querySelector('.submit').onclick=()=>events.push('submit:'+editor.textContent);
 comments.querySelector('.dropdown-trigger').onclick=()=>{const popup=comments.querySelector('.sort-popup');popup.hidden=!popup.hidden;events.push('sort')};
 const thread=comments.querySelector('ytd-comment-thread-renderer'),text=thread.querySelector('#content-text'),more=thread.querySelector('#more'),less=thread.querySelector('#less');
 more.onclick=()=>{text.classList.remove('collapsed');more.hidden=true;less.hidden=false};less.onclick=()=>{text.classList.add('collapsed');more.hidden=false;less.hidden=true};
 thread.querySelector('.like').onclick=event=>{event.currentTarget.setAttribute('aria-pressed','true');thread.querySelector('#vote-count-middle').textContent='4';events.push('like')};
 thread.querySelector('.more-menu').onclick=()=>{const popup=thread.querySelector('.popup');popup.hidden=!popup.hidden;events.push('menu')};
 thread.querySelector('.show-replies').onclick=event=>{const list=thread.querySelector('.reply-list'),open=list.hidden;list.hidden=!open;event.currentTarget.setAttribute('aria-expanded',String(open));if(!list.childElementCount)list.innerHTML=${JSON.stringify(model('ytd-comment-view-model','native-reply'))};events.push('reply')};
});
</script></body></html>`;
(async () => {
  const context = await chromium.launchPersistentContext('', { channel:'chrome', headless:true,
    viewport:{ width:1100, height:900 }, ignoreDefaultArgs:['--disable-extensions'], args:['--enable-unsafe-extension-debugging'] });
  const deadline = setTimeout(() => void context.close(), 60000), errors = [];
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType:'text/html', body:fixture }));
    const cdp = await context.browser().newBrowserCDPSession(), { id } = await cdp.send('Extensions.loadUnpacked', { path:root });
    const menu = await context.newPage(); await menu.goto(`chrome-extension://${id}/popup.html`); await menu.waitForSelector('#settings-form:not([inert])');
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); await page.goto('https://www.youtube.com/watch?v=comments-fixture');
    const cardLayout = () => page.locator('ytd-comments').evaluateAll(roots => roots.map(root => {
      const s = selector => getComputedStyle(root.querySelector(selector)), thread = s('ytd-comment-thread-renderer'), composer = s('ytd-comment-simplebox-renderer');
      return { rootPadding:getComputedStyle(root).padding, rootBorder:getComputedStyle(root).borderTopWidth,
        threadPadding:thread.padding, threadRadius:thread.borderRadius, threadBorder:thread.borderTopWidth, threadGap:thread.marginBottom,
        composerPadding:composer.padding, composerRadius:composer.borderRadius, composerBorder:composer.borderTopWidth,
        titleFont:s('#count').fontSize, underline:s('#simplebox-placeholder').borderBottomWidth };
    }));
    const native = await page.locator('#classic').evaluate(root => {
      const s = el => getComputedStyle(root.querySelector(el));
      return { padding:getComputedStyle(root).padding, border:getComputedStyle(root).borderTopWidth,
        threadPadding:s('ytd-comment-thread-renderer').padding, header:s('#count span').color, text:s('#content-text').lineHeight };
    });
    await menu.evaluate(() => chrome.storage.sync.set({ themeEnabled:true, textColor:'#edf1f8', surfaceColor:'#17202c', pageColor:'#141821', uiOpacity:42, uiBlur:12, accentColor:'#f04464' }));
    await page.waitForFunction(() => document.querySelector('#classic').hasAttribute('data-ytc-universal-glass'));
    const withoutCards = await cardLayout();
    const avatars = page.locator('ytd-comments :is(#author-thumbnail,#author-thumbnail-button,#creator-heart-button,#hearted-thumbnail), ytd-comments :is(#author-thumbnail,#creator-heart-button) :is(button,yt-img-shadow)');
    async function assertClearAvatars() {
      for (const style of await avatars.evaluateAll(nodes => nodes.map(el => { const s = getComputedStyle(el); return { background:s.backgroundColor, blur:s.backdropFilter, radius:s.borderRadius, shadow:s.boxShadow }; }))) {
        assert.equal(style.background, 'rgba(0, 0, 0, 0)', 'avatar corners never receive a button background');
        assert.equal(style.blur, 'none'); assert.equal(style.radius, '50%'); assert.equal(style.shadow, 'none');
      }
    }
    await assertClearAvatars();
    for (const layout of withoutCards) {
      assert.equal(layout.threadBorder, '0px', 'page theme alone does not enable comment cards');
      assert.equal(layout.composerBorder, '0px');
    }
    await menu.reload(); await menu.waitForSelector('#settings-form:not([inert])');
    await menu.locator('#tab-layout').click(); await menu.locator('#customizeCards').check();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#classic-thread')).borderTopWidth === '1px');
    for (const rootId of ['classic','modern']) {
      const comments = page.locator('#' + rootId);
      const style = await comments.evaluate(root => {
        const first = root.querySelector('ytd-comment-thread-renderer'), s = el => getComputedStyle(root.querySelector(el));
        return { color:s('#count span').color, author:s('#author-text').color, time:s('#published-time-text a').color,
          text:s('#content-text > span').color, lineHeight:s('#content-text').lineHeight,
          link:s('#content-text a').color, mention:s('#content-text [role="link"]').color,
          radius:getComputedStyle(first).borderRadius, border:getComputedStyle(first).borderTopWidth,
          background:getComputedStyle(first).backgroundColor, blur:getComputedStyle(first).backdropFilter,
          composerBlur:s('ytd-comment-simplebox-renderer').backdropFilter, heart:s('.creator-heart').color,
          rootBlur:getComputedStyle(root).backdropFilter, parentBlur:getComputedStyle(root.parentElement).backdropFilter };
      });
      assert.equal(style.color, 'rgb(237, 241, 248)'); assert.equal(style.author, style.color); assert.equal(style.text, style.color);
      assert.notEqual(style.time, 'rgb(119, 119, 119)'); assert.equal(style.lineHeight, native.text);
      assert.equal(style.link, 'rgb(240, 68, 100)'); assert.equal(style.mention, style.link);
      assert.equal(style.radius, '16px'); assert.equal(style.border, '1px'); assert.equal(style.background, 'rgba(0, 0, 0, 0)');
      assert.equal(style.blur, 'none'); assert.equal(style.composerBlur, 'none'); assert.equal(style.heart, 'rgb(220, 0, 0)');
      assert.equal(rootId === 'classic' ? style.rootBlur : style.parentBlur, 'blur(12px)');
      if (rootId === 'modern') assert.equal(style.rootBlur, 'none', 'engagement panels share one outer blur');
      const author = comments.locator('#author-thumbnail-button, a#author-thumbnail').first();
      const box = await author.boundingBox();
      await author.hover(); await assertClearAvatars();
      assert.equal(await author.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'avatar hover does not draw a rectangular button outline');
      await author.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
      assert.equal(await author.evaluate(el => document.activeElement === el && el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'), true, 'native keyboard focus remains visible');
      await author.click(); const afterClick = await author.boundingBox();
      assert.equal(afterClick.width, box.width); assert.equal(afterClick.height, box.height, 'avatar hit area keeps its native size');
      assert.equal(await page.evaluate(() => events.includes('author')), true, 'avatar links/buttons remain clickable');
      await comments.locator('.dropdown-trigger').click(); assert.equal(await comments.locator('.sort-popup').isVisible(), true);
      await comments.locator('.like').click(); assert.equal(await comments.locator('#vote-count-middle').textContent(), '4');
      const content = comments.locator('ytd-comment-thread-renderer #content-text').first(), originalText = await content.textContent();
      await comments.locator('#more').click(); assert.equal(await content.evaluate(el => el.classList.contains('collapsed')), false);
      assert.equal(await content.textContent(), originalText); await comments.locator('#less').click();
      await comments.locator('.show-replies').click(); await comments.locator('.reply-list ytd-comment-view-model').waitFor({ state:'visible' });
      await assertClearAvatars();
      assert.equal(await comments.locator('.show-replies').getAttribute('aria-expanded'), 'true');
      await comments.locator('.show-replies').click(); assert.equal(await comments.locator('.reply-list').isVisible(), false);
      await comments.locator('.more-menu').first().click(); assert.equal(await comments.locator('.popup').first().isVisible(), true);
      assert.equal(await comments.locator('ytd-comment-thread-renderer').evaluate(el => getComputedStyle(el).overflow), 'visible');
      await comments.locator('#simplebox-placeholder').click(); const editor = comments.locator('[contenteditable]');
      await editor.fill('Local editor test 中文'); assert.equal(await editor.textContent(), 'Local editor test 中文');
      await comments.locator('.submit').click();
      assert.equal(await page.evaluate(() => events.includes('submit:Local editor test 中文')), true, 'native fixture submit receives the unchanged editor text');
      await comments.locator('.cancel').click();
    }
    const geometry = { cardRadius:24, cardBorderWidth:3, cardPadding:14, cardGap:20, shelfSpacing:22 };
    await menu.evaluate(settings => chrome.storage.sync.set(settings), geometry);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#classic-thread')).borderRadius === '24px');
    for (const layout of await cardLayout()) {
      assert.equal(layout.threadRadius, '24px'); assert.equal(layout.composerRadius, '24px');
      assert.equal(layout.threadBorder, '3px'); assert.equal(layout.composerBorder, '3px');
      assert.equal(layout.threadPadding, '14px'); assert.equal(layout.composerPadding, '14px'); assert.equal(layout.threadGap, '20px');
    }
    assert.equal(await page.locator('#classic ytd-comments-header-renderer').evaluate(el => getComputedStyle(el).marginBottom), '22px');
    await menu.reload(); await menu.waitForSelector('#settings-form:not([inert])'); await menu.locator('#tab-layout').click();
    await menu.locator('#customizeCards').uncheck();
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-cards'));
    assert.deepEqual(await cardLayout(), withoutCards, 'turning off card customization restores both comment layouts without changing the theme');
    await menu.locator('#customizeCards').check();
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-ytc-cards'));
    await menu.evaluate(() => storageWriteQueue);
    await menu.evaluate(() => chrome.storage.sync.set({ cardRadius:0, cardBorderWidth:0, cardPadding:0, cardGap:4 }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#classic-thread')).borderRadius === '0px');
    for (const layout of await cardLayout()) {
      assert.equal(layout.threadBorder, '0px'); assert.equal(layout.threadPadding, '0px'); assert.equal(layout.composerRadius, '0px');
    }
    await menu.evaluate(settings => chrome.storage.sync.set(settings), geometry);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#classic-thread')).borderRadius === '24px');
    await menu.evaluate(() => chrome.storage.local.set({ pageProfiles:{ watch:{ enabled:true, settings:{ customizeCards:false } } } }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-cards'));
    assert.deepEqual(await cardLayout(), withoutCards, 'watch configuration can disable comment cards while shared customization stays enabled');
    assert.equal(await menu.evaluate(async () => (await chrome.storage.sync.get('customizeCards')).customizeCards), true);
    await menu.evaluate(() => chrome.storage.local.remove('pageProfiles'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#classic-thread')).borderRadius === '24px');
    for (const width of [600,390,320]) {
      await page.setViewportSize({ width, height:900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no overflow at ' + width);
      assert.equal(await page.locator('#classic-thread').evaluate(el => getComputedStyle(el).padding), '10px');
    }
    await menu.evaluate(() => chrome.storage.sync.set({ textColor:'#17202c', pageColor:'#f4f7fb', surfaceColor:'#e7edf4', uiBlur:0 }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#classic #count span')).color === 'rgb(23, 32, 44)');
    assert.equal(await page.locator('#classic').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    const action = await page.locator('#classic .like').first().evaluate(el => {
      const s = getComputedStyle(el); return { color:s.color, background:s.backgroundColor, blur:s.backdropFilter };
    });
    assert.equal(action.color, 'rgb(255, 255, 255)'); assert.equal(action.blur, 'none');
    assert.equal(await page.locator('#classic .sort-popup').evaluate(el => getComputedStyle(el).backgroundColor), action.background, 'sort popup keeps a readable dark tint');
    const rgba = action.background.match(/[\d.]+/g).map(Number);
    // White labels must reach 4.5:1 even against a white page at normal opacity.
    const luminance = rgba.slice(0, 3).map(channel => (channel * rgba[3] + 255 * (1 - rgba[3])) / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
      .reduce((total, channel, i) => total + channel * [.2126, .7152, .0722][i], 0);
    assert.ok(1.05 / (luminance + .05) >= 4.5, 'comment action labels remain readable in a light theme');
    await menu.evaluate(() => chrome.storage.sync.set({ uiOpacity:0 }));
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#classic .like')).backgroundColor.match(/[\d.]+/g)[3]) === 0);
    await menu.evaluate(() => chrome.storage.sync.set({ hideComments:true }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#classic')).display === 'none');
    await menu.evaluate(() => chrome.storage.sync.set({ hideComments:false, themeEnabled:false }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-ytc-theme'));
    await page.setViewportSize({ width:1100, height:900 });
    const restored = await page.locator('#classic').evaluate(root => {
      const s = el => getComputedStyle(root.querySelector(el));
      return { padding:getComputedStyle(root).padding, border:getComputedStyle(root).borderTopWidth,
        threadPadding:s('ytd-comment-thread-renderer').padding, header:s('#count span').color, text:s('#content-text').lineHeight };
    });
    assert.deepEqual(restored, native, 'disabling the theme fully restores native comments');
    assert.equal(await page.evaluate(() => firstThread === document.querySelector('ytd-comment-thread-renderer')), true);
    assert.deepEqual(errors, []);
    console.log('PASS: comment cards opt in through the existing menu switch, share card geometry, respect watch overrides, and fully restore on disable; native interactions, narrow layouts, light/dark and one glass layer remain intact.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
