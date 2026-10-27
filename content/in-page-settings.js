// An avatar-adjacent entry and an isolated, authenticated extension settings dialog.
(() => {
  function createController() {
    if (window !== window.top) return { handleMutations() {}, dispose() {}, ownsFrameUrl: () => false };
    let entry, button, shell, dialog, frame, token = '', secret = '', ready = false, disposed = false, opening = 0, scheduled = 0, loadTimer;
    let language = 'auto', previousFocus, avatarAnchor, closing = false, backdropPointer = false;
    let menuMode = 'light';
    const menuTheme = YTCustomizerMenuTheme.observe(({ mode }) => {
      menuMode = mode; if (dialog) dialog.dataset.menuTheme = mode;
    });
    const extensionOrigin = chrome.runtime.getURL('').replace(/\/$/, '');
    const t = text => YTCustomizerI18n.translate(text, language);
    function localize() {
      const title = t('YouTube Customizer settings');
      if (button) { button.title = title; button.setAttribute('aria-label', title); }
      if (dialog) dialog.setAttribute('aria-label', title);
      if (frame) frame.title = title;
      const loading = shell?.shadowRoot.querySelector('#loading');
      if (loading) loading.textContent = t(loading.dataset.error ? 'Could not open settings. Refresh YouTube and try again.' : 'Loading settings...');
      const close = shell?.shadowRoot.querySelector('#loading-close');
      if (close) { close.title = t('Close'); close.setAttribute('aria-label', t('Close')); }
    }
    function refreshEntry() {
      if (disposed) return;
      const header = document.querySelector('ytd-masthead') || document.querySelector('ytmusic-nav-bar');
      if (!header) return;
      const avatar = header.querySelector('#avatar-btn');
      const anchor = avatar?.closest('ytd-topbar-menu-button-renderer') || avatar || header.querySelector('ytmusic-settings-button');
      avatarAnchor = anchor;
      const parent = anchor?.parentElement || header.querySelector('#end #buttons,#right-content');
      if (!parent) return;
      if (!entry) {
        entry = document.createElement('ytc-settings-entry'); entry.setAttribute('data-ytc-settings-owned', '');
        entry.style.cssText = 'display:inline-flex!important;flex:0 0 40px!important;width:40px!important;height:40px!important;align-self:center!important;margin:0 4px!important;vertical-align:middle!important;';
        const root = entry.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>:host{all:initial}button{display:flex;align-items:center;justify-content:center;width:40px;height:40px;padding:6px;border:0;border-radius:50%;background:transparent;cursor:pointer;color:var(--yt-spec-text-primary,#fff)}button:hover,button[aria-expanded="true"]{background:var(--yt-spec-badge-chip-background,#8883)}button:focus-visible{outline:2px solid var(--yt-spec-call-to-action,#3ea6ff);outline-offset:-2px}img{width:28px;height:28px;object-fit:contain;pointer-events:none}</style><button type="button" aria-haspopup="dialog" aria-expanded="false"><img alt="" aria-hidden="true"></button>`;
        button = root.querySelector('button'); root.querySelector('img').src = chrome.runtime.getURL('icons/icon-32.png');
        button.addEventListener('click', event => { event.stopPropagation(); toggle(); }); localize();
        for (const type of ['keydown', 'keyup']) root.addEventListener(type, event => event.stopPropagation());
      }
      if (anchor) { if (entry.parentNode !== parent || entry.nextElementSibling !== anchor) parent.insertBefore(entry, anchor); }
      else if (entry.parentNode !== parent) parent.append(entry);
    }
    function schedule() {
      if (!scheduled && !disposed) scheduled = requestAnimationFrame(() => { scheduled = 0; refreshEntry(); });
    }
    function buildDialog() {
      shell = document.createElement('ytc-settings-modal'); shell.setAttribute('data-ytc-settings-owned', '');
      const root = shell.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host{all:initial}
        dialog{--menu-glass:rgb(244 247 252 / 86%);--menu-fallback:#f4f7fc;--menu-ink:#263044;--menu-line:#56657f33;--menu-control:#fff;color-scheme:light;position:fixed;inset:0;margin:auto;box-sizing:border-box;width:clamp(480px,84vw,1080px);max-width:calc(100vw - 24px);height:94dvh;max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--menu-line);border-radius:18px;background:var(--menu-glass);color:var(--menu-ink);box-shadow:0 24px 100px #101a3455;-webkit-backdrop-filter:blur(28px);backdrop-filter:blur(28px);overflow:hidden;overscroll-behavior:contain}
        dialog[data-menu-theme="dark"]{--menu-glass:rgb(20 24 33 / 90%);--menu-fallback:#141821;--menu-ink:#e9edf5;--menu-line:#ffffff26;--menu-control:#292f3d;color-scheme:dark}
        dialog::backdrop{background:#17203540}
        iframe{display:block;box-sizing:border-box;border:0;width:100%;height:100%;background:transparent;color-scheme:inherit}
        iframe[data-loading]{visibility:hidden}
        @supports not (backdrop-filter:blur(1px)){dialog{background:var(--menu-fallback)}}
        #loading{position:absolute;inset:40% 24px auto;text-align:center;font:14px/1.5 'Segoe UI',Arial,sans-serif;color:var(--menu-ink)}
        #loading-close{position:absolute;right:12px;top:12px;width:32px;height:32px;border:1px solid var(--menu-line);border-radius:9px;background:var(--menu-control);color:var(--menu-ink);font:22px 'Segoe UI',Arial;cursor:pointer}
        #loading-close:hover{border-color:#dc3657}
        #loading-close:focus-visible{outline:2px solid #ad2042;outline-offset:2px}
        [hidden]{display:none!important}
      </style><dialog aria-label="YouTube Customizer settings"><p id="loading" role="status"></p><button type="button" id="loading-close">×</button></dialog>`;
      dialog = root.querySelector('dialog');
      dialog.dataset.menuTheme = menuMode;
      root.querySelector('#loading-close').addEventListener('click', requestClose);
      dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
      const outside = event => {
        const r = dialog.getBoundingClientRect();
        return event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom);
      };
      dialog.addEventListener('pointerdown', event => { backdropPointer = event.button === 0 && outside(event); });
      dialog.addEventListener('pointercancel', () => { backdropPointer = false; });
      dialog.addEventListener('click', event => {
        const close = backdropPointer && outside(event);
        backdropPointer = false;
        if (close) requestClose();
      });
      dialog.addEventListener('wheel', event => event.preventDefault(), { passive: false });
      mountDialog(); localize();
    }
    function mountDialog() {
      if (!shell) return;
      const parent = document.fullscreenElement || document.body || document.documentElement;
      if (parent.tagName !== 'VIDEO' && shell.parentNode !== parent) parent.append(shell);
    }
    async function open() {
      if (disposed || dialog?.open) return;
      const revision = ++opening; previousFocus = document.activeElement; closing = false; backdropPointer = false;
      await menuTheme.ready; if (disposed || revision !== opening) return;
      if (!dialog) buildDialog(); else mountDialog();
      const root = shell.shadowRoot;
      root.querySelector('#loading').hidden = false; delete root.querySelector('#loading').dataset.error;
      root.querySelector('#loading-close').hidden = false; localize();
      dialog.showModal(); button?.setAttribute('aria-expanded', 'true');
      try {
        const session = await chrome.runtime.sendMessage({ type: 'YT_SETTINGS_EMBED_START' });
        if (disposed || revision !== opening || !dialog.open) {
          if (session?.token) void chrome.runtime.sendMessage({ type: 'YT_SETTINGS_EMBED_END', token: session.token }).catch(() => {});
          return;
        }
        if (!session?.ok) throw Error();
        token = session.token; secret = session.secret; ready = false;
        frame = document.createElement('iframe'); frame.title = t('YouTube Customizer settings');
        frame.setAttribute('data-loading', '');
        frame.setAttribute('allow', 'picture-in-picture'); frame.referrerPolicy = 'no-referrer';
        const url = new URL(chrome.runtime.getURL('popup.html')); url.search = new URLSearchParams({ embedded: '1', token }).toString();
        frame.src = url.href; dialog.prepend(frame);
        loadTimer = setTimeout(() => {
          if (revision !== opening || ready || !dialog.open) return;
          root.querySelector('#loading').dataset.error = '1'; localize();
        }, 10000);
      } catch {
        if (disposed || revision !== opening) return;
        root.querySelector('#loading').dataset.error = '1'; localize();
      }
    }
    function finishClose(restoreFocus = true) {
      opening++; clearTimeout(loadTimer); frame?.remove(); frame = null; ready = false; closing = false; backdropPointer = false;
      if (dialog?.open) dialog.close(); button?.setAttribute('aria-expanded', 'false');
      if (token) void chrome.runtime.sendMessage({ type: 'YT_SETTINGS_EMBED_END', token }).catch(() => {});
      token = ''; secret = '';
      if (restoreFocus) { if (entry?.isConnected) button.focus({ preventScroll: true }); else if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); }
    }
    function requestClose() {
      if (!dialog?.open || closing) return;
      if (!frame || !ready) { finishClose(); return; }
      closing = true;
      frame.contentWindow.postMessage({ type: 'YT_SETTINGS_REQUEST_CLOSE', token }, extensionOrigin);
    }
    function toggle() { if (dialog?.open) requestClose(); else void open(); }
    function onFrameMessage(event) {
      if (!frame || event.source !== frame.contentWindow || event.origin !== extensionOrigin || event.data?.token !== token) return;
      if (event.data.type === 'YT_SETTINGS_HELLO') {
        frame.contentWindow.postMessage({ type: 'YT_SETTINGS_AUTH', token, secret }, extensionOrigin);
      } else if (event.data.type === 'YT_SETTINGS_READY') {
        ready = true; clearTimeout(loadTimer); shell.shadowRoot.querySelector('#loading').hidden = true;
        frame.removeAttribute('data-loading');
        shell.shadowRoot.querySelector('#loading-close').hidden = true; frame.focus();
      } else if (event.data.type === 'YT_SETTINGS_CLOSE') finishClose();
      else if (event.data.type === 'YT_SETTINGS_CLOSE_BLOCKED') closing = false;
    }
    function onMessage(message, sender, reply) {
      if (!['YT_SETTINGS_TOGGLE', 'YT_SETTINGS_STATUS'].includes(message?.type) || sender?.id !== chrome.runtime.id || sender.tab ||
          sender.url && sender.url !== chrome.runtime.getURL('service-worker.js')) return false;
      if (message.type === 'YT_SETTINGS_TOGGLE') toggle();
      reply({ version: YTCustomizer.version, opened: Boolean(dialog?.open) }); return false;
    }
    function onStorage(changes, area) { if (area === 'local' && changes.menuLanguage) { language = changes.menuLanguage.newValue || 'auto'; localize(); } }
    void chrome.storage.local.get({ menuLanguage: 'auto' }).then(value => { if (!disposed) { language = value.menuLanguage; localize(); } }).catch(() => {});
    chrome.storage.onChanged.addListener(onStorage); chrome.runtime.onMessage.addListener(onMessage);
    window.addEventListener('message', onFrameMessage); document.addEventListener('yt-navigate-finish', schedule); window.addEventListener('popstate', schedule); document.addEventListener('fullscreenchange', mountDialog);
    refreshEntry();
    return {
      ownsFrameUrl: url => Boolean(frame && token && url === frame.src && dialog?.open),
      handleMutations(records) {
        if (entry && (!entry.isConnected || avatarAnchor && entry.nextElementSibling !== avatarAnchor && records.some(r => r.type === 'childList' && r.target === entry.parentNode))) { schedule(); return; }
        const selector = 'ytd-masthead,ytmusic-nav-bar,#avatar-btn,ytd-topbar-menu-button-renderer,ytmusic-settings-button,#buttons,#right-content';
        if (records.some(r => r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && !n.hasAttribute('data-ytc-settings-owned') && (n.matches(selector) || n.querySelector(selector))))) schedule();
      },
      dispose() {
        disposed = true; menuTheme.dispose(); cancelAnimationFrame(scheduled); finishClose(false); entry?.remove(); shell?.remove();
        chrome.storage.onChanged.removeListener(onStorage); chrome.runtime.onMessage.removeListener(onMessage); window.removeEventListener('message', onFrameMessage);
        document.removeEventListener('yt-navigate-finish', schedule); window.removeEventListener('popstate', schedule); document.removeEventListener('fullscreenchange', mountDialog);
      }
    };
  }
  globalThis.YTCustomizerInPageSettings = { createController };
})();
