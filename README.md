# 🌸 YouTube Customizer
<!-- Project overview, feature reference, and usage guide. -->

🌸 · ✿ · 🌸 · ✿ · 🌸

## 🌸 About

YouTube Customizer is a browser extension for personalizing YouTube. It lets you restyle the page, customize the video progress bar, and hide or compact parts of YouTube's interface. The extension has an English settings UI with a Windows 98-inspired look, and changes are previewed on YouTube as you make them.

## ✿ Features

### 🎨 Appearance

- Enable or disable a custom page theme, with Charcoal, Light, Forest, and Windows Classic presets.
- Customize page, surface, text, and accent colors.
- Set a shared UI opacity from 0% (transparent) to 100% (opaque).
- Apply frosted glass to themed UI panels with the **UI blur** slider (0–30 px; 12 px by default). Set it to 0 px to turn blur off; lower UI opacity makes the blurred background more visible.
- Upload a background image or GIF; choose Fill, Fit, or Tile and adjust its opacity.
- YouTube ambient lighting is suppressed while a custom background is active and restored when it is no longer active.

### ▶️ Player

- Change the progress and buffered-segment colors, progress-bar thickness, and scrubber size.
- Choose a solid, pulsing glow, moving shimmer, or cycling rainbow progress effect.
- Choose a built-in scrubber shape or upload a custom image/GIF.

### 🧩 Layout

- Set the maximum number of videos per row from 2 to 6.
- Disable hover previews on Home, search results, and related-video cards on the watch page, and reduce motion.
- Hide Shorts shelves and links, the topic filter bar, the Create button, or the notifications button.
- Independently hide Subscriptions, You, Explore, More from YouTube, and Report history in the sidebar.
- Adjust related-video thumbnail width from 72 to 168 pixels, or hide related videos entirely.
- Hide comments or live chat.

## 🌸 Installation

YouTube Customizer is a Manifest V3 extension for Chromium-based browsers such as Google Chrome and Microsoft Edge.

1. Download or clone this project to your computer.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**.
4. Select **Load unpacked**.
5. Choose the project folder containing `manifest.json`.
6. Open or refresh YouTube, then pin YouTube Customizer from the browser's Extensions menu for convenient access.

## ✿ Getting Started

1. Open YouTube and click the YouTube Customizer icon in the browser toolbar.
2. In **Appearance**, enable **Enable page theme** to customize YouTube's page colors. Choose a preset or set your own colors, opacity, and frosted-glass blur with **UI blur**.
3. To use a wallpaper, select **Upload...**, choose an image or GIF, then set its fit and opacity.
4. In **Player**, choose progress colors and an effect, then adjust the bar and scrubber. Select **Custom image** to use an uploaded scrubber image or GIF.
5. In **Layout**, choose the video grid column limit and adjust the controls under **Video browsing**, **Header**, **Sidebar**, **Watch page**, and **Performance**. Each hide option works independently.
6. Changes are applied to the current YouTube tab while you adjust settings. Reopen the popup to continue editing; use **Reset tab** or **Reset all** to restore defaults.

## 🖼️ Image Uploads and Storage

Backgrounds and custom scrubber images support PNG, JPEG, WebP, AVIF, and GIF. Each file must be no larger than 5 MB. GIF animation is preserved. Uploaded images are stored locally in the browser. Settings are saved with browser sync storage and may sync across browsers signed in to the same browser account.

## 🔄 Updating

After changing the extension files, open the browser's extensions page and click the extension's reload button. Refresh any open YouTube tabs to load the updated content scripts.

## 🌸 Project Structure

- `manifest.json` defines the extension metadata, permissions, and content scripts.
- `settings.js` contains shared defaults, validation, and presets.
- `popup.html`, `popup.css`, and `popup.js` implement the extension settings UI.
- `yt.js` applies the player, appearance, and layout customizations on YouTube.
- `content/` contains controllers for surfaces, homepage styling, and Shorts handling.
