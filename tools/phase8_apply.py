#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def write(relative: str, content: str) -> None:
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")
    print(f"wrote {relative}")


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{relative}: expected one replacement anchor, found {count}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched {relative}")


write(
    "src/tours/tours.json",
    r'''{
  "schema": "starsilk-curated-tour-source/1",
  "tours": [
    {"tour_id": "overview", "navigation_group": "Overview"},
    {"tour_id": "principal-characters", "navigation_group": "Principal characters"},
    {"tour_id": "drakken-blood-systems", "navigation_group": "Drakken & blood systems"},
    {"tour_id": "canon-cosmology", "navigation_group": "Canon & cosmology"},
    {"tour_id": "reference", "navigation_group": "Reference"},
    {"tour_id": "peripheral-cosmic", "navigation_group": "Peripheral & cosmic"}
  ]
}''',
)

write(
    "src/tours/AUTHORITY.md",
    r'''# Starsilk curated tours and browser-local library — authority boundary

`docs/tours/` is generated Phase 8 publication. It is an editorial navigation and browser-local convenience surface, not canon/content authority, chronology authority, relationship authority, or a server-side user database.

Authority remains upstream:

1. `src/tours/tours.json` owns only the stable curated-tour IDs and their binding to an existing authored navigation group.
2. `src/content/nav.json` owns the ordered stable-record membership of those navigation groups.
3. Existing section authority owns record identity and display content; `/entities/<stable-id>/` remains the canonical human record destination.
4. Generated `docs/tours/tours.json` and HTML are disposable derivatives.

## Tour semantics

- A tour is an editorial route through existing stable Compendium records.
- Tour order is navigation order only. It does not assert chronology, causality, importance, faction membership, kinship, or any other semantic relationship.
- Tour stops contain stable IDs and links, not duplicated canon prose. Canon facts remain in the cited record authority.
- Missing records, dates, semantic relationships, coordinates, and other unauthored facts remain unknown rather than being filled for tour convenience.

## Browser-local library semantics

The human `/tours/` page may use `localStorage` to keep bookmarks, recent openings, local history, tour progress, and user-named collections in that browser profile.

- no account or sign-in is required;
- no analytics, telemetry, beacon, or server write is used;
- local collection names and local history are not published in generated files;
- user-authored collection names are never serialized into public URLs by the Phase 8 client;
- a bookmark, collection, recent item, history entry, or completion mark is user preference/state only and is never canon evidence;
- clearing site storage removes the persistent local library; if storage is unavailable, the page falls back to session-memory behavior without exporting that state.

If a generated tour conflicts with its cited navigation or record authority, the generated tour is wrong and must be regenerated or repaired.''',
)

write(
    "src/schema/tour-index.schema.json",
    r'''{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://westkitty.github.io/Starsilk_Character_Dossier/machine/schema/v1/tour-index.schema.json",
  "title": "Starsilk curated tour index v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema", "schema_url", "project_id", "canonical_url", "human_url", "source_ref", "tour_count", "tours", "local_state_policy", "interpretation_rules"],
  "properties": {
    "schema": {"const": "starsilk-tour-index/1"},
    "schema_url": {"type": "string", "format": "uri"},
    "project_id": {"const": "starsilk-character-dossier"},
    "canonical_url": {"type": "string", "format": "uri"},
    "human_url": {"type": "string", "format": "uri"},
    "source_ref": {"const": "src/tours/tours.json"},
    "tour_count": {"type": "integer", "minimum": 0},
    "tours": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["tour_id", "label", "canonical_url", "navigation_group", "source_refs", "stop_count", "stops"],
        "properties": {
          "tour_id": {"type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$"},
          "label": {"type": "string", "minLength": 1},
          "canonical_url": {"type": "string", "format": "uri"},
          "navigation_group": {"type": "string", "minLength": 1},
          "source_refs": {
            "type": "array",
            "minItems": 2,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["path", "kind"],
              "properties": {
                "path": {"type": "string", "minLength": 1},
                "anchor": {"type": "string", "minLength": 1},
                "kind": {"enum": ["editorial-navigation", "authoritative-navigation"]}
              }
            }
          },
          "stop_count": {"type": "integer", "minimum": 1},
          "stops": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["position", "stable_id", "display_label", "canonical_url", "legacy_url", "source_ref"],
              "properties": {
                "position": {"type": "integer", "minimum": 1},
                "stable_id": {"type": "string", "minLength": 1},
                "display_label": {"type": "string", "minLength": 1},
                "canonical_url": {"type": "string", "format": "uri"},
                "legacy_url": {"type": "string", "format": "uri"},
                "source_ref": {"const": "src/content/nav.json"}
              }
            }
          }
        }
      }
    },
    "local_state_policy": {
      "type": "object",
      "additionalProperties": false,
      "required": ["scope", "account_required", "analytics_or_telemetry", "published", "private_text_in_urls"],
      "properties": {
        "scope": {"const": "browser-local"},
        "account_required": {"const": false},
        "analytics_or_telemetry": {"const": false},
        "published": {"const": false},
        "private_text_in_urls": {"const": false}
      }
    },
    "interpretation_rules": {
      "type": "array",
      "minItems": 1,
      "items": {"type": "string", "minLength": 1}
    }
  }
}''',
)

write(
    "src/templates/tours.html.j2",
    r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tours & local library · {{ project_name }}</title>
<meta name="description" content="Stable-ID curated routes through the Starsilk Compendium plus a browser-local bookmarks and collections library.">
<link rel="canonical" href="{{ canonical_url }}">
<link rel="alternate" type="application/json" href="tours.json">
<link rel="stylesheet" href="tours.css">
<script src="tours.js" defer></script>
</head>
<body class="tour-shell">
<a class="skip-link" href="#main">Skip to tours</a>
<header class="tour-bar">
  <a class="tour-brand" href="../">{{ project_name }}</a>
  <nav aria-label="Tour publication">
    <a href="../entities/">Entity index</a>
    <a href="../discover/">Discover</a>
    <a href="../objects/">Museum objects</a>
    <a href="tours.json">JSON</a>
  </nav>
</header>

<main id="main" class="tour-main">
  <header class="tour-hero">
    <div class="eyebrow">Phase 8 · stable-ID routes</div>
    <h1>Curated tours & local library</h1>
    <p class="tour-lede">Follow editorial routes through existing stable Compendium records, then keep bookmarks, recent openings, history, progress, and named collections locally in this browser.</p>
    <p class="tour-authority"><strong>Authority boundary:</strong> tour order is navigation, not chronology or relationship evidence. Local library state is personal browser state, not canon. No account, analytics, telemetry, or server write is used.</p>
  </header>

  <section class="tour-section" aria-labelledby="curated-heading">
    <div class="section-heading">
      <div><div class="eyebrow">Curated routes</div><h2 id="curated-heading">Tours</h2></div>
      <a href="AUTHORITY.md">Interpretation rules</a>
    </div>
    <div class="tour-grid">
      {% for tour in tours %}
      <article id="tour-{{ tour.tour_id }}" class="tour-card" data-tour-id="{{ tour.tour_id }}">
        <header>
          <div><div class="tour-id">{{ tour.tour_id }}</div><h3>{{ tour.label }}</h3></div>
          <a class="tour-anchor" href="#tour-{{ tour.tour_id }}" aria-label="Deep link to {{ tour.label }} tour">#</a>
        </header>
        <p class="tour-progress" id="progress-{{ tour.tour_id }}" role="status">0 of {{ tour.stop_count }} stops completed locally</p>
        <ol class="tour-stops">
          {% for stop in tour.stops %}
          <li id="tour-{{ tour.tour_id }}-stop-{{ stop.position }}" data-stable-id="{{ stop.stable_id }}">
            <div class="stop-main">
              <span class="stop-number">{{ stop.position }}</span>
              <div>
                <a class="tour-stop-link" data-visit-id="{{ stop.stable_id }}" href="../entities/{{ stop.stable_id }}/">{{ stop.display_label }}</a>
                <code>{{ stop.stable_id }}</code>
              </div>
            </div>
            <div class="stop-actions">
              <label><input type="checkbox" data-tour-progress data-tour-id="{{ tour.tour_id }}" data-stable-id="{{ stop.stable_id }}"> Complete</label>
              <button type="button" data-bookmark-id="{{ stop.stable_id }}">Bookmark</button>
              <a href="#record-{{ stop.stable_id }}">Library</a>
            </div>
          </li>
          {% endfor %}
        </ol>
      </article>
      {% endfor %}
    </div>
  </section>

  <section id="localLibrary" class="tour-section local-library" tabindex="-1" aria-labelledby="library-heading">
    <div class="section-heading">
      <div><div class="eyebrow">Browser-local state</div><h2 id="library-heading">Your local library</h2></div>
      <button id="clearLocalData" type="button" class="danger-button">Clear local data</button>
    </div>
    <p class="privacy-note">Stored only in this browser profile via local storage when available. Collection names and history are not published and are not placed in public URLs.</p>
    <p id="localStatus" class="local-status" role="status" aria-live="polite">Local library ready.</p>

    <div class="library-controls">
      <label>Stable record
        <select id="libraryRecord">
          {% for record in records %}<option value="{{ record.stable_id }}">{{ record.display_label }} — {{ record.stable_id }}</option>{% endfor %}
        </select>
      </label>
      <div class="control-actions">
        <a id="openSelected" href="../entities/{{ records[0].stable_id }}/">Open selected</a>
        <button id="bookmarkSelected" type="button">Bookmark selected</button>
      </div>
      <label>New collection name
        <input id="collectionName" type="text" maxlength="80" autocomplete="off" placeholder="Private local name">
      </label>
      <button id="createCollection" type="button">Create collection</button>
      <label>Collection
        <select id="collectionSelect"><option value="">Create a collection first</option></select>
      </label>
      <button id="addSelectedToCollection" type="button">Add selected to collection</button>
    </div>

    <div class="library-grid">
      <section aria-labelledby="bookmarks-heading"><h3 id="bookmarks-heading">Bookmarks</h3><ul id="bookmarksList" class="local-list"></ul><p id="bookmarksEmpty" class="empty-local">No local bookmarks.</p></section>
      <section aria-labelledby="recent-heading"><h3 id="recent-heading">Recent openings</h3><ol id="recentList" class="local-list"></ol><p id="recentEmpty" class="empty-local">No locally recorded openings.</p></section>
      <section aria-labelledby="history-heading"><h3 id="history-heading">Local history</h3><ol id="historyList" class="local-list history-list"></ol><p id="historyEmpty" class="empty-local">No local history.</p></section>
    </div>

    <section class="collections-wrap" aria-labelledby="collections-heading">
      <h3 id="collections-heading">Collections</h3>
      <div id="collectionsList"></div>
      <p id="collectionsEmpty" class="empty-local">No local collections.</p>
    </section>
  </section>
</main>

<footer class="tour-footer">
  <p>Generated from stable tour bindings and authored navigation order. <a href="AUTHORITY.md">Authority rules</a> · <a href="schema.json">Tour schema</a></p>
</footer>
</body>
</html>''',
)

write(
    "src/templates/tours.css",
    r'''.tour-shell{min-height:100vh;background:var(--void);color:#edf7fb}.tour-bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:.85rem clamp(1rem,3vw,2rem);background:rgba(5,7,13,.95);border-bottom:1px solid var(--line);backdrop-filter:blur(12px)}.tour-brand{font-weight:800;letter-spacing:.08em;text-decoration:none;color:var(--thread2)}.tour-bar nav{display:flex;flex-wrap:wrap;gap:.8rem}.tour-bar nav a{font-size:.82rem;color:#b8cbd7}.tour-main{width:min(1180px,100%);margin:0 auto;padding:clamp(1.2rem,4vw,3rem)}.tour-hero{padding:clamp(2rem,6vw,5rem) 0 2rem;border-bottom:1px solid var(--line);margin-bottom:2rem}.tour-hero h1{font-size:clamp(2.8rem,7vw,6rem);line-height:.9;max-width:12ch;margin:.6rem 0 1.4rem}.tour-lede{max-width:60rem;font-size:clamp(1.05rem,2vw,1.35rem);color:#bfd0db}.tour-authority,.privacy-note{max-width:68rem;color:#a9bdc9;background:#0b1420;border-left:3px solid var(--thread);padding:.9rem 1rem}.tour-section{scroll-margin-top:5.5rem;margin:2rem 0 3rem}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:1rem;border-bottom:1px solid var(--line);padding-bottom:.8rem;margin-bottom:1rem}.section-heading h2{font-size:clamp(1.8rem,4vw,3rem);margin:.2rem 0 0}.section-heading>a{font-size:.82rem;color:var(--thread2)}.tour-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:1rem}.tour-card{scroll-margin-top:5.5rem;background:#0b121d;border:1px solid #26394c;padding:1rem;box-shadow:0 14px 36px rgba(0,0,0,.22)}.tour-card:target{border-color:var(--thread);box-shadow:0 0 0 1px rgba(85,223,255,.25),0 14px 36px rgba(0,0,0,.3)}.tour-card>header{display:flex;justify-content:space-between;gap:1rem;align-items:start}.tour-card h3{font-size:1.45rem;margin:.25rem 0 .4rem}.tour-id{font:700 .72rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);letter-spacing:.1em}.tour-anchor{text-decoration:none;color:var(--thread);font:800 1.1rem/1 ui-monospace,SFMono-Regular,Menlo,monospace}.tour-progress{font-size:.82rem;color:#a5bac7;margin:0 0 .9rem}.tour-stops{list-style:none;padding:0;margin:0;display:grid;gap:.55rem}.tour-stops li{display:grid;gap:.55rem;padding:.75rem;background:#08111b;border:1px solid #1e3142}.stop-main{display:flex;align-items:start;gap:.7rem;min-width:0}.stop-number{display:grid;place-items:center;flex:0 0 1.8rem;height:1.8rem;border:1px solid #31536c;color:var(--thread);font:800 .72rem/1 ui-monospace,SFMono-Regular,Menlo,monospace}.tour-stop-link{font-weight:760;color:#edf7fb}.stop-main code{display:block;overflow-wrap:anywhere;margin-top:.2rem;color:#8ea9b9;font-size:.75rem}.stop-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.45rem .7rem;font-size:.76rem}.stop-actions label{display:flex;gap:.35rem;align-items:center}.stop-actions button,.library-controls button,.danger-button{min-height:38px;padding:.42rem .7rem;border:1px solid #31536c;background:#102131;color:#eaf8ff;border-radius:3px;cursor:pointer}.stop-actions button:hover,.stop-actions button:focus-visible,.library-controls button:hover,.library-controls button:focus-visible{border-color:var(--thread);outline:none}.stop-actions a{color:var(--thread2)}.local-library{background:#08111a;border:1px solid #26394c;padding:clamp(1rem,3vw,1.5rem)}.local-library:focus{outline:2px solid var(--thread);outline-offset:3px}.danger-button{border-color:#75404a;background:#211016;color:#ffd6da}.local-status{font:700 .78rem/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--thread2);min-height:1.2em}.library-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem 1rem;padding:1rem 0 1.4rem;border-bottom:1px solid #233547}.library-controls label{display:grid;gap:.35rem;color:#a9bdc9;font-size:.82rem}.library-controls input,.library-controls select{width:100%;min-height:44px;background:#070d15;color:#eef7fb;border:1px solid #30475d;padding:.55rem .65rem;border-radius:3px}.library-controls input:focus,.library-controls select:focus{outline:2px solid var(--thread);outline-offset:1px}.control-actions{display:flex;flex-wrap:wrap;gap:.6rem;align-items:end}.control-actions a{display:inline-flex;align-items:center;min-height:38px;padding:.42rem .7rem;border:1px solid #31536c;text-decoration:none;color:var(--thread2)}.library-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;margin-top:1.2rem}.library-grid>section,.collections-wrap{background:#0b1420;border:1px solid #24384a;padding:.9rem}.library-grid h3,.collections-wrap h3{font-size:1rem;margin:0 0 .7rem}.local-list{padding-left:1.25rem;margin:0;display:grid;gap:.45rem}.local-list li{color:#b9ccd8;min-width:0}.local-record-row{display:flex;align-items:start;justify-content:space-between;gap:.55rem}.local-record-row a{overflow-wrap:anywhere}.local-record-row button,.collection-card button{border:0;background:none;color:#ffb8c1;text-decoration:underline;cursor:pointer;font:inherit;padding:0}.local-meta{display:block;color:#7892a4;font-size:.7rem}.empty-local{color:#7892a4;font-style:italic;font-size:.82rem}.collections-wrap{margin-top:1rem}.collection-card{border-top:1px solid #263a4c;padding:.8rem 0}.collection-card:first-child{border-top:0;padding-top:0}.collection-head{display:flex;justify-content:space-between;gap:1rem;align-items:start}.collection-head h4{margin:0 0 .5rem;font-size:1rem;overflow-wrap:anywhere}.tour-footer{width:min(1180px,100%);margin:0 auto;padding:1rem clamp(1.2rem,4vw,3rem) 3rem;color:#8099aa;font-size:.78rem;border-top:1px solid #1f3040}@media(max-width:760px){.tour-bar{align-items:flex-start;flex-direction:column}.tour-main{padding:1rem}.tour-hero h1{font-size:clamp(2.4rem,13vw,4rem)}.section-heading{align-items:flex-start;flex-direction:column}.library-controls,.library-grid{grid-template-columns:1fr}.tour-card{padding:.8rem}.stop-actions{align-items:flex-start}}''',
)

write(
    "src/templates/tours.js",
    r'''(() => {
  "use strict";

  const STORAGE_KEY = "starsilk-local-library-v1";
  const MAX_RECENT = 8;
  const MAX_HISTORY = 50;
  const recordSelect = document.getElementById("libraryRecord");
  const catalog = new Map(Array.from(recordSelect.options).map((option) => [option.value, option.textContent.split(" — ")[0]]));
  const tourIds = new Set(Array.from(document.querySelectorAll("[data-tour-id].tour-card")).map((node) => node.dataset.tourId));
  let storageAvailable = true;

  const emptyState = () => ({version: 1, bookmarks: [], recent: [], history: [], collections: [], progress: {}});
  let state = emptyState();

  const validIds = (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.filter((item) => typeof item === "string" && catalog.has(item))));
  };

  function normalizeState(raw) {
    const next = emptyState();
    if (!raw || typeof raw !== "object") return next;
    next.bookmarks = validIds(raw.bookmarks);
    next.recent = validIds(raw.recent).slice(0, MAX_RECENT);
    if (Array.isArray(raw.history)) {
      next.history = raw.history
        .filter((item) => item && typeof item === "object" && catalog.has(item.stable_id) && typeof item.seen_at === "string")
        .slice(0, MAX_HISTORY)
        .map((item) => ({stable_id: item.stable_id, seen_at: item.seen_at}));
    }
    if (Array.isArray(raw.collections)) {
      next.collections = raw.collections
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: typeof item.id === "string" ? item.id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) : "",
          name: typeof item.name === "string" ? item.name.trim().slice(0, 80) : "",
          items: validIds(item.items),
        }))
        .filter((item) => item.id && item.name);
    }
    if (raw.progress && typeof raw.progress === "object") {
      for (const [tourId, items] of Object.entries(raw.progress)) {
        if (tourIds.has(tourId)) next.progress[tourId] = validIds(items);
      }
    }
    return next;
  }

  function setStatus(message) {
    document.getElementById("localStatus").textContent = message;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state = normalizeState(raw ? JSON.parse(raw) : null);
    } catch (error) {
      storageAvailable = false;
      state = emptyState();
      setStatus("Persistent local storage is unavailable; this page will keep state in memory only for the current page session.");
    }
  }

  function saveState(message) {
    if (storageAvailable) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        storageAvailable = false;
        setStatus("Persistent local storage became unavailable; changes now remain only in this page session.");
        return;
      }
    }
    if (message) setStatus(message);
  }

  const labelFor = (stableId) => catalog.get(stableId) || stableId;
  const hrefFor = (stableId) => `../entities/${encodeURIComponent(stableId)}/`;

  function makeRecordRow(stableId, removeHandler, metaText) {
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.className = "local-record-row";
    const left = document.createElement("div");
    const link = document.createElement("a");
    link.href = hrefFor(stableId);
    link.textContent = labelFor(stableId);
    link.dataset.visitId = stableId;
    link.addEventListener("click", () => recordVisit(stableId));
    left.append(link);
    const code = document.createElement("span");
    code.className = "local-meta";
    code.textContent = metaText || stableId;
    left.append(code);
    row.append(left);
    if (removeHandler) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Remove";
      button.addEventListener("click", removeHandler);
      row.append(button);
    }
    li.append(row);
    return li;
  }

  function renderBookmarks() {
    const list = document.getElementById("bookmarksList");
    list.replaceChildren();
    state.bookmarks.forEach((stableId) => list.append(makeRecordRow(stableId, () => {
      state.bookmarks = state.bookmarks.filter((id) => id !== stableId);
      saveState(`Removed ${labelFor(stableId)} from local bookmarks.`);
      renderBookmarks();
    })));
    document.getElementById("bookmarksEmpty").hidden = state.bookmarks.length > 0;
  }

  function renderRecentHistory() {
    const recent = document.getElementById("recentList");
    recent.replaceChildren();
    state.recent.forEach((stableId) => recent.append(makeRecordRow(stableId, null)));
    document.getElementById("recentEmpty").hidden = state.recent.length > 0;

    const history = document.getElementById("historyList");
    history.replaceChildren();
    state.history.forEach((item) => {
      const parsed = new Date(item.seen_at);
      const when = Number.isNaN(parsed.getTime()) ? item.seen_at : parsed.toLocaleString();
      history.append(makeRecordRow(item.stable_id, null, `${item.stable_id} · ${when}`));
    });
    document.getElementById("historyEmpty").hidden = state.history.length > 0;
  }

  function renderCollections() {
    const select = document.getElementById("collectionSelect");
    const previous = select.value;
    select.replaceChildren();
    if (!state.collections.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Create a collection first";
      select.append(option);
    } else {
      state.collections.forEach((collection) => {
        const option = document.createElement("option");
        option.value = collection.id;
        option.textContent = collection.name;
        select.append(option);
      });
      if (state.collections.some((item) => item.id === previous)) select.value = previous;
    }

    const wrap = document.getElementById("collectionsList");
    wrap.replaceChildren();
    state.collections.forEach((collection) => {
      const card = document.createElement("section");
      card.className = "collection-card";
      const head = document.createElement("div");
      head.className = "collection-head";
      const title = document.createElement("h4");
      title.textContent = `${collection.name} (${collection.items.length})`;
      const removeCollection = document.createElement("button");
      removeCollection.type = "button";
      removeCollection.textContent = "Delete collection";
      removeCollection.addEventListener("click", () => {
        state.collections = state.collections.filter((item) => item.id !== collection.id);
        saveState(`Deleted local collection ${collection.name}.`);
        renderCollections();
      });
      head.append(title, removeCollection);
      card.append(head);
      const list = document.createElement("ul");
      list.className = "local-list";
      collection.items.forEach((stableId) => list.append(makeRecordRow(stableId, () => {
        collection.items = collection.items.filter((id) => id !== stableId);
        saveState(`Removed ${labelFor(stableId)} from ${collection.name}.`);
        renderCollections();
      })));
      if (!collection.items.length) {
        const empty = document.createElement("p");
        empty.className = "empty-local";
        empty.textContent = "This collection is empty.";
        card.append(empty);
      } else {
        card.append(list);
      }
      wrap.append(card);
    });
    document.getElementById("collectionsEmpty").hidden = state.collections.length > 0;
  }

  function renderProgress() {
    document.querySelectorAll("input[data-tour-progress]").forEach((input) => {
      const items = state.progress[input.dataset.tourId] || [];
      input.checked = items.includes(input.dataset.stableId);
    });
    tourIds.forEach((tourId) => {
      const inputs = Array.from(document.querySelectorAll(`input[data-tour-progress][data-tour-id="${tourId}"]`));
      const count = inputs.filter((input) => input.checked).length;
      const status = document.getElementById(`progress-${tourId}`);
      if (status) status.textContent = `${count} of ${inputs.length} stops completed locally`;
    });
  }

  function renderAll() {
    renderBookmarks();
    renderRecentHistory();
    renderCollections();
    renderProgress();
  }

  function recordVisit(stableId) {
    if (!catalog.has(stableId)) return;
    state.recent = [stableId, ...state.recent.filter((id) => id !== stableId)].slice(0, MAX_RECENT);
    state.history = [{stable_id: stableId, seen_at: new Date().toISOString()}, ...state.history].slice(0, MAX_HISTORY);
    saveState(`Recorded local opening for ${labelFor(stableId)}.`);
    renderRecentHistory();
  }

  function bookmark(stableId) {
    if (!catalog.has(stableId)) return;
    if (!state.bookmarks.includes(stableId)) state.bookmarks.push(stableId);
    saveState(`Bookmarked ${labelFor(stableId)} locally.`);
    renderBookmarks();
  }

  function updateOpenSelected() {
    const stableId = recordSelect.value;
    const link = document.getElementById("openSelected");
    link.href = hrefFor(stableId);
    link.dataset.visitId = stableId;
  }

  document.querySelectorAll("[data-bookmark-id]").forEach((button) => button.addEventListener("click", () => bookmark(button.dataset.bookmarkId)));
  document.querySelectorAll(".tour-stop-link").forEach((link) => link.addEventListener("click", () => recordVisit(link.dataset.visitId)));
  document.querySelectorAll("input[data-tour-progress]").forEach((input) => input.addEventListener("change", () => {
    const tourId = input.dataset.tourId;
    const stableId = input.dataset.stableId;
    const current = new Set(state.progress[tourId] || []);
    if (input.checked) current.add(stableId); else current.delete(stableId);
    state.progress[tourId] = Array.from(current);
    saveState(`Updated local progress for ${labelFor(stableId)}.`);
    renderProgress();
  }));

  recordSelect.addEventListener("change", updateOpenSelected);
  document.getElementById("openSelected").addEventListener("click", () => recordVisit(recordSelect.value));
  document.getElementById("bookmarkSelected").addEventListener("click", () => bookmark(recordSelect.value));
  document.getElementById("createCollection").addEventListener("click", () => {
    const input = document.getElementById("collectionName");
    const name = input.value.trim().slice(0, 80);
    if (!name) {
      setStatus("Enter a local collection name first.");
      input.focus();
      return;
    }
    const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.collections.push({id, name, items: []});
    input.value = "";
    saveState(`Created local collection ${name}.`);
    renderCollections();
    document.getElementById("collectionSelect").value = id;
  });
  document.getElementById("addSelectedToCollection").addEventListener("click", () => {
    const collectionId = document.getElementById("collectionSelect").value;
    const collection = state.collections.find((item) => item.id === collectionId);
    if (!collection) {
      setStatus("Create or select a local collection first.");
      return;
    }
    const stableId = recordSelect.value;
    if (!collection.items.includes(stableId)) collection.items.push(stableId);
    saveState(`Added ${labelFor(stableId)} to ${collection.name}.`);
    renderCollections();
  });
  document.getElementById("clearLocalData").addEventListener("click", () => {
    state = emptyState();
    if (storageAvailable) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (error) { storageAvailable = false; }
    }
    setStatus("Cleared Phase 8 local library state from this browser origin.");
    renderAll();
  });

  function handleHash() {
    const match = location.hash.match(/^#record-([A-Za-z0-9_-]+)$/);
    if (!match || !catalog.has(match[1])) return;
    recordSelect.value = match[1];
    updateOpenSelected();
    const library = document.getElementById("localLibrary");
    library.scrollIntoView({block: "start"});
    recordSelect.focus({preventScroll: true});
  }

  window.addEventListener("hashchange", handleHash);
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      loadState();
      renderAll();
    }
  });

  loadState();
  updateOpenSelected();
  renderAll();
  handleHash();
})();''',
)

write(
    "build/tour_publication.py",
    r'''#!/usr/bin/env python3
"""Generate Phase 8 curated stable-ID tours and browser-local library shell.

Curated tour IDs are authored in src/tours/tours.json. Stop membership and
order come only from the bound src/content/nav.json navigation group. Human
local-library state is runtime browser-local data and is never generated into
or read back into repository publication.

Usage: python3 build/tour_publication.py [--check]
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
TOUR_DIR = DOCS_DIR / "tours"
TEMPLATES_DIR = ROOT / "src" / "templates"
SOURCE_FILE = ROOT / "src" / "tours" / "tours.json"
AUTHORITY_FILE = ROOT / "src" / "tours" / "AUTHORITY.md"
SCHEMA_FILE = ROOT / "src" / "schema" / "tour-index.schema.json"
NAV_FILE = ROOT / "src" / "content" / "nav.json"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
PROJECT_ID = "starsilk-character-dossier"
PROJECT_NAME = "Starsilk Compendium"
TOUR_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")

sys.path.insert(0, str(ROOT / "build"))
import generate  # noqa: E402
import machine_publication as machine  # noqa: E402


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def load_records() -> list[dict]:
    rename_map = generate.load_media_rename_map()
    sections = generate.load_sections(rename_map)
    manifest = machine.load_manifest()
    return machine.build_entity_records(sections, manifest)


def load_navigation() -> dict[str, dict]:
    payload = json.loads(NAV_FILE.read_text(encoding="utf-8"))
    groups: dict[str, dict] = {}
    seen_ids: set[str] = set()
    for group in payload.get("groups", []):
        label = group.get("label")
        links = group.get("links")
        if not isinstance(label, str) or not label or not isinstance(links, list) or not links:
            raise RuntimeError("every authored navigation group used by tours must have a label and non-empty links")
        if label in groups:
            raise RuntimeError(f"duplicate navigation group label: {label}")
        for link in links:
            stable_id = link.get("id")
            if not isinstance(stable_id, str) or not stable_id:
                raise RuntimeError(f"navigation group {label} has a link without stable ID")
            if stable_id in seen_ids:
                raise RuntimeError(f"stable ID appears in multiple authored navigation groups: {stable_id}")
            seen_ids.add(stable_id)
        groups[label] = group
    return groups


def build_index() -> tuple[dict, list[dict]]:
    source = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    if source.get("schema") != "starsilk-curated-tour-source/1":
        raise RuntimeError("unsupported curated tour source schema")
    specs = source.get("tours")
    if not isinstance(specs, list) or not specs:
        raise RuntimeError("curated tour source must contain a non-empty tours array")

    records = load_records()
    by_id = {record["stable_id"]: record for record in records}
    groups = load_navigation()
    seen_tour_ids: set[str] = set()
    seen_groups: set[str] = set()
    tours: list[dict] = []

    for spec in specs:
        tour_id = spec.get("tour_id")
        group_label = spec.get("navigation_group")
        if not isinstance(tour_id, str) or not TOUR_ID_RE.fullmatch(tour_id):
            raise RuntimeError(f"invalid stable tour ID: {tour_id!r}")
        if tour_id in seen_tour_ids:
            raise RuntimeError(f"duplicate stable tour ID: {tour_id}")
        if not isinstance(group_label, str) or group_label not in groups:
            raise RuntimeError(f"tour {tour_id} references unknown navigation group: {group_label!r}")
        if group_label in seen_groups:
            raise RuntimeError(f"navigation group is bound to multiple curated tour IDs: {group_label}")
        seen_tour_ids.add(tour_id)
        seen_groups.add(group_label)

        stops = []
        for position, link in enumerate(groups[group_label]["links"], start=1):
            stable_id = link["id"]
            record = by_id.get(stable_id)
            if record is None:
                raise RuntimeError(f"tour {tour_id} references unknown stable record: {stable_id}")
            stops.append(
                {
                    "position": position,
                    "stable_id": stable_id,
                    "display_label": record["display_label"],
                    "canonical_url": record["canonical_url"],
                    "legacy_url": machine.legacy_anchor(stable_id),
                    "source_ref": "src/content/nav.json",
                }
            )
        tours.append(
            {
                "tour_id": tour_id,
                "label": group_label,
                "canonical_url": machine.canonical(f"tours/#tour-{tour_id}"),
                "navigation_group": group_label,
                "source_refs": [
                    {"path": "src/tours/tours.json", "anchor": tour_id, "kind": "editorial-navigation"},
                    {"path": "src/content/nav.json", "anchor": group_label, "kind": "authoritative-navigation"},
                ],
                "stop_count": len(stops),
                "stops": stops,
            }
        )

    index = {
        "schema": "starsilk-tour-index/1",
        "schema_url": machine.canonical("machine/schema/v1/tour-index.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": machine.canonical("tours/tours.json"),
        "human_url": machine.canonical("tours/"),
        "source_ref": "src/tours/tours.json",
        "tour_count": len(tours),
        "tours": tours,
        "local_state_policy": {
            "scope": "browser-local",
            "account_required": False,
            "analytics_or_telemetry": False,
            "published": False,
            "private_text_in_urls": False,
        },
        "interpretation_rules": [
            "Tour order is editorial navigation only and does not assert chronology, causality, importance, or semantic relationships.",
            "Tour stops reference existing stable records and do not duplicate or replace canon prose.",
            "Bookmarks, recent openings, history, progress, and named collections are browser-local user state and never canon evidence.",
            "User-authored local collection names are not serialized into public URLs or generated publication.",
        ],
    }
    return index, records


def render_outputs() -> dict[str, str]:
    index, records = build_index()
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True, trim_blocks=False, lstrip_blocks=False)
    template = env.get_template("tours.html.j2")
    base_css = (TEMPLATES_DIR / "style.css").read_text(encoding="utf-8").rstrip()
    tour_css = (TEMPLATES_DIR / "tours.css").read_text(encoding="utf-8").rstrip()
    return {
        "index.html": template.render(project_name=PROJECT_NAME, canonical_url=machine.canonical("tours/"), tours=index["tours"], records=records),
        "tours.css": base_css + "\n\n" + tour_css + "\n",
        "tours.js": (TEMPLATES_DIR / "tours.js").read_text(encoding="utf-8").rstrip() + "\n",
        "tours.json": json_text(index),
        "schema.json": SCHEMA_FILE.read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": AUTHORITY_FILE.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual_files() -> set[str]:
    if not TOUR_DIR.exists():
        return set()
    return {path.relative_to(TOUR_DIR).as_posix() for path in TOUR_DIR.rglob("*") if path.is_file()}


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors: list[str] = []
    expected = set(outputs)
    actual = actual_files()
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        if missing:
            errors.append("missing generated tour files: " + ", ".join(missing))
        if extra:
            errors.append("unexpected generated tour files: " + ", ".join(extra))
    for relative, expected_text in outputs.items():
        path = TOUR_DIR / relative
        if not path.exists():
            continue
        try:
            current = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated tour output docs/tours/{relative}: {exc}")
            continue
        if current != expected_text:
            errors.append(f"generated tour output differs: docs/tours/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if TOUR_DIR.exists():
        shutil.rmtree(TOUR_DIR)
    for relative, content in outputs.items():
        path = TOUR_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if generated tour publication differs from committed docs output")
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: tour publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} tour outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())''',
)

write(
    "tests/test_tours.py",
    r'''import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
TOURS = DOCS / "tours"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
BASE_FILES = {"index.html", "tours.css", "tours.js", "tours.json", "schema.json", "AUTHORITY.md"}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_tour_file_set_is_exact_build_owned_and_deterministic():
    actual = {path.relative_to(TOURS).as_posix() for path in TOURS.rglob("*") if path.is_file()}
    assert actual == BASE_FILES
    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert "build/tour_publication.py" in build and "docs/tours" in build
    proc = subprocess.run([sys.executable, "build/tour_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "tour outputs match generator output" in proc.stdout


def test_curated_tours_derive_only_from_stable_bindings_and_authored_navigation():
    source = read_json(ROOT / "src/tours/tours.json")
    nav = read_json(ROOT / "src/content/nav.json")
    entities = read_json(DOCS / "machine/entities.json")["records"]
    index = read_json(TOURS / "tours.json")
    groups = {group["label"]: group for group in nav["groups"]}
    labels = {record["stable_id"]: record["display_label"] for record in entities}
    urls = {record["stable_id"]: record["canonical_url"] for record in entities}

    assert index["schema"] == "starsilk-tour-index/1"
    assert index["tour_count"] == len(source["tours"]) == 6
    assert [tour["tour_id"] for tour in index["tours"]] == [spec["tour_id"] for spec in source["tours"]]
    for spec, tour in zip(source["tours"], index["tours"]):
        group = groups[spec["navigation_group"]]
        expected_ids = [link["id"] for link in group["links"]]
        assert tour["tour_id"] == spec["tour_id"]
        assert tour["label"] == group["label"] == tour["navigation_group"]
        assert tour["stop_count"] == len(expected_ids) == len(tour["stops"])
        assert [stop["stable_id"] for stop in tour["stops"]] == expected_ids
        assert [stop["position"] for stop in tour["stops"]] == list(range(1, len(expected_ids) + 1))
        for stop in tour["stops"]:
            assert set(stop) == {"position", "stable_id", "display_label", "canonical_url", "legacy_url", "source_ref"}
            assert stop["display_label"] == labels[stop["stable_id"]]
            assert stop["canonical_url"] == urls[stop["stable_id"]]
            assert stop["legacy_url"] == SITE_BASE + "#" + stop["stable_id"]
            assert stop["source_ref"] == "src/content/nav.json"
    rendered = json.dumps(index)
    for forbidden in ("body_html", "excerpt", "description", "canon_status", "spoiler_level"):
        assert f'"{forbidden}"' not in rendered


def test_tour_authority_machine_discovery_and_privacy_contract():
    index = read_json(TOURS / "tours.json")
    assert index["local_state_policy"] == {
        "scope": "browser-local",
        "account_required": False,
        "analytics_or_telemetry": False,
        "published": False,
        "private_text_in_urls": False,
    }
    authority = (TOURS / "AUTHORITY.md").read_text(encoding="utf-8")
    assert "editorial navigation" in authority
    assert "Tour order is navigation order only" in authority
    assert "no analytics, telemetry, beacon, or server write" in authority
    assert "never serialized into public URLs" in authority
    script = (TOURS / "tours.js").read_text(encoding="utf-8")
    assert "localStorage" in script
    assert "fetch(" not in script and "XMLHttpRequest" not in script and "sendBeacon" not in script

    source_schema = read_json(ROOT / "src/schema/tour-index.schema.json")
    assert read_json(TOURS / "schema.json") == source_schema
    assert read_json(DOCS / "machine/schema/v1/tour-index.schema.json") == source_schema
    machine = read_json(DOCS / "machine/index.json")
    assert machine["endpoints"]["tours"] == SITE_BASE + "tours/"
    assert machine["endpoints"]["tour_index"] == SITE_BASE + "tours/tours.json"
    for url in (SITE_BASE + "tours/", SITE_BASE + "tours/tours.json", SITE_BASE + "tours/schema.json", SITE_BASE + "tours/AUTHORITY.md"):
        assert url in machine["public_urls"]
    llms = (DOCS / "llms.txt").read_text(encoding="utf-8")
    assert "Human curated tours and local library:" in llms and "Curated tour JSON index:" in llms
    assert "browser-local" in llms and "not serialized into public URLs" in llms
    entity_index = (DOCS / "entities/index.html").read_text(encoding="utf-8")
    assert 'href="../tours/"' in entity_index
    discovery = (DOCS / "discover/index.html").read_text(encoding="utf-8")
    assert 'href="../tours/"' in discovery
    proc = subprocess.run([sys.executable, "tools/check_public_boundary.py", "docs/tours"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_tour_human_surface_contains_stable_routes_without_duplicate_prose():
    html = (TOURS / "index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")
    assert soup.find("main", id="main") is not None
    assert len(soup.select("article.tour-card[data-tour-id]")) == 6
    index = read_json(TOURS / "tours.json")
    expected_stops = sum(tour["stop_count"] for tour in index["tours"])
    assert len(soup.select(".tour-stops li[data-stable-id]")) == expected_stops
    assert soup.find(id="localLibrary") is not None
    assert "tour order is navigation, not chronology or relationship evidence" in html
    assert "No account, analytics, telemetry, or server write is used" in html


def test_local_library_persists_without_private_url_or_external_requests(page: Page, local_server):
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/tours/#tour-principal-characters")
    page.evaluate("localStorage.clear()")
    page.reload()
    expect(page.locator("#tour-principal-characters")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    page.locator("#libraryRecord").select_option("codec")
    page.locator("#bookmarkSelected").click()
    expect(page.locator("#bookmarksList")).to_contain_text("Codec")

    private_name = "Private Test Collection"
    page.locator("#collectionName").fill(private_name)
    page.locator("#createCollection").click()
    expect(page.locator("#collectionSelect")).to_contain_text(private_name)
    page.locator("#addSelectedToCollection").click()
    expect(page.locator("#collectionsList")).to_contain_text(private_name)
    expect(page.locator("#collectionsList")).to_contain_text("Codec")
    assert private_name not in page.url

    first_checkbox = page.locator("#tour-principal-characters input[data-tour-progress]").first
    first_checkbox.check()
    page.reload()
    expect(page.locator("#bookmarksList")).to_contain_text("Codec")
    expect(page.locator("#collectionsList")).to_contain_text(private_name)
    expect(page.locator("#tour-principal-characters input[data-tour-progress]").first).to_be_checked()

    page.locator("#openSelected").click()
    expect(page).to_have_url(f"{local_server}/entities/codec/")
    page.go_back()
    expect(page.locator("#recentList")).to_contain_text("Codec")
    expect(page.locator("#historyList")).to_contain_text("Codec")
    assert all(url.startswith(local_server) for url in requests)

    page.locator("#clearLocalData").click()
    expect(page.locator("#bookmarksEmpty")).to_be_visible()
    expect(page.locator("#collectionsEmpty")).to_be_visible()
''',
)

# Build pipeline ownership.
replace_once(
    "tools/build.sh",
    "#     -> build/discovery_publication.py (faceted discovery + AI context packets)\n#     -> build/entity_publication.py",
    "#     -> build/discovery_publication.py (faceted discovery + AI context packets)\n#     -> build/tour_publication.py      (curated tours + browser-local library shell)\n#     -> build/entity_publication.py",
)
replace_once(
    "tools/build.sh",
    "# docs/index.html, docs/machine/, docs/relationships/, docs/canon/, docs/discover/, docs/entities/, and docs/objects/ are",
    "# docs/index.html, docs/machine/, docs/relationships/, docs/canon/, docs/discover/, docs/tours/, docs/entities/, and docs/objects/ are",
)
replace_once(
    "tools/build.sh",
    "    echo \"-> Generating (in-memory) and checking faceted discovery + AI context packets...\"\n    \"$PY\" build/discovery_publication.py --check\n    echo \"-> Generating (in-memory) and checking stable entity permalinks...\"",
    "    echo \"-> Generating (in-memory) and checking faceted discovery + AI context packets...\"\n    \"$PY\" build/discovery_publication.py --check\n    echo \"-> Generating (in-memory) and checking curated tours + local library shell...\"\n    \"$PY\" build/tour_publication.py --check\n    echo \"-> Generating (in-memory) and checking stable entity permalinks...\"",
)
replace_once(
    "tools/build.sh",
    "    echo \"-> Generating faceted discovery + AI context packets from established authority...\"\n    \"$PY\" build/discovery_publication.py\n    echo \"-> Generating stable entity permalinks from declared authority...\"",
    "    echo \"-> Generating faceted discovery + AI context packets from established authority...\"\n    \"$PY\" build/discovery_publication.py\n    echo \"-> Generating curated stable-ID tours + local library shell...\"\n    \"$PY\" build/tour_publication.py\n    echo \"-> Generating stable entity permalinks from declared authority...\"",
)
replace_once(
    "tools/build.sh",
    '"$PY" tools/check_public_boundary.py docs/machine docs/llms.txt docs/sitemap.xml docs/relationships docs/canon docs/discover docs/entities docs/objects',
    '"$PY" tools/check_public_boundary.py docs/machine docs/llms.txt docs/sitemap.xml docs/relationships docs/canon docs/discover docs/tours docs/entities docs/objects',
)

# Machine discovery integration.
replace_once(
    "build/machine_publication.py",
    '    "context-packet-index.schema.json",\n)',
    '    "context-packet-index.schema.json",\n    "tour-index.schema.json",\n)',
)
replace_once(
    "build/machine_publication.py",
    '        "discover/AUTHORITY.md",\n    ] + [f"machine/schema/v1/{name}" for name in SCHEMA_FILES]',
    '        "discover/AUTHORITY.md",\n        "tours/",\n        "tours/tours.json",\n        "tours/schema.json",\n        "tours/AUTHORITY.md",\n    ] + [f"machine/schema/v1/{name}" for name in SCHEMA_FILES]',
)
replace_once(
    "build/machine_publication.py",
    '            "context_packet_index": canonical("discover/context-packets.json"),\n            "jsonld": canonical("machine/project.jsonld"),',
    '            "context_packet_index": canonical("discover/context-packets.json"),\n            "tours": canonical("tours/"),\n            "tour_index": canonical("tours/tours.json"),\n            "jsonld": canonical("machine/project.jsonld"),',
)
replace_once(
    "build/machine_publication.py",
    '            "src/canon/invariants.json",\n            "docs/asset-manifest.json",',
    '            "src/canon/invariants.json",\n            "src/tours/tours.json",\n            "docs/asset-manifest.json",',
)
replace_once(
    "build/machine_publication.py",
    "AI context packet pattern: {canonical('discover/packets/<stable-id>.json')}\\nJSON-LD:",
    "AI context packet pattern: {canonical('discover/packets/<stable-id>.json')}\\nHuman curated tours and local library: {e['tours']}\\nCurated tour JSON index: {e['tour_index']}\\nJSON-LD:",
)
replace_once(
    "build/machine_publication.py",
    "- Faceted discovery and AI context packets are generated convenience derivatives: result classes remain structural, excerpts are mechanical source projections, and packet fields never outrank cited source authority.\\n- Missing event IDs, WorldsVault IDs, dates, coordinates, and semantic relations remain unknown until explicitly authored.",
    "- Faceted discovery and AI context packets are generated convenience derivatives: result classes remain structural, excerpts are mechanical source projections, and packet fields never outrank cited source authority.\\n- Curated tours are editorial stable-ID navigation only; browser-local bookmarks, recent/history, progress, and user-named collections are not published, are not canon evidence, and private local text is not serialized into public URLs.\\n- Missing event IDs, WorldsVault IDs, dates, coordinates, and semantic relations remain unknown until explicitly authored.",
)

# Machine publication schema endpoints.
schema_path = ROOT / "src/schema/machine-publication-index.schema.json"
schema = json.loads(schema_path.read_text(encoding="utf-8"))
required = schema["properties"]["endpoints"]["required"]
for name in ("tours", "tour_index"):
    if name not in required:
        required.append(name)
    schema["properties"]["endpoints"]["properties"][name] = {"type": "string", "format": "uri"}
schema_path.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("patched src/schema/machine-publication-index.schema.json")

# Conservative discovery links from existing human surfaces.
replace_once(
    "src/templates/entity.html.j2",
    '    <a href="{% if mode == \'record\' %}../../canon/{% else %}../canon/{% endif %}">Canon Inspector</a>\n  </nav>',
    '    <a href="{% if mode == \'record\' %}../../canon/{% else %}../canon/{% endif %}">Canon Inspector</a>\n    <a href="{% if mode == \'record\' %}../../tours/#record-{{ record.stable_id|e }}{% else %}../tours/{% endif %}">Tours & local library</a>\n  </nav>',
)
replace_once(
    "src/templates/entity.html.j2",
    '<div class="entity-actions" aria-label="Related publication"><a href="../objects/">Browse museum objects</a><a href="../relationships/">Relationship observatory</a><a href="../canon/">Canon Inspector</a><a href="../discover/">Discover</a></div>',
    '<div class="entity-actions" aria-label="Related publication"><a href="../objects/">Browse museum objects</a><a href="../relationships/">Relationship observatory</a><a href="../canon/">Canon Inspector</a><a href="../discover/">Discover</a><a href="../tours/">Tours & local library</a></div>',
)
replace_once(
    "src/templates/discovery.html.j2",
    '    <a href="../canon/">Canon Inspector</a>\n    <a href="discovery.json">JSON</a>',
    '    <a href="../canon/">Canon Inspector</a>\n    <a href="../tours/">Tours & local library</a>\n    <a href="discovery.json">JSON</a>',
)
replace_once(
    "src/templates/discovery.html.j2",
    '            <a href="packets/{{ item.stable_id }}.json">AI context packet</a>\n            <a href="{{ item.legacy_url }}">Complete Compendium</a>',
    '            <a href="packets/{{ item.stable_id }}.json">AI context packet</a>\n            <a href="../tours/#record-{{ item.stable_id }}">Local library</a>\n            <a href="{{ item.legacy_url }}">Complete Compendium</a>',
)

# Existing machine-publication finite-set expectations expand with Phase 8.
replace_once(
    "tests/test_machine_publication.py",
    '    "context-packet-index.schema.json",\n}',
    '    "context-packet-index.schema.json",\n    "tour-index.schema.json",\n}',
)
replace_once(
    "tests/test_machine_publication.py",
    '        "discover/AUTHORITY.md",\n    } | {f"machine/schema/v1/{name}" for name in SCHEMAS}',
    '        "discover/AUTHORITY.md",\n        "tours/",\n        "tours/tours.json",\n        "tours/schema.json",\n        "tours/AUTHORITY.md",\n    } | {f"machine/schema/v1/{name}" for name in SCHEMAS}',
)
replace_once(
    "tests/test_machine_publication.py",
    '    assert "not complete canon" in llms.lower()\n',
    '    assert "not complete canon" in llms.lower()\n    assert SITE_BASE + "tours/" in llms\n    assert SITE_BASE + "tours/tours.json" in llms\n    assert "browser-local" in llms\n',
)

# Representative cross-browser local-state journey.
with (ROOT / "tests/test_cross_browser.py").open("a", encoding="utf-8") as handle:
    handle.write(r'''


def test_curated_tours_local_library_journey(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/tours/#tour-principal-characters")
    page.evaluate("localStorage.clear()")
    page.reload()
    expect(page.locator("#tour-principal-characters")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#libraryRecord").select_option("codec")
    page.locator("#bookmarkSelected").click()
    expect(page.locator("#bookmarksList")).to_contain_text("Codec")
    page.reload()
    expect(page.locator("#bookmarksList")).to_contain_text("Codec")
''')
print("patched tests/test_cross_browser.py")
