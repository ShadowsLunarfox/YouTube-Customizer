// Connects the settings form to storage and applies live previews to the active YouTube tab.
const {
  version: SCRIPT_VERSION, defaults: DEFAULT_SETTINGS, assetDefaults, presets, tabKeys,
  normalize, normalizeAssets, isImageData, isBackgroundData, isYouTubeUrl, iconDataUri
} = YTCustomizer;

const form = document.querySelector("#settings-form");
const fields = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key => [key, document.getElementById(key)]));
const statusEl = document.querySelector("#status");
const themePreset = document.querySelector("#themePreset");
const preview = document.querySelector(".preview");
const previewThumb = document.querySelector(".preview-thumb");
const themePreview = document.querySelector(".theme-preview");
const themePreviewVideo = document.querySelector(".theme-preview-wallpaper");
const tabs = [...document.querySelectorAll('[role="tab"]')];
const assetControls = {
  customIconData: { input: "customIcon", upload: "uploadCustomIcon", remove: "removeCustomIcon" },
  backgroundImageData: { input: "backgroundImage", upload: "uploadBackground", remove: "removeBackground" }
};
let assets = { ...assetDefaults };
let activeTab = "appearance";
let saveTimer;
let statusTimer;
let previewFrame;
let connectionPromise;
let pendingPreview;
let previewInFlight = false;
let lastSentAssets = {};
let applicationError = "";
let initialized = false;
let previewVideoData = "";
let previewImageData = "";
let previewImageUrl = "";

function silenceVideo(video) {
  video.defaultMuted = true;
  video.muted = true;
  video.volume = 0;
}

themePreviewVideo.addEventListener("volumechange", () => silenceVideo(themePreviewVideo));

function readForm() {
  return normalize(Object.fromEntries(Object.entries(fields).map(([key, input]) => [
    key, input.type === "checkbox" ? input.checked : input.value
  ])));
}

function writeForm(settings) {
  const next = normalize(settings);
  for (const [key, input] of Object.entries(fields)) {
    if (input.type === "checkbox") input.checked = next[key];
    else input.value = next[key];
  }
  updatePreview();
}

function updatePreview() {
  const videoBackground = assets.backgroundImageData.startsWith("data:video/mp4;");
  if (videoBackground && fields.backgroundFit.value === "tile") fields.backgroundFit.value = "cover";
  const settings = readForm();
  for (const id of ["barHeight", "thumbSize", "backgroundOpacity", "uiOpacity", "uiBlur", "relatedThumbnailWidth"]) {
    document.getElementById(id + "Value").value = settings[id];
  }
  preview.style.setProperty("--progress-color", settings.progressColor);
  preview.dataset.effect = settings.progressEffect;
  preview.dataset.reduceAnimations = String(settings.reduceAnimations);
  preview.style.setProperty("--buffer-color", settings.bufferColor);
  preview.style.setProperty("--bar-height", settings.barHeight + "px");
  preview.style.setProperty("--thumb-size", settings.thumbSize + "px");
  previewThumb.style.backgroundImage = 'url("' + iconDataUri(settings.thumbStyle, settings.thumbColor, assets.customIconData) + '")';
  fields.thumbColor.disabled = settings.thumbStyle === "custom";

  const theme = settings.themeEnabled ? settings : DEFAULT_SETTINGS;
  themePreview.style.setProperty("--theme-ui-opacity", settings.themeEnabled ? settings.uiOpacity + "%" : "100%");
  themePreview.style.setProperty("--theme-backdrop-filter", settings.themeEnabled && settings.uiBlur > 0 ? "blur(" + settings.uiBlur + "px)" : "none");
  for (const [css, key] of [["page", "pageColor"], ["surface", "surfaceColor"], ["text", "textColor"], ["accent", "accentColor"]]) {
    themePreview.style.setProperty("--theme-" + css, theme[key]);
  }
  const withImage = settings.themeEnabled && settings.backgroundMode === "image" &&
    assets.backgroundImageData && !videoBackground;
  const withVideo = settings.themeEnabled && settings.backgroundMode === "image" && videoBackground;
  if (withImage && previewImageData !== assets.backgroundImageData) {
    const data = assets.backgroundImageData;
    const binary = atob(data.slice(data.indexOf(",") + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: data.slice(5, data.indexOf(";")) }));
    if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    previewImageUrl = url;
    previewImageData = data;
  } else if (!withImage && previewImageUrl) {
    URL.revokeObjectURL(previewImageUrl);
    previewImageUrl = "";
    previewImageData = "";
  }
  themePreview.style.backgroundImage = withImage && previewImageUrl
    ? 'linear-gradient(color-mix(in srgb, ' + settings.pageColor + ' ' + (100 - settings.backgroundOpacity) + '%, transparent), color-mix(in srgb, ' + settings.pageColor + ' ' + (100 - settings.backgroundOpacity) + '%, transparent)), url("' + previewImageUrl + '")'
    : "none";
  themePreview.style.backgroundSize = settings.backgroundFit === "tile" ? "auto, 32px" : settings.backgroundFit;
  themePreview.style.backgroundRepeat = settings.backgroundFit === "tile" ? "repeat" : "no-repeat";
  if (withVideo) {
    if (previewVideoData !== assets.backgroundImageData) {
      previewVideoData = assets.backgroundImageData;
      silenceVideo(themePreviewVideo);
      themePreviewVideo.src = previewVideoData;
    }
    themePreviewVideo.style.objectFit = settings.backgroundFit;
    themePreviewVideo.style.opacity = String(settings.backgroundOpacity / 100);
    themePreviewVideo.hidden = false;
    void themePreviewVideo.play().catch(() => {});
  } else {
    themePreviewVideo.pause();
    themePreviewVideo.hidden = true;
    if (!videoBackground && previewVideoData) {
      previewVideoData = "";
      themePreviewVideo.removeAttribute("src");
      themePreviewVideo.load();
    }
  }
  themePreset.value = !settings.themeEnabled ? "original" :
    Object.keys(presets).find(name => Object.entries(presets[name]).every(([key, value]) => settings[key] === value)) || "custom";
  fields.thumbStyle.querySelector('[value="custom"]').disabled = !assets.customIconData;
  fields.backgroundMode.querySelector('[value="image"]').disabled = !assets.backgroundImageData;
  fields.backgroundFit.querySelector('[value="tile"]').disabled = videoBackground;
  for (const [key, control] of Object.entries(assetControls)) {
    document.getElementById(control.remove).hidden = !assets[key];
  }
  for (const key of ["backgroundFit", "backgroundOpacity"]) {
    fields[key].disabled = !assets.backgroundImageData || settings.backgroundMode !== "image";
  }
}

window.addEventListener("pagehide", () => {
  if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
});

function showStatus(message = "Saved", isError = false) {
  clearTimeout(statusTimer);
  if (!isError && applicationError) { message = applicationError; isError = true; }
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
  if (!isError) statusTimer = setTimeout(() => { statusEl.textContent = "Ready"; }, 1600);
}

async function connectToCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isYouTubeUrl(tab.url)) {
    throw new Error("Open YouTube to preview");
  }
  let response = await chrome.tabs.sendMessage(tab.id, { type: "YT_PROGRESS_PING" }).catch(() => null);
  if (response?.version !== SCRIPT_VERSION) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["settings.js", "content/surface-controller.js", "content/shorts-controller.js", "content/homepage-glass.js", "yt.js"]
    });
    response = await chrome.tabs.sendMessage(tab.id, { type: "YT_PROGRESS_PING" });
  }
  if (response?.version !== SCRIPT_VERSION || !response.applied) throw new Error("Refresh YouTube and try again");
  return tab.id;
}

function applyToCurrentTab() {
  pendingPreview = { settings: readForm(), assets: { ...assets } };
  void flushLivePreview();
}

async function flushLivePreview() {
  if (previewInFlight) return;
  previewInFlight = true;
  try {
    connectionPromise ||= connectToCurrentTab();
    let tabId = await connectionPromise;
    while (pendingPreview) {
      const snapshot = pendingPreview;
      pendingPreview = null;
      const changedAssets = Object.fromEntries(Object.entries(snapshot.assets).filter(([key, value]) => lastSentAssets[key] !== value));
      const message = { type: "YT_PROGRESS_LIVE_PREVIEW", settings: snapshot.settings, assets: changedAssets };
      let response;
      try {
        response = await chrome.tabs.sendMessage(tabId, message);
        if (!response?.applied || response.version !== SCRIPT_VERSION) throw new Error("Reconnect");
      } catch {
        // A navigation can replace the content script while the popup stays open.
        lastSentAssets = {};
        connectionPromise = connectToCurrentTab();
        tabId = await connectionPromise;
        message.assets = snapshot.assets;
        response = await chrome.tabs.sendMessage(tabId, message);
      }
      if (!response?.applied || response.version !== SCRIPT_VERSION ||
          (snapshot.settings.thumbStyle === "custom" && !response.hasCustomIcon) ||
          (snapshot.settings.themeEnabled && snapshot.settings.backgroundMode === "image" && !response.hasBackgroundImage)) {
        throw new Error("Refresh YouTube and try again");
      }
      lastSentAssets = snapshot.assets;
      applicationError = "";
      showStatus("Applied");
    }
  } catch (error) {
    connectionPromise = undefined;
    lastSentAssets = {};
    pendingPreview = null;
    applicationError = error.message === "Open YouTube to preview" ? error.message : "Refresh YouTube and try again";
    showStatus(applicationError, true);
  } finally {
    previewInFlight = false;
  }
}

async function saveSettings(message = "Saved") {
  clearTimeout(saveTimer);
  try {
    await chrome.storage.sync.set(readForm());
    showStatus(message);
  } catch {
    showStatus("Could not save settings", true);
  }
}

function settingsChanged(commit = false) {
  updatePreview();
  cancelAnimationFrame(previewFrame);
  previewFrame = requestAnimationFrame(applyToCurrentTab);
  clearTimeout(saveTimer);
  if (commit) void saveSettings();
  else saveTimer = setTimeout(() => void saveSettings(), 350);
}

function activateTab(tab, focus = false) {
  activeTab = tab.id.slice(4);
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
  }
  document.querySelector(".tab-content").scrollTop = 0;
  if (focus) tab.focus();
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", event => {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length :
      event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length :
      event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); activateTab(tabs[next], true); }
  });
});

themePreset.addEventListener("change", () => {
  if (themePreset.value === "original") fields.themeEnabled.checked = false;
  else if (presets[themePreset.value]) {
    writeForm({ ...readForm(), ...presets[themePreset.value], themeEnabled: true });
  } else fields.themeEnabled.checked = true;
  settingsChanged(true);
});

function onFormEdit(event) {
  if (!initialized || !Object.hasOwn(fields, event.target.id)) return;
  if (tabKeys.appearance.includes(event.target.id) && event.target.id !== "themeEnabled") {
    fields.themeEnabled.checked = true;
  }
  settingsChanged(event.type === "change");
}
form.addEventListener("input", onFormEdit);
form.addEventListener("change", onFormEdit);
form.addEventListener("submit", event => event.preventDefault());

function readAsset(file, key) {
  return new Promise((resolve, reject) => {
    const background = key === "backgroundImageData";
    const video = background && (file.type === "video/mp4" || /\.mp4$/i.test(file.name));
    if (!video && !/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) {
      return reject(new Error(background ? "Choose a PNG, JPEG, WebP, GIF, AVIF, or MP4 file" : "Unsupported image format"));
    }
    const limit = (background ? 20 : 5) * 1024 * 1024;
    if (!file.size || file.size > limit) {
      return reject(new Error(`Choose a file no larger than ${background ? 20 : 5} MB`));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = async () => {
      try {
        const data = video ? "data:video/mp4;base64," + reader.result.split(",")[1] : reader.result;
        if (!(background ? isBackgroundData(data) : isImageData(data))) throw new Error();
        if (video) {
          const preview = document.createElement("video");
          silenceVideo(preview);
          preview.preload = "metadata";
          const url = URL.createObjectURL(file);
          try {
            await new Promise((done, fail) => {
              const timeout = setTimeout(() => fail(new Error("Video metadata timed out")), 15000);
              preview.onloadedmetadata = () => { clearTimeout(timeout); done(); };
              preview.onerror = () => { clearTimeout(timeout); fail(new Error("Video cannot be decoded")); };
              preview.src = url;
            });
            if (!preview.videoWidth || !preview.videoHeight) throw new Error("No video track");
          } finally {
            preview.removeAttribute("src");
            preview.load();
            URL.revokeObjectURL(url);
          }
        } else {
          const image = new Image();
          image.src = data;
          await image.decode();
        }
        resolve(data);
      } catch { reject(new Error(video ? "Invalid or unsupported MP4 file" : "Invalid image file")); }
    };
    reader.readAsDataURL(file);
  });
}

for (const [key, control] of Object.entries(assetControls)) {
  const input = document.getElementById(control.input);
  const upload = document.getElementById(control.upload);
  const remove = document.getElementById(control.remove);
  upload.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const [file] = input.files;
    input.value = "";
    if (!file) return;
    upload.disabled = remove.disabled = true;
    try {
      const data = await readAsset(file, key);
      await chrome.storage.local.set({ [key]: data });
      assets[key] = data;
      if (key === "customIconData") fields.thumbStyle.value = "custom";
      else {
        fields.backgroundMode.value = "image";
        fields.themeEnabled.checked = true;
        if (data.startsWith("data:video/mp4;") && fields.backgroundFit.value === "tile") {
          fields.backgroundFit.value = "cover";
        }
      }
      updatePreview();
      applyToCurrentTab();
      await saveSettings(key === "backgroundImageData" ? "Background loaded" : "Image loaded");
    } catch (error) {
      showStatus(error.message || "Could not save file", true);
    } finally {
      upload.disabled = remove.disabled = false;
    }
  });
  remove.addEventListener("click", async () => {
    try {
      await chrome.storage.local.remove(key);
      assets[key] = "";
      if (key === "customIconData" && fields.thumbStyle.value === "custom") fields.thumbStyle.value = "circle";
      if (key === "backgroundImageData") fields.backgroundMode.value = "color";
      updatePreview();
      applyToCurrentTab();
      await saveSettings(key === "backgroundImageData" ? "Background removed" : "Image removed");
    } catch { showStatus("Could not remove file", true); }
  });
}

document.querySelector("#reset").addEventListener("click", () => {
  const settings = readForm();
  for (const key of tabKeys[activeTab]) settings[key] = DEFAULT_SETTINGS[key];
  writeForm(settings);
  settingsChanged(true);
});
document.querySelector("#resetAll").addEventListener("click", () => {
  writeForm(DEFAULT_SETTINGS);
  settingsChanged(true);
});
document.querySelector("#closePopup").addEventListener("click", async () => {
  await saveSettings();
  window.close();
});

(async () => {
  try {
    const [local, settings] = await Promise.all([
      chrome.storage.local.get(assetDefaults), chrome.storage.sync.get(DEFAULT_SETTINGS)
    ]);
    assets = normalizeAssets(local);
    if (settings.thumbStyle === "custom" && !assets.customIconData) settings.thumbStyle = "circle";
    if (settings.backgroundMode === "image" && !assets.backgroundImageData) settings.backgroundMode = "color";
    writeForm(settings);
    initialized = true;
    form.inert = false;
    applyToCurrentTab();
  } catch {
    showStatus("Could not load settings. Reopen the extension.", true);
  }
})();
