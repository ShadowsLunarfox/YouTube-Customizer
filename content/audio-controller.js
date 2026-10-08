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
    if (parameter.value === value) return;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(context.currentTime);
    else parameter.cancelScheduledValues(context.currentTime);
    parameter.setTargetAtTime(value, context.currentTime, 0.015);
  }

  function bypass(graph) {
    if (graph.route === 'bypass') return;
    graph.source.disconnect();
    graph.gain.disconnect();
    graph.limiter.disconnect();
    graph.source.connect(graph.context.destination);
    graph.route = 'bypass';
  }

  function process(graph, settings) {
    const { context } = graph;
    ramp(graph.bass.gain, settings.bassGain, context);
    ramp(graph.mid.gain, settings.midGain, context);
    ramp(graph.treble.gain, settings.trebleGain, context);
    ramp(graph.balance.pan, settings.audioBalance / 100, context);
    ramp(graph.gain.gain, settings.volumeBoost / 100, context);
    if (graph.route !== 'processed' || graph.limited !== settings.audioLimiter) {
      graph.gain.disconnect();
      graph.limiter.disconnect();
      if (settings.audioLimiter) {
        graph.gain.connect(graph.limiter);
        graph.limiter.connect(context.destination);
      } else graph.gain.connect(context.destination);
      graph.limited = settings.audioLimiter;
    }
    if (graph.route !== 'processed') {
      graph.source.disconnect();
      graph.source.connect(graph.bass);
      graph.route = 'processed';
    }
  }

  function createGraph(video, context) {
    const graph = { video, context, bass: context.createBiquadFilter(), mid: context.createBiquadFilter(),
      treble: context.createBiquadFilter(), balance: context.createStereoPanner(),
      gain: context.createGain(), limiter: context.createDynamicsCompressor(), route: 'bypass' };
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
    // Build the processing nodes first. If creation fails, native audio stays untouched.
    graph.source = context.createMediaElementSource(video);
    graph.source.connect(context.destination);
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
        if (!resources.context) resources.context = new AudioContext({ latencyHint: 'interactive' });
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
        graph ||= createGraph(video, context);
        process(graph, settings);
        resources.connected.add(graph);
        problem = '';
      } catch { if (graph) bypass(graph); else resources.failedVideos.add(video); problem = 'error'; }
    }

    function pruneDetached() {
      for (const graph of resources.connected) {
        if (!graph.video.isConnected && graph.video.paused) {
          graph.source.disconnect();
          graph.gain.disconnect();
          graph.limiter.disconnect();
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
      resources.connected.forEach(bypass);
      attachListeners();
      // Closing a context cannot undo createMediaElementSource and would mute the video.
      // A direct source-to-destination connection keeps native sound on disable/reinjection.
    }

    return Object.freeze({ sync, refresh, dispose, get status() {
      if (!settings?.audioEnabled || disposed) return 'off';
      if (problem) return problem;
      for (const graph of resources.connected) {
        if (graph.route === 'processed' && !graph.video.paused && !graph.video.muted) return 'active';
      }
      return 'ready';
    } });
  }

  runtime.createAudioController = createAudioController;
  runtime.audioVersion = YTCustomizer.version;
})();
