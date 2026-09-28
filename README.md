<div align="center">
  <img src="assets/logo.png" alt="YouTube Customizer logo" width="220">
  <h1>🌸 YouTube Customizer</h1>
  <p><strong>Make YouTube look and feel like your own.</strong></p>
  <p>
    <kbd>🧩 Manifest V3</kbd>
    <kbd>🌐 Chrome</kbd>
    <kbd>🌐 Microsoft Edge</kbd>
    <kbd>🎨 Live preview</kbd>
  </p>
</div>

<hr>

> Customize YouTube's appearance, player, and layout. Changes are previewed on the current YouTube tab as you adjust the settings.

## ✨ Features at a glance

| Section | What you can customize |
| --- | --- |
| 🎨 **Appearance** | Page theme, colors, opacity, frosted glass, background images, and GIFs |
| ▶️ **Player** | Progress and buffer colors, bar thickness, scrubber shape, and effects |
| 🧩 **Layout** | Video grid, hover previews, Shorts, sidebar, comments, and live chat |

### 🎨 Appearance

- Choose the **Charcoal**, **Light**, **Forest**, or **Windows Classic** theme, or set your own page, surface, text, and accent colors.
- Adjust UI opacity from 0–100% and frosted-glass blur from 0–30 px.
- Upload a background image or GIF, choose Fill, Fit, or Tile, and adjust its opacity.
- YouTube ambient lighting is suppressed while a custom background is active.

### ▶️ Player

- Customize progress and buffered-segment colors, progress-bar thickness, and scrubber size.
- Choose a solid color, pulsing glow, moving shimmer, or cycling rainbow effect.
- Pick a built-in scrubber shape or upload a custom image or GIF.

### 🧩 Layout and browsing

- Set the Home video grid to 2–6 videos per row. Disable hover previews or reduce motion.
- Hide Shorts, the topic filter bar, the Create button, or the notifications button.
- Independently hide Subscriptions, You, Explore, More from YouTube, and Report history in the sidebar.
- Adjust related-video thumbnail width, or hide related videos, comments, or live chat.

## 🚀 Installation

YouTube Customizer is a Manifest V3 extension for Chromium-based browsers, including Google Chrome and Microsoft Edge.

1. Download or clone this project and extract it to a folder on your computer.
2. Open the extensions page: enter `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the project root folder containing `manifest.json`.
6. Open YouTube. You can pin YouTube Customizer from the browser's Extensions menu for quick access.

## 🪄 Getting started

1. Open YouTube and click the extension icon in the browser toolbar.
2. In **Appearance**, enable **Enable page theme**, choose a theme, and adjust its colors, opacity, or blur.
3. In **Wallpaper**, upload a background image. In **Player**, customize the progress bar and scrubber.
4. In **Layout**, hide page elements or adjust the video layout as needed.
5. Changes are previewed live and saved automatically. Use **Reset tab** to reset the current settings section, or **Reset all** to restore the default settings.

## 🖼️ Images and settings storage

- Supported image formats: PNG, JPEG, WebP, AVIF, and GIF. Each image must be no larger than **5 MB**. GIF animation is preserved.
- Theme and layout settings are stored in browser sync storage. Whether they sync across devices depends on your browser account's sync settings.
- Uploaded backgrounds and custom scrubber images are stored locally in the current browser and do not sync with your settings.

## 🔄 Updating

After changing or updating the project files, open the browser's extensions page and click the extension's **Reload** button. Then refresh any open YouTube tabs.

<details>
  <summary>🛠️ Frequently asked questions</summary>

  **Settings are not being applied to YouTube.**

  Make sure the active tab is open to YouTube. After reloading the extension, refresh the YouTube page.

  **My background image did not sync to another browser.**

  Backgrounds and custom scrubber images are stored locally. Theme and layout settings are the items saved to browser sync storage.

  **How do I undo my changes?**

  Use **Reset tab** to reset the current settings section, or **Reset all** to restore all default settings.
</details>

## 📁 Project structure

| File / folder | Purpose |
| --- | --- |
| `assets/logo.png` | Original project logo |
| `icons/` | Extension icons derived from the logo at 16, 32, 48, and 128 px |
| `manifest.json` | Extension metadata, icons, permissions, and content-script configuration |
| `settings.js` | Default settings, validation, and theme presets |
| `popup.html`, `popup.css`, `popup.js` | Extension settings popup |
| `yt.js`, `content/` | YouTube page styling and feature controllers |
| `tests/` | Regression and browser smoke-test scripts |

<div align="center">
  <sub>🌸 Add a little of your own style to YouTube.</sub>
</div>
