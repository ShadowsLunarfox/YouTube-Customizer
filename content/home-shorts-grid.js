// Home Shorts layout: mark shelf structure once, then let CSS handle columns/resizing.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.homeShortsGridVersion === YTCustomizer.version) return;

  const HOME = 'ytd-browse[page-subtype="home"]';
  const SHELVES = 'grid-shelf-view-model, ytd-rich-shelf-renderer[is-shorts]';
  const LOCKUPS = 'ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model';
  const GRID = 'data-ytc-home-shorts-grid';
  const ROW = 'data-ytc-home-shorts-row';
  const CARD = 'data-ytc-home-shorts-card';
  const LOCKUP = 'data-ytc-home-shorts-lockup';
  const SPAN = 'data-ytc-home-shorts-span';
  const SHELF = 'data-ytc-home-shorts-shelf';
  const POSITION = 'data-ytc-home-shorts-position';
  const COLLAPSED = 'data-ytc-home-shorts-collapsed';
  const NATIVE_FOOTER = 'data-ytc-home-shorts-native-footer';
  const TOGGLE = 'data-ytc-home-shorts-toggle';
  const TOTAL = 'data-ytc-home-shorts-total';
  const MORE = 'data-ytc-home-shorts-native-more';
  const FOOTERS = '.ytGridShelfViewModelGridShelfBottomButtonContainer, .button-container';

  runtime.buildHomeShortsGridCss = settings => {
    const limitCss = columns => {
      const excess = [...Array.from({ length: 6 - columns }, (_, index) => String(columns + index + 1)), 'extra'];
      return `${excess.map(position => `[${COLLAPSED}="1"] [${POSITION}="${position}"]`).join(',')} {
        display: none !important;
      }
      ${excess.map(total => `[${TOGGLE}="1"][${TOTAL}="${total}"]`).join(',')} {
        display: block !important;
      }`;
    };
    return `
    [${GRID}="1"]:not([hidden], .ytGridShelfViewModelHostIsDismissed) {
      display: grid !important;
      grid-template-columns: repeat(var(--ytc-grid-columns, 4), minmax(0, 1fr)) !important;
      gap: 16px !important;
    }
    [${ROW}="1"]:not([hidden]) { display: contents !important; }
    [${SPAN}="1"] { grid-column: 1 / -1 !important; }
    [${SHELF}="1"], [${CARD}="1"], [${LOCKUP}="1"] {
      box-sizing: border-box !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
    }
    [${CARD}="1"] { margin-inline: 0 !important; }
    [${NATIVE_FOOTER}="1"] { display: none !important; }
    [${TOGGLE}="1"] {
      display: none !important;
      grid-column: 1 / -1;
      justify-self: center;
      box-sizing: border-box;
      width: min(100%, 360px);
      min-height: 36px;
      margin: 12px auto 0;
      border: 1px solid rgba(128, 128, 128, .35);
      border-radius: 999px;
      background: var(--ytc-universal-glass, rgba(128, 128, 128, .2));
      color: var(--yt-spec-text-primary, #fff);
      font: inherit;
      cursor: pointer;
    }
    [${TOGGLE}="1"][aria-expanded="true"], [${TOGGLE}="1"][${MORE}="1"] {
      display: block !important;
    }
    ${limitCss(settings.videosPerRow)}
    @media (max-width: 1023px) { ${limitCss(Math.min(settings.videosPerRow, 3))} }
    @media (max-width: 799px) { ${limitCss(Math.min(settings.videosPerRow, 2))} }
    @media (max-width: 479px) { ${limitCss(1)} }
  `;
  };

  function createHomeShortsGridController() {
    let home = null;
    let enabled = false;
    let disposed = false;
    let timer = 0;
    let columns = 0;
    let expanded = new WeakSet();
    const dirty = new Set();
    const marked = new Map();
    const controls = new Map();
    const isShelf = element => element.localName === 'grid-shelf-view-model' ||
      element.localName === 'ytd-rich-shelf-renderer' && element.hasAttribute('is-shorts');
    const isRow = element => element.classList.contains('ytGridShelfViewModelGridShelfRow');
    const isPlayer = element => element.localName === 'video' ||
      element.classList.contains('html5-video-player') ||
      ['inline-player', 'inline-preview-player', 'movie_player'].includes(element.id);

    function nearestShelf(element) {
      for (let parent = element; parent && parent !== home; parent = parent.parentElement) {
        if (isShelf(parent)) return parent;
      }
      return null;
    }

    function restore(element, attribute, original) {
      // Leave a subsequent page-owned change intact.
      if (element.getAttribute(attribute) !== original.applied) return;
      if (original.value === null) element.removeAttribute(attribute);
      else element.setAttribute(attribute, original.value);
    }

    function updateMarkers(shelf, next) {
      const previous = marked.get(shelf) || new Map();
      for (const [element, attributes] of previous) {
        for (const [attribute, original] of attributes) {
          if (!next.get(element)?.has(attribute)) {
            restore(element, attribute, original);
            attributes.delete(attribute);
          }
        }
        if (!attributes.size) previous.delete(element);
      }
      for (const [element, attributes] of next) {
        const originals = previous.get(element) || new Map();
        for (const [attribute, value] of attributes) {
          const current = element.getAttribute(attribute);
          const original = originals.get(attribute);
          if (!original || current !== original.applied) {
            originals.set(attribute, { value: current, applied: value });
          }
          if (current !== value) element.setAttribute(attribute, value);
          originals.get(attribute).applied = value;
        }
        previous.set(element, originals);
      }
      if (previous.size) marked.set(shelf, previous);
      else marked.delete(shelf);
    }

    function removeControl(shelf) {
      controls.get(shelf)?.button.remove();
      controls.delete(shelf);
    }

    function updateControl(shelf, cards, mark) {
      let state = controls.get(shelf);
      if (!state) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute(TOGGLE, '1');
        state = { button, nativeButton: null, primedButton: null };
        controls.set(shelf, state);
      }
      const footer = [...shelf.querySelectorAll(FOOTERS)].find(element => nearestShelf(element) === shelf);
      state.nativeButton = footer?.querySelector('button, yt-button-shape, [role="button"]') || null;
      if (footer && state.nativeButton) mark(footer, NATIVE_FOOTER);
      const available = state.nativeButton ? cards.length : cards.filter(card => !card.closest('[hidden]')).length;
      const total = available > 6 ? 'extra' : String(available);
      if (state.button.getAttribute(TOTAL) !== total) state.button.setAttribute(TOTAL, total);
      if (state.nativeButton) {
        if (state.button.getAttribute(MORE) !== '1') state.button.setAttribute(MORE, '1');
      } else if (state.button.hasAttribute(MORE)) state.button.removeAttribute(MORE);
      const open = expanded.has(shelf);
      if (state.button.getAttribute('aria-expanded') !== String(open)) state.button.setAttribute('aria-expanded', String(open));
      const chinese = document.documentElement.lang.toLowerCase().startsWith('zh');
      const label = open ? (chinese ? '显示更少' : 'Show less') : (chinese ? '显示更多' : 'Show more');
      if (state.button.textContent !== label) state.button.textContent = label;
      const parent = shelf.localName === 'ytd-rich-shelf-renderer'
        ? shelf.querySelector(':scope > #dismissible') || shelf : shelf;
      if (state.button.parentElement !== parent) parent.append(state.button);
      mark(state.button, SPAN);
    }

    function onToggle(event) {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest(`[${TOGGLE}="1"]`);
      if (!button) return;
      const shelf = nearestShelf(button);
      const state = controls.get(shelf);
      if (!state || state.button !== button) return;
      if (expanded.has(shelf)) expanded.delete(shelf);
      else {
        expanded.add(shelf);
        // Let YouTube load/unhide its own additional cards, once per native control.
        const native = state.nativeButton;
        if (native && state.primedButton !== native) {
          state.primedButton = native;
          const alreadyOpen = native.getAttribute('aria-expanded') === 'true' ||
            shelf.hasAttribute('is-expanded') || /show less|显示更少|顯示更少/i.test(native.textContent);
          if (!alreadyOpen) native.click();
        }
      }
      reconcile(shelf);
    }

    function reconcile(shelf) {
      const next = new Map();
      const orderedCards = new Set();
      const mark = (element, attribute, value = '1') => {
        const attributes = next.get(element) || new Map();
        attributes.set(attribute, value);
        next.set(element, attributes);
      };
      if (home?.contains(shelf)) {
        if (shelf.localName === 'ytd-rich-shelf-renderer' && shelf.hasAttribute('is-shorts')) {
          const contents = shelf.querySelector(':scope > #dismissible > #contents-container > #contents');
          const cards = contents && [...contents.children].filter(el => el.localName === 'ytd-rich-item-renderer');
          if (cards?.some(card => card.querySelector('ytd-rich-grid-slim-media'))) {
            mark(contents, GRID);
            for (const card of cards) {
              orderedCards.add(card);
              mark(card, CARD);
              card.querySelectorAll('ytd-rich-grid-slim-media').forEach(el => mark(el, LOCKUP));
            }
            for (const child of contents.children) if (!cards.includes(child)) mark(child, SPAN);
          }
        } else if (shelf.localName === 'grid-shelf-view-model') {
          const containers = new Set();
          const cards = new Set();
          for (const lockup of shelf.querySelectorAll(LOCKUPS)) {
            if (nearestShelf(lockup) !== shelf) continue;
            const card = lockup.closest('.ytGridShelfViewModelGridShelfItem') ||
              lockup.closest('ytm-shorts-lockup-view-model-v2') || lockup;
            if (!shelf.contains(card)) continue;
            cards.add(card);
            orderedCards.add(card);
            mark(card, CARD);
            mark(lockup, LOCKUP);
            const parent = card.parentElement;
            containers.add(isRow(parent) ? parent.parentElement : parent);
          }
          for (const container of containers) {
            mark(container, GRID);
            for (const child of container.children) {
              if (isRow(child)) mark(child, ROW);
              else if (!cards.has(child)) mark(child, SPAN);
            }
          }
          if (containers.size) mark(shelf, SHELF);
        }
      }
      if (orderedCards.size) {
        let position = 0;
        for (const card of orderedCards) {
          position++;
          mark(card, POSITION, position > 6 ? 'extra' : String(position));
        }
        if (!expanded.has(shelf)) mark(shelf, COLLAPSED);
        updateControl(shelf, [...orderedCards], mark);
      } else removeControl(shelf);
      updateMarkers(shelf, next);
    }

    function flush() {
      timer = 0;
      if (!home?.isConnected) { refresh(); return; }
      for (const shelf of dirty) reconcile(shelf);
      dirty.clear();
    }

    function schedule() {
      if (dirty.size && !timer) timer = setTimeout(flush, 0);
    }

    function inspect(node) {
      if (!(node instanceof HTMLElement) || isPlayer(node)) return;
      if (isShelf(node)) dirty.add(node);
      // Discovery is limited to newly inserted/removed subtrees, never the full feed.
      if (node.childElementCount) node.querySelectorAll(SHELVES).forEach(shelf => dirty.add(shelf));
    }

    const observer = new MutationObserver(records => {
      for (const record of records) {
        const elements = [...record.addedNodes, ...record.removedNodes].filter(node =>
          node instanceof HTMLElement && !isPlayer(node));
        if (!elements.length) continue;
        let inPlayer = false;
        for (let parent = record.target; parent instanceof HTMLElement && parent !== home;
            parent = parent.parentElement) {
          if (isPlayer(parent)) { inPlayer = true; break; }
        }
        if (inPlayer) continue;
        const shelf = nearestShelf(record.target);
        if (shelf) dirty.add(shelf);
        elements.forEach(inspect);
      }
      schedule();
    });

    function detach() {
      observer.disconnect();
      home?.removeEventListener('click', onToggle, true);
      clearTimeout(timer);
      timer = 0;
      dirty.clear();
      for (const shelf of [...marked.keys()]) updateMarkers(shelf, new Map());
      for (const shelf of [...controls.keys()]) removeControl(shelf);
      home = null;
    }

    function refresh() {
      const active = !disposed && enabled && window === window.top && location.pathname === '/';
      const next = active ? document.querySelector(HOME + ':not([hidden])') : null;
      if (next === home && home?.isConnected) return;
      detach();
      if (!next) return;
      home = next;
      home.querySelectorAll(SHELVES).forEach(reconcile);
      home.addEventListener('click', onToggle, true);
      // Observe structural edits only; never class/style/hidden attribute updates.
      observer.observe(home, { childList: true, subtree: true });
    }

    function sync(settings) {
      const changedColumns = columns !== settings.videosPerRow;
      columns = settings.videosPerRow;
      if (changedColumns) expanded = new WeakSet();
      enabled = !settings.hideShorts;
      const previousHome = home;
      refresh();
      if (changedColumns && home && home === previousHome) [...marked.keys()].forEach(reconcile);
    }

    function handleMutations(records) {
      if (disposed || !enabled) return;
      if (location.pathname !== '/') { if (home) detach(); return; }
      if (home?.isConnected) return;
      // Bootstrap a Home renderer that mounts after initial settings/navigation.
      if (records.some(record => record.type === 'childList')) refresh();
    }

    return Object.freeze({ sync, refresh, handleMutations, dispose() { disposed = true; detach(); } });
  }

  runtime.createHomeShortsGridController = createHomeShortsGridController;
  runtime.homeShortsGridVersion = YTCustomizer.version;
})();
