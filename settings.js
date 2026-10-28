// Defines the settings contract shared by the popup and YouTube content scripts.
(() => {
  const defaults = Object.freeze({
    progressColor: "#ff3366",
    progressEffect: "solid",
    bufferColor: "#7a7a7a",
    heatmapColor: "#ffffff",
    thumbColor: "#ffffff",
    thumbStyle: "circle",
    barHeight: 5,
    thumbSize: 16,
    showVideoBookmarks: true,
    useDefaultShortcuts: true,
    audioEnabled: false,
    volumeBoost: 100,
    bassGain: 0,
    midGain: 0,
    trebleGain: 0,
    audioBalance: 0,
    audioLimiter: true,
    themeEnabled: false,
    pageColor: "#0f0f0f",
    surfaceColor: "#212121",
    uiOpacity: 30,
    uiBlur: 12,
    textColor: "#f1f1f1",
    accentColor: "#3ea6ff",
    backgroundMode: "color",
    backgroundFit: "cover",
    backgroundOpacity: 40,
    videosPerRow: 6,
    customizeCards: false,
    cardRadius: 16,
    cardBorderWidth: 1,
    cardPadding: 10,
    cardGap: 16,
    shelfSpacing: 16,
    cardTitleLines: 2,
    equalCardHeights: true,
    hideHomePlayables: false,
    hideHomeSingleVideo: false,
    hideHomeFeatured: false,
    hideHomeTopicShelves: false,
    hideHomeShopping: false,
    disableVideoPreviews: false,
    hideHomeTopicBar: false,
    hideCreateButton: false,
    hideNotificationsButton: false,
    hideSidebarSubscriptions: false,
    hideSidebarYou: false,
    hideSidebarExplore: false,
    hideSidebarMoreFromYouTube: false,
    hideSidebarReportHistory: false,
    relatedThumbnailWidth: 96,
    hideShorts: false,
    hideRelated: false,
    hideComments: false,
    hideChat: false,
    reduceAnimations: false
  });
  const assetDefaults = Object.freeze({ customIconData: "", backgroundImageData: "" });
  const shapes = {
    circle: '<circle cx="32" cy="32" r="26"/>',
    diamond: '<path d="M32 4 60 32 32 60 4 32Z"/>',
    star: '<path d="m32 4 8.8 18 19.8 2.9-14.3 13.9 3.4 19.7L32 49.2 14.3 58.5l3.4-19.7L3.4 24.9 23.2 22Z"/>',
    play: '<path d="M18 8v48l38-24Z"/>',
    bolt: '<path d="M37 2 10 36h19l-4 26 29-38H35Z"/>',
    heart: '<path d="M32 57S6 42 6 22C6 12 13 6 22 6c5 0 9 2 10 6 1-4 5-6 10-6 9 0 16 6 16 16 0 20-26 35-26 35Z"/>'
  };
  const presets = Object.freeze({
    charcoal: { pageColor: "#151515", surfaceColor: "#262626", textColor: "#f5f5f5", accentColor: "#ff6b7a" },
    light: { pageColor: "#f2f2f2", surfaceColor: "#ffffff", textColor: "#161616", accentColor: "#005fbe" },
    forest: { pageColor: "#13211b", surfaceColor: "#20382d", textColor: "#edf7ee", accentColor: "#86d6a0" },
    classic: { pageColor: "#008080", surfaceColor: "#c0c0c0", textColor: "#000000", accentColor: "#000080" }
  });
  const audioKeys = Object.freeze(["audioEnabled", "volumeBoost", "bassGain", "midGain", "trebleGain", "audioBalance", "audioLimiter"]);
  const tabKeys = Object.freeze({
    appearance: ["themeEnabled", "pageColor", "surfaceColor", "uiOpacity", "uiBlur", "textColor", "accentColor", "backgroundMode", "backgroundFit", "backgroundOpacity"],
    player: ["progressColor", "progressEffect", "bufferColor", "heatmapColor", "thumbColor", "thumbStyle", "barHeight", "thumbSize"],
    records: ["showVideoBookmarks"],
    shortcuts: ["useDefaultShortcuts"],
    audio: audioKeys,
    layout: ["videosPerRow", "customizeCards", "cardRadius", "cardBorderWidth", "cardPadding", "cardGap", "shelfSpacing", "cardTitleLines", "equalCardHeights", "hideHomePlayables", "hideHomeSingleVideo", "hideHomeFeatured", "hideHomeTopicShelves", "hideHomeShopping", "disableVideoPreviews", "hideHomeTopicBar", "hideCreateButton", "hideNotificationsButton", "hideSidebarSubscriptions", "hideSidebarYou", "hideSidebarExplore", "hideSidebarMoreFromYouTube", "hideSidebarReportHistory", "relatedThumbnailWidth", "hideShorts", "hideRelated", "hideComments", "hideChat", "reduceAnimations"]
  });
  const pageScopes = Object.freeze(["home", "watch", "music"]);
  const profileKeys = Object.freeze([...tabKeys.appearance, ...tabKeys.layout]);
  const cardKeys = Object.freeze(["cardRadius", "cardBorderWidth", "cardPadding", "cardGap", "shelfSpacing", "cardTitleLines", "equalCardHeights"]);
  const ranges = { barHeight: [3, 14], thumbSize: [10, 34], backgroundOpacity: [0, 100], uiOpacity: [0, 100], uiBlur: [0, 30], videosPerRow: [2, 6], relatedThumbnailWidth: [72, 168],
    volumeBoost: [100, 500], bassGain: [-12, 12], midGain: [-12, 12], trebleGain: [-12, 12], audioBalance: [-100, 100],
    cardRadius: [0, 32], cardBorderWidth: [0, 4], cardPadding: [0, 24], cardGap: [4, 32], shelfSpacing: [0, 48], cardTitleLines: [1, 4] };
  const choices = {
    progressEffect: ["solid", "pulse", "shimmer", "rainbow"], thumbStyle: [...Object.keys(shapes), "custom"],
    backgroundMode: ["color", "image"], backgroundFit: ["cover", "contain", "tile"]
  };

  function normalize(settings = {}) {
    const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
    const result = {};
    for (const [key, fallback] of Object.entries(defaults)) {
      const value = Object.hasOwn(source, key) ? source[key] : undefined;
      if (typeof fallback === "boolean") result[key] = typeof value === "boolean" ? value : fallback;
      else if (ranges[key]) {
        const numeric = typeof value === "number" || typeof value === "string" && value.trim() !== "";
        const number = numeric ? Number(value) : NaN;
        result[key] = Number.isFinite(number)
          ? Math.min(ranges[key][1], Math.max(ranges[key][0], Math.round(number))) : fallback;
      } else if (choices[key]) result[key] = choices[key].includes(value) ? value : fallback;
      else result[key] = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    }
    return result;
  }

  function isMediaData(value, limit, allowVideo) {
    if (typeof value !== "string" || value.length > 4 * Math.ceil(limit / 3) + 32) return false;
    const header = /^data:(image\/(?:png|jpeg|webp|gif|avif)|video\/mp4);base64,/i.exec(value);
    if (!header || !allowVideo && header[1].toLowerCase() === "video/mp4") return false;
    const payload = value.slice(header[0].length);
    if (!payload || payload.length % 4 === 1 || !/^[a-z0-9+/]+={0,2}$/i.test(payload)) return false;
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    if (padding && payload.length % 4 !== 0) return false;
    const bytes = Math.floor(payload.length * 3 / 4) - padding;
    return bytes > 0 && bytes <= limit;
  }

  function isImageData(value) {
    return isMediaData(value, 5 * 1024 * 1024, false);
  }

  function isBackgroundData(value) {
    return isMediaData(value, 20 * 1024 * 1024, true);
  }

  function normalizeAssets(assets = {}) {
    const source = assets && typeof assets === "object" && !Array.isArray(assets) ? assets : {};
    const asset = (key, validate) => {
      const value = Object.hasOwn(source, key) ? source[key] : "";
      if (!validate(value)) return "";
      const comma = value.indexOf(",");
      // Canonicalize only the MIME header; Base64 payloads are case sensitive.
      return value.slice(0, comma).toLowerCase() + value.slice(comma);
    };
    return {
      customIconData: asset("customIconData", isImageData),
      backgroundImageData: asset("backgroundImageData", isBackgroundData)
    };
  }

  const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
  function normalizeProfiles(value = {}) {
    const result = {};
    if (!record(value)) return result;
    for (const scope of pageScopes) {
      if (!Object.hasOwn(value, scope) || !record(value[scope])) continue;
      const profile = value[scope], source = record(profile.settings) ? profile.settings : {};
      const normalized = normalize(source);
      result[scope] = {
        enabled: profile.enabled === true,
        settings: Object.fromEntries(profileKeys.filter(key => Object.hasOwn(source, key)).map(key => [key, normalized[key]]))
      };
    }
    return result;
  }

  function normalizePageAssets(value = {}) {
    const result = {};
    if (!record(value)) return result;
    for (const scope of pageScopes) {
      if (Object.hasOwn(value, scope) && record(value[scope]) && Object.hasOwn(value[scope], "backgroundImageData")) {
        result[scope] = { backgroundImageData: normalizeAssets(value[scope]).backgroundImageData };
      }
    }
    return result;
  }

  function pageScope(value) {
    try {
      const url = new URL(value);
      if (!isYouTubeUrl(value)) return "shared";
      if (url.hostname === "music.youtube.com") return "music";
      if (url.pathname === "/") return "home";
      if (/^\/(watch|shorts|live_chat|live_chat_replay|embed)(\/|$)/.test(url.pathname)) return "watch";
    } catch {}
    return "shared";
  }

  function resolveSettings(shared, profiles, scope) {
    const base = normalize(shared), profile = normalizeProfiles(profiles)[scope];
    return profile?.enabled ? { ...base, ...profile.settings } : base;
  }

  function resolveAssets(shared, pageAssets, profiles, scope) {
    const base = normalizeAssets(shared);
    return profiles?.[scope]?.enabled === true
      ? { ...base, ...normalizePageAssets(pageAssets)[scope] } : base;
  }

  function validateSettings(source, keys = Object.keys(defaults)) {
    if (!record(source)) throw new Error("Invalid settings in backup");
    for (const key of keys) {
      if (!Object.hasOwn(source, key)) continue;
      const value = source[key];
      const valid = typeof defaults[key] === "boolean" ? typeof value === "boolean" :
        ranges[key] ? (typeof value === "number" && Number.isFinite(value)) :
        choices[key] ? choices[key].includes(value) : typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
      if (!valid) throw new Error("Invalid backup setting: " + key);
    }
  }

  function createBackup(settings, profiles, assets, pageAssets, includeMedia = true) {
    return {
      format: "youtube-customizer", schemaVersion: 1,
      settings: normalize(settings), pageProfiles: normalizeProfiles(profiles),
      ...(includeMedia ? { assets: normalizeAssets(assets), pageAssets: normalizePageAssets(pageAssets) } : {})
    };
  }

  function parseBackup(text) {
    let value;
    if (typeof text !== "string" || text.length > 150 * 1024 * 1024) throw new Error("Backup is too large (150 MB max)");
    try { value = JSON.parse(text); } catch { throw new Error("Choose a valid JSON backup"); }
    if (!record(value) || value.format !== "youtube-customizer" || value.schemaVersion !== 1) {
      throw new Error("Unsupported YouTube Customizer backup");
    }
    validateSettings(value.settings);
    if (!Object.keys(defaults).some(key => Object.hasOwn(value.settings, key))) throw new Error("Backup contains no settings");
    if (value.pageProfiles !== undefined && !record(value.pageProfiles)) throw new Error("Invalid page settings in backup");
    for (const scope of pageScopes) if (Object.hasOwn(value.pageProfiles || {}, scope)) {
      const profile = value.pageProfiles[scope];
      if (!record(profile) || typeof profile.enabled !== "boolean") throw new Error("Invalid page profile: " + scope);
      validateSettings(profile.settings, profileKeys);
    }
    const validateAssets = (source, backgroundOnly = false) => {
      if (!record(source)) throw new Error("Invalid media in backup");
      for (const key of backgroundOnly ? ["backgroundImageData"] : Object.keys(assetDefaults)) {
        if (!Object.hasOwn(source, key)) continue;
        const data = source[key];
        if (data !== "" && !(key === "customIconData" ? isImageData(data) : isBackgroundData(data))) {
          throw new Error("Invalid backup media: " + key);
        }
      }
    };
    if (Object.hasOwn(value, "assets")) validateAssets(value.assets);
    if (Object.hasOwn(value, "pageAssets")) {
      if (!record(value.pageAssets)) throw new Error("Invalid page media in backup");
      for (const scope of pageScopes) if (Object.hasOwn(value.pageAssets, scope)) validateAssets(value.pageAssets[scope], true);
    }
    return {
      settings: normalize(value.settings), pageProfiles: normalizeProfiles(value.pageProfiles),
      ...(Object.hasOwn(value, "assets") ? { assets: normalizeAssets(value.assets) } : {}),
      ...(Object.hasOwn(value, "pageAssets") ? { pageAssets: normalizePageAssets(value.pageAssets) } : {})
    };
  }

  function isYouTubeUrl(value) {
    if (typeof value !== "string") return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password &&
        (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com"));
    } catch { return false; }
  }

  function isSettingsPageUrl(value, popupUrl) {
    if (value === popupUrl) return true;
    try {
      const url = new URL(value), endpoint = new URL(value), parameters = url.searchParams;
      endpoint.search = "";
      if (endpoint.href !== popupUrl) return false;
      if (parameters.get("embedded") === "1") {
        return [...parameters.keys()].every(key => ["embedded", "token"].includes(key) && parameters.getAll(key).length === 1) &&
          /^[0-9a-f]{32}$/.test(parameters.get("token") || "");
      }
      if (parameters.get("window") !== "1") return false;
      const allowed = ["window", "target", "scope", "panel"];
      if ([...parameters.keys()].some(key => !allowed.includes(key) || parameters.getAll(key).length !== 1)) return false;
      const target = parameters.get("target"), scope = parameters.get("scope"), panel = parameters.get("panel");
      return (target === null || /^\d+$/.test(target) && Number.isSafeInteger(Number(target))) &&
        (scope === null || scope === "shared" || pageScopes.includes(scope)) &&
        (panel === null || panel === "backup" || Object.hasOwn(tabKeys, panel));
    } catch { return false; }
  }

  function iconDataUri(style, color, customIconData = "") {
    if (style === "custom" && isImageData(customIconData)) return customIconData;
    const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : defaults.thumbColor;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="' +
      safeColor + '">' + (Object.hasOwn(shapes, style) ? shapes[style] : shapes.circle) + "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  function isNativeFullscreenKey(event) {
    return !event.isComposing && (event.key === 'Escape' || event.key?.toLowerCase() === 'f' && !event.altKey && !event.ctrlKey && !event.metaKey);
  }
  function hasExtensionContext() {
    try { return Boolean(globalThis.chrome?.runtime?.id); } catch { return false; }
  }
  async function sendRuntimeMessage(message) {
    if (!hasExtensionContext()) throw Error('Extension context invalidated.');
    // An async boundary also turns synchronous Chrome API throws into a
    // rejection, so callers' existing catch handlers can handle them.
    return chrome.runtime.sendMessage(message);
  }
  function removeExtensionListener(event, listener) {
    try { event?.removeListener(listener); } catch { /* Already invalidated by Chrome. */ }
  }

  globalThis.YTCustomizer = Object.freeze({
    version: "143", defaults, assetDefaults, presets, tabKeys, audioKeys, normalize, normalizeAssets,
    pageScopes, profileKeys, cardKeys, normalizeProfiles, normalizePageAssets, pageScope, resolveSettings, resolveAssets, createBackup, parseBackup,
    isImageData, isBackgroundData, isYouTubeUrl, isSettingsPageUrl, iconDataUri,
    hasExtensionContext, sendRuntimeMessage, removeExtensionListener, isNativeFullscreenKey
  });
})();
