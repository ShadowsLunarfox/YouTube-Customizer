// Exercise the real output meter through authenticated messages and its live popup UI.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const rate = 48000, samples = rate * 2;
const wav = Buffer.alloc(44 + samples * 4);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 4, 40);
for (let i = 0; i < samples; i++) {
  const value = Math.round(32767 * .08 * Math.sin(2 * Math.PI * 440 * i / rate));
  wav.writeInt16LE(value, 44 + i * 4); wav.writeInt16LE(value, 46 + i * 4);
}
const fixture = `<!doctype html><div id="movie_player" class="html5-video-player"><video loop></video></div>
  <button id="play">Play</button><script>
  const video=document.querySelector('video');
  fetch('/tone.wav').then(r=>r.blob()).then(b=>video.src=URL.createObjectURL(b));
  document.querySelector('#play').onclick=()=>video.play();</script>`;

(async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chrome', headless: true, viewport: { width: 1200, height: 900 },
    ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging']
  });
  const deadline = setTimeout(() => void context.close(), 120000);
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill(
      route.request().url().endsWith('.wav') ? { contentType: 'audio/wav', body: wav } :
        { contentType: 'text/html', body: fixture }));
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: root });
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://www.youtube.com/watch?v=meter-fixture');
    await page.waitForSelector('#yt-custom-progress-style', { state: 'attached' });
    await page.waitForFunction(() => document.querySelector('video').readyState >= 3);
    await page.locator('#play').click();
    const popup = await context.newPage();
    popup.on('pageerror', error => errors.push(error.message));
    await popup.goto('chrome-extension://' + id + '/popup.html');
    const tabId = await popup.evaluate(async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/watch?v=meter-fixture' }))[0].id);
    await popup.goto(`chrome-extension://${id}/popup.html?window=1&target=${tabId}&panel=audio`);
    await popup.waitForSelector('#settings-form:not([inert])');
    const graphState = () => popup.evaluate(async tabId => {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => {
        const resources = YTCustomizerContent.audioResources;
        return { context: resources.context?.state || null, sources: resources.connected.size,
          route: resources.graphs.get(document.querySelector('video'))?.route || null };
      } });
      return result;
    }, tabId);
    const sample = () => popup.evaluate(tabId => chrome.tabs.sendMessage(tabId, { type: 'YT_AUDIO_METER' }, { frameId: 0 }).then(r => r.audio), tabId);
    const set = async settings => {
      await popup.evaluate(settings => chrome.storage.sync.set(settings), settings);
      await page.waitForTimeout(220);
    };
    await popup.waitForFunction(() => document.querySelector('#audioMeterState').textContent.includes('Enhancement off'));
    assert.equal((await graphState()).context, null, 'opening the meter while enhancement is off does not reroute native audio');
    assert.equal((await sample()).channels, null);
    await page.locator('video').evaluate(video => video.volume = .75);
    await popup.waitForFunction(() => document.querySelector('#audioNativeVolume').textContent.includes('75%'));
    await page.locator('video').evaluate(video => video.volume = 1);
    await popup.locator('#audioEnabled').check();
    await set({ audioLimiter: false });
    await popup.waitForFunction(() => document.querySelector('#audioMeterState').textContent.includes('Enhancement active'));
    const normal = await sample();
    assert.ok(Math.abs(normal.channels[0].peakDb - 20 * Math.log10(.08)) < .3, 'real sine peak is reported in dBFS');
    assert.ok(Math.abs(normal.channels[0].rmsDb - (normal.channels[0].peakDb - 3.01)) < .3, 'RMS differs from peak by 3 dB for a sine');
    assert.ok(Math.abs(normal.channels[0].rmsDb - normal.channels[1].rmsDb) < .1);
    await set({ volumeBoost: 300 });
    const boosted = await sample();
    assert.ok(Math.abs(boosted.channels[0].rmsDb - normal.channels[0].rmsDb - 20 * Math.log10(3)) < .4, 'meter observes boosted output');
    await popup.waitForFunction(() => document.querySelector('#audioAppliedBoost').textContent === '300% (+9.5 dB)');
    await page.locator('video').evaluate(video => video.volume = .25);
    await page.waitForTimeout(150);
    assert.ok(Math.abs((await sample()).channels[0].rmsDb - boosted.channels[0].rmsDb - 20 * Math.log10(.25)) < .4, 'native YouTube volume affects measured output');
    await page.locator('video').evaluate(video => video.volume = 1);
    await set({ audioBalance: -100, bassGain: 3, midGain: -2, trebleGain: 4, audioLimiter: true });
    const left = await sample();
    assert.ok(left.channels[0].peakDb > -30 && left.channels[1].peakDb === null, 'meter respects stereo balance');
    assert.deepEqual([left.parameters.volumeBoost, left.parameters.bassGain, left.parameters.midGain, left.parameters.trebleGain, left.parameters.audioBalance, left.parameters.audioLimiter], [300, 3, -2, 4, -100, true]);
    await popup.waitForFunction(() => document.querySelector('#audioAppliedEq').textContent === '+3 / -2 / +4 dB');
    await popup.waitForFunction(() => document.querySelector('#audioAppliedBalance').textContent === 'Left 100%');
    await set({ volumeBoost: 500, bassGain: 12, midGain: 12, trebleGain: 12, audioBalance: 0 });
    assert.ok((await sample()).reductionDb < -.1, 'limiter reports actual attenuation of a loud boosted signal');
    await page.locator('video').evaluate(video => video.muted = true);
    const muted = await sample();
    assert.equal(muted.playback, 'muted'); assert.equal(muted.channels[0].peakDb, null);
    await page.locator('video').evaluate(video => { video.muted = false; video.pause(); });
    assert.equal((await sample()).playback, 'paused'); assert.equal((await sample()).channels[0].rmsDb, null);
    await page.locator('#play').click(); await popup.bringToFront();
    await set({ audioEnabled: false });
    const bypass = await sample();
    assert.equal(bypass.parameters.volumeBoost, 100); assert.equal(bypass.parameters.audioBalance, 0);
    assert.equal(bypass.parameters.audioLimiter, false);
    assert.ok(Math.abs(bypass.channels[0].peakDb - normal.channels[0].peakDb) < .4, 'bypass parameters and samples reflect normal output');
    // Observe only the monitor tap, and ensure its expiry does not disconnect
    // the audible destination or reacquire a media source.
    await popup.evaluate(async tabId => {
      await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => {
        const graph = YTCustomizerContent.audioResources.graphs.get(document.querySelector('video'));
        globalThis.__meterDisconnects = [];
        const original = graph.output.disconnect.bind(graph.output);
        graph.output.disconnect = (...args) => { __meterDisconnects.push(args[0] instanceof ChannelSplitterNode ? 'tap' : 'output'); return original(...args); };
      } });
    }, tabId);
    await popup.locator('#tab-player').click();
    await page.waitForTimeout(1800);
    const disconnected = await popup.evaluate(async tabId => {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => __meterDisconnects }); return result;
    }, tabId);
    assert.deepEqual(disconnected, ['tap'], 'leaving Audio releases only the analysis branch');
    assert.equal((await graphState()).sources, 1);
    await popup.locator('#tab-audio').click();
    await set({ audioEnabled: true, volumeBoost: 200, bassGain: 3, midGain: -2, trebleGain: 4, audioBalance: 0 });
    await popup.evaluate(() => refreshStoredConfiguration());
    await popup.waitForFunction(() => Number.isFinite(parseFloat(document.querySelector('#audioLevelLeft').textContent)));
    for (const width of [480, 360]) {
      await popup.setViewportSize({ width, height: 760 });
      assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.tab-content').scrollWidth <= document.querySelector('.tab-content').clientWidth), true, 'audio monitor fits a narrow independent window');
      if (process.env.YTC_SCREENSHOTS) await popup.screenshot({ path: path.join(os.tmpdir(), `ytc-audio-meter-${width}.png`) });
    }
    await popup.close();
    await page.waitForTimeout(1800);
    // A separate trusted extension view can inspect cleanup without requesting samples.
    const check = await context.newPage(); await check.goto('chrome-extension://' + id + '/popup.html');
    const afterClose = await check.evaluate(async tabId => {
      const [{ result }] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: () => __meterDisconnects }); return result;
    }, tabId);
    assert.deepEqual(afterClose, ['tap', 'tap'], 'closing the settings view also expires sampling');
    assert.deepEqual(errors, []);
    console.log('PASS: real stereo RMS/peak dBFS, native volume, boost, EQ/pan/limiter parameter readouts, mute/pause/bypass, default-off native audio, narrow UI, and monitor cleanup without audio interruption.');
  } finally { clearTimeout(deadline); await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
