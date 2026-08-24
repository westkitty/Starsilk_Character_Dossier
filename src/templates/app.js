(function(){
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && (navigator.connection.saveData ||
    ['slow-2g', '2g'].indexOf(navigator.connection.effectiveType) !== -1));

  // ---------------------------------------------------------------------
  // Accordion disclosures: nav-group / media-shelf (WAAPI height animation)
  // ---------------------------------------------------------------------
  function enhanceAccordion(details){
    var summary = details.querySelector(':scope > summary');
    var body = details.querySelector(':scope > .nav-group-body, :scope > div');
    if(!summary || !body) return;
    if(reduceMotion) return; // native instant toggle remains fully functional
    var anim = null;
    summary.addEventListener('click', function(e){
      e.preventDefault();
      if(details.classList.contains('animating')) return;
      details.open ? collapse() : expand();
    });
    function expand(){
      details.classList.add('animating');
      details.open = true;
      body.style.overflow = 'hidden';
      var end = body.scrollHeight;
      if(anim) anim.cancel();
      anim = body.animate(
        [{height:'0px', opacity:.4}, {height:end+'px', opacity:1}],
        {duration:420, easing:'cubic-bezier(0.16,1,0.3,1)'}
      );
      anim.onfinish = function(){ details.classList.remove('animating'); body.style.height=''; body.style.overflow=''; };
    }
    function collapse(){
      details.classList.add('animating');
      body.style.overflow = 'hidden';
      var start = body.offsetHeight;
      if(anim) anim.cancel();
      anim = body.animate(
        [{height:start+'px', opacity:1}, {height:'0px', opacity:.4}],
        {duration:320, easing:'cubic-bezier(0.16,1,0.3,1)'}
      );
      anim.onfinish = function(){ details.open = false; details.classList.remove('animating'); body.style.height=''; body.style.overflow=''; };
    }
  }
  document.querySelectorAll('details.nav-group, details.media-shelf').forEach(enhanceAccordion);

  // ---------------------------------------------------------------------
  // Default-collapsed page-section anchor handling + print expand/restore
  // ---------------------------------------------------------------------
  (function(){
    function expandContaining(id){
      var target = document.getElementById(id);
      if(!target) return null;
      var page = target.querySelector(':scope > details.page-disclosure') || target.closest('details.page-disclosure');
      if(page && !page.open) page.open = true;
      return target;
    }
    function handleHash(){
      if(!location.hash || location.hash.length < 2) return;
      var id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch(e) { id = location.hash.slice(1); }
      var target = expandContaining(id);
      if(!target) return;
      var jump = function(){ target.scrollIntoView({block:'start', behavior:'auto'}); };
      jump();
      requestAnimationFrame(jump);
      setTimeout(jump, 80);
    }
    window.addEventListener('hashchange', handleHash);
    handleHash();

    // Printing a closed native <details> renders nothing for its collapsed
    // content in every current browser engine, regardless of any authored
    // CSS override -- force every page open for the duration of the print
    // job, then restore whatever was open beforehand. This does NOT touch
    // video src/activation: video elements are display:none in print
    // (see the print stylesheet), so the intersection-observer lazy loader
    // below never treats them as visible and never fetches them.
    var wasOpenBeforePrint = null;
    window.addEventListener('beforeprint', function(){
      var pages = document.querySelectorAll('details.page-disclosure');
      wasOpenBeforePrint = Array.prototype.map.call(pages, function(d){ return d.open; });
      pages.forEach(function(d){ d.open = true; });
    });
    window.addEventListener('afterprint', function(){
      if(!wasOpenBeforePrint) return;
      var pages = document.querySelectorAll('details.page-disclosure');
      pages.forEach(function(d, i){ d.open = wasOpenBeforePrint[i]; });
      wasOpenBeforePrint = null;
    });
  })();

  // ---------------------------------------------------------------------
  // Intent/visibility-aware media loading.
  //
  // Every non-hero, non-watermark <video> is built with data-lazy-src
  // instead of src. Activation happens ONLY when the element actually
  // approaches the viewport, via IntersectionObserver -- never merely
  // because its containing <details> became open. This is deliberate:
  // opening a section (by hand, by Expand All, by search, or by print
  // preparation) changes layout/visibility but is not itself a signal
  // that the user wants THIS specific video downloaded, and bulk-open
  // actions must never cascade into fetching the entire video archive.
  // ---------------------------------------------------------------------
  (function(){
    function activate(video){
      if(video.hasAttribute('data-lazy-src')){
        video.src = video.getAttribute('data-lazy-src');
        video.removeAttribute('data-lazy-src');
      }
      video.querySelectorAll('source[data-lazy-src]').forEach(function(s){
        s.src = s.getAttribute('data-lazy-src');
        s.removeAttribute('data-lazy-src');
      });
      video.load();
    }
    var lazyVideos = Array.prototype.slice.call(document.querySelectorAll(
      'video[data-lazy-src], video:has(source[data-lazy-src])'
    ));
    if(!lazyVideos.length) return;

    if(!('IntersectionObserver' in window)){
      // No IO support: fall back to activating on user-driven open, which
      // is still "explicitly requested" rather than a bulk/incidental one.
      document.querySelectorAll('details.page-disclosure').forEach(function(d){
        d.addEventListener('toggle', function(){
          if(d.open) d.querySelectorAll('video[data-lazy-src]').forEach(activate);
        });
      });
      return;
    }

    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          activate(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, {rootMargin: '200px 0px', threshold: 0.01});

    lazyVideos.forEach(function(v){ io.observe(v); });
  })();

  // ---------------------------------------------------------------------
  // Mobile menu toggle + nav link focus management
  // ---------------------------------------------------------------------
  var index = document.getElementById('index');
  var menuToggle = document.getElementById('menuToggle');
  if(menuToggle && index){
    menuToggle.addEventListener('click', function(){
      var panel = document.querySelector('.index-panel');
      var inner = document.querySelector('.index-panel-inner');
      var opening = !index.classList.contains('open');
      menuToggle.setAttribute('aria-expanded', opening ? 'true' : 'false');
      if(!panel || !inner || reduceMotion){
        index.classList.toggle('open');
        return;
      }
      if(panel.__anim) panel.__anim.cancel();
      if(opening){
        index.classList.add('open');
        var end = inner.scrollHeight;
        panel.style.overflow = 'hidden';
        panel.__anim = panel.animate([{height:'0px'},{height:end+'px'}], {duration:360, easing:'cubic-bezier(0.16,1,0.3,1)'});
        inner.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}], {duration:300, easing:'cubic-bezier(0.16,1,0.3,1)'});
        panel.__anim.onfinish = function(){ panel.style.height=''; panel.style.overflow=''; };
      } else {
        var start = panel.offsetHeight;
        panel.style.overflow = 'hidden';
        panel.__anim = panel.animate([{height:start+'px'},{height:'0px'}], {duration:280, easing:'cubic-bezier(0.16,1,0.3,1)'});
        panel.__anim.onfinish = function(){ index.classList.remove('open'); panel.style.height=''; panel.style.overflow=''; };
      }
    });
  }
  if(index){
    index.querySelectorAll('a[href^="#"]').forEach(function(a){
      a.addEventListener('click', function(){
        if(index.classList.contains('open')){
          index.classList.remove('open');
          if(menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
        }
        var targetId = a.getAttribute('href').slice(1);
        if(targetId){
          setTimeout(function(){
            var target = document.getElementById(targetId);
            if(target){
              var heading = target.querySelector('h1, h2, h3, [tabindex]') || target;
              heading.setAttribute('tabindex', '-1');
              heading.focus();
            }
          }, 10);
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // Current-location wayfinding
  // ---------------------------------------------------------------------
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.index nav a[href^="#"]'));
  var linkMap = new Map();
  navLinks.forEach(function(link){
    var id = link.getAttribute('href').slice(1);
    if(id) linkMap.set(id, link);
  });
  var observedSections = Array.prototype.slice.call(document.querySelectorAll('section[id], article[id]'))
    .filter(function(sec){ return linkMap.has(sec.id); });

  var activeId = null;
  if('IntersectionObserver' in window && observedSections.length > 0){
    var wayfindObserver = new IntersectionObserver(function(entries){
      var visible = entries.filter(function(e){ return e.isIntersecting; });
      if(visible.length > 0){
        visible.sort(function(a, b){ return b.intersectionRatio - a.intersectionRatio; });
        var targetId = visible[0].target.id;
        if(targetId && targetId !== activeId){
          activeId = targetId;
          navLinks.forEach(function(l){
            if(l.getAttribute('href') === '#' + targetId){
              l.setAttribute('aria-current', 'location');
              l.classList.add('active');
              var parentDetails = l.closest('details.nav-group');
              if(parentDetails && !parentDetails.open) parentDetails.open = true;
            } else {
              l.removeAttribute('aria-current');
              l.classList.remove('active');
            }
          });
        }
      }
    }, {rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.2, 0.5, 1.0]});
    observedSections.forEach(function(sec){ wayfindObserver.observe(sec); });
  }

  // ---------------------------------------------------------------------
  // Unified dossier search: one box, one system.
  //   - Filters/opens matching nav groups (title/label matching).
  //   - Opens and highlights matching page-disclosures (full-content
  //     matching), wrapping matched text in <mark> for visible highlight.
  //   - Reports "N / M" position while stepping with Enter / Shift+Enter.
  //   - Never touches video src/activation (IntersectionObserver above
  //     owns that independently of open/close state).
  //   - Clearing the query un-highlights everything and returns any
  //     section opened ONLY because of the search back to its prior
  //     state, unless the reader independently toggled it meanwhile.
  // ---------------------------------------------------------------------
  (function(){
    var searchInput = document.getElementById('dossierSearch');
    if(!searchInput) return;
    var status = document.getElementById('dossierSearchStatus');
    var pages = Array.prototype.slice.call(document.querySelectorAll('main#mainContent > section.page[id]'))
      .filter(function(p){ return !p.classList.contains('cover'); });

    var autoOpened = new Set();    // ids opened by search, eligible to auto-close on clear
    var userToggled = new Set();   // ids the reader toggled themselves meanwhile
    var pendingAutoToggle = new Set(); // ids whose NEXT toggle event was caused by this script,
                                        // not the reader -- <details> dispatches 'toggle'
                                        // asynchronously (a queued task), so a synchronous
                                        // "is this our own mutation" flag can't reliably still
                                        // be true by the time the event actually fires. Keying
                                        // by id and consuming one pending toggle at a time
                                        // works regardless of that delay.
    var marks = [];               // <mark> elements across all matches, in document order
    var markIndex = -1;

    pages.forEach(function(p){
      var d = p.querySelector(':scope > details.page-disclosure');
      if(!d) return;
      d.addEventListener('toggle', function(){
        if(pendingAutoToggle.has(p.id)){
          pendingAutoToggle.delete(p.id);
          return;
        }
        userToggled.add(p.id);
        autoOpened.delete(p.id);
      });
    });

    // Same auto-open/restore contract as page disclosures above, but for
    // sidebar nav-groups the search filter force-opens to reveal matches.
    var navAutoOpened = new Set();      // groups opened only because of the search
    var navUserToggled = new Set();     // groups the reader toggled themselves meanwhile
    var navPendingAutoToggle = new Set(); // groups whose next toggle event is our own mutation
    document.querySelectorAll('.index .nav-group').forEach(function(group){
      group.addEventListener('toggle', function(){
        if(navPendingAutoToggle.has(group)){
          navPendingAutoToggle.delete(group);
          return;
        }
        navUserToggled.add(group);
        navAutoOpened.delete(group);
      });
    });

    function clearMarks(){
      marks.forEach(function(m){
        var parent = m.parentNode;
        if(!parent) return;
        parent.replaceChild(document.createTextNode(m.textContent), m);
        parent.normalize();
      });
      marks = [];
      markIndex = -1;
    }

    function clearSectionHighlight(){
      pages.forEach(function(p){
        var d = p.querySelector(':scope > details.page-disclosure');
        if(d) d.classList.remove('search-match');
      });
    }

    // Wrap every case-insensitive occurrence of `needle` inside real text
    // nodes of `root`, skipping script/style/summary title text so the
    // entity name in a page's own title is never itself re-highlighted
    // in a way that fights the disclosure chevron layout.
    function highlightIn(root, needle){
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node){
          var p = node.parentElement;
          if(!p) return NodeFilter.FILTER_REJECT;
          var tag = p.tagName;
          if(tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var textNodes = [];
      var n;
      while((n = walker.nextNode())) textNodes.push(n);
      var lowerNeedle = needle.toLowerCase();
      textNodes.forEach(function(node){
        var text = node.nodeValue;
        var lower = text.toLowerCase();
        var idx = lower.indexOf(lowerNeedle);
        if(idx === -1) return;
        var frag = document.createDocumentFragment();
        var pos = 0;
        while(idx !== -1){
          frag.appendChild(document.createTextNode(text.slice(pos, idx)));
          var mark = document.createElement('mark');
          mark.className = 'search-hit';
          mark.textContent = text.slice(idx, idx + needle.length);
          frag.appendChild(mark);
          marks.push(mark);
          pos = idx + needle.length;
          idx = lower.indexOf(lowerNeedle, pos);
        }
        frag.appendChild(document.createTextNode(text.slice(pos)));
        node.parentNode.replaceChild(frag, node);
      });
    }

    function setStatus(){
      if(!status) return;
      if(!marks.length){
        status.textContent = searchInput.value.trim() ? 'No matches' : '';
        return;
      }
      var pos = markIndex >= 0 ? (markIndex + 1) : 1;
      status.textContent = pos + ' / ' + marks.length + ' — Enter to jump';
    }

    function runSearch(q){
      clearMarks();
      clearSectionHighlight();

      // Nav filter (title/label matching) -- same behavior as the old
      // sidebar "Filter dossier" box, folded into the one search.
      var groups = document.querySelectorAll('.index .nav-group');
      groups.forEach(function(group){
        var links = group.querySelectorAll('.nav-group-body a');
        var matched = 0;
        links.forEach(function(link){
          var text = link.textContent.toLowerCase();
          var href = (link.getAttribute('href') || '').toLowerCase();
          var match = !q || text.indexOf(q.toLowerCase()) !== -1 || href.indexOf(q.toLowerCase()) !== -1;
          link.style.display = match ? '' : 'none';
          if(match) matched++;
        });
        if(q){
          group.style.display = matched > 0 ? '' : 'none';
          if(matched > 0 && !group.open){
            navPendingAutoToggle.add(group);
            group.open = true;
            navAutoOpened.add(group);
          }
        } else {
          group.style.display = '';
        }
      });

      if(!q){
        // Restore sections that were opened only because of the search.
        autoOpened.forEach(function(id){
          if(userToggled.has(id)) return;
          var p = document.getElementById(id);
          var d = p && p.querySelector(':scope > details.page-disclosure');
          if(d && d.open){ pendingAutoToggle.add(id); d.open = false; }
        });
        autoOpened.clear();
        // Restore nav-groups that were opened only because of the search.
        navAutoOpened.forEach(function(group){
          if(navUserToggled.has(group)) return;
          if(group.open){ navPendingAutoToggle.add(group); group.open = false; }
        });
        navAutoOpened.clear();
        setStatus();
        return;
      }

      pages.forEach(function(p){
        var d = p.querySelector(':scope > details.page-disclosure');
        if(!d) return;
        var hay = p.textContent.toLowerCase();
        if(hay.indexOf(q.toLowerCase()) === -1) return;
        var wasOpen = d.open;
        if(!wasOpen){
          pendingAutoToggle.add(p.id);
          d.open = true;
          autoOpened.add(p.id);
        }
        d.classList.add('search-match');
        highlightIn(d, q);
      });

      setStatus();
    }

    function goToMatch(dir){
      if(!marks.length) return;
      markIndex = (markIndex + dir + marks.length) % marks.length;
      marks[markIndex].scrollIntoView({block: 'center', behavior: reduceMotion ? 'auto' : 'smooth'});
      setStatus();
    }

    var debounceTimer;
    searchInput.addEventListener('input', function(){
      clearTimeout(debounceTimer);
      var q = searchInput.value.trim();
      if(q === 'ajd' && typeof setArchiveMode === 'function'){
        setArchiveMode(true);
        searchInput.value = '';
        runSearch('');
        return;
      }
      debounceTimer = setTimeout(function(){ runSearch(q); }, 120);
    });
    searchInput.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){
        e.preventDefault();
        goToMatch(e.shiftKey ? -1 : 1);
      }
    });
  })();

  // ---------------------------------------------------------------------
  // Top-of-content controls: expand/collapse all, sidebar toggle, mode
  // ---------------------------------------------------------------------
  var expandAllBtn = document.getElementById('expandAllBtn');
  var collapseAllBtn = document.getElementById('collapseAllBtn');
  if(expandAllBtn){
    expandAllBtn.addEventListener('click', function(){
      document.querySelectorAll('details.page-disclosure').forEach(function(d){ d.open = true; });
    });
  }
  if(collapseAllBtn){
    collapseAllBtn.addEventListener('click', function(){
      document.querySelectorAll('details.page-disclosure').forEach(function(d){ d.open = false; });
    });
  }

  var sidebarToggle = document.getElementById('sidebarToggle');
  if(sidebarToggle){
    var SIDEBAR_KEY = 'starsilk-sidebar-collapsed';
    var setSidebarCollapsed = function(collapsed){
      document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
      sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
      sidebarToggle.textContent = collapsed ? 'Show index' : 'Hide index';
      try { localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch(e){}
    };
    sidebarToggle.addEventListener('click', function(){
      setSidebarCollapsed(!document.documentElement.classList.contains('sidebar-collapsed'));
    });
    var sidebarInitial = false;
    try { sidebarInitial = localStorage.getItem(SIDEBAR_KEY) === '1'; } catch(e){}
    if(sidebarInitial) setSidebarCollapsed(true);
  }

  // Reader mode (default) vs. Archive/reference-authoring mode: the 26
  // legacy attachment slots, drag/drop, clear, and export stay fully
  // functional, just tucked behind an explicit toggle rather than
  // presented as ordinary public-site reading controls.
  var modeToggle = document.getElementById('modeToggle');
  var copyPromptBtn = document.getElementById('copyImplementationPrompt');
  var copyPromptStatus = document.getElementById('copyPromptStatus');
  if(modeToggle){
    var setArchiveMode = function(on){
      document.documentElement.classList.toggle('archive-mode', on);
      modeToggle.setAttribute('aria-pressed', String(on));
      modeToggle.textContent = on ? 'Reader mode' : 'Archive tools';
      modeToggle.hidden = !on;
      if(copyPromptBtn) copyPromptBtn.hidden = !on;
      if(!on && copyPromptStatus) copyPromptStatus.textContent = '';
    };
    modeToggle.addEventListener('click', function(){
      setArchiveMode(false);
    });
    try { localStorage.removeItem('starsilk-archive-mode'); } catch(e){}
    setArchiveMode(false);
  }

  // ---------------------------------------------------------------------
  // Scoped attachment bank (26 legacy reference slots)
  // ---------------------------------------------------------------------
  var stages = Array.prototype.slice.call(document.querySelectorAll('.attachment-stage'));
  var assetStatus = document.getElementById('assetStatus');
  var ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  var localFileMeta = new WeakMap();
var initialStageState = new WeakMap();
stages.forEach(function(stage, index){
  var record = stage.closest('[data-asset-key]');
  var numberEl = stage.querySelector('.asset-number');
  var titleEl = record ? record.querySelector('figcaption b') : null;
  var img = stage.querySelector('img');
  initialStageState.set(stage, {
    slot: numberEl ? numberEl.textContent.trim() : String(index + 1),
    asset_key: record ? (record.getAttribute('data-asset-key') || '') : '',
    title: titleEl ? titleEl.textContent.trim() : (stage.getAttribute('aria-label') || '').replace(/^Attach image for /, ''),
    src: img ? (img.getAttribute('src') || '') : '',
    hidden: img ? img.hidden : true
  });
});

  function attachedCount(){
    return stages.filter(function(s){
      var img = s.querySelector('img');
      return img && !img.hidden && img.hasAttribute('src') && img.getAttribute('src');
    }).length;
  }
  function refreshStatus(){
    if(assetStatus) assetStatus.textContent = attachedCount() + ' of ' + stages.length + ' legacy reference slots filled';
  }
  function showInlineError(stage, msg){
    var err = stage.querySelector('.attachment-error');
    if(!err){
      err = document.createElement('div');
      err.className = 'attachment-error';
      err.setAttribute('role', 'alert');
      stage.appendChild(err);
    }
    err.textContent = msg;
    setTimeout(function(){ if(err && err.parentNode) err.remove(); }, 6000);
  }
  function clearInlineError(stage){
    var err = stage.querySelector('.attachment-error');
    if(err) err.remove();
  }
  function loadInto(stage, file){
    if(!file) return;
    if(ACCEPTED_TYPES.indexOf(file.type.toLowerCase()) === -1){
      showInlineError(stage, 'Unsupported file format. Please attach a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    clearInlineError(stage);
    localFileMeta.set(stage, {name: file.name || '', type: file.type || '', bytes: file.size || 0});
    var reader = new FileReader();
    reader.onload = function(){
      var img = stage.querySelector('img');
      if(img){ img.src = reader.result; img.hidden = false; }
      var empty = stage.querySelector('.image-empty');
      if(empty) empty.hidden = true;
      refreshStatus();
    };
    reader.readAsDataURL(file);
  }
  stages.forEach(function(stage){
    var input = stage.querySelector('.asset-file');
    if(!input) return;
    input.addEventListener('change', function(){
      if(input.files && input.files[0]) loadInto(stage, input.files[0]);
    });
    stage.addEventListener('dragover', function(e){
      e.preventDefault();
      stage.style.boxShadow = 'inset 0 0 0 2px #55dfff';
    });
    stage.addEventListener('dragleave', function(){ stage.style.boxShadow = ''; });
    stage.addEventListener('drop', function(e){
      e.preventDefault();
      stage.style.boxShadow = '';
      if(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) loadInto(stage, e.dataTransfer.files[0]);
    });
  });

  var clearBtn = document.getElementById('clearImages');
  if(clearBtn){
    clearBtn.addEventListener('click', function(){
      if(attachedCount() === 0) return;
      if(!window.confirm('Clear all attached reference images?')) return;
      stages.forEach(function(stage){
        var img = stage.querySelector('img');
        if(img){ img.removeAttribute('src'); img.hidden = true; }
        var empty = stage.querySelector('.image-empty');
        if(empty) empty.hidden = false;
        var input = stage.querySelector('.asset-file');
        if(input) input.value = '';
        localFileMeta.delete(stage);
        clearInlineError(stage);
      });
      refreshStatus();
    });
  }

  function collectLocalArchiveChanges(){
    var changes = [];
    stages.forEach(function(stage){
      var initial = initialStageState.get(stage);
      if(!initial) return;
      var img = stage.querySelector('img');
      var currentSrc = img ? (img.getAttribute('src') || '') : '';
      var currentHidden = img ? img.hidden : true;
      if(currentSrc === initial.src && currentHidden === initial.hidden) return;
      var meta = localFileMeta.get(stage) || null;
      var currentVisible = !!(currentSrc && !currentHidden);
      var initialVisible = !!(initial.src && !initial.hidden);
      changes.push({
        slot: initial.slot,
        asset_key: initial.asset_key || null,
        title: initial.title,
        identity_status: initial.asset_key ? 'stable' : 'missing',
        action: currentVisible ? (initialVisible ? 'replace' : 'attach') : 'clear',
        local_file: meta ? {name: meta.name, type: meta.type, bytes: meta.bytes} : null,
        initial_src: initial.src || null
      });
    });
    return changes;
  }

  function buildImplementationPrompt(changes){
    var manifest = JSON.stringify(changes, null, 2);
    var unresolved = changes.filter(function(change){ return !change.asset_key; });
    return [
      'Implement my browser-local Archive Tools changes in the Starsilk Compendium repository.',
      '',
      'Repository: https://github.com/westkitty/Starsilk_Character_Dossier',
      'Target production branch: main',
      '',
      'REALITY / AUTHORITY RULES',
      '- Inspect the current repository state before editing. Do not assume this prompt is newer than main.',
      '- Preserve the deterministic authority flow: src/content/ + src/templates/ -> build/generate.py -> docs/index.html -> build/validate.py.',
      '- Do not hand-edit docs/index.html as authoritative source.',
      '- Preserve src/canon/invariants.json as the canon-lock authority and docs/asset-manifest.json as published-media provenance.',
      '- Archive Tools are browser-local maintenance controls. This prompt is a handoff request, not evidence that GitHub was already changed.',
      '- Every changed legacy slot must retain the stable asset_key listed in the manifest. Never substitute DOM position for that identity.',
      '',
      'LOCAL CHANGE MANIFEST',
      manifest,
      '',
      'REQUIRED LOCAL EVIDENCE',
      '- I must also attach the locally exported starsilk_character_dossier_copy.html from Archive Tools, or the original local image files named in the manifest. The exported HTML is evidence only, not canonical source.',
      '- The export contains locally attached images as data URIs. If the export/files are missing or a listed change cannot be recovered from them, stop and ask me for the missing evidence. Do not fabricate media or infer unseen edits.',
      '- If any manifest item has identity_status "missing" or no asset_key, do not implement that item. Stop and report the unresolved identity.',
      '- Treat only the manifest plus supplied local export/files as authorization for local Archive Tools changes. Preserve unrelated canon, prose, media, layout, behavior, and infrastructure.',
      '',
      'IMPLEMENTATION TASK',
      '1. Compare the supplied local export against the current generated site and identify only the manifest-listed Archive Tools changes.',
      '2. Resolve every change by its stable asset_key and title, then map it back to authoritative source files and the existing media/provenance pipeline. Do not target a slot only by ordinal DOM position.',
      '3. Do not commit data-URI images as the final media architecture. If canonical original media changes, preserve the external media/source recovery model and do not claim durable recovery is complete unless that obligation is actually satisfied.',
      '4. Rebuild generated output from authoritative sources and run the canon/build validators plus relevant browser regression tests.',
      '5. Inspect the final diff and verify that only authorized changes and required generated/provenance outputs changed.',
      '6. Stage only the intended files, commit with a descriptive message, and push. If a branch/PR is required, complete that path so the verified result lands on main.',
      '7. Report the final commit SHA, files changed, validation results, and any evidence or backup obligation that remains unverified.',
      '',
      unresolved.length ? 'BLOCKED: ' + unresolved.length + ' changed slot(s) lack stable asset identity. Do not implement them.' : ('Detected browser-local Archive Tools changes: ' + changes.length + '.')
    ].join('\n');
  }

  function fallbackCopyText(text){
    return new Promise(function(resolve, reject){
      var field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      var copied = false;
      try { copied = document.execCommand('copy'); } catch(e){}
      field.remove();
      if(copied) resolve();
      else reject(new Error('Clipboard copy was not permitted by this browser.'));
    });
  }

  function copyPlainText(text){
    if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
      return navigator.clipboard.writeText(text).catch(function(){ return fallbackCopyText(text); });
    }
    return fallbackCopyText(text);
  }

  if(copyPromptBtn){
    copyPromptBtn.addEventListener('click', function(){
      var changes = collectLocalArchiveChanges();
      var prompt = buildImplementationPrompt(changes);
      copyPlainText(prompt).then(function(){
        if(copyPromptStatus) copyPromptStatus.textContent = 'Implementation prompt copied. ' + changes.length + ' local change' + (changes.length === 1 ? '' : 's') + ' detected.';
        copyPromptBtn.textContent = 'Prompt copied';
        setTimeout(function(){ copyPromptBtn.textContent = 'Copy implementation prompt'; }, 1800);
      }).catch(function(){
        if(copyPromptStatus) copyPromptStatus.textContent = 'Could not copy the implementation prompt. Check clipboard permission and try again.';
      });
    });
  }

  window.addEventListener('beforeunload', function(e){
    if(attachedCount() > 0){ e.preventDefault(); e.returnValue = ''; }
  });

  // Export HTML copy: truthfully labeled -- this downloads the current DOM
  // (including any locally-attached reference images, embedded as data
  // URIs) but canon media stays referenced via relative assets/media/
  // paths, so the download only renders correctly next to a copy of that
  // directory. tools/package_release.py builds a genuinely self-contained
  // portable archive when that's what's actually needed.
  var exportBtn = document.getElementById('exportEmbedded');
  if(exportBtn){
    exportBtn.addEventListener('click', function(){
      var clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('.asset-file, .attachment-error, #clearImages, #exportEmbedded, #copyImplementationPrompt, #copyPromptStatus').forEach(function(n){ n.remove(); });
      var tb = clone.querySelector('.asset-toolbar');
      if(tb) tb.remove();
      clone.querySelectorAll('.attachment-stage').forEach(function(s){
        s.removeAttribute('tabindex');
        s.removeAttribute('role');
      });
      clone.querySelectorAll('.image-empty').forEach(function(n){ if(n.hidden) n.remove(); });
      var blob = new Blob(['<!doctype html>', String.fromCharCode(10), clone.outerHTML], {type: 'text/html;charset=utf-8'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'starsilk_character_dossier_copy.html';
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    });
  }

  refreshStatus();

  // ---------------------------------------------------------------------
  // Sparse canon intrusion: the archive briefly yields to the universe.
  // This is intentionally one substitution, not a repeated strobe. Under
  // reduced motion the same interruption is held steady instead of flashed.
  // ---------------------------------------------------------------------
  (function(){
    var title = document.getElementById('coverTitle');
    if(!title) return;
    var defaultTitle = title.getAttribute('data-default-title') || title.textContent;
    var quotes = [
      'YOUR SKY IS BUILT FROM YOUR DEAD.',
      "STARS DON'T BURN. THEY SURRENDER.",
      'SOLIDARITY, NOT SUPPLICATION.'
    ];
    var lastIndex = -1;
    var count = 0;
    var timer = null;
    var restoreTimer = null;
    // Tests may provide a pre-script timing object. Production never sets it.
    // This keeps the real scheduling path under browser test without fake clocks.
    var timingOverride = window.__STARSILK_CANON_INTRUSION_TIMING__ || null;
    function timingNumber(key, fallback){
      var value = timingOverride && timingOverride[key];
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    }
    var FIRST_MIN = timingNumber('firstMin', 35000);
    var FIRST_SPAN = timingNumber('firstSpan', 10000);
    var NEXT_MIN = timingNumber('nextMin', 38000);
    var NEXT_SPAN = timingNumber('nextSpan', 17000);
    var HOLD_MS = timingNumber('holdMs', reduceMotion ? 1200 : 90);

    function pickIndex(){
      if(count === 0) return 0;
      if(quotes.length < 2) return 0;
      var idx = Math.floor(Math.random() * quotes.length);
      if(idx === lastIndex) idx = (idx + 1) % quotes.length;
      return idx;
    }
    function restore(){
      title.textContent = defaultTitle;
      title.classList.remove('is-canon-intrusion');
    }
    function schedule(first){
      clearTimeout(timer);
      var base = first ? FIRST_MIN : NEXT_MIN;
      var span = first ? FIRST_SPAN : NEXT_SPAN;
      timer = setTimeout(showIntrusion, base + Math.floor(Math.random() * span));
    }
    function showIntrusion(){
      if(document.hidden){
        schedule(false);
        return;
      }
      var idx = pickIndex();
      lastIndex = idx;
      count += 1;
      title.textContent = quotes[idx];
      title.classList.add('is-canon-intrusion');
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(function(){
        restore();
        schedule(false);
      }, HOLD_MS);
    }
    document.addEventListener('visibilitychange', function(){
      if(document.hidden){
        clearTimeout(timer);
        clearTimeout(restoreTimer);
        restore();
      } else {
        schedule(false);
      }
    });
    schedule(true);
  })();

  // ---------------------------------------------------------------------
  // Hero video: autoplay, then loop just the tail
  // ---------------------------------------------------------------------
  (function(){
    var heroVideo = document.querySelector('.hero-video');
    if(!heroVideo) return;
    heroVideo.playbackRate = 0.25;
    var TAIL_SECONDS = 2.5;
    var loopToTail = function(){
      if(!heroVideo.duration || !isFinite(heroVideo.duration)) return;
      try { heroVideo.currentTime = Math.max(0, heroVideo.duration - TAIL_SECONDS); } catch(e){}
      var p = heroVideo.play();
      if(p && p.catch) p.catch(function(){});
    };
    heroVideo.addEventListener('ended', loopToTail);
    heroVideo.addEventListener('timeupdate', function(){
      if(heroVideo.duration && heroVideo.currentTime >= heroVideo.duration - 0.1) loopToTail();
    });
    if(reduceMotion || saveData){
      heroVideo.pause();
      heroVideo.removeAttribute('autoplay');
    }
  })();

  // ---------------------------------------------------------------------
  // Decorative watermark: rotates through brand-kit clips, pauses while
  // hidden (tab) OR while the cover's own hero video is the dominant
  // visual (no point decoding two ambient video layers at once), skips
  // entirely under prefers-reduced-motion or reduced-data.
  // ---------------------------------------------------------------------
  (function(){
    var v = document.getElementById('brandkit-watermark');
    if(!v) return;
    if(reduceMotion || saveData) return;
    var clips = [
      'assets/media/bd9b6b141f0f2d11fadea67a.mp4',
      'assets/media/c629ce1b298593185fb64c6d.mp4',
      'assets/media/2867ab757325a18d4e86e47d.mp4',
      'assets/media/3e601797a3fa7815a7f18566.mp4',
      'assets/media/299d5b833f56bb9fe42f0eb2.mp4',
      'assets/media/8fc2775c8783e4c873a72558.mp4'
    ];
    var i = 0;
    var heroBanner = document.querySelector('.hero-video-wrap');
    var coverDominant = !!heroBanner && 'IntersectionObserver' in window;
    var tabHidden = document.hidden;
    function sync(){
      if(tabHidden || coverDominant){ v.pause(); }
      else { v.play().catch(function(){}); }
    }
    v.src = clips[0];
    sync();
    v.addEventListener('ended', function(){
      i = (i + 1) % clips.length;
      v.src = clips[i];
      sync();
    });
    document.addEventListener('visibilitychange', function(){
      tabHidden = document.hidden;
      sync();
    });
    if(heroBanner && 'IntersectionObserver' in window){
      var coverObserver = new IntersectionObserver(function(entries){
        var entry = entries[0];
        coverDominant = entry.isIntersecting && entry.intersectionRatio > 0.25;
        sync();
      }, {threshold: [0, 0.25, 1.0]});
      coverObserver.observe(heroBanner);
    }
  })();
})();
