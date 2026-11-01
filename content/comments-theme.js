// CSS-only comments styling: one shared glass surface, native controls and threading.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.commentsVersion === YTCustomizer.version) return;
  const scope = 'html[data-ytc-theme][data-ytc-cards]';
  const comments = `${scope} ytd-comments`;
  const model = `${comments} :is(ytd-comment-view-model, ytd-comment-renderer)`;
  const thread = `${comments} ytd-comment-thread-renderer:not(ytd-comment-thread-renderer ytd-comment-thread-renderer)`;
  const css = `
    ${comments} {
      --ytc-comment-line: color-mix(in srgb, var(--yt-spec-text-primary) 13%, transparent);
      --ytc-comment-line-hover: color-mix(in srgb, var(--yt-spec-text-primary) 25%, transparent);
      --ytc-comment-action-fill: rgb(17 24 39 / clamp(0, calc(var(--ytc-ui-opacity) * 1.5), 1));
      --yt-endpoint-color: var(--yt-spec-text-primary);
      --yt-endpoint-visited-color: var(--yt-spec-text-primary);
      color: var(--yt-spec-text-primary) !important;
    }
    ${scope} :is(ytd-watch-flexy, ytd-watch-grid) ytd-comments:not([engagement-panel]) {
      box-sizing: border-box !important;
      position: relative !important; z-index: 1 !important;
      padding: var(--ytc-card-padding) !important;
      border: var(--ytc-card-border-width) solid var(--ytc-comment-line) !important;
      border-radius: var(--ytc-card-radius) !important;
    }
    /* An engagement panel already owns its glass. Do not nest another frame. */
    ${scope} ytd-engagement-panel-section-list-renderer ytd-comments {
      padding: 0 !important; border: 0 !important; border-radius: 0 !important;
    }
    ${comments} ytd-comments-header-renderer {
      margin: 0 0 var(--ytc-shelf-spacing) !important;
      padding-block-end: var(--ytc-card-gap) !important;
      border-block-end: var(--ytc-card-border-width) solid var(--ytc-comment-line) !important;
    }
    ${comments} ytd-comments-header-renderer #title {
      align-items: center !important; justify-content: space-between !important;
      flex-wrap: wrap !important; gap: 10px 16px !important;
      margin: 0 0 var(--ytc-card-gap) !important;
    }
    ${comments} ytd-comments-header-renderer :is(#leading-section, #additional-section) { min-width: 0 !important; }
    ${comments} ytd-comments-header-renderer #additional-section { margin-inline-start: auto !important; }
    ${comments} ytd-comments-header-renderer #count {
      margin: 0 !important; font-size: 18px !important; line-height: 26px !important;
      font-weight: 650 !important; color: var(--yt-spec-text-primary) !important;
    }
    ${comments} ytd-comments-header-renderer #count :is(yt-formatted-string, span) {
      color: inherit !important; font-size: inherit !important; font-weight: inherit !important;
    }
    ${comments} #sort-menu tp-yt-paper-button.dropdown-trigger {
      min-height: 34px !important; padding: 6px 10px !important; border-radius: 999px !important;
    }
    ${comments} #sort-menu {
      --yt-spec-menu-background: var(--ytc-comment-action-fill) !important;
      --ytc-universal-glass: var(--ytc-comment-action-fill) !important;
    }
    ${comments} #sort-menu tp-yt-paper-listbox {
      box-sizing: border-box !important; min-width: min(220px, calc(100vw - 48px)) !important;
      max-width: calc(100vw - 48px) !important;
      background: var(--ytc-comment-action-fill) !important;
      color: #fff !important; border-radius: 10px !important;
    }
    ${comments} #sort-menu tp-yt-paper-item { --ytc-universal-glass: transparent !important; }
    ${comments} ytd-comments-header-renderer ytd-comment-simplebox-renderer {
      box-sizing: border-box !important; margin: 0 !important; padding: var(--ytc-card-padding) !important;
      border: var(--ytc-card-border-width) solid var(--ytc-comment-line) !important; border-radius: var(--ytc-card-radius) !important;
      align-items: flex-start !important;
    }
    ${comments} ytd-comments-header-renderer ytd-comment-simplebox-renderer:focus-within {
      border-color: color-mix(in srgb, var(--yt-spec-call-to-action) 65%, transparent) !important;
    }
    ${comments} ytd-comments-header-renderer ytd-comment-simplebox-renderer > #author-thumbnail {
      width: 36px !important; height: 36px !important; flex: 0 0 36px !important;
      margin-inline-end: 12px !important; border-radius: 50% !important;
    }
    ${comments} ytd-comments-header-renderer ytd-comment-simplebox-renderer > #author-thumbnail img {
      width: 100% !important; height: 100% !important; object-fit: cover !important;
    }
    ${comments} ytd-comment-simplebox-renderer :is(#placeholder-area, #comment-dialog) { min-width: 0 !important; }
    ${comments} ytd-comment-simplebox-renderer :is(#placeholder-area, #simplebox-placeholder) { border-block-end: 0 !important; }
    ${comments} #simplebox-placeholder {
      box-sizing: border-box !important; min-height: 36px !important; padding-block: 7px !important;
      color: var(--yt-spec-text-primary) !important; font-size: 14px !important; line-height: 22px !important;
    }
    ${comments} #simplebox-placeholder > span { color: inherit !important; }
    /* Keep the page's white button labels legible over light wallpapers too.
       The tint follows opacity, including a fully transparent zero setting. */
    ${comments} :is(button, tp-yt-paper-button, tp-yt-paper-icon-button):not(#author-thumbnail-button):not(ytd-creator-heart-renderer *):not(yt-creator-heart-view-model *) {
      --ytc-universal-glass: var(--ytc-comment-action-fill) !important;
    }
    ${comments} :is(#contenteditable-root, ytd-comment-dialog-renderer [contenteditable="true"]) {
      color: var(--yt-spec-text-primary) !important; caret-color: var(--yt-spec-call-to-action) !important;
      background-color: transparent !important; overflow-wrap: anywhere;
    }
    ${thread} {
      box-sizing: border-box !important; padding: var(--ytc-card-padding) !important;
      margin: 0 0 var(--ytc-card-gap) !important; border: var(--ytc-card-border-width) solid var(--ytc-comment-line) !important;
      border-radius: var(--ytc-card-radius) !important; transition: border-color 140ms ease;
    }
    ${thread}:hover { border-color: var(--ytc-comment-line-hover) !important; }
    ${thread}:focus-within { border-color: color-mix(in srgb, var(--yt-spec-call-to-action) 50%, transparent) !important; }
    ${model} #main { min-width: 0 !important; }
    ${model} #header-author {
      align-items: center !important; flex-wrap: wrap !important; gap: 3px 8px !important;
    }
    ${model} #header-author > h3 { min-width: 0 !important; max-width: 100% !important; margin: 0 !important; }
    ${model} #author-text {
      display: inline-block !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important;
      max-width: 100% !important; color: var(--yt-spec-text-primary) !important;
      font-size: 13px !important; line-height: 20px !important; font-weight: 600 !important;
    }
    ${model} #author-text > span { color: inherit !important; }
    ${model} :is(#published-time-text, #published-time-text a, #published-time-text span) {
      color: var(--yt-spec-text-secondary) !important; font-size: 12px !important; line-height: 18px !important;
    }
    /* Keep native text metrics, line clamping, emoji and Read more behavior. */
    ${model} #content-text { color: var(--yt-spec-text-primary) !important; overflow-wrap: anywhere; }
    ${model} #content-text > span:not([role="link"]) { color: inherit !important; }
    ${model} #content-text :is(a, [role="link"], .yt-core-attributed-string__link) { color: var(--yt-spec-call-to-action) !important; }
    ${model} #action-buttons { margin-block-start: 6px !important; }
    ${comments} :is(ytd-comment-engagement-bar, ytd-comment-action-buttons-renderer) #toolbar {
      align-items: center !important; column-gap: 6px !important; row-gap: 6px !important;
    }
    ${comments} #vote-count-middle {
      color: var(--yt-spec-text-secondary) !important; font-size: 12px !important;
      font-variant-numeric: tabular-nums; margin-inline: 2px 6px !important;
    }
    ${model} #action-menu { opacity: 1 !important; visibility: visible !important; }
    /* Retain both generations of native reply controls and their geometry. */
    ${comments} ytd-comment-replies-renderer { min-width: 0 !important; }
    ${comments} :is(.ytSubThreadConnection, .ytSubThreadContinuation) { border-color: var(--ytc-comment-line-hover) !important; }
    ${comments} ytd-expander :is(#more, #less) {
      padding: 4px 8px !important; margin-block-start: 4px !important;
      border-radius: 999px !important; font-weight: 550 !important;
    }
    ${scope}[data-ytc-reduced-effects] ytd-comments ytd-comment-thread-renderer { transition: none !important; }
    @media (max-width: 600px) {
      ${scope} :is(ytd-watch-flexy, ytd-watch-grid) ytd-comments:not([engagement-panel]) { padding: min(12px, var(--ytc-card-padding)) !important; }
      ${thread} { padding: min(10px, var(--ytc-card-padding)) !important; margin-block-end: min(8px, var(--ytc-card-gap)) !important; }
      ${comments} ytd-comments-header-renderer #title { gap: 8px !important; }
      ${comments} ytd-comments-header-renderer ytd-comment-simplebox-renderer { padding: min(10px, var(--ytc-card-padding)) !important; }
    }
  `;
  runtime.buildCommentsCss = () => css;
  runtime.commentsVersion = YTCustomizer.version;
})();
