// A menu-only preference shared by embedded settings, their host and detached windows.
(() => {
  const normalize = value => ['light', 'dark'].includes(value) ? value : 'auto';
  function observe(change) {
    const system = matchMedia('(prefers-color-scheme: dark)');
    let preference = 'auto', revision = 0, disposed = false;
    const apply = () => { if (!disposed) change({ preference, mode: preference === 'auto' ? system.matches ? 'dark' : 'light' : preference }); };
    const stored = (changes, area) => {
      if (area !== 'local' || !changes.menuTheme) return;
      revision++; preference = normalize(changes.menuTheme.newValue); apply();
    };
    chrome.storage.onChanged.addListener(stored); system.addEventListener('change', apply); apply();
    const ready = chrome.storage.local.get({ menuTheme: 'auto' }).then(value => {
      if (!disposed && revision === 0) { preference = normalize(value.menuTheme); apply(); }
    }).catch(() => {});
    return {
      ready,
      async setPreference(value) {
        const previous = preference, token = ++revision;
        preference = normalize(value); apply();
        try { await chrome.storage.local.set({ menuTheme: preference }); }
        catch (error) { if (!disposed && revision === token) { preference = previous; apply(); } throw error; }
      },
      dispose() { disposed = true; YTCustomizer.removeExtensionListener(chrome.storage.onChanged, stored); system.removeEventListener('change', apply); }
    };
  }
  globalThis.YTCustomizerMenuTheme = { normalize, observe };
})();
