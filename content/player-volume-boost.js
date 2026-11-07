// Share the Audio settings with a compact control beside YouTube's native volume.
(() => {
  function createController(onPreview) {
    const excluded = '#inline-player, #inline-preview-player, ytd-thumbnail, yt-thumbnail-view-model, ' +
      'ytd-video-preview, ytd-video-preview-portal, ytd-video-preview-loader, .ytdVideoPreviewHost, .ytdVideoPreviewPortalHost';
    const structural = '.html5-video-player, .ytp-chrome-bottom, .ytp-chrome-controls, .ytp-left-controls, ' +
      '.ytp-volume-area, .ytp-volume-panel, .ytp-mute-button';
    const owned = 'data-ytc-volume-boost-owned';
    const entries = new Map();
    const anchors = new Map();
    let disposed = false, frame = 0, language = 'auto', enabled = false, boost = 100;
    let saveQueue = Promise.resolve(), revision = 0;
    const t = text => YTCustomizerI18n.translate(text, language);
    const style = document.createElement('style');
    style.setAttribute(owned, '');
    style.textContent = `
      html body .html5-video-player .ytc-volume-boost {
        display: inline-flex !important; align-items: center; vertical-align: top;
        align-self: center; box-sizing: border-box; height: var(--ytc-volume-boost-height, 40px);
        gap: 5px; margin: 0 6px; padding: 0 8px 0 0; flex: 0 0 auto;
        border: 0; border-radius: 999px;
        background: var(--ytc-universal-glass, rgb(24 24 24 / 30%)) !important;
        backdrop-filter: var(--ytc-ui-backdrop, blur(12px)) !important;
        box-shadow: none !important; color: #fff !important;
        font: 12px/1 Roboto, Arial, sans-serif; direction: ltr;
      }
      html body .html5-video-player .ytc-volume-boost[data-ytc-volume-boost-owned] .ytc-volume-boost-toggle {
        display: inline-flex !important; align-items: center; justify-content: center;
        width: 28px !important; min-width: 28px; height: 100%; padding: 0 !important;
        border: 0 !important; border-radius: 999px; background: transparent !important;
        outline: none !important; box-shadow: none !important;
        color: #fff !important; opacity: .85; cursor: pointer; flex: none;
      }
      html body .html5-video-player .ytc-volume-boost[data-ytc-volume-boost-owned] .ytc-volume-boost-toggle[aria-pressed="true"] { color: #ffce70 !important; opacity: 1; }
      html body .html5-video-player .ytc-volume-boost[data-ytc-volume-boost-owned] .ytc-volume-boost-toggle svg {
        width: 19px; height: 19px; pointer-events: none; color: inherit !important;
        filter: drop-shadow(0 1px 1px rgb(0 0 0 / 65%));
      }
      html body .html5-video-player .ytc-volume-boost-slider {
        display: block !important;
        appearance: none; -webkit-appearance: none; box-sizing: border-box;
        width: 64px !important; min-width: 0; height: 24px; padding: 0; margin: 0; border: 0;
        border-radius: 0; box-shadow: none; background: transparent; cursor: pointer;
        flex: none; touch-action: none; opacity: 1 !important; color-scheme: dark;
      }
      html body .html5-video-player .ytc-volume-boost-slider::-webkit-slider-runnable-track {
        height: 4px; border-radius: 2px;
        background: linear-gradient(to right, var(--ytc-boost-color) var(--ytc-boost-fill), #858b96 var(--ytc-boost-fill)) !important;
      }
      html body .html5-video-player .ytc-volume-boost-slider::-webkit-slider-thumb {
        appearance: none; -webkit-appearance: none; box-sizing: border-box;
        width: 12px; height: 12px; margin-top: -4px;
        border: 2px solid #181818; border-radius: 50%; background: #fff !important;
      }
      html body .html5-video-player .ytc-volume-boost-value {
        min-width: 33px; text-align: right; font-variant-numeric: tabular-nums;
        color: #fff !important; opacity: 1; text-shadow: 0 1px 2px rgb(0 0 0 / 80%);
      }
      html body .html5-video-player .ytc-volume-boost[data-ytc-volume-boost-owned] .ytc-volume-boost-toggle:focus-visible,
      html body .html5-video-player .ytc-volume-boost[data-ytc-volume-boost-owned] .ytc-volume-boost-slider:focus-visible {
        outline: 2px solid #fff !important; outline-offset: 1px;
      }
      html body .html5-video-player .ytc-volume-boost.ytc-volume-boost-compact { gap: 3px; margin-inline: 3px; }
      html body .html5-video-player .ytc-volume-boost-compact .ytc-volume-boost-slider { width: 38px !important; }
      html body .html5-video-player .ytc-volume-boost-compact .ytc-volume-boost-toggle { width: 24px !important; min-width: 24px; }
      .html5-video-player .ytc-volume-boost.ytc-volume-boost-narrow { position: relative; }
      .html5-video-player .ytc-volume-boost-narrow .ytc-volume-boost-value {
        position: absolute; bottom: calc(100% + 3px); right: 0; padding: 3px 4px;
        background: var(--ytc-universal-glass, rgb(24 24 24 / 30%));
        backdrop-filter: var(--ytc-ui-backdrop, blur(12px)); border-radius: 3px; pointer-events: none;
      }
      .html5-video-player .ytc-volume-boost-status {
        position: absolute; left: 16px; bottom: 80px; z-index: 65;
        max-width: calc(100% - 32px); padding: 8px 12px; border-radius: 6px;
        background: #000d; color: #fff; font: 13px/1.4 Arial, sans-serif; pointer-events: none;
      }
      .html5-video-player .ytc-volume-boost-status[hidden] { display: none !important; }
    `;
    (document.head || document.documentElement).append(style);

    function updateState() {
      for (const entry of entries.values()) {
        const label = t('Audio enhancement') + ' · ' + t(enabled ? 'On' : 'Off');
        entry.host.toggleAttribute('data-enabled', enabled);
        entry.host.style.setProperty('--ytc-boost-color', enabled ? '#ffce70' : '#c5cbd3');
        entry.host.style.setProperty('--ytc-boost-fill', (boost - 100) / 4 + '%');
        entry.button.setAttribute('aria-pressed', String(enabled));
        entry.button.setAttribute('aria-label', label);
        entry.button.title = label;
        entry.slider.setAttribute('aria-label', t('Volume boost'));
        entry.slider.setAttribute('aria-valuetext', boost + '%');
        entry.slider.title = t('Volume boost') + ' · ' + boost + '%';
        if (entry.slider.value !== String(boost)) entry.slider.value = String(boost);
        if (entry.value.textContent !== boost + '%') entry.value.textContent = boost + '%';
        if (!entry.status.hidden) entry.status.textContent = t('Could not save settings');
      }
    }

    function preview(patch) {
      if (disposed) return;
      revision++;
      onPreview(patch);
    }

    function save(entry) {
      if (disposed) return;
      const patch = { audioEnabled: enabled, volumeBoost: boost }, token = revision;
      entry.status.hidden = true;
      // Commit on release/change, not every drag frame, to stay within sync quotas.
      saveQueue = saveQueue.then(() => chrome.storage.sync.set(patch)).catch(async () => {
        if (disposed || token !== revision) return;
        entry.status.textContent = t('Could not save settings');
        entry.status.hidden = false;
        clearTimeout(entry.timer);
        entry.timer = setTimeout(() => { entry.status.hidden = true; }, 4500);
        try {
          const saved = YTCustomizer.normalize(await chrome.storage.sync.get(['audioEnabled', 'volumeBoost']));
          if (!disposed && token === revision) onPreview({ audioEnabled: saved.audioEnabled, volumeBoost: saved.volumeBoost });
        } catch { /* Keep the error visible if the extension was reloaded. */ }
      });
    }

    function syncHeight(entry, height = entry.anchor?.offsetHeight) {
      if (height > 0 && entry.height !== height) {
        entry.height = height;
        entry.host.style.setProperty('--ytc-volume-boost-height', height + 'px');
      }
    }

    const resize = new ResizeObserver(records => {
      if (disposed) return;
      for (const record of records) {
        const entry = entries.get(record.target);
        entry?.host.classList.toggle('ytc-volume-boost-compact', record.contentRect.width < 720);
        entry?.host.classList.toggle('ytc-volume-boost-narrow', record.contentRect.width < 480);
        const anchored = anchors.get(record.target);
        if (anchored) syncHeight(anchored, record.borderBoxSize?.[0]?.blockSize || record.target.offsetHeight);
      }
    });

    function remove(player, entry) {
      resize.unobserve(player);
      if (entry.anchor) { resize.unobserve(entry.anchor); anchors.delete(entry.anchor); }
      clearTimeout(entry.timer);
      entry.host.remove();
      entry.status.remove();
      entries.delete(player);
    }

    function mount() {
      frame = 0;
      if (disposed) return;
      const current = new Set();
      document.querySelectorAll('.html5-video-player').forEach(player => {
        if (player.closest(excluded)) return;
        const controls = player.querySelector('.ytp-left-controls');
        let anchor = controls?.querySelector('.ytp-volume-area') || controls?.querySelector('.ytp-volume-panel') ||
          controls?.querySelector('.ytp-mute-button');
        if (!anchor) return;
        anchor = anchor.closest('button') || anchor;
        current.add(player);
        let entry = entries.get(player);
        if (!entry) {
          const host = document.createElement('div');
          host.className = 'ytc-volume-boost';
          host.setAttribute(owned, '');
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'ytc-volume-boost-toggle';
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS(svg.namespaceURI, 'path');
          path.setAttribute('fill', 'currentColor');
          path.setAttribute('d', 'M13 2 4 14h7l-1 8 10-13h-7l1-7z');
          svg.append(path);
          button.append(svg);
          const slider = document.createElement('input');
          slider.type = 'range';
          slider.className = 'ytc-volume-boost-slider';
          slider.min = '100'; slider.max = '500'; slider.step = '10';
          const value = document.createElement('span');
          value.className = 'ytc-volume-boost-value';
          value.setAttribute('aria-hidden', 'true');
          host.append(button, slider, value);
          const status = document.createElement('div');
          status.className = 'ytc-volume-boost-status';
          status.setAttribute(owned, '');
          status.setAttribute('role', 'status');
          status.hidden = true;
          entry = { host, button, slider, value, status, timer: 0 };
          entries.set(player, entry);
          resize.observe(player);
          button.addEventListener('click', () => { preview({ audioEnabled: !enabled }); save(entry); });
          slider.addEventListener('input', () => preview({ audioEnabled: true, volumeBoost: Number(slider.value) }));
          slider.addEventListener('change', () => save(entry));
          for (const type of ['click', 'dblclick', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
            host.addEventListener(type, event => event.stopPropagation());
          }
          for (const type of ['keydown', 'keyup']) host.addEventListener(type, event => {
            if (event.target === slider || event.key === ' ' || event.key === 'Enter') event.stopPropagation();
          });
        }
        if (entry.anchor !== anchor) {
          if (entry.anchor) { resize.unobserve(entry.anchor); anchors.delete(entry.anchor); }
          entry.anchor = anchor;
          anchors.set(anchor, entry);
          resize.observe(anchor, { box: 'border-box' });
        }
        syncHeight(entry);
        if (anchor.nextElementSibling !== entry.host) anchor.after(entry.host);
        if (!entry.status.isConnected) player.append(entry.status);
      });
      for (const [player, entry] of entries) if (!current.has(player)) remove(player, entry);
      updateState();
    }

    function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(mount); }
    function handleMutations(records) {
      for (const record of records) {
        if (record.type !== 'childList' || record.target instanceof Element && record.target.closest('[' + owned + ']')) continue;
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (!record.removedNodes.length && nodes.length && nodes.every(node => node instanceof Element && node.hasAttribute(owned))) continue;
        if (record.target instanceof Element && record.target.matches(structural) || nodes.some(node =>
            node instanceof Element && (node.matches(structural) || node.querySelector(structural)))) { schedule(); return; }
      }
    }

    const events = ['yt-navigate-finish', 'yt-page-data-updated', 'fullscreenchange'];
    for (const type of events) document.addEventListener(type, schedule);
    window.addEventListener('popstate', schedule);
    function onLanguage(changes, area) {
      if (area === 'local' && changes.menuLanguage) { language = changes.menuLanguage.newValue || 'auto'; updateState(); }
    }
    chrome.storage.onChanged.addListener(onLanguage);
    void chrome.storage.local.get({ menuLanguage: 'auto' }).then(value => {
      if (!disposed) { language = value.menuLanguage; updateState(); }
    }).catch(() => {});
    mount();
    return {
      sync(settings) { enabled = settings.audioEnabled; boost = settings.volumeBoost; updateState(); },
      handleMutations,
      dispose() {
        disposed = true;
        cancelAnimationFrame(frame);
        resize.disconnect();
        for (const type of events) document.removeEventListener(type, schedule);
        window.removeEventListener('popstate', schedule);
        YTCustomizer.removeExtensionListener(chrome.storage.onChanged, onLanguage);
        for (const [player, entry] of entries) remove(player, entry);
        style.remove();
      }
    };
  }
  globalThis.YTCustomizerPlayerVolumeBoost = Object.freeze({ createController });
})();
