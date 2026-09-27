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
  // Include previously managed nodes so moving a card or removing a dialog role restores its old styles.
  const GLASS_UPDATE_SELECTOR = [UNIVERSAL_GLASS_TARGET_SELECTOR, UNIVERSAL_GLASS_CLEAR_SELECTOR,
    `[${UNIVERSAL_GLASS_ATTR}]`, `[${UNIVERSAL_GLASS_CLEAR_ATTR}]`].join(",");
  // Controls inside a frosted panel can use its blurred background without a second backdrop filter.
  // The masthead is excluded because opening search suggestions temporarily removes its blur.
  const SHARED_BACKDROP_SELECTOR = `:is(ytd-comments, ytd-watch-metadata #description,
    ytd-watch-next-secondary-results-renderer, ytd-playlist-panel-renderer, ytd-playlist-sidebar-renderer,
    ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model,
    ytd-guide-renderer, ytd-mini-guide-renderer, ytd-feed-filter-chip-bar-renderer,
    ytd-menu-popup-renderer, ytd-multi-page-menu-renderer, yt-live-chat-renderer,
    ytd-engagement-panel-section-list-renderer #content, .ytp-popup,
    ${DIALOG_SURFACE_SELECTOR}) :is(.ytSpecButtonShapeNextHost, yt-chip-cloud-chip-renderer,
    .ytChipShapeChip, ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer)`;
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
    let fullGlassScanPending = false;
    let removedGlassNodes = false;
    const glassRoots = new Set();
    const glassElements = new Set();
    const ownStyleValues = new WeakMap();
    const dialogRoots = new WeakSet();
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
      ownStyleValues.set(element, element.getAttribute("style"));
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
      if (element.matches(SHARED_BACKDROP_SELECTOR)) return "none";
      return color !== "transparent" ? GLASS_BACKDROP : "none";
    }

    // Background shorthand is intentional: YouTube frequently restores black with `background`,
    // so override that single declaration without mixing its longhand properties inline.
    function forceSurface(store, element, color, attributes = []) {
      const backdrop = surfaceBackdrop(element, color);
      forceStyle(store, element, "background", color);
      forceStyle(store, element, "box-shadow", "none");
      forceStyle(store, element, "backdrop-filter", backdrop);
      if (element.matches(BACKDROP_RESET_SELECTOR)) {
        forceStyle(store, element, "filter", "none");
      }
      attributes.forEach(attribute => {
        if (!element.hasAttribute(attribute)) element.setAttribute(attribute, "");
        if (attribute === UNIVERSAL_GLASS_ATTR) element.removeAttribute(UNIVERSAL_GLASS_CLEAR_ATTR);
        if (attribute === UNIVERSAL_GLASS_CLEAR_ATTR) element.removeAttribute(UNIVERSAL_GLASS_ATTR);
      });
      ownStyleValues.set(element, element.getAttribute("style"));
      if (element.matches(DIALOG_SURFACE_SELECTOR)) dialogRoots.add(element);
      else dialogRoots.delete(element);
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
      if (disposed) return;
      const fullScan = fullGlassScanPending;
      const roots = new Set(glassRoots);
      const elements = new Set(glassElements);
      const pruneRemoved = removedGlassNodes;
      fullGlassScanPending = false;
      removedGlassNodes = false;
      glassRoots.clear();
      glassElements.clear();
      if (!glassEnabled()) {
        restoreStore(glassStyles, [UNIVERSAL_GLASS_ATTR, UNIVERSAL_GLASS_CLEAR_ATTR]);
        return;
      }
      if (!fullScan) {
        if (pruneRemoved) {
          for (const [element] of glassStyles) {
            if (element.isConnected) continue;
            restoreElement(glassStyles, element);
            element.removeAttribute(UNIVERSAL_GLASS_ATTR);
            element.removeAttribute(UNIVERSAL_GLASS_CLEAR_ATTR);
          }
        }
        for (const root of roots) {
          if (!root.isConnected) continue;
          // A newly inserted comment often reports both its parent and its children in one batch.
          let nested = false;
          for (let parent = root.parentElement; parent; parent = parent.parentElement) {
            if (roots.has(parent)) { nested = true; break; }
          }
          if (nested) continue;
          elements.add(root);
          root.querySelectorAll(GLASS_UPDATE_SELECTOR).forEach(element => elements.add(element));
        }
        elements.forEach(updateGlassElement);
        return;
      }
      const surfaces = new Set(document.querySelectorAll(UNIVERSAL_GLASS_TARGET_SELECTOR));
      const clearSurfaces = new Set(document.querySelectorAll(UNIVERSAL_GLASS_CLEAR_SELECTOR));
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

    function updateGlassElement(element) {
      if (!element.isConnected) return;
      if (element.matches(UNIVERSAL_GLASS_CLEAR_SELECTOR)) {
        forceSurface(glassStyles, element, "transparent", [UNIVERSAL_GLASS_CLEAR_ATTR]);
      } else if (element.matches(UNIVERSAL_GLASS_TARGET_SELECTOR)) {
        forceSurface(glassStyles, element, "var(--ytc-universal-glass)", [UNIVERSAL_GLASS_ATTR]);
      } else if (glassStyles.has(element)) {
        restoreElement(glassStyles, element);
        element.removeAttribute(UNIVERSAL_GLASS_ATTR);
        element.removeAttribute(UNIVERSAL_GLASS_CLEAR_ATTR);
        dialogRoots.delete(element);
      }
    }

    function scheduleGlassUpdate(immediate = false) {
      if (disposed) return;
      if (glassTimer) {
        if (!immediate) return;
        clearTimeout(glassTimer);
      }
      glassTimer = setTimeout(syncUniversalGlass, immediate ? 0 : 80);
    }

    function scheduleUniversalGlass(immediate = false) {
      fullGlassScanPending = true;
      scheduleGlassUpdate(immediate);
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
      ownStyleValues.set(element, element.getAttribute("style"));
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
      if (disposed) return;
      let addedNodes = false;
      for (const record of records) {
        const target = record.target;
        if (!(target instanceof Element)) continue;
        if (record.type === "attributes" && record.attributeName === "style" &&
            ownStyleValues.get(target) === target.getAttribute("style")) continue;
        if (record.type === "childList") {
          let changedElements = false;
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            addedNodes = changedElements = true;
            if (glassEnabled()) glassRoots.add(node);
          }
          for (const node of record.removedNodes) {
            if (!(node instanceof Element)) continue;
            changedElements = true;
            if (glassEnabled()) removedGlassNodes = true;
          }
          // Text updates cannot introduce a new glass surface.
          if (!changedElements) continue;
          if (glassEnabled()) {
            // This ancestor's :has(#chips-wrapper) rule depends on added and removed children.
            const chipBar = target.closest("ytd-feed-filter-chip-bar-renderer");
            if (chipBar) glassElements.add(chipBar);
          }
        } else if (glassEnabled()) {
          if (record.attributeName === "style") {
            const managed = glassStyles.get(target);
            const overridden = managed && [...managed].some(([property, original]) =>
              target.style.getPropertyValue(property) !== original.applied ||
              target.style.getPropertyPriority(property) !== "important");
            const surfaceStyle = target.style.background || target.style.boxShadow ||
              target.style.backdropFilter || target.style.filter;
            if (overridden || !managed && surfaceStyle && target.matches(GLASS_UPDATE_SELECTOR)) {
              glassElements.add(target);
            }
          } else {
            if (glassStyles.has(target) || target.matches(GLASS_UPDATE_SELECTOR)) glassElements.add(target);
            // Changing a dialog role/class also changes the appearance of its nested panels.
            if (["class", "role"].includes(record.attributeName) &&
                (dialogRoots.has(target) || target.matches(DIALOG_SURFACE_SELECTOR) || record.attributeName === "role")) {
              glassRoots.add(target);
            }
          }
        }
        if (glassEnabled() && (target.matches(SEARCH_SUGGESTION_SELECTOR) ||
            target.closest("yt-searchbox, ytd-searchbox, ytd-masthead"))) {
          const masthead = target.closest("ytd-masthead") || document.querySelector("ytd-masthead");
          if (masthead) glassElements.add(masthead);
        }
        if (record.type === "attributes" && record.attributeName === "style" &&
            (target.closest(HOMEPAGE_SCOPE_SELECTOR) ||
              target.closest("ytd-masthead, ytd-feed-filter-chip-bar-renderer"))) {
          enforceHomepageStyle(target);
        }
      }
      if (addedNodes) scheduleHomepageSync();
      if (glassRoots.size || glassElements.size || removedGlassNodes) scheduleGlassUpdate();
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
      glassRoots.clear();
      glassElements.clear();
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
    html[data-ytc-theme] :is(${SHARED_BACKDROP_SELECTOR}) {
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
