// Processes native player audio without touching playback, volume, mute, or media URLs.
(() => {
  const runtime = globalThis.YTCustomizerContent ||= {};
  if (runtime.audioVersion === YTCustomizer.version) return;
  const PLAYER_VIDEO_SELECTOR = ':is(#movie_player, #shorts-player, ytd-reel-video-renderer, ytd-miniplayer, .html5-video-player) video';
  const EXCLUDED_SCOPE = '#ytc-background-video, #inline-player, #inline-preview-player, ' +
    'ytd-thumbnail, yt-thumbnail-view-model, ytd-video-preview, ytd-video-preview-portal';
  const MEDIA_EVENTS = ['play', 'playing', 'loadeddata', 'emptied', 'volumechange'];
  // Media elements can only acquire one source node. Keep nodes across content-script
  // reinjection, and bypass them on disposal instead of closing their AudioContext.
  const resources = runtime.audioResources ||= { context: null, graphs: new WeakMap(), connected: new Set() };
  resources.failedVideos ||= new WeakSet();
  resources.targets ||= new WeakMap();

  function isPlayerVideo(video) {
    return video instanceof HTMLVideoElement && video.matches(PLAYER_VIDEO_SELECTOR) &&
      !video.closest(EXCLUDED_SCOPE) && video.id !== 'ytc-background-video';
  }

  function canProcess(video) {
    if (video.mediaKeys || video.error) return false;
    if (video.srcObject instanceof MediaStream) return true;
    const source = video.currentSrc;
    if (!source || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
    try {
      const url = new URL(source, location.href);
      // Rerouting a non-CORS cross-origin stream would silence it. Leave it alone.
      return url.origin === location.origin || url.protocol === 'data:' ||
        url.protocol === 'https:' && ['anonymous', 'use-credentials'].includes(video.crossOrigin);
    } catch { return false; }
  }

  function ramp(parameter, value, context) {
    // Compare targets, not an in-flight value: a second media event must not restart
    // a fade, and a quick reversal must cancel it even before its first audio frame.
    if (resources.targets.has(parameter) ? resources.targets.get(parameter) === value : parameter.value === value) {
      resources.targets.set(parameter, value);
      return;
    }
    const now = context.currentTime;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
    else {
      const held = parameter.value;
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(held, now);
    }
    parameter.setTargetAtTime(value, now, 0.015);
    resources.targets.set(parameter, value);
  }

  function prepareOutput(graph) {
    const { context } = graph;
    const processed = graph.route === 'processed';
    graph.bypassGain = context.createGain();
    graph.processedGain = context.createGain();
    graph.limitedGain = context.createGain();
    graph.unlimitedGain = context.createGain();
    graph.output = context.createGain();
    graph.bypassGain.gain.value = processed ? 0 : 1;
    graph.processedGain.gain.value = processed ? 1 : 0;
    graph.limitedGain.gain.value = graph.limited === false ? 0 : 1;
    graph.unlimitedGain.gain.value = graph.limited === false ? 1 : 0;
    graph.bypassGain.connect(graph.output);
    graph.processedGain.connect(graph.output);
    graph.limitedGain.connect(graph.processedGain);
    graph.unlimitedGain.connect(graph.processedGain);
    graph.output.connect(context.destination);
    graph.gain.connect(graph.unlimitedGain);
    graph.gain.connect(graph.limiter);
    graph.limiter.connect(graph.limitedGain);
  }

  function connectSource(graph) {
    graph.source.connect(graph.bass);
    graph.source.connect(graph.bypassGain);
  }

  function ensureOutput(graph) {
    if (!graph.output) {
      // Upgrade a retained graph from an older injection without acquiring a
      // second MediaElementAudioSourceNode for the same video.
      graph.gain.disconnect();
      graph.limiter.disconnect();
      prepareOutput(graph);
      graph.source.disconnect();
      connectSource(graph);
    } else if (graph.route === 'detached') {
      connectSource(graph);
      graph.output.connect(graph.context.destination);
    }
  }

  function bypass(graph) {
    ensureOutput(graph);
    if (graph.route === 'bypass') return;
    ramp(graph.bypassGain.gain, 1, graph.context);
    ramp(graph.processedGain.gain, 0, graph.context);
    graph.route = 'bypass';
  }

  function process(graph, settings) {
    ensureOutput(graph);
    const { context } = graph;
    ramp(graph.bass.gain, settings.bassGain, context);
    ramp(graph.mid.gain, settings.midGain, context);
    ramp(graph.treble.gain, settings.trebleGain, context);
    ramp(graph.balance.pan, settings.audioBalance / 100, context);
    ramp(graph.gain.gain, settings.volumeBoost / 100, context);
    ramp(graph.limitedGain.gain, settings.audioLimiter ? 1 : 0, context);
    ramp(graph.unlimitedGain.gain, settings.audioLimiter ? 0 : 1, context);
    ramp(graph.bypassGain.gain, 0, context);
    ramp(graph.processedGain.gain, 1, context);
    graph.limited = settings.audioLimiter;
    graph.route = 'processed';
  }

  function createGraph(video, context, settings) {
    const graph = { video, context, bass: context.createBiquadFilter(), mid: context.createBiquadFilter(),
      treble: context.createBiquadFilter(), balance: context.createStereoPanner(),
      gain: context.createGain(), limiter: context.createDynamicsCompressor(),
      route: 'bypass', limited: settings.audioLimiter };
    graph.bass.type = 'lowshelf';
    graph.bass.frequency.value = 180;
    graph.mid.type = 'peaking';
    graph.mid.frequency.value = 1000;
    graph.mid.Q.value = 1;
    graph.treble.type = 'highshelf';
    graph.treble.frequency.value = 4000;
    graph.limiter.threshold.value = -1;
    graph.limiter.knee.value = 6;
    graph.limiter.ratio.value = 12;
    graph.limiter.attack.value = 0.003;
    graph.limiter.release.value = 0.12;
    graph.bass.connect(graph.mid);
    graph.mid.connect(graph.treble);
    graph.treble.connect(graph.balance);
    graph.balance.connect(graph.gain);
    // Keep both routes connected. Audio-thread fades avoid discontinuities from
    // disconnect/reconnect when media events or settings change during playback.
    prepareOutput(graph);
    // Build the processing nodes first. If creation fails, native audio stays untouched.
    graph.source = context.createMediaElementSource(video);
    connectSource(graph);
    resources.graphs.set(video, graph);
    resources.connected.add(graph);
    return graph;
  }

  function createAudioController() {
    let settings = null;
    let disposed = false;
    let listening = false;
    let contextListener = false;
    let problem = '';
    let meter = null;
    let meterTimer;

    function stopMeter() {
      clearTimeout(meterTimer);
      if (!meter) return;
      // Disconnect only the observation branch; the audible output stays intact.
      try { meter.graph.output.disconnect(meter.splitter); } catch { /* Player removed. */ }
      meter.splitter.disconnect();
      meter = null;
    }

    function status() {
      if (!settings?.audioEnabled || disposed) return 'off';
      if (problem) return problem;
      for (const graph of resources.connected) {
        if (graph.route === 'processed' && !graph.video.paused && !graph.video.muted) return 'active';
      }
      return 'ready';
    }

    function measure() {
      if (disposed) return null;
      const videos = [...document.querySelectorAll(PLAYER_VIDEO_SELECTOR)].filter(isPlayerVideo);
      const video = videos.find(item => !item.paused && !item.ended) || videos[0];
      const graph = video && resources.graphs.get(video);
      const processed = graph?.route === 'processed';
      const parameters = Object.fromEntries(YTCustomizer.audioKeys.map(key => [key,
        processed ? settings[key] : YTCustomizer.defaults[key]]));
      parameters.audioEnabled = Boolean(processed);
      parameters.audioLimiter = Boolean(processed && graph.limited);
      const result = { status: status(), parameters,
        playback: !video ? 'no-video' : video.muted || video.volume === 0 ? 'muted' :
          video.paused || video.ended ? 'paused' : video.readyState < 3 ? 'waiting' : 'playing',
        volume: video ? Math.round(video.volume * 100) : null,
        channels: null, reductionDb: 0 };
      // Never acquire a media source or resume a context just to draw a meter.
      if (!graph?.output || graph.route === 'detached' || graph.context.state !== 'running') {
        stopMeter();
        return result;
      }
      if (meter?.graph !== graph) {
        stopMeter();
        try {
          const splitter = graph.context.createChannelSplitter(2);
          const analysers = [0, 1].map(channel => {
            const analyser = graph.context.createAnalyser();
            analyser.fftSize = 2048;
            splitter.connect(analyser, channel);
            return analyser;
          });
          // Analyser outputs may remain unconnected. This tap cannot duplicate sound.
          graph.output.connect(splitter);
          meter = { graph, splitter, analysers, samples: new Float32Array(2048) };
        } catch { stopMeter(); return result; }
      }
      clearTimeout(meterTimer);
      // Popup destruction is not guaranteed to deliver a final message. A lease
      // also handles closed windows and multiple simultaneous settings views.
      meterTimer = setTimeout(stopMeter, 1500);
      const silent = result.playback !== 'playing';
      const db = amplitude => amplitude > 1e-6 ? 20 * Math.log10(amplitude) : null;
      result.channels = meter.analysers.map(analyser => {
        if (silent) return { rmsDb: null, peakDb: null };
        analyser.getFloatTimeDomainData(meter.samples);
        let sum = 0, peak = 0;
        for (const value of meter.samples) { sum += value * value; peak = Math.max(peak, Math.abs(value)); }
        return { rmsDb: db(Math.sqrt(sum / meter.samples.length)), peakDb: db(peak) };
      });
      if (processed && graph.limited && !silent) result.reductionDb = graph.limiter.reduction;
      return result;
    }

    function attachListeners() {
      const needed = !disposed && (settings?.audioEnabled || resources.connected.size > 0);
      if (needed !== listening) {
        listening = needed;
        const method = needed ? 'addEventListener' : 'removeEventListener';
        MEDIA_EVENTS.forEach(event => document[method](event, onMedia, true));
        document[method]('pointerdown', onGesture, true);
        document[method]('keydown', onGesture, true);
        document[method]('yt-navigate-finish', refresh);
      }
      if (resources.context && contextListener !== needed) {
        resources.context[needed ? 'addEventListener' : 'removeEventListener']('statechange', onContextState);
        contextListener = needed;
      }
    }

    function resume() {
      if (disposed) return null;
      try {
        // Video playback needs headroom for page interactions, rather than the
        // smallest output buffer used by live instruments and interactive sound.
        if (!resources.context) resources.context = new AudioContext({ latencyHint: 'playback' });
        attachListeners();
        const context = resources.context;
        if (context.state === 'closed') { problem = 'error'; return null; }
        if (context.state !== 'running') void context.resume().catch(() => { if (!disposed) problem = 'error'; });
        return context;
      } catch { problem = 'error'; return null; }
    }

    function visit(video) {
      if (disposed || !isPlayerVideo(video)) return;
      let graph = resources.graphs.get(video);
      if (!settings?.audioEnabled) {
        if (graph) {
          bypass(graph);
          resources.connected.add(graph);
          if (!video.paused) resume();
        }
        return;
      }
      if (video.paused || video.muted || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (!canProcess(video)) { problem = 'unsupported'; if (graph) bypass(graph); return; }
      if (resources.failedVideos.has(video)) { problem = 'error'; return; }
      const context = resume();
      // Keep the native output until the context is running; autoplay policy may suspend it.
      if (context?.state !== 'running') return;
      try {
        if (!graph) pruneDetached();
        graph ||= createGraph(video, context, settings);
        process(graph, settings);
        resources.connected.add(graph);
        problem = '';
      } catch { if (graph) bypass(graph); else resources.failedVideos.add(video); problem = 'error'; }
    }

    function pruneDetached() {
      for (const graph of resources.connected) {
        if (!graph.video.isConnected && graph.video.paused) {
          graph.source.disconnect();
          if (graph.output) graph.output.disconnect();
          else {
            graph.gain.disconnect();
            graph.limiter.disconnect();
          }
          graph.route = 'detached';
          resources.connected.delete(graph);
        }
      }
    }

    function refresh() {
      if (disposed) return;
      pruneDetached();
      for (const graph of resources.connected) {
        if (!isPlayerVideo(graph.video) || !settings?.audioEnabled) bypass(graph);
      }
      if (settings?.audioEnabled) document.querySelectorAll(PLAYER_VIDEO_SELECTOR).forEach(visit);
      attachListeners();
    }

    function onMedia(event) {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      if (event.type === 'emptied') {
        const graph = resources.graphs.get(video);
        if (graph) bypass(graph);
      } else visit(video);
    }

    function onGesture(event) {
      if (!event.isTrusted || resources.context?.state === 'running') return;
      if (settings?.audioEnabled && document.querySelector(PLAYER_VIDEO_SELECTOR) || resources.connected.size) resume();
    }

    function onContextState() {
      if (resources.context?.state === 'running') refresh();
    }

    function sync(nextSettings) {
      if (disposed) return;
      const next = YTCustomizer.normalize(nextSettings);
      if (settings && YTCustomizer.audioKeys.every(key => settings[key] === next[key])) return;
      settings = next;
      problem = '';
      for (const graph of resources.connected) {
        if (settings.audioEnabled && isPlayerVideo(graph.video) && canProcess(graph.video)) process(graph, settings);
        else bypass(graph);
      }
      refresh();
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      stopMeter();
      resources.connected.forEach(bypass);
      attachListeners();
      // Closing a context cannot undo createMediaElementSource and would mute the video.
      // The unity-gain bypass keeps normal sound on disable/reinjection.
    }

    return Object.freeze({ sync, refresh, dispose, measure, get status() { return status(); } });
  }

  runtime.createAudioController = createAudioController;
  runtime.audioVersion = YTCustomizer.version;
})();
