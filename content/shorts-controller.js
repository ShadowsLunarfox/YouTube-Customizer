// Manages Shorts-specific cleanup, layering, and playback-page visual effects.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.shortsVersion === YTCustomizer.version) return;

  const SHORTS_LAYER_ATTR = "data-ytc-shorts-layer";
  const SHORTS_GUTTER_CLASS = "ytc-shorts-gutter-mask";
  const SHORTS_SCOPE_SELECTOR = "ytd-shorts, ytd-reel-video-renderer, #shorts-container, #shorts-player";
  const SHORTS_EFFECT_SELECTOR = [
    '[class*="gradient" i]', '[id*="gradient" i]', '[class*="scrim" i]', '[id*="scrim" i]',
    '[class*="cinematic" i]', '[id*="cinematic" i]', '[class*="ambient" i]', '[id*="ambient" i]',
    '[class*="shade" i]', '[id*="shade" i]', '[class*="overlay" i]', '[id*="overlay" i]'
  ].join(",");
  const protectedContent = 'button, a, input, textarea, select, [role="button"], ' +
    '[role="dialog"], [role="menu"], [role="listbox"], ytd-engagement-panel-section-list-renderer, ' +
    'ytd-comments, ytd-menu-popup-renderer, ytd-multi-page-menu-renderer, yt-searchbox, ' +
    'ytd-guide-renderer, ytd-mini-guide-renderer';

  const isDarkOverlay = color => {
    const values = color.match(/[\d.]+/g)?.map(Number) || [];
    const [red = 255, green = 255, blue = 255, alpha = 1] = values;
    return alpha > 0.04 && Math.max(red, green, blue) < 80 &&
      Math.max(red, green, blue) - Math.min(red, green, blue) < 32;
  };
  const isBlackTransparentGradient = value => {
    const normalized = value.replace(/\s+/g, "").toLowerCase();
    return /(?:linear|radial)-gradient\(/.test(normalized) &&
      /(?:#000(?:000)?|rgb\(0,0,0\)|rgba\(0,0,0,)/.test(normalized) &&
      /(?:transparent|rgba\(0,0,0,0\))/.test(normalized);
  };

  function createShortsController(onStateChange = () => {}) {
    let disposed = false;
    let scanTimer = 0;
    const layers = new Map();

    function restoreLayer(element, record) {
      for (const [property, original] of record.styles) {
        if (element.style.getPropertyValue(property) !== original.applied ||
            element.style.getPropertyPriority(property) !== "important") continue;
        if (original.value) element.style.setProperty(property, original.value, original.priority);
        else element.style.removeProperty(property);
      }
      element.removeAttribute(SHORTS_LAYER_ATTR);
      layers.delete(element);
    }

    function clearLayers() {
      for (const [element, record] of layers) restoreLayer(element, record);
      document.querySelectorAll("." + SHORTS_GUTTER_CLASS).forEach(mask => mask.remove());
    }

    function forceStyle(element, record, property, value) {
      const current = element.style.getPropertyValue(property);
      const priority = element.style.getPropertyPriority(property);
      const original = record.styles.get(property);
      if (original && current === original.applied && priority === "important") return;
      record.styles.set(property, { value: current, priority, applied: value });
      element.style.setProperty(property, value, "important");
      record.styles.get(property).applied = element.style.getPropertyValue(property);
    }

    const enabled = () => !disposed && /^\/shorts(?:\/|$)/.test(location.pathname) &&
      document.documentElement.hasAttribute("data-ytc-custom-background");

    function updateGutters(player, video) {
      const existing = [...document.querySelectorAll("." + SHORTS_GUTTER_CLASS)];
      if (!player || !video || !enabled()) {
        existing.forEach(mask => mask.remove());
        return;
      }
      const playerBounds = player.getBoundingClientRect();
      const videoBounds = video.getBoundingClientRect();
      if (playerBounds.width < 240 || playerBounds.height < 240 ||
          playerBounds.bottom <= 0 || playerBounds.top >= innerHeight) {
        existing.forEach(mask => mask.remove());
        return;
      }
      let mediaLeft = Math.max(playerBounds.left, videoBounds.left);
      let mediaRight = Math.min(playerBounds.right, videoBounds.right);
      const sourceRatio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 0;
      const playerRatio = playerBounds.width / playerBounds.height;
      if (sourceRatio && playerRatio > sourceRatio + 0.04 &&
          videoBounds.width >= playerBounds.width - 4 && videoBounds.height >= playerBounds.height - 4) {
        const mediaWidth = Math.min(playerBounds.width, playerBounds.height * sourceRatio);
        mediaLeft = playerBounds.left + (playerBounds.width - mediaWidth) / 2;
        mediaRight = mediaLeft + mediaWidth;
      }
      const widths = {
        left: Math.max(0, mediaLeft - playerBounds.left),
        right: Math.max(0, playerBounds.right - mediaRight)
      };
      const masks = Object.fromEntries(existing.filter(mask => mask.parentElement === player)
        .map(mask => [mask.dataset.side, mask]));
      for (const side of ["left", "right"]) {
        let mask = masks[side];
        if (widths[side] < 8) {
          mask?.remove();
          continue;
        }
        if (!mask) {
          mask = document.createElement("div");
          mask.className = SHORTS_GUTTER_CLASS;
          mask.dataset.side = side;
          player.append(mask);
        }
        mask.style.setProperty(side, "0", "important");
        mask.style.setProperty("width", Math.ceil(widths[side]) + "px", "important");
      }
      existing.filter(mask => mask.parentElement !== player).forEach(mask => mask.remove());
    }

    function scan() {
      scanTimer = 0;
      if (!enabled()) {
        sync();
        return;
      }
      const visible = element => {
        const rect = element.getBoundingClientRect();
        return rect.width >= 120 && rect.bottom >= 0 && rect.top < innerHeight &&
          rect.right > 0 && rect.left < innerWidth;
      };
      const videos = [...document.querySelectorAll("video")]
        .filter(video => visible(video) && video.clientHeight >= 20);
      const video = videos.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
      const player = video?.closest(".html5-video-player") || document.querySelector("#shorts-player") || video;
      const videoBounds = (video || player)?.getBoundingClientRect();
      const candidates = new Set();
      const scope = video?.closest("ytd-reel-video-renderer, ytd-shorts") ||
        document.querySelector("#shorts-player, ytd-shorts");
      if (scope) scope.querySelectorAll(SHORTS_EFFECT_SELECTOR).forEach(element => candidates.add(element));
      const shells = new Set();
      for (let element = video?.parentElement || player; element && element !== document.documentElement;
        element = element.parentElement) {
        shells.add(element);
        candidates.add(element);
      }
      for (const [element, record] of layers) {
        if (!element.isConnected || element.closest(protectedContent)) restoreLayer(element, record);
        else candidates.add(element);
      }
      for (const element of candidates) {
        if (element.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
            ["video", "img", "canvas", "iframe"].includes(element.localName) ||
            element.closest(protectedContent) || !visible(element)) continue;
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const name = (element.id + " " + element.className).toLowerCase();
        const large = bounds.height >= 140;
        const top = bounds.top < Math.max(180, (videoBounds?.top || 0) + 140) && bounds.width >= 200;
        const gradient = isBlackTransparentGradient(style.backgroundImage) ||
          isBlackTransparentGradient(style.maskImage) || isBlackTransparentGradient(style.webkitMaskImage);
        const decoration = /gradient|scrim|cinematic|ambient|shade|overlay/.test(name);
        const record = layers.get(element) || { styles: new Map(), marks: new Set() };
        if (shells.has(element) || (large || top) && isDarkOverlay(style.backgroundColor)) record.marks.add("surface");
        if ((top || shells.has(element)) && (gradient || decoration)) record.marks.add("gradient");
        if ((large || top) && style.boxShadow !== "none") record.marks.add("shadow");
        for (const pseudo of ["before", "after"]) {
          const pseudoStyle = getComputedStyle(element, "::" + pseudo);
          if (["none", "normal"].includes(pseudoStyle.content)) continue;
          if ((large || top) && (isDarkOverlay(pseudoStyle.backgroundColor) ||
              isBlackTransparentGradient(pseudoStyle.backgroundImage) ||
              isBlackTransparentGradient(pseudoStyle.maskImage) ||
              isBlackTransparentGradient(pseudoStyle.webkitMaskImage) ||
              decoration && pseudoStyle.backgroundImage !== "none" || pseudoStyle.boxShadow !== "none")) {
            record.marks.add(pseudo);
          }
        }
        if (!record.marks.size) continue;
        layers.set(element, record);
        const marks = [...record.marks].join(" ");
        if (element.getAttribute(SHORTS_LAYER_ATTR) !== marks) element.setAttribute(SHORTS_LAYER_ATTR, marks);
        if (record.marks.has("surface")) forceStyle(element, record, "background-color", "transparent");
        if (record.marks.has("gradient")) forceStyle(element, record, "background-image", "none");
        if (record.marks.has("shadow")) forceStyle(element, record, "box-shadow", "none");
      }
      updateGutters(player, video);
    }

    function schedule() {
      if (disposed || scanTimer || !enabled() || document.hidden) return;
      scanTimer = setTimeout(scan, 120);
    }

    function handleMutations(records) {
      if (!enabled()) return;
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof Element &&
            record.target.closest(SHORTS_SCOPE_SELECTOR)) {
          schedule();
          return;
        }
        if (record.type === "childList") {
          for (const node of record.addedNodes) {
            if (node instanceof Element && (node.matches(SHORTS_SCOPE_SELECTOR) ||
                node.closest(SHORTS_SCOPE_SELECTOR))) {
              schedule();
              return;
            }
          }
          for (const node of record.removedNodes) {
            if (node instanceof Element && node.matches(SHORTS_SCOPE_SELECTOR)) {
              schedule();
              return;
            }
          }
        }
      }
    }

    function sync() {
      const active = enabled();
      // toggleAttribute returns the resulting presence, not whether the state changed.
      const wasActive = document.documentElement.hasAttribute("data-ytc-shorts-clean");
      const changed = active !== wasActive;
      if (changed) document.documentElement.toggleAttribute("data-ytc-shorts-clean", active);
      if (active) schedule();
      else if (changed || scanTimer || layers.size) {
        clearTimeout(scanTimer);
        scanTimer = 0;
        clearLayers();
      }
      if (changed) onStateChange();
    }

    function dispose() {
      disposed = true;
      clearTimeout(scanTimer);
      clearLayers();
    }

    return Object.freeze({ sync, schedule, handleMutations, dispose });
  }

  runtime.createShortsController = createShortsController;
  runtime.shortsVersion = YTCustomizer.version;
})();
