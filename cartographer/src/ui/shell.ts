import css from "../styles/cartographer.css?inline";
import type { EditorStore } from "../store/editor-store.ts";
import type { Entity, EntityType, HistoricalTimeValue } from "../model/types.ts";
import { CANON_LABEL, ENTITY_TYPE_LABEL } from "../model/types.ts";
import { childrenOf, entityMap } from "../model/validate.ts";
import { resolveHistoricalTime } from "../model/resolve-time.ts";
import { resolveHistoricalView } from "../model/resolve-state.ts";
import { formatHistoricalTime, parseHistoricalTime } from "../model/time.ts";
import { downloadJson, serializeProject, SchemaError } from "../persist/import-export.ts";
import { MapRenderer } from "../render/renderer.ts";
import { TYPE_MARK } from "./icons.ts";

export interface ShellHandle {
  destroy(): void;
  store: EditorStore;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) continue;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

export function mountEditor(root: HTMLElement, store: EditorStore): ShellHandle {
  const wrap = el("div", { class: `silk-root ${store.state.mode}` });
  const shadowHost = root;
  const shadow = shadowHost.shadowRoot ?? shadowHost.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = css;
  shadow.replaceChildren(style, wrap);

  const top = el("header", { class: "topbar" });
  const tree = el("aside", { class: "tree", id: "hierarchy" });
  const stage = el("section", { class: "stage" });
  const inspect = el("aside", { class: "inspect", id: "inspector" });
  const rail = el("section", { class: "rail" });
  const sim = el("footer", { class: "sim" });
  const scrim = el("div", { class: "mobile-scrim" });
  const dialog = el("div", { class: "dialog", hidden: "", role: "dialog", "aria-modal": "true", "aria-labelledby": "dlg-title" });
  wrap.append(top, tree, stage, inspect, rail, sim, scrim, dialog);

  const brand = el("div", { class: "brand" }, [
    el("b", {}, ["STARSiLK"]),
    el("span", {}, ["Temporal Cartographer"]),
  ]);
  const crumbs = el("nav", { class: "crumbs", "aria-label": "View breadcrumb" });
  const actions = el("div", { class: "top-actions" });
  const saveInd = el("div", { class: "save-ind", "aria-live": "polite" }, ["SAVED"]);
  const btn = (label: string, cls = "btn", extra: Record<string, string> = {}) =>
    el("button", { class: cls, type: "button", ...extra }, [label]);

  const hierBtn = btn("Hierarchy", "btn drawer-toggle");
  const inspBtn = btn("Inspector", "btn drawer-toggle");
  hierBtn.addEventListener("click", () => store.toggleDrawer("hierarchy"));
  inspBtn.addEventListener("click", () => store.toggleDrawer("inspector"));
  scrim.addEventListener("click", () => store.closeDrawers());

  const exportBtn = btn("Export", "btn ed-only");
  const importBtn = btn("Import", "btn ed-only");
  const importInput = el("input", { type: "file", accept: "application/json", class: "visually-hidden" });
  const resetBtn = btn("Demo", "btn ed-only");
  const upBtn = btn("Up");
  const focusBtn = btn("Focus");
  exportBtn.addEventListener("click", () => {
    downloadJson("starsilk-map.json", serializeProject(store.state.project));
  });
  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;
    try {
      store.importJson(await file.text());
    } catch (err) {
      store.setError(err instanceof SchemaError ? err.message : "Import failed.");
    }
  });
  resetBtn.addEventListener("click", () => store.resetDemo());
  upBtn.addEventListener("click", () => store.goUp());
  focusBtn.addEventListener("click", () => {
    if (store.state.selectionId) renderer.focusEntity(store.state.selectionId);
  });

  actions.append(hierBtn, inspBtn, saveInd, upBtn, focusBtn, exportBtn, importBtn, importInput, resetBtn);
  top.append(brand, crumbs, actions);

  const treeHead = el("div", { class: "pane-h" }, ["Hierarchy"]);
  const treeSearch = el("input", { class: "search", type: "search", placeholder: "Search archive", "aria-label": "Search hierarchy" });
  const treeTools = el("div", { class: "pane-h ed-only" });
  const treeBody = el("div", { class: "pane-body tree-list", role: "tree", "aria-label": "Entity hierarchy" });
  tree.append(treeHead, el("div", { style: "padding:8px" }, [treeSearch]), treeTools, treeBody);

  const addTypes: EntityType[] = ["starfield", "system", "star", "planet", "moon", "bloodRing", "orbitalStructure"];
  for (const t of addTypes) {
    const b = btn(`+ ${ENTITY_TYPE_LABEL[t].split(" ")[0]}`, "btn");
    b.addEventListener("click", () => store.addChild(t));
    treeTools.append(b);
  }
  const dupBtn = btn("Duplicate", "btn");
  const delBtn = btn("Delete", "btn danger");
  dupBtn.addEventListener("click", () => store.duplicateSelected());
  delBtn.addEventListener("click", () => {
    if (store.state.selectionId) store.requestDelete(store.state.selectionId);
  });
  treeTools.append(dupBtn, delBtn);

  const hud = el("div", { class: "stage-hud" });
  const readout = el("div", { class: "selection-readout", "aria-live": "polite" });
  const labels = el("div", { class: "label-layer" });
  stage.append(hud, labels, readout);

  const inspectHead = el("div", { class: "pane-h" }, ["Inspector"]);
  const inspectBody = el("div", { class: "pane-body" });
  inspect.append(inspectHead, inspectBody);

  const railMeta = el("div", { class: "rail-meta" });
  const trackWrap = el("div", { class: "time-track" });
  const timeRange = el("input", {
    type: "range",
    min: "-20",
    max: "200",
    step: "1",
    "aria-label": "Historical time scrubber",
  });
  const markers = el("div", { class: "markers" });
  trackWrap.append(markers, timeRange);
  const presets = el("div", { class: "presets" });
  rail.append(railMeta, trackWrap, presets);

  const simLeft = el("div", { class: "group" });
  const playBtn = btn("Pause", "btn");
  playBtn.addEventListener("click", () => store.setPaused(!store.state.project.settings.orbitalPaused));
  simLeft.append(el("span", { class: "label" }, ["Orbital"]), playBtn);
  for (const sp of [0.1, 1, 10, 100]) {
    const b = btn(`${sp}×`, "btn");
    b.addEventListener("click", () => store.setSpeed(sp));
    simLeft.append(b);
  }
  const simToggles = el("div", { class: "group" });
  const tog = (key: "labels" | "orbitPaths" | "trails" | "analystOverlay" | "canonOnly" | "annotations" | "referenceGrid", label: string) => {
    const b = btn(label, "btn");
    b.addEventListener("click", () => store.toggleSetting(key));
    simToggles.append(b);
    return b;
  };
  const labelBtn = tog("labels", "Labels");
  const pathBtn = tog("orbitPaths", "Paths");
  const trailBtn = tog("trails", "Trails");
  const gridBtn = tog("referenceGrid", "Grid");
  const analystBtn = tog("analystOverlay", "Analyst overlay");
  const canonBtn = tog("canonOnly", "Canon only");
  sim.append(simLeft, simToggles);

  const renderer = new MapRenderer(stage, labels, store);

  treeSearch.addEventListener("input", () => renderTree());
  timeRange.addEventListener("input", () => {
    const v = Number(timeRange.value);
    store.setGalaxyTime(v);
  });

  function renderChrome() {
    wrap.classList.toggle("hierarchy-open", store.state.drawers.hierarchy);
    wrap.classList.toggle("inspector-open", store.state.drawers.inspector);
    wrap.classList.toggle("viewer", store.state.mode === "viewer");
    saveInd.textContent = store.state.saveStatus === "saved" ? "SAVED" : store.state.saveStatus === "saving" ? "SAVING…" : "UNSAVED";
    saveInd.className = `save-ind ${store.state.saveStatus}`;
    playBtn.textContent = store.state.project.settings.orbitalPaused ? "Play" : "Pause";
    const setActive = (b: HTMLButtonElement, on: boolean) => b.classList.toggle("active", on);
    const s = store.state.project.settings;
    setActive(labelBtn, s.labels);
    setActive(pathBtn, s.orbitPaths);
    setActive(trailBtn, s.trails);
    setActive(gridBtn, s.referenceGrid);
    setActive(analystBtn, s.analystOverlay);
    setActive(canonBtn, s.canonOnly);
    for (const b of simLeft.querySelectorAll("button")) {
      if (b === playBtn) continue;
      const sp = Number(b.textContent?.replace("×", ""));
      b.classList.toggle("active", sp === s.orbitalSpeed);
    }
    renderCrumbs();
    renderHud();
    renderDialog();
    if (store.state.errorMessage) {
      let toast = wrap.querySelector(".toast") as HTMLElement | null;
      if (!toast) {
        toast = el("div", { class: "toast", role: "alert" });
        wrap.append(toast);
      }
      toast.textContent = store.state.errorMessage;
    } else {
      wrap.querySelector(".toast")?.remove();
    }
  }

  function renderCrumbs() {
    crumbs.replaceChildren();
    const map = entityMap(store.state.project);
    const chain: Entity[] = [];
    let id: string | null | undefined = store.state.focusId;
    while (id) {
      const n = map.get(id);
      if (!n) break;
      chain.unshift(n);
      id = n.parentId;
    }
    chain.forEach((n, i) => {
      if (i) crumbs.append(document.createTextNode(" / "));
      const b = el("button", { type: "button" }, [n.name]);
      b.addEventListener("click", () => store.drillInto(n));
      crumbs.append(b);
    });
  }

  function renderHud() {
    const sel = store.selected();
    const scale = store.state.viewScale.toUpperCase();
    hud.replaceChildren(
      el("div", {}, [`View · ${scale}`]),
      el("div", { class: "warn-pos" }, ["SCHEMATIC / NON-CANON POSITION"]),
    );
    if (!sel) {
      readout.textContent = "Nothing selected. Use the hierarchy or click a body.";
      return;
    }
    const time = resolveHistoricalTime(store.state.project, sel.id);
    const view = resolveHistoricalView(store.state.project, sel);
    const stage =
      store.state.project.settings.annotations && view.annotations.length
        ? ` · ${view.annotations[view.annotations.length - 1]}`
        : "";
    readout.textContent = `${ENTITY_TYPE_LABEL[view.type]} · ${view.name} · ${formatHistoricalTime(time.value)}${stage}${view.destroyed ? " · HISTORICALLY DESTROYED" : ""}${view.collapsed ? " · COLLAPSED" : ""} · ${time.mode === "override" ? "OVERRIDE" : "INHERITED"} · ${CANON_LABEL[sel.meta.canonStatus]}`;
  }

  const collapsed = new Set<string>();

  function renderTree() {
    const q = treeSearch.value.trim().toLowerCase();
    const project = store.state.project;
    const roots = childrenOf(project, null).length
      ? childrenOf(project, null)
      : project.entities.filter((e) => !e.parentId);
    treeBody.replaceChildren();
    const walk = (entity: Entity, depth: number) => {
      if (q && !entity.name.toLowerCase().includes(q) && !entity.type.includes(q)) {
        for (const c of childrenOf(project, entity.id)) walk(c, depth + 1);
        return;
      }
      const kids = childrenOf(project, entity.id);
      const row = el("div", { class: "tree-row", style: `padding-left:${depth * 12}px` });
      if (kids.length) {
        const tw = el("button", { class: "tree-twisty", type: "button", "aria-label": collapsed.has(entity.id) ? "Expand" : "Collapse" }, [
          collapsed.has(entity.id) ? "▸" : "▾",
        ]);
        tw.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (collapsed.has(entity.id)) collapsed.delete(entity.id);
          else collapsed.add(entity.id);
          renderTree();
        });
        row.append(tw);
      } else {
        row.append(el("span", { style: "width:28px;flex:0 0 28px" }));
      }
      const view = resolveHistoricalView(project, entity);
      const item = el("button", {
        class: `tree-item${store.state.selectionId === entity.id ? " selected" : ""}${entity.type === "bloodRing" ? " blood" : ""}${view.type === "blackHole" ? " hole" : ""}`,
        type: "button",
        role: "treeitem",
        "aria-selected": store.state.selectionId === entity.id ? "true" : "false",
      });
      item.append(
        el("span", { class: "mark" }, [TYPE_MARK[view.type] ?? "·"]),
        document.createTextNode(view.name),
      );
      if (entity.meta.positionCanon === "schematic" || entity.meta.canonStatus === "schematic") {
        item.append(el("span", { class: "schematic-tag" }, ["SCH"]));
      }
      item.addEventListener("click", () => {
        store.select(entity.id);
        store.drillInto(entity);
      });
      row.append(item);
      treeBody.append(row);
      if (!collapsed.has(entity.id)) for (const c of kids) walk(c, depth + 1);
    };
    for (const r of roots) walk(r, 0);
  }

  function field(label: string, control: HTMLElement) {
    const f = el("div", { class: "field" });
    const lab = el("label", {}, [label]);
    const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
    control.id = id;
    lab.setAttribute("for", id);
    f.append(lab, control);
    return f;
  }

  function renderInspector() {
    const entity = store.selected();
    inspectBody.replaceChildren();
    if (!entity) {
      inspectBody.append(el("p", { class: "meta-line", style: "padding:12px" }, ["Select an object to inspect."]));
      return;
    }
    const time = resolveHistoricalTime(store.state.project, entity.id);
    const view = resolveHistoricalView(store.state.project, entity);
    const identity = el("section", { class: "inspect-section" });
    identity.append(el("h3", {}, ["Identity"]));
    const nameIn = el("input", { value: entity.name });
    nameIn.addEventListener("change", () => store.renameSelected(nameIn.value));
    identity.append(field("Name", nameIn));
    identity.append(el("div", { class: "meta-line" }, [`Type · ${ENTITY_TYPE_LABEL[view.type]}`]));
    const parent = entityMap(store.state.project).get(entity.parentId ?? "");
    identity.append(el("div", { class: "meta-line" }, [`Parent · ${parent?.name ?? "—"}`]));
    const desc = el("textarea", {}, []);
    desc.value = entity.meta.description ?? "";
    desc.addEventListener("change", () =>
      store.updateSelected((e) => ({ ...e, meta: { ...e.meta, description: desc.value } })),
    );
    identity.append(field("Description", desc));
    const tags = el("input", { value: (entity.meta.tags ?? []).join(", ") });
    tags.addEventListener("change", () =>
      store.updateSelected((e) => ({
        ...e,
        meta: { ...e.meta, tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean) },
      })),
    );
    identity.append(field("Tags", tags));

    const canon = el("section", { class: "inspect-section" });
    canon.append(el("h3", {}, ["Canon"]));
    const status = el("select");
    for (const k of Object.keys(CANON_LABEL) as (keyof typeof CANON_LABEL)[]) {
      const opt = el("option", { value: k }, [CANON_LABEL[k]]);
      if (entity.meta.canonStatus === k) opt.selected = true;
      status.append(opt);
    }
    status.addEventListener("change", () =>
      store.updateSelected((e) => ({
        ...e,
        meta: { ...e.meta, canonStatus: status.value as Entity["meta"]["canonStatus"] },
      })),
    );
    canon.append(field("Status", status));
    const src = el("textarea");
    src.value = entity.meta.sourceNote ?? "";
    src.addEventListener("change", () =>
      store.updateSelected((e) => ({ ...e, meta: { ...e.meta, sourceNote: src.value } })),
    );
    canon.append(field("Source note", src));
    const href = el("input", { value: entity.meta.sourceHref ?? "" });
    href.addEventListener("change", () =>
      store.updateSelected((e) => ({ ...e, meta: { ...e.meta, sourceHref: href.value } })),
    );
    canon.append(field("Source URL", href));
    const dos = el("input", { value: entity.meta.dossierHref ?? "" });
    dos.addEventListener("change", () =>
      store.updateSelected((e) => ({ ...e, meta: { ...e.meta, dossierHref: dos.value } })),
    );
    canon.append(field("Dossier href", dos));
    if (entity.meta.positionCanon === "schematic" || entity.position) {
      canon.append(el("div", { class: "badge schematic" }, ["SCHEMATIC / NON-CANON POSITION"]));
    }

    const orbitSec = el("section", { class: "inspect-section" });
    orbitSec.append(el("h3", {}, ["Orbit"]));
    if (entity.orbit) {
      const num = (key: keyof NonNullable<Entity["orbit"]>, label: string, scale = 1) => {
        const inp = el("input", { type: "number", step: "0.01", value: String((entity.orbit![key] as number) * scale) });
        inp.addEventListener("change", () => {
          const v = Number(inp.value) / scale;
          store.updateSelected((e) => ({ ...e, orbit: { ...e.orbit!, [key]: v } }));
        });
        orbitSec.append(field(label, inp));
      };
      num("semiMajorAxis", "Radius / SMA");
      num("period", "Period");
      num("inclination", "Inclination (deg)", 180 / Math.PI);
      num("eccentricity", "Eccentricity");
      num("ascendingNode", "Ascending node (deg)", 180 / Math.PI);
      num("argumentOfPeriapsis", "Arg. periapsis (deg)", 180 / Math.PI);
      num("meanAnomalyAtEpoch", "Mean anomaly (deg)", 180 / Math.PI);
    } else if (entity.position) {
      for (const k of ["x", "y", "z"] as const) {
        const inp = el("input", { type: "number", step: "0.1", value: String(entity.position![k]) });
        inp.addEventListener("change", () => {
          const v = Number(inp.value);
          store.updateSelected((e) => ({ ...e, position: { ...e.position!, [k]: v } }));
        });
        orbitSec.append(field(k.toUpperCase(), inp));
      }
    } else {
      orbitSec.append(el("div", { class: "meta-line" }, ["No orbit on this body."]));
    }

    const vis = el("section", { class: "inspect-section" });
    vis.append(el("h3", {}, ["Visual"]));
    const col = el("input", { type: "color", value: normalizeHex(entity.visual?.color ?? "#c9d5df") });
    col.addEventListener("change", () =>
      store.updateSelected((e) => ({ ...e, visual: { ...(e.visual ?? { displayRadius: 1, color: col.value }), color: col.value } })),
    );
    vis.append(field("Color", col));
    const rad = el("input", { type: "number", step: "0.05", value: String(entity.visual?.displayRadius ?? 1) });
    rad.addEventListener("change", () =>
      store.updateSelected((e) => ({
        ...e,
        visual: { ...(e.visual ?? { displayRadius: 1, color: "#c9d5df" }), displayRadius: Number(rad.value) },
      })),
    );
    vis.append(field("Display radius", rad));

    const tl = el("section", { class: "inspect-section" });
    tl.append(el("h3", {}, ["Timeline"]));
    tl.append(
      el("div", { class: "meta-line" }, [
        `Resolved · ${formatHistoricalTime(time.value)}`,
      ]),
    );
    const badge = el("span", { class: `badge ${time.mode}` }, [time.mode === "override" ? "OVERRIDE" : "INHERITED"]);
    tl.append(badge);
    const ovIn = el("input", { placeholder: "Year or sentinel", value: String(time.value) });
    const ovBtn = btn("Override at this era", "btn");
    ovBtn.addEventListener("click", () => {
      const parsed = parseHistoricalTime(ovIn.value) ?? Number(ovIn.value);
      if (parsed === null || (typeof parsed === "number" && Number.isNaN(parsed))) {
        store.setError("Could not parse historical time.");
        return;
      }
      store.overrideSelected(parsed as HistoricalTimeValue);
    });
    const retBtn = btn("Return to parent time", "btn");
    retBtn.addEventListener("click", () => store.returnToParentTime());
    tl.append(field("Override value", ovIn), ovBtn, retBtn);
    const list = el("div", { class: "event-list" });
    for (const ev of entity.timeline) {
      const row = el("button", { class: "event-row", type: "button" });
      row.append(el("b", {}, [ev.label]), el("span", {}, [`${formatHistoricalTime(ev.time)} · ${ev.eventType}`]));
      row.addEventListener("click", () => store.setGalaxyTime(ev.time));
      list.append(row);
    }
    tl.append(list);
    if (store.state.mode === "editor") {
      const addEv = btn("Add annotation event", "btn");
      addEv.addEventListener("click", () => {
        store.updateSelected((e) => ({
          ...e,
          timeline: [
            ...e.timeline,
            {
              id: `evt-${Date.now()}`,
              time: time.value,
              label: "Annotation",
              eventType: "annotation",
              canonStatus: "provisional",
            },
          ],
        }));
      });
      tl.append(addEv);
    }

    inspectBody.append(identity, orbitSec, vis, tl, canon);
  }

  function renderRail() {
    const t = store.state.project.settings.galaxyHistoricalTime;
    const numeric = typeof t === "number" ? t : t === "pre-war" ? -20 : t === "post-siege-wall" ? 171 : 200;
    timeRange.value = String(numeric);
    const sel = store.selected();
    const resolved = resolveHistoricalTime(store.state.project, sel?.id ?? null);
    railMeta.replaceChildren(
      el("span", { class: "era" }, [formatHistoricalTime(t)]),
      el("span", {}, [`Galaxy scope · ${sel ? (resolved.mode === "override" ? "OVERRIDE" : "INHERITED") : "GALAXY"}`]),
    );
    presets.replaceChildren();
    for (const p of store.state.project.eraPresets) {
      if (p.id === "custom") continue;
      const c = el("button", { class: `chip${String(p.value) === String(t) ? " active" : ""}`, type: "button" }, [p.label]);
      c.addEventListener("click", () => store.setGalaxyTime(p.value));
      presets.append(c);
    }
    markers.replaceChildren();
    const events = store.state.project.entities.flatMap((e) => e.timeline.map((ev) => ({ ev, e })));
    for (const { ev } of events) {
      if (typeof ev.time !== "number") continue;
      const pct = ((ev.time - (-20)) / (200 - (-20))) * 100;
      const m = el("div", { class: `marker${ev.eventType.includes("blood") ? " blood" : ""}${ev.eventType.includes("collapse") ? " collapse" : ""}` });
      m.style.left = `${pct}%`;
      m.title = ev.label;
      markers.append(m);
    }
  }

  function renderDialog() {
    const id = store.state.confirmDeleteId;
    if (!id) {
      dialog.hidden = true;
      dialog.replaceChildren();
      return;
    }
    const entity = store.state.project.entities.find((e) => e.id === id);
    dialog.hidden = false;
    const card = el("div", { class: "dialog-card" });
    card.append(
      el("h2", { id: "dlg-title" }, ["Delete object"]),
      el("p", {}, [`Delete ${entity?.name ?? "this object"} and its descendants? This can be undone.`]),
    );
    const actionsRow = el("div", { class: "dialog-actions" });
    const cancel = btn("Cancel", "btn");
    const ok = btn("Delete", "btn danger");
    cancel.addEventListener("click", () => store.cancelDelete());
    ok.addEventListener("click", () => store.confirmDelete());
    actionsRow.append(cancel, ok);
    card.append(actionsRow);
    dialog.replaceChildren(card);
    cancel.focus();
  }

  function renderAll() {
    renderChrome();
    renderTree();
    renderInspector();
    renderRail();
  }

  const unsub = store.subscribe(() => renderAll());
  renderAll();

  const onKey = (ev: KeyboardEvent) => {
    const t = ev.target as HTMLElement | null;
    const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
    if (ev.code === "Space" && !typing) {
      ev.preventDefault();
      store.setPaused(!store.state.project.settings.orbitalPaused);
    }
    if (ev.key === "f" && !typing) {
      if (store.state.selectionId) renderer.focusEntity(store.state.selectionId);
    }
    if (ev.key === "l" && !typing) store.toggleSetting("labels");
    if (ev.key === "t" && !typing) store.toggleSetting("trails");
    if (ev.key === "Escape") {
      store.cancelDelete();
      store.closeDrawers();
    }
    if ((ev.key === "Delete" || ev.key === "Backspace") && !typing && store.state.selectionId) {
      store.requestDelete(store.state.selectionId);
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      if (ev.shiftKey) store.redo();
      else store.undo();
    }
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "y") {
      ev.preventDefault();
      store.redo();
    }
  };
  window.addEventListener("keydown", onKey);

  return {
    store,
    destroy() {
      unsub();
      window.removeEventListener("keydown", onKey);
      renderer.dispose();
      shadow.replaceChildren();
    },
  };
}

function normalizeHex(c: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  return "#c9d5df";
}
