// Keeps homepage feed surfaces transparent so a custom wallpaper remains visible.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.buildHomepageGlassCss) return;

  runtime.buildHomepageGlassCss = () => `
    html[data-ytc-home-glass] :is(ytd-app, ytd-page-manager, ytd-browse[page-subtype="home"],
      ytd-rich-grid-renderer, ytd-rich-grid-renderer #contents, ytd-rich-grid-row,
      ytd-rich-section-renderer, ytd-rich-item-renderer, ytd-rich-shelf-renderer,
      ytd-rich-grid-media, ytd-rich-grid-slim-media, yt-lockup-view-model,
      yt-lockup-metadata-view-model, ytd-thumbnail, #thumbnail) {
      background-color: transparent !important;
      box-shadow: none !important;
    }

    html[data-ytc-home-glass] ytd-app.with-chipbar,
    html[data-ytc-home-glass] ytd-app.with-chipbar::before,
    html[data-ytc-home-glass] ytd-app.with-chipbar::after {
      background: transparent !important;
      background-color: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
    }

    html[data-ytc-home-glass] :is(ytd-rich-item-renderer, ytd-rich-shelf-renderer,
      .ytSpecTouchFeedbackShapeFill, .ytSpecButtonShapeNextHost,
      .ytChipShapeChip, yt-chip-cloud-chip-renderer #chip-container) {
      background-color: var(--ytc-universal-glass) !important;
      box-shadow: none !important;
    }

    html[data-ytc-home-glass] :is(ytd-masthead, ytd-masthead #background,
      ytd-masthead #masthead-container, ytd-feed-filter-chip-bar-renderer,
      ytd-feed-filter-chip-bar-renderer #chips-wrapper, yt-chip-cloud-renderer,
      ytd-mini-guide-renderer, ytd-guide-renderer, yt-searchbox,
      .ytSearchboxComponentInputContainer, .ytChipShapeChip,
      .ytSpecTouchFeedbackShapeFill, .ytSpecButtonShapeNextHost,
      yt-chip-cloud-chip-renderer, yt-chip-cloud-chip-renderer #chip-container) {
      background: transparent !important;
      background-color: var(--ytc-universal-glass) !important;
      background-image: none !important;
      box-shadow: none !important;
    }

    html[data-ytc-home-glass] ytd-browse[page-subtype="home"] :where(*),
    html[data-ytc-home-glass] ytd-masthead :where(*),
    html[data-ytc-home-glass] ytd-feed-filter-chip-bar-renderer :where(*) {
      background-color: transparent !important;
      box-shadow: none !important;
    }

    html[data-ytc-home-glass] ytd-browse[page-subtype="home"] ytd-rich-item-renderer,
    html[data-ytc-home-glass] ytd-browse[page-subtype="home"] ytd-rich-shelf-renderer {
      background-color: var(--ytc-universal-glass) !important;
      box-shadow: none !important;
    }

    html[data-ytc-home-glass] :is(ytd-masthead #background,
      ytd-masthead #masthead-container)::before,
    html[data-ytc-home-glass] :is(ytd-masthead #background,
      ytd-masthead #masthead-container)::after,
    html[data-ytc-home-glass] ytd-masthead #gradient,
    html[data-ytc-home-glass] ytd-browse[page-subtype="home"] :where(*)::before,
    html[data-ytc-home-glass] ytd-browse[page-subtype="home"] :where(*)::after {
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      filter: none !important;
    }
  `;
})();
