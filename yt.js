// Applies saved appearance, player, and layout settings to YouTube pages.
(() => {
  const {
    version: SCRIPT_VERSION, defaults: DEFAULT_SETTINGS, assetDefaults,
    normalize, normalizeAssets, iconDataUri
  } = YTCustomizer;
  const runtime = globalThis.YTCustomizerContent;
  if (!runtime?.createSurfaceController || !runtime?.createShortsController) return;

  const INSTANCE_KEY = "__ytProgressCustomizer";
  const previous = globalThis[INSTANCE_KEY];
  if (previous?.version === SCRIPT_VERSION) return;
  previous?.dispose();

  let currentSettings = { ...DEFAULT_SETTINGS };
  let currentAssets = { ...assetDefaults };
  let styleEl = document.getElementById("yt-custom-progress-style");
  let stateRevision = 0;
  let disposed = false;
  let stylesApplied = false;
  let sidebarTimer = 0;

  // Current recommendation cards mount their hover player in a portal outside the thumbnail.
  // Use the same scopes for hiding preview UI and stopping its media, including animated images.
  const PREVIEW_SURFACE_SELECTOR = [
    "ytd-video-preview", ".ytdVideoPreviewHost",
    "ytd-video-preview-loader", ".ytdVideoPreviewLoaderHost",
    "ytd-video-preview-portal", ".ytdVideoPreviewPortalHost",
    ".ytdVideoPreviewPlayerContainerWrapper", ".ytdVideoPreviewPortalPlayerHoldingContainer",
    "ytd-thumbnail #inline-player", "ytd-thumbnail #video-preview", "ytd-thumbnail #mouseover-overlay",
    "ytd-thumbnail-overlay-loading-preview-renderer", "ytd-moving-thumbnail-renderer",
    "yt-animated-thumbnail", "yt-animated-thumbnail-overlay-view-model",
    ".ytAnimatedThumbnailOverlayViewModelHost", ".ytp-inline-preview"
  ].join(",");
  const PREVIEW_MEDIA_SCOPE_SELECTOR = [
    PREVIEW_SURFACE_SELECTOR, "ytd-thumbnail", "yt-thumbnail-view-model", ".ytThumbnailViewModelHost",
    "ytd-compact-video-renderer", "yt-lockup-view-model", "#inline-player", "#inline-preview-player", "#video-preview"
  ].join(",");
  const PRIMARY_PLAYER_SELECTOR = "#movie_player, #shorts-player, ytd-reel-video-renderer, ytd-miniplayer";
  const PREVIEW_MEDIA_EVENTS = ["play", "playing", "loadeddata"];

  function rgba(hex, opacity) {
    return "rgba(" + [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(",") + "," + opacity + ")";
  }

  function isDark(hex) {
    const [red, green, blue] = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
    return red * 0.299 + green * 0.587 + blue * 0.114 < 145;
  }

  function buildPlayerCss(settings, customIconData) {
    const thumbUri = iconDataUri(settings.thumbStyle, settings.thumbColor, customIconData);
    const halfThumb = settings.thumbSize / 2;
    const progressTargets = "html body .ytp-play-progress, html body .ytp-hover-progress";
    const animation = settings.reduceAnimations ? "none" : "ytc-progress-pulse 1.1s ease-in-out infinite alternate";
    let effectCss = "";
    if (settings.progressEffect === "pulse") {
      effectCss = `
        ${progressTargets} {
          box-shadow: 0 0 6px 2px ${settings.progressColor}, 0 0 18px ${settings.progressColor} !important;
          animation: ${animation} !important;
        }
        @keyframes ytc-progress-pulse {
          from { filter: brightness(.7) drop-shadow(0 0 1px ${settings.progressColor}); }
          to { filter: brightness(1.65) drop-shadow(0 0 14px ${settings.progressColor}); }
        }
      `;
    } else if (settings.progressEffect === "shimmer") {
      effectCss = `
        ${progressTargets} {
          background-color: transparent !important;
          background-image: linear-gradient(110deg, transparent 25%, rgba(255,255,255,.8) 49%, transparent 72%),
            linear-gradient(${settings.progressColor}, ${settings.progressColor}) !important;
          background-size: 220% 100%, 100% 100% !important;
          animation: ${settings.reduceAnimations ? "none" : "ytc-progress-shimmer 2s linear infinite"} !important;
        }
        @keyframes ytc-progress-shimmer {
          from { background-position: -100% 0, 0 0; }
          to { background-position: 100% 0, 0 0; }
        }
      `;
    } else if (settings.progressEffect === "rainbow") {
      effectCss = `
        ${progressTargets} {
          background-color: transparent !important;
          background-image: linear-gradient(90deg, #ff1744, #ff9100, #ffea00, #00e676, #00b0ff, #651fff, #f500e8, #ff1744) !important;
          background-size: 200% 100% !important;
          animation: ${settings.reduceAnimations ? "none" : "ytc-rainbow-shift 4s linear infinite"} !important;
        }
        @keyframes ytc-rainbow-shift {
          to { background-position: 200% 0; }
        }
      `;
    }
    return `
      html body .ytp-swatch-background-color,
      html body .ytp-play-progress,
      html body .ytp-hover-progress,
      html body .ytp-volume-slider-handle::before { background: ${settings.progressColor} !important; }

      html body .ytp-load-progress,
      html body .ytp-progress-list .ytp-load-progress { background: ${settings.bufferColor} !important; }

      html body .ytp-progress-list {
        height: ${settings.barHeight}px !important;
        transform: translateY(-${Math.max(0, Math.round((settings.barHeight - 4) / 2))}px);
        border-radius: 999px !important;
        overflow: visible !important;
      }

      html body .ytp-play-progress,
      html body .ytp-load-progress,
      html body .ytp-hover-progress { height: ${settings.barHeight}px !important; border-radius: 999px !important; }

      html body .html5-video-player .ytp-scrubber-button {
        width: ${settings.thumbSize}px !important;
        height: ${settings.thumbSize}px !important;
        margin-left: -${halfThumb}px !important;
        margin-top: -${Math.max(0, halfThumb - settings.barHeight / 2)}px !important;
        border-radius: 0 !important;
        background: transparent url("${thumbUri}") center / contain no-repeat !important;
        box-shadow: none !important;
        transform: scale(1) !important;
        transition: transform 140ms ease !important;
      }

      html body .html5-video-player .ytp-decorated-scrubber-button { display: none !important; }
      html body .html5-video-player .ytp-progress-bar-container:hover .ytp-scrubber-button,
      html body .html5-video-player .ytp-progress-bar-container:focus-within .ytp-scrubber-button { transform: scale(1.14) !important; }
      html body .ytp-chrome-bottom .ytp-progress-bar-container { --yt-custom-progress-color: ${settings.progressColor}; }
      ${effectCss}
    `;
  }

  function buildAppearanceCss(settings, assets) {
    if (!settings.themeEnabled) return "";
    const { pageColor: page, surfaceColor: surface, textColor: text, accentColor: accent } = settings;
    const wallpaper = settings.backgroundMode === "image" && assets.backgroundImageData;
    const panel = "var(--ytc-ui-background)";
    const chatPanel = panel;
    const navigationPanel = panel;
    const universalGlass = panel;
    const controlFill = rgba(text, "var(--ytc-ui-opacity)");
    const muted = "color-mix(in srgb, " + text + " 70%, " + surface + ")";
    const shade = rgba(page, 1 - settings.backgroundOpacity / 100);
    const image = wallpaper ? 'linear-gradient(' + shade + ', ' + shade + '), url("' + assets.backgroundImageData + '")' : "none";
    const fit = settings.backgroundFit === "tile" ? "auto" : settings.backgroundFit;
    const repeat = settings.backgroundFit === "tile" ? "repeat" : "no-repeat";
    return `
      html[data-ytc-theme] {
        --ytc-ui-background: ${rgba(surface, "var(--ytc-ui-opacity)")} !important;
        --yt-spec-base-background: ${panel} !important;
        --yt-spec-raised-background: ${panel} !important;
        --yt-spec-menu-background: ${panel} !important;
        --yt-spec-brand-background-primary: ${panel} !important;
        --yt-spec-brand-background-secondary: ${panel} !important;
        --yt-spec-brand-background-solid: ${panel} !important;
        --yt-spec-general-background-a: ${panel} !important;
        --yt-spec-general-background-b: ${panel} !important;
        --yt-spec-general-background-c: ${panel} !important;
        --yt-spec-text-primary: ${text} !important;
        --yt-spec-text-secondary: ${muted} !important;
        --yt-spec-text-disabled: ${muted} !important;
        --yt-spec-text-primary-inverse: ${page} !important;
        --yt-spec-icon-active-other: ${text} !important;
        --yt-spec-icon-inactive: ${muted} !important;
        --yt-spec-call-to-action: ${accent} !important;
        --yt-spec-themed-blue: ${accent} !important;
        --yt-spec-badge-chip-background: ${controlFill} !important;
        --yt-spec-10-percent-layer: ${controlFill} !important;
        --yt-spec-additive-background: ${controlFill} !important;
        --yt-spec-outline: ${rgba(text, 0.25)} !important;
        --ytd-searchbox-background: ${panel} !important;
        --ytd-searchbox-legacy-border-color: ${rgba(text, 0.3)} !important;
        --ytd-searchbox-text-color: ${text} !important;
        --ytd-searchbox-legacy-button-color: ${panel} !important;
        --ytd-searchbox-legacy-button-border-color: ${rgba(text, 0.3)} !important;
        --ytc-live-chat-panel: ${chatPanel} !important;
        --ytc-navigation-panel: ${navigationPanel} !important;
        --ytc-universal-glass: ${universalGlass} !important;
        color-scheme: ${isDark(page) ? "dark" : "light"} !important;
        background-color: ${page} !important;
        background-image: ${image} !important;
        background-position: center center !important;
        background-size: ${fit} !important;
        background-repeat: ${repeat} !important;
        background-attachment: fixed !important;
      }

      html[data-ytc-theme][data-ytc-chat-frame] {
        background: transparent !important;
      }

      html[data-ytc-theme] body,
      html[data-ytc-theme] :is(ytd-app, ytd-page-manager, ytd-browse, ytd-search,
        ytd-watch-flexy, ytd-rich-grid-renderer, ytd-two-column-browse-results-renderer) {
        background: transparent !important;
        color: ${text} !important;
      }

      html[data-ytc-theme] :is(ytd-masthead, ytd-mini-guide-renderer, ytd-guide-renderer) {
        background: ${navigationPanel} !important;
        color: ${text} !important;
      }
      html[data-ytc-theme] :is(ytd-masthead #background, ytd-masthead #masthead-container,
        ytd-guide-renderer #guide, ytd-guide-renderer #guide-inner-content,
        ytd-mini-guide-renderer #guide-content, ytd-feed-filter-chip-bar-renderer,
        ytd-feed-filter-chip-bar-renderer #chips-wrapper, yt-chip-cloud-renderer) {
        background: ${navigationPanel} !important;
        background-image: none !important;
      }
      html[data-ytc-theme] :is(ytd-masthead #container, ytd-guide-renderer #sections,
        ytd-guide-renderer #footer, ytd-mini-guide-renderer #items) { background: transparent !important; }

      html[data-ytc-theme] :is(ytd-watch-metadata #description,
        ytd-feed-nudge-renderer #content-wrapper, tp-yt-app-drawer #contentContainer) {
        background: ${panel} !important;
        color: ${text} !important;
      }
      html[data-ytc-theme] :is(yt-live-chat-renderer, ytd-live-chat-frame, ytd-live-chat-frame #chat) {
        background: ${chatPanel} !important;
        color: ${text} !important;
      }
      html[data-ytc-theme] :is(yt-live-chat-app, yt-live-chat-renderer #contents,
        yt-live-chat-renderer #panel-pages, yt-live-chat-renderer #item-scroller,
        yt-live-chat-renderer #items, yt-live-chat-renderer #chat-messages,
        yt-live-chat-header-renderer, yt-live-chat-banner-manager,
        yt-live-chat-message-input-renderer, yt-live-chat-text-message-renderer,
        yt-live-chat-viewer-engagement-message-renderer, yt-live-chat-membership-item-renderer) {
        background: transparent !important;
        color: ${text} !important;
      }

      html[data-ytc-theme] :is(ytd-tabbed-page-header, ytd-tabbed-page-header #page-header-container,
        ytd-tabbed-page-header #page-header, ytd-tabbed-page-header #tabs-container,
        ytd-tabbed-page-header #tabs-inner-container, ytd-c4-tabbed-header-renderer,
        ytd-c4-tabbed-header-renderer #channel-header, ytd-c4-tabbed-header-renderer #tabs-container,
        yt-page-header-renderer, yt-page-header-view-model) { background: transparent !important; }

      html[data-ytc-theme] ytd-browse[page-subtype="playlist"] :is(#header,
        ytd-tabbed-page-header, ytd-tabbed-page-header #page-header-container,
        ytd-tabbed-page-header #page-header, yt-page-header-renderer, yt-page-header-view-model,
        .ytPageHeaderViewModelBackground, cinematic-container-view-model, ytd-playlist-sidebar-renderer,
        ytd-playlist-sidebar-primary-info-renderer, ytd-playlist-sidebar-secondary-info-renderer,
        yt-lockup-view-model, yt-touch-feedback-shape, .ytSpecTouchFeedbackShapeFill,
        .ytSpecTouchFeedbackShapeHoverEffect) { background: transparent !important; box-shadow: none !important; }
      html[data-ytc-custom-background] :is(ytd-browse[page-subtype="playlist"],
        ytd-playlist-panel-renderer, ytd-watch-flexy ytd-playlist-panel-renderer) :where(*):not(img):not(video):not(canvas) {
        background-color: transparent !important;
        box-shadow: none !important;
      }
      html[data-ytc-custom-background] :is(ytd-browse[page-subtype="playlist"] cinematic-container-view-model,
        ytd-browse[page-subtype="playlist"] .ytPageHeaderViewModelBackground,
        ytd-playlist-panel-renderer #header, ytd-playlist-panel-renderer #items,
        ytd-playlist-panel-renderer #contents) { background-image: none !important; }

      html[data-ytc-theme] :is(ytd-multi-page-menu-renderer, ytd-menu-popup-renderer) {
        background: ${panel} !important;
        color: ${text} !important;
      }
      html[data-ytc-theme] :is(ytd-add-to-playlist-renderer, ytd-playlist-add-to-option-renderer,
        yt-dialog-view-model, yt-sheet-view-model, [role="dialog"]) { color: ${text} !important; }
      html[data-ytc-theme] :is(#video-title, #video-title-link, ytd-watch-metadata h1,
        ytd-comments #content-text, ytd-guide-entry-renderer yt-formatted-string,
        yt-lockup-metadata-view-model h3, .ytLockupMetadataViewModelTitle,
        ytd-guide-entry-renderer #endpoint, ytd-mini-guide-entry-renderer #endpoint,
        yt-shelf-header-layout h2, .ytShelfHeaderLayoutTitle, ytd-comments #author-text,
        ytd-comments #count, ytd-comments #simplebox-placeholder,
        ytd-feed-nudge-renderer yt-formatted-string) { color: ${text} !important; }
      html[data-ytc-theme] :is(#metadata-line, #channel-name, #owner-sub-count,
        .ytContentMetadataViewModelMetadataRow, .ytContentMetadataViewModelMetadataText,
        .ytContentMetadataViewModelMetadataText a, ytd-comments #published-time-text) { color: ${muted} !important; }
      html[data-ytc-theme] :is(ytd-masthead yt-icon-button, ytd-masthead yt-icon,
        ytd-guide-renderer yt-icon, ytd-mini-guide-renderer yt-icon, yt-searchbox) { color: ${text} !important; }
      html[data-ytc-theme] ytd-topbar-logo-renderer [id^="youtube-paths"] { fill: ${text} !important; }
      html[data-ytc-theme] :is(.ytSearchboxComponentInputContainer, .ytSearchboxComponentInputBox,
        .ytSearchboxComponentSearchButton, .ytSearchboxComponentSuggestionsContainer) {
        background-color: ${panel} !important;
        color: ${text} !important;
        border-color: ${rgba(text, 0.3)} !important;
      }
      html[data-ytc-theme] yt-searchbox input[type="text"] { color: ${text} !important; }
      html[data-ytc-theme] yt-searchbox input::placeholder { color: ${muted} !important; }
      html[data-ytc-theme] :is(ytd-masthead, ytd-watch-metadata, ytd-comments)
        :is(.ytSpecButtonShapeNextTonal, .ytSpecButtonShapeNextText) {
        color: ${text} !important;
        background-color: ${controlFill} !important;
      }
      html[data-ytc-theme] :is(ytd-masthead, ytd-watch-metadata, ytd-comments)
        .ytSpecButtonShapeNextOutline { color: ${accent} !important; border-color: ${rgba(text, 0.3)} !important; }
      html[data-ytc-theme] :is(ytd-watch-metadata #description a, ytd-comments #content-text a) { color: ${accent} !important; }
      html[data-ytc-theme] yt-chip-cloud-chip-renderer[selected] {
        --ytc-universal-glass: ${rgba(accent, "var(--ytc-ui-opacity)")} !important;
        background-color: ${rgba(accent, "var(--ytc-ui-opacity)")} !important;
        color: ${text} !important;
      }

      html[data-ytc-custom-background] ytd-watch-flexy :is(#cinematics, #cinematics-container,
        #cinematics-full-bleed-container),
      html[data-ytc-custom-background] [data-ytc-ambient-blocked] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        content-visibility: hidden !important;
        animation: none !important;
        pointer-events: none !important;
      }

      /* Direct inline styles and pseudo layers both get neutralized for YouTube's late black repaint. */
      html[data-ytc-custom-background] [data-ytc-universal-glass] {
        background: var(--ytc-universal-glass) !important;
        background-color: var(--ytc-universal-glass) !important;
        background-image: none !important;
        box-shadow: none !important;
      }
      html[data-ytc-custom-background] [data-ytc-universal-glass]::before,
      html[data-ytc-custom-background] [data-ytc-universal-glass]::after {
        background: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
        filter: none !important;
      }
      html[data-ytc-custom-background] :is(ytd-masthead #background, ytd-masthead #masthead-container,
        ytd-feed-filter-chip-bar-renderer, ytd-feed-filter-chip-bar-renderer #chips-wrapper,
        yt-chip-cloud-renderer) {
        background: var(--ytc-universal-glass) !important;
        background-color: var(--ytc-universal-glass) !important;
        background-image: none !important;
      }
      html[data-ytc-custom-background] :is(ytd-masthead #background, ytd-masthead #masthead-container)::before,
      html[data-ytc-custom-background] :is(ytd-masthead #background, ytd-masthead #masthead-container)::after,
      html[data-ytc-custom-background] ytd-masthead #gradient {
        background: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
        opacity: 0 !important;
      }
      html[data-ytc-custom-background] [data-ytc-universal-clear] {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
      }
      html[data-ytc-custom-background] [data-ytc-universal-clear]::before,
      html[data-ytc-custom-background] [data-ytc-universal-clear]::after {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
        filter: none !important;
        opacity: 0 !important;
      }

      html[data-ytc-shorts-clean] :is(ytd-shorts, #shorts-container, #shorts-inner-container,
        ytd-reel-video-renderer, #shorts-player, #shorts-player .html5-video-container,
        ytd-masthead, ytd-masthead #background, ytd-masthead #gradient) { background: transparent !important; box-shadow: none !important; }
      @layer ytc-shorts-overrides {
        html[data-ytc-shorts-clean] [data-ytc-shorts-layer~="before"]::before,
        html[data-ytc-shorts-clean] [data-ytc-shorts-layer~="after"]::after {
          background: transparent !important;
          box-shadow: none !important;
          filter: none !important;
          mask-image: none !important;
        }
      }
      html[data-ytc-shorts-clean] :fullscreen::backdrop { background: transparent !important; }
      html[data-ytc-shorts-clean] :is(#shorts-player .ytp-gradient-top, #shorts-player .ytp-gradient-bottom,
        #shorts-player .ytReelPlayerHeaderViewModelGradient,
        #shorts-player .ytReelPlayerOverlayViewModelTopGradient, #shorts-player [class*="gradient" i],
        #shorts-player [id*="gradient" i], ytd-shorts [class*="top-gradient" i],
        ytd-shorts [class*="topgradient" i]) {
        background: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
        filter: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      html[data-ytc-shorts-clean] #shorts-player { isolation: isolate !important; }
      html[data-ytc-shorts-clean] #shorts-player .ytc-shorts-gutter-mask {
        position: absolute !important;
        top: 0 !important;
        bottom: 0 !important;
        display: block !important;
        z-index: 2 !important;
        pointer-events: none !important;
        background-color: ${page} !important;
        background-image: ${image} !important;
        background-position: center center !important;
        background-size: ${fit} !important;
        background-repeat: ${repeat} !important;
        background-attachment: fixed !important;
      }
      html[data-ytc-shorts-clean] #shorts-player video { z-index: 1 !important; }
      html[data-ytc-shorts-clean] #shorts-player :is(.ytp-chrome-top, .ytp-chrome-bottom, .ytp-popup, button, [role="button"]) {
        position: relative !important;
        z-index: 3 !important;
      }
    `;
  }

  function buildLayoutCss(settings) {
    const hidden = [];
    if (settings.hideShorts) hidden.push(
      "ytd-reel-shelf-renderer", "ytd-rich-shelf-renderer[is-shorts]",
      "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
      "grid-shelf-view-model:has(ytm-shorts-lockup-view-model)",
      "grid-shelf-view-model:has(ytm-shorts-lockup-view-model-v2)",
      "ytd-guide-entry-renderer:has(a[href^='/shorts'])",
      "ytd-mini-guide-entry-renderer:has(a[href^='/shorts'])",
      "ytm-shorts-lockup-view-model", "ytm-shorts-lockup-view-model-v2"
    );
    if (settings.hideHomeTopicBar) hidden.push(
      "ytd-feed-filter-chip-bar-renderer",
      "yt-chip-cloud-renderer:has(yt-chip-cloud-chip-renderer)",
      "ytd-browse #chips-wrapper",
      "ytd-search #chips-wrapper",
      "ytd-two-column-browse-results-renderer #chips-wrapper"
    );
    if (settings.hideCreateButton) hidden.push(
      'ytd-masthead #buttons > ytd-button-renderer:has([aria-label*="Create"], [title*="Create"])',
      'ytd-masthead #buttons > yt-button-view-model:has([aria-label*="Create"], [title*="Create"])',
      'ytd-masthead #buttons ytd-topbar-menu-button-renderer:has([aria-label*="Create"], [title*="Create"])'
    );
    if (settings.hideNotificationsButton) hidden.push(
      "ytd-masthead #buttons ytd-notification-topbar-button-renderer"
    );
    if (settings.hideSidebarSubscriptions) hidden.push('ytd-guide-section-renderer[data-ytc-hide-section="subscriptions"]');
    if (settings.hideSidebarYou) hidden.push('ytd-guide-section-renderer[data-ytc-hide-section="you"]');
    if (settings.hideSidebarExplore) hidden.push('ytd-guide-section-renderer[data-ytc-hide-section="explore"]');
    if (settings.hideSidebarMoreFromYouTube) hidden.push('ytd-guide-section-renderer[data-ytc-hide-section="more-youtube"]');
    if (settings.hideSidebarReportHistory) hidden.push('ytd-guide-renderer ytd-guide-entry-renderer:has(#endpoint[href="/reporthistory"])');
    if (settings.hideRelated) hidden.push("ytd-watch-next-secondary-results-renderer", "ytd-watch-flexy #related");
    if (settings.hideComments) hidden.push("ytd-watch-flexy ytd-comments");
    if (settings.hideChat) hidden.push("ytd-watch-flexy ytd-live-chat-frame");
    const rules = [];
    const watchRelated = "html body :is(ytd-watch-flexy, ytd-watch-grid) :is(#related, ytd-watch-next-secondary-results-renderer)";
    if (hidden.length) rules.push(hidden.map(selector => "html body " + selector).join(",\n") + " { display: none !important; }");
    // The thumbnail's decorative feedback layer fades/scales in on hover using its palette color.
    // Keep the image, link, action buttons, and keyboard focus indicators available.
    rules.push(`
      ${watchRelated} :is(.ytSpecTouchFeedbackShapeThumbnailSizeSmall,
        .ytSpecTouchFeedbackShapeThumbnailSizeMedium,
        .ytSpecTouchFeedbackShapeThumbnailSizeLarge) .ytSpecTouchFeedbackShapeHoverEffect,
      ${watchRelated} :is(ytd-thumbnail, yt-thumbnail-view-model, .ytThumbnailViewModelHost,
        .ytLockupViewModelContentImage, .yt-lockup-view-model__content-image,
        .yt-lockup-view-model-wiz__content-image)
        .ytSpecTouchFeedbackShapeHoverEffect:not(.ytSpecButtonShapeNextHost *) {
        display: none !important;
        opacity: 0 !important;
        animation: none !important;
        transition: none !important;
        will-change: auto !important;
      }
      ${watchRelated} .ytThumbnailViewModelHighlightEffect {
        box-shadow: none !important;
      }
    `);
    rules.push(`
      html body :is(#related, ytd-watch-next-secondary-results-renderer) :is(
        yt-lockup-view-model a.yt-lockup-view-model__content-image,
        yt-lockup-view-model a.ytLockupViewModelContentImage,
        yt-lockup-view-model a[style*="width"],
        yt-lockup-view-model .yt-lockup-view-model-wiz__content-image,
        yt-lockup-view-model .ytLockupViewModelContentImage,
        ytd-compact-video-renderer ytd-thumbnail,
        ytd-compact-video-renderer #thumbnail,
        ytd-rich-grid-media #thumbnail
      ) {
        width: ${settings.relatedThumbnailWidth}px !important;
        min-width: ${settings.relatedThumbnailWidth}px !important;
        max-width: ${settings.relatedThumbnailWidth}px !important;
        flex: 0 0 ${settings.relatedThumbnailWidth}px !important;
        aspect-ratio: 16 / 9 !important;
      }
    `);
    if (settings.disableVideoPreviews) rules.push(`
      html[data-ytc-disable-video-previews] :is(${PREVIEW_SURFACE_SELECTOR}),
      html[data-ytc-disable-video-previews] :is(${PREVIEW_MEDIA_SCOPE_SELECTOR})
        video:not(:is(${PRIMARY_PLAYER_SELECTOR}) video) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `);
    return rules.join("\n");
  }

  function buildGridCss(settings) {
    return `
      @media (min-width: 1024px) {
        html body ytd-rich-grid-renderer,
        html body ytd-rich-grid-renderer #contents {
          --ytd-rich-grid-items-per-row: ${settings.videosPerRow} !important;
          --ytd-rich-grid-posts-per-row: ${settings.videosPerRow} !important;
          --ytd-rich-grid-slim-items-per-row: ${settings.videosPerRow} !important;
          --ytd-rich-grid-game-cards-per-row: ${settings.videosPerRow} !important;
          --ytd-rich-grid-mini-game-cards-per-row: ${settings.videosPerRow} !important;
          --ytd-rich-grid-channel-items-per-row: ${settings.videosPerRow} !important;
          --ytd-rich-grid-item-min-width: 0px !important;
          --ytd-rich-grid-item-margin: 12px !important;
        }
      }
    `;
  }

  function syncSidebarSections() {
    const sections = document.querySelectorAll("ytd-guide-renderer ytd-guide-section-renderer");
    for (const section of sections) {
      const title = section.querySelector("#guide-section-title")?.textContent.trim().toLowerCase();
      const endpoints = section.querySelectorAll("#endpoint");
      const containsHref = suffix => [...endpoints].some(endpoint => endpoint.getAttribute("href") === suffix);
      const containsHost = host => [...endpoints].some(endpoint => endpoint.href.startsWith(host));
      const sectionKey = title === "subscriptions" || containsHref("/feed/subscriptions") ? "subscriptions" :
        title === "you" || containsHref("/feed/you") ? "you" :
        title === "explore" ? "explore" :
        title === "more from youtube" || containsHost("https://www.youtube.com/premium") ||
          containsHost("https://music.youtube.com/") || containsHost("https://www.youtubekids.com/") ? "more-youtube" : "";
      if (sectionKey) section.setAttribute("data-ytc-hide-section", sectionKey);
      else section.removeAttribute("data-ytc-hide-section");
    }
  }

  function buildEffectsCss(settings) {
    if (!settings.reduceAnimations) return "";
    return `
      html[data-ytc-reduced-effects] :is(ytd-thumbnail, yt-image, ytd-rich-item-renderer,
        ytd-rich-shelf-renderer, ytd-reel-video-renderer, ytd-shorts, ytd-popup-container,
        tp-yt-paper-dialog, ytd-menu-popup-renderer, ytd-multi-page-menu-renderer,
        ytd-feed-filter-chip-bar-renderer, yt-chip-cloud-chip-renderer,
        ytd-engagement-panel-section-list-renderer, .ytp-popup, .ytp-gradient-top,
        .ytp-gradient-bottom) {
        animation: none !important;
        transition: none !important;
      }
      html[data-ytc-reduced-effects] :is(ytd-thumbnail, yt-image, ytd-rich-item-renderer,
        ytd-rich-shelf-renderer, ytd-reel-video-renderer, ytd-shorts, ytd-popup-container,
        tp-yt-paper-dialog, ytd-menu-popup-renderer, ytd-multi-page-menu-renderer,
        ytd-feed-filter-chip-bar-renderer, yt-chip-cloud-chip-renderer,
        ytd-engagement-panel-section-list-renderer, .ytp-popup, .ytp-gradient-top,
        .ytp-gradient-bottom)::before,
      html[data-ytc-reduced-effects] :is(ytd-thumbnail, yt-image, ytd-rich-item-renderer,
        ytd-rich-shelf-renderer, ytd-reel-video-renderer, ytd-shorts, ytd-popup-container,
        tp-yt-paper-dialog, ytd-menu-popup-renderer, ytd-multi-page-menu-renderer,
        ytd-feed-filter-chip-bar-renderer, yt-chip-cloud-chip-renderer,
        ytd-engagement-panel-section-list-renderer, .ytp-popup, .ytp-gradient-top,
        .ytp-gradient-bottom)::after {
        animation: none !important;
        transition: none !important;
      }
    `;
  }

  const surfaces = runtime.createSurfaceController();
  const shorts = runtime.createShortsController(() => surfaces.scheduleUniversalGlass(true));

  function applyStyles(settings, assets = currentAssets) {
    if (disposed) return;
    const nextSettings = normalize(settings);
    const assetsUnchanged = Object.keys(assetDefaults).every(key => assets[key] === currentAssets[key]);
    const surfaceTokensOnly = stylesApplied && styleEl?.isConnected && assetsUnchanged &&
      Object.keys(DEFAULT_SETTINGS).every(key => ["uiOpacity", "uiBlur"].includes(key) || nextSettings[key] === currentSettings[key]);
    currentSettings = nextSettings;
    if (!assetsUnchanged) currentAssets = normalizeAssets(assets);
    // Sliders update inherited tokens without surface scans or replacing the main stylesheet.
    const surfaceTokens = {
      "--ytc-ui-opacity": String(currentSettings.uiOpacity / 100),
      "--ytc-ui-blur": currentSettings.uiBlur + "px",
      "--ytc-ui-backdrop": currentSettings.uiBlur > 0 ? "blur(var(--ytc-ui-blur))" : "none"
    };
    for (const [property, value] of Object.entries(surfaceTokens)) {
      if (currentSettings.themeEnabled) {
        if (document.documentElement.style.getPropertyValue(property) !== value) {
          document.documentElement.style.setProperty(property, value, "important");
        }
      } else {
        document.documentElement.style.removeProperty(property);
      }
    }
    document.documentElement.toggleAttribute("data-ytc-blur", currentSettings.themeEnabled && currentSettings.uiBlur > 0);
    if (surfaceTokensOnly) return;
    document.documentElement.toggleAttribute("data-ytc-theme", currentSettings.themeEnabled);
    document.documentElement.toggleAttribute("data-ytc-chat-frame",
      window !== window.top && /^\/live_chat(?:_replay)?(?:\/|$)/.test(location.pathname));
    const hasCustomBackground = currentSettings.themeEnabled &&
      currentSettings.backgroundMode === "image" && Boolean(currentAssets.backgroundImageData);
    document.documentElement.toggleAttribute("data-ytc-custom-background", hasCustomBackground);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "yt-custom-progress-style";
    }
    if (!styleEl.isConnected) document.documentElement.appendChild(styleEl);
    const css = buildPlayerCss(currentSettings, currentAssets.customIconData) +
      buildAppearanceCss(currentSettings, currentAssets) +
      (runtime.buildHomepageGlassCss?.() || "") + (runtime.buildSurfaceCss?.() || "") + buildLayoutCss(currentSettings) +
      buildEffectsCss(currentSettings) + buildGridCss(currentSettings);
    if (styleEl.textContent !== css) styleEl.textContent = css;
    document.documentElement.toggleAttribute("data-ytc-reduced-effects", currentSettings.reduceAnimations);
    document.documentElement.toggleAttribute("data-ytc-disable-video-previews", currentSettings.disableVideoPreviews);
    stopActiveThumbnailPreviews();
    syncSidebarSections();
    shorts.sync();
    surfaces.apply();
    stylesApplied = true;
  }

  async function loadSettings() {
    const revision = stateRevision;
    const [assets, settings] = await Promise.all([
      chrome.storage.local.get(assetDefaults), chrome.storage.sync.get(DEFAULT_SETTINGS)
    ]);
    if (disposed) return;
    if (revision !== stateRevision) return loadSettings();
    applyStyles(settings, assets);
  }

  const ready = loadSettings().catch(() => applyStyles(currentSettings));

  function stopPreviewVideo(video) {
    if (!currentSettings.disableVideoPreviews || !(video instanceof HTMLVideoElement) ||
        video.paused || video.closest(PRIMARY_PLAYER_SELECTOR)) return;
    if (video.closest(PREVIEW_MEDIA_SCOPE_SELECTOR)) video.pause();
  }

  function stopThumbnailPreview(event) {
    stopPreviewVideo(event.target);
  }

  function stopActiveThumbnailPreviews(root = document) {
    if (!currentSettings.disableVideoPreviews) return;
    if (root instanceof HTMLVideoElement) stopPreviewVideo(root);
    root.querySelectorAll("video").forEach(stopPreviewVideo);
  }

  function handlePreviewMutations(records) {
    if (!currentSettings.disableVideoPreviews) return;
    const roots = new Set();
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.addedNodes) if (node instanceof Element) roots.add(node);
      } else if (record.attributeName === "class" && record.target instanceof Element &&
          record.target.matches(PREVIEW_MEDIA_SCOPE_SELECTOR)) {
        roots.add(record.target);
      }
    }
    // A pooled player can already be playing when YouTube moves it into a preview portal.
    for (const root of roots) {
      if (!root.isConnected) continue;
      let nested = false;
      for (let parent = root.parentElement; parent; parent = parent.parentElement) {
        if (roots.has(parent)) { nested = true; break; }
      }
      if (!nested) stopActiveThumbnailPreviews(root);
    }
  }

  function onStorageChanged(changes, area) {
    if (area === "local" && Object.keys(assetDefaults).some(key => key in changes)) {
      stateRevision++;
      const assets = { ...currentAssets };
      for (const key of Object.keys(assetDefaults)) if (key in changes) assets[key] = changes[key].newValue ?? "";
      applyStyles(currentSettings, assets);
    } else if (area === "sync" && Object.keys(DEFAULT_SETTINGS).some(key => key in changes)) {
      stateRevision++;
      const settings = { ...currentSettings };
      for (const key of Object.keys(DEFAULT_SETTINGS)) if (key in changes) settings[key] = changes[key].newValue;
      applyStyles(settings);
    }
  }

  function onMessage(message, sender, sendResponse) {
    if (message?.type !== "YT_PROGRESS_PING" && message?.type !== "YT_PROGRESS_LIVE_PREVIEW") return;
    ready.then(() => {
      if (message.type === "YT_PROGRESS_LIVE_PREVIEW") {
        stateRevision++;
        applyStyles(message.settings, { ...currentAssets, ...message.assets });
      }
      sendResponse({
        version: SCRIPT_VERSION,
        applied: Boolean(styleEl?.isConnected),
        hasCustomIcon: Boolean(currentAssets.customIconData),
        hasBackgroundImage: Boolean(currentAssets.backgroundImageData)
      });
    }).catch(() => sendResponse({ version: SCRIPT_VERSION, applied: false }));
    return true;
  }

  chrome.storage.onChanged.addListener(onStorageChanged);
  chrome.runtime.onMessage.addListener(onMessage);
  PREVIEW_MEDIA_EVENTS.forEach(event => document.addEventListener(event, stopThumbnailPreview, true));
  const observer = new MutationObserver(records => {
    if (!styleEl?.isConnected) applyStyles(currentSettings);
    if (records.some(record => {
      if (record.type !== "childList") return false;
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      return target?.closest("ytd-guide-renderer") || [...record.addedNodes].some(node =>
        node instanceof Element && ["ytd-guide-renderer", "tp-yt-app-drawer"].includes(node.localName));
    }) && !sidebarTimer) {
      sidebarTimer = setTimeout(() => {
        sidebarTimer = 0;
        if (!disposed) syncSidebarSections();
      }, 80);
    }
    handlePreviewMutations(records);
    shorts.handleMutations(records);
    surfaces.handleMutations(records);
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "hidden", "role"]
  });

  const shortsEvents = ["yt-navigate-finish", "yt-page-data-updated", "fullscreenchange", "visibilitychange", "play", "loadeddata"];
  shortsEvents.forEach(event => document.addEventListener(event, shorts.sync, true));
  document.addEventListener("yt-navigate-finish", surfaces.apply);
  window.addEventListener("popstate", surfaces.apply);
  window.addEventListener("popstate", shorts.sync);
  window.addEventListener("resize", shorts.schedule);

  globalThis[INSTANCE_KEY] = {
    version: SCRIPT_VERSION,
    dispose() {
      disposed = true;
      observer.disconnect();
      clearTimeout(sidebarTimer);
      shorts.dispose();
      surfaces.dispose();
      shortsEvents.forEach(event => document.removeEventListener(event, shorts.sync, true));
      document.removeEventListener("yt-navigate-finish", surfaces.apply);
      window.removeEventListener("popstate", surfaces.apply);
      window.removeEventListener("popstate", shorts.sync);
      window.removeEventListener("resize", shorts.schedule);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.runtime.onMessage.removeListener(onMessage);
      PREVIEW_MEDIA_EVENTS.forEach(event => document.removeEventListener(event, stopThumbnailPreview, true));
      document.documentElement.removeAttribute("data-ytc-theme");
      document.documentElement.removeAttribute("data-ytc-blur");
      document.documentElement.removeAttribute("data-ytc-custom-background");
      document.documentElement.removeAttribute("data-ytc-shorts-clean");
      document.documentElement.removeAttribute("data-ytc-reduced-effects");
      document.documentElement.removeAttribute("data-ytc-disable-video-previews");
      document.documentElement.removeAttribute("data-ytc-chat-frame");
      document.documentElement.style.removeProperty("--ytc-ui-opacity");
      document.documentElement.style.removeProperty("--ytc-ui-blur");
      document.documentElement.style.removeProperty("--ytc-ui-backdrop");
    }
  };
})();
