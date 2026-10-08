// Applies and restores translucent surfaces while suppressing YouTube ambient lighting over custom wallpapers.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.surfaceVersion === YTCustomizer.version) return;

  const AMBIENT_BLOCKED_ATTR = "data-ytc-ambient-blocked";
  const AMBIENT_CANDIDATE_SELECTOR = "#cinematics, #cinematics-container, #cinematics-full-bleed-container, " +
    "ytd-reel-video-renderer #cinematic-container, ytd-shorts #shorts-cinematic-container, " +
    "ytd-shorts #cinematic-shorts-scrim, [id*='cinematic' i], [class*='cinematic' i], " +
    "[id*='ambient' i], [class*='ambient' i], [" + AMBIENT_BLOCKED_ATTR + "]";
  const LIVE_CHAT_HOST_SELECTOR = "yt-live-chat-app, yt-live-chat-renderer";
  const PLAYER_SCOPE_SELECTOR = ".html5-video-player, #inline-player, #inline-preview-player";
  const UNIVERSAL_GLASS_ATTR = "data-ytc-universal-glass";
  const UNIVERSAL_GLASS_CLEAR_ATTR = "data-ytc-universal-clear";
  const GLASS_BACKDROP = "var(--ytc-ui-backdrop)";
  const MASTHEAD_BACKDROP_SELECTOR = "ytd-masthead > #background";
  // Frost the header's background sibling so autocomplete can still sample the page.
  // An iframe also needs its outer frame to sample the parent document's wallpaper.
  const FROSTED_WRAPPER_SELECTOR = "ytd-live-chat-frame, " + MASTHEAD_BACKDROP_SELECTOR;
  // The classic input's 32px left margin belongs to a clear layout wrapper.
  // Unified search instead paints its rounded outer container while expanded.
  const SEARCH_UNIFIED_SURFACE_SELECTOR = ".ytSearchboxComponentInputContainerUnified.ytSearchboxComponentInputContainerIsFocused";
  const NAVIGATION_BACKDROP_SELECTOR = [
    "ytd-app #frosted-glass", "ytd-app #masthead-container", "ytd-masthead #background",
    "ytd-feed-filter-chip-bar-renderer", "ytd-feed-filter-chip-bar-renderer #chips-wrapper"
  ].join(",");
  // Give each popup one tinted outer panel; nested dialog layouts stay clear.
  const DIALOG_SURFACE_SELECTORS = [
    "tp-yt-paper-dialog", "[role='dialog']", "yt-dialog-view-model", "yt-sheet-view-model",
    ".ytDialogViewModelHost", ".ytSheetViewModelHost", ".ytContextualSheetLayoutHost",
    ".ytSpecDialogLayoutHost", ".ytSpecBottomSheetLayoutContainer", "ytd-add-to-playlist-renderer",
    "ytd-voice-search-dialog-renderer", "ytd-report-form-modal-renderer",
    "ytd-download-quality-selector-renderer"
  ];
  const DIALOG_SURFACE_SELECTOR = DIALOG_SURFACE_SELECTORS.join(",");
  const DIALOG_CONTENT_SELECTOR = `:is(${DIALOG_SURFACE_SELECTOR}) :is(
    .ytContextualSheetLayoutHeaderContainer, .ytContextualSheetLayoutContentContainer,
    .ytContextualSheetLayoutFooterContainer, .ytSpecDialogLayoutContainer,
    .ytSpecDialogLayoutContent, .ytSpecDialogLayoutContentInner, .ytSpecDialogLayoutFooterContainer,
    .ytSpecBottomSheetLayoutHeaderWrapper, .ytSpecBottomSheetLayoutContentWrapper,
    .ytSpecBottomSheetLayoutFooterWrapper, yt-list-view-model, .ytListViewModelHost,
    ytd-flow-root-renderer, ytd-flow-step-renderer,
    ytd-flow-root-renderer #content, ytd-flow-step-renderer #content,
    ytd-engagement-panel-section-list-renderer #content,
    ytd-download-quality-selector-content,
    ytd-download-quality-selector-content :is(#quality-options, #upsell-section),
    ytd-download-quality-selector-renderer .buttons,
    :is(ytd-voice-search-dialog-renderer, ytd-report-form-modal-renderer,
      ytd-download-quality-selector-renderer) :is(#voice-search-dialog, #dialog, #download-dialog,
      #report-form, #content, #contents, #container))`;
  const BACKDROP_RESET_SELECTOR = NAVIGATION_BACKDROP_SELECTOR + "," + DIALOG_SURFACE_SELECTOR;
  const TOPICS_SHELF_SELECTOR = 'ytd-browse[page-subtype="home"] ' +
    ':is(ytd-chips-shelf-with-video-shelf-renderer, .ytdChipsShelfWithVideoShelfRendererHost)';
  const MEMBERSHIPS_SHELF_SELECTOR = 'ytd-browse[page-subtype="home"] ' +
    'ytd-rich-shelf-renderer[has-paygated-featured-badge]:not([is-shorts])';
  const SEARCH_SHORTS_SHELF_SELECTOR = 'ytd-search :is(ytd-reel-shelf-renderer, ' +
    'grid-shelf-view-model:not(ytd-reel-shelf-renderer *):has(' +
    'ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2))';
  // Modern v2 cards wrap the classic lockup; tint and inset only the outer card.
  const SEARCH_SHORTS_CARD_SELECTOR = SEARCH_SHORTS_SHELF_SELECTOR +
    ' :is(ytd-reel-item-renderer, ytm-shorts-lockup-view-model-v2:not(ytd-reel-item-renderer *), ' +
    'ytm-shorts-lockup-view-model:not(:is(ytm-shorts-lockup-view-model-v2, ytd-reel-item-renderer) *))';
  const SEARCH_SHORTS_FOOTER_SELECTOR = SEARCH_SHORTS_SHELF_SELECTOR +
    ' .ytGridShelfViewModelGridShelfBottomButtonContainer';
  const CHANNEL_SCOPE_SELECTOR = 'ytd-browse[page-subtype="channels"]';
  const CHANNEL_PANEL_SELECTOR = CHANNEL_SCOPE_SELECTOR + ' ytd-item-section-renderer';
  const CHANNEL_CARD_TYPES = 'ytd-rich-item-renderer, ytd-grid-video-renderer, ' +
    'ytd-grid-playlist-renderer, ytd-grid-channel-renderer, ytd-post-renderer, ytd-reel-item-renderer, ' +
    'yt-lockup-view-model:not(:is(ytd-rich-item-renderer, ytd-post-renderer) *), ' +
    'ytm-shorts-lockup-view-model-v2:not(ytd-reel-item-renderer *), ' +
    'ytm-shorts-lockup-view-model:not(:is(ytm-shorts-lockup-view-model-v2, ytd-reel-item-renderer) *)';
  const CHANNEL_CARD_SELECTOR = CHANNEL_SCOPE_SELECTOR + ' :is(' + CHANNEL_CARD_TYPES + ')';
  const CHANNEL_HEADER_SURFACE_SELECTOR = CHANNEL_SCOPE_SELECTOR +
    ' :is(yt-page-header-renderer, ytd-c4-tabbed-header-renderer #channel-header, tp-yt-paper-tabs)';
  // Library routes do not consistently expose a page-subtype. Use a route marker
  // and the visible browse renderer, including headers mounted through a portal.
  const LIBRARY_ATTR = 'data-ytc-library';
  const LIBRARY_SCOPE_SELECTOR = `html[${LIBRARY_ATTR}] ytd-browse:not([hidden])`;
  const LIBRARY_PANEL_SELECTOR = LIBRARY_SCOPE_SELECTOR + ' :is(ytd-item-section-renderer, ' +
    'ytd-playlist-video-list-renderer, ytd-downloads-page-renderer, ytd-offline-page-renderer, ' +
    'ytd-course-section-renderer, ytd-clip-section-renderer, ytd-message-renderer, ytd-background-promo-renderer)';
  const LIBRARY_CLASSIC_CARD_TYPES = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ' +
    'ytd-playlist-renderer, ytd-grid-playlist-renderer, ytd-playlist-video-renderer, ' +
    'ytd-download-item-renderer, ytd-offline-video-renderer, ytd-course-renderer, ' +
    'ytd-clip-renderer, ytd-clip-video-renderer, ytd-reel-item-renderer';
  const LIBRARY_CARD_TYPES = LIBRARY_CLASSIC_CARD_TYPES + ', ' +
    `yt-lockup-view-model:not(:is(${LIBRARY_CLASSIC_CARD_TYPES}) *), ` +
    `ytm-shorts-lockup-view-model-v2:not(:is(${LIBRARY_CLASSIC_CARD_TYPES}) *), ` +
    `ytm-shorts-lockup-view-model:not(:is(${LIBRARY_CLASSIC_CARD_TYPES}, ytm-shorts-lockup-view-model-v2) *)`;
  const LIBRARY_CARD_SELECTOR = LIBRARY_SCOPE_SELECTOR + ' :is(' + LIBRARY_CARD_TYPES + ')';
  const LIBRARY_HEADER_SELECTOR = `html[${LIBRARY_ATTR}] :is(yt-page-header-renderer, ` +
    'ytd-playlist-header-renderer, ytd-playlist-sidebar-renderer)';
  const LIBRARY_HISTORY_CONTROLS_SELECTOR = `html[${LIBRARY_ATTR}="history"] ` +
    'ytd-browse:not([hidden]) ytd-two-column-browse-results-renderer > #secondary';
  const LIBRARY_INNER_SELECTOR = ':is(' + LIBRARY_CARD_SELECTOR + ') :is(#dismissible, #container, ' +
    '#content, #contents, #details, #meta, yt-lockup-view-model, ytm-shorts-lockup-view-model, ' +
    '.ytLockupViewModelHost, .ytLockupMetadataViewModelHost, ' +
    '.yt-lockup-view-model-wiz__metadata, .yt-lockup-metadata-view-model-wiz__text-container, ' +
    '.ytLockupMetadataViewModelTextContainer):not(' + PLAYER_SCOPE_SELECTOR + ', ' +
    '.html5-video-player *, #inline-player *, #inline-preview-player *)';
  const LIBRARY_CLEAR_SELECTOR = LIBRARY_SCOPE_SELECTOR +
    ' :is(ytd-shelf-renderer, ytd-rich-shelf-renderer, grid-shelf-view-model, ' +
    'ytd-playlist-video-list-renderer > #contents), ' + LIBRARY_INNER_SELECTOR + ', ' +
    `:is(${LIBRARY_PANEL_SELECTOR}) > :is(#contents, #content, #container, #dismissible), ` +
    `html[${LIBRARY_ATTR}] ytd-tabbed-page-header, ` +
    `html[${LIBRARY_ATTR}] :is(ytd-playlist-header-renderer, ytd-playlist-sidebar-renderer) ` +
    ':is(#background, #primary, #secondary, .playlist-header-background), ' +
    LIBRARY_HISTORY_CONTROLS_SELECTOR + ' > #contents';
  const UNIVERSAL_GLASS_TARGET_SELECTORS = [
    "ytd-masthead", "ytd-masthead #background", "ytd-masthead #masthead-container",
    "ytd-mini-guide-renderer", "ytd-guide-renderer", "ytd-guide-renderer #guide",
    "ytd-guide-renderer #guide-inner-content", "ytd-mini-guide-renderer #guide-content",
    "ytd-feed-filter-chip-bar-renderer", "ytd-feed-filter-chip-bar-renderer #chips-wrapper",
    "yt-chip-cloud-renderer", "ytd-guide-entry-renderer", "ytd-mini-guide-entry-renderer",
    "yt-chip-cloud-chip-renderer", "yt-chip-cloud-chip-renderer #chip-container",
    ".ytChipShapeChip", ".ytSpecTouchFeedbackShapeFill", ".ytSpecButtonShapeNextHost",
    "ytd-rich-item-renderer", "ytd-rich-section-renderer", "ytd-rich-shelf-renderer", "ytd-watch-metadata #description",
    TOPICS_SHELF_SELECTOR, TOPICS_SHELF_SELECTOR + " button",
    MEMBERSHIPS_SHELF_SELECTOR + " button",
    SEARCH_SHORTS_SHELF_SELECTOR, SEARCH_SHORTS_CARD_SELECTOR,
    "ytd-video-renderer", "ytd-compact-video-renderer", "yt-lockup-view-model",
    "ytd-search ytd-channel-renderer",
    CHANNEL_PANEL_SELECTOR, CHANNEL_CARD_SELECTOR, CHANNEL_HEADER_SURFACE_SELECTOR,
    LIBRARY_PANEL_SELECTOR, LIBRARY_CARD_SELECTOR, LIBRARY_HEADER_SELECTOR, LIBRARY_HISTORY_CONTROLS_SELECTOR,
    "ytd-feed-nudge-renderer #content-wrapper",
    "ytd-comments", "ytd-watch-next-secondary-results-renderer", "ytd-playlist-panel-renderer",
    "ytd-playlist-sidebar-renderer", "ytd-live-chat-frame", "yt-live-chat-renderer",
    "ytd-menu-popup-renderer", "ytd-multi-page-menu-renderer", ...DIALOG_SURFACE_SELECTORS,
    "ytd-voice-search-dialog-renderer #voice-search-dialog",
    "ytd-tabbed-page-header", "ytd-c4-tabbed-header-renderer", "ytd-playlist-header-renderer",
    "yt-page-header-renderer", "yt-page-header-view-model",
    ".ytp-popup", ".ytp-tooltip-text", "tp-yt-paper-tooltip #tooltip",
    // Modern volume controls paint one capsule; its hover pseudo layer stays clear.
    ".html5-video-player.ytp-delhi-modern.ytp-delhi-horizontal-volume-controls .ytp-volume-area",
    ".html5-video-player.ytp-delhi-modern .ytp-volume-popover",
    "tp-yt-app-drawer #contentContainer", "ytd-engagement-panel-section-list-renderer #content",
    "ytd-masthead #search", "ytd-masthead #center", "ytd-masthead #container", "yt-searchbox",
    SEARCH_UNIFIED_SURFACE_SELECTOR, ".ytSearchboxComponentInputBox",
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
    "ytd-multi-page-menu-renderer > #header",
    "ytd-multi-page-menu-renderer > #header ytd-simple-menu-header-renderer",
    "ytd-feed-filter-chip-bar-renderer:has(#chips-wrapper)", "ytd-feed-filter-chip-bar-renderer yt-chip-cloud-renderer",
    "yt-chip-cloud-chip-renderer #chip-container", "yt-chip-cloud-chip-renderer .ytChipShapeChip",
    "ytd-rich-item-renderer yt-lockup-view-model",
    TOPICS_SHELF_SELECTOR + " ytd-rich-shelf-renderer",
    TOPICS_SHELF_SELECTOR + " ytd-rich-shelf-renderer .button-container",
    MEMBERSHIPS_SHELF_SELECTOR + " > #dismissible > .button-container",
    SEARCH_SHORTS_FOOTER_SELECTOR,
    // Blur on the outer header moves its fixed descendants into a new containing block.
    CHANNEL_SCOPE_SELECTOR + ' :is(ytd-tabbed-page-header, ytd-c4-tabbed-header-renderer)',
    CHANNEL_PANEL_SELECTOR + ' :is(ytd-shelf-renderer, ytd-rich-shelf-renderer, grid-shelf-view-model)',
    CHANNEL_SCOPE_SELECTOR + ' ytd-post-renderer :is(#dismissible, #body, #header, #toolbar)',
    CHANNEL_SCOPE_SELECTOR + ' .ytGridShelfViewModelGridShelfBottomButtonContainer',
    LIBRARY_CLEAR_SELECTOR,
    ".ytSpecTouchFeedbackShapeFill", "ytd-rich-section-renderer",
    `.ytSearchboxComponentInputContainer:not(${SEARCH_UNIFIED_SURFACE_SELECTOR})`,
    `${SEARCH_UNIFIED_SURFACE_SELECTOR} :is(.ytSearchboxComponentInputBox, .ytSearchboxComponentSearchButton)`,
    "tp-yt-app-drawer #contentContainer", "ytd-live-chat-frame", "ytd-live-chat-frame #chat",
    "ytd-live-chat-frame iframe", "yt-live-chat-app", "yt-live-chat-app > #contents",
    "yt-live-chat-renderer #contents", "yt-live-chat-renderer #chat-messages", "yt-live-chat-renderer #chat",
    "yt-live-chat-renderer #panel-pages", "yt-live-chat-item-list-renderer", "yt-live-chat-item-list-renderer #item-scroller",
    "yt-live-chat-item-list-renderer #items", "yt-live-chat-header-renderer", "yt-live-chat-banner-manager",
    "yt-live-chat-message-input-renderer", "yt-live-chat-message-input-renderer #input-panel",
    "yt-live-chat-message-input-renderer #input", "ytd-tabbed-page-header #page-header-container",
    "ytd-tabbed-page-header #page-header", "ytd-tabbed-page-header #tabs-container",
    "ytd-tabbed-page-header #tabs-inner-container",
    'ytd-c4-tabbed-header-renderer #channel-header:not(' + CHANNEL_SCOPE_SELECTOR + ' *)',
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
  // A conservative token index rejects timeline/SVG updates before testing the large
  // contextual selectors. Include ancestor tokens too, so this can only overmatch.
  const GLASS_CANDIDATE_TAGS = new Set([...GLASS_UPDATE_SELECTOR.matchAll(
    /(?:^|[\s,(>+~])([a-z][a-z0-9-]*)(?=[\s.#\[():,>+~]|$)/g
  )].map(match => match[1]));
  const GLASS_CANDIDATE_IDS = new Set([...GLASS_UPDATE_SELECTOR.matchAll(/#([\w-]+)/g)].map(match => match[1]));
  const GLASS_CANDIDATE_CLASSES = new Set([...GLASS_UPDATE_SELECTOR.matchAll(/\.([a-z_-][\w-]*)/gi)]
    .map(match => match[1]));

  function mightBeGlassElement(element) {
    if (GLASS_CANDIDATE_TAGS.has(element.localName) || GLASS_CANDIDATE_IDS.has(element.id) ||
        element.getAttribute("role") === "dialog" || element.hasAttribute(UNIVERSAL_GLASS_ATTR) ||
        element.hasAttribute(UNIVERSAL_GLASS_CLEAR_ATTR)) return true;
    for (const name of element.classList) if (GLASS_CANDIDATE_CLASSES.has(name)) return true;
    return false;
  }
  // Controls inside a frosted panel can use its blurred background without a second backdrop filter.
  // Search controls keep their own blur; the masthead backdrop lives on a sibling layer.
  const SHARED_BACKDROP_SELECTOR = `:is(ytd-comments, ytd-watch-metadata #description,
    ytd-watch-next-secondary-results-renderer, ytd-playlist-panel-renderer, ytd-playlist-sidebar-renderer,
    ytd-rich-item-renderer, ytd-video-renderer, yt-lockup-view-model, ytd-search ytd-channel-renderer,
    ytd-guide-renderer, ytd-mini-guide-renderer, ytd-feed-filter-chip-bar-renderer,
    ytd-menu-popup-renderer, ytd-multi-page-menu-renderer, yt-live-chat-renderer,
    ytd-engagement-panel-section-list-renderer #content, .ytp-popup,
    ${CHANNEL_PANEL_SELECTOR}, ${CHANNEL_CARD_SELECTOR}, ${CHANNEL_HEADER_SURFACE_SELECTOR},
    ${DIALOG_SURFACE_SELECTOR}) :is(.ytSpecButtonShapeNextHost, yt-chip-cloud-chip-renderer,
    .ytChipShapeChip, ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer),
    ${TOPICS_SHELF_SELECTOR} button,
    ${MEMBERSHIPS_SHELF_SELECTOR} :is(ytd-rich-item-renderer, yt-lockup-view-model, button),
    ${SEARCH_SHORTS_CARD_SELECTOR},
    ${SEARCH_SHORTS_SHELF_SELECTOR} .ytSpecButtonShapeNextHost,
    ${CHANNEL_PANEL_SELECTOR} :is(${CHANNEL_CARD_TYPES}),
    :is(${LIBRARY_PANEL_SELECTOR}) :is(${LIBRARY_CARD_TYPES}),
    :is(${LIBRARY_PANEL_SELECTOR}, ${LIBRARY_CARD_SELECTOR}, ${LIBRARY_HEADER_SELECTOR},
      ${LIBRARY_HISTORY_CONTROLS_SELECTOR}) .ytSpecButtonShapeNextHost`;
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
    :host(yt-live-chat-app):host-context(html[data-ytc-theme]) #contents,
    :host(yt-live-chat-renderer):host-context(html[data-ytc-theme]) #contents {
      border-radius: 16px !important;
      overflow: clip !important;
    }
  `;

  function createSurfaceController() {
    let disposed = false;
    let ambientTimer = 0;
    let glassTimer = 0;
    let chatTimer = 0;
    let homepageTimer = 0;
    let fullGlassScanPending = false;
    let fullChatScanPending = false;
    let removedGlassNodes = false;
    const ambientRoots = new Set();
    const chatRoots = new Set();
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

    function surfaceBackdrop(element, color) {
      if (element.matches(FROSTED_WRAPPER_SELECTOR)) return GLASS_BACKDROP;
      if (element.matches("ytd-masthead:has(> #background)")) return "none";
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
      if (element.matches(MASTHEAD_BACKDROP_SELECTOR)) {
        // YouTube hides this layer on chip-bar and watch pages; keep the shared blur visible.
        forceStyle(store, element, "display", "block");
        forceStyle(store, element, "opacity", "1");
      }
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

    // Inspect new subtrees once rather than rescanning the entire feed on each preview update.
    function collectCandidates(roots, selector) {
      const candidates = new Set();
      for (const root of roots) {
        if (!root.isConnected) continue;
        let nested = false;
        for (let parent = root.parentElement; parent; parent = parent.parentElement) {
          if (roots.has(parent)) { nested = true; break; }
        }
        if (nested) continue;
        if (root.matches(selector)) candidates.add(root);
        root.querySelectorAll(selector).forEach(element => candidates.add(element));
      }
      return candidates;
    }

    function syncAmbientBlocker(fullScan = false) {
      clearTimeout(ambientTimer);
      ambientTimer = 0;
      const roots = new Set(ambientRoots);
      ambientRoots.clear();
      if (!customBackgroundEnabled()) {
        document.querySelectorAll("[" + AMBIENT_BLOCKED_ATTR + "]").forEach(element =>
          element.removeAttribute(AMBIENT_BLOCKED_ATTR)
        );
        return;
      }
      const candidates = fullScan ? new Set(document.querySelectorAll(AMBIENT_CANDIDATE_SELECTOR)) :
        collectCandidates(roots, AMBIENT_CANDIDATE_SELECTOR);
      candidates.forEach(element => {
        const name = (element.id + " " + (typeof element.className === "string" ? element.className : "")).toLowerCase();
        // Collection artwork uses "Cinematic" too; it is content, not an ambient layer.
        const media = element.matches("img, video") || element.closest(
          "ytd-thumbnail, yt-thumbnail-view-model, yt-collection-thumbnail-view-model, yt-image-banner-view-model"
        );
        if (!media && /cinematic|ambient/.test(name)) element.setAttribute(AMBIENT_BLOCKED_ATTR, "");
        else element.removeAttribute(AMBIENT_BLOCKED_ATTR);
      });
    }

    function scheduleAmbientBlocker(root) {
      if (!customBackgroundEnabled()) return;
      ambientRoots.add(root);
      if (ambientTimer) return;
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
      const fullScan = fullChatScanPending;
      const roots = new Set(chatRoots);
      fullChatScanPending = false;
      chatRoots.clear();
      if (!glassEnabled()) return;
      const hosts = fullScan ? document.querySelectorAll(LIVE_CHAT_HOST_SELECTOR) :
        collectCandidates(roots, LIVE_CHAT_HOST_SELECTOR);
      hosts.forEach(host =>
        visitLiveChatShadowRoot(host.shadowRoot)
      );
    }

    function scheduleLiveChatSurfaces(root = document) {
      if (!glassEnabled()) return;
      if (root === document) fullChatScanPending = true;
      else chatRoots.add(root.closest(LIVE_CHAT_HOST_SELECTOR) || root);
      if (chatTimer) return;
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
      if (!customBackgroundEnabled() || location.pathname !== "/" || !element.isConnected ||
          !element.style.background || element.closest(PLAYER_SCOPE_SELECTOR)) return;
      const inHomepage = element.closest(HOMEPAGE_SCOPE_SELECTOR) ||
        element.closest("ytd-masthead, ytd-feed-filter-chip-bar-renderer");
      if (!inHomepage || element.matches(UNIVERSAL_GLASS_CLEAR_SELECTOR) ||
          element.matches(UNIVERSAL_GLASS_TARGET_SELECTOR) || element.matches("video, img, canvas, iframe")) return;
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
      const feed = location.pathname.match(/^\/feed\/(history|playlists|downloads|courses|clips)\/?$/)?.[1];
      const list = location.pathname === '/playlist' ? new URLSearchParams(location.search).get('list') : null;
      const library = feed || (list === 'WL' ? 'watch-later' : list === 'LL' ? 'liked' : '');
      if (glassEnabled() && library) document.documentElement.setAttribute(LIBRARY_ATTR, library);
      else document.documentElement.removeAttribute(LIBRARY_ATTR);
      syncHomepageState();
      syncAmbientBlocker(true);
      scheduleUniversalGlass(true);
      scheduleLiveChatSurfaces();
    }

    function handleMutations(records) {
      if (disposed) return;
      let addedNodes = false;
      // Mutation records describe the final DOM state; repeated writes to the same
      // player's style/class in one frame need only one check per attribute.
      const seenAttributes = new WeakMap();
      for (const record of records) {
        const target = record.target;
        if (!(target instanceof Element)) continue;
        if (record.type === "attributes") {
          const attributes = seenAttributes.get(target) || new Set();
          if (attributes.has(record.attributeName)) continue;
          attributes.add(record.attributeName);
          seenAttributes.set(target, attributes);
        }
        if (record.type === "attributes" && record.attributeName === "style" &&
            ownStyleValues.get(target) === target.getAttribute("style")) continue;
        if (record.type === "childList") {
          let changedElements = false;
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            addedNodes = changedElements = true;
            if (glassEnabled()) glassRoots.add(node);
            scheduleAmbientBlocker(node);
            scheduleLiveChatSurfaces(node);
          }
          for (const node of record.removedNodes) {
            if (!(node instanceof Element)) continue;
            changedElements = true;
            if (glassEnabled()) removedGlassNodes = true;
          }
          // Text updates cannot introduce a new glass surface.
          if (!changedElements) continue;
          if (glassEnabled()) {
            // Adding/removing the background sibling changes which node owns the header blur.
            if (target.matches("ytd-masthead")) glassElements.add(target);
            // This ancestor's :has(#chips-wrapper) rule depends on added and removed children.
            const chipBar = target.closest("ytd-feed-filter-chip-bar-renderer");
            if (chipBar) glassElements.add(chipBar);
            // A grid shelf becomes a Shorts surface when its first card arrives.
            const searchShelf = target.closest("ytd-search grid-shelf-view-model");
            if (searchShelf) glassElements.add(searchShelf);
          }
        } else if (glassEnabled() && (glassStyles.has(target) || mightBeGlassElement(target))) {
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
                (dialogRoots.has(target) || target.matches(DIALOG_SURFACE_SELECTOR))) {
              glassRoots.add(target);
            }
            // Expanded Unified search transfers the fill from the input to its parent.
            if (record.attributeName === "class" && target.matches(".ytSearchboxComponentInputContainer")) {
              glassRoots.add(target);
            }
            // YouTube can identify or recycle a featured shelf after inserting its children.
            if (["has-paygated-featured-badge", "is-shorts"].includes(record.attributeName) &&
                target.matches("ytd-rich-shelf-renderer")) {
              glassRoots.add(target);
            }
          }
        }
        if (record.type === "attributes" && record.attributeName === "style") {
          enforceHomepageStyle(target);
        }
        if (record.type === "attributes" && record.attributeName === "class" &&
            (target.hasAttribute(AMBIENT_BLOCKED_ATTR) || /cinematic|ambient/i.test(target.className))) {
          scheduleAmbientBlocker(target);
        }
      }
      if (addedNodes) scheduleHomepageSync();
      if (glassRoots.size || glassElements.size || removedGlassNodes) scheduleGlassUpdate();
    }

    function dispose() {
      disposed = true;
      clearTimeout(ambientTimer);
      clearTimeout(glassTimer);
      clearTimeout(chatTimer);
      clearTimeout(homepageTimer);
      glassRoots.clear();
      glassElements.clear();
      ambientRoots.clear();
      chatRoots.clear();
      restoreStore(glassStyles, [UNIVERSAL_GLASS_ATTR, UNIVERSAL_GLASS_CLEAR_ATTR]);
      restoreStore(homepageStyles);
      document.documentElement.removeAttribute("data-ytc-home-glass");
      document.documentElement.removeAttribute(LIBRARY_ATTR);
      document.querySelectorAll("[" + AMBIENT_BLOCKED_ATTR + "]").forEach(element =>
        element.removeAttribute(AMBIENT_BLOCKED_ATTR)
      );
    }

    return Object.freeze({ apply, handleMutations, scheduleUniversalGlass, dispose });
  }

  runtime.createSurfaceController = createSurfaceController;
  function buildLibrarySurfaceCss() {
    return `
      /* Give each library group and row its own rounded surface; retain native grids and list order. */
      html[data-ytc-theme] :is(${LIBRARY_PANEL_SELECTOR}, ${LIBRARY_CARD_SELECTOR},
        ${LIBRARY_HEADER_SELECTOR}, ${LIBRARY_HISTORY_CONTROLS_SELECTOR}) {
        box-sizing: border-box !important;
        min-width: 0 !important;
        max-width: 100% !important;
        border-radius: 16px !important;
      }
      html[data-ytc-theme] :is(${LIBRARY_PANEL_SELECTOR}, ${LIBRARY_HISTORY_CONTROLS_SELECTOR}) {
        padding: 12px !important;
        margin-bottom: 16px !important;
      }
      html[data-ytc-theme] :is(${LIBRARY_CARD_SELECTOR}) {
        padding: 10px !important;
      }
      html[data-ytc-theme][${LIBRARY_ATTR}] ytd-browse:not([hidden]) ytd-playlist-video-renderer {
        height: auto !important;
      }
      html[data-ytc-theme] :is(${LIBRARY_HEADER_SELECTOR}) {
        padding: 12px !important;
        margin-bottom: 12px !important;
      }
      html[data-ytc-theme][${LIBRARY_ATTR}] :is(ytd-tabbed-page-header, yt-page-header-view-model) {
        border-radius: 16px !important;
      }
      html[data-ytc-theme] :is(${LIBRARY_CARD_SELECTOR})
        :is(ytd-thumbnail, yt-thumbnail-view-model, yt-collection-thumbnail-view-model,
          .ytLockupViewModelContentImage, .yt-lockup-view-model-wiz__content-image,
          .shortsLockupViewModelHostThumbnailParentContainer) {
        max-width: 100% !important;
        border-radius: 12px !important;
        overflow: hidden !important;
      }
      html[data-ytc-theme] :is(${LIBRARY_CARD_SELECTOR})
        :is(yt-lockup-view-model > .ytLockupViewModelHost,
          ytm-shorts-lockup-view-model-v2 > ytm-shorts-lockup-view-model) {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      html[data-ytc-theme] :is(${LIBRARY_CARD_SELECTOR})
        :is(.ytLockupMetadataViewModelMenuButton, .yt-lockup-metadata-view-model-wiz__menu-button,
          .yt-lockup-metadata-view-model__menu-button) {
        translate: -6px 0 !important;
      }
      html[data-ytc-theme] :is(${LIBRARY_CARD_SELECTOR})
        .ytLockupMetadataViewModelHasMenuButton .ytLockupMetadataViewModelTextContainer {
        box-sizing: border-box !important;
        min-width: 0 !important;
        padding-inline-end: 36px !important;
      }
      html[data-ytc-theme] :is(${LIBRARY_CARD_SELECTOR})
        .ytLockupMetadataViewModelHasMenuButton .ytLockupMetadataViewModelTitle {
        padding-inline-end: 0 !important;
      }
      html[data-ytc-theme][${LIBRARY_ATTR}] :is(ytd-playlist-header-renderer,
        ytd-playlist-sidebar-renderer) #background::before,
      html[data-ytc-theme][${LIBRARY_ATTR}] :is(ytd-playlist-header-renderer,
        ytd-playlist-sidebar-renderer) #background::after {
        background: transparent !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
      }
    `;
  }
  function buildChannelSurfaceCss() {
    const channel = 'html[data-ytc-theme] ' + CHANNEL_SCOPE_SELECTOR;
    const videoGridCard = channel + ' ytd-rich-grid-renderer ytd-rich-item-renderer:not([is-slim-media])';
    const lockupMenu = ':is(.ytLockupMetadataViewModelMenuButton, ' +
      '.yt-lockup-metadata-view-model__menu-button, .yt-lockup-metadata-view-model-wiz__menu-button)';
    return `
      /* Each channel section owns its glass; its arrows stay below the sticky header. */
      html[data-ytc-theme] :is(${CHANNEL_PANEL_SELECTOR}) {
        box-sizing: border-box !important;
        min-width: 0 !important;
        padding: 12px !important;
        margin-bottom: 16px !important;
        border: 0 !important;
        border-radius: 16px !important;
        position: relative !important;
        isolation: isolate !important;
      }
      html[data-ytc-theme] :is(${CHANNEL_HEADER_SURFACE_SELECTOR}) {
        box-sizing: border-box !important;
        border-radius: 16px !important;
      }
      ${channel} :is(yt-page-header-renderer, ytd-c4-tabbed-header-renderer #channel-header) {
        padding: 12px !important;
      }
      ${channel} tp-yt-paper-tabs {
        padding-inline: 12px !important;
      }
      ${channel} ytd-section-list-renderer {
        padding-top: 16px !important;
      }
      ${channel} :is(ytd-two-column-browse-results-renderer,
        ytd-two-column-browse-results-renderer > #primary, ytd-section-list-renderer) {
        box-sizing: border-box !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      ${channel} :is(yt-image-banner-view-model, #banner.ytd-c4-tabbed-header-renderer) {
        border-radius: 16px !important;
        overflow: hidden !important;
      }
      html[data-ytc-theme] :is(${CHANNEL_CARD_SELECTOR}) {
        box-sizing: border-box !important;
        border-radius: 16px !important;
      }
      html[data-ytc-theme] :is(${CHANNEL_CARD_SELECTOR}):not(ytd-post-renderer) {
        padding: 10px !important;
      }
      /* Fit fixed-width carousel lockups within their new card padding. */
      ${channel} yt-lockup-view-model > .ytLockupViewModelHost,
      ${channel} ytm-shorts-lockup-view-model-v2 > ytm-shorts-lockup-view-model {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      ${channel} yt-horizontal-list-renderer #items > :is(${CHANNEL_CARD_TYPES}) {
        flex-shrink: 0 !important;
        align-self: stretch !important;
        height: auto !important;
        margin-inline-end: 12px !important;
      }
      ${channel} yt-horizontal-list-renderer #items {
        display: flex !important;
        width: max-content !important;
        align-items: stretch !important;
        padding-top: 0 !important;
        margin-bottom: 8px !important;
      }
      /* Keep the native sliding track, with equal card heights and inset controls. */
      ${channel} yt-horizontal-list-renderer :is(#scroll-outer-container, #scroll-container) {
        min-width: 0 !important;
        max-width: 100% !important;
      }
      ${channel} yt-horizontal-list-renderer #scroll-container {
        margin-top: 0 !important;
        border-radius: 12px !important;
      }
      ${channel} yt-horizontal-list-renderer #left-arrow {
        left: 20px !important;
      }
      ${channel} yt-horizontal-list-renderer #right-arrow {
        right: 20px !important;
      }
      /* Compact posts need room below the preview for the entire action bar. */
      ${channel} yt-horizontal-list-renderer ytd-post-renderer[uses-compact-lockup] {
        padding: 12px !important;
        min-height: 220px !important;
      }
      ${channel} yt-horizontal-list-renderer ytd-post-renderer[uses-compact-lockup]
        > #dismissible > #toolbar {
        margin-top: auto !important;
        padding-top: 8px !important;
        flex-shrink: 0 !important;
      }
      ${channel} yt-horizontal-list-renderer ytd-post-renderer[uses-compact-lockup] #action-buttons {
        flex: 1 !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      ${channel} yt-horizontal-list-renderer ytd-post-renderer[uses-compact-lockup] #action-buttons #toolbar {
        box-sizing: border-box !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      ${channel} ytd-item-section-renderer :is(ytd-shelf-renderer, ytd-reel-shelf-renderer,
        ytd-rich-shelf-renderer, grid-shelf-view-model) {
        border: 0 !important;
      }
      ${channel} :is(ytd-thumbnail, yt-thumbnail-view-model,
        .shortsLockupViewModelHostThumbnailParentContainer, ytd-backstage-image-renderer) {
        border-radius: 12px !important;
        overflow: hidden !important;
      }
      ${channel} ${lockupMenu} {
        translate: -6px 0 !important;
      }
      /* Give grid titles and badges their own space beside the overflow menu. */
      ${videoGridCard} :is(.ytLockupMetadataViewModelTextContainer,
        .yt-lockup-metadata-view-model__text-container, .yt-lockup-metadata-view-model-wiz__text-container) {
        flex: 1 !important;
        min-width: 0 !important;
      }
      ${videoGridCard} ${lockupMenu} {
        position: static !important;
        translate: none !important;
        transform: none !important;
        flex: 0 0 40px !important;
        align-self: flex-start !important;
        margin-inline-start: 8px !important;
        margin-top: -6px !important;
      }
      ${videoGridCard} ${lockupMenu} button {
        min-width: 40px !important;
        min-height: 40px !important;
      }
      ${videoGridCard} :is(.ytLockupMetadataViewModelTitle,
        .yt-lockup-metadata-view-model__title, .yt-lockup-metadata-view-model-wiz__title) {
        padding-inline-end: 0 !important;
      }
      ${channel} ytd-grid-video-renderer #menu {
        right: 0 !important;
      }
      ${channel} .ytGridShelfViewModelGridShelfBottomButtonContainer {
        position: static !important;
        transform: none !important;
        width: min(100%, 360px) !important;
        margin: 12px auto 0 !important;
        border-radius: 999px !important;
      }
      ${channel} :is(.ytPageHeaderViewModelTitle, .ytLockupMetadataViewModelTitle,
        .shortsLockupViewModelHostMetadataTitle, .shortsLockupViewModelHostMetadataTitle a,
        ytd-post-renderer #content-text, ytd-post-renderer #author-text) {
        color: var(--yt-spec-text-primary) !important;
      }
      ${channel} :is(.ytContentMetadataViewModelMetadataText,
        .ytContentMetadataViewModelMetadataText span, .shortsLockupViewModelHostMetadataSubhead) {
        color: var(--yt-spec-text-secondary) !important;
      }
    `;
  }
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
    /* Keep search content inside rounded video and channel result cards. */
    html[data-ytc-theme] ytd-search
      :is(ytd-video-renderer, ytd-channel-renderer, yt-lockup-view-model:not(ytd-video-renderer *)) {
      box-sizing: border-box !important;
      padding: 12px !important;
      border-radius: 16px !important;
    }
    html[data-ytc-theme] ytd-search :is(ytd-video-renderer, yt-lockup-view-model)
      :is(ytd-thumbnail, yt-thumbnail-view-model) {
      border-radius: 12px !important;
      overflow: hidden !important;
    }
    html[data-ytc-theme] :is(${SEARCH_SHORTS_SHELF_SELECTOR}) {
      box-sizing: border-box !important;
      padding: 12px !important;
      margin-block: 16px !important;
      border: 0 !important;
      border-radius: 16px !important;
    }
    html[data-ytc-theme] :is(${SEARCH_SHORTS_CARD_SELECTOR}) {
      box-sizing: border-box !important;
      padding: 8px !important;
      border-radius: 16px !important;
    }
    html[data-ytc-theme] :is(${SEARCH_SHORTS_CARD_SELECTOR}):not(ytd-reel-item-renderer) {
      width: 100% !important;
    }
    html[data-ytc-theme] :is(${SEARCH_SHORTS_SHELF_SELECTOR})
      :is(ytd-thumbnail, yt-thumbnail-view-model, .shortsLockupViewModelHostThumbnailParentContainer) {
      border-radius: 12px !important;
      overflow: hidden !important;
    }
    html[data-ytc-theme] :is(${SEARCH_SHORTS_FOOTER_SELECTOR}) {
      position: static !important;
      transform: none !important;
      width: min(100%, 360px) !important;
      margin: 12px auto 0 !important;
      border-radius: 999px !important;
    }
    /* Inset watch-panel contents and round the shared glass surface. */
    html[data-ytc-theme] :is(ytd-watch-flexy, ytd-watch-grid)
      :is(ytd-comments, ytd-watch-next-secondary-results-renderer) {
      box-sizing: border-box !important;
      padding: 12px !important;
      border-radius: 16px !important;
    }
    /* Clip inner content to the panel corners without changing its scroll containers. */
    html[data-ytc-theme] :is(ytd-live-chat-frame, yt-live-chat-renderer,
      ytd-playlist-panel-renderer, ytd-playlist-sidebar-renderer) {
      border-radius: 16px !important;
      overflow: clip !important;
    }
    html[data-ytc-theme] ytd-live-chat-frame :is(#chat, iframe) {
      border-radius: 16px !important;
    }
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_CLEAR_SELECTOR}) {
      background: transparent !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
    }
    html[data-ytc-theme] :is(${SHARED_BACKDROP_SELECTOR}) {
      backdrop-filter: none !important;
    }
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_TARGET_SELECTOR}):is(ytd-masthead:has(> #background)) {
      backdrop-filter: none !important;
    }
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_CLEAR_SELECTOR}):is(${FROSTED_WRAPPER_SELECTOR}) {
      backdrop-filter: ${GLASS_BACKDROP} !important;
    }
    html[data-ytc-theme] :is(${UNIVERSAL_GLASS_CLEAR_SELECTOR}):is(${MASTHEAD_BACKDROP_SELECTOR}) {
      display: block !important;
      opacity: 1 !important;
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
    ${buildChannelSurfaceCss()}
    ${buildLibrarySurfaceCss()}
  `;
  runtime.surfaceVersion = YTCustomizer.version;
})();
