// Exact publication dates from YouTube metadata, with calendar-year ages.
(() => {
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(value);
  function videoId(value) {
    try {
      const url = new URL(value, 'https://www.youtube.com');
      if (url.protocol !== 'https:' || url.username || url.password || !['www.youtube.com','youtube.com'].includes(url.hostname)) return '';
      const id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:shorts|live)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
      return validId(id) ? id : '';
    } catch { return ''; }
  }
  function dateOnly(value) {
    if (typeof value !== 'string') return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value.trim());
    if (!match) return '';
    const [year,month,day] = match.slice(1).map(Number), date = new Date(Date.UTC(year,month-1,day));
    return year >= 1900 && year <= 2200 && date.getUTCFullYear() === year && date.getUTCMonth() === month-1 && date.getUTCDate() === day ? match[0].slice(0,10) : '';
  }
  function elapsedYears(value, now = new Date()) {
    const date = dateOnly(value);
    if (!date) return null;
    const [year,month,day] = date.split('-').map(Number);
    return now.getFullYear()-year - (now.getMonth()+1 < month || now.getMonth()+1 === month && now.getDate() < day ? 1 : 0);
  }
  function formatDate(value, locale = 'en', now = new Date()) {
    const date = dateOnly(value), years = elapsedYears(date,now);
    if (!date || years < 0) return '';
    return date + ' (' + new Intl.RelativeTimeFormat(locale,{numeric:'always'}).format(-years,'year') + ')';
  }
  function extractDate(html) {
    if (typeof html !== 'string') return '';
    for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
      const attributes = {};
      for (const [,name,,quoted,plain] of tag.matchAll(/([^\s=<>]+)\s*=\s*(?:(['"])(.*?)\2|([^\s>]+))/g)) attributes[name.toLowerCase()] = quoted ?? plain;
      if (attributes.itemprop?.toLowerCase() === 'datepublished') {
        const date = dateOnly(attributes.content); if (date) return date;
      }
    }
    return '';
  }

  function createService() {
    const key = 'publicationDates', cache = new Map(), pending = new Map(), queue = [];
    let loaded, active = 0, retryAt = 0;
    function persist() {
      const now = Date.now();
      for (const [id,entry] of cache) if (entry.expires <= now) cache.delete(id);
      while (cache.size > 512) cache.delete(cache.keys().next().value);
      void chrome.storage.session.set({[key]:{items:[...cache],retryAt}}).catch(() => {});
    }
    async function read(id) {
      const abort = new AbortController(), timer = setTimeout(() => abort.abort(),10000);
      let reader, date = '';
      try {
        if (Date.now() < retryAt) return '';
        const response = await fetch('https://www.youtube.com/watch?v=' + id,
          {credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:abort.signal});
        if (response.status === 429) { retryAt = Date.now()+300000; return ''; }
        if (!response.ok) return '';
        // Stop downloading as soon as the primary publication meta tag arrives.
        // Scripts and the rest of the watch page are never executed or mounted.
        reader = response.body?.getReader();
        if (!reader) return extractDate((await response.text()).slice(0,2500000));
        const decoder = new TextDecoder(); let tail = '', bytes = 0;
        while (bytes < 2500000) {
          const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength;
          const text = tail + decoder.decode(chunk.value,{stream:true});
          date = extractDate(text); if (date) break;
          tail = text.slice(-2048);
        }
        return date;
      } catch { return ''; }
      finally { clearTimeout(timer); if (reader) void reader.cancel().catch(() => {}); }
    }
    function pump() {
      while (active < 3 && queue.length) {
        const {id,resolve} = queue.shift(); active++;
        void read(id).then(date => {
          cache.delete(id); cache.set(id,{date,expires:Date.now()+(date ? 21600000 : 60000)}); persist(); resolve(date);
        }).finally(() => {pending.delete(id); active--; pump();});
      }
    }
    async function get(id) {
      if (!validId(id)) return '';
      loaded ||= chrome.storage.session.get(key).then(values => {
        const saved = values[key], now = Date.now();
        retryAt = Number.isFinite(saved?.retryAt) ? Math.min(saved.retryAt,now+300000) : 0;
        for (const item of Array.isArray(saved?.items) ? saved.items.slice(-512) : []) {
          if (!Array.isArray(item)) continue;
          const [id,entry] = item;
          if (validId(id) && entry?.expires > now && entry.expires <= now+21600000 &&
              (entry.date === '' || dateOnly(entry.date) === entry.date)) cache.set(id,entry);
        }
      }).catch(() => {});
      await loaded;
      const entry = cache.get(id);
      if (entry?.expires > Date.now()) return entry.date;
      if (pending.has(id)) return pending.get(id);
      if (queue.length >= 64 || Date.now() < retryAt) return '';
      const request = new Promise(resolve => queue.push({id,resolve})); pending.set(id,request); pump();
      return request;
    }
    return Object.freeze({get});
  }

  // Match date text, never derive an exact day from a relative age.
  const agePattern = /\d[\d,.]*\s*(?:(?:years?|months?|weeks?|days?|hours?|minutes?|seconds?|[ymwdhs])\s+ago|(?:年|个月|個月|月|周|週|天|日|小时|小時|分钟|分鐘|秒|か月|ヶ月|週間|時間|分)前|(?:년|개월|주|일|시간|분|초)\s*전|(?:tahun|bulan|minggu|hari|jam|minit|menit|saat)\s*(?:yang\s*)?lalu|(?:ปี|เดือน|สัปดาห์|วัน|ชั่วโมง|นาที|วินาที)(?:ที่แล้ว|ก่อน))/i;
  const calendarPattern = /\b\d{4}[-./]\s*\d{1,2}[-./]\s*\d{1,2}\b|\d{4}年\s*\d{1,2}月\s*\d{1,2}日|\b\d{1,2}[-./]\s*\d{1,2}[-./]\s*\d{4}\b|\b\d{1,2}\.?(?:\s+[\p{L}\p{M}.]+)+\s+\d{4}\b|\b[\p{L}\p{M}]{3,}\s+\d{1,2},?\s+\d{4}\b/iu;
  const dateSegment = text => agePattern.exec(text) || calendarPattern.exec(text);
  const yearOnly = /^\s*(?:19|20|21)\d{2}\s*$/;
  const cards = 'ytd-rich-item-renderer,ytd-rich-grid-media,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,ytd-playlist-video-renderer,yt-lockup-view-model';
  const cardTags=new Set(cards.split(','));
  const watchRoots = 'ytd-watch-metadata,ytd-video-primary-info-renderer,ytd-video-description-header-renderer';
  const cardDates = '#metadata-line .inline-metadata-item,#metadata-line > span,#video-info > span,.ytContentMetadataViewModelMetadataText,.yt-content-metadata-view-model-wiz__metadata-text,time[datetime]';
  const factoid = 'upload-time-factoid-renderer .ytwFactoidRendererFactoid';
  const watchDates = '#info,#info > span,#info-strings,#info-strings > *,#date,#date > *,#date-text,#date-text span,#date-text yt-formatted-string,time[datetime],' + factoid;
  const sources = 'meta[itemprop="datePublished"],link[rel="canonical"],#microformat,[itemtype*="VideoObject"]';
  const owned = 'data-ytc-publication-date';

  function createController() {
    if (window !== window.top || !['www.youtube.com','youtube.com'].includes(location.hostname)) return {handleMutations(){},dispose(){}};
    let disposed=false, frame=0, watchDirty=true, bindDirty=true, discoveryDirty=false, language='auto', inFlight=0, midnight=0;
    let watchId='', watchToken=0, watchDate='', watchRequested=false, watchRetryAt=0;
    const entries=new Map(), dirty=new Set(), ready=new Set(), dates=new Map(), records=new Map(), ownText=new WeakMap();
    const addedRoots=new Set(),removedRoots=new Set();
    const watchState={targets:new Set()}, watchedRoots=new Set();
    const style=document.createElement('style'); style.setAttribute('data-ytc-publication-owned','');
    style.textContent = `html body [${owned}]{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;-webkit-line-clamp:unset!important;overflow-wrap:anywhere}` +
      `html body :is(.ytContentMetadataViewModelMetadataRow,.yt-content-metadata-view-model-wiz__metadata-row):has(>[${owned}]){flex-wrap:wrap!important;row-gap:2px}` +
      `html body upload-time-factoid-renderer [${owned}]>:not(.ytc-publication-value){display:none!important}` +
      `html body .ytc-publication-value{font-size:14px;font-weight:600;line-height:1.4;text-align:center}` +
      `html body :is(${watchRoots}) #info:has([${owned}]){white-space:normal!important;overflow:visible!important;text-overflow:clip!important}`;
    (document.head||document.documentElement).append(style);
    const locale=()=>YTCustomizerI18n.resolveLanguage(language);
    const getId=card=>videoId(card.querySelector('a[href*="/watch?"],a[href^="/shorts/"],a[href^="/live/"]')?.href);
    function restore(target) {
      const record=records.get(target); if (!record) return;
      if (record.node.data===record.applied) record.node.data=record.original;
      record.added?.remove();
      for (const name of ['title','aria-label']) if (target.getAttribute(name)===record.appliedLabel) {
        const original=record.attributes[name]; if(original===null)target.removeAttribute(name);else target.setAttribute(name,original);
      }
      target.removeAttribute(owned); records.delete(target);
    }
    function clear(state) {for(const target of state.targets)restore(target);state.targets.clear();}
    function paint(target,date,state) {
      const formatted=formatDate(date,locale()); if(!formatted)return;
      let record=records.get(target);
      if(record&&(!target.contains(record.node)||record.node.data!==record.applied)){restore(target);record=null;}
      if(!record){
        if(target.matches(factoid)){
          const added=document.createElement('span');added.className='ytc-publication-value';added.setAttribute('data-ytc-publication-owned','');const node=document.createTextNode('');added.append(node);target.append(added);
          record={node,added,original:'',match:{0:'',index:0},attributes:{title:target.getAttribute('title'),'aria-label':target.getAttribute('aria-label')}};records.set(target,record);
        }else{
        const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let node,match;
        while(walker.nextNode()){node=walker.currentNode;match=dateSegment(node.data)||(yearOnly.test(target.textContent)?yearOnly.exec(node.data):null);if(match)break;}
        if(!match)return;
        record={node,original:node.data,match,attributes:{title:target.getAttribute('title'),'aria-label':target.getAttribute('aria-label')}};
        records.set(target,record);
        }
      }
      const text=record.original.slice(0,record.match.index)+formatted+record.original.slice(record.match.index+record.match[0].length);
      if(record.appliedLabel!==undefined)for(const name of ['title','aria-label'])if(target.getAttribute(name)!==record.appliedLabel)record.attributes[name]=target.getAttribute(name);
      record.applied=text;ownText.set(record.node,text);
      if(record.node.data!==text)record.node.data=text;
      record.appliedLabel=record.added ? text : target.textContent;
      for(const name of ['title','aria-label'])if(target.getAttribute(name)!==record.appliedLabel)target.setAttribute(name,record.appliedLabel);
      if(target.getAttribute(owned)!==date)target.setAttribute(owned,date);
      state.targets.add(target);
    }
    function targets(root,selector) {
      return [...root.querySelectorAll(selector)].filter(target=>{
        if(target.matches(factoid))return true;
        const row=target.closest('.ytContentMetadataViewModelMetadataRow,.yt-content-metadata-view-model-wiz__metadata-row');
        if(row&&row.querySelectorAll('.ytContentMetadataViewModelMetadataText,.yt-content-metadata-view-model-wiz__metadata-text').length<2){
          const first=row.parentElement.querySelector('.ytContentMetadataViewModelMetadataRow,.yt-content-metadata-view-model-wiz__metadata-row');
          if(first===row&&!dateSegment(target.getAttribute('aria-label')||''))return false;
        }
        if(yearOnly.test(target.textContent)){
          const label=target.getAttribute('aria-label');if(label&&!yearOnly.test(label)&&!dateSegment(label))return false;
          if(target.closest('#date,#date-text'))return true;
          const line=row||target.closest('#metadata-line,#video-info,#info,#info-strings');
          if(!line)return false;
          const fields=[...line.querySelectorAll(row?'.ytContentMetadataViewModelMetadataText,.yt-content-metadata-view-model-wiz__metadata-text':'span')].filter(node=>node.textContent.trim());
          return fields.length>1&&fields.at(-1)===target;
        }
        return records.has(target)||dateSegment(target.textContent);
      }).filter((target,index,all)=>!all.some(other=>other!==target&&target.contains(other)));
    }
    function updateTargets(state,list,date) {
      const current=new Set(list);for(const target of state.targets)if(!current.has(target)){restore(target);state.targets.delete(target);}
      if(date)for(const target of list)paint(target,date,state);
    }
    function relevant(recordsList) {
      return recordsList.some(record=>{
        if(record.type==='characterData')return ownText.get(record.target)!==record.target.data;
        if(record.type==='attributes'&&records.has(record.target)&&record.target.getAttribute(record.attributeName)===records.get(record.target).appliedLabel)return false;
        return true;
      });
    }
    function relevantCard(entry,changes){
      for(const record of changes){
        if(record.type==='characterData'){if(ownText.get(record.target)!==record.target.data)return true;continue;}
        if(record.type==='attributes'){if(record.attributeName==='datetime'||getId(entry.card)!==entry.id)return true;continue;}
        const target=record.target instanceof Element?record.target:record.target.parentElement;
        if(entry.dateNodes.some(date=>date===target||date.contains(target)))return true;
        if(getId(entry.card)!==entry.id)return true;
        // Preview clocks, rolling view counts and title text are owned by
        // YouTube. They do not invalidate a video's publication date.
        if(target?.closest('ytd-thumbnail,yt-thumbnail-view-model,.ytThumbnailViewModelHost,.ytLockupViewModelContentImage'))continue;
        for(const node of record.removedNodes)if(node instanceof Element&&entry.dateNodes.some(date=>node===date||node.contains(date)))return true;
        for(const node of record.addedNodes)if(node instanceof Element&&!node.hasAttribute('data-ytc-publication-owned')&&(node.matches(cardDates)||node.querySelector(cardDates)))return true;
      }
      return false;
    }
    function observeCard(entry){
      entry.observer.disconnect();if(!entry.visible||document.hidden)return;
      entry.observer.observe(entry.card,{subtree:true,childList:true,attributes:true,attributeFilter:['href']});
      for(const target of entry.dateNodes)entry.observer.observe(target,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['datetime']});
    }
    const intersection=new IntersectionObserver(changes=>{
      for(const change of changes){const entry=entries.get(change.target);if(!entry)continue;entry.visible=change.isIntersecting;
        observeCard(entry);
        if(entry.visible&&!document.hidden){dirty.add(entry);}
        else ready.delete(entry);
      }schedule();
    },{rootMargin:'160px'});
    function addCard(card) {
      if(entries.has(card)||card.parentElement?.closest(cards))return;
      card.querySelectorAll(cards).forEach(removeCard);
      const entry={card,targets:new Set(),dateNodes:[],visible:false,id:'',date:'',requested:false,retryAt:0,token:0};
      entry.observer=new MutationObserver(changes=>{if(!document.hidden&&relevantCard(entry,changes)){dirty.add(entry);schedule();}});
      entries.set(card,entry);intersection.observe(card);
    }
    function removeCard(card) {
      const entry=entries.get(card);if(!entry)return;entry.token++;entry.observer.disconnect();intersection.unobserve(card);
      ready.delete(entry);dirty.delete(entry);clear(entry);entries.delete(card);
    }
    function discover(root) {
      // An outer card already owns its metadata, including later hydration.
      if(entries.has(root)||root.parentElement?.closest(cards))return;
      if(root instanceof Element&&root.matches(cards))addCard(root);
      root.querySelectorAll?.(cards).forEach(addCard);
    }
    function outerRoots(roots){
      return [...roots].filter(root=>{for(let parent=root.parentElement;parent;parent=parent.parentElement)if(roots.has(parent))return false;return true;});
    }
    function registeredCard(target){
      for(let card=target?.closest(cards);card;card=card.parentElement?.closest(cards))if(entries.has(card))return card;
      return null;
    }
    function pruneRemoved(){
      for(const node of outerRoots(removedRoots))if(!node.isConnected){if(entries.has(node))removeCard(node);node.querySelectorAll(cards).forEach(removeCard);}
      removedRoots.clear();
      if([...watchedRoots].some(root=>!root.isConnected))watchDirty=bindDirty=true;
    }
    function discoverChanges(){
      pruneRemoved();const watchRoute=Boolean(videoId(location.href));
      for(const node of outerRoots(addedRoots))if(node.isConnected){
        discover(node);
        if(watchRoute&&(node.matches(watchRoots+','+sources)||node.querySelector(watchRoots+','+sources)))watchDirty=bindDirty=true;
      }
      addedRoots.clear();
    }
    async function lookup(id) {
      if(dates.has(id))return dates.get(id);
      let date='';try{date=dateOnly((await YTCustomizer.sendRuntimeMessage({type:'YT_PUBLICATION_DATE',videoId:id}))?.date);}catch{}
      if(date)dates.set(id,date);while(dates.size>512)dates.delete(dates.keys().next().value);return date;
    }
    function pump() {
      if(disposed||document.hidden)return;
      while(inFlight<2&&ready.size){const entry=ready.values().next().value;ready.delete(entry);
        if(!entry.visible||!entry.card.isConnected||entry.requested||!entry.id)continue;
        entry.requested=true;const id=entry.id,token=entry.token;inFlight++;
        void lookup(id).then(date=>{if(!disposed&&entry.token===token&&getId(entry.card)===id){entry.date=date;entry.retryAt=date?0:Date.now()+60000;if(!document.hidden){dirty.add(entry);schedule();}}})
          .finally(()=>{inFlight--;pump();});
      }
    }
    const watchObserver=new MutationObserver(changes=>{if(relevant(changes)){watchDirty=true;schedule();}});
    const sourceObserver=new MutationObserver(changes=>{
      if(changes.some(record=>record.target instanceof Element&&(record.target.matches(sources)||[...record.addedNodes].some(node=>node instanceof Element&&(node.matches(sources)||node.querySelector(sources)))))){watchDirty=true;schedule();}
    });
    function bindWatch() {
      bindDirty=false;watchObserver.disconnect();watchedRoots.clear();
      sourceObserver.disconnect();
      // Search/Home updates do not need whole-document watch/source queries.
      if(!videoId(location.href))return;
      if(document.head)sourceObserver.observe(document.head,{subtree:true,childList:true,attributes:true,attributeFilter:['content','href']});
      document.querySelectorAll(watchRoots).forEach(root=>{watchedRoots.add(root);watchObserver.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['datetime']});});
      document.querySelectorAll('#microformat,[itemtype*="VideoObject"]').forEach(root=>sourceObserver.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['content','href','itemid']}));
    }
    function refreshWatch() {
      watchDirty=false;const id=videoId(location.href);
      if(id!==watchId){watchId=id;watchToken++;watchDate='';watchRequested=false;watchRetryAt=0;clear(watchState);}
      if(!id){clear(watchState);return;}
      const canonical=videoId(document.querySelector('link[rel="canonical"]')?.href);
      for(const meta of document.querySelectorAll('meta[itemprop="datePublished"]')){
        const object=meta.closest('[itemtype*="VideoObject"]');
        const identifiers=[videoId(object?.getAttribute('itemid')),object?.querySelector('meta[itemprop="identifier"]')?.content].filter(validId);
        // Canonical links can update before the old video's body metadata.
        // Prefer the identity attached to the publication date itself.
        if(identifiers.length?identifiers.every(value=>value===id):canonical===id){const date=dateOnly(meta.content);if(date){watchDate=date;dates.set(id,date);break;}}
      }
      const list=[...watchedRoots].flatMap(root=>targets(root,watchDates));
      updateTargets(watchState,list,watchDate);
      if(watchRequested&&!watchDate&&watchRetryAt&&Date.now()>=watchRetryAt)watchRequested=false;
      if(!watchDate&&!watchRequested&&list.length){watchRequested=true;const token=watchToken;
        void lookup(id).then(date=>{if(!disposed&&watchToken===token&&id===videoId(location.href)){if(date)watchDate=date;watchRetryAt=Date.now()+60000;watchDirty=true;schedule();}});
      }
    }
    function flush() {
      frame=0;if(disposed||document.hidden)return;if(!style.isConnected)(document.head||document.documentElement).append(style);
      discoverChanges();
      if(bindDirty)bindWatch();if(watchDirty)refreshWatch();
      for(const entry of dirty){if(!entry.visible||!entry.card.isConnected)continue;
        const id=getId(entry.card);if(id!==entry.id){entry.token++;entry.id=id;entry.date=dates.get(id)||'';entry.requested=dates.has(id);entry.retryAt=0;clear(entry);}
        if(entry.requested&&!entry.date&&entry.retryAt&&Date.now()>=entry.retryAt)entry.requested=false;
        const list=targets(entry.card,cardDates);updateTargets(entry,list,entry.date);
        if(list.length!==entry.dateNodes.length||list.some((target,index)=>target!==entry.dateNodes[index])){entry.dateNodes=list;observeCard(entry);}
        if(id&&list.length&&!entry.date&&!entry.requested)ready.add(entry);
      }dirty.clear();pump();
    }
    function schedule(){if(!disposed&&!document.hidden&&!frame)frame=requestAnimationFrame(flush);}
    function navigation(){watchDirty=bindDirty=true;schedule();}
    function refreshAges(){watchDirty=true;for(const entry of entries.values())if(entry.visible)dirty.add(entry);schedule();}
    function setMidnight(){clearTimeout(midnight);const next=new Date();next.setHours(24,0,1,0);midnight=setTimeout(()=>{refreshAges();setMidnight();},next-new Date());}
    function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;ready.clear();dirty.clear();if(addedRoots.size)discoveryDirty=true;addedRoots.clear();pruneRemoved();for(const entry of entries.values())entry.observer.disconnect();}
      else{if(discoveryDirty){discoveryDirty=false;discover(document);}for(const entry of entries.values())observeCard(entry);navigation();refreshAges();}}
    function stored(changes,area){if(area==='local'&&changes.menuLanguage){language=changes.menuLanguage.newValue||'auto';refreshAges();}}
    const events=['yt-navigate-finish','yt-page-data-updated'];for(const event of events)document.addEventListener(event,navigation);
    window.addEventListener('popstate',navigation);document.addEventListener('visibilitychange',visibility);chrome.storage.onChanged.addListener(stored);
    void chrome.storage.local.get({menuLanguage:'auto'}).then(value=>{if(!disposed){language=value.menuLanguage;refreshAges();}}).catch(()=>{});
    discover(document);setMidnight();schedule();
    return {
      handleMutations(changes){if(disposed)return;
        const watchRoute=Boolean(videoId(location.href));
        for(const record of changes){if(record.type!=='childList')continue;
          const target=record.target instanceof Element?record.target:record.target.parentElement;
          // Card observers already handle metadata hydration/replacement. Do
          // not queue another frame for each thumbnail or preview update.
          if(registeredCard(target))continue;
          for(const node of record.removedNodes){if(!(node instanceof Element)||node.isConnected)continue;
            if(node.childElementCount||entries.has(node)||watchedRoots.has(node))removedRoots.add(node);
          }
          for(const node of record.addedNodes){if(!(node instanceof Element)||!node.isConnected||node.hasAttribute('data-ytc-publication-owned'))continue;if(document.hidden){discoveryDirty=true;continue;}
            if(node.childElementCount||cardTags.has(node.localName)||watchRoute&&node.matches(watchRoots+','+sources))addedRoots.add(node);
          }
        }if(document.hidden)pruneRemoved();else if(addedRoots.size||removedRoots.size)schedule();
      },
      dispose(){disposed=true;watchToken++;cancelAnimationFrame(frame);clearTimeout(midnight);intersection.disconnect();watchObserver.disconnect();sourceObserver.disconnect();
        for(const card of [...entries.keys()])removeCard(card);clear(watchState);style.remove();dirty.clear();ready.clear();addedRoots.clear();removedRoots.clear();
        for(const event of events)document.removeEventListener(event,navigation);window.removeEventListener('popstate',navigation);document.removeEventListener('visibilitychange',visibility);
        YTCustomizer.removeExtensionListener(chrome.storage.onChanged,stored);
      }
    };
  }
  globalThis.YTCustomizerPublicationDates=Object.freeze({videoId,dateOnly,elapsedYears,formatDate,extractDate,createService,createController});
})();
