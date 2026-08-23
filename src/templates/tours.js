(() => {
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
})();
