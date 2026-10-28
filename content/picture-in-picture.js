// Share native PiP between the menu action and the player's own control button.
(() => {
  async function execute(action, playerRoot) {
    if (action !== "status" && action !== "toggle") return { error: "Unknown picture-in-picture action" };
    const players = ':is(#movie_player, #shorts-player, ytd-reel-video-renderer, ' +
      'ytd-miniplayer, ytmusic-player, .html5-video-player) video';
    const excluded = '#ytc-background-video, #inline-player, #inline-preview-player, ' +
      'ytd-thumbnail, yt-thumbnail-view-model, ytd-video-preview, ytd-video-preview-portal, ' +
      'ytd-video-preview-loader, .ytdVideoPreviewHost, .ytdVideoPreviewPortalHost';
    const root = playerRoot instanceof Element ? playerRoot : document;
    const isPlayer = video => video instanceof HTMLVideoElement && video.matches(players) && !video.closest(excluded) &&
      (root === document || root.contains(video));
    const active = isPlayer(document.pictureInPictureElement);
    const supported = Boolean(document.pictureInPictureEnabled && HTMLVideoElement.prototype.requestPictureInPicture);
    const state = { supported, active, available: active };
    try {
      if (active) {
        if (action === "toggle") {
          await document.exitPictureInPicture();
          return { ...state, active: false, available: true };
        }
        return state;
      }
      if (!supported) return { ...state, error: "Picture-in-picture is unavailable in this browser or on this page." };
      const candidates = [...root.querySelectorAll(players)].filter(isPlayer).map(video => {
        const rect = video.getBoundingClientRect(), style = getComputedStyle(video);
        const reel = video.closest('ytd-reel-video-renderer');
        const activeReel = reel?.hasAttribute("is-active") === true;
        const onScreen = rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
        return { video, rect, style, staleReel: Boolean(reel && !activeReel && !onScreen && video.paused),
          score: [Number(activeReel), Number(!video.paused && !video.ended), Number(onScreen), rect.width * rect.height] };
      }).filter(({video,rect,style,staleReel}) => !staleReel && video.isConnected && rect.width > 0 && rect.height > 0 &&
        style.visibility === "visible" && style.display !== "none");
      candidates.sort((a, b) => {
        for (let i = 0; i < a.score.length; i++) if (a.score[i] !== b.score[i]) return b.score[i] - a.score[i];
        return 0;
      });
      const video = candidates[0]?.video;
      if (!video) return { ...state, error: "Open a YouTube video first, then try again." };
      if (video.error || video.readyState < HTMLMediaElement.HAVE_METADATA || !video.videoWidth) {
        return { ...state, error: "Wait for the video picture to load, then try again." };
      }
      if (video.disablePictureInPicture) return { ...state, error: "Picture-in-picture is disabled for this video." };
      state.available = true;
      if (action === "status") return state;
      await video.requestPictureInPicture();
      return { ...state, active: true };
    } catch (error) {
      const messages = {
        NotAllowedError: "Click the video once, then try Picture-in-picture again.",
        InvalidStateError: "Wait for the video picture to load, then try again.",
        NotSupportedError: "Picture-in-picture is unavailable for this video.",
        SecurityError: "Picture-in-picture is blocked on this page."
      };
      return { ...state, active: isPlayer(document.pictureInPictureElement),
        error: messages[error.name] || "Could not change picture-in-picture. Try again." };
    }
  }
  function createController() {
    if (!document.pictureInPictureEnabled || !HTMLVideoElement.prototype.requestPictureInPicture) return null;
    const excluded = '#inline-player, #inline-preview-player, ytd-thumbnail, yt-thumbnail-view-model, ' +
      'ytd-video-preview, ytd-video-preview-portal, ytd-video-preview-loader, .ytdVideoPreviewHost, .ytdVideoPreviewPortalHost';
    const structural = '.html5-video-player, .ytp-chrome-bottom, .ytp-chrome-controls, .ytp-right-controls, .ytp-right-controls-left';
    const owned = 'data-ytc-pip-owned';
    const entries = new Map();
    let disposed = false, frame = 0, language = 'auto';
    const t = text => YTCustomizerI18n.translate(text, language);
    const style = document.createElement('style');
    style.setAttribute(owned, '');
    style.textContent = `
      .html5-video-player .ytc-pip-button {
        display: inline-flex !important; align-items: center; justify-content: center;
        flex-shrink: 0; padding: 0; border: 0; background: transparent; color: #fff;
        vertical-align: top; cursor: pointer;
      }
      .html5-video-player .ytc-pip-button svg {
        width: 24px; height: 24px; flex: none; pointer-events: none;
      }
      .html5-video-player .ytc-pip-button:focus-visible {
        outline: 2px solid #fff; outline-offset: -3px; border-radius: 4px;
      }
      .html5-video-player .ytc-pip-button:disabled { opacity: .5; }
      .html5-video-player .ytc-pip-status {
        position: absolute; left: 16px; bottom: 80px; z-index: 65;
        width: max-content; max-width: calc(100% - 32px); padding: 8px 12px;
        border-radius: 6px; background: rgba(0, 0, 0, .85); color: #fff;
        font: 13px/1.4 Arial, sans-serif; pointer-events: none;
      }
      .html5-video-player .ytc-pip-status[hidden] { display: none !important; }
    `;
    (document.head || document.documentElement).append(style);

    function updateState() {
      const pip = document.pictureInPictureElement;
      for (const [player, entry] of entries) {
        const active = Boolean(pip && player.contains(pip));
        const label = t(active ? 'Exit picture-in-picture' : 'Picture-in-picture');
        if (entry.button.getAttribute('aria-pressed') !== String(active)) entry.button.setAttribute('aria-pressed', String(active));
        if (entry.button.title !== label) {
          entry.button.title = label;
          entry.button.setAttribute('aria-label', label);
          entry.button.setAttribute('data-title-no-tooltip', label);
          entry.button.setAttribute('data-tooltip-title', label);
        }
        if (entry.errorSource) entry.status.textContent = t(entry.errorSource);
      }
    }

    function remove(entry) {
      clearTimeout(entry.timer);
      entry.button.remove();
      entry.status.remove();
    }

    function mount() {
      frame = 0;
      if (disposed) return;
      const current = new Set();
      document.querySelectorAll('.html5-video-player').forEach(player => {
        if (player.closest(excluded)) return;
        const controls = player.querySelector('.ytp-right-controls-left, .ytp-right-controls');
        if (!controls) return;
        // Modern players put CC and settings in an inner capsule. Classic
        // players place the buttons directly in the right-controls strip.
        const host = controls.querySelector('.ytp-right-controls-left') || controls;
        current.add(player);
        let entry = entries.get(player);
        if (!entry) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'ytp-button ytc-pip-button';
          button.setAttribute(owned, '');
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS(svg.namespaceURI, 'path');
          path.setAttribute('fill', 'currentColor');
          path.setAttribute('d', 'M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v12h16V6H4zm8 6h6v4h-6v-4z');
          svg.append(path);
          button.append(svg);
          const status = document.createElement('div');
          status.className = 'ytc-pip-status';
          status.setAttribute(owned, '');
          status.setAttribute('role', 'status');
          status.setAttribute('aria-live', 'polite');
          status.hidden = true;
          entry = { button, status, timer: 0, busy: false };
          entries.set(player, entry);
          button.addEventListener('click', async event => {
            event.stopPropagation();
            if (entry.busy || disposed) return;
            entry.busy = button.disabled = true;
            entry.errorSource = '';
            status.hidden = true;
            try {
              const result = await execute('toggle', player);
              if (!disposed && player.isConnected && result.error) {
                clearTimeout(entry.timer);
                entry.errorSource = result.error;
                status.textContent = t(result.error);
                status.hidden = false;
                entry.timer = setTimeout(() => { status.hidden = true; }, 4500);
              }
            } finally {
              entry.busy = button.disabled = false;
              if (!disposed) updateState();
            }
          });
          for (const type of ['keydown', 'keyup']) button.addEventListener(type, event => {
            if (event.key === ' ' || event.key === 'Enter') event.stopPropagation();
          });
        }
        if (host.firstElementChild !== entry.button) host.prepend(entry.button);
        if (!entry.status.isConnected) player.append(entry.status);
      });
      for (const [player, entry] of entries) if (!current.has(player)) { remove(entry); entries.delete(player); }
      updateState();
    }

    function schedule() {
      if (!disposed && !frame) frame = requestAnimationFrame(mount);
    }

    function handleMutations(records) {
      for (const record of records) {
        if (record.type !== 'childList') continue;
        const nodes = [...record.addedNodes, ...record.removedNodes];
        if (!record.removedNodes.length && nodes.length &&
            nodes.every(node => node instanceof Element && node.hasAttribute(owned))) continue;
        const target = record.target;
        if (target instanceof Element && target.hasAttribute(owned)) continue;
        if ((target instanceof Element && target.matches(structural)) || nodes.some(node =>
            node instanceof Element && (node.matches(structural) || node.querySelector(structural)))) {
          schedule();
          return;
        }
      }
    }

    const events = ['yt-navigate-finish', 'yt-page-data-updated', 'fullscreenchange'];
    for (const type of events) document.addEventListener(type, schedule);
    for (const type of ['enterpictureinpicture', 'leavepictureinpicture']) document.addEventListener(type, updateState, true);
    window.addEventListener('popstate', schedule);
    function onLanguage(changes, area) {
      if (area === 'local' && changes.menuLanguage) {
        language = changes.menuLanguage.newValue || 'auto'; updateState();
      }
    }
    chrome.storage.onChanged.addListener(onLanguage);
    void chrome.storage.local.get({ menuLanguage: 'auto' }).then(value => {
      if (!disposed) { language = value.menuLanguage; updateState(); }
    }).catch(() => {});
    mount();
    return { handleMutations, dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      for (const type of events) document.removeEventListener(type, schedule);
      for (const type of ['enterpictureinpicture', 'leavepictureinpicture']) document.removeEventListener(type, updateState, true);
      window.removeEventListener('popstate', schedule);
      YTCustomizer.removeExtensionListener(chrome.storage.onChanged, onLanguage);
      for (const entry of entries.values()) remove(entry);
      entries.clear();
      style.remove();
    } };
  }
  globalThis.YTCustomizerPictureInPicture = Object.freeze({ execute, createController });
})();
