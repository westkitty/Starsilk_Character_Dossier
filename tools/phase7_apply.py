#!/usr/bin/env python3
"""One-shot Phase 7 source patcher. Temporary; removed before merge."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def write(rel: str, content: str) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"wrote {rel}")

def replace_once(rel: str, old: str, new: str) -> None:
    path = ROOT / rel
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Phase 7 patch anchor not found in {rel}: {old[:100]!r}")
    if text.count(old) != 1:
        raise RuntimeError(f"Phase 7 patch anchor not unique in {rel}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched {rel}")

NEW_FILES = {
    'src/templates/discovery.html.j2': '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Discovery · {{ project_name }}</title>
<meta name="description" content="Faceted, source-backed discovery across stable Starsilk Compendium records, with deterministic AI context packets.">
<link rel="canonical" href="{{ canonical_url }}">
<link rel="alternate" type="application/json" href="discovery.json">
<link rel="alternate" type="text/markdown" href="discovery.md">
<link rel="stylesheet" href="discovery.css">
<script src="discovery.js" defer></script>
</head>
<body>
<a class="skip-link" href="#results">Skip to results</a>
<header class="topbar">
  <a class="brand" href="../">{{ project_name }}</a>
  <nav aria-label="Discovery publication">
    <a href="../entities/">Entity index</a>
    <a href="../relationships/">Relationships</a>
    <a href="../canon/">Canon Inspector</a>
    <a href="discovery.json">JSON</a>
    <a href="context-packets.json">Context packets</a>
  </nav>
</header>

<main id="main">
  <header class="hero">
    <div class="eyebrow">Phase 7 · source-backed discovery</div>
    <h1>Faceted discovery</h1>
    <p class="lede">Search and filter the {{ results|length }} stable top-level Compendium records without replacing the complete Compendium search. Result classes are structural publication metadata; excerpts are mechanical projections of authored source text.</p>
    <p class="authority-note"><strong>Authority boundary:</strong> search matches, facets, excerpts, and AI context packets are generated discovery aids. They do not create canon facts, change canon status, or promote observed mentions into semantic relationships.</p>
  </header>

  <section class="filter-panel" aria-labelledby="filter-heading">
    <div class="filter-heading-row">
      <div>
        <div class="eyebrow">Discovery controls</div>
        <h2 id="filter-heading">Filter stable records</h2>
      </div>
      <button id="resetFilters" type="button">Reset</button>
    </div>
    <form id="discoveryFilters" autocomplete="off">
      <label class="search-field">Search label, ID, or excerpt
        <input id="discoveryQuery" name="q" type="search" inputmode="search" placeholder="Codec, Blood Rings, titan…" aria-describedby="keyboardHelp">
      </label>
      <label>Result class
        <select id="classFacet" name="class">
          <option value="">All classes</option>
          {% for facet in facets.result_class %}<option value="{{ facet.value }}">{{ facet.value }} ({{ facet.count }})</option>{% endfor %}
        </select>
      </label>
      <label>Navigation group
        <select id="groupFacet" name="group">
          <option value="">All groups</option>
          {% for facet in facets.navigation_group %}<option value="{{ facet.value }}">{{ facet.label if facet.label is defined else facet.value }} ({{ facet.count }})</option>{% endfor %}
        </select>
      </label>
      <label>Published media
        <select id="mediaFacet" name="media">
          <option value="">Any</option>
          {% for facet in facets.media %}<option value="{{ facet.value }}">{{ "Has media" if facet.value == "with-media" else "No media" }} ({{ facet.count }})</option>{% endfor %}
        </select>
      </label>
      {% if facets.archetype %}
      <label>Authored archetype
        <select id="archetypeFacet" name="archetype">
          <option value="">All archetypes</option>
          {% for facet in facets.archetype %}<option value="{{ facet.value }}">{{ facet.value }} ({{ facet.count }})</option>{% endfor %}
        </select>
      </label>
      {% endif %}
    </form>
    <div class="filter-footer">
      <p id="discoveryStatus" role="status" aria-live="polite">{{ results|length }} of {{ results|length }} records</p>
      <p id="keyboardHelp">Keyboard: <kbd>/</kbd> focuses search; <kbd>↑</kbd>/<kbd>↓</kbd> move through visible results; <kbd>Enter</kbd> opens the active record; <kbd>Esc</kbd> clears the query.</p>
    </div>
  </section>

  <section id="results" class="results-wrap" aria-labelledby="results-heading">
    <div class="results-heading-row">
      <div>
        <div class="eyebrow">Stable records</div>
        <h2 id="results-heading">Results</h2>
      </div>
      <a href="AUTHORITY.md">Read discovery authority rules</a>
    </div>
    <ol id="discoveryResults" class="result-grid">
      {% for item in results %}
      <li id="result-{{ item.stable_id }}" class="discovery-result result-class--{{ item.result_class }}" data-stable-id="{{ item.stable_id }}" data-result-class="{{ item.result_class }}" data-navigation-group="{{ item.navigation_group if item.navigation_group else unlisted_group_value }}" data-media="{{ 'with-media' if item.has_media else 'without-media' }}" data-archetype="{{ item.archetype or '' }}" data-search="{{ (item.display_label ~ ' ' ~ item.stable_id ~ ' ' ~ item.excerpt ~ ' ' ~ (item.navigation_group or '') ~ ' ' ~ (item.archetype or ''))|lower }}">
        <article class="discovery-result-card" data-stable-id="{{ item.stable_id }}">
          <header>
            <div class="result-meta">
              <span class="result-class">{{ item.result_class }}</span>
              {% if item.navigation_group %}<span>{{ item.navigation_group }}</span>{% else %}<span>Not in authored navigation</span>{% endif %}
              {% if item.archetype %}<span>archetype: {{ item.archetype }}</span>{% endif %}
            </div>
            <div class="result-title-row">
              <h3><a class="result-link" href="../entities/{{ item.stable_id }}/">{{ item.display_label }}</a></h3>
              <a class="result-anchor" href="#result-{{ item.stable_id }}" aria-label="Deep link to {{ item.display_label }} result">#</a>
            </div>
            <code>{{ item.stable_id }}</code>
          </header>
          <p class="excerpt">{{ item.excerpt if item.excerpt else "No authored text excerpt is available for this record." }}</p>
          <footer>
            <span>{{ item.media_count }} published media item{{ '' if item.media_count == 1 else 's' }}</span>
            <a href="packets/{{ item.stable_id }}.json">AI context packet</a>
            <a href="{{ item.legacy_url }}">Complete Compendium</a>
          </footer>
        </article>
      </li>
      {% endfor %}
    </ol>
    <p id="emptyState" class="empty-state" hidden>No records match these discovery controls. That is a filter result, not a canon claim.</p>
  </section>
</main>

<footer class="site-footer">
  <p>Generated from established Starsilk Compendium authority. <a href="AUTHORITY.md">Interpretation rules</a> · <a href="schema.json">Discovery schema</a> · <a href="context-packet.schema.json">Context-packet schema</a></p>
</footer>
</body>
</html>
''',
    'src/templates/discovery.css': ''':root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #07090f; color: #edf4ff; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 50% -20%, #122339 0, #07090f 48%); }
a { color: #8fe8ff; }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid #8fe8ff; outline-offset: 3px; }
.skip-link { position: fixed; left: 1rem; top: -5rem; z-index: 20; padding: .7rem 1rem; background: #fff; color: #000; }
.skip-link:focus { top: 1rem; }
.topbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: .85rem clamp(1rem, 4vw, 3rem); background: rgba(7, 9, 15, .94); border-bottom: 1px solid #24384d; backdrop-filter: blur(14px); }
.brand { font-weight: 800; text-decoration: none; color: #fff; white-space: nowrap; }
.topbar nav { display: flex; flex-wrap: wrap; gap: .45rem 1rem; justify-content: flex-end; }
.topbar nav a { font-size: .9rem; }
main, .site-footer { width: min(1180px, calc(100% - 2rem)); margin-inline: auto; }
.hero { padding: clamp(3rem, 7vw, 6.5rem) 0 2rem; max-width: 900px; }
.eyebrow { text-transform: uppercase; letter-spacing: .16em; font-size: .72rem; font-weight: 800; color: #75dfff; }
h1 { margin: .5rem 0 1rem; font-size: clamp(2.5rem, 7vw, 5.6rem); line-height: .95; letter-spacing: -.045em; }
h2 { margin: .35rem 0 0; font-size: clamp(1.45rem, 3vw, 2rem); }
.lede { font-size: clamp(1.05rem, 2vw, 1.3rem); line-height: 1.65; color: #c6d5e7; }
.authority-note { margin-top: 1.25rem; padding: 1rem 1.1rem; border: 1px solid #31506d; background: #0b1520; line-height: 1.6; }
.filter-panel { margin: 1rem 0 2.5rem; padding: clamp(1rem, 3vw, 1.5rem); border: 1px solid #263d54; border-radius: 1rem; background: rgba(10, 17, 27, .9); }
.filter-heading-row, .results-heading-row, .result-title-row, .filter-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
#resetFilters { border: 1px solid #416481; border-radius: .7rem; background: #101d2a; color: #e9f5ff; padding: .65rem .85rem; cursor: pointer; }
#discoveryFilters { display: grid; grid-template-columns: minmax(240px, 2fr) repeat(4, minmax(145px, 1fr)); gap: .8rem; margin-top: 1.15rem; align-items: end; }
#discoveryFilters label { display: grid; gap: .4rem; font-size: .78rem; color: #b8c9da; font-weight: 700; }
#discoveryFilters input, #discoveryFilters select { width: 100%; min-height: 2.8rem; border: 1px solid #38536d; border-radius: .65rem; background: #07111b; color: #f3f8ff; padding: .55rem .7rem; font: inherit; }
.search-field { grid-column: span 1; }
.filter-footer { margin-top: 1rem; align-items: baseline; }
#discoveryStatus { font-weight: 800; margin: 0; }
#keyboardHelp { margin: 0; color: #93a8bc; font-size: .8rem; text-align: right; }
kbd { border: 1px solid #4b6177; border-bottom-width: 2px; border-radius: .3rem; padding: .05rem .3rem; background: #111d29; color: #fff; }
.results-wrap { padding-bottom: 3rem; }
.results-heading-row { margin-bottom: 1rem; }
.result-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.discovery-result { scroll-margin-top: 6rem; }
.discovery-result[hidden] { display: none !important; }
.discovery-result article { height: 100%; display: flex; flex-direction: column; gap: .9rem; border: 1px solid #263e55; border-radius: .9rem; background: linear-gradient(160deg, rgba(16, 29, 42, .95), rgba(7, 12, 20, .96)); padding: 1.1rem; }
.discovery-result[data-active="true"] article, .discovery-result:target article { border-color: #76e4ff; box-shadow: 0 0 0 2px rgba(118, 228, 255, .18); }
.result-meta { display: flex; flex-wrap: wrap; gap: .4rem; color: #91a8bd; font-size: .72rem; }
.result-meta span { border: 1px solid #304b62; border-radius: 999px; padding: .22rem .5rem; }
.result-class { color: #90e8ff; }
.result-title-row { align-items: start; }
h3 { margin: .35rem 0 .15rem; font-size: 1.35rem; }
h3 a { color: #fff; text-decoration-thickness: 1px; text-underline-offset: .18em; }
.result-anchor { text-decoration: none; color: #6f8da7; font-weight: 900; font-size: 1.2rem; }
.discovery-result code { color: #83a8c5; font-size: .78rem; }
.excerpt { flex: 1; color: #c4d1df; line-height: 1.58; margin: 0; }
.discovery-result footer { display: flex; flex-wrap: wrap; gap: .5rem .9rem; padding-top: .85rem; border-top: 1px solid #22384c; color: #8fa4b7; font-size: .8rem; }
.empty-state { padding: 2rem; text-align: center; border: 1px dashed #47627a; border-radius: .9rem; color: #b8c7d6; }
.site-footer { padding: 1.5rem 0 3rem; border-top: 1px solid #1e3245; color: #8195a8; font-size: .85rem; }
@media (max-width: 900px) { #discoveryFilters { grid-template-columns: repeat(2, minmax(0, 1fr)); } .search-field { grid-column: 1 / -1; } .result-grid { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .topbar { position: static; align-items: flex-start; flex-direction: column; } .topbar nav { justify-content: flex-start; } #discoveryFilters { grid-template-columns: 1fr; } .search-field { grid-column: auto; } .filter-heading-row, .results-heading-row, .filter-footer { align-items: flex-start; flex-direction: column; } #keyboardHelp { text-align: left; } main, .site-footer { width: min(100% - 1.25rem, 1180px); } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
''',
    'src/templates/discovery.js': '''(function(){
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
''',
    'src/discovery/AUTHORITY.md': '''# Starsilk faceted discovery and AI context packets — authority boundary

`docs/discover/` is generated Phase 7 publication. It is a discovery convenience layer, not canon/content authority, relationship authority, media-provenance authority, or a second editable lore database.

Authority remains upstream:

1. `src/content/sections/*.title.html`, `src/content/sections/*.body.html`, and `src/content/sections.json` own authored section identity and content.
2. `src/content/nav.json` owns authored navigation-group membership.
3. `docs/asset-manifest.json` owns published-media provenance and section-context evidence.
4. Existing rendered xrefs support only `mentions` / `observed-xref` relationship evidence.
5. Existing machine metadata preserves independent visibility, canon-status, spoiler, evidence, and unknown fields.

## Discovery semantics

- `stable_id` is the established top-level section identity. Display labels never replace it.
- `result_class` copies the existing structural `object_type` publication classification. It is not a claim about the fictional subject's ontology.
- `navigation_group` is copied only from `src/content/nav.json`. A null value means no authored navigation-group assignment was found; it does not imply isolation, non-membership, or non-canon status.
- `archetype` is copied only from an authored section `data-archetype` attribute. Missing values remain null.
- Media facets derive only from published manifest association counts. They do not imply story relationships.
- Excerpts are deterministic whitespace-normalized truncations of authored source text. They are not summaries, interpretations, new lore, or replacement source text.
- Search matches, facet inclusion, result ordering, and no-result states are retrieval behavior only. They do not create or negate canon facts.

## AI context-packet semantics

Each `docs/discover/packets/<stable-id>.json` file is a compact deterministic convenience bundle for an existing stable record. A packet may bring together source-backed identifiers, publication metadata, a mechanical excerpt, published-media IDs, and observed xref direction so an AI can orient itself without first fetching every project surface.

Packets never outrank their cited sources. They must preserve:

- `canon_status: unknown` where the current source model does not author a per-section canon status;
- the existing conservative spoiler publication value without treating it as a canon fact;
- observed relationships strictly as `kind=mentions` and `evidence_class=observed-xref`;
- explicit unknown state rather than invented chronology-event IDs, WorldsVault IDs, dates, coordinates, or semantic relations.

If a generated packet conflicts with its cited source authority, the generated packet is wrong and must be regenerated or repaired. Absence from discovery results or packets is never evidence that something is false or non-canon.
''',
    'src/schema/discovery-index.schema.json': '''{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://westkitty.github.io/Starsilk_Character_Dossier/machine/schema/v1/discovery-index.schema.json",
  "title": "Starsilk faceted discovery index v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema", "schema_url", "project_id", "canonical_url", "human_url", "record_count", "result_semantics", "facets", "records"],
  "properties": {
    "schema": {"const": "starsilk-discovery-index/1"},
    "schema_url": {"type": "string", "format": "uri"},
    "project_id": {"const": "starsilk-character-dossier"},
    "canonical_url": {"type": "string", "format": "uri"},
    "human_url": {"type": "string", "format": "uri"},
    "record_count": {"type": "integer", "minimum": 0},
    "result_semantics": {"type": "string", "minLength": 1},
    "facets": {"type": "object", "additionalProperties": false, "required": ["result_class", "navigation_group", "archetype", "media"], "properties": {"result_class": {"$ref": "#/$defs/facetList"}, "navigation_group": {"$ref": "#/$defs/facetList"}, "archetype": {"$ref": "#/$defs/facetList"}, "media": {"$ref": "#/$defs/facetList"}}},
    "records": {"type": "array", "items": {"$ref": "#/$defs/result"}}
  },
  "$defs": {
    "facetList": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["value", "count"], "properties": {"value": {"type": "string", "minLength": 1}, "label": {"type": "string", "minLength": 1}, "count": {"type": "integer", "minimum": 0}}}},
    "result": {"type": "object", "additionalProperties": false, "required": ["stable_id", "display_label", "canonical_url", "legacy_url", "result_class", "navigation_group", "archetype", "excerpt", "excerpt_source_ref", "has_media", "media_count", "context_packet_url"], "properties": {"stable_id": {"type": "string", "minLength": 1}, "display_label": {"type": "string", "minLength": 1}, "canonical_url": {"type": "string", "format": "uri"}, "legacy_url": {"type": "string", "format": "uri"}, "result_class": {"type": "string", "minLength": 1}, "navigation_group": {"type": ["string", "null"]}, "archetype": {"type": ["string", "null"]}, "excerpt": {"type": "string"}, "excerpt_source_ref": {"type": "string", "minLength": 1}, "has_media": {"type": "boolean"}, "media_count": {"type": "integer", "minimum": 0}, "context_packet_url": {"type": "string", "format": "uri"}}}
  }
}
''',
    'src/schema/context-packet.schema.json': '''{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://westkitty.github.io/Starsilk_Character_Dossier/machine/schema/v1/context-packet.schema.json",
  "title": "Starsilk AI context packet v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema", "schema_url", "project_id", "packet_kind", "packet_url", "stable_id", "display_label", "canonical_url", "legacy_url", "result_class", "navigation_group", "archetype", "excerpt", "excerpt_source_ref", "visibility", "canon_status", "spoiler_level", "related_media_ids", "observed_relationships", "source_refs", "unknowns", "authority_note"],
  "properties": {
    "schema": {"const": "starsilk-ai-context-packet/1"}, "schema_url": {"type": "string", "format": "uri"}, "project_id": {"const": "starsilk-character-dossier"}, "packet_kind": {"const": "entity-context"}, "packet_url": {"type": "string", "format": "uri"}, "stable_id": {"type": "string", "minLength": 1}, "display_label": {"type": "string", "minLength": 1}, "canonical_url": {"type": "string", "format": "uri"}, "legacy_url": {"type": "string", "format": "uri"}, "result_class": {"type": "string", "minLength": 1}, "navigation_group": {"type": ["string", "null"]}, "archetype": {"type": ["string", "null"]}, "excerpt": {"type": "string"}, "excerpt_source_ref": {"type": "string", "minLength": 1}, "visibility": {"enum": ["public", "private"]}, "canon_status": {"enum": ["canon", "development", "historical", "speculative", "unknown"]}, "spoiler_level": {"enum": ["none", "minor", "major"]}, "related_media_ids": {"type": "array", "uniqueItems": true, "items": {"type": "string", "minLength": 1}},
    "observed_relationships": {"type": "object", "additionalProperties": false, "required": ["kind", "evidence_class", "outgoing_stable_ids", "incoming_stable_ids"], "properties": {"kind": {"const": "mentions"}, "evidence_class": {"const": "observed-xref"}, "outgoing_stable_ids": {"type": "array", "uniqueItems": true, "items": {"type": "string", "minLength": 1}}, "incoming_stable_ids": {"type": "array", "uniqueItems": true, "items": {"type": "string", "minLength": 1}}}},
    "source_refs": {"type": "array", "minItems": 1, "items": {"type": "object", "additionalProperties": false, "required": ["path", "kind"], "properties": {"path": {"type": "string", "minLength": 1}, "kind": {"type": "string", "minLength": 1}, "anchor": {"type": "string", "minLength": 1}}}},
    "unknowns": {"type": "array", "uniqueItems": true, "items": {"type": "string", "minLength": 1}}, "authority_note": {"type": "string", "minLength": 1}
  }
}
''',
    'src/schema/context-packet-index.schema.json': '''{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://westkitty.github.io/Starsilk_Character_Dossier/machine/schema/v1/context-packet-index.schema.json",
  "title": "Starsilk AI context packet index v1",
  "type": "object", "additionalProperties": false,
  "required": ["schema", "schema_url", "project_id", "canonical_url", "packet_count", "packet_pattern", "packets", "authority_note"],
  "properties": {
    "schema": {"const": "starsilk-ai-context-packet-index/1"}, "schema_url": {"type": "string", "format": "uri"}, "project_id": {"const": "starsilk-character-dossier"}, "canonical_url": {"type": "string", "format": "uri"}, "packet_count": {"type": "integer", "minimum": 0}, "packet_pattern": {"type": "string", "minLength": 1},
    "packets": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["stable_id", "display_label", "packet_url", "canonical_url"], "properties": {"stable_id": {"type": "string", "minLength": 1}, "display_label": {"type": "string", "minLength": 1}, "packet_url": {"type": "string", "format": "uri"}, "canonical_url": {"type": "string", "format": "uri"}}}},
    "authority_note": {"type": "string", "minLength": 1}
  }
}
''',
    'tests/test_discovery.py': '''import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
DISCOVER = DOCS / "discover"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
BASE_FILES = {"index.html", "discovery.css", "discovery.js", "discovery.json", "discovery.md", "context-packets.json", "schema.json", "context-packet.schema.json", "context-packet-index.schema.json", "AUTHORITY.md"}

def read_json(path: Path): return json.loads(path.read_text(encoding="utf-8"))

def test_discovery_file_set_is_exact_build_owned_and_deterministic():
    entities = read_json(DOCS / "machine/entities.json")["records"]
    expected = BASE_FILES | {f"packets/{record['stable_id']}.json" for record in entities}
    actual = {path.relative_to(DISCOVER).as_posix() for path in DISCOVER.rglob("*") if path.is_file()}
    assert actual == expected
    assert len(actual) == 10 + len(entities) == 137
    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert "build/discovery_publication.py" in build and "docs/discover" in build
    proc = subprocess.run([sys.executable, "build/discovery_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "discovery outputs match generator output" in proc.stdout

def test_discovery_records_are_source_backed_and_preserve_existing_identity_and_status():
    discovery = read_json(DISCOVER / "discovery.json")
    machine_records = read_json(DOCS / "machine/entities.json")["records"]
    sections = read_json(ROOT / "src/content/sections.json")["sections"]
    nav = read_json(ROOT / "src/content/nav.json")
    by_id = {record["stable_id"]: record for record in machine_records}
    section_by_id = {record["id"]: record for record in sections}
    nav_by_id = {link["id"]: group["label"] for group in nav["groups"] for link in group["links"]}
    assert discovery["schema"] == "starsilk-discovery-index/1"
    assert discovery["record_count"] == len(machine_records) == 127
    assert [item["stable_id"] for item in discovery["records"]] == [item["stable_id"] for item in machine_records]
    for item in discovery["records"]:
        source = by_id[item["stable_id"]]; section = section_by_id[item["stable_id"]]
        assert item["display_label"] == source["display_label"] and item["canonical_url"] == source["canonical_url"]
        assert item["legacy_url"] == SITE_BASE + "#" + item["stable_id"] and item["result_class"] == source["object_type"]
        assert item["navigation_group"] == nav_by_id.get(item["stable_id"])
        assert item["archetype"] == section.get("attrs", {}).get("data-archetype")
        assert item["has_media"] == bool(source["related_media_ids"]) and item["media_count"] == len(source["related_media_ids"])
        assert item["excerpt_source_ref"] == f"src/content/sections/{item['stable_id']}.body.html" and len(item["excerpt"]) <= 321

def test_context_packets_are_compact_derivatives_not_new_authority():
    entities = read_json(DOCS / "machine/entities.json")["records"]
    relationships = read_json(DOCS / "machine/relationships.json"); outgoing = relationships.get("outgoing", {}); incoming = relationships.get("backlinks", {})
    for source in entities:
        stable_id = source["stable_id"]; packet = read_json(DISCOVER / "packets" / f"{stable_id}.json")
        assert packet["stable_id"] == stable_id and packet["canonical_url"] == source["canonical_url"]
        assert packet["visibility"] == source["visibility"] and packet["canon_status"] == source["canon_status"] and packet["spoiler_level"] == source["spoiler_level"]
        assert packet["related_media_ids"] == source["related_media_ids"] and packet["source_refs"] == source["source_refs"]
        assert packet["observed_relationships"] == {"kind": "mentions", "evidence_class": "observed-xref", "outgoing_stable_ids": outgoing.get(stable_id, []), "incoming_stable_ids": incoming.get(stable_id, [])}
        assert "convenience packet" in packet["authority_note"] and "not new canon prose" in packet["authority_note"]
    dao = read_json(DISCOVER / "packets/dao.json")
    assert dao["canon_status"] == "unknown" and dao["observed_relationships"]["kind"] == "mentions" and dao["observed_relationships"]["evidence_class"] == "observed-xref"

def test_discovery_human_machine_schema_and_public_boundary_surfaces():
    html = (DISCOVER / "index.html").read_text(encoding="utf-8"); soup = BeautifulSoup(html, "lxml")
    assert soup.find("main", id="main") is not None and soup.find("form", id="discoveryFilters") is not None
    assert len(soup.select("article.discovery-result-card[data-stable-id]")) == 127
    assert "without replacing the complete Compendium search" in html and "mechanical projections" in html
    authority = (DISCOVER / "AUTHORITY.md").read_text(encoding="utf-8")
    assert "discovery convenience layer" in authority and "Search matches, facet inclusion, result ordering, and no-result states are retrieval behavior only" in authority and "Packets never outrank their cited sources" in authority
    for name in ("discovery-index.schema.json", "context-packet.schema.json", "context-packet-index.schema.json"):
        source = read_json(ROOT / "src/schema" / name); assert read_json(DOCS / "machine/schema/v1" / name) == source
    index = read_json(DOCS / "machine/index.json")
    assert index["endpoints"]["discovery"] == SITE_BASE + "discover/" and index["endpoints"]["discovery_index"] == SITE_BASE + "discover/discovery.json" and index["endpoints"]["context_packet_index"] == SITE_BASE + "discover/context-packets.json"
    assert SITE_BASE + "discover/" in index["public_urls"] and SITE_BASE + "discover/packets/dao.json" in index["public_urls"]
    llms = (DOCS / "llms.txt").read_text(encoding="utf-8"); assert "Human faceted discovery:" in llms and "AI context packet pattern:" in llms
    entity_index = (DOCS / "entities/index.html").read_text(encoding="utf-8"); assert 'href="../discover/"' in entity_index
    proc = subprocess.run([sys.executable, "tools/check_public_boundary.py", "docs/discover"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr

def test_discovery_facets_deep_link_keyboard_and_mobile(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/discover/?class=character-section&q=Dao#result-dao")
    expect(page.locator("#result-dao")).to_be_visible(); expect(page.locator("#discoveryStatus")).to_contain_text("1 of 127 records")
    expect(page.locator("#discoveryQuery")).to_have_value("Dao"); expect(page.locator("#classFacet")).to_have_value("character-section")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#resetFilters").click(); expect(page.locator("#discoveryStatus")).to_contain_text("127 of 127 records"); expect(page.locator("#discoveryQuery")).to_be_focused()
    page.locator("#discoveryQuery").fill("Codec"); page.keyboard.press("ArrowDown"); expect(page.locator("#result-codec .result-link")).to_be_focused()
'''
}

for rel, content in NEW_FILES.items(): write(rel, content)

replace_once("build/machine_publication.py", '    "canon-lock-register.schema.json",\n)', '    "canon-lock-register.schema.json",\n    "discovery-index.schema.json",\n    "context-packet.schema.json",\n    "context-packet-index.schema.json",\n)')
replace_once("build/machine_publication.py", '        "canon/AUTHORITY.md",\n    ] + [f"machine/schema/v1/{name}" for name in SCHEMA_FILES]', '        "canon/AUTHORITY.md",\n        "discover/",\n        "discover/discovery.json",\n        "discover/discovery.md",\n        "discover/context-packets.json",\n        "discover/schema.json",\n        "discover/context-packet.schema.json",\n        "discover/context-packet-index.schema.json",\n        "discover/AUTHORITY.md",\n    ] + [f"machine/schema/v1/{name}" for name in SCHEMA_FILES]')
replace_once("build/machine_publication.py", '                entity_markdown_url(stable_id),\n            ]\n        )', '                entity_markdown_url(stable_id),\n                canonical(f"discover/packets/{stable_id}.json"),\n            ]\n        )')
replace_once("build/machine_publication.py", '            "canon_lock_register": canonical("canon/canon-locks.json"),\n            "jsonld": canonical("machine/project.jsonld"),', '            "canon_lock_register": canonical("canon/canon-locks.json"),\n            "discovery": canonical("discover/"),\n            "discovery_index": canonical("discover/discovery.json"),\n            "context_packet_index": canonical("discover/context-packets.json"),\n            "jsonld": canonical("machine/project.jsonld"),')
replace_once("build/machine_publication.py", "Canon lock register Markdown: {canonical('canon/canon-locks.md')}\\nJSON-LD: {e['jsonld']}", "Canon lock register Markdown: {canonical('canon/canon-locks.md')}\\nHuman faceted discovery: {e['discovery']}\\nDiscovery JSON index: {e['discovery_index']}\\nAI context packet register: {e['context_packet_index']}\\nAI context packet pattern: {canonical('discover/packets/<stable-id>.json')}\\nJSON-LD: {e['jsonld']}")
replace_once("build/machine_publication.py", "- The Canon Inspector exposes only a machine-enforced validation subset from `src/canon/invariants.json`; it is not complete canon, and absence from its register does not imply non-canon status.\\n- Missing event IDs, WorldsVault IDs, dates, coordinates, and semantic relations remain unknown until explicitly authored.", "- The Canon Inspector exposes only a machine-enforced validation subset from `src/canon/invariants.json`; it is not complete canon, and absence from its register does not imply non-canon status.\\n- Faceted discovery and AI context packets are generated convenience derivatives: result classes remain structural, excerpts are mechanical source projections, and packet fields never outrank cited source authority.\\n- Missing event IDs, WorldsVault IDs, dates, coordinates, and semantic relations remain unknown until explicitly authored.")

schema_path = ROOT / "src/schema/machine-publication-index.schema.json"
schema = json.loads(schema_path.read_text(encoding="utf-8")); endpoints = schema["properties"]["endpoints"]
for name in ("canon_inspector", "canon_lock_register", "discovery", "discovery_index", "context_packet_index"):
    if name not in endpoints["required"]: endpoints["required"].append(name)
    endpoints["properties"][name] = {"type": "string", "format": "uri"}
schema_path.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

replace_once("tools/build.sh", "#     -> build/canon_publication.py     (machine-enforced canon lock inspector)\n#     -> build/entity_publication.py", "#     -> build/canon_publication.py     (machine-enforced canon lock inspector)\n#     -> build/discovery_publication.py (faceted discovery + AI context packets)\n#     -> build/entity_publication.py")
replace_once("tools/build.sh", "docs/index.html, docs/machine/, docs/relationships/, docs/canon/, docs/entities/, and docs/objects/ are", "docs/index.html, docs/machine/, docs/relationships/, docs/canon/, docs/discover/, docs/entities/, and docs/objects/ are")
replace_once("tools/build.sh", '    echo "-> Generating (in-memory) and checking Canon Inspector..."\n    "$PY" build/canon_publication.py --check\n    echo "-> Generating (in-memory) and checking stable entity permalinks..."', '    echo "-> Generating (in-memory) and checking Canon Inspector..."\n    "$PY" build/canon_publication.py --check\n    echo "-> Generating (in-memory) and checking faceted discovery + AI context packets..."\n    "$PY" build/discovery_publication.py --check\n    echo "-> Generating (in-memory) and checking stable entity permalinks..."')
replace_once("tools/build.sh", '    echo "-> Generating Canon Inspector from machine validation authority..."\n    "$PY" build/canon_publication.py\n    echo "-> Generating stable entity permalinks from declared authority..."', '    echo "-> Generating Canon Inspector from machine validation authority..."\n    "$PY" build/canon_publication.py\n    echo "-> Generating faceted discovery + AI context packets from established authority..."\n    "$PY" build/discovery_publication.py\n    echo "-> Generating stable entity permalinks from declared authority..."')
replace_once("tools/build.sh", '"$PY" tools/check_public_boundary.py docs/machine docs/llms.txt docs/sitemap.xml docs/relationships docs/canon docs/entities docs/objects', '"$PY" tools/check_public_boundary.py docs/machine docs/llms.txt docs/sitemap.xml docs/relationships docs/canon docs/discover docs/entities docs/objects')
replace_once("src/templates/entity.html.j2", '<div class="entity-actions" aria-label="Related publication"><a href="../objects/">Browse museum objects</a><a href="../relationships/">Relationship observatory</a><a href="../canon/">Canon Inspector</a></div>', '<div class="entity-actions" aria-label="Related publication"><a href="../objects/">Browse museum objects</a><a href="../relationships/">Relationship observatory</a><a href="../canon/">Canon Inspector</a><a href="../discover/">Discover</a></div>')

cross = ROOT / "tests/test_cross_browser.py"; text = cross.read_text(encoding="utf-8")
if "def test_faceted_discovery_journey" not in text:
    text += '''\n\n\ndef test_faceted_discovery_journey(page: Page, local_server):\n    page.set_viewport_size({"width": 375, "height": 812})\n    page.goto(f"{local_server}/discover/?class=character-section&q=Dao#result-dao")\n    expect(page.locator("#result-dao")).to_be_visible()\n    expect(page.locator("#discoveryStatus")).to_contain_text("1 of 127 records")\n    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")\n    page.locator("#resetFilters").click()\n    page.locator("#discoveryQuery").fill("Codec")\n    page.keyboard.press("ArrowDown")\n    expect(page.locator("#result-codec .result-link")).to_be_focused()\n'''
    cross.write_text(text, encoding="utf-8")

print("Phase 7 source patch complete")
