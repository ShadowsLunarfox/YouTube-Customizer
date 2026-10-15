// Render production audio fades sample-by-sample, including changes before the first render quantum.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    async function render(mode) {
      const page = await browser.newPage();
      try {
        await page.route('https://www.youtube.com/**', route => route.fulfill({
          contentType: 'text/html', body: '<div id="movie_player"><video></video></div>'
        }));
        await page.goto('https://www.youtube.com/watch?v=continuity-fixture');
        await page.addScriptTag({ path: path.join(root, 'settings.js') });
        await page.addScriptTag({ path: path.join(root, 'content/audio-controller.js') });
        return await page.evaluate(async mode => {
          const context = new OfflineAudioContext(2, 48000 * .6, 48000);
          // Use a constant signal so every abrupt route change is measurable,
          // independently of a sine wave's phase or the machine's audio hardware.
          let sources = 0;
          let options;
          context.createMediaElementSource = () => {
            sources++;
            const source = context.createConstantSource();
            source.offset.value = .1;
            source.start();
            const stereo = context.createChannelMerger(2);
            source.connect(stereo, 0, 0);
            source.connect(stereo, 0, 1);
            return stereo;
          };
          // Let the controller build its graph before offline rendering begins.
          Object.defineProperty(context, 'state', { get: () => 'running' });
          globalThis.AudioContext = function(nextOptions) { options = nextOptions; return context; };
          const video = document.querySelector('video');
          Object.defineProperties(video, {
            paused: { get: () => false }, readyState: { get: () => 4 },
            currentSrc: { get: () => location.origin + '/tone.wav' }
          });
          const controller = YTCustomizerContent.createAudioController();
          const settings = { ...YTCustomizer.defaults, audioEnabled: true, volumeBoost: 300, audioLimiter: false };
          controller.sync(settings);
          if (mode === 'reverse') {
            // AudioParam.value is still its original value at t=0. Returning to
            // it must cancel the pending boost rather than silently keeping it.
            controller.sync({ ...settings, volumeBoost: 100 });
            controller.sync({ ...settings, volumeBoost: 100, audioEnabled: false });
            controller.sync({ ...settings, volumeBoost: 100 });
          }
          const times = mode === 'switch' ? [.15, .3, .45] : mode === 'events' ? [.01, .02, .03] : [];
          const stops = times.map(time => context.suspend(time));
          const rendering = context.startRendering();
          for (let i = 0; i < stops.length; i++) {
            await stops[i];
            if (mode === 'switch') {
              controller.sync({ ...settings, audioEnabled: i !== 0, audioLimiter: i === 1 });
            } else {
              video.dispatchEvent(new Event('playing'));
              video.dispatchEvent(new Event('volumechange'));
            }
            await context.resume();
          }
          const rendered = await rendering;
          const samples = rendered.getChannelData(0);
          let maxStep = 0;
          let maxStepAt = 0;
          let minimum = Infinity;
          for (let i = 1; i < samples.length; i++) {
            const step = Math.abs(samples[i] - samples[i - 1]);
            if (step > maxStep) { maxStep = step; maxStepAt = i / context.sampleRate; }
            minimum = Math.min(minimum, samples[i]);
          }
          const sampleAt = time => samples[Math.floor(time * context.sampleRate)];
          const result = { maxStep, maxStepAt, minimum, sources, options, middle: sampleAt(.29),
            tail: sampleAt(.59), envelope: Array.from(samples.slice(480, 2400)) };
          controller.dispose();
          return result;
        }, mode);
      } finally { await page.close(); }
    }

    const switched = await render('switch');
    assert.ok(switched.maxStep < .001, `route changes must fade without a sample discontinuity: ${JSON.stringify({ maxStep: switched.maxStep, at: switched.maxStepAt, minimum: switched.minimum, middle: switched.middle, tail: switched.tail })}`);
    assert.ok(switched.minimum > .09, `route changes must not create a silent gap: ${switched.minimum}`);
    assert.ok(Math.abs(switched.middle - .1) < .001, 'bypass settles to the unprocessed signal');
    assert.ok(Math.abs(switched.tail - .3) < .001, 'processed output returns to the boosted signal');
    assert.equal(switched.sources, 1, 'all switches reuse the source');
    assert.equal(switched.options.latencyHint, 'playback', 'prioritize uninterrupted playback during page interactions');

    const reversed = await render('reverse');
    assert.ok(Math.abs(reversed.tail - .1) < .001, `a quick reversal must cancel the pending boost: ${reversed.tail}`);
    assert.ok(reversed.maxStep < .001, 'rapid enable/disable/re-enable does not click');

    const reference = await render('reference');
    const events = await render('events');
    const difference = Math.max(...reference.envelope.map((value, i) => Math.abs(value - events.envelope[i])));
    assert.ok(difference < .000001, `playing/volume events must not restart active fades: ${difference}`);
    console.log(`PASS: sample-continuous bypass/limiter fades (max step ${switched.maxStep.toFixed(6)}), no silent gaps, rapid reversal, unchanged fade envelopes across media events, source reuse, and playback buffering.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
