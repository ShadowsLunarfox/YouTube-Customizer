// Long-lived ownership and background queues must not retain retired page/media nodes.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    await page.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body:
      '<ytd-app><ytd-browse page-subtype="home"><ytd-rich-grid-renderer></ytd-rich-grid-renderer></ytd-browse>' +
      '<div id="movie_player" class="html5-video-player"><video></video></div></ytd-app>' }));
    await page.goto('https://www.youtube.com/');
    for (const file of ['settings.js', 'content/surface-controller.js', 'content/audio-controller.js']) {
      await page.addScriptTag({ path: path.join(root, file) });
    }
    const surfaces = await page.evaluate(async () => {
      const maps = [], sets = [], NativeMap = Map, NativeSet = Set;
      // Observe only the controller's ownership stores/queues, not each node's style map.
      globalThis.Map = class extends NativeMap { constructor(...args) { super(...args); maps.push(this); } };
      globalThis.Set = class extends NativeSet { constructor(...args) { super(...args); sets.push(this); } };
      const controller = YTCustomizerContent.createSurfaceController();
      globalThis.Map = NativeMap; globalThis.Set = NativeSet;
      const html = document.documentElement, feed = document.querySelector('ytd-rich-grid-renderer');
      html.setAttribute('data-ytc-theme', ''); html.setAttribute('data-ytc-custom-background', '');
      controller.apply(true);
      const observer = new MutationObserver(records => controller.handleMutations(records));
      observer.observe(document.body, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['style', 'class', 'role', 'hidden'] });
      const settle = () => new Promise(resolve => setTimeout(resolve, 180));
      for (let round = 0; round < 5; round++) {
        const batch = Array.from({ length: 40 }, () => {
          const node = document.createElement('div'); node.innerHTML = '<button>Menu</button>';
          feed.append(node); node.style.background = 'black'; return node;
        });
        await settle(); batch.forEach(node => node.remove()); await settle();
      }
      const detached = maps.map(store => [...store.keys()].filter(node => !node.isConnected).length);
      // A hidden tab can receive many DOM updates while its timers are throttled.
      let hidden = true;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event('visibilitychange'));
      let queuedPeak = 0;
      for (let round = 0; round < 100; round++) {
        const node = document.createElement('div'); node.innerHTML = '<button>Transient control</button>';
        feed.append(node); node.remove();
        await Promise.resolve();
        queuedPeak = Math.max(queuedPeak, ...sets.map(set => set.size));
      }
      const button = document.createElement('button'); button.textContent = 'Final native control'; feed.append(button);
      const fallback = document.createElement('div'); fallback.style.background = 'black'; feed.append(fallback);
      await Promise.resolve(); hidden = false; document.dispatchEvent(new Event('visibilitychange')); await settle();
      const restored = button.hasAttribute('data-ytc-universal-glass');
      const fallbackRestored = fallback.style.background.includes('--ytc-universal-glass');
      observer.disconnect(); controller.dispose();
      return { detached, queuedPeak, restored, fallbackRestored, released: maps.every(store => store.size === 0) };
    });
    console.log('Surface lifecycle:', surfaces);

    const audio = await page.evaluate(async () => {
      const samples = 48000 * 3, bytes = new ArrayBuffer(44 + samples * 2), view = new DataView(bytes);
      const text = (offset, str) => [...str].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
      text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVEfmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, 48000, true); view.setUint32(28, 96000, true); view.setUint16(32, 2, true);
      view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples * 2, true);
      for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin(i * 440 * 2 * Math.PI / 48000) * 1000, true);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      const resources = YTCustomizerContent.audioResources, controller = YTCustomizerContent.createAudioController();
      controller.sync({ ...YTCustomizer.defaults, audioEnabled: true });
      const player = document.querySelector('#movie_player');
      const observer = new MutationObserver(records => controller.handleMutations?.(records));
      observer.observe(player, { childList: true, subtree: true });
      let old;
      for (let round = 0; round < 16; round++) {
        const video = document.createElement('video'); video.loop = true; video.src = url;
        player.replaceChildren(video); await video.play(); controller.refresh();
        if (round === 0) old = video;
      }
      const retained = resources.connected.size, retiredRoute = resources.graphs.get(old)?.route;
      // Browsers may keep removed media playing. Its paused flag must not prevent cleanup.
      const retiredStillPlaying = !old.paused;
      const source = resources.graphs.get(old)?.source;
      player.replaceChildren(old); await old.play(); controller.refresh();
      const reused = resources.graphs.get(old)?.source === source && resources.graphs.get(old)?.route === 'processed';
      old.pause(); old.remove(); await new Promise(resolve => setTimeout(resolve, 150));
      const afterRemoval = resources.connected.size;
      observer.disconnect(); controller.dispose(); URL.revokeObjectURL(url);
      return { retained, retiredRoute, retiredStillPlaying, reused, afterRemoval };
    });
    console.log('Audio lifecycle:', audio);
    assert.ok(surfaces.detached.every(count => count === 0), 'all surface stores release removed elements');
    assert.ok(surfaces.queuedPeak <= 32, 'hidden tabs coalesce visual work instead of retaining historical subtrees');
    assert.ok(surfaces.restored && surfaces.fallbackRestored && surfaces.released,
      'resume styles current buttons and homepage fallback surfaces; disposal releases ownership');
    assert.equal(audio.retained, 1, 'replacing playing media retains only the current audio graph');
    assert.equal(audio.retiredRoute, 'detached', 'a retired playing element releases its audio-thread connections');
    assert.ok(audio.reused, 'reinserted native media reuses its original source without becoming silent');
    assert.equal(audio.afterRemoval, 0, 'removing the final player releases its graph without requiring another navigation');
    console.log('PASS: bounded surface/media resources through DOM churn, background resume, and player replacement.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
