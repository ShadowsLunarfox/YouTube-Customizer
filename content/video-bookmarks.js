// Timeline pins with sticky notes; imported by the worker for data validation.
(() => {
  const validId = value => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
  function videoId(value) {
    try {
      const u = new URL(value), id = u.searchParams.get('v');
      return u.protocol === 'https:' && !u.username && !u.password && /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === '/watch' && validId(id) ? id : '';
    } catch { return ''; }
  }
  function normalize(value) {
    const seen = new Set();
    return { schemaVersion: 1, points: (Array.isArray(value?.points) ? value.points : []).filter(p => {
      if (!validId(p?.id) || seen.has(p.id) || typeof p.time !== 'number' || !Number.isFinite(p.time) || p.time < 0 || p.time > 604800 || typeof p.note !== 'string') return false;
      seen.add(p.id); return true;
    }).slice(0, 500).map(p => ({ id: p.id, time: p.time, note: p.note.slice(0, 1000), createdAt: Number.isFinite(p.createdAt) ? p.createdAt : 0 })) };
  }
  function mutate(stored, action, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('Invalid bookmark.');
    const data = normalize(stored);
    if (action === 'delete') {
      if (!validId(payload.id)) throw Error('Invalid bookmark.');
      data.points = data.points.filter(p => p.id !== payload.id);
    } else if (action === 'save') {
      if (typeof payload.time !== 'number' || !Number.isFinite(payload.time) || payload.time < 0 || payload.time > 604800 || typeof payload.note !== 'string' || payload.note.length > 1000) throw Error('Enter a valid timestamp and a note up to 1000 characters.');
      const existing = payload.id ? data.points.find(p => p.id === payload.id) : null;
      if (payload.id && !existing) throw Error('This bookmark no longer exists.');
      if (existing) { existing.time = payload.time; existing.note = payload.note.trim(); }
      else {
        if (data.points.length >= 500) throw Error('This video already has 500 bookmarks.');
        data.points.push({ id: crypto.randomUUID(), time: payload.time, note: payload.note.trim(), createdAt: Date.now() });
      }
    } else throw Error('Invalid bookmark action.');
    return data;
  }
  function format(time) {
    const ticks = Math.round(Math.max(0, Number(time) || 0) * 100), seconds = Math.floor(ticks / 100), hours = Math.floor(seconds / 3600);
    return (hours ? hours + ':' + String(Math.floor(seconds / 60) % 60).padStart(2, '0') : String(Math.floor(seconds / 60))) + ':' + String(seconds % 60).padStart(2, '0') + (ticks % 100 ? '.' + String(ticks % 100).padStart(2, '0') : '');
  }
  function parse(value) {
    if (typeof value !== 'string' || !/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,3})?$/.test(value.trim())) return NaN;
    const parts = value.trim().split(':').map(Number);
    return parts.some((n, i) => !Number.isFinite(n) || i > 0 && n >= 60) ? NaN : parts.reduce((a, b) => a * 60 + b, 0);
  }
  function createController() {
    if (window !== window.top) return { sync() {}, handleMutations() {}, dispose() {} };
    let disposed = false, enabled = false, host, root, markers, markerRoot, player = null, track = null, video = null, id = '', epoch = 0, scheduled = 0;
    let data = normalize(), dataRevision = 0, editing = '', open = false, busy = false, language = 'auto';
    let anchorTime = 0, ad = false;
    const t = text => YTCustomizerI18n.translate(text, language);
    let noticeSource = '';
    const $ = selector => root?.querySelector(selector);
    const isAd = () => Boolean(video?.closest('.ad-showing,.ad-interrupting'));
    const owned = 'data-ytc-bookmarks-owned';
    const key = value => 'videoBookmarks:' + value;
    const sorted = () => [...data.points].sort((a, b) => a.time - b.time || a.createdAt - b.createdAt);
    function notice(text, error = false) {
      noticeSource = text;
      if (!root) return;
      $('#bookmark-status').textContent = t(text); $('#bookmark-status').classList.toggle('error', error);
    }
    function build() {
      host = document.createElement('ytc-video-bookmarks'); host.setAttribute(owned, '');
      host.style.cssText = 'position:absolute!important;display:none!important;z-index:65!important;transform:translateY(-100%)!important;pointer-events:none!important;';
      root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host{all:initial;font:14px/1.45 Roboto,Arial,"Microsoft YaHei",sans-serif;color:#342911}*{box-sizing:border-box}[hidden]{display:none!important}
        button,input,textarea{font:inherit;color:inherit}button{cursor:pointer;border:1px solid #aa8a4577;background:#fff6;border-radius:4px;padding:5px 8px;min-height:30px}button:hover{background:#fff9}button:disabled{opacity:.6;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #805700;outline-offset:1px}
        .panel{pointer-events:auto;padding:10px 12px;background:#fff0ad;border:1px solid #c9a75d;border-radius:5px;box-shadow:0 4px 18px #0007;max-height:var(--note-height,300px);overflow:auto;overscroll-behavior:contain;text-shadow:none}header{display:flex;align-items:center;gap:8px;margin-bottom:8px}header strong{flex:1}#bookmark-close{min-height:26px;padding:0 7px;font-size:20px;line-height:1}
        .time-row{display:flex;align-items:end;gap:8px;flex-wrap:wrap}label{display:grid;gap:4px;font-size:12px}.note-label{margin:8px 0}input,textarea{width:100%;min-width:0;padding:5px 7px;background:#fff8;border:1px solid #aa8a4588;border-radius:3px}#bookmark-time{width:110px;min-height:30px;font-variant-numeric:tabular-nums}textarea{display:block;height:76px;resize:vertical;max-height:180px;min-height:48px;white-space:pre-wrap}.actions{display:flex;gap:6px;flex-wrap:wrap}#bookmark-save{background:#66501e;color:#fff7d8}#bookmark-save:hover{background:#7c6228}#bookmark-status:empty{display:none}#bookmark-status{margin:8px 0 0;font-size:12px;overflow-wrap:anywhere}#bookmark-status.error{color:#9b2424}
        :host([data-compact]) .panel{padding:6px 8px}:host([data-compact]) header{position:absolute;right:8px;top:7px;margin:0}:host([data-compact]) header strong{display:none}:host([data-compact]) #bookmark-close{min-height:24px}:host([data-compact]) .time-row{align-items:center;gap:4px;padding-right:30px}:host([data-compact]) label>span{display:none}:host([data-compact]) #bookmark-time{width:78px;min-height:24px;padding:2px 4px;font-size:12px}:host([data-compact]) button{min-height:24px;padding:3px 5px;font-size:11px}:host([data-compact]) .note-label{margin:5px 0}:host([data-compact]) textarea{height:42px;min-height:36px;font-size:12px;padding:3px 5px}:host([data-compact]) #bookmark-status{font-size:11px;margin-top:4px}
      </style><section id="bookmark-panel" class="panel" role="dialog" aria-label="Timeline note"><header><strong data-text="Timeline note"></strong><button id="bookmark-close" type="button" data-action="close" aria-label="Close">×</button></header><form id="bookmark-form">
      <label><span data-text="Timestamp"></span><input id="bookmark-time" type="text" inputmode="decimal" value="0:00" aria-label="Timestamp"></label><button type="button" data-action="now" data-text="Use current time"></button>
      <label class="note-label"><span data-text="Note (optional)"></span><textarea id="bookmark-note" maxlength="1000" aria-label="Note (optional)"></textarea></label><div class="actions"><button id="bookmark-save" type="submit"></button><button type="button" data-action="seek" data-text="Jump to bookmark"></button><button id="bookmark-delete" type="button" data-action="delete" data-text="Delete" hidden></button></div></form>
      <p id="bookmark-status" role="status" aria-live="polite"></p></section>`;
      const buttonStyle = document.createElement('style');
      buttonStyle.textContent = globalThis.YTCustomizerContent?.buildShadowButtonCss?.() || '';
      root.append(buttonStyle);
      const timeRow = node('div', null, 'time-row');
      timeRow.append($('#bookmark-form > label'), $('[data-action="now"]')); $('#bookmark-form').prepend(timeRow);
      root.addEventListener('click', click);
      $('#bookmark-form').addEventListener('submit', event => { event.preventDefault(); void save(); });
      for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'wheel']) root.addEventListener(type, event => event.stopPropagation());
      root.addEventListener('keydown', event => { if (event.key === 'Escape' && open) { event.preventDefault(); close(true); } event.stopPropagation(); });
      root.addEventListener('keyup', event => event.stopPropagation());
      $('#bookmark-time').addEventListener('input', () => { const time = parse($('#bookmark-time').value); if (Number.isFinite(time)) { anchorTime = time; position(); } });
      localize();
    }
    function localize() {
      if (!root) return;
      host.lang = YTCustomizerI18n.resolveLanguage(language);
      if (markers) markers.lang = host.lang;
      $('#bookmark-status').textContent = t(noticeSource);
      for (const node of root.querySelectorAll('[data-text]')) node.textContent = t(node.dataset.text);
      $('#bookmark-time').setAttribute('aria-label', t('Timestamp')); $('#bookmark-note').setAttribute('aria-label', t('Note (optional)'));
      $('#bookmark-note').placeholder = t('Write a note...');
      $('#bookmark-panel').setAttribute('aria-label', t('Timeline note')); $('#bookmark-close').setAttribute('aria-label', t('Close'));
      $('#bookmark-save').textContent = t(editing ? 'Save changes' : 'Add bookmark');
      render();
    }
    function close(focus = false) {
      open = false; if (host) host.style.setProperty('display', 'none', 'important');
      markerRoot?.querySelector('#bookmark-add')?.setAttribute('aria-expanded', 'false');
      renderMarkers(); if (focus) markerRoot?.querySelector('#bookmark-add')?.focus();
    }
    function position() {
      if (!open || !host || !player || !track) return;
      const p = player.getBoundingClientRect(), bar = track.getBoundingClientRect(), scale = player.clientWidth / p.width || 1;
      const width = Math.max(140, Math.min(320, player.clientWidth - 24));
      const x = (bar.left - p.left + bar.width * Math.max(0, Math.min(1, anchorTime / video.duration || 0))) * scale;
      const top = Math.max(70, (bar.top - p.top) * scale - 18);
      host.toggleAttribute('data-compact', top < 230);
      host.style.width = width + 'px'; host.style.left = Math.max(12, Math.min(x - width / 2, player.clientWidth - width - 12)) + 'px'; host.style.top = top + 'px';
      host.style.setProperty('--note-height', Math.max(58, Math.min(340, top - 12)) + 'px');
    }
    function openNote(time, point) {
      canSeek(); editing = point?.id || ''; anchorTime = time; open = true;
      $('#bookmark-time').value = format(time); $('#bookmark-note').value = point?.note || '';
      $('#bookmark-delete').hidden = !editing; $('#bookmark-save').textContent = t(editing ? 'Save changes' : 'Add bookmark'); notice('');
      host.style.setProperty('display', 'block', 'important'); markerRoot?.querySelector('#bookmark-add')?.setAttribute('aria-expanded', 'true');
      position(); renderMarkers(); $('#bookmark-note').focus({ preventScroll: true });
    }
    function node(tag, text, className) { const element = document.createElement(tag); if (text != null) element.textContent = text; if (className) element.className = className; return element; }
    function render() {
      if (markerRoot) {
        const label = t('Add timeline note');
        const button = markerRoot.querySelector('#bookmark-add'); button.querySelector('span').textContent = label;
        button.title = t('Add a note at the current time'); button.setAttribute('aria-label', button.title);
        const rail = markerRoot.querySelector('#bookmark-rail'); rail.title = t('Click above the timeline to add a note'); rail.setAttribute('aria-label', rail.title);
        const unavailable = !video || video.readyState < 1 || !Number.isFinite(video.duration) || video.duration <= 0 || isAd();
        button.disabled = unavailable; rail.setAttribute('aria-disabled', String(unavailable)); rail.style.pointerEvents = unavailable ? 'none' : '';
      }
      renderMarkers();
    }
    function canSeek() {
      if (!video || video.readyState < 1 || !Number.isFinite(video.duration) || video.duration <= 0) throw Error('Open a loaded video to add or use bookmarks.');
      if (isAd()) throw Error('Bookmarks are unavailable during ads.');
    }
    function checkedTime(value) {
      canSeek(); const time = parse(value);
      if (!Number.isFinite(time) || time < 0 || time > 604800) throw Error('Enter a valid timestamp.');
      if (time > video.duration + .01) throw Error('Timestamp exceeds this video.');
      return Math.min(time, video.duration);
    }
    function seek(point) {
      canSeek();
      if (point.time > video.duration + .01) throw Error('Timestamp exceeds this video.');
      video.currentTime = Math.min(point.time, video.duration);
    }
    async function write(action, payload, target) {
      const result = await YTCustomizer.sendRuntimeMessage({ type: 'YT_VIDEO_BOOKMARK_WRITE', videoId: target, action, payload });
      if (!result?.ok) throw Error(result?.error || 'Could not save bookmark. Try again.');
      if (!disposed && target === id) { dataRevision++; data = normalize(result.data); render(); }
      return result.data;
    }
    async function save() {
      if (busy) return;
      const token = epoch, target = id;
      try {
        const enteredTime = $('#bookmark-time').value, enteredId = editing;
        const time = checkedTime(enteredTime), note = $('#bookmark-note').value;
        busy = true; $('#bookmark-save').disabled = true;
        const saved = await write('save', { id: editing, time, note }, target);
        if (disposed || token !== epoch) return;
        if (editing === enteredId) {
          editing = enteredId || saved.points.at(-1).id;
          $('#bookmark-delete').hidden = false; $('#bookmark-save').textContent = t('Save changes'); renderMarkers();
        }
        notice('Bookmark saved.');
      } catch (error) { if (token === epoch) notice(error.message, true); }
      finally { if (token === epoch && !disposed) { busy = false; $('#bookmark-save').disabled = false; } }
    }
    async function click(event) {
      event.stopPropagation();
      const button = event.target.closest('button'); if (!button) return;
      const action = button.dataset.action;
      try {
        if (action === 'close') close(true);
        else if (action === 'now') { canSeek(); anchorTime = video.currentTime; $('#bookmark-time').value = format(anchorTime); position(); }
        else if (action === 'seek') seek({ time: checkedTime($('#bookmark-time').value) });
        else if (action === 'delete' && editing && !busy) {
          const token = epoch; busy = true; $('#bookmark-save').disabled = true;
          try { await write('delete', { id: editing }, id); if (token === epoch && !disposed) close(true); }
          finally { if (token === epoch && !disposed) { busy = false; $('#bookmark-save').disabled = false; } }
        }
      } catch (error) { notice(error.message, true); }
    }
    function mountMarkers() {
      if (!enabled || !id || !track) { markers?.remove(); host?.remove(); return; }
      if (!markers) {
        markers = document.createElement('ytc-bookmark-markers'); markers.setAttribute(owned, '');
        markers.lang = YTCustomizerI18n.resolveLanguage(language);
        markers.style.cssText = 'position:absolute!important;inset:0!important;display:block!important;pointer-events:none!important;z-index:40!important;';
        markerRoot = markers.attachShadow({ mode: 'open' });
        markerRoot.innerHTML = `<style>:host{all:initial;font:12px/1.3 Roboto,Arial,"Microsoft YaHei",sans-serif}*{box-sizing:border-box}button{font:inherit;cursor:pointer;color:#fff4bf;text-shadow:none}button:focus-visible,#bookmark-rail:focus-visible{outline:2px solid #fff;outline-offset:2px}#bookmark-rail{position:absolute;top:-15px;left:0;right:0;height:14px;pointer-events:auto;cursor:copy;border-bottom:1px dashed #ffdc7666;touch-action:none}#bookmark-rail:hover{background:#ffdc7625;border-color:#ffdc76}#bookmark-add{position:absolute;left:0;bottom:calc(100% + 20px);display:flex;align-items:center;gap:5px;padding:4px 8px;min-height:26px;border:1px solid #ffdc7688;border-radius:4px;background:#201a10dc;pointer-events:auto;white-space:nowrap}#bookmark-add:hover{background:#5d4820}#bookmark-add:disabled{display:none}#bookmark-add b{font-size:18px;line-height:1}.pin{position:absolute;top:-11px;transform:translateX(-50%);width:16px;height:24px;padding:0;border:0;background:transparent;pointer-events:auto;touch-action:none}.pin::before{content:"";display:block;width:11px;height:11px;border:1px solid #694d12;border-radius:2px 4px 2px 2px;background:#ffe493;box-shadow:0 1px 3px #0008}.pin::after{content:"";display:block;width:2px;height:9px;background:#ffe493;margin-left:5px;box-shadow:0 0 1px #241b09}.pin:hover::before,.pin[aria-pressed="true"]::before{background:#fff9df;border-color:#fff}.pin:focus-visible{outline-offset:0}</style><div id="bookmark-rail" role="button" tabindex="0"></div><div id="ticks"></div><button id="bookmark-add" type="button" aria-expanded="false"><b aria-hidden="true">＋</b><span></span></button>`;
        markerRoot.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); });
        markerRoot.addEventListener('mousedown', event => { event.preventDefault(); event.stopPropagation(); });
        for (const type of ['pointerup', 'mouseup', 'dblclick', 'keyup']) markerRoot.addEventListener(type, event => {
          if (type !== 'keyup' || !YTCustomizer.isNativeFullscreenKey(event)) event.stopPropagation();
        });
        markerRoot.addEventListener('keydown', event => {
          if (!YTCustomizer.isNativeFullscreenKey(event)) event.stopPropagation();
          if (event.target.id === 'bookmark-rail' && ['Enter', ' '].includes(event.key)) { event.preventDefault(); try { openNote(video.currentTime); } catch (error) { notice(error.message, true); } }
        });
        const buttonStyle = document.createElement('style');
        buttonStyle.textContent = globalThis.YTCustomizerContent?.buildShadowButtonCss?.() || '';
        markerRoot.append(buttonStyle);
        markerRoot.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          if (busy) return;
          const button = event.target.closest('button'), point = data.points.find(p => p.id === button?.dataset.id);
          try {
            if (point) openNote(point.time, point);
            else if (button?.id === 'bookmark-add') openNote(video.currentTime);
            else if (event.target.id === 'bookmark-rail') {
              const rect = track.getBoundingClientRect(); openNote(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * video.duration);
            }
          } catch (error) { notice(error.message, true); }
        });
      }
      if (markers.parentNode !== track) track.append(markers);
      if (host.parentNode !== player) player.append(host);
      render(); position();
    }
    function renderMarkers() {
      if (!markerRoot) return;
      const ticks = markerRoot.querySelector('#ticks'); ticks.replaceChildren();
      if (!enabled || !video || !Number.isFinite(video.duration) || video.duration <= 0 || isAd()) return;
      for (const point of sorted()) {
        if (point.time > video.duration + .01) continue;
        const button = node('button', null, 'pin'); button.type = 'button'; button.dataset.id = point.id;
        button.setAttribute('data-ytc-bookmark-pin', '');
        button.style.left = `clamp(6px,${Math.min(100, point.time / video.duration * 100)}%,calc(100% - 6px))`;
        button.title = format(point.time) + (point.note ? ' — ' + point.note : ''); button.setAttribute('aria-label', t('Open timeline note') + ' ' + button.title); button.setAttribute('aria-pressed', String(open && editing === point.id)); ticks.append(button);
      }
    }
    async function refresh() {
      if (disposed) return;
      const nextId = videoId(location.href), watch = document.querySelector('ytd-watch-flexy:not([hidden])');
      const nextVideo = nextId ? (watch || document).querySelector('#movie_player video:not(#ytc-background-video)') : null;
      if (nextId !== id || nextVideo !== video) {
        id = nextId; video = nextVideo; data = normalize(); editing = ''; busy = false; const token = ++epoch, revision = ++dataRevision;
        close(); if (root) { $('#bookmark-note').value = ''; $('#bookmark-save').disabled = false; notice(''); render(); }
        if (id) {
          const stored = await chrome.storage.local.get(key(id)); if (disposed || token !== epoch) return;
          if (revision === dataRevision) data = normalize(stored[key(id)]);
          render();
        }
      }
      const nextPlayer = video?.closest('#movie_player,.html5-video-player'), nextTrack = nextPlayer?.querySelector('.ytp-progress-bar-container,.ytp-progress-bar');
      if (player !== nextPlayer || track !== nextTrack) { resize.disconnect(); player = nextPlayer; track = nextTrack; if (player) resize.observe(player); if (track) resize.observe(track); }
      ad = isAd();
      if (enabled && id && video && track && !player.closest('[hidden],[aria-hidden="true"]')) {
        if (!host) build();
        mountMarkers();
      } else { close(); host?.remove(); markers?.remove(); }
    }
    function schedule() { if (!disposed && !scheduled) scheduled = requestAnimationFrame(() => { scheduled = 0; void refresh().catch(() => notice('Could not load bookmarks. Try again.', true)); }); }
    function media(event) {
      if (event.target === video) { if (enabled && host) mountMarkers(); return; }
      if (event.target?.tagName === 'VIDEO' && event.target.closest('#movie_player') && event.target.id !== 'ytc-background-video') schedule();
    }
    const resize = new ResizeObserver(position);
    function outside(event) { if (open && !event.composedPath().includes(host) && !event.composedPath().includes(markers)) close(); }
    document.addEventListener('pointerdown', outside, true);
    function storage(changes, area) {
      if (area !== 'local') return;
      if (changes.menuLanguage) { language = changes.menuLanguage.newValue || 'auto'; localize(); }
      if (id && changes[key(id)]) { dataRevision++; data = normalize(changes[key(id)].newValue); render(); }
    }
    document.addEventListener('yt-navigate-finish', schedule); window.addEventListener('popstate', schedule);
    for (const type of ['loadedmetadata', 'durationchange', 'emptied']) document.addEventListener(type, media, true);
    chrome.storage.onChanged.addListener(storage);
    void chrome.storage.local.get({ menuLanguage: 'auto' }).then(v => { if (!disposed) { language = v.menuLanguage; localize(); } }).catch(() => {});
    return {
      sync(settings) {
        const next = settings.showVideoBookmarks === true;
        if (next !== enabled) { enabled = next; schedule(); }
      },
      handleMutations(records) {
        if (enabled && id && records.some(r => r.type === 'childList' && [...r.removedNodes].some(n => n === host || n === markers))) { schedule(); return; }
        if (enabled && records.some(r => r.type === 'attributes' && r.target === player && r.attributeName === 'class') && ad !== isAd()) { ad = isAd(); if (ad) close(); render(); }
        const selector = 'ytd-watch-flexy,#movie_player,video,.ytp-progress-bar-container,.ytp-progress-bar';
        if (records.some(r => r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 && !n.hasAttribute(owned) && (n.matches(selector) || n.querySelector(selector))))) schedule();
      },
      dispose() {
        disposed = true; epoch++; cancelAnimationFrame(scheduled); resize.disconnect(); host?.remove(); markers?.remove();
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('yt-navigate-finish', schedule); window.removeEventListener('popstate', schedule);
        for (const type of ['loadedmetadata', 'durationchange', 'emptied']) document.removeEventListener(type, media, true);
        YTCustomizer.removeExtensionListener(chrome.storage.onChanged, storage);
      }
    };
  }
  globalThis.YTCustomizerVideoBookmarks = { videoId, normalize, mutate, format, parse, createController };
})();
