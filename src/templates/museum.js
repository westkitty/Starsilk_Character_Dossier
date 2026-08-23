(function(){
  'use strict';

  var list = document.getElementById('objectList');
  var search = document.getElementById('objectSearch');
  var status = document.getElementById('collectionStatus');
  var errorBox = document.getElementById('collectionError');
  var viewer = document.getElementById('objectViewer');
  if(!list || !search || !status || !errorBox || !viewer) return;

  var viewerId = document.getElementById('viewerId');
  var viewerTitle = document.getElementById('viewerTitle');
  var viewerMedia = document.getElementById('viewerMedia');
  var viewerMediaNote = document.getElementById('viewerMediaNote');
  var viewerFacts = document.getElementById('viewerFacts');
  var viewerContexts = document.getElementById('viewerContexts');
  var viewerUnknowns = document.getElementById('viewerUnknowns');
  var openMedia = document.getElementById('openMedia');
  var previousBtn = document.getElementById('previousObject');
  var nextBtn = document.getElementById('nextObject');
  var fullscreenBtn = document.getElementById('fullscreenObject');
  var closeBtn = document.getElementById('closeViewer');

  var records = [];
  var byId = new Map();
  var visibleIds = [];
  var currentId = null;
  var lastTrigger = null;
  var loaded = false;

  function text(value, fallback){
    if(value === null || value === undefined || value === '') return fallback || '';
    return String(value);
  }

  function humanBytes(value){
    if(typeof value !== 'number' || !isFinite(value)) return 'Unknown';
    var units = ['B','KiB','MiB','GiB'];
    var size = value;
    var unit = 0;
    while(size >= 1024 && unit < units.length - 1){ size /= 1024; unit++; }
    return (unit === 0 ? Math.round(size) : size.toFixed(size >= 10 ? 1 : 2)) + ' ' + units[unit];
  }

  function firstAuthoredAlt(record){
    for(var i = 0; i < record.contexts.length; i++){
      if(record.contexts[i].alt) return record.contexts[i].alt;
    }
    return null;
  }

  function labelFor(record){
    return record.logical_identity || firstAuthoredAlt(record) || record.filename;
  }

  function provenanceCategory(record){
    return record.provenance && record.provenance.source_category ? record.provenance.source_category : 'unclassified';
  }

  function localMediaUrl(record){
    return '../assets/media/' + encodeURIComponent(record.filename);
  }

  function localEntityUrl(sectionId){
    return '../entities/' + encodeURIComponent(sectionId) + '/';
  }

  function clearChildren(node){
    while(node.firstChild) node.removeChild(node.firstChild);
  }

  function appendFact(term, value, useCode){
    var wrap = document.createElement('div');
    var dt = document.createElement('dt');
    var dd = document.createElement('dd');
    dt.textContent = term;
    if(useCode){
      var code = document.createElement('code');
      code.textContent = value;
      dd.appendChild(code);
    }else{
      dd.textContent = value;
    }
    wrap.appendChild(dt);
    wrap.appendChild(dd);
    viewerFacts.appendChild(wrap);
  }

  function renderList(){
    clearChildren(list);
    var fragment = document.createDocumentFragment();
    records.forEach(function(record){
      var li = document.createElement('li');
      li.dataset.objectId = record.object_id;
      li.dataset.search = [
        record.object_id,
        record.filename,
        record.mime_type,
        record.logical_identity || '',
        record.match_status || '',
        provenanceCategory(record),
        record.provenance && record.provenance.source_basename ? record.provenance.source_basename : '',
        record.contexts.map(function(context){ return context.section_id + ' ' + (context.alt || ''); }).join(' ')
      ].join(' ').toLowerCase();

      var link = document.createElement('a');
      link.className = 'museum-object-link';
      link.href = '#' + encodeURIComponent(record.object_id);
      link.dataset.objectLink = record.object_id;
      link.setAttribute('aria-label', 'Open museum object ' + labelFor(record));
      link.addEventListener('click', function(){ lastTrigger = link; });

      var top = document.createElement('span');
      top.className = 'museum-object-top';
      var kind = document.createElement('span');
      kind.className = 'museum-object-kind';
      kind.textContent = record.media_kind;
      var mime = document.createElement('span');
      mime.textContent = record.mime_type;
      top.appendChild(kind);
      top.appendChild(mime);

      var label = document.createElement('span');
      label.className = 'museum-object-label';
      label.textContent = labelFor(record);

      var meta = document.createElement('span');
      meta.className = 'museum-object-meta';
      var id = document.createElement('code');
      id.textContent = record.object_id;
      var category = document.createElement('span');
      category.textContent = provenanceCategory(record);
      meta.appendChild(id);
      meta.appendChild(category);

      link.appendChild(top);
      link.appendChild(label);
      link.appendChild(meta);
      li.appendChild(link);
      fragment.appendChild(li);
    });
    list.appendChild(fragment);
    applyFilter();
  }

  function applyFilter(){
    var query = search.value.trim().toLowerCase();
    visibleIds = [];
    list.querySelectorAll('li[data-object-id]').forEach(function(li){
      var match = !query || li.dataset.search.indexOf(query) !== -1;
      li.hidden = !match;
      if(match) visibleIds.push(li.dataset.objectId);
    });
    status.textContent = visibleIds.length + ' of ' + records.length + ' museum objects';
    previousBtn.disabled = visibleIds.length < 2;
    nextBtn.disabled = visibleIds.length < 2;
  }

  function renderContexts(record){
    clearChildren(viewerContexts);
    if(!record.contexts.length){
      var empty = document.createElement('li');
      empty.textContent = 'No published section context is attached in the media manifest.';
      viewerContexts.appendChild(empty);
      return;
    }
    record.contexts.forEach(function(context){
      var li = document.createElement('li');
      var link = document.createElement('a');
      link.href = localEntityUrl(context.section_id);
      link.textContent = context.section_id;
      var alt = document.createElement('span');
      alt.className = 'viewer-context-alt';
      alt.textContent = context.alt || 'No authored alt text in this published context.';
      li.appendChild(link);
      li.appendChild(alt);
      viewerContexts.appendChild(li);
    });
  }

  function renderUnknowns(record){
    clearChildren(viewerUnknowns);
    if(!record.unknowns.length){
      var li = document.createElement('li');
      li.textContent = 'No additional descriptive gaps are declared for this object.';
      viewerUnknowns.appendChild(li);
      return;
    }
    record.unknowns.forEach(function(value){
      var li = document.createElement('li');
      li.textContent = value;
      viewerUnknowns.appendChild(li);
    });
  }

  function renderFacts(record){
    clearChildren(viewerFacts);
    appendFact('Museum object ID', record.object_id, true);
    appendFact('Published filename', record.filename, true);
    appendFact('Media type', record.mime_type, false);
    appendFact('Published size', humanBytes(record.bytes), false);
    appendFact('Published SHA-256', text(record.sha256, 'Unknown'), true);
    appendFact('Logical identity', text(record.logical_identity, 'Not authored in manifest'), false);
    appendFact('Match status', text(record.match_status, 'Not authored in manifest'), false);
    appendFact('Source filename', text(record.source && record.source.filename, 'Unknown'), true);
    appendFact('Source size', humanBytes(record.source && record.source.bytes), false);
    appendFact('Source SHA-256', text(record.source && record.source.sha256, 'Unknown'), true);
    if(record.provenance){
      Object.keys(record.provenance).sort().forEach(function(key){
        appendFact('Provenance · ' + key.replaceAll('_',' '), text(record.provenance[key], 'Unknown'), false);
      });
    }else{
      appendFact('Provenance detail', 'Not authored in manifest', false);
    }
  }

  function renderMedia(record){
    clearChildren(viewerMedia);
    var mediaPath = localMediaUrl(record);
    var authoredAlt = firstAuthoredAlt(record);
    viewerMediaNote.textContent = authoredAlt || (record.logical_identity
      ? 'No authored visual description is attached here; the manifest identifies this object as “' + record.logical_identity + '”.'
      : 'No authored visual description is attached to this media object in the published manifest.');

    if(record.media_kind === 'image'){
      var img = document.createElement('img');
      img.src = mediaPath;
      img.alt = authoredAlt || '';
      img.decoding = 'async';
      img.loading = 'eager';
      if(!authoredAlt) img.setAttribute('aria-describedby','viewerMediaNote');
      viewerMedia.appendChild(img);
      return;
    }
    if(record.media_kind === 'video'){
      var video = document.createElement('video');
      video.src = mediaPath;
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      video.setAttribute('aria-label', labelFor(record));
      viewerMedia.appendChild(video);
      return;
    }

    var fallback = document.createElement('div');
    fallback.className = 'viewer-media-fallback';
    var message = document.createElement('p');
    message.textContent = 'This published media type is not embedded by the museum viewer.';
    var link = document.createElement('a');
    link.href = mediaPath;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open published media file';
    fallback.appendChild(message);
    fallback.appendChild(link);
    viewerMedia.appendChild(fallback);
  }

  function updateNavigation(){
    var sequence = visibleIds.indexOf(currentId) !== -1 ? visibleIds : records.map(function(record){ return record.object_id; });
    var index = sequence.indexOf(currentId);
    var disabled = sequence.length < 2 || index === -1;
    previousBtn.disabled = disabled;
    nextBtn.disabled = disabled;
    if(!disabled){
      previousBtn.setAttribute('aria-label','Previous museum object: ' + labelFor(byId.get(sequence[(index - 1 + sequence.length) % sequence.length])));
      nextBtn.setAttribute('aria-label','Next museum object: ' + labelFor(byId.get(sequence[(index + 1) % sequence.length])));
    }
  }

  function openRecord(record){
    currentId = record.object_id;
    viewerId.textContent = record.object_id;
    viewerTitle.textContent = labelFor(record);
    renderMedia(record);
    renderFacts(record);
    renderContexts(record);
    renderUnknowns(record);
    openMedia.href = localMediaUrl(record);
    updateNavigation();
    document.body.classList.add('viewer-open');
    if(!viewer.open) viewer.showModal();
    closeBtn.focus({preventScroll:true});
  }

  function clearViewerMedia(){
    viewerMedia.querySelectorAll('video').forEach(function(video){
      try { video.pause(); } catch(e){}
      video.removeAttribute('src');
      try { video.load(); } catch(e){}
    });
    clearChildren(viewerMedia);
  }

  function clearHash(){
    if(!location.hash) return;
    history.replaceState(null, '', location.pathname + location.search);
  }

  function closeRecord(options){
    options = options || {};
    currentId = null;
    clearViewerMedia();
    document.body.classList.remove('viewer-open');
    if(viewer.open) viewer.close();
    if(options.clearHash) clearHash();
    if(lastTrigger && lastTrigger.isConnected){
      lastTrigger.focus({preventScroll:true});
    }else{
      search.focus({preventScroll:true});
    }
  }

  function currentSequence(){
    return visibleIds.indexOf(currentId) !== -1 ? visibleIds : records.map(function(record){ return record.object_id; });
  }

  function stepObject(delta){
    if(!currentId) return;
    var sequence = currentSequence();
    if(sequence.length < 2) return;
    var index = sequence.indexOf(currentId);
    if(index === -1) return;
    var next = sequence[(index + delta + sequence.length) % sequence.length];
    location.hash = encodeURIComponent(next);
  }

  function syncHash(){
    if(!loaded) return;
    var raw = location.hash ? location.hash.slice(1) : '';
    if(!raw){
      if(viewer.open) closeRecord({clearHash:false});
      return;
    }
    var id;
    try { id = decodeURIComponent(raw); } catch(e) { id = raw; }
    var record = byId.get(id);
    if(!record){
      if(viewer.open) closeRecord({clearHash:false});
      errorBox.hidden = false;
      errorBox.textContent = 'No museum object exists for the requested ID: ' + id;
      return;
    }
    errorBox.hidden = true;
    openRecord(record);
  }

  search.addEventListener('input', applyFilter);
  previousBtn.addEventListener('click', function(){ stepObject(-1); });
  nextBtn.addEventListener('click', function(){ stepObject(1); });
  closeBtn.addEventListener('click', function(){ closeRecord({clearHash:true}); });
  viewer.addEventListener('cancel', function(event){
    event.preventDefault();
    closeRecord({clearHash:true});
  });
  window.addEventListener('hashchange', syncHash);

  viewer.addEventListener('keydown', function(event){
    if(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if(event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if(event.key === 'ArrowLeft'){
      event.preventDefault();
      stepObject(-1);
    }else if(event.key === 'ArrowRight'){
      event.preventDefault();
      stepObject(1);
    }
  });

  function updateFullscreenButton(){
    if(!document.fullscreenEnabled || !viewer.requestFullscreen){
      fullscreenBtn.hidden = true;
      return;
    }
    fullscreenBtn.hidden = false;
    fullscreenBtn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  }

  fullscreenBtn.addEventListener('click', function(){
    if(!document.fullscreenEnabled) return;
    if(document.fullscreenElement){
      document.exitFullscreen().catch(function(){});
    }else{
      viewer.requestFullscreen().catch(function(){});
    }
  });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  updateFullscreenButton();

  fetch('objects.json', {credentials:'same-origin'})
    .then(function(response){
      if(!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function(payload){
      if(!payload || !Array.isArray(payload.records)) throw new Error('Object index is malformed');
      records = payload.records;
      records.forEach(function(record){
        if(!record.object_id || byId.has(record.object_id)) throw new Error('Duplicate or missing museum object ID');
        byId.set(record.object_id, record);
      });
      if(payload.record_count !== records.length) throw new Error('Object index count does not match records');
      loaded = true;
      renderList();
      syncHash();
    })
    .catch(function(error){
      loaded = false;
      status.textContent = 'Museum collection unavailable';
      errorBox.hidden = false;
      errorBox.textContent = 'The museum object register could not be loaded. ' + error.message;
    });
})();
