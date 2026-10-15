// YouTube Music uses its own components. Style their outer surfaces in CSS so
// queue updates, lyric changes, and seek-bar animation never need DOM scans.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.musicVersion === YTCustomizer.version) return;

  runtime.buildMusicCss = settings => {
    const theme = 'html[data-ytc-theme]';
    const shelves = `ytmusic-carousel-shelf-renderer, ytmusic-shelf-renderer,
      ytmusic-playlist-shelf-renderer, ytmusic-grid-renderer`;
    const items = 'ytmusic-two-row-item-renderer, ytmusic-responsive-list-item-renderer';
    const sectionTitles = `ytmusic-carousel-shelf-basic-header-renderer .title,
      ytmusic-shelf-renderer > #header .title, ytmusic-grid-renderer > #header .title,
      ytmusic-visual-header-renderer .title, ytmusic-immersive-header-renderer .title`;
    const actionButtons = `:is(ytmusic-carousel-shelf-basic-header-renderer,
      ytmusic-visual-header-renderer .buttons)
      :is(button.ytSpecButtonShapeNextHost, button.yt-spec-button-shape-next)`;
    const carouselArrows = `ytmusic-carousel-shelf-renderer
      :is(#previous-items-button, #next-items-button)`;
    const panels = `ytmusic-responsive-header-renderer, ytmusic-detail-header-renderer,
      ytmusic-player-page #side-panel`;
    const popups = `ytmusic-menu-popup-renderer, ytmusic-multi-page-menu-renderer,
      ytmusic-popup-container tp-yt-paper-dialog`;
    const primary = settings.textColor;
    const secondary = `color-mix(in srgb, ${primary} 70%, ${settings.surfaceColor})`;
    const darkText = [1, 3, 5].map(start => parseInt(primary.slice(start, start + 2), 16))
      .reduce((sum, value, index) => sum + value * [0.299, 0.587, 0.114][index], 0) < 145;
    return `
      html ytmusic-app { --ytmusic-playback-progress-color: ${settings.progressColor} !important; }
      html ytmusic-player-bar #progress-bar {
        --paper-slider-active-color: ${settings.progressColor} !important;
        --paper-slider-knob-color: ${settings.thumbColor} !important;
        --paper-progress-secondary-color: ${settings.bufferColor} !important;
      }

      ${theme} ytmusic-app {
        --ytmusic-background: transparent !important;
        --ytmusic-general-background-a: var(--ytc-ui-background) !important;
        --ytmusic-general-background-c: transparent !important;
        --ytmusic-brand-background-solid: var(--ytc-ui-background) !important;
        --ytmusic-player-page-background: transparent !important;
        --ytmusic-player-bar-background: transparent !important;
        --ytmusic-dialog-background-color: var(--ytc-ui-background) !important;
        --ytmusic-dropdown-background: var(--ytc-ui-background) !important;
        --ytmusic-search-background: var(--ytc-ui-background) !important;
        --ytmusic-search-bar-background-bauhaus: var(--ytc-ui-background) !important;
        --ytmusic-text-primary: ${primary} !important;
        --ytmusic-text-secondary: ${secondary} !important;
        --ytmusic-text-disabled: ${secondary} !important;
        --ytmusic-text-primary-inverse: ${settings.pageColor} !important;
        --ytmusic-wordmark-text: ${primary} !important;
        --ytmusic-guide-signin-promo-text-secondary: ${secondary} !important;
        --ytmusic-search-box-text-secondary: ${secondary} !important;
        --ytmusic-search-suggestion-text-secondary: ${secondary} !important;
        --ytmusic-search-suggestion-icon-color: ${secondary} !important;
        --ytmusic-player-bar-ink-color: ${primary} !important;
        --ytmusic-player-bar-disabled-secondary-color: ${secondary} !important;
        --ytmusic-brand-link-text: ${settings.accentColor} !important;
        --ytmusic-menu-item-hover-background-color: color-mix(in srgb, ${primary} 10%, transparent) !important;
        --ytmusic-menu-item-focus-background-color: color-mix(in srgb, ${primary} 14%, transparent) !important;
        color: ${primary} !important;
      }

      ${theme} :is(ytmusic-app, ytmusic-app-layout, ytmusic-browse-response,
        ytmusic-search-page, ytmusic-section-list-renderer, ytmusic-player-page,
        ytmusic-guide-renderer, ytmusic-player-queue, ytmusic-tab-renderer) {
        background: transparent !important;
      }
      /* Music tiles this page-wide black fade every 500px. Clear the native
         browse decoration so the theme/wallpaper has no repeating dark bands. */
      ${theme} ytmusic-browse-response .background-gradient.ytmusic-browse-response {
        background: transparent !important;
      }
      /* Channel gradients contain the avatar, title, and actions. Clear only
         their decoration; the title and buttons own separate fitted surfaces. */
      ${theme} :is(ytmusic-visual-header-renderer, ytmusic-immersive-header-renderer),
      ${theme} :is(ytmusic-visual-header-renderer, ytmusic-immersive-header-renderer) > .gradient-container {
        background: transparent !important;
        backdrop-filter: none !important;
      }
      ${theme} :is(ytmusic-visual-header-renderer, ytmusic-immersive-header-renderer) > .gradient-container {
        /* Avoid a transient dark strip during the native background fade. */
        transition: none !important;
      }
      /* Give navigation and playback one background sibling each. Their
         interactive children stay outside a backdrop-filter containing block. */
      ${theme} :is(ytmusic-app-layout > #nav-bar-background,
        ytmusic-app-layout > #mini-guide-background,
        ytmusic-app-layout > #player-bar-background,
        ytmusic-app-layout > #guide #contentContainer) {
        background: var(--ytc-ui-background) !important;
        backdrop-filter: var(--ytc-ui-backdrop) !important;
      }
      ${theme} :is(ytmusic-nav-bar, ytmusic-player-bar) {
        background: transparent !important;
        backdrop-filter: none !important;
        color: ${primary} !important;
      }
      ${theme} ytmusic-app-layout > #nav-bar-divider { background: transparent !important; }
      ${theme} ytmusic-nav-bar :is(yt-icon, yt-icon-button, ytmusic-cast-button),
      ${theme} ytmusic-guide-renderer #guide-button { color: ${primary} !important; }
      /* Music supplies a white wordmark. Keep its native image readable when
         a light theme uses dark text, without filtering or replacing the logo. */
      ${theme} ytmusic-logo {
        background: ${darkText ? primary : 'transparent'};
        border-radius: 6px;
        ${darkText ? 'padding: 4px 6px;' : ''}
      }
      ${theme} ytmusic-app-layout > #guide #contentContainer {
        border-inline-end: 1px solid color-mix(in srgb, ${primary} 12%, transparent) !important;
      }

      /* Each music item owns its box; shelf headings and the empty space
         between items reveal the wallpaper instead of one page-wide panel. */
      ${theme} :is(${shelves}) {
        background: transparent !important;
        backdrop-filter: none !important;
        box-shadow: none !important;
      }
      ${theme} :is(${sectionTitles}) {
        display: inline-block !important;
        flex: 0 1 auto !important;
        width: fit-content !important;
        max-width: 100%;
        box-sizing: border-box;
        padding: 6px 12px;
        border: 1px solid color-mix(in srgb, ${primary} 35%, transparent);
        border-radius: 12px;
        background: var(--ytc-ui-background);
        backdrop-filter: var(--ytc-ui-backdrop);
      }
      ${theme} ytmusic-carousel-shelf-basic-header-renderer #button-group {
        margin-inline-start: auto;
      }
      ${theme} :is(${items}) {
        background: var(--ytc-ui-background) !important;
        backdrop-filter: var(--ytc-ui-backdrop) !important;
        border-radius: 12px !important;
        box-sizing: border-box !important;
        min-width: 0 !important;
      }
      /* Keep native carousel widths and row heights. Native image wrappers use
         percentage padding, preserving square/wide artwork within the inset. */
      ${theme} ytmusic-responsive-list-item-renderer {
        padding: 6px 8px !important;
        overflow: clip !important;
      }
      /* Compact Quick-picks art otherwise fills the entire 48px row. Resize
         its native container instead of increasing the carousel's row pitch. */
      ${theme} ytmusic-responsive-list-item-renderer[height-style="MUSIC_RESPONSIVE_LIST_ITEM_HEIGHT_MEDIUM_COMPACT"] {
        --ytmusic-responsive-list-item-thumbnail-size: calc(var(--ytmusic-list-item-height, 48px) - 12px) !important;
      }
      ${theme} ytmusic-responsive-list-item-renderer > .left-items {
        border-radius: 8px !important;
        overflow: hidden !important;
      }
      ${theme} ytmusic-responsive-list-item-renderer[has-circle-cropped-thumbnail] > .left-items {
        border-radius: 50% !important;
      }
      ${theme} ytmusic-two-row-item-renderer {
        padding: 8px !important;
        overflow: clip !important;
      }
      ${theme} ytmusic-two-row-item-renderer > .details {
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
      }
      ${theme} ytmusic-two-row-item-renderer .image-wrapper {
        border-radius: 10px !important;
        overflow: hidden !important;
      }
      ${theme} :is(${items}):is(:hover, :focus-within) {
        background-image: linear-gradient(color-mix(in srgb, ${primary} 8%, transparent),
          color-mix(in srgb, ${primary} 8%, transparent)) !important;
      }
      ${theme} :is(${items}):focus-within {
        outline: 1px solid ${settings.accentColor};
        outline-offset: -1px;
      }
      ${theme} :is(${items}) :is(${items}) {
        background: transparent !important;
        backdrop-filter: none !important;
      }
      ${theme} :is(${panels}, ${popups}) {
        background: var(--ytc-ui-background) !important;
        backdrop-filter: var(--ytc-ui-backdrop) !important;
        border-radius: 16px !important;
        box-sizing: border-box !important;
        min-width: 0 !important;
        color: ${primary} !important;
      }
      ${theme} :is(${panels}) { padding: 16px !important; }
      /* Nested dialog/header panels share their outer glass layer. */
      ${theme} :is(${panels}, ${popups}) :is(${panels}, ${popups}) {
        background: transparent !important;
        backdrop-filter: none !important;
      }
      ${theme} :is(ytmusic-player-queue-item, ytmusic-guide-entry-renderer) { border-radius: 10px !important; }
      ${theme} ytmusic-player-queue-item:hover {
        background-color: color-mix(in srgb, ${primary} 8%, transparent) !important;
      }
      ${theme} :is(ytmusic-responsive-list-item-renderer .secondary-flex-columns,
        ytmusic-responsive-list-item-renderer .secondary-flex-columns yt-formatted-string,
        ytmusic-responsive-list-item-renderer .secondary-flex-columns a,
        ytmusic-two-row-item-renderer .subtitle, ytmusic-two-row-item-renderer .subtitle a,
        ytmusic-player-bar .byline, ytmusic-player-bar .byline yt-formatted-string,
        ytmusic-player-bar .byline a, ytmusic-player-bar .subtitle, ytmusic-player-bar .time-info,
        ytmusic-queue-header-renderer .subtitle, ytmusic-queue-header-renderer .subtitle a,
        ytmusic-player-queue-item .byline, ytmusic-player-queue-item .byline a,
        ytmusic-player-queue-item .duration) {
        color: ${secondary} !important;
      }
      ${theme} ytmusic-player-page #side-panel :is(tp-yt-paper-tab, [role="tab"]) {
        color: ${secondary} !important;
      }
      ${theme} ytmusic-player-page #side-panel :is(tp-yt-paper-tab, [role="tab"])[aria-selected="true"] {
        color: ${primary} !important;
      }
      ${theme} ytmusic-player-page tp-yt-paper-tabs {
        --paper-tabs-selection-bar-color: ${settings.accentColor} !important;
      }
      ${theme} ytmusic-app :is(.ytSpecButtonShapeNextTonal, .ytSpecButtonShapeNextOutline,
        .ytSpecButtonShapeNextText, .yt-spec-button-shape-next--tonal,
        .yt-spec-button-shape-next--outline, .yt-spec-button-shape-next--text) {
        color: ${primary} !important;
      }
      ${theme} ytmusic-app :is(.ytSpecButtonShapeNextOutline, .yt-spec-button-shape-next--outline) {
        border-color: color-mix(in srgb, ${primary} 30%, transparent) !important;
      }
      ${theme} ytmusic-app :is(.ytSpecButtonShapeNextTonal, .yt-spec-button-shape-next--tonal) {
        background-color: color-mix(in srgb, ${primary} 10%, transparent) !important;
      }
      /* Style the native button, not its wrapper, so each control gets one
         glass layer and its existing click target/disabled behavior survives. */
      ${theme} ${actionButtons},
      ${theme} ytmusic-navigation-button-renderer > button,
      ${theme} ${carouselArrows} {
        background: var(--ytc-ui-background) !important;
        backdrop-filter: var(--ytc-ui-backdrop) !important;
        color: ${primary} !important;
        border: 1px solid color-mix(in srgb, ${primary} 35%, transparent) !important;
        border-radius: 12px !important;
        box-sizing: border-box !important;
        min-width: 0;
      }
      ${theme} ytmusic-navigation-button-renderer > button {
        overflow: hidden;
      }
      ${theme} ytmusic-navigation-button-renderer[button-style="STYLE_SOLID"] > button {
        border-inline-start: 4px solid var(--ytmusic-navigation-button-left-stripe-color, ${settings.accentColor}) !important;
      }
      ${theme} :is(${carouselArrows}) {
        border-radius: 50% !important;
        opacity: 1 !important;
      }
      ${theme} :is(${carouselArrows})[disabled] { opacity: 0.4 !important; }
      ${theme} :is(${carouselArrows}) :is(button, yt-icon),
      ${theme} ytmusic-navigation-button-renderer > button yt-icon {
        color: inherit !important;
      }
      ${theme} :is(${actionButtons}, ytmusic-navigation-button-renderer > button,
        ${carouselArrows}):not([disabled]):hover {
        background-image: linear-gradient(color-mix(in srgb, ${primary} 8%, transparent),
          color-mix(in srgb, ${primary} 8%, transparent)) !important;
      }
      ${theme} :is(${actionButtons}, ytmusic-navigation-button-renderer > button,
        ${carouselArrows}):focus-within {
        outline: 2px solid ${settings.accentColor};
        outline-offset: 2px;
      }
      ${theme} :is(ytmusic-two-row-item-renderer, ytmusic-responsive-list-item-renderer)
        :is(ytmusic-thumbnail-renderer, yt-img-shadow) { border-radius: 10px !important; }
      ${theme} ytmusic-player-bar #hover-time-info {
        background: var(--ytc-ui-background) !important;
        color: ${primary} !important;
      }
      ${theme} ytmusic-search-box {
        --ytmusic-search-box-text-input: ${primary} !important;
        color: ${primary} !important;
      }
      ${theme} ytmusic-search-box input { color: ${primary} !important; caret-color: ${settings.accentColor} !important; }
      ${theme} ytmusic-search-box input::placeholder { color: ${secondary} !important; }
      ${theme} ytmusic-search-box #suggestion-list {
        background: var(--ytc-ui-background) !important;
        backdrop-filter: var(--ytc-ui-backdrop) !important;
        border-radius: 0 0 16px 16px !important;
      }
      ${theme} :is(ytmusic-chip-cloud-chip-renderer, ytmusic-chip-cloud-chip-renderer a) {
        color: ${primary} !important;
      }
      ${theme} ytmusic-chip-cloud-chip-renderer a {
        background: var(--ytc-ui-background) !important;
      }
      /* The native full player overlays a still-mounted browse/search page.
         Hide that page while open so its cards do not show through wallpaper. */
      ${theme} ytmusic-app-layout[player-page-open] > #content {
        visibility: hidden !important;
      }
      /* Only decorative page backdrops yield to wallpaper; album art, video,
         thumbnail overlays, and fullscreen controls keep their native layers. */
      html[data-ytc-custom-background] ytmusic-browse-response ytmusic-fullbleed-thumbnail-renderer {
        display: none !important;
      }
      ${settings.hideHomeTopicBar ? 'html ytmusic-chip-cloud-renderer { display: none !important; }' : ''}
      ${settings.reduceAnimations ? `
        html ytmusic-app :is(ytmusic-two-row-item-renderer, ytmusic-responsive-list-item-renderer,
          ytmusic-carousel-shelf-renderer, ytmusic-guide-entry-renderer, ytmusic-chip-cloud-chip-renderer,
          ytmusic-menu-popup-renderer) { animation: none !important; transition: none !important; }
      ` : ''}
    `;
  };
  runtime.musicVersion = YTCustomizer.version;
})();
