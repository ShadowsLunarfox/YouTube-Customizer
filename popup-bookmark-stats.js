// Read-only statistics for the existing per-video timeline records.
(() => {
  const prefix = 'videoBookmarks:';
  const validKey = key => /^videoBookmarks:[\w-]{1,128}$/.test(key);
  function summarize(stored) {
    const byVideo = new Map(); let videos = 0, points = 0, notes = 0;
    for (const [key, value] of Object.entries(stored || {})) {
      if (!validKey(key)) continue;
      const list = YTCustomizerVideoBookmarks.normalize(value).points;
      if (!list.length) continue;
      byVideo.set(key.slice(prefix.length), list); videos++; points += list.length; notes += list.filter(point => point.note.trim()).length;
    }
    return { videos, points, notes, byVideo };
  }
  async function readRecords() {
    if (typeof chrome.storage.local.getKeys !== 'function') return chrome.storage.local.get(null);
    const keys = (await chrome.storage.local.getKeys()).filter(validKey);
    return keys.length ? chrome.storage.local.get(keys) : {};
  }
  function create({ getTargetTab }) {
    const root = document.getElementById('bookmarkStats'), list = document.getElementById('bookmarkStatsList');
    const toggle = document.getElementById('toggleBookmarkStatsRecords'), status = document.getElementById('bookmarkStatsStatus');
    let active = false, disposed = false, revision = 0, timer, currentId = '', targetId = null, records = [], expanded = false;
    function node(tag, text, className) { const element = document.createElement(tag); if (text != null) element.textContent = text; if (className) element.className = className; return element; }
    function renderList() {
      list.replaceChildren(); list.hidden = !expanded; toggle.setAttribute('aria-expanded', String(expanded)); toggle.textContent = expanded ? 'Hide records' : 'Show records';
      if (!expanded) return;
      for (const point of [...records].sort((a, b) => a.time - b.time || a.createdAt - b.createdAt)) {
        const hasNote = Boolean(point.note.trim());
        const item = node('li'), time = node('span', YTCustomizerVideoBookmarks.format(point.time), 'record-time'), note = node('span', hasNote ? point.note : 'No note', 'record-note');
        if (hasNote) note.setAttribute('translate', 'no');
        item.append(time, note); list.append(item);
      }
    }
    async function refresh() {
      if (!active || disposed) return;
      clearTimeout(timer); const token = ++revision; root.setAttribute('aria-busy', 'true');
      try {
        const [stored, tab] = await Promise.all([readRecords(), getTargetTab()]);
        if (disposed || !active || token !== revision) return;
        const totals = summarize(stored), nextId = YTCustomizerVideoBookmarks.videoId(tab?.url);
        if (nextId !== currentId) expanded = false;
        currentId = nextId; targetId = tab?.id ?? null; records = totals.byVideo.get(currentId) || [];
        if (!records.length) expanded = false;
        for (const [name, value] of Object.entries({ Videos: totals.videos, Points: totals.points, Notes: totals.notes })) document.getElementById('bookmarkStats' + name).textContent = String(value);
        const video = document.getElementById('bookmarkStatsCurrentVideo'); video.hidden = !currentId; video.textContent = currentId ? tab.title?.replace(/ - YouTube$/, '') || currentId : '';
        document.getElementById('bookmarkStatsCurrentCount').textContent = currentId ? records.length + (records.length === 1 ? ' record in this video' : ' records in this video') : 'Open a video to see its saved records.';
        toggle.hidden = !records.length; renderList(); status.textContent = ''; status.classList.remove('error');
      } catch {
        if (token === revision && !disposed) { status.textContent = 'Could not load record statistics. Try again.'; status.classList.add('error'); }
      } finally { if (token === revision && !disposed) root.setAttribute('aria-busy', 'false'); }
    }
    function schedule() { if (!active || disposed) return; revision++; clearTimeout(timer); timer = setTimeout(() => void refresh(), 40); }
    function storage(changes, area) { if (area === 'local' && Object.keys(changes).some(validKey)) schedule(); }
    function updated(id, changes) { if (id === targetId && (changes.url || changes.title || changes.status === 'complete')) schedule(); }
    function removed(id) { if (id === targetId) schedule(); }
    toggle.addEventListener('click', () => { expanded = !expanded; renderList(); });
    document.getElementById('refreshBookmarkStats').addEventListener('click', () => void refresh());
    chrome.storage.onChanged.addListener(storage); chrome.tabs.onUpdated.addListener(updated); chrome.tabs.onRemoved.addListener(removed);
    return {
      refresh,
      setVisible(value) { if (active === value) return; active = value; if (active) void refresh(); else { revision++; clearTimeout(timer); root.setAttribute('aria-busy', 'false'); } },
      dispose() { disposed = true; revision++; clearTimeout(timer); chrome.storage.onChanged.removeListener(storage); chrome.tabs.onUpdated.removeListener(updated); chrome.tabs.onRemoved.removeListener(removed); }
    };
  }
  globalThis.YTCustomizerBookmarkStats = { summarize, create };
})();
