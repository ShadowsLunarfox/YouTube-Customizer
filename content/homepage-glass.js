// Keeps homepage feed surfaces transparent so a custom wallpaper remains visible.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.homepageVersion === YTCustomizer.version) return;
  const topicsShelf = 'html[data-ytc-theme] ytd-browse[page-subtype="home"] ' +
    ':is(ytd-chips-shelf-with-video-shelf-renderer, .ytdChipsShelfWithVideoShelfRendererHost)';
  const membershipsShelf = 'html[data-ytc-theme] ytd-browse[page-subtype="home"] ' +
    'ytd-rich-shelf-renderer[has-paygated-featured-badge]:not([is-shorts])';
  const featuredShelf = `:is(${topicsShelf}, ${membershipsShelf})`;
  const videoShelf = `:is(${topicsShelf} ytd-rich-shelf-renderer, ${membershipsShelf})`;
  // Hover players can live inside the feed before moving into a preview portal.
  // Their controls and progress layers need their native backgrounds immediately.
  const clearContent = ':where(:not(.html5-video-player, .html5-video-player *, ' +
    '#inline-player, #inline-player *, #inline-preview-player, #inline-preview-player *, ' +
    '[data-ytc-home-shorts-toggle]))';

  runtime.buildHomepageGlassCss = () => `
    /* Inset the thumbnail and metadata within each rounded Home card. */
    html[data-ytc-theme] ytd-browse[page-subtype="home"] ytd-rich-item-renderer {
      box-sizing: border-box !important;
      padding: 12px !important;
      border-radius: 16px !important;
    }

    /* Keep the Shorts shelf compact with a gap above and below it. */
    html[data-ytc-theme] ytd-browse[page-subtype="home"]
      :is(ytd-rich-shelf-renderer[is-shorts],
        grid-shelf-view-model:not(ytd-rich-shelf-renderer[is-shorts] *):has(
          ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)) {
      box-sizing: border-box !important;
      padding: 6px 12px !important;
      margin-block: 16px !important;
      border-radius: 16px !important;
    }

    html[data-ytc-theme] ytd-browse[page-subtype="home"]
      :is(ytd-rich-item-renderer, ytd-chips-shelf-with-video-shelf-renderer,
        .ytdChipsShelfWithVideoShelfRendererHost)
      :is(.ytLockupMetadataViewModelMenuButton, .yt-lockup-metadata-view-model__menu-button,
        .yt-lockup-metadata-view-model-wiz__menu-button, ytd-rich-grid-media #menu) {
      translate: -6px 0 !important;
    }

    ${featuredShelf} {
      --ytc-featured-edge-light: rgba(255, 255, 255, calc(var(--ytc-ui-opacity) * .45));
      --ytc-featured-edge-dark: rgba(0, 0, 0, calc(var(--ytc-ui-opacity) * .35));
      box-sizing: border-box !important;
      width: 100% !important;
      padding: 12px !important;
      margin-block: 16px !important;
      border-radius: 16px !important;
    }
    ${topicsShelf} .ytdChipsShelfWithVideoShelfRendererHeader {
      margin: 0 0 12px !important;
    }
    ${topicsShelf} .ytdChipsShelfWithVideoShelfRendererChipsShelf {
      margin: 0 0 12px !important;
    }
    ${topicsShelf} :is(.ytChipsShelfViewModelChipsShelfContent,
      .ytChipsShelfViewModelChipsScrollContainer, .ytChipBarViewModelChipBarScrollContainer,
      yt-chip-cloud-renderer #scroll-container) {
      min-width: 0 !important;
      width: 100% !important;
      overflow: visible !important;
      margin-bottom: 0 !important;
    }
    ${topicsShelf} :is(.ytChipsShelfViewModelChipsContainer,
      .ytChipBarViewModelChipBarScrollContainer, yt-chip-cloud-renderer #chips) {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
    }
    ${topicsShelf} :is(.ytChipsShelfViewModelChipWrapper, .ytChipBarViewModelChipWrapper) {
      margin: 0 !important;
      max-width: 100% !important;
    }
    ${topicsShelf} :is(.ytChipsShelfViewModelLeftArrowContainer,
      .ytChipsShelfViewModelRightArrowContainer, .ytChipBarViewModelLeftArrowContainer,
      .ytChipBarViewModelRightArrowContainer, yt-chip-cloud-renderer #left-arrow,
      yt-chip-cloud-renderer #right-arrow) {
      display: none !important;
    }
    ${videoShelf} > #dismissible {
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
    }
    ${videoShelf} > #dismissible > #contents-container {
      margin-top: 0 !important;
    }
    /* Empty columns collapse, so four recommendations fill the available row. */
    ${videoShelf} > #dismissible > #contents-container > #contents,
    ${featuredShelf} grid-shelf-view-model .ytGridShelfViewModelGridShelfRow {
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, max(240px,
        calc((100% - (var(--ytc-grid-columns, 4) - 1) * 16px) / var(--ytc-grid-columns, 4)))), 1fr)) !important;
      gap: 16px !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    ${featuredShelf} :is(ytd-rich-item-renderer, .ytGridShelfViewModelGridShelfItem) {
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
      margin: 0 !important;
    }
    ${featuredShelf} ytd-rich-item-renderer > #content,
    ${featuredShelf} yt-lockup-view-model:not(ytd-rich-item-renderer *) {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
    }
    ${featuredShelf} :is(ytd-rich-item-renderer,
      yt-lockup-view-model:not(ytd-rich-item-renderer *)) {
      box-sizing: border-box !important;
      padding: 10px !important;
      border-radius: 16px !important;
    }
    ${featuredShelf} :is(ytd-thumbnail, yt-thumbnail-view-model,
      .ytLockupViewModelContentImage, .yt-lockup-view-model__content-image,
      .yt-lockup-view-model-wiz__content-image) {
      border-radius: 12px !important;
      overflow: hidden !important;
    }
    ${featuredShelf} :is(ytd-thumbnail, yt-thumbnail-view-model,
      .ytLockupViewModelContentImage, .yt-lockup-view-model__content-image,
      .yt-lockup-view-model-wiz__content-image) img {
      border-radius: 12px !important;
    }
    ${featuredShelf} :is(button, yt-chip-cloud-chip-renderer) {
      border-radius: 999px !important;
      color: var(--yt-spec-text-primary) !important;
    }
    /* Border highlights form the bevel without adding a second glass layer. */
    ${featuredShelf},
    ${featuredShelf} :is(ytd-rich-item-renderer,
      yt-lockup-view-model:not(ytd-rich-item-renderer *), button, yt-chip-cloud-chip-renderer) {
      box-sizing: border-box !important;
      border: 1px solid !important;
      border-color: var(--ytc-featured-edge-light) var(--ytc-featured-edge-dark)
        var(--ytc-featured-edge-dark) var(--ytc-featured-edge-light) !important;
    }
    ${topicsShelf} :is(.ytChipsShelfViewModelChipsContainer,
      .ytChipBarViewModelChipBarScrollContainer)
      button:is([aria-pressed="true"], .ytSpecButtonShapeNextFilled,
        .yt-spec-button-shape-next--filled) {
      --ytc-universal-glass: color-mix(in srgb, var(--yt-spec-call-to-action)
        calc(var(--ytc-ui-opacity) * 100%), transparent) !important;
    }
    ${videoShelf} > #dismissible > .button-container {
      position: static !important;
      transform: none !important;
      margin: 12px auto 0 !important;
      width: min(100%, 360px) !important;
      border-radius: 999px !important;
    }

    ${membershipsShelf} #rich-shelf-header {
      margin: 0 0 12px !important;
      gap: 12px !important;
    }
    ${membershipsShelf} :is(#title-container, #title-text) {
      min-width: 0 !important;
    }
    ${membershipsShelf} #title {
      color: var(--yt-spec-text-primary) !important;
    }
    ${membershipsShelf} :is(#subtitle-text, #subtitle, #paygated-featured-badge badge-shape) {
      color: var(--yt-spec-text-secondary) !important;
    }
    ${membershipsShelf} :is(button, yt-icon, yt-icon-button) {
      color: var(--yt-spec-text-primary) !important;
      --yt-icon-button-icon-color: var(--yt-spec-text-primary) !important;
    }
    /* Stretch each card to its row's height without changing native hidden items. */
    ${membershipsShelf} ytd-rich-item-renderer:not([hidden]),
    ${membershipsShelf} ytd-rich-item-renderer > #content {
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
    }
    ${membershipsShelf} :is(yt-lockup-view-model, ytd-rich-grid-media) {
      width: 100% !important;
      min-width: 0 !important;
    }
    /* Reserve a separate menu column so titles, logos, and badges stay readable. */
    ${membershipsShelf} :is(.ytLockupMetadataViewModelTextContainer,
      .yt-lockup-metadata-view-model__text-container,
      .yt-lockup-metadata-view-model-wiz__text-container, ytd-rich-grid-media #meta) {
      flex: 1 !important;
      min-width: 0 !important;
      padding-right: 0 !important;
    }
    ${membershipsShelf} :is(.ytLockupMetadataViewModelMenuButton,
      .yt-lockup-metadata-view-model__menu-button,
      .yt-lockup-metadata-view-model-wiz__menu-button, ytd-rich-grid-media #menu,
      ytd-rich-grid-media ytd-menu-renderer:not(#menu *)) {
      position: static !important;
      translate: none !important;
      transform: none !important;
      flex: 0 0 40px !important;
      align-self: flex-start !important;
      margin: -6px 0 0 8px !important;
    }
    ${membershipsShelf} ytd-rich-grid-media :is(#menu, ytd-menu-renderer:not(#menu *)) {
      margin-top: 6px !important;
    }
    ${membershipsShelf} ytd-rich-grid-media #menu ytd-menu-renderer {
      position: static !important;
      margin: 0 !important;
    }
    ${membershipsShelf} :is(.ytLockupMetadataViewModelMenuButton,
      .yt-lockup-metadata-view-model__menu-button,
      .yt-lockup-metadata-view-model-wiz__menu-button, ytd-rich-grid-media #menu,
      ytd-rich-grid-media ytd-menu-renderer) button {
      min-width: 40px !important;
      min-height: 40px !important;
    }
    ${membershipsShelf} :is(.ytLockupMetadataViewModelTitle,
      .yt-lockup-metadata-view-model__title, .yt-lockup-metadata-view-model-wiz__title) {
      padding-right: 0 !important;
    }

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
      .ytSearchboxComponentInputBox, .ytChipShapeChip,
      .ytSpecTouchFeedbackShapeFill, .ytSpecButtonShapeNextHost,
      yt-chip-cloud-chip-renderer, yt-chip-cloud-chip-renderer #chip-container) {
      background: transparent !important;
      background-color: var(--ytc-universal-glass) !important;
      background-image: none !important;
      box-shadow: none !important;
    }

    html[data-ytc-home-glass] ytd-browse[page-subtype="home"] ${clearContent},
    html[data-ytc-home-glass] ytd-masthead ${clearContent},
    html[data-ytc-home-glass] ytd-feed-filter-chip-bar-renderer ${clearContent} {
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
    html[data-ytc-home-glass] ytd-browse[page-subtype="home"] ${clearContent}::before,
    html[data-ytc-home-glass] ytd-browse[page-subtype="home"] ${clearContent}::after {
      background: transparent !important;
      background-image: none !important;
      box-shadow: none !important;
      filter: none !important;
    }
  `;
  runtime.homepageVersion = YTCustomizer.version;
})();
