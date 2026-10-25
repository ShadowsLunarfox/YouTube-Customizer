// A small bilingual finder for the existing settings form; navigation never changes a value.
(() => {
  function create({ activateTab }) {
    const input = document.getElementById('settingsSearch'), clear = document.getElementById('clearSettingsSearch');
    const container = document.querySelector('.settings-search'), results = document.getElementById('settingsSearchResults');
    const list = document.getElementById('settingsSearchList'), count = document.getElementById('settingsSearchCount');
    const empty = document.getElementById('settingsSearchEmpty');
    const aliases = {
      menuLanguage:'languages chinese english 中文 英文 语言', editingScope:'profile shared page configuration 全局 共用 独立 页面 配置',
      pageProfileEnabled:'profile override 独立配置 分页', pictureInPicture:'pip floating video 画中画 浮窗 小窗',
      configureShortcuts:'keyboard hotkey shortcut 快捷键 热键', uploadBackground:'wallpaper image video gif mp4 upload 壁纸 背景 图片 动图 上传',
      uiOpacity:'transparency glass 透明 毛玻璃', uiBlur:'frosted glass 毛玻璃 模糊', backgroundOpacity:'wallpaper transparency 透明 壁纸',
      themePreset:'dark light charcoal forest classic 深色 浅色 森林 经典 主题',
      hideHomeSingleVideo:'singleton premium ad advertisement 单影片 广告 推广', hideHomePlayables:'playables games 小游戏 游戏',
      hideHomeFeatured:'premium membership advertisement 广告 会员 推广', disableVideoPreviews:'autoplay hover thumbnail 自动播放 悬停 缩图',
      audioEnabled:'sound audio boost amplification audio enhancement 声音增强 声音 增强 扩音', volumeBoost:'volume loudness 音量 音量增强',
      bassGain:'eq equalizer 低音 均衡器', midGain:'eq equalizer 中音 均衡器', trebleGain:'eq equalizer 高音 均衡器',
      audioMonitor:'meter level levels peak rms dbfs 音量条 音量显示 显示音量 电平 实时音量 峰值',
      exportSettings:'backup export save json 备份 导出 保存', importSettings:'backup import restore json 备份 导入 恢复'
    };
    const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[-_/]+/g,' ').replace(/\s+/g,' ').trim();
    const entries = [], seen = new Set();
    function add(control, label, row = control) {
      if (!control?.id || !label || seen.has(control.id) || control instanceof HTMLOutputElement) return;
      seen.add(control.id);
      const panel = control.closest('[role="tabpanel"]'), tab = panel && document.getElementById(panel.getAttribute('aria-labelledby'));
      const category = tab?.textContent || 'Menu';
      const group = control.closest('fieldset')?.querySelector('legend')?.textContent || '';
      const path = [...new Set([category,group].filter(Boolean))].join(' · ');
      const options = control instanceof HTMLSelectElement ? [...control.options].map(option => option.textContent + ' ' + YTCustomizerI18n.translate(option.textContent,'zh-CN')).join(' ') : '';
      const primary = normalize(label + ' ' + YTCustomizerI18n.translate(label,'zh-CN'));
      entries.push({ control, label, row, tab, path, primary,
        keywords:normalize([primary,path,YTCustomizerI18n.translate(path,'zh-CN'),options,control.id.replace(/([a-z])([A-Z])/g,'$1 $2'),aliases[control.id] || ''].join(' ')) });
    }
    document.querySelectorAll('[role="tabpanel"] :is(.field,.check-field,.upload-field)').forEach(row => {
      add(row.querySelector('input:not([type="file"]),select,button,output'),row.querySelector(':scope > span')?.textContent.trim(),row);
    });
    document.querySelectorAll('[role="tabpanel"] .field-list > button').forEach(button => add(button,button.textContent.trim()));
    for (const id of ['menuLanguage','editingScope','pageProfileEnabled']) {
      const control = document.getElementById(id), row = control.closest('label') || control;
      add(control,control.getAttribute('aria-label') || row.querySelector('span')?.textContent.trim(),row);
    }
    const meter = document.querySelector('.audio-monitor'); meter.id = 'audioMonitor'; add(meter,'Live audio');
    let highlighted = null, highlightTimer;
    function dismiss() { results.hidden = true; }
    function clearSearch({ focus = false } = {}) {
      input.value = ''; list.replaceChildren(); count.textContent = ''; clear.hidden = true; dismiss();
      if (focus) input.focus();
    }
    function navigate(entry) {
      clearSearch();
      if (entry.tab) activateTab(entry.tab);
      let target = entry.control;
      if (target.id === 'pageProfileEnabled' && document.getElementById('pageProfileRow').hidden) target = document.getElementById('editingScope');
      if (target.disabled) {
        const id = target.id;
        const enabler = YTCustomizer.audioKeys.includes(id) ? 'audioEnabled' : YTCustomizer.cardKeys.includes(id) ? 'customizeCards' :
          ['backgroundFit','backgroundOpacity'].includes(id) ? 'uploadBackground' : id === 'thumbColor' ? 'thumbStyle' : '';
        target = enabler ? document.getElementById(enabler) : entry.row;
      }
      target.scrollIntoView({ block:'center' });
      if (!target.matches('input,select,button,[tabindex]')) target.tabIndex = -1;
      target.focus({ preventScroll:true });
      clearTimeout(highlightTimer); highlighted?.classList.remove('search-highlight');
      highlighted = target === entry.control ? entry.row : target.closest('.field,.check-field') || target;
      highlighted.classList.add('search-highlight');
      highlightTimer = setTimeout(() => { highlighted?.classList.remove('search-highlight'); highlighted = null; },2200);
    }
    function render() {
      const query = normalize(input.value.slice(0,200)); clear.hidden = !input.value;
      if (!query) { dismiss(); list.replaceChildren(); return; }
      const tokens = query.split(' ');
      const matches = entries.filter(entry => tokens.every(token => entry.keywords.includes(token))).map(entry => ({ entry,
        score:entry.primary === query ? 100 : entry.primary.startsWith(query) ? 60 : entry.primary.includes(query) ? 40 : tokens.filter(token => entry.primary.includes(token)).length * 10
      })).sort((a,b) => b.score-a.score);
      count.textContent = matches.length + (matches.length === 1 ? ' setting found' : ' settings found');
      empty.hidden = matches.length > 0;
      const fragment = document.createDocumentFragment();
      for (const { entry } of matches) {
        const button = document.createElement('button'), label = document.createElement('strong'), path = document.createElement('span');
        button.type = 'button'; button.className = 'search-result'; button.dataset.settingId = entry.control.id;
        label.textContent = entry.label; path.textContent = entry.path;
        button.append(label,path); button.addEventListener('click',() => navigate(entry)); fragment.append(button);
      }
      list.replaceChildren(fragment); results.hidden = false; results.scrollTop = 0;
    }
    input.addEventListener('input',event => { if (!event.isComposing) render(); });
    input.addEventListener('compositionend',render); input.addEventListener('search',render); input.addEventListener('focus',render);
    clear.addEventListener('click',() => clearSearch({ focus:true }));
    input.addEventListener('keydown',event => {
      if (event.isComposing) return;
      if (event.key === 'Enter' && !results.hidden && list.firstElementChild) { event.preventDefault(); list.firstElementChild.click(); }
      else if (['ArrowDown','ArrowUp'].includes(event.key) && list.firstElementChild) {
        event.preventDefault(); results.hidden = false; (event.key === 'ArrowDown' ? list.firstElementChild : list.lastElementChild).focus();
      }
    });
    list.addEventListener('keydown',event => {
      const buttons = [...list.children], index = buttons.indexOf(event.target);
      const next = event.key === 'ArrowDown' ? (index+1)%buttons.length : event.key === 'ArrowUp' ? (index+buttons.length-1)%buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : -1;
      if (next >= 0) { event.preventDefault(); buttons[next].focus(); }
    });
    document.addEventListener('keydown',event => {
      if (event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') { event.preventDefault(); input.focus(); input.select(); }
      else if (event.key === 'Escape' && input.value && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); event.stopPropagation(); clearSearch({ focus:true }); }
    });
    document.addEventListener('pointerdown',event => { if (!container.contains(event.target)) dismiss(); });
    container.addEventListener('focusout',event => { if (!container.contains(event.relatedTarget)) dismiss(); });
    window.addEventListener('pagehide',() => clearTimeout(highlightTimer),{ once:true });
    return Object.freeze({ clear:clearSearch, get entries() { return entries; } });
  }
  globalThis.YTCustomizerSettingsSearch = Object.freeze({ create });
})();
