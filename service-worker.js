// Browser-managed shortcuts preserve user remapping and avoid YouTube's single-key controls.
importScripts('settings.js', 'i18n.js', 'content/picture-in-picture.js');

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
  if (!['toggle-picture-in-picture', 'toggle-audio-enhancement'].includes(command)) return;
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
