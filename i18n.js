// Translate extension-owned menus only. Page content and saved appearance stay untouched.
(() => {
  const chinese = Object.freeze({
    'Make YouTube yours.': '让 YouTube 更合你意。',
    'Timeline record statistics': '播放条记录统计', 'Recorded videos': '已记录影片', 'Timeline points': '记录点总数', 'Sticky notes': '小纸条数量',
    'Local totals across all videos. Notes count records with non-empty text.': '统计本机所有影片的记录；有文字的记录点计为一张小纸条。',
    'Current video': '当前影片', 'Open a video to see its saved records.': '打开影片后，可查看这支影片的记录。',
    'Show records': '展开记录', 'Hide records': '收起记录', 'Refresh statistics': '刷新统计',
    'Could not load record statistics. Try again.': '无法加载记录统计，请重试。',
    'Video bookmarks': '影片记录点', 'Show video bookmarks': '显示影片记录点',
    'Click above the video timeline to pin a timestamp and write a sticky note. Click a pin to read or edit it.': '点击影片进度条上方标记时间并写小纸条，点击标记即可查看或修改。',
    'Timeline note': '时间点小纸条', 'Add timeline note': '小纸条',
    'Add a note at the current time': '在当前播放位置添加小纸条',
    'Click above the timeline to add a note': '点击进度条上方，在这个位置添加小纸条',
    'Open timeline note': '打开时间点小纸条',
    'Write a note...': '写张小纸条…',
    'Timestamp': '时间点', 'Note (optional)': '备注（可选）', 'Use current time': '使用当前时间',
    'Add bookmark': '添加记录点', 'Save changes': '保存修改', 'Cancel edit': '取消编辑',
    'Edit': '修改', 'Delete': '删除', 'No note': '无备注', 'No bookmarks yet.': '还没有记录点。',
    'Bookmarks are saved locally for this video. Click a time or a timeline marker to jump back.': '记录按影片保存在本机，点击时间或进度条标记即可跳回。',
    'Jump to bookmark': '跳转到记录点', 'Bookmark saved.': '记录点已保存。', 'Bookmark deleted.': '记录点已删除。',
    'Open a loaded video to add or use bookmarks.': '请等待影片加载后再添加或使用记录点。', 'Bookmarks are unavailable during ads.': '广告期间无法使用记录点。',
    'Enter a valid timestamp.': '请输入有效的时间点。', 'Timestamp exceeds this video.': '时间点超出了影片长度。',
    'Could not save bookmark. Try again.': '无法保存记录点，请重试。', 'Could not load bookmarks. Try again.': '无法加载记录点，请重试。',
    'Invalid bookmark.': '记录点无效。', 'Invalid bookmark action.': '记录点操作无效。',
    'Enter a valid timestamp and a note up to 1000 characters.': '请输入有效时间点，备注最多 1000 字。',
    'This bookmark no longer exists.': '这个记录点已不存在。', 'This video already has 500 bookmarks.': '这支影片已有 500 个记录点。',
    'YouTube Customizer settings': 'YouTube Customizer 设置', 'Loading settings...': '正在加载设置…',
    'Could not open settings. Refresh YouTube and try again.': '无法打开设置，请刷新 YouTube 后重试。',
    'Find:': '查找：', 'Menu': '菜单', 'Search settings': '搜索设置', 'Search settings...': '搜索设置…',
    'Clear search': '清除搜索', 'Search results': '搜索结果', 'No matching settings. Try another keyword.': '没有匹配的设置，请换个关键词。',
    'Menu theme': '菜单主题', 'System theme': '跟随系统', 'Light mode': '浅色模式', 'Dark mode': '深色模式',
    'Could not save menu theme': '无法保存菜单主题',
    'Menu language': '菜单语言', 'Open window': '独立窗口',
    'Open the entire menu in a separate window': '在独立窗口中打开整个菜单',
    'Editing settings for': '正在编辑的页面', 'All pages (shared)': '所有页面（共用）',
    'YouTube Home': 'YouTube 首页', 'Watch pages / Shorts': '播放页面 / Shorts',
    'Use separate appearance and layout': '为此页面使用独立的外观与布局',
    'Pages without separate settings use the shared configuration.': '未设置独立配置的页面使用共用配置。',
    'Pages without separate settings use this configuration.': '未设置独立配置的页面使用此配置。',
    'Separate appearance and layout are active. Player and Audio settings are shared.': '已启用独立外观与布局。播放器与声音设置仍然共用。',
    'Using shared settings; editing appearance or layout creates a separate configuration. Player and Audio settings are shared.': '当前使用共用设置；修改外观或布局将建立独立配置。播放器与声音设置仍然共用。',
    'Separate appearance and layout are active. Player, Records and Audio settings are shared.': '已启用独立外观与布局。播放器、记录和声音设置仍然共用。',
    'Using shared settings; editing appearance or layout creates a separate configuration. Player, Records and Audio settings are shared.': '当前使用共用设置；修改外观或布局将建立独立配置。播放器、记录和声音设置仍然共用。',
    'Settings': '设置', 'Appearance': '外观', 'Player': '播放器', 'Records': '记录', 'Shortcuts': '快捷键', 'Audio': '声音', 'Layout': '布局', 'Backup': '备份',
    'Page theme preview': '页面主题预览', 'Theme': '主题', 'Enable page theme': '启用页面主题',
    'Preset': '预设', 'Original YouTube': 'YouTube 原始样式', 'Charcoal': '炭黑', 'Light': '浅色', 'Forest': '森林',
    'Windows classic': 'Windows 经典', 'Custom': '自定义', 'Page background': '页面背景', 'Header / sidebar': '顶栏 / 侧栏',
    'UI opacity': '界面不透明度', 'UI blur': '界面模糊', 'Text': '文字', 'Accent': '强调色',
    'Frosted glass: 0 px turns it off. Lower UI opacity reveals more of the background.': '毛玻璃效果：设为 0 px 即关闭。降低界面不透明度可显示更多背景。',
    'Wallpaper': '壁纸', 'Background image or video': '背景图片或影片', 'Upload...': '上传…', 'Remove': '移除',
    'PNG, JPEG, WebP, AVIF, GIF, or MP4 · 20 MB max. MP4 plays without sound.': '支持 PNG、JPEG、WebP、AVIF、GIF、MP4，最大 20 MB。MP4 静音播放。',
    'Background': '背景类型', 'Solid color': '纯色', 'Image or video': '图片或影片', 'Background fit': '背景适应方式',
    'Fill screen': '填满屏幕', 'Fit media': '完整显示', 'Tile images': '平铺图片', 'Background opacity': '背景不透明度',
    'Keyboard shortcuts': '快捷键', 'Open menu': '打开菜单', 'Audio enhancement': '声音增强',
    'Not assigned': '未绑定', 'Change shortcuts...': '修改快捷键…',
    'YouTube default': 'YouTube 默认按键', 'Use default shortcuts on YouTube': '在 YouTube 使用默认快捷键',
    'Browser bindings take priority. Enable defaults to use the shown keys on YouTube when unassigned.': '优先使用浏览器绑定。未绑定时，可在 YouTube 使用上方默认按键。',
    'Edit or clear bindings in your browser. Unassigned combinations may already be in use.': '在浏览器中修改或清空按键。未绑定的组合键可能已被占用。',
    'Video and audio shortcuts only run on YouTube, outside text fields and chat.': '影片与声音快捷键仅在 YouTube 生效，输入框和聊天中不会触发。',
    "Change or clear shortcuts in your browser's extension settings. Unassigned shortcuts may already be in use.": '在浏览器扩展设置中修改或清空按键。未绑定的组合键可能已被占用。',
    'Video and audio shortcuts work on YouTube and are ignored while typing in inputs or chat.': '影片与声音快捷键仅在 YouTube 生效，在输入框或聊天中打字时不会触发。',
    'Could not open shortcut settings': '无法打开快捷键设置', 'Could not load shortcuts': '无法读取快捷键',
    'Picture-in-picture': '画中画', 'Open floating video': '打开画中画', 'Return video to tab': '将影片放回页面',
    'Open the current video in a floating window. Click again to return it to its tab.': '在独立浮动窗口中播放当前影片，再次点击即可放回页面。',
    'Picture-in-picture is open. You can keep watching while using other windows.': '画中画已开启，使用其他窗口时也能继续观看。',
    'Updating picture-in-picture...': '正在切换画中画…',
    'Open a YouTube video to use picture-in-picture.': '请先打开 YouTube 影片，再使用画中画。',
    'Could not reach the video. Refresh YouTube and try again.': '无法连接影片，请刷新 YouTube 后重试。',
    'Open a YouTube video first, then try again.': '请先打开 YouTube 影片，然后重试。',
    'Wait for the video picture to load, then try again.': '请等待影片画面加载后重试。',
    'Picture-in-picture is disabled for this video.': '此影片已停用画中画。',
    'Picture-in-picture is unavailable in this browser.': '此浏览器不支持画中画。',
    'Picture-in-picture is unavailable on this page.': '此页面不支持画中画。',
    'Picture-in-picture is unavailable in this browser or on this page.': '此浏览器或页面不支持画中画。',
    'Click the video once, then try Picture-in-picture again.': '请先点击一次影片，再尝试画中画。',
    'Picture-in-picture is unavailable for this video.': '此影片不支持画中画。',
    'Picture-in-picture is blocked on this page.': '此页面阻止了画中画。',
    'Could not change picture-in-picture. Try again.': '无法切换画中画，请重试。',
    'Picture-in-picture opened.': '画中画已开启。', 'Video returned to its tab.': '影片已放回页面。',
    'Audio enhancement enabled.': '声音增强已开启。', 'Audio enhancement disabled.': '声音增强已关闭。',
    'Could not run shortcut. Refresh YouTube and try again.': '快捷键执行失败，请刷新 YouTube 后重试。',
    'Preview': '预览', 'Progress bar': '播放进度条', 'Progress color': '进度颜色', 'Progress effect': '进度特效',
    'Pulsing glow (animated)': '呼吸发光（动画）', 'Moving shimmer': '流动光泽', 'Rainbow cycle': '彩虹渐变',
    'Buffer color': '缓冲颜色', 'Most replayed color': '热门片段颜色',
    'Colors the replay graph above the timeline, when available.': '为进度条上方的热门重播曲线着色（影片提供时显示）。',
    'Bar thickness': '进度条粗细', 'Scrubber icon': '进度指示图标', 'Icon style': '图标样式',
    'Circle': '圆形', 'Diamond': '菱形', 'Star': '星形', 'Play': '播放', 'Lightning bolt': '闪电', 'Heart': '爱心',
    'Custom image': '自定义图片', 'Icon color': '图标颜色', 'Icon size': '图标大小', 'Custom icon': '自定义图标',
    'Live audio': '实时音量', 'Connecting...': '正在连接…', 'Unavailable': '不可用', 'L': '左', 'R': '右',
    'Enable audio enhancement and play a video to measure its output.': '开启声音增强并播放影片，即可测量输出音量。',
    'Current audio parameters': '当前声音参数', 'Applied boost': '生效增益', 'Balance': '声道平衡',
    'EQ: bass / mid / treble': '均衡器：低 / 中 / 高音', 'Limiter': '限幅器',
    'Bass: 180 Hz · Mid: 1 kHz · Treble: 4 kHz': '低音：180 Hz · 中音：1 kHz · 高音：4 kHz',
    'Enable volume boost and equalizer': '启用音量增强和均衡器', 'Volume boost': '音量增强',
    "100% is normal. YouTube's volume and mute controls still work.": '100% 为原始音量。YouTube 的音量和静音控制仍然有效。',
    'Bass': '低音', 'Midrange': '中音', 'Treble': '高音', 'Stereo balance': '左右声道平衡', 'Center': '居中',
    'Left ← Center → Right. 0 dB leaves each frequency band unchanged.': '左 ← 居中 → 右。0 dB 表示不调整该频段。',
    'Reduce clipping at high volume': '减少高音量下的削波失真', 'Audio processing is off.': '声音处理已关闭。',
    'Audio settings are active.': '声音设置已生效。',
    'This video cannot be processed. Its original audio is preserved.': '此影片无法进行声音处理，已保留原始声音。',
    'Audio processing is unavailable for this player.': '此播放器无法使用声音处理。',
    'Play a video to apply audio settings. Click the video once if needed.': '播放影片以应用声音设置；必要时先点击一次影片。',
    'Playing': '播放中', 'Paused': '已暂停', 'Muted': '已静音', 'Buffering': '缓冲中', 'No video': '没有影片',
    'Enhancement off': '增强已关闭', 'Enhancement active': '增强已生效', 'Waiting for playback': '等待播放',
    'Native audio': '原始声音', 'Processing unavailable': '无法处理声音',
    'Open a YouTube video, then return to Audio.': '请打开 YouTube 影片，再返回声音页面。',
    'Fill: RMS · White mark / value: peak · Output after effects (dBFS).': '色条：平均电平（RMS）· 白线与数值：峰值 · 单位：dBFS。',
    "This video's native output cannot be metered safely.": '无法在保留此影片原始声音的同时测量电平。',
    'No YouTube video connected': '尚未连接 YouTube 影片', 'Refresh YouTube to connect': '请刷新 YouTube 以连接',
    'On': '开启', 'Off': '关闭', 'Home sections': '首页区域',
    'Hide single-video promotions': '隐藏单影片推广', 'Hide YouTube Playables games': '隐藏 YouTube Playables 游戏',
    'Hide all featured / membership / Premium promos': '隐藏所有精选 / 会员 / Premium 推广',
    'Includes single-video promotions.': '此选项也会隐藏单影片推广。', 'Hide topic recommendation shelves': '隐藏主题推荐区域',
    'Hide shopping recommendations': '隐藏购物推荐', 'Hidden sections also release their space in the Home feed.': '隐藏区域后，也会移除它在首页占用的空白。',
    'Card layout': '卡片布局', 'Customize card layout': '自定义卡片布局', 'Corner radius': '圆角大小', 'Border width': '边框宽度',
    'Inner padding': '内部留白', 'Card spacing': '卡片间距', 'Section spacing': '区域间距', 'Title lines': '标题行数',
    'Keep cards in each row the same height': '保持每行卡片等高',
    'Applies to video and music cards. Compact music lists keep their native row height.': '适用于影片和音乐卡片。紧凑音乐列表保留原有行高。',
    'Video browsing': '影片浏览', 'Maximum videos per row': '每行最多影片数', 'Disable video previews': '关闭影片悬停预览',
    'Keeps thumbnails still on Home, search results, and related videos.': '让首页、搜索结果和相关推荐中的缩略图保持静止。',
    'Hide Shorts shelves and links': '隐藏 Shorts 区域和链接', 'Header': '顶栏', 'Hide topic filter bar': '隐藏主题筛选栏',
    'Hide Create button': '隐藏「创建」按钮', 'Hide notifications button': '隐藏通知按钮', 'Sidebar': '侧栏',
    'Hide Subscriptions section': '隐藏订阅区域', 'Hide You section': '隐藏「你」区域', 'Hide Explore section': '隐藏探索区域',
    'Hide More from YouTube': '隐藏「更多 YouTube 功能」', 'Hide Report history': '隐藏举报记录',
    'Watch page': '播放页面', 'Related thumbnail width': '推荐缩略图宽度', 'Hide related videos': '隐藏推荐影片',
    'Hide comments': '隐藏评论', 'Hide live chat': '隐藏直播聊天', 'Performance': '性能', 'Reduce motion': '减少动画',
    'Export configuration': '导出配置', 'Save shared settings and all page configurations to a JSON file.': '将共用设置及各页面配置保存为 JSON 文件。',
    'Include wallpapers and custom icon': '包含壁纸和自定义图标', 'Export backup...': '导出备份…', 'Import configuration': '导入配置',
    'Import replaces shared and page settings. A settings-only backup keeps your current media files.': '导入将替换共用设置和页面配置。仅含设置的备份会保留当前媒体文件。',
    'Import backup...': '导入备份…', 'Import YouTube Customizer backup': '导入 YouTube Customizer 备份',
    'YouTube Customizer JSON backups, up to 150 MB.': '支持 YouTube Customizer JSON 备份，最大 150 MB。',
    'Reset tab': '重置本页', 'Reset all': '重置全部', 'Close': '关闭', 'Loading...': '正在加载…',
    'Saved': '已保存', 'Ready': '就绪', 'Applied': '已应用', 'Open YouTube to preview': '请打开 YouTube 以预览',
    'Refresh YouTube and try again': '请刷新 YouTube 后重试', 'Could not save settings': '无法保存设置',
    'Finish the current operation in the settings window': '请先完成设置窗口中的当前操作',
    'Could not open settings window': '无法打开设置窗口', 'Could not refresh settings': '无法更新设置',
    'Could not load settings. Reopen the extension.': '无法加载设置，请重新打开插件。', 'Could not save language': '无法保存菜单语言',
    'Choose a PNG, JPEG, WebP, GIF, AVIF, or MP4 file': '请选择 PNG、JPEG、WebP、GIF、AVIF 或 MP4 文件',
    'Unsupported image format': '不支持此图片格式', 'Could not read file': '无法读取文件', 'Invalid or unsupported MP4 file': 'MP4 文件无效或不受支持',
    'Invalid image file': '图片文件无效', 'Could not save file': '无法保存文件', 'Could not remove file': '无法移除文件',
    'Background loaded': '背景已加载', 'Image loaded': '图片已加载', 'Background removed': '背景已移除', 'Image removed': '图片已移除',
    'Backup exported': '备份已导出', 'Could not export backup': '无法导出备份', 'Backup imported': '备份已导入', 'Could not import backup': '无法导入备份',
    'Backup contains an unreadable image': '备份中包含无法读取的图片', 'Backup video could not be decoded': '无法解码备份影片',
    'Backup video has no picture': '备份影片没有画面', 'Backup contains an unreadable video': '备份中包含无法读取的影片',
    'Choose a JSON backup up to 150 MB': '请选择不超过 150 MB 的 JSON 备份', 'Save current settings before importing': '请先保存当前设置再导入',
    'Invalid settings in backup': '备份中的设置无效', 'Backup is too large (150 MB max)': '备份过大（最大 150 MB）',
    'Choose a valid JSON backup': '请选择有效的 JSON 备份', 'Unsupported YouTube Customizer backup': '不支持此 YouTube Customizer 备份',
    'Backup contains no settings': '备份中没有设置', 'Invalid page settings in backup': '备份中的页面设置无效',
    'Invalid media in backup': '备份中的媒体无效', 'Invalid page media in backup': '备份中的页面媒体无效'
  });

  function resolveLanguage(preference, browserLanguage = globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || 'en') {
    return preference === 'zh-CN' || preference !== 'en' && /^zh\b/i.test(browserLanguage) ? 'zh-CN' : 'en';
  }
  function translate(source, preference = 'auto') {
    if (typeof source !== 'string' || resolveLanguage(preference) !== 'zh-CN') return source;
    const text = source.trim();
    let result = Object.hasOwn(chinese, text) ? chinese[text] : undefined;
    if (result === undefined) {
      const patterns = [
        [/^(\d+) records? in this video$/, value => `这支影片有 ${value} 个记录点`],
        [/^(\d+) settings? found$/, value => `找到 ${value} 项设置`],
        [/^(\d+) videos$/, n => `每行 ${n} 个影片`], [/^(\d+) lines?$/, n => `${n} 行`],
        [/^YouTube volume: (.+)$/, value => `YouTube 音量：${value}`],
        [/^(Left|Right|L|R) (\d+%?)$/, (side, value) => `${side === 'Left' || side === 'L' ? '左' : '右'} ${value}`],
        [/^Reduction ([\d.]+) dB$/, value => `衰减 ${value} dB`],
        [/^RMS (.+) dBFS, peak (.+) dBFS$/, (rms, peak) => `平均电平 ${rms} dBFS，峰值 ${peak} dBFS`],
        [/^Choose a file no larger than (\d+) MB$/, value => `请选择不超过 ${value} MB 的文件`],
        [/^Invalid backup setting: (.+)$/, value => `备份参数无效：${value}`],
        [/^Invalid page profile: (.+)$/, value => `页面配置无效：${value}`],
        [/^Invalid backup media: (.+)$/, value => `备份媒体无效：${value}`]
      ];
      for (const [pattern, render] of patterns) {
        const match = text.match(pattern);
        if (match) { result = render(...match.slice(1)); break; }
      }
      if (result === undefined && text.includes(' · ')) result = text.split(' · ').map(part => translate(part, preference)).join(' · ');
    }
    return result === undefined ? source : source.replace(text, () => result);
  }

  function create(document, select, onError = () => {}) {
    let preference = 'auto';
    const textSources = new WeakMap(), attributeSources = new WeakMap();
    const attributes = ['title', 'aria-label', 'aria-valuetext', 'placeholder'];
    function rewriteText(node) {
      if (!node.data.trim() || node.parentElement?.closest('script,style,[translate="no"]')) return;
      let entry = textSources.get(node);
      if (!entry || entry.last !== node.data) entry = { source: node.data };
      entry.last = translate(entry.source, preference);
      textSources.set(node, entry);
      if (node.data !== entry.last) node.data = entry.last;
    }
    function rewriteAttribute(element, name) {
      if (!element.hasAttribute(name)) return;
      let entries = attributeSources.get(element);
      if (!entries) { entries = new Map(); attributeSources.set(element, entries); }
      const value = element.getAttribute(name);
      let entry = entries.get(name);
      if (!entry || entry.last !== value) entry = { source: value };
      entry.last = translate(entry.source, preference);
      entries.set(name, entry);
      if (value !== entry.last) element.setAttribute(name, entry.last);
    }
    function apply(root) {
      if (root.nodeType === 3) { rewriteText(root); return; }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) rewriteText(walker.currentNode);
      if (root.nodeType === 1) attributes.forEach(name => rewriteAttribute(root, name));
      root.querySelectorAll?.('[title],[aria-label],[aria-valuetext],[placeholder]').forEach(element => attributes.forEach(name => rewriteAttribute(element, name)));
    }
    function setPreference(value) {
      preference = ['auto', 'en', 'zh-CN'].includes(value) ? value : 'auto';
      select.value = preference;
      document.documentElement.lang = resolveLanguage(preference);
      apply(document.body);
    }
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') rewriteText(record.target);
        else if (record.type === 'attributes') rewriteAttribute(record.target, record.attributeName);
        else record.addedNodes.forEach(apply);
      }
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:attributes });
    const onStored = (changes, area) => {
      if (area === 'local' && Object.hasOwn(changes, 'menuLanguage')) setPreference(changes.menuLanguage.newValue);
    };
    chrome.storage.onChanged.addListener(onStored);
    select.disabled = true;
    const ready = chrome.storage.local.get({ menuLanguage:'auto' }).then(value => setPreference(value.menuLanguage))
      .catch(() => setPreference('auto')).finally(() => { select.disabled = false; });
    select.addEventListener('change', async () => {
      const before = preference, next = select.value;
      setPreference(next);
      try { await chrome.storage.local.set({ menuLanguage:next }); }
      catch { if (preference === next) setPreference(before); onError('Could not save language'); }
    });
    window.addEventListener('pagehide', () => { observer.disconnect(); chrome.storage.onChanged.removeListener(onStored); }, { once:true });
    return Object.freeze({ ready, translate: text => translate(text, preference) });
  }
  globalThis.YTCustomizerI18n = Object.freeze({ translate, resolveLanguage, create });
})();
