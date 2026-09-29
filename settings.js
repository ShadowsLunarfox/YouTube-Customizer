// Defines the settings contract shared by the popup and YouTube content scripts.
(() => {
  const defaults = Object.freeze({
    progressColor: "#ff3366",
    progressEffect: "solid",
    bufferColor: "#7a7a7a",
    thumbColor: "#ffffff",
    thumbStyle: "circle",
    barHeight: 5,
    thumbSize: 16,
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
  const tabKeys = Object.freeze({
    appearance: ["themeEnabled", "pageColor", "surfaceColor", "uiOpacity", "uiBlur", "textColor", "accentColor", "backgroundMode", "backgroundFit", "backgroundOpacity"],
    player: ["progressColor", "progressEffect", "bufferColor", "thumbColor", "thumbStyle", "barHeight", "thumbSize"],
    layout: ["videosPerRow", "disableVideoPreviews", "hideHomeTopicBar", "hideCreateButton", "hideNotificationsButton", "hideSidebarSubscriptions", "hideSidebarYou", "hideSidebarExplore", "hideSidebarMoreFromYouTube", "hideSidebarReportHistory", "relatedThumbnailWidth", "hideShorts", "hideRelated", "hideComments", "hideChat", "reduceAnimations"]
  });
  const ranges = { barHeight: [3, 14], thumbSize: [10, 34], backgroundOpacity: [0, 100], uiOpacity: [0, 100], uiBlur: [0, 30], videosPerRow: [2, 6], relatedThumbnailWidth: [72, 168] };
  const choices = {
    progressEffect: ["solid", "pulse", "shimmer", "rainbow"], thumbStyle: [...Object.keys(shapes), "custom"],
    backgroundMode: ["color", "image"], backgroundFit: ["cover", "contain", "tile"]
  };

  function normalize(settings = {}) {
    const result = {};
    for (const [key, fallback] of Object.entries(defaults)) {
      const value = settings?.[key];
      if (typeof fallback === "boolean") result[key] = typeof value === "boolean" ? value : fallback;
      else if (ranges[key]) {
        const number = Number(value);
        result[key] = value !== undefined && Number.isFinite(number)
          ? Math.min(ranges[key][1], Math.max(ranges[key][0], number)) : fallback;
      } else if (choices[key]) result[key] = choices[key].includes(value) ? value : fallback;
      else result[key] = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    }
    return result;
  }

  function isImageData(value) {
    return typeof value === "string" && value.length <= 7 * 1024 * 1024 &&
      /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-z0-9+/]+={0,2}$/i.test(value);
  }

  function isBackgroundData(value) {
    return typeof value === "string" && value.length <= 4 * Math.ceil(10 * 1024 * 1024 / 3) + 32 &&
      /^data:(?:image\/(?:png|jpeg|webp|gif|avif)|video\/mp4);base64,[a-z0-9+/]+={0,2}$/i.test(value);
  }

  function normalizeAssets(assets = {}) {
    return {
      customIconData: isImageData(assets.customIconData) ? assets.customIconData : "",
      backgroundImageData: isBackgroundData(assets.backgroundImageData) ? assets.backgroundImageData : ""
    };
  }

  function iconDataUri(style, color, customIconData = "") {
    if (style === "custom" && isImageData(customIconData)) return customIconData;
    const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : defaults.thumbColor;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="' +
      safeColor + '">' + (shapes[style] || shapes.circle) + "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  globalThis.YTCustomizer = Object.freeze({
    version: "77", defaults, assetDefaults, presets, tabKeys, normalize, normalizeAssets,
    isImageData, isBackgroundData, iconDataUri
  });
})();
