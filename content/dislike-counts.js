// Read-only Return YouTube Dislike estimates; shared validation/cache and page UI.
(() => {
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(value);
  function videoId(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password ||
          !['www.youtube.com', 'youtube.com'].includes(url.hostname)) return '';
      const id = url.pathname === '/watch' ? url.searchParams.get('v') :
        /^\/(?:shorts|live)\/([a-zA-Z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
      return validId(id) ? id : '';
    } catch { return ''; }
  }

  function createService() {
    const key = 'dislikeEstimates', cache = new Map(), pending = new Map();
    let loaded, retryAt = 0;
    const validCount = value => Number.isSafeInteger(value) && value >= 0;
    function persist() {
      const now = Date.now();
      for (const [id, value] of cache) if (value.expires <= now) cache.delete(id);
      while (cache.size > 128) cache.delete(cache.keys().next().value);
      void chrome.storage.session.set({[key]:{items:[...cache],retryAt}}).catch(() => {});
    }
    async function get(id) {
      if (!validId(id)) return {ok:false};
      loaded ||= chrome.storage.session.get(key).then(values => {
        const saved = values[key], now = Date.now();
        retryAt = Number.isFinite(saved?.retryAt) ? Math.min(saved.retryAt, now + 3600000) : 0;
        for (const item of Array.isArray(saved?.items) ? saved.items.slice(-128) : []) {
          if (!Array.isArray(item)) continue;
          const [id, value] = item;
          if (validId(id) && value?.expires > now && value.expires <= now + 1800000 &&
              (value.result?.ok === false || value.result?.ok === true && validCount(value.result.dislikes))) cache.set(id,value);
        }
      }).catch(() => {});
      await loaded;
      const saved = cache.get(id);
      if (saved?.expires > Date.now()) return saved.result;
      if (pending.has(id)) return pending.get(id);
      if (Date.now() < retryAt) return {ok:false};
      const request = (async () => {
        let result = {ok:false}, ttl = 60000;
        const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8000);
        try {
          const response = await fetch('https://returnyoutubedislikeapi.com/votes?videoId=' + id,
            {credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:abort.signal});
          if (response.status === 429) {
            const header = response.headers.get('Retry-After');
            const delay = header && Number.isFinite(Number(header)) ? Number(header)*1000 : Date.parse(header)-Date.now();
            retryAt = Date.now() + Math.min(3600000,Math.max(60000,Number.isFinite(delay) ? delay : 300000));
          } else if (response.ok) {
            const data = await response.json();
            if (data?.id === id && data.deleted !== true && validCount(data.dislikes)) {
              result = {ok:true,dislikes:data.dislikes}; ttl = 1800000;
            }
          }
        } catch { /* Offline, malformed or unavailable estimates leave native controls alone. */ }
        finally { clearTimeout(timer); }
        cache.delete(id); cache.set(id,{result,expires:Date.now()+ttl}); persist();
        return result;
      })();
      pending.set(id,request);
      try { return await request; } finally { pending.delete(id); }
    }
    return Object.freeze({get});
  }

  function createController() {
    if (window !== window.top || !['www.youtube.com','youtube.com'].includes(location.hostname)) {
      return {sync(){},handleMutations(){},dispose(){}};
    }
    const owned = 'data-ytc-dislike-owned', entries = new Map();
    const watchScope = ':is(ytd-watch-metadata,ytd-video-primary-info-renderer)';
    const controls = 'dislike-button-view-model, #dislike-button, #segmented-dislike-button, #dislike-button-renderer';
    const watchButtons = watchScope + ' :is(' + controls + ') button, ' + watchScope +
      ' #top-level-buttons-computed > ytd-toggle-button-renderer:nth-child(2) button';
    const structural = controls + ', ytd-watch-metadata, ytd-video-primary-info-renderer, ' +
      'ytd-reel-video-renderer, ytd-toggle-button-renderer, #top-level-buttons-computed';
    let enabled = false, disposed = false, frame = 0, currentId = '', generation = 0;
    let result = null, language = 'auto';
    const style = document.createElement('style'); style.setAttribute(owned,'');
    style.textContent = 'html body .ytc-dislike-estimate{display:inline-block!important;flex:none;margin-inline-start:6px;' +
      'background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;' +
      'font:inherit;color:inherit!important;white-space:nowrap;font-variant-numeric:tabular-nums}' +
      'html body :is(ytd-watch-metadata,ytd-video-primary-info-renderer) button:has(>.ytc-dislike-estimate){width:auto!important;min-width:max-content!important}' +
      'html body ytd-reel-video-renderer .ytc-dislike-estimate{font-size:12px;margin-inline-start:0}' +
      'html body ytd-reel-video-renderer .ytSpecButtonShapeWithLabelLabel:has(>.ytc-dislike-estimate)>:not(.ytc-dislike-estimate){display:none!important}';

    function remove(button, node) {
      node.remove();
      const description = (button.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== node.id).join(' ');
      if (description) button.setAttribute('aria-describedby',description);
      else button.removeAttribute('aria-describedby');
      entries.delete(button);
    }
    function clear() { for (const [button,node] of entries) remove(button,node); }
    function render() {
      if (!enabled || !result?.ok) { clear(); return; }
      if (!style.isConnected) (document.head || document.documentElement).append(style);
      let buttons;
      if (location.pathname.startsWith('/shorts/')) {
        const active = document.querySelector('ytd-reel-video-renderer[is-active]') ||
          document.getElementById('shorts-player')?.closest('ytd-reel-video-renderer');
        buttons = active && (!active.getAttribute('video-id') || active.getAttribute('video-id') === currentId)
          ? active.querySelectorAll(':is(' + controls + ') button') : [];
      } else buttons = document.querySelectorAll(watchButtons);
      const current = new Set(buttons);
      for (const [button,node] of entries) if (!button.isConnected || !current.has(button)) remove(button,node);
      const locale = YTCustomizerI18n.resolveLanguage(language);
      const label = YTCustomizerI18n.translate('Estimated dislikes',language);
      const count = new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1}).format(result.dislikes);
      const description = label + ': ' + new Intl.NumberFormat(locale).format(result.dislikes) + ' · Return YouTube Dislike';
      for (const button of buttons) {
        let node = entries.get(button);
        // Modern Shorts put the count below a fixed-size circular button.
        // Keep that native label slot instead of squeezing text beside its icon.
        const slot = location.pathname.startsWith('/shorts/') &&
          button.closest('label')?.querySelector(':scope > .ytSpecButtonShapeWithLabelLabel') || button;
        // Respect counts inserted by YouTube or another dislike extension.
        const text = [...slot.childNodes].filter(child => child !== node).map(child => child.textContent).join('');
        if (/\d/.test(text) || button.closest('#return-youtube-dislike-count,.ryd-tooltip') ||
            button.querySelector('#return-youtube-dislike-count,#ryd-dislike-count,.ryd-dislike-count')) {
          if (node) remove(button,node); continue;
        }
        if (!node) {
          node = document.createElement('span'); node.className = 'ytc-dislike-estimate'; node.setAttribute(owned,'');
          node.id = 'ytc-dislike-' + crypto.randomUUID(); entries.set(button,node);
        }
        if (node.textContent !== '≈' + count) node.textContent = '≈' + count;
        if (node.title !== description) { node.title = description; node.setAttribute('aria-label',description); }
        if (node.parentElement !== slot) slot.append(node);
        const ids = (button.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (!ids.includes(node.id)) button.setAttribute('aria-describedby',[...ids,node.id].join(' '));
      }
    }
    function refresh() {
      frame = 0;
      if (disposed) return;
      const id = enabled ? videoId(location.href) : '';
      if (id !== currentId) {
        currentId = id; const token = ++generation; result = null; clear();
        if (id && !document.hidden) {
          void YTCustomizer.sendRuntimeMessage({type:'YT_DISLIKE_ESTIMATE',videoId:id}).then(value => {
            if (!disposed && enabled && token === generation && id === videoId(location.href)) {
              result = value?.ok === true && Number.isSafeInteger(value.dislikes) && value.dislikes >= 0 ? value : {ok:false};
              schedule();
            }
          }).catch(() => {});
        } else if (id) currentId = '';
      }
      render();
    }
    function schedule() { if (enabled && !disposed && !document.hidden && !frame) frame = requestAnimationFrame(refresh); }
    const events = ['yt-navigate-start','yt-navigate-finish','yt-page-data-updated','visibilitychange'];
    for (const event of events) document.addEventListener(event,schedule);
    window.addEventListener('popstate',schedule);
    function onStored(changes, area) {
      if (area === 'local' && changes.menuLanguage) { language = changes.menuLanguage.newValue || 'auto'; schedule(); }
      // A live preview can arrive before the opt-in has finished saving. Retry
      // once after that commit; the worker never fetches for a disabled setting.
      if (area === 'sync' && changes.showDislikeEstimates?.newValue === true && enabled) {
        currentId=''; generation++; result=null; schedule();
      }
    }
    chrome.storage.onChanged.addListener(onStored);
    void chrome.storage.local.get({menuLanguage:'auto'}).then(value => {if (!disposed) {language=value.menuLanguage;schedule();}}).catch(() => {});
    return {
      sync(settings) {
        if (enabled === settings.showDislikeEstimates) return;
        enabled = settings.showDislikeEstimates;
        if (!enabled) { generation++; currentId=''; result=null; cancelAnimationFrame(frame); frame=0; clear(); style.remove(); }
        schedule();
      },
      handleMutations(records) {
        if (!enabled || disposed) return;
        for (const record of records) {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          if (target?.closest('[' + owned + ']')) continue;
          if (record.type === 'attributes') {
            if (['is-active','video-id'].includes(record.attributeName) && target?.localName === 'ytd-reel-video-renderer') {schedule();return;}
          } else if (record.type === 'childList' && (target?.matches(structural) || target?.closest('dislike-button-view-model,#dislike-button,#segmented-dislike-button') ||
              [...record.addedNodes,...record.removedNodes].some(node => node instanceof Element && !node.hasAttribute(owned) &&
                (node.matches(structural) || node.querySelector(structural))))) {schedule();return;}
        }
      },
      dispose() {
        disposed=true; generation++; cancelAnimationFrame(frame); clear(); style.remove();
        for (const event of events) document.removeEventListener(event,schedule);
        window.removeEventListener('popstate',schedule);
        YTCustomizer.removeExtensionListener(chrome.storage.onChanged,onStored);
      }
    };
  }
  globalThis.YTCustomizerDislikes = Object.freeze({videoId,createService,createController});
})();
