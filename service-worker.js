// Browser-managed shortcuts preserve user remapping and avoid YouTube's single-key controls.
importScripts('settings.js', 'i18n.js', 'content/picture-in-picture.js', 'content/video-bookmarks.js');

const shortcutQueues = new Map();

async function notifyShortcut(tabId, message) {
  const { menuLanguage = 'auto' } = await chrome.storage.local.get('menuLanguage');
  const text = YTCustomizerI18n.translate(message, menuLanguage);
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, args: [text], func: text => {
    const previous = globalThis.__ytCustomizerShortcutNotice;
    if (previous?.node?.hasAttribute('data-ytc-shortcut-notice')) {
      clearTimeout(previous.timer);
      previous.node.remove();
    }
    const node = document.createElement('div');
    node.setAttribute('data-ytc-shortcut-notice', '');
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    node.textContent = text;
    node.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:2147483647;max-width:calc(100vw - 48px);padding:10px 16px;border:1px solid #ffffff50;border-radius:8px;background:#171717ed;color:white;font:14px/1.5 Arial,sans-serif;pointer-events:none;';
    (document.body || document.documentElement).append(node);
    globalThis.__ytCustomizerShortcutNotice = { node, timer: setTimeout(() => {
      node.remove();
      if (globalThis.__ytCustomizerShortcutNotice?.node === node) delete globalThis.__ytCustomizerShortcutNotice;
    }, 3000) };
  } });
}

async function runShortcut(command, tab) {
  if (!['_execute_action', 'toggle-picture-in-picture', 'toggle-audio-enhancement'].includes(command)) return;
  if (!tab?.id || !tab.active || !YTCustomizer.isYouTubeUrl(tab.url)) return;
  try {
    const [guard] = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: () => {
      let element = document.activeElement;
      while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
      // A focused iframe may contain the live-chat editor; do not send actions
      // through it or touch another frame's player.
      return !element || !(element.isContentEditable || element.closest('input,textarea,select,[role="textbox"],[role="combobox"]') || element.tagName === 'IFRAME');
    } });
    if (!guard?.result) return;
    if (command === '_execute_action') { await openPageSettings(tab); return; }
    if (command === 'toggle-audio-enhancement') {
      const { audioEnabled } = YTCustomizer.normalize(await chrome.storage.sync.get('audioEnabled'));
      await chrome.storage.sync.set({ audioEnabled: !audioEnabled });
      await notifyShortcut(tab.id, audioEnabled ? 'Audio enhancement disabled.' : 'Audio enhancement enabled.');
    } else {
      const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] },
        func: YTCustomizerPictureInPicture.execute, args: ['toggle'] });
      const result = injection?.result;
      await notifyShortcut(tab.id, result?.error || (result?.active ? 'Picture-in-picture opened.' : 'Video returned to its tab.'));
    }
  } catch {
    await notifyShortcut(tab.id, 'Could not run shortcut. Refresh YouTube and try again.').catch(() => {});
  }
}

function handleShortcutCommand(command, tab) {
  const key = tab?.id;
  const pending = (shortcutQueues.get(key) || Promise.resolve()).then(() => runShortcut(command, tab));
  shortcutQueues.set(key, pending);
  void pending.finally(() => { if (shortcutQueues.get(key) === pending) shortcutQueues.delete(key); });
  return pending;
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (tab) void handleShortcutCommand(command, tab);
  else void chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) => handleShortcutCommand(command, active)).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!['YT_SHORTCUT_DEFAULT_STATE', 'YT_SHORTCUT_DEFAULT_EXECUTE'].includes(message?.type) || sender?.id !== chrome.runtime.id ||
      sender.frameId !== 0 || !sender.tab?.id || !YTCustomizer.isYouTubeUrl(sender.url) || !YTCustomizer.isYouTubeUrl(sender.tab.url)) return false;
  void (async () => {
    const commands = await chrome.commands.getAll();
    const names = ['_execute_action', 'toggle-picture-in-picture', 'toggle-audio-enhancement'];
    const unassigned = names.filter(name => !commands.find(command => command.name === name)?.shortcut);
    if (message.type === 'YT_SHORTCUT_DEFAULT_STATE') return { ok: true, unassigned };
    const { useDefaultShortcuts } = YTCustomizer.normalize(await chrome.storage.sync.get('useDefaultShortcuts'));
    if (!useDefaultShortcuts || !unassigned.includes(message.command)) return { ok: false };
    const tab = await chrome.tabs.get(sender.tab.id);
    await handleShortcutCommand(message.command, tab); return { ok: true };
  })().then(reply, () => reply({ ok: false }));
  return true;
});

// Only a menu requested by our main-frame button can initialize an embedded view.
// Session storage survives worker suspension and never becomes a saved preference.
const settingsFrameQueues = new Map();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!['YT_SETTINGS_EMBED_START', 'YT_SETTINGS_EMBED_CONTEXT', 'YT_SETTINGS_EMBED_END'].includes(message?.type) ||
      sender?.id !== chrome.runtime.id || !sender.tab?.id || !YTCustomizer.isYouTubeUrl(sender.tab.url)) return false;
  const isContent = sender.frameId === 0 && YTCustomizer.isYouTubeUrl(sender.url);
  const isView = sender.frameId > 0 && YTCustomizer.isSettingsPageUrl(sender.url, chrome.runtime.getURL('popup.html')) &&
    new URL(sender.url).searchParams.get('embedded') === '1';
  if (message.type === 'YT_SETTINGS_EMBED_CONTEXT' ? !isView : !isContent) return false;
  const tabId = sender.tab.id, key = 'inPageSettings:' + tabId;
  const pending = (settingsFrameQueues.get(tabId) || Promise.resolve()).catch(() => {}).then(async () => {
    if (message.type === 'YT_SETTINGS_EMBED_START') {
      const token = crypto.randomUUID().replace(/-/g, '');
      const secret = crypto.randomUUID().replace(/-/g, '');
      await chrome.storage.session.set({ [key]: { token, secret, document: null } });
      return { ok: true, token, secret };
    }
    const session = (await chrome.storage.session.get(key))[key];
    if (!session || session.token !== message.token) return { ok: false };
    if (message.type === 'YT_SETTINGS_EMBED_END') { await chrome.storage.session.remove(key); return { ok: true }; }
    const urlToken = new URL(sender.url).searchParams.get('token'), document = sender.documentId || 'frame:' + sender.frameId;
    if (urlToken !== session.token || message.secret !== session.secret || session.document && session.document !== document) return { ok: false };
    await chrome.storage.session.set({ [key]: { ...session, document } });
    return { ok: true, tabId, hostOrigin: new URL(sender.tab.url).origin };
  });
  settingsFrameQueues.set(tabId, pending);
  void pending.then(reply, () => reply({ ok: false })).finally(() => {
    if (settingsFrameQueues.get(tabId) === pending) settingsFrameQueues.delete(tabId);
  });
  return true;
});

chrome.tabs.onRemoved.addListener(tabId => { void chrome.storage.session.remove('inPageSettings:' + tabId).catch(() => {}); });

// The browser icon and its existing shortcut now open the same in-page menu.
async function openPageSettings(tab) {
  if (!tab?.id || !YTCustomizer.isYouTubeUrl(tab.url)) {
    await chrome.windows.create({ url: chrome.runtime.getURL('popup.html?window=1'), type: 'popup', width: 520, height: 760 });
    return;
  }
  // Check the generation before toggling: retrying a toggle after an upgrade
  // would immediately close a menu that already handled the first request.
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'YT_SETTINGS_STATUS' }, { frameId: 0 }).catch(() => null);
  if (response?.version !== YTCustomizer.version) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: chrome.runtime.getManifest().content_scripts[0].js });
  }
  await chrome.tabs.sendMessage(tab.id, { type: 'YT_SETTINGS_TOGGLE' }, { frameId: 0 });
}
chrome.action.onClicked.addListener(tab => { void openPageSettings(tab).catch(() => notifyShortcut(tab.id, 'Could not open settings. Refresh YouTube and try again.').catch(() => {})); });

// A worker owns each record's writes so simultaneous tabs do not lose bookmarks.
const bookmarkQueues = new Map();
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== 'YT_VIDEO_BOOKMARK_WRITE' || sender?.id !== chrome.runtime.id || sender.frameId !== 0 ||
      !sender.tab?.id || !YTCustomizer.isYouTubeUrl(sender.tab.url) ||
      !message.videoId || (YTCustomizerVideoBookmarks.videoId(sender.url) !== message.videoId &&
        YTCustomizerVideoBookmarks.videoId(sender.tab.url) !== message.videoId)) return false;
  const key = 'videoBookmarks:' + message.videoId;
  const pending = (bookmarkQueues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    const stored = await chrome.storage.local.get(key);
    const data = YTCustomizerVideoBookmarks.mutate(stored[key], message.action, message.payload);
    await chrome.storage.local.set({ [key]: data }); return data;
  });
  bookmarkQueues.set(key, pending);
  void pending.then(data => reply({ ok: true, data }), error => reply({ ok: false, error: error.message })).finally(() => {
    if (bookmarkQueues.get(key) === pending) bookmarkQueues.delete(key);
  });
  return true;
});

// Discard obsolete window snapshots without changing any browser window.
void chrome.storage.session.get(null).then(values => {
  const keys = Object.keys(values).filter(key => key.startsWith('fullscreenWindow:'));
  if (keys.length) return chrome.storage.session.remove(keys);
}).catch(() => {});
