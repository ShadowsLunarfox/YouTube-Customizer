// Connects the settings form to storage and applies live previews to the active YouTube tab.
const {
  version: SCRIPT_VERSION, defaults: DEFAULT_SETTINGS, assetDefaults, presets, tabKeys,
  audioKeys, normalize, normalizeAssets, isImageData, isBackgroundData, isYouTubeUrl, iconDataUri,
  pageScopes, profileKeys, cardKeys, normalizeProfiles, normalizePageAssets, pageScope, resolveSettings, resolveAssets, createBackup, parseBackup
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
const settingsSearch = YTCustomizerSettingsSearch.create({ activateTab: tab => activateTab(tab) });
const localization = YTCustomizerI18n.create(document, document.getElementById("menuLanguage"), message => showStatus(message, true));
const assetControls = {
  customIconData: { input: "customIcon", upload: "uploadCustomIcon", remove: "removeCustomIcon" },
  backgroundImageData: { input: "backgroundImage", upload: "uploadBackground", remove: "removeBackground" }
};
let assets = { ...assetDefaults };
let sharedAssets = { ...assetDefaults };
let sharedSettings = { ...DEFAULT_SETTINGS };
let pageProfiles = {};
let pageAssets = {};
let editingScope = "shared";
let previewTabScope = "shared";
let storageWriteQueue = Promise.resolve();
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
const windowParameters = new URLSearchParams(location.search);
const isSettingsWindow = windowParameters.get("window") === "1";
const requestedTab = windowParameters.get("target");
let previewTabId = isSettingsWindow && /^\d+$/.test(requestedTab || "") && Number.isSafeInteger(Number(requestedTab))
  ? Number(requestedTab) : undefined;
const openWindowButton = document.getElementById("openWindow");
const pictureInPictureButton = document.getElementById("pictureInPicture");
const pictureInPictureStatus = document.getElementById("pictureInPictureStatus");
let pictureInPictureBusy = false;
let pictureInPictureRevision = 0;
let audioMeterTimer;
let audioMeterRevision = 0;
let audioMeterClosed = false;
if (isSettingsWindow) {
  document.documentElement.setAttribute("data-settings-window", "");
  openWindowButton.hidden = true;
}

async function getPreviewTab() {
  if (!isSettingsWindow) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  const pinned = previewTabId === undefined ? null : await chrome.tabs.get(previewTabId).catch(() => null);
  if (pinned && isYouTubeUrl(pinned.url)) return pinned;
  // The settings window is itself the current browser window. Reconnect to a
  // YouTube tab if its original tab closed or navigated to a different site.
  const candidates = await chrome.tabs.query({ active: true, url: ["https://*.youtube.com/*"] });
  const tab = candidates.filter(item => isYouTubeUrl(item.url)).sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  previewTabId = tab?.id;
  return tab;
}

async function updatePictureInPicture(action = "status") {
  if (pictureInPictureBusy) return;
  const revision = ++pictureInPictureRevision;
  const toggle = action === "toggle";
  if (toggle) {
    pictureInPictureBusy = true;
    pictureInPictureButton.disabled = true;
    pictureInPictureStatus.textContent = "Updating picture-in-picture...";
  }
  try {
    const tab = await getPreviewTab();
    if (!tab?.id || !isYouTubeUrl(tab.url)) throw new Error("Open a YouTube video to use picture-in-picture.");
    // executeScript preserves the extension button's user gesture. A background
    // message alone cannot reliably provide the activation needed by native PiP.
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: YTCustomizerPictureInPicture.execute, args: [action]
    });
    if (revision !== pictureInPictureRevision) return;
    const result = injection?.result;
    if (!result) throw new Error("Could not reach the video. Refresh YouTube and try again.");
    pictureInPictureButton.textContent = result.active ? "Return video to tab" : "Open floating video";
    pictureInPictureButton.setAttribute("aria-pressed", String(Boolean(result.active)));
    pictureInPictureStatus.textContent = result.error || (result.active
      ? "Picture-in-picture is open. You can keep watching while using other windows."
      : "Open the current video in a floating window. Click again to return it to its tab.");
  } catch (error) {
    if (revision !== pictureInPictureRevision) return;
    pictureInPictureButton.textContent = "Open floating video";
    pictureInPictureButton.setAttribute("aria-pressed", "false");
    pictureInPictureStatus.textContent = toggle && !error.message.startsWith("Open a YouTube")
      ? "Could not reach the video. Refresh YouTube and try again." : error.message;
  } finally {
    if (toggle) { pictureInPictureBusy = false; pictureInPictureButton.disabled = false; }
  }
}

pictureInPictureButton.addEventListener("click", () => void updatePictureInPicture("toggle"));

async function updateShortcuts() {
  const outputs = { _execute_action: 'shortcutMenu', 'toggle-picture-in-picture': 'shortcutPictureInPicture', 'toggle-audio-enhancement': 'shortcutAudio' };
  try {
    const commands = await chrome.commands.getAll();
    for (const [name, id] of Object.entries(outputs)) document.getElementById(id).textContent =
      commands.find(command => command.name === name)?.shortcut || 'Not assigned';
  } catch {
    for (const id of Object.values(outputs)) document.getElementById(id).textContent = 'Could not load shortcuts';
  }
}

document.getElementById('configureShortcuts').addEventListener('click', async () => {
  try {
    if (saveTimer !== undefined && !await saveSettings()) return;
    const scheme = /Edg\//.test(navigator.userAgent) ? 'edge' : 'chrome';
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const target = windows.find(window => window.focused) || windows[0];
    if (target) await chrome.tabs.create({ windowId: target.id, url: scheme + '://extensions/shortcuts' });
    else await chrome.windows.create({ url: scheme + '://extensions/shortcuts', type: 'normal' });
  } catch { showStatus('Could not open shortcut settings', true); }
});

function settingsWindowUrl(tabId, scope, panel) {
  const url = new URL(chrome.runtime.getURL("popup.html"));
  url.searchParams.set("window", "1");
  if (Number.isSafeInteger(tabId) && tabId >= 0) url.searchParams.set("target", tabId);
  url.searchParams.set("scope", scope);
  url.searchParams.set("panel", panel);
  return url.href;
}

async function loadStoredConfiguration() {
  const [local, settings] = await Promise.all([
    chrome.storage.local.get({ ...assetDefaults, pageProfiles: {}, pageAssets: {} }),
    chrome.storage.sync.get(DEFAULT_SETTINGS)
  ]);
  sharedAssets = normalizeAssets(local);
  sharedSettings = normalize(settings);
  pageProfiles = normalizeProfiles(local.pageProfiles);
  pageAssets = normalizePageAssets(local.pageAssets);
}

// Another menu can change settings while this window stays open. Refresh when
// returning to it so the next edit cannot overwrite that menu's saved values.
async function refreshStoredConfiguration() {
  if (!initialized || form.inert) return false;
  form.inert = true;
  try {
    if (saveTimer !== undefined && !await saveSettings()) return false;
    await storageWriteQueue;
    await loadStoredConfiguration();
    showSelectedScope();
    return true;
  } finally { form.inert = false; }
}

async function focusSettingsWindow(context) {
  await initializationPromise;
  if (!await refreshStoredConfiguration()) throw new Error("Finish the current operation in the settings window");
  if (Number.isSafeInteger(context.tabId) && context.tabId >= 0) previewTabId = context.tabId;
  editingScope = context.scope;
  showSelectedScope();
  activateTab(document.getElementById("tab-" + context.panel));
  history.replaceState(null, "", settingsWindowUrl(previewTabId, editingScope, activeTab));
  connectionPromise = undefined;
  lastSentAssets = {};
  void checkCurrentTabConnection();
  return chrome.windows.getCurrent();
}

openWindowButton.addEventListener("click", async () => {
  if (!initialized || form.inert) return;
  openWindowButton.disabled = true;
  form.inert = true;
  try {
    if (!await saveSettings()) return;
    const tab = await getPreviewTab();
    const context = { tabId: isYouTubeUrl(tab?.url) ? tab.id : undefined, scope: editingScope, panel: activeTab };
    const existing = chrome.extension.getViews({ type: "tab" }).find(view =>
      view !== window && view.location.origin === location.origin && view.location.pathname === location.pathname &&
      new URLSearchParams(view.location.search).get("window") === "1");
    if (existing) {
      const info = await existing.focusSettingsWindow(context);
      await chrome.windows.update(info.id, { focused: true, ...(info.state === "minimized" ? { state: "normal" } : {}) });
    } else {
      await chrome.windows.create({
        url: settingsWindowUrl(context.tabId, context.scope, context.panel),
        type: "popup", focused: true,
        width: Math.min(520, screen.availWidth || 520), height: Math.min(760, screen.availHeight || 760)
      });
    }
    window.close();
  } catch (error) { showStatus(error.message || "Could not open settings window", true, false); }
  finally { openWindowButton.disabled = false; form.inert = false; }
});

window.addEventListener("focus", async () => {
  try {
    if (await refreshStoredConfiguration()) void checkCurrentTabConnection();
    if (initialized && activeTab === "player") void updatePictureInPicture();
    if (initialized) void updateShortcuts();
    syncAudioMonitor();
  }
  catch { showStatus("Could not refresh settings", true); }
});

window.addEventListener("blur", () => {
  if (initialized && !form.inert && saveTimer !== undefined) void saveSettings();
});

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

function updateScopeControls() {
  document.getElementById("editingScope").value = editingScope;
  document.getElementById("pageProfileRow").hidden = editingScope === "shared";
  document.getElementById("pageProfileEnabled").checked = pageProfiles[editingScope]?.enabled === true;
  document.getElementById("scopeHint").textContent = editingScope === "shared"
    ? "Pages without separate settings use this configuration."
    : (pageProfiles[editingScope]?.enabled ? "Separate appearance and layout are active. " : "Using shared settings; editing appearance or layout creates a separate configuration. ") +
      "Player and Audio settings are shared.";
}

function captureForm(profileEdit = false) {
  const next = readForm();
  if (editingScope === "shared") sharedSettings = next;
  else {
    for (const key of Object.keys(DEFAULT_SETTINGS)) if (!profileKeys.includes(key)) sharedSettings[key] = next[key];
    if (profileEdit && !pageProfiles[editingScope]?.enabled) {
      pageProfiles[editingScope] = { enabled: true, settings: {} };
    }
    if (pageProfiles[editingScope]?.enabled) {
      pageProfiles[editingScope].settings = Object.fromEntries(profileKeys.map(key => [key, next[key]]));
    }
  }
  updateScopeControls();
}

function showSelectedScope() {
  assets = resolveAssets(sharedAssets, pageAssets, pageProfiles, editingScope);
  const settings = resolveSettings(sharedSettings, pageProfiles, editingScope);
  if (settings.thumbStyle === "custom" && !assets.customIconData) settings.thumbStyle = "circle";
  if (settings.backgroundMode === "image" && !assets.backgroundImageData) settings.backgroundMode = "color";
  writeForm(settings);
  updateScopeControls();
}

function updatePreview() {
  const videoBackground = assets.backgroundImageData.startsWith("data:video/mp4;");
  if (videoBackground && fields.backgroundFit.value === "tile") fields.backgroundFit.value = "cover";
  const settings = readForm();
  for (const id of ["barHeight", "thumbSize", "backgroundOpacity", "uiOpacity", "uiBlur", "relatedThumbnailWidth", ...cardKeys.filter(key => typeof DEFAULT_SETTINGS[key] === "number" && key !== "cardTitleLines")]) {
    document.getElementById(id + "Value").value = settings[id];
  }
  for (const id of ["volumeBoost", "bassGain", "midGain", "trebleGain"]) {
    document.getElementById(id + "Value").value = (id !== "volumeBoost" && settings[id] > 0 ? "+" : "") + settings[id];
  }
  document.getElementById("audioBalanceValue").value = settings.audioBalance === 0 ? "Center" :
    (settings.audioBalance < 0 ? "L " : "R ") + Math.abs(settings.audioBalance);
  for (const key of audioKeys) if (key !== "audioEnabled") fields[key].disabled = !settings.audioEnabled;
  for (const key of cardKeys) fields[key].disabled = !settings.customizeCards;
  updateAudioStatus();
  preview.style.setProperty("--progress-color", settings.progressColor);
  preview.dataset.effect = settings.progressEffect;
  preview.dataset.reduceAnimations = String(settings.reduceAnimations);
  preview.style.setProperty("--buffer-color", settings.bufferColor);
  preview.style.setProperty("--heatmap-color", settings.heatmapColor);
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

function updateAudioStatus(status) {
  const messages = {
    active: "Audio settings are active.",
    unsupported: "This video cannot be processed. Its original audio is preserved.",
    error: "Audio processing is unavailable for this player."
  };
  document.getElementById("audioStatus").textContent = !fields.audioEnabled.checked ? "Audio processing is off." :
    messages[status] || "Play a video to apply audio settings. Click the video once if needed.";
}

function renderAudioMonitor(audio, error) {
  const dbText = value => value === null ? "−∞" : (value > 0 ? "+" : "") + value.toFixed(1);
  for (const [index, side] of ["Left", "Right"].entries()) {
    const channel = audio?.channels?.[index];
    const meter = document.getElementById("audioMeter" + side);
    const percent = value => value === null || value === undefined ? 0 : Math.max(0, Math.min(100, (value + 60) / 60 * 100));
    meter.style.setProperty("--level", percent(channel?.rmsDb) + "%");
    meter.style.setProperty("--peak", percent(channel?.peakDb) + "%");
    meter.style.setProperty("--peak-visible", channel?.peakDb != null ? "1" : "0");
    meter.dataset.clipping = String(channel?.peakDb >= 0 && channel?.peakDb != null);
    meter.setAttribute("aria-valuenow", String(Math.max(-60, Math.min(0, channel?.rmsDb ?? -60))));
    meter.setAttribute("aria-valuetext", channel ? `RMS ${dbText(channel.rmsDb)} dBFS, peak ${dbText(channel.peakDb)} dBFS` : "Unavailable");
    document.getElementById("audioLevel" + side).textContent = (channel ? dbText(channel.peakDb) : "--") + " dBFS";
  }
  const parameters = audio?.parameters;
  document.getElementById("audioNativeVolume").textContent = "YouTube volume: " + (audio?.volume == null ? "--" : audio.volume + "%");
  const playback = { playing: "Playing", paused: "Paused", muted: "Muted", waiting: "Buffering", "no-video": "No video" };
  const processing = { off: "Enhancement off", active: "Enhancement active", ready: "Waiting for playback", unsupported: "Native audio", error: "Processing unavailable" };
  document.getElementById("audioMeterState").textContent = error ||
    [processing[audio?.status], playback[audio?.playback]].filter(Boolean).join(" · ") || "Connecting...";
  document.getElementById("audioMeterHint").textContent = error ? "Open a YouTube video, then return to Audio." :
    audio?.channels ? "Fill: RMS · White mark / value: peak · Output after effects (dBFS)." :
      audio?.status === "unsupported" ? "This video's native output cannot be metered safely." :
        "Enable audio enhancement and play a video to measure its output.";
  document.getElementById("audioAppliedBoost").textContent = parameters
    ? `${parameters.volumeBoost}% (${dbText(20 * Math.log10(parameters.volumeBoost / 100))} dB)` : "--";
  document.getElementById("audioAppliedBalance").textContent = !parameters ? "--" : parameters.audioBalance === 0 ? "Center" :
    (parameters.audioBalance < 0 ? "Left " : "Right ") + Math.abs(parameters.audioBalance) + "%";
  document.getElementById("audioAppliedEq").textContent = parameters
    ? [parameters.bassGain, parameters.midGain, parameters.trebleGain].map(value => (value > 0 ? "+" : "") + value).join(" / ") + " dB" : "--";
  document.getElementById("audioAppliedLimiter").textContent = !parameters ? "--" : parameters.audioLimiter
    ? `On · Reduction ${Math.abs(audio.reductionDb).toFixed(1)} dB` : "Off";
  if (audio) updateAudioStatus(audio.status);
}

function syncAudioMonitor() {
  clearTimeout(audioMeterTimer);
  const revision = ++audioMeterRevision;
  if (!initialized || audioMeterClosed || activeTab !== "audio" || document.hidden) return;
  renderAudioMonitor(null);
  async function sample() {
    try {
      // Read only: sampling must never reapply configuration or restart the theme.
      if (connectionPromise) await connectionPromise;
      const tab = await getPreviewTab();
      if (revision !== audioMeterRevision) return;
      if (!tab?.id || !isYouTubeUrl(tab.url)) throw new Error("No YouTube video connected");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "YT_AUDIO_METER" }, { frameId: 0 });
      if (response?.version !== SCRIPT_VERSION || !response.audio) throw new Error("Refresh YouTube to connect");
      if (revision === audioMeterRevision) renderAudioMonitor(response.audio);
    } catch {
      if (revision === audioMeterRevision) renderAudioMonitor(null, "No YouTube video connected");
    } finally {
      if (revision === audioMeterRevision) audioMeterTimer = setTimeout(sample, 100);
    }
  }
  void sample();
}

document.addEventListener("visibilitychange", syncAudioMonitor);

window.addEventListener("pagehide", () => {
  audioMeterClosed = true;
  syncAudioMonitor();
  if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
});

function showStatus(message = "Saved", isError = false, respectPreview = true) {
  clearTimeout(statusTimer);
  if (!isError && applicationError && respectPreview) { message = applicationError; isError = true; }
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
  if (!isError) statusTimer = setTimeout(() => { statusEl.textContent = "Ready"; }, 1600);
}

async function connectToCurrentTab() {
  const tab = await getPreviewTab();
  if (!tab?.id || !isYouTubeUrl(tab.url)) {
    throw new Error("Open YouTube to preview");
  }
  previewTabScope = pageScope(tab.url);
  // A chat/embed frame can run another script generation. Its reply must not
  // decide whether the main document needs to restart or has applied a preview.
  const ping = () => chrome.tabs.sendMessage(tab.id, { type: "YT_PROGRESS_PING" }, { frameId: 0 }).catch(() => null);
  let response = await ping();
  if (!response) {
    await new Promise(resolve => setTimeout(resolve, 80));
    response = await ping();
  }
  if (response?.version !== SCRIPT_VERSION) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["settings.js", "content/surface-controller.js", "content/shorts-controller.js", "content/homepage-glass.js", "content/home-shorts-grid.js", "content/audio-controller.js", "content/music-theme.js", "content/picture-in-picture.js", "yt.js"]
    });
    response = await ping();
  }
  if (response?.version !== SCRIPT_VERSION || !response.applied) throw new Error("Refresh YouTube and try again");
  updateAudioStatus(response.audioStatus);
  return tab.id;
}

async function checkCurrentTabConnection() {
  const attempt = connectToCurrentTab();
  connectionPromise = attempt;
  try {
    await attempt;
    if (connectionPromise !== attempt) return;
    applicationError = "";
    showStatus("Ready");
  } catch (error) {
    if (connectionPromise !== attempt) return;
    connectionPromise = undefined;
    applicationError = error.message === "Open YouTube to preview" ? error.message : "Refresh YouTube and try again";
    showStatus(applicationError, true);
  }
}

function applyToCurrentTab() {
  pendingPreview = { settings: { ...sharedSettings }, profiles: normalizeProfiles(pageProfiles), assets: { ...sharedAssets } };
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
      const message = { type: "YT_PROGRESS_LIVE_PREVIEW", settings: snapshot.settings, profiles: snapshot.profiles, assets: changedAssets };
      let response;
      try {
        response = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
        if (!response?.applied || response.version !== SCRIPT_VERSION) throw new Error("Reconnect");
      } catch {
        // A navigation can replace the content script while the popup stays open.
        lastSentAssets = {};
        connectionPromise = connectToCurrentTab();
        tabId = await connectionPromise;
        message.assets = snapshot.assets;
        response = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
      }
      if (response?.scope === "shared" || pageScopes.includes(response?.scope)) previewTabScope = response.scope;
      const expected = resolveSettings(snapshot.settings, snapshot.profiles, previewTabScope);
      if (!response?.applied || response.version !== SCRIPT_VERSION ||
          (expected.thumbStyle === "custom" && !response.hasCustomIcon) ||
          (expected.themeEnabled && expected.backgroundMode === "image" && !response.hasBackgroundImage)) {
        throw new Error("Refresh YouTube and try again");
      }
      lastSentAssets = snapshot.assets;
      updateAudioStatus(response.audioStatus);
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
  saveTimer = undefined;
  captureForm();
  const settings = { ...sharedSettings }, profiles = normalizeProfiles(pageProfiles);
  const write = storageWriteQueue.then(async () => {
    await chrome.storage.sync.set(settings);
    await chrome.storage.local.set({ pageProfiles: profiles });
  });
  storageWriteQueue = write.catch(() => {});
  try {
    await write;
    showStatus(message);
    return true;
  } catch {
    showStatus("Could not save settings", true);
    return false;
  }
}

function settingsChanged(commit = false, profileEdit = false) {
  captureForm(profileEdit);
  updatePreview();
  cancelAnimationFrame(previewFrame);
  previewFrame = requestAnimationFrame(applyToCurrentTab);
  clearTimeout(saveTimer);
  if (commit) void saveSettings();
  else saveTimer = setTimeout(() => void saveSettings(), 350);
}

function activateTab(tab, focus = false) {
  settingsSearch.clear();
  activeTab = tab.id.slice(4);
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute("aria-controls")).hidden = !selected;
  }
  document.querySelector(".tab-content").scrollTop = 0;
  document.getElementById("reset").disabled = activeTab === "backup";
  if (focus) tab.focus();
  if (initialized && activeTab === "player") void updatePictureInPicture();
  syncAudioMonitor();
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
  settingsChanged(true, true);
});

function onFormEdit(event) {
  if (!initialized || !Object.hasOwn(fields, event.target.id)) return;
  if (tabKeys.appearance.includes(event.target.id) && event.target.id !== "themeEnabled") {
    fields.themeEnabled.checked = true;
  }
  settingsChanged(event.type === "change", profileKeys.includes(event.target.id));
}
form.addEventListener("input", onFormEdit);
form.addEventListener("change", onFormEdit);
form.addEventListener("submit", event => event.preventDefault());

document.getElementById("editingScope").addEventListener("change", async event => {
  const next = event.target.value;
  event.target.disabled = true;
  try {
    if (!await saveSettings()) { updateScopeControls(); return; }
    editingScope = next;
    showSelectedScope();
  } finally { event.target.disabled = false; }
});

document.getElementById("pageProfileEnabled").addEventListener("change", event => {
  const enabled = event.target.checked;
  captureForm();
  pageProfiles[editingScope] = { settings: {}, ...pageProfiles[editingScope], enabled };
  showSelectedScope();
  settingsChanged(true);
});

async function storeAsset(key, data) {
  if (key === "backgroundImageData" && editingScope !== "shared") {
    const next = { ...pageAssets, [editingScope]: { backgroundImageData: data } };
    await chrome.storage.local.set({ pageAssets: next });
    pageAssets = next;
    captureForm(true);
  } else {
    if (data) await chrome.storage.local.set({ [key]: data });
    else await chrome.storage.local.remove(key);
    sharedAssets[key] = data;
  }
  assets = resolveAssets(sharedAssets, pageAssets, pageProfiles, editingScope);
}

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
    form.inert = true;
    document.getElementById("editingScope").disabled = true;
    try {
      const data = await readAsset(file, key);
      await storeAsset(key, data);
      if (key === "customIconData") fields.thumbStyle.value = "custom";
      else {
        fields.backgroundMode.value = "image";
        fields.themeEnabled.checked = true;
        if (data.startsWith("data:video/mp4;") && fields.backgroundFit.value === "tile") {
          fields.backgroundFit.value = "cover";
        }
      }
      updatePreview();
      captureForm(key === "backgroundImageData");
      applyToCurrentTab();
      await saveSettings(key === "backgroundImageData" ? "Background loaded" : "Image loaded");
    } catch (error) {
      showStatus(error.message || "Could not save file", true);
    } finally {
      upload.disabled = remove.disabled = false;
      document.getElementById("editingScope").disabled = false;
      form.inert = false;
    }
  });
  remove.addEventListener("click", async () => {
    form.inert = true;
    try {
      await storeAsset(key, "");
      if (key === "customIconData" && fields.thumbStyle.value === "custom") fields.thumbStyle.value = "circle";
      if (key === "backgroundImageData") fields.backgroundMode.value = "color";
      updatePreview();
      captureForm(key === "backgroundImageData");
      applyToCurrentTab();
      await saveSettings(key === "backgroundImageData" ? "Background removed" : "Image removed");
    } catch { showStatus("Could not remove file", true); }
    finally { form.inert = false; }
  });
}

document.querySelector("#reset").addEventListener("click", () => {
  if (!tabKeys[activeTab]) return;
  const settings = readForm();
  for (const key of tabKeys[activeTab]) settings[key] = DEFAULT_SETTINGS[key];
  writeForm(settings);
  settingsChanged(true, activeTab === "appearance" || activeTab === "layout");
});
document.querySelector("#resetAll").addEventListener("click", () => {
  sharedSettings = { ...DEFAULT_SETTINGS };
  pageProfiles = {};
  showSelectedScope();
  settingsChanged(true);
});
document.querySelector("#closePopup").addEventListener("click", async () => {
  await saveSettings();
  window.close();
});

document.getElementById("exportSettings").addEventListener("click", async () => {
  const button = document.getElementById("exportSettings");
  button.disabled = true;
  try {
    if (!await saveSettings()) return;
    const backup = createBackup(sharedSettings, pageProfiles, sharedAssets, pageAssets,
      document.getElementById("includeBackupMedia").checked);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "youtube-customizer-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    showStatus("Backup exported", false, false);
  } catch { showStatus("Could not export backup", true); }
  finally { button.disabled = false; }
});

async function validateBackupMedia(backup) {
  const media = new Set([...Object.values(backup.assets || {}),
    ...Object.values(backup.pageAssets || {}).map(item => item.backgroundImageData)]);
  for (const data of media) {
    if (!data) continue;
    if (!data.startsWith("data:video/mp4;")) {
      const image = new Image();
      image.src = data;
      try { await image.decode(); } catch { throw new Error("Backup contains an unreadable image"); }
    } else {
      const video = document.createElement("video");
      silenceVideo(video);
      video.preload = "metadata";
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Backup video could not be decoded")), 15000);
          video.onloadedmetadata = () => { clearTimeout(timeout); video.videoWidth && video.videoHeight ? resolve() : reject(new Error("Backup video has no picture")); };
          video.onerror = () => { clearTimeout(timeout); reject(new Error("Backup contains an unreadable video")); };
          video.src = data;
        });
      } finally { video.removeAttribute("src"); video.load(); }
    }
  }
}

document.getElementById("importSettings").addEventListener("click", () => document.getElementById("backupFile").click());
document.getElementById("backupFile").addEventListener("change", async event => {
  const [file] = event.target.files;
  event.target.value = "";
  if (!file) return;
  form.inert = true;
  try {
    if (!file.size || file.size > 150 * 1024 * 1024) throw new Error("Choose a JSON backup up to 150 MB");
    const backup = parseBackup(await file.text());
    await validateBackupMedia(backup);
    if (!await saveSettings()) throw new Error("Save current settings before importing");
    const local = { pageProfiles: backup.pageProfiles,
      ...(backup.assets || {}), ...(backup.pageAssets !== undefined ? { pageAssets: backup.pageAssets } : {}) };
    const previousLocal = await chrome.storage.local.get(Object.keys(local));
    await chrome.storage.local.set(local);
    try { await chrome.storage.sync.set(backup.settings); }
    catch (error) {
      await chrome.storage.local.set(previousLocal);
      const absent = Object.keys(local).filter(key => !Object.hasOwn(previousLocal, key));
      if (absent.length) await chrome.storage.local.remove(absent);
      throw error;
    }
    sharedSettings = backup.settings;
    pageProfiles = backup.pageProfiles;
    if (backup.assets) sharedAssets = backup.assets;
    if (backup.pageAssets !== undefined) pageAssets = backup.pageAssets;
    lastSentAssets = {};
    showSelectedScope();
    applyToCurrentTab();
    showStatus("Backup imported", false, false);
  } catch (error) { showStatus(error.message || "Could not import backup", true); }
  finally { form.inert = false; }
});

const initializationPromise = (async () => {
  try {
    const [, currentTab] = await Promise.all([loadStoredConfiguration(), getPreviewTab(), localization.ready]);
    const activeScope = pageScope(currentTab?.url);
    if (pageProfiles[activeScope]?.enabled) editingScope = activeScope;
    const requestedScope = windowParameters.get("scope"), requestedPanel = windowParameters.get("panel");
    if (isSettingsWindow && (requestedScope === "shared" || pageScopes.includes(requestedScope))) editingScope = requestedScope;
    showSelectedScope();
    if (isSettingsWindow && tabs.some(tab => tab.id === "tab-" + requestedPanel)) activateTab(document.getElementById("tab-" + requestedPanel));
    initialized = true;
    form.inert = false;
    openWindowButton.disabled = false;
    void updateShortcuts();
    void checkCurrentTabConnection();
    if (activeTab === "player") void updatePictureInPicture();
    syncAudioMonitor();
  } catch {
    showStatus("Could not load settings. Reopen the extension.", true);
  }
})();
