// Page-scoped defaults only fill commands the browser has left unassigned.
(() => {
  const keys = Object.freeze({ KeyY: '_execute_action', KeyP: 'toggle-picture-in-picture', KeyA: 'toggle-audio-enhancement' });
  function createController() {
    if (window !== window.top) return { sync() {}, dispose() {} };
    let enabled = false, disposed = false, revision = 0, unassigned = new Set();
    async function refresh() {
      const token = ++revision;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'YT_SHORTCUT_DEFAULT_STATE' });
        if (!disposed && token === revision) unassigned = new Set(result?.ok && Array.isArray(result.unassigned) ? result.unassigned : []);
      } catch { if (token === revision) unassigned.clear(); }
    }
    function keydown(event) {
      const command = keys[event.code];
      if (!enabled || disposed || !command || !unassigned.has(command) || !event.isTrusted || event.repeat || event.isComposing ||
          event.defaultPrevented || !event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
      if (event.composedPath().some(node => node instanceof Element && (node.isContentEditable || node.matches('input,textarea,select,[role="textbox"],[role="combobox"],iframe')))) return;
      event.preventDefault(); event.stopPropagation();
      void chrome.runtime.sendMessage({ type: 'YT_SHORTCUT_DEFAULT_EXECUTE', command }).catch(() => {});
    }
    function focus() { if (enabled) void refresh(); }
    document.addEventListener('keydown', keydown, true); window.addEventListener('focus', focus);
    return {
      sync(settings) { const next = settings.useDefaultShortcuts === true; if (enabled !== next) { enabled = next; if (enabled) void refresh(); else { revision++; unassigned.clear(); } } },
      dispose() { disposed = true; revision++; document.removeEventListener('keydown', keydown, true); window.removeEventListener('focus', focus); }
    };
  }
  globalThis.YTCustomizerDefaultShortcuts = { createController };
})();
