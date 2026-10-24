// Keeps homepage feed surfaces transparent so a custom wallpaper remains visible.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.homepageVersion === YTCustomizer.version) return;
  const topicsShelf = 'html[data-ytc-theme] ytd-browse[page-subtype="home"] ' +
    ':is(ytd-chips-shelf-with-video-shelf-renderer, .ytdChipsShelfWithVideoShelfRendererHost)';
  const membershipsShelf = 'html[data-ytc-theme] ' + runtime.membershipsShelfSelector;
  const brandShelf = 'html[data-ytc-theme] ' + runtime.brandVideoShelfSelector;
  const promo = 'html[data-ytc-theme] ' + runtime.homePromoSelector;
  const promoSection = 'html[data-ytc-theme] ytd-browse[page-subtype="home"] ' +
    `ytd-rich-section-renderer:has(${runtime.homePromoTypeSelector})`;
  const playablesShelf = 'html[data-ytc-theme] ' + runtime.playablesShelfSelector + ':has(> #dismissible)';
  const playablesSection = 'html[data-ytc-theme] ytd-browse[page-subtype="home"] ' +
    `ytd-rich-section-renderer:has(${runtime.playablesShelfTypeSelector})`;
  const playablesCard = runtime.playablesCardTypes;
  const membershipsAndBrand = `:is(${membershipsShelf}, ${brandShelf})`;
  const standaloneCard = ':is(yt-lockup-view-model, ytd-rich-grid-media)' +
    ':not(ytd-rich-item-renderer *, yt-lockup-view-model *)';
  const featuredShelf = `:is(${topicsShelf}, ${membershipsShelf}, ${brandShelf}, ${playablesShelf}, ${promo})`;
  const promoFrame = `${featuredShelf}:is(${promo})`;
  const videoShelf = `:is(${topicsShelf} ytd-rich-shelf-renderer, ${membershipsShelf}, ${brandShelf})`;
  // Hover players can live inside the feed before moving into a preview portal.
  // Their controls and progress layers need their native backgrounds immediately.
  const clearContent = ':where(:not(.html5-video-player, .html5-video-player *, ' +
    '#inline-player, #inline-player *, #inline-preview-player, #inline-preview-player *, ' +
    '[data-ytc-home-shorts-toggle]))';

  runtime.buildHomepageGlassCss = () => `
    /* Inset the thumbnail and metadata within each rounded Home card. */
    html[data-ytc-theme] ytd-browse[page-subtype="home"] ytd-rich-item-renderer {
      box-sizing: border-box !important;
      padding: var(--ytc-card-padding, 12px) !important;
      border-radius: var(--ytc-card-radius, 16px) !important;
    }

    /* Keep the Shorts shelf compact with a gap above and below it. */
    html[data-ytc-theme] ytd-browse[page-subtype="home"]
      :is(ytd-rich-shelf-renderer[is-shorts],
        grid-shelf-view-model:not(ytd-rich-shelf-renderer[is-shorts] *):has(
          ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2)) {
      box-sizing: border-box !important;
      padding: 6px 12px !important;
      margin-block: var(--ytc-shelf-spacing, 16px) !important;
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
      margin-block: var(--ytc-shelf-spacing, 16px) !important;
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
    ${brandShelf} #visible-video-container:not([hidden]),
    ${brandShelf}[is-expanded] #hidden-video-container:not([hidden]),
    ${featuredShelf} grid-shelf-view-model .ytGridShelfViewModelGridShelfRow {
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, max(240px,
        calc((100% - (var(--ytc-grid-columns, 4) - 1) * var(--ytc-card-gap, 16px)) / var(--ytc-grid-columns, 4)))), 1fr)) !important;
      align-items: var(--ytc-card-alignment, stretch) !important;
      gap: var(--ytc-card-gap, 16px) !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    ${featuredShelf} :is(ytd-rich-item-renderer, .ytGridShelfViewModelGridShelfItem, ${standaloneCard}) {
      align-self: var(--ytc-card-alignment, stretch) !important;
      height: auto !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: none !important;
      margin: 0 !important;
    }
    ${featuredShelf} ytd-rich-item-renderer > #content,
    ${featuredShelf} ${standaloneCard} {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
    }
    ${featuredShelf} :is(ytd-rich-item-renderer, ${standaloneCard}) {
      box-sizing: border-box !important;
      padding: var(--ytc-card-padding, 10px) !important;
      border-radius: var(--ytc-card-radius, 16px) !important;
    }
    ${featuredShelf} :is(ytd-thumbnail, yt-thumbnail-view-model,
      .ytLockupViewModelContentImage, .yt-lockup-view-model__content-image,
      .yt-lockup-view-model-wiz__content-image) {
      border-radius: var(--ytc-thumbnail-radius, 12px) !important;
      overflow: hidden !important;
    }
    ${featuredShelf} :is(ytd-thumbnail, yt-thumbnail-view-model,
      .ytLockupViewModelContentImage, .yt-lockup-view-model__content-image,
      .yt-lockup-view-model-wiz__content-image) img {
      border-radius: var(--ytc-thumbnail-radius, 12px) !important;
    }
    ${featuredShelf} :is(button, yt-chip-cloud-chip-renderer) {
      border-radius: 999px !important;
      color: var(--yt-spec-text-primary) !important;
    }
    /* Border highlights form the bevel without adding a second glass layer. */
    ${featuredShelf},
    ${featuredShelf} :is(ytd-rich-item-renderer, ${standaloneCard}, button, yt-chip-cloud-chip-renderer) {
      box-sizing: border-box !important;
      border: 1px solid !important;
      border-color: var(--ytc-featured-edge-light) var(--ytc-featured-edge-dark)
        var(--ytc-featured-edge-dark) var(--ytc-featured-edge-light) !important;
    }
    ${featuredShelf} :is(ytd-rich-item-renderer, ${standaloneCard}) {
      border-width: var(--ytc-card-border-width, 1px) !important;
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
    ${membershipsShelf} #rich-shelf-header #title-container {
      box-sizing: border-box !important;
      flex: 0 1 auto !important;
      width: fit-content !important;
      max-width: 100% !important;
      padding: 8px 12px !important;
      border: 1px solid var(--ytc-featured-edge-light) !important;
      border-radius: 12px !important;
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
    ${membershipsAndBrand} ytd-rich-item-renderer:not([hidden]),
    ${membershipsAndBrand} ytd-rich-item-renderer > #content,
    ${brandShelf} ${standaloneCard}:not([hidden]) {
      display: flex !important;
      flex-direction: column !important;
      flex: 1 !important;
    }
    ${membershipsAndBrand} :is(yt-lockup-view-model, ytd-rich-grid-media) {
      width: 100% !important;
      min-width: 0 !important;
    }
    /* Modern lockups put their fixed native width on an inner host wrapper. */
    ${membershipsAndBrand} yt-lockup-view-model > .ytLockupViewModelHost {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
    }
    /* Reserve a separate menu column so titles, logos, and badges stay readable. */
    ${membershipsAndBrand} :is(.ytLockupMetadataViewModelTextContainer,
      .yt-lockup-metadata-view-model__text-container,
      .yt-lockup-metadata-view-model-wiz__text-container, ytd-rich-grid-media #meta) {
      flex: 1 !important;
      min-width: 0 !important;
      padding-right: 0 !important;
    }
    ${membershipsAndBrand} :is(.ytLockupMetadataViewModelMenuButton,
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
    ${membershipsAndBrand} ytd-rich-grid-media :is(#menu, ytd-menu-renderer:not(#menu *)) {
      margin-top: 6px !important;
    }
    ${membershipsAndBrand} ytd-rich-grid-media #menu ytd-menu-renderer {
      position: static !important;
      margin: 0 !important;
    }
    ${membershipsAndBrand} :is(.ytLockupMetadataViewModelMenuButton,
      .yt-lockup-metadata-view-model__menu-button,
      .yt-lockup-metadata-view-model-wiz__menu-button, ytd-rich-grid-media #menu,
      ytd-rich-grid-media ytd-menu-renderer) button {
      min-width: 40px !important;
      min-height: 40px !important;
    }
    ${membershipsAndBrand} :is(.ytLockupMetadataViewModelTitle,
      .yt-lockup-metadata-view-model__title, .yt-lockup-metadata-view-model-wiz__title) {
      padding-right: 0 !important;
    }

    /* Brand shelves own direct video cards and separate native expansion rows. */
    ${brandShelf} > #dismissible {
      width: 100% !important;
      overflow: visible !important;
    }
    ${brandShelf} :is(#content-wrapper, #visible-content-wrapper) {
      box-sizing: border-box !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      margin: 0 !important;
    }
    ${brandShelf} #visible-content-wrapper {
      align-items: stretch !important;
    }
    ${brandShelf} :is(#visible-video-container, #hidden-video-container) {
      box-sizing: border-box !important;
      width: 100% !important;
      min-width: 0 !important;
    }
    ${brandShelf}[is-expanded] #hidden-video-container {
      margin-top: 16px !important;
    }
    ${brandShelf} #shelf-header-container {
      box-sizing: border-box !important;
      width: 100% !important;
      margin: 0 0 12px !important;
    }
    ${brandShelf} #section-header-container:not(:empty) {
      box-sizing: border-box !important;
      width: fit-content !important;
      max-width: 100% !important;
      padding: 8px 12px !important;
      border: 1px solid var(--ytc-featured-edge-light) !important;
      border-radius: 12px !important;
    }
    ${brandShelf} #show-more-button-container {
      align-self: center !important;
      margin: 12px auto 0 !important;
      width: min(100%, 360px) !important;
    }
    ${brandShelf} #show-more-button {
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    ${brandShelf} #show-more-button button {
      width: 100% !important;
    }

    /* Image promos (including Premium) use a statement banner, not a video shelf.
       Wrap against the available feed width rather than native column attributes. */
    ${promoSection} {
      box-sizing: border-box !important;
      padding-block: var(--ytc-shelf-spacing, 16px) !important;
      margin-block: 0 !important;
    }
    ${promoSection} ${promoFrame} {
      margin-block: 0 !important;
    }
    ${promoFrame} {
      min-width: 0 !important;
      max-width: 100% !important;
      margin-inline: 0 !important;
      padding: var(--ytc-card-padding, 12px) !important;
      border-width: var(--ytc-card-border-width, 1px) !important;
      border-radius: var(--ytc-card-radius, 16px) !important;
    }
    ${promo} > #dismissible,
    ${promo} :is(#statement-banner-content, #foreground-content, #details-container, #text-container) {
      box-sizing: border-box !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    ${promo} #foreground-content:not([hidden]) {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      justify-content: center !important;
      gap: var(--ytc-card-gap, 16px) !important;
    }
    ${promo} .showcase-image {
      box-sizing: border-box !important;
      flex: 1 1 240px !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 380px !important;
      height: auto !important;
      aspect-ratio: 16 / 9 !important;
      margin: 0 !important;
      padding: 0 !important;
      align-self: center !important;
    }
    ${promo} #tile-container {
      border-radius: var(--ytc-thumbnail-radius, 12px) !important;
    }
    ${promo} #details-container {
      flex: 1 1 320px !important;
      align-self: stretch !important;
    }
    ${promo} #dynamic-title {
      margin: 0 !important;
      font-size: clamp(20px, 2vw, 28px) !important;
      line-height: 1.3 !important;
      overflow-wrap: anywhere !important;
      color: var(--yt-spec-text-primary) !important;
    }
    ${promo} #dynamic-title :is(yt-dynamic-sizing-formatted-string, #container, yt-formatted-string) {
      font-size: inherit !important;
      line-height: inherit !important;
      max-height: none !important;
      overflow: visible !important;
      white-space: normal !important;
      -webkit-line-clamp: unset !important;
    }
    ${promo} #subtitle-container {
      margin-top: 8px !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      overflow-wrap: anywhere !important;
      color: var(--yt-spec-text-primary) !important;
    }
    ${promo} #subtitle {
      font-size: inherit !important;
      line-height: inherit !important;
    }
    ${promo} :is(#badge-container, #new-badge-container, #badge-view-model-container,
      #supplemental-text-container) {
      color: var(--yt-spec-text-secondary) !important;
    }
    ${promo} #button-container {
      margin-top: 10px !important;
    }
    ${promo} #button-wrapper {
      gap: 8px !important;
      max-width: 100% !important;
    }
    ${promo} :is(#primary-button, #secondary-button) {
      max-width: 100% !important;
      margin: 0 !important;
    }
    ${promo} :is(#primary-button, #secondary-button) :is(button, a) {
      max-width: 100% !important;
      min-height: 32px !important;
      height: auto !important;
      white-space: normal !important;
    }
    ${promo}:has(:is(#dismiss-button, #overflow-button) > *) #foreground-content {
      padding-inline-end: 40px !important;
    }
    ${promo} :is(#dismiss-button, #overflow-button) {
      top: 0 !important;
      right: auto !important;
      inset-inline-end: 0 !important;
    }
    ${promo} #attached-survey {
      min-width: 0 !important;
      max-width: 100% !important;
    }

    /* Reserve feed space on the section itself so shelf margins cannot collapse.
       The native footer's absolute positioning must not extend over the next row. */
    ${playablesSection} {
      box-sizing: border-box !important;
      padding-block: var(--ytc-shelf-spacing, 16px) !important;
      margin-block: 0 !important;
    }
    ${playablesSection} ${runtime.playablesShelfTypeSelector}:has(> #dismissible) {
      margin-block: 0 !important;
    }
    ${playablesShelf} {
      padding: 10px 12px !important;
      min-width: 0 !important;
    }
    ${playablesShelf} > #dismissible {
      box-sizing: border-box !important;
      width: 100% !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
    }
    ${playablesShelf} #rich-shelf-header-container {
      margin: 0 0 8px !important;
    }
    ${playablesShelf} #rich-shelf-header {
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      margin: 0 !important;
    }
    ${playablesShelf} #rich-shelf-header h2 {
      flex: 1 1 180px !important;
      min-width: 0 !important;
      margin: 0 !important;
    }
    ${playablesShelf} :is(#title-container, #menu-container) {
      min-width: 0 !important;
    }
    ${playablesShelf} #menu-container {
      gap: 6px !important;
    }
    ${playablesShelf} > #dismissible > #contents-container {
      margin: 0 !important;
    }
    ${playablesShelf} > #dismissible > #contents-container > #contents {
      display: grid !important;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, max(160px,
        calc((100% - (var(--ytc-grid-columns, 4) - 1) * var(--ytc-card-gap, 12px)) / var(--ytc-grid-columns, 4)))), 1fr)) !important;
      align-items: var(--ytc-card-alignment, stretch) !important;
      gap: var(--ytc-card-gap, 12px) !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    ${playablesShelf} ${playablesCard} {
      box-sizing: border-box !important;
      align-self: var(--ytc-card-alignment, stretch) !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: 100% !important;
      height: auto !important;
      padding: var(--ytc-card-padding, 8px) !important;
      margin: 0 !important;
      border: var(--ytc-card-border-width, 1px) solid var(--ytc-featured-edge-light) !important;
      border-radius: var(--ytc-card-radius, 12px) !important;
    }
    ${playablesShelf} > #dismissible > .button-container {
      position: static !important;
      transform: none !important;
      box-sizing: border-box !important;
      width: min(100%, 280px) !important;
      margin: 10px auto 0 !important;
      padding: 0 !important;
      border: 0 !important;
    }
    ${playablesShelf} .expand-collapse-button {
      width: 100% !important;
      max-width: none !important;
    }
    ${playablesShelf} .expand-collapse-button button {
      box-sizing: border-box !important;
      width: 100% !important;
      height: 32px !important;
      min-height: 32px !important;
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
