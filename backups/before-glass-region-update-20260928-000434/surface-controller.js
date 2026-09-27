// Applies and restores translucent surfaces while suppressing YouTube ambient lighting over custom wallpapers.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.surfaceVersion === YTCustomizer.version) return;

  const AMBIENT_BLOCKED_ATTR = "data-ytc-ambient-blocked";
  const UNIVERSAL_GLASS_ATTR = "data-ytc-universal-glass";
  const UNIVERSAL_GLASS_CLEAR_ATTR = "data-ytc-universal-clear";
  const GLASS_BACKDROP = "var(--ytc-ui-backdrop)";
  // An iframe cannot sample the parent document's wallpaper; frost its outer frame as well.
  const FRAME_BACKDROP_SELECTOR = "ytd-live-chat-frame";
  const SEARCH_SUGGESTION_SELECTOR = ".ytSearchboxComponentSuggestionsContainer, ytd-searchbox #suggestions";
  const NAVIGATION_BACKDROP_SELECTOR = [
    "ytd-app #frosted-glass", "ytd-app #masthead-container", "ytd-masthead #background",
    "ytd-feed-filter-chip-bar-renderer", "ytd-feed-filter-chip-bar-renderer #chips-wrapper"
  ].join(",");
  // Current Save-to menus paint their background on the contextual layout inside the sheet.
  // Keep a single tinted panel, including when YouTube nests multiple dialog components.
  const DIALOG_SURFACE_SELECTORS = [
    "tp-yt-paper-dialog", "[role='dialog']", "yt-dialog-view-model", "yt-sheet-view-model",
    ".ytDialogViewModelHost", ".ytSheetViewModelHost", ".ytContextualSheetLayoutHost",
    ".ytSpecDialogLayoutHost", ".ytSpecBottomSheetLayoutContainer", "ytd-add-to-playlist-renderer"
  ];
  const DIALOG_SURFACE_SELECTOR = DIALOG_SURFACE_SELECTORS.join(",");
  const DIALOG_CONTENT_SELECTOR = `:is(${DIALOG_SURFACE_SELECTOR}) :is(
    .ytContextualSheetLayoutHeaderContainer, .ytContextualSheetLayoutContentContainer,
    .ytContextualSheetLayoutFooterContainer, .ytSpecDialogLayoutContainer,
    .ytSpecDialogLayoutContent, .ytSpecDialogLayoutContentInner, .ytSpecDialogLayoutFooterContainer,
    .ytSpecBottomSheetLayoutHeaderWrapper, .ytSpecBottomSheetLayoutContentWrapper,
    .ytSpecBottomSheetLayoutFooterWrapper, yt-list-view-model, .ytListViewModelHost)`;
  const BACKDROP_RESET_SELECTOR = NAVIGATION_BACKDROP_SELECTOR + "," + DIALOG_SURFACE_SELECTOR;
  const UNIVERSAL_GLASS_TARGET_SELECTORS = [
    "ytd-masthead", "ytd-masthead #background", "ytd-masthead #masthead-container",
    "ytd-mini-guide-renderer", "ytd-guide-renderer", "ytd-guide-renderer #guide",
    "ytd-guide-renderer #guide-inner-content", "ytd-mini-guide-renderer #guide-content",
    "ytd-feed-filter-chip-bar-renderer", "ytd-feed-filter-chip-bar-renderer #chips-wrapper",
    "yt-chip-cloud-renderer", "ytd-guide-entry-renderer", "ytd-mini-guide-entry-renderer",
    "yt-chip-cloud-chip-renderer", "yt-chip-cloud-chip-renderer #chip-container",
    ".ytChipShapeChip", ".ytSpecTouchFeedbackShapeFill", ".ytSpecButtonShapeNextHost",
    "ytd-rich-item-renderer", "ytd-rich-section-renderer", "ytd-rich-shelf-renderer", "ytd-watch-metadata #description",
    "ytd-video-renderer", "ytd-compact-video-renderer", "yt-lockup-view-model",
    "ytd-feed-nudge-renderer #content-wrapper",
    "ytd-comments", "ytd-watch-next-secondary-results-renderer", "ytd-playlist-panel-renderer",
    "ytd-playlist-sidebar-renderer", "ytd-live-chat-frame", "yt-live-chat-renderer",
    "ytd-menu-popup-renderer", "ytd-multi-page-menu-renderer", ...DIALOG_SURFACE_SELECTORS,
    "ytd-voice-search-dialog-renderer", "ytd-voice-search-dialog-renderer #voice-search-dialog",
    "ytd-tabbed-page-header", "ytd-c4-tabbed-header-renderer", "ytd-playlist-header-renderer",
    "yt-page-header-renderer", "yt-page-header-view-model",
    ".ytp-popup", ".ytp-tooltip-text", "tp-yt-paper-tooltip #tooltip",
    "tp-yt-app-drawer #contentContainer", "ytd-engagement-panel-section-list-renderer #content",
    "ytd-masthead #search", "ytd-masthead #center", "ytd-masthead #container", "yt-searchbox",
    ".ytSearchboxComponentInputContainer", ".ytSearchboxComponentInputBox",
    ".ytSearchboxComponentSearchButton", ".ytSearchboxComponentSuggestionsContainer",
    "ytd-searchbox #suggestions"
  ];
  const UNIVERSAL_GLASS_TARGET_SELECTOR = UNIVERSAL_GLASS_TARGET_SELECTORS.join(",");
  const UNIVERSAL_GLASS_CLEAR_SELECTORS = [
    "ytd-app #guide-content", "ytd-app.with-chipbar", "ytd-app #masthead-container", "ytd-app #frosted-glass",
    "ytd-masthead #center", "ytd-masthead #container", "ytd-masthead #background",
    "ytd-masthead #masthead-container", "ytd-masthead #search", "ytd-masthead yt-searchbox",
    "ytd-guide-renderer #guide", "ytd-guide-renderer #guide-inner-content", "ytd-guide-renderer #sections",
    "ytd-guide-renderer #footer", "ytd-mini-guide-renderer #guide-content", "ytd-mini-guide-renderer #items",
    "ytd-feed-filter-chip-bar-renderer:has(#chips-wrapper)", "ytd-feed-filter-chip-bar-renderer yt-chip-cloud-renderer",
    "yt-chip-cloud-chip-renderer #chip-container", "yt-chip-cloud-chip-renderer .ytChipShapeChip",
    "ytd-rich-item-renderer yt-lockup-view-model",
    ".ytSpecTouchFeedbackShapeFill", ".ytSearchboxComponentInputBox", "ytd-rich-section-renderer",
    "tp-yt-app-drawer #contentContainer", "ytd-live-chat-frame", "ytd-live-chat-frame #chat",
    "ytd-live-chat-frame iframe", "yt-live-chat-app", "yt-live-chat-app > #contents",
    "yt-live-chat-renderer #contents", "yt-live-chat-renderer #chat-messages", "yt-live-chat-renderer #chat",
    "yt-live-chat-renderer #panel-pages", "yt-live-chat-item-list-renderer", "yt-live-chat-item-list-renderer #item-scroller",
    "yt-live-chat-item-list-renderer #items", "yt-live-chat-header-renderer", "yt-live-chat-banner-manager",
    "yt-live-chat-message-input-renderer", "yt-live-chat-message-input-renderer #input-panel",
    "yt-live-chat-message-input-renderer #input", "ytd-tabbed-page-header #page-header-container",
    "ytd-tabbed-page-header #page-header", "ytd-tabbed-page-header #tabs-container",
    "ytd-tabbed-page-header #tabs-inner-container", "ytd-c4-tabbed-header-renderer #channel-header",
    "yt-page-header-renderer yt-page-header-view-model",
    "yt-page-header-renderer .ytPageHeaderViewModelBackground",
    "yt-page-header-view-model .ytPageHeaderViewModelBackground",
    "ytd-c4-tabbed-header-renderer #tabs-container", "ytd-playlist-panel-renderer #header",
    "ytd-playlist-panel-renderer .header", "ytd-playlist-panel-renderer #items",
    "ytd-playlist-panel-renderer #contents", "ytd-playlist-panel-renderer .playlist-items",
    "ytd-playlist-sidebar-renderer ytd-playlist-sidebar-primary-info-renderer",
    "ytd-playlist-sidebar-renderer ytd-playlist-sidebar-secondary-info-renderer",
    "ytd-playlist-sidebar-renderer #primary", "ytd-playlist-sidebar-renderer #secondary",
    "ytd-watch-flexy .box.ytd-watch-flexy",
    "ytd-comments #contents", "ytd-comments #header", "ytd-comments ytd-comments-header-renderer",
    "ytd-comments ytd-comment-thread-renderer", "ytd-comments ytd-comment-renderer",
    "ytd-comments ytd-comment-view-model", "ytd-comments ytd-comment-simplebox-renderer",
    "ytd-comments ytd-comment-thread-renderer #body",
    "ytd-watch-next-secondary-results-renderer #items", "ytd-watch-next-secondary-results-renderer #contents",
    "ytd-watch-next-secondary-results-renderer :is(ytd-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, ytd-rich-item-renderer, ytd-rich-shelf-renderer)",
    "ytd-watch-next-secondary-results-renderer yt-lockup-metadata-view-model",
    "ytd-watch-metadata #description #description",
    "ytd-watch-metadata #description .fill", "ytd-searchbox #suggestions-inner-container",
    "ytd-searchbox #suggestions #results",
    "ytd-add-to-playlist-renderer #playlists", "ytd-playlist-add-to-option-renderer",
    `:is(${DIALOG_SURFACE_SELECTOR}) :is(${DIALOG_SURFACE_SELECTOR})`, DIALOG_CONTENT_SELECTOR
  ];
  const UNIVERSAL_GLASS_CLEAR_SELECTOR = UNIVERSAL_GLASS_CLEAR_SELECTORS.join(",");
  const NAVIGATION_SURFACE_SELECTORS = [
    "ytd-app #frosted-glass", "ytd-app #masthead-container", "ytd-masthead #background",
    "ytd-feed-filter-chip-bar-renderer", "ytd-feed-filter-chip-bar-renderer #chips-wrapper",
    "ytd-feed-filter-chip-bar-renderer yt-chip-cloud-renderer",
    "ytd-masthead", "ytd-masthead #masthead-container", "ytd-masthead #search",
    "ytd-masthead #center", "ytd-masthead #container", "yt-searchbox", ".ytSearchboxComponentInputContainer",
    ".ytSearchboxComponentInputBox", ".ytSearchboxComponentSearchButton",
    ".ytSearchboxComponentSuggestionsContainer"
  ];
  const NAVIGATION_SURFACE_SELECTOR = NAVIGATION_SURFACE_SELECTORS.join(",");
  const HOMEPAGE_SCOPE_SELECTOR = 'ytd-browse[page-subtype="home"]';
  const LIVE_CHAT_SHADOW_STYLE_ATTR = "data-ytc-live-chat-surface";
  const LIVE_CHAT_SHADOW_CSS = `
    :host-context(html[data-ytc-theme]) :is(#contents, #chat-messages, #item-scroller, #items, #panel-pages, #header,
    #input-panel, #input, #action-panel, yt-live-chat-header-renderer,
    yt-live-chat-message-input-renderer, yt-live-chat-item-list-renderer,
    yt-live-chat-banner-manager) {
      background: transparent !important;
      background-image: none !important;
      backdrop-filter: none !important;
    }
    :host(yt-live-chat-app):host-context(html[data-ytc-theme]) #contents {
      background: var(--ytc-universal-glass) !important;
      background-image: none !important;
      -webkit-backdrop-filter: ${GLASS_BACKDROP} !important;
      backdrop-filter: ${GLASS_BACKDROP} !important;
    }
  `;

  function createSurfaceController() {
    let disposed = false;
    let ambientTimer = 0;
    let glassTimer = 0;
    let chatTimer = 0;
    let homepageTimer = 0;
    const glassStyles = new Map();
    const homepageStyles = new Map();

    const customBackgroundEnabled = () => !disposed &&
      document.documentElement.hasAttribute("data-ytc-custom-background");
    const glassEnabled = () => !disposed && document.documentElement.hasAttribute("data-ytc-theme");

    function forceStyle(store, element, property, value) {
      const styles = store.get(element) || new Map();
      const current = element.style.getPropertyValue(property);
      const priority = element.style.getPropertyPriority(property);
      const original = styles.get(property);
      const ownsCurrent = original && current === original.applied && priority === "important";
      if (ownsCurrent && original.requested === value) return;
      styles.set(property, { value: ownsCurrent ? original.value : current,
        priority: ownsCurrent ? original.priority : priority, applied: value, requested: value });
      element.style.setProperty(property, value, "important");
      styles.get(property).applied = element.style.getPropertyValue(property);
      store.set(element, styles);
    }

    function restoreElement(store, element) {
      const styles = store.get(element);
      if (!styles) return;
      for (const [property, original] of styles) {
        if (element.style.getPropertyValue(property) !== original.applied ||
            element.style.getPropertyPriority(property) !== "important") continue;
        if (original.value) element.style.setProperty(property, original.value, original.priority);
        else element.style.removeProperty(property);
      }
      store.delete(element);
    }

    function restoreStore(store, attributes = []) {
      for (const [element] of store) {
        restoreElement(store, element);
        attributes.forEach(attribute => element.removeAttribute(attribute));
      }
    }

    function reconcile(store, active, attributes = []) {
      for (const [element] of store) {
        if (!element.isConnected || !active.has(element)) {
          restoreElement(store, element);
          attributes.forEach(attribute => element.removeAttribute(attribute));
        }
      }
    }

    function searchSuggestionsVisible(masthead) {
      return [...masthead.querySelectorAll(SEARCH_SUGGESTION_SELECTOR)].some(element => {
        const style = getComputedStyle(element);
        const bounds = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 &&
          bounds.width > 0 && bounds.height > 0;
      });
    }

    function surfaceBackdrop(element, color) {
      if (element.matches(FRAME_BACKDROP_SELECTOR)) return GLASS_BACKDROP;
      // Let an open autocomplete panel sample the page behind the header instead of the header's backdrop root.
      if (element.matches("ytd-masthead") && searchSuggestionsVisible(element)) return "none";
      return color !== "transparent" ? GLASS_BACKDROP : "none";
    }

    // Background shorthand is intentional: YouTube frequently restores black with `background`,
    // so override that single declaration without mixing its longhand properties inline.
    function forceSurface(store, element, color, attributes = []) {
      forceStyle(store, element, "background", color);
      forceStyle(store, element, "box-shadow", "none");
      forceStyle(store, element, "backdrop-filter", surfaceBackdrop(element, color));
      if (element.matches(BACKDROP_RESET_SELECTOR)) {
        forceStyle(store, element, "filter", "none");
      }
      attributes.forEach(attribute => {
        if (!element.hasAttribute(attribute)) element.setAttribute(attribute, "");
        if (attribute === UNIVERSAL_GLASS_ATTR) element.removeAttribute(UNIVERSAL_GLASS_CLEAR_ATTR);
        if (attribute === UNIVERSAL_GLASS_CLEAR_ATTR) element.removeAttribute(UNIVERSAL_GLASS_ATTR);
      });
    }

    function syncAmbientBlocker() {
      ambientTimer = 0;
      if (!customBackgroundEnabled()) {
        document.querySelectorAll("[" + AMBIENT_BLOCKED_ATTR + "]").forEach(element =>
          element.removeAttribute(AMBIENT_BLOCKED_ATTR)
        );
        return;
      }
      const candidates = new Set(document.querySelectorAll(
        "#cinematics, #cinematics-container, #cinematics-full-bleed-container, " +
        "ytd-reel-video-renderer #cinematic-container, ytd-shorts #shorts-cinematic-container, " +
        "ytd-shorts #cinematic-shorts-scrim, [id*='cinematic' i], [class*='cinematic' i], " +
        "[id*='ambient' i], [class*='ambient' i]"
      ));
      candidates.forEach(element => {
        const name = (element.id + " " + (typeof element.className === "string" ? element.className : "")).toLowerCase();
        if (/cinematic|ambient/.test(name)) element.setAttribute(AMBIENT_BLOCKED_ATTR, "");
      });
    }

    function scheduleAmbientBlocker() {
      if (disposed || ambientTimer) return;
      ambientTimer = setTimeout(syncAmbientBlocker, 120);
    }

    function syncUniversalGlass() {
      glassTimer = 0;
      if (!glassEnabled()) {
        restoreStore(glassStyles, [UNIVERSAL_GLASS_ATTR, UNIVERSAL_GLASS_CLEAR_ATTR]);
        return;
      }
      const surfaces = new Set(document.querySelectorAll(UNIVERSAL_GLASS_TARGET_SELECTOR));
      const clearSurfaces = new Set();
      UNIVERSAL_GLASS_CLEAR_SELECTORS.forEach(selector =>
        document.querySelectorAll(selector).forEach(element => clearSurfaces.add(element))
      );
      clearSurfaces.forEach(element => surfaces.delete(element));
      const active = new Set([...surfaces, ...clearSurfaces]);
      reconcile(glassStyles, active, [UNIVERSAL_GLASS_ATTR, UNIVERSAL_GLASS_CLEAR_ATTR]);
      surfaces.forEach(element => forceSurface(
        glassStyles, element, "var(--ytc-universal-glass)", [UNIVERSAL_GLASS_ATTR]
      ));
      clearSurfaces.forEach(element => forceSurface(
        glassStyles, element, "transparent", [UNIVERSAL_GLASS_CLEAR_ATTR]
      ));
    }

    function applyAddedNavigationSurfaces(records) {
      if (!glassEnabled()) return;
      const surfaces = new Set();
      const clearSurfaces = new Set();
      for (const record of records) {
        if (record.type !== "childList") continue;
        if (record.target instanceof Element && record.target.matches(NAVIGATION_SURFACE_SELECTOR)) {
          if (record.target.matches(UNIVERSAL_GLASS_CLEAR_SELECTOR)) clearSurfaces.add(record.target);
          else surfaces.add(record.target);
        }
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches(UNIVERSAL_GLASS_CLEAR_SELECTOR)) clearSurfaces.add(node);
          node.querySelectorAll(UNIVERSAL_GLASS_CLEAR_SELECTOR).forEach(element => clearSurfaces.add(element));
          if (node.matches(NAVIGATION_SURFACE_SELECTOR) && !node.matches(UNIVERSAL_GLASS_CLEAR_SELECTOR)) {
            surfaces.add(node);
          }
          node.querySelectorAll(NAVIGATION_SURFACE_SELECTOR).forEach(element => {
            if (!element.matches(UNIVERSAL_GLASS_CLEAR_SELECTOR)) surfaces.add(element);
          });
        }
      }
      surfaces.forEach(element => forceSurface(
        glassStyles, element, "var(--ytc-universal-glass)", [UNIVERSAL_GLASS_ATTR]
      ));
      clearSurfaces.forEach(element => forceSurface(
        glassStyles, element, "transparent", [UNIVERSAL_GLASS_CLEAR_ATTR]
      ));
    }

    function scheduleUniversalGlass(immediate = false) {
      if (disposed) return;
      if (glassTimer) {
        if (!immediate) return;
        clearTimeout(glassTimer);
      }
      glassTimer = setTimeout(syncUniversalGlass, immediate ? 0 : 80);
    }

    function visitLiveChatShadowRoot(root) {
      if (!root) return;
      let style = root.querySelector("style[" + LIVE_CHAT_SHADOW_STYLE_ATTR + "]");
      if (!style) {
        style = document.createElement("style");
        style.setAttribute(LIVE_CHAT_SHADOW_STYLE_ATTR, "");
        root.append(style);
      }
      if (style.textContent !== LIVE_CHAT_SHADOW_CSS) style.textContent = LIVE_CHAT_SHADOW_CSS;
      root.querySelectorAll("*").forEach(element => visitLiveChatShadowRoot(element.shadowRoot));
    }

    function syncLiveChatSurfaces() {
      chatTimer = 0;
      if (!glassEnabled()) return;
      document.querySelectorAll("yt-live-chat-app, yt-live-chat-renderer").forEach(host =>
        visitLiveChatShadowRoot(host.shadowRoot)
      );
    }

    function scheduleLiveChatSurfaces() {
      if (disposed || chatTimer) return;
      chatTimer = setTimeout(syncLiveChatSurfaces, 0);
    }

    function syncHomepageState() {
      const active = customBackgroundEnabled() && location.pathname === "/" &&
        Boolean(document.querySelector(HOMEPAGE_SCOPE_SELECTOR));
      const wasActive = document.documentElement.hasAttribute("data-ytc-home-glass");
      document.documentElement.toggleAttribute("data-ytc-home-glass", active);
      if (!active) restoreStore(homepageStyles);
      else if (!wasActive) {
        const inlineSurfaces = document.querySelectorAll(
          HOMEPAGE_SCOPE_SELECTOR + ' [style*="background"], ytd-masthead[style*="background"], ' +
          'ytd-masthead [style*="background"], ytd-feed-filter-chip-bar-renderer[style*="background"], ' +
          'ytd-feed-filter-chip-bar-renderer [style*="background"]'
        );
        inlineSurfaces.forEach(enforceHomepageStyle);
      }
    }

    function enforceHomepageStyle(element) {
      const inHomepage = element.closest(HOMEPAGE_SCOPE_SELECTOR) ||
        element.closest("ytd-masthead, ytd-feed-filter-chip-bar-renderer");
      if (!customBackgroundEnabled() || location.pathname !== "/" || !element.isConnected ||
          !inHomepage || element.matches(UNIVERSAL_GLASS_CLEAR_SELECTOR) ||
          element.matches(UNIVERSAL_GLASS_TARGET_SELECTOR) || element.matches("video, img, canvas, iframe") ||
          !element.style.background) return;
      forceStyle(homepageStyles, element, "background", "var(--ytc-universal-glass)");
      forceStyle(homepageStyles, element, "box-shadow", "none");
      forceStyle(homepageStyles, element, "backdrop-filter", GLASS_BACKDROP);
    }

    function scheduleHomepageSync() {
      if (disposed || homepageTimer || !customBackgroundEnabled() || location.pathname !== "/") return;
      homepageTimer = setTimeout(() => {
        homepageTimer = 0;
        syncHomepageState();
      }, 0);
    }

    function apply() {
      syncHomepageState();
      syncAmbientBlocker();
      scheduleUniversalGlass(true);
      scheduleLiveChatSurfaces();
    }

    function handleMutations(records) {
      let addedNodes = false;
      for (const record of records) {
        if (record.type === "childList" && record.addedNodes.length) addedNodes = true;
        if (record.type === "attributes" && ["class", "role", "hidden"].includes(record.attributeName) &&
            record.target instanceof Element && glassEnabled() &&
            (glassStyles.has(record.target) || record.target.closest(DIALOG_SURFACE_SELECTOR))) {
          scheduleUniversalGlass();
        }
        if (record.type !== "attributes" || record.attributeName !== "style" ||
            !(record.target instanceof Element)) continue;
        const target = record.target;
        if (target.matches(SEARCH_SUGGESTION_SELECTOR) || target.closest("yt-searchbox, ytd-searchbox")) {
          scheduleUniversalGlass();
        }
        const isClear = target.matches(UNIVERSAL_GLASS_CLEAR_SELECTOR);
        const attribute = isClear ? UNIVERSAL_GLASS_CLEAR_ATTR : UNIVERSAL_GLASS_ATTR;
        const expectedBackground = isClear ? "transparent" : "var(--ytc-universal-glass)";
        const expectedBackdrop = surfaceBackdrop(target, expectedBackground);
        const alreadyForced = glassEnabled() && target.hasAttribute(attribute) &&
          target.style.getPropertyValue("background") === expectedBackground &&
          target.style.getPropertyPriority("background") === "important" &&
          target.style.getPropertyValue("box-shadow") === "none" &&
          target.style.getPropertyValue("backdrop-filter") === expectedBackdrop &&
          target.style.getPropertyPriority("backdrop-filter") === "important" &&
          (!target.matches(BACKDROP_RESET_SELECTOR) ||
            target.style.getPropertyValue("filter") === "none" &&
              target.style.getPropertyPriority("filter") === "important");
        if (!alreadyForced && glassEnabled() && (isClear || target.matches(UNIVERSAL_GLASS_TARGET_SELECTOR))) {
          forceSurface(glassStyles, target, expectedBackground, [attribute]);
        }
        if (target.closest(HOMEPAGE_SCOPE_SELECTOR) ||
            target.closest("ytd-masthead, ytd-feed-filter-chip-bar-renderer")) {
          enforceHomepageStyle(target);
        }
      }
      if (addedNodes) scheduleHomepageSync();
      if (addedNodes) applyAddedNavigationSurfaces(records);
      if (addedNodes) scheduleUniversalGlass();
      if (addedNodes) {
        scheduleAmbientBlocker();
        scheduleLiveChatSurfaces();
      }
    }

    function dispose() {
      disposed = true;
      clearTimeout(ambientTimer);
      clearTimeout(glassTimer);
      clearTimeout(chatTimer);
      clearTimeout(homepageTimer);
      restoreStore(glassStyles, [UNIVERSAL_GLASS_ATTR, UNIVERSAL_GLASS_CLEAR_ATTR]);
      restoreStore(homepageStyles);
      document.documentElement.removeAttribute("data-ytc-home-glass");
      document.querySelectorAll("[" + AMBIENT_BLOCKED_ATTR + "]").forEach(element =>
        element.removeAttribute(AMBIENT_BLOCKED_ATTR)
      );
    }

    return Object.freeze({ apply, handleMutations, scheduleUniversalGlass, dispose });
  }

  runtime.createSurfaceController = createSurfaceController;
  // Share the same targets with CSS so new UI surfaces are styled before the observer runs.
  runtime.buildSurfaceCss = () => `
    /* Named view-transition surfaces prevent descendants from sampling the wallpaper in Chrome. */
    html[data-ytc-theme][data-ytc-blur] ytd-watch-flexy :is(#below, #secondary) {
      view-transition-name: none !important;
    }
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_TARGET_SELECTOR}) {
      background: var(--ytc-universal-glass) !important;
      box-shadow: none !important;
      backdrop-filter: ${GLASS_BACKDROP} !important;
    }
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_CLEAR_SELECTOR}) {
      background: transparent !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
    }
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_CLEAR_SELECTOR}):is(${FRAME_BACKDROP_SELECTOR}) {
      backdrop-filter: ${GLASS_BACKDROP} !important;
    }
    html[data-ytc-theme] :is(${BACKDROP_RESET_SELECTOR}) {
      filter: none !important;
    }
    html[data-ytc-theme] :is(${BACKDROP_RESET_SELECTOR})::before,
    html[data-ytc-theme] :is(${BACKDROP_RESET_SELECTOR})::after {
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
      filter: none !important;
    }
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_TARGET_SELECTOR}, ${UNIVERSAL_GLASS_CLEAR_SELECTOR})::before,
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_TARGET_SELECTOR}, ${UNIVERSAL_GLASS_CLEAR_SELECTOR})::after {
      background: transparent !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
    }
  `;
  runtime.surfaceVersion = YTCustomizer.version;
})();
