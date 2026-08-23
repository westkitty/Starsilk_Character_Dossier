(function(){
  'use strict';
  var form = document.getElementById('discoveryFilters');
  var query = document.getElementById('discoveryQuery');
  var classFacet = document.getElementById('classFacet');
  var groupFacet = document.getElementById('groupFacet');
  var mediaFacet = document.getElementById('mediaFacet');
  var archetypeFacet = document.getElementById('archetypeFacet');
  var reset = document.getElementById('resetFilters');
  var status = document.getElementById('discoveryStatus');
  var empty = document.getElementById('emptyState');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.discovery-result'));
  if(!form || !query || !cards.length) return;
  var active = -1;
  function lower(value){ return (value || '').toLocaleLowerCase(); }
  function state(){ return { q: query.value.trim(), resultClass: classFacet ? classFacet.value : '', group: groupFacet ? groupFacet.value : '', media: mediaFacet ? mediaFacet.value : '', archetype: archetypeFacet ? archetypeFacet.value : '' }; }
  function restoreFromUrl(){ var params = new URLSearchParams(window.location.search); query.value = params.get('q') || ''; if(classFacet) classFacet.value = params.get('class') || ''; if(groupFacet) groupFacet.value = params.get('group') || ''; if(mediaFacet) mediaFacet.value = params.get('media') || ''; if(archetypeFacet) archetypeFacet.value = params.get('archetype') || ''; }
  function updateUrl(){ var current = state(); var params = new URLSearchParams(); if(current.q) params.set('q', current.q); if(current.resultClass) params.set('class', current.resultClass); if(current.group) params.set('group', current.group); if(current.media) params.set('media', current.media); if(current.archetype) params.set('archetype', current.archetype); var next = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash; window.history.replaceState(null, '', next); }
  function isVisible(card, current){ if(current.q && lower(card.getAttribute('data-search')).indexOf(lower(current.q)) === -1) return false; if(current.resultClass && card.getAttribute('data-result-class') !== current.resultClass) return false; if(current.group && card.getAttribute('data-navigation-group') !== current.group) return false; if(current.media && card.getAttribute('data-media') !== current.media) return false; if(current.archetype && card.getAttribute('data-archetype') !== current.archetype) return false; return true; }
  function visibleCards(){ return cards.filter(function(card){ return !card.hidden; }); }
  function clearActive(){ cards.forEach(function(card){ card.removeAttribute('data-active'); }); active = -1; }
  function applyFilters(options){ var current = state(); var count = 0; cards.forEach(function(card){ var match = isVisible(card, current); card.hidden = !match; card.setAttribute('aria-hidden', match ? 'false' : 'true'); if(match) count += 1; }); clearActive(); if(status) status.textContent = count + ' of ' + cards.length + ' records'; if(empty) empty.hidden = count !== 0; if(!options || options.updateUrl !== false) updateUrl(); }
  function moveActive(direction){ var visible = visibleCards(); if(!visible.length) return; var currentCard = cards.find(function(card){ return card.getAttribute('data-active') === 'true'; }); var currentIndex = currentCard ? visible.indexOf(currentCard) : -1; var nextIndex = currentIndex === -1 ? (direction > 0 ? 0 : visible.length - 1) : (currentIndex + direction + visible.length) % visible.length; cards.forEach(function(card){ card.removeAttribute('data-active'); }); var card = visible[nextIndex]; card.setAttribute('data-active', 'true'); active = cards.indexOf(card); var link = card.querySelector('.result-link'); if(link){ link.focus({preventScroll: true}); card.scrollIntoView({block: 'nearest', behavior: 'auto'}); } }
  function openActive(){ var card = active >= 0 ? cards[active] : null; if(!card || card.hidden) card = visibleCards()[0] || null; var link = card && card.querySelector('.result-link'); if(link) window.location.href = link.href; }
  form.addEventListener('input', function(){ applyFilters(); }); form.addEventListener('change', function(){ applyFilters(); });
  if(reset){ reset.addEventListener('click', function(){ form.reset(); window.history.replaceState(null, '', window.location.pathname); applyFilters({updateUrl: false}); query.focus(); }); }
  document.addEventListener('keydown', function(event){ var tag = event.target && event.target.tagName; var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'; if(event.key === '/' && !typing){ event.preventDefault(); query.focus(); return; } if(event.key === 'Escape' && query.value){ event.preventDefault(); query.value = ''; applyFilters(); query.focus(); return; } if(event.key === 'ArrowDown' && (event.target === query || (event.target && event.target.classList.contains('result-link')))){ event.preventDefault(); moveActive(1); return; } if(event.key === 'ArrowUp' && (event.target === query || (event.target && event.target.classList.contains('result-link')))){ event.preventDefault(); moveActive(-1); return; } if(event.key === 'Enter' && event.target === query){ event.preventDefault(); openActive(); } });
  cards.forEach(function(card){ var link = card.querySelector('.result-link'); if(!link) return; link.addEventListener('focus', function(){ cards.forEach(function(item){ item.removeAttribute('data-active'); }); card.setAttribute('data-active', 'true'); active = cards.indexOf(card); }); });
  restoreFromUrl(); applyFilters({updateUrl: false});
  if(window.location.hash && window.location.hash.indexOf('#result-') === 0){ var target = document.getElementById(window.location.hash.slice(1)); if(target && !target.hidden){ target.setAttribute('data-active', 'true'); active = cards.indexOf(target); requestAnimationFrame(function(){ target.scrollIntoView({block: 'center', behavior: 'auto'}); }); } }
})();
