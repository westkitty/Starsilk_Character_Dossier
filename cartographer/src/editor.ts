import { ProjectStore, childrenOf, getEntity, type Entity, type HistoricalTime, type StarMapProject } from "./core.js";
import { CartographerRenderer, type ViewScale } from "./renderer.js";
import { eventsForScope, historicalOrder, historicalTimeLabel, resolveHistoricalTime, returnToParentTime, setHistoricalOverride } from "./timeline.js";

export class CartographerEditor {
  private root: HTMLElement;
  private store: ProjectStore;
  private renderer: CartographerRenderer;
  private treeHost: HTMLElement;
  private inspectorHost: HTMLElement;
  private breadcrumbHost: HTMLElement;
  private historyHost: HTMLElement;
  private view: { scale: ViewScale; id: string | null } = { scale: "galaxy", id: null };

  constructor(root: HTMLElement, project: StarMapProject) {
    this.root = root;
    this.store = new ProjectStore(project);
    root.innerHTML = `<div class="cartographer-shell">
      <header class="topbar"><div><span class="eyebrow">ADMINISTRATION CARTOGRAPHIC ARCHIVE</span><strong>STARSiLK TEMPORAL CARTOGRAPHER</strong></div><div class="top-actions"><span class="status-chip">TEMPORAL CARTOGRAPHY ACTIVE</span><button data-action="reset-camera">RESET CAMERA</button></div></header>
      <nav class="breadcrumbs" aria-label="Map hierarchy"></nav>
      <aside class="hierarchy-panel" aria-label="Hierarchy"><div class="panel-title">HIERARCHY</div><div class="tree" role="tree"></div></aside>
      <section class="viewport-panel" aria-label="3D cartographic view"><div class="space" id="cartographer-space"></div></section>
      <aside class="inspector-panel" aria-label="Selection inspector"><div class="panel-title">INSPECTOR</div><div class="inspector-content"></div></aside>
      <section class="history-rail" aria-label="Historical time controls"></section>
      <section class="simulation-rail" aria-label="Orbital simulation controls">
        <span class="rail-label">ORBITAL SIMULATION</span><button data-action="play">PAUSE</button>
        <label>SPEED <select data-setting="speed"><option value="0.1">0.1×</option><option value="1" selected>1×</option><option value="10">10×</option><option value="100">100×</option></select></label>
        <label><input type="checkbox" data-setting="labels" checked /> LABELS</label><label><input type="checkbox" data-setting="paths" checked /> ORBIT PATHS</label><label><input type="checkbox" data-setting="trails" /> TRAILS</label>
        <label><input type="checkbox" data-setting="analyst" /> ANALYST OVERLAY</label>
        <button data-action="focus">FOCUS SELECTED</button><button data-action="open">OPEN SELECTED</button><button data-action="up">UP</button>
      </section></div>`;
    this.treeHost = root.querySelector(".tree")!;
    this.inspectorHost = root.querySelector(".inspector-content")!;
    this.breadcrumbHost = root.querySelector(".breadcrumbs")!;
    this.historyHost = root.querySelector(".history-rail")!;
    const space = root.querySelector<HTMLElement>("#cartographer-space")!;
    this.renderer = new CartographerRenderer(space, this.store.project, { onSelect: (id) => this.store.select(id), onActivate: (id) => { this.store.select(id); this.openSelected(); } });
    this.store.addEventListener("selection", () => this.renderSelection());
    this.store.addEventListener("change", () => { this.renderer.setProject(this.store.project); this.renderTree(); this.renderSelection(); });
    root.addEventListener("click", this.onClick);
    root.addEventListener("change", this.onChange);
    root.addEventListener("input", this.onInput);
    root.addEventListener("keydown", this.onKeydown);
    this.renderTree();
    this.renderSelection();
  }

  destroy(): void {
    this.renderer.destroy();
    this.root.removeEventListener("click", this.onClick);
    this.root.removeEventListener("change", this.onChange);
    this.root.removeEventListener("input", this.onInput);
    this.root.removeEventListener("keydown", this.onKeydown);
  }

  private renderTree(): void {
    const rootEntity = this.store.project.entities.find((entity) => entity.type === "galaxy");
    if (rootEntity) this.treeHost.innerHTML = this.treeBranch(rootEntity);
  }

  private treeBranch(entity: Entity, depth = 0): string {
    const children = childrenOf(this.store.project, entity.id);
    const icon = entity.type === "star" ? "★" : entity.type === "planet" ? "●" : entity.type === "moon" ? "·" : entity.type === "bloodRing" ? "◉" : entity.type === "system" ? "✦" : entity.type === "largeScaleStructure" ? "▰" : "◇";
    const resolved = resolveHistoricalTime(this.store.project, entity.id);
    return `<div class="tree-row ${entity.id === this.store.selectedId ? "selected" : ""}" style="--depth:${depth}"><button role="treeitem" aria-selected="${entity.id === this.store.selectedId}" data-select="${entity.id}">${icon} ${escapeHtml(entity.name)} <small>${entity.time.mode === "override" ? "OVERRIDE" : resolved.inherited ? "INHERITED" : ""}</small></button></div>${children.map((child) => this.treeBranch(child, depth + 1)).join("")}`;
  }

  private renderSelection(): void {
    const entity = getEntity(this.store.project, this.store.selectedId);
    if (!entity) return;
    const time = resolveHistoricalTime(this.store.project, entity.id);
    this.renderer.setSelection(entity.id);
    this.inspectorHost.innerHTML = `<dl class="meta-list"><div><dt>NAME</dt><dd>${escapeHtml(entity.name)}</dd></div><div><dt>TYPE</dt><dd>${entity.type}</dd></div><div><dt>CANON</dt><dd>${entity.meta.canonStatus.toUpperCase()}</dd></div><div><dt>POSITION</dt><dd>${entity.meta.positionStatus === "schematic" ? "SCHEMATIC / NON-CANON POSITION" : entity.meta.positionStatus ?? "UNKNOWN"}</dd></div><div><dt>RESOLVED ERA</dt><dd>${escapeHtml(historicalTimeLabel(time.value))}</dd></div></dl><p>${escapeHtml(entity.meta.sourceNote ?? entity.meta.description ?? "No source note supplied.")}</p>`;
    this.renderHistory(entity);
    this.renderBreadcrumbs();
  }

  private renderHistory(entity: Entity): void {
    const resolved = resolveHistoricalTime(this.store.project, entity.id);
    const source = getEntity(this.store.project, resolved.sourceId);
    const events = eventsForScope(this.store.project, entity.id);
    const numeric = historicalOrder(resolved.value);
    const railValue = numeric !== null && numeric >= 0 && numeric <= 170 ? numeric : 170;
    const presetOptions = this.store.project.eraPresets.map((preset) => `<option value="${escapeAttr(preset.id)}" ${preset.value === resolved.value ? "selected" : ""}>${escapeHtml(preset.label)}</option>`).join("");
    const markers = events.length ? events.map((event, index) => `<button class="event-marker" data-event-index="${index}" title="${escapeAttr(event.sourceNote ?? event.label)}">${escapeHtml(event.label)} · ${escapeHtml(historicalTimeLabel(event.time))}</button>`).join("") : `<span class="no-events">NO LOCAL EVENT MARKERS</span>`;
    this.historyHost.innerHTML = `<div class="history-summary"><span class="rail-label">HISTORICAL / ERA TIME</span><strong>${escapeHtml(historicalTimeLabel(resolved.value))}</strong><span>${escapeHtml(entity.type.toUpperCase())} // ${escapeHtml(entity.name)}</span><span class="time-mode ${entity.time.mode}">${entity.time.mode === "override" ? "OVERRIDE" : "INHERITED"}</span><span>FROM ${escapeHtml(source?.name ?? "UNKNOWN")}</span></div>
      <div class="history-controls"><label>PRESET <select data-history="preset">${presetOptions}</select></label><label>WAR-YEAR SCRUBBER <input type="range" min="0" max="170" step="1" value="${railValue}" data-history="scrub" /></label><label>EXACT / CUSTOM <input type="text" value="${escapeAttr(String(resolved.value))}" data-history="exact" /></label><button data-action="apply-exact">APPLY</button><button data-action="previous-event">PREVIOUS EVENT</button><button data-action="next-event">NEXT EVENT</button><button data-action="return-parent" ${entity.parentId === null ? "disabled" : ""}>RETURN TO PARENT TIME</button></div>
      <div class="event-markers" aria-label="Event markers">${markers}</div>`;
  }

  private renderBreadcrumbs(): void {
    const selected = getEntity(this.store.project, this.view.id);
    const galaxy = this.store.project.entities.find((entity) => entity.type === "galaxy");
    const parts = [galaxy?.name ?? "GALAXY"];
    if (selected && selected.type !== "galaxy") parts.push(selected.name);
    this.breadcrumbHost.innerHTML = parts.map((part) => `<span>${escapeHtml(part)}</span>`).join("<span aria-hidden='true'>›</span>");
  }

  private openSelected(): void {
    const entity = getEntity(this.store.project, this.store.selectedId);
    if (!entity) return;
    if (entity.type === "galaxy") this.setView("galaxy", null);
    else if (entity.type === "starfield") this.setView("sector", entity.id);
    else if (entity.type === "system") this.setView("system", entity.id);
    else if (entity.parentId) {
      const parent = getEntity(this.store.project, entity.parentId);
      if (parent?.type === "system") this.setView("system", parent.id);
      else if (parent?.parentId && getEntity(this.store.project, parent.parentId)?.type === "system") this.setView("system", parent.parentId);
    }
  }

  private setView(scale: ViewScale, id: string | null): void { this.view = { scale, id }; this.renderer.setView(scale, id); this.renderBreadcrumbs(); }
  private goUp(): void { if (this.view.scale === "galaxy") return; const current = getEntity(this.store.project, this.view.id); if (this.view.scale === "system" && current?.parentId) this.setView("sector", current.parentId); else this.setView("galaxy", null); }

  private setSelectedTime(value: HistoricalTime, label: string): void {
    const id = this.store.selectedId;
    this.store.mutate(label, (project) => setHistoricalOverride(project, id, value));
  }

  private jumpEvent(direction: -1 | 1): void {
    const events = eventsForScope(this.store.project, this.store.selectedId);
    if (!events.length) return;
    const current = historicalOrder(resolveHistoricalTime(this.store.project, this.store.selectedId).value) ?? -Infinity;
    const ordered = events.map((event) => ({ event, order: historicalOrder(event.time) })).filter((item) => item.order !== null) as { event: (typeof events)[number]; order: number }[];
    if (!ordered.length) return;
    const target = direction > 0 ? ordered.find((item) => item.order > current) ?? ordered[ordered.length - 1] : [...ordered].reverse().find((item) => item.order < current) ?? ordered[0];
    if (target) this.setSelectedTime(target.event.time, `jump to ${target.event.label}`);
  }

  private onClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const select = target.closest<HTMLElement>("[data-select]");
    if (select?.dataset.select) { this.store.select(select.dataset.select); return; }
    const eventIndex = target.closest<HTMLElement>("[data-event-index]")?.dataset.eventIndex;
    if (eventIndex !== undefined) { const timelineEvent = eventsForScope(this.store.project, this.store.selectedId)[Number(eventIndex)]; if (timelineEvent) this.setSelectedTime(timelineEvent.time, `jump to ${timelineEvent.label}`); return; }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "play") { this.store.mutate("toggle simulation", (project) => { project.settings.simulation.running = !project.settings.simulation.running; }); target.textContent = this.store.project.settings.simulation.running ? "PAUSE" : "PLAY"; }
    else if (action === "focus") this.renderer.focusSelected();
    else if (action === "open") this.openSelected();
    else if (action === "up") this.goUp();
    else if (action === "reset-camera") this.renderer.resetCamera();
    else if (action === "return-parent") this.store.mutate("return to parent time", (project) => returnToParentTime(project, this.store.selectedId));
    else if (action === "previous-event") this.jumpEvent(-1);
    else if (action === "next-event") this.jumpEvent(1);
    else if (action === "apply-exact") { const input = this.root.querySelector<HTMLInputElement>("[data-history='exact']"); if (input) this.setSelectedTime(parseHistoricalValue(input.value), "set exact historical time"); }
  };

  private onChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const setting = target.dataset.setting;
    if (setting) {
      this.store.mutate(`set ${setting}`, (project) => {
        if (setting === "speed") project.settings.simulation.speed = Number(target.value);
        if (setting === "labels") project.settings.view.labels = (target as HTMLInputElement).checked;
        if (setting === "paths") project.settings.view.orbitPaths = (target as HTMLInputElement).checked;
        if (setting === "trails") project.settings.view.trails = (target as HTMLInputElement).checked;
        if (setting === "analyst") project.settings.view.analystOverlay = (target as HTMLInputElement).checked;
      });
      return;
    }
    if (target.dataset.history === "preset") {
      const preset = this.store.project.eraPresets.find((candidate) => candidate.id === target.value);
      if (preset && preset.id !== "custom") this.setSelectedTime(preset.value, `set era ${preset.label}`);
    }
  };

  private onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.history === "scrub") this.setSelectedTime(Number(target.value), "scrub historical time");
  };

  private onKeydown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === "Space") { event.preventDefault(); this.root.querySelector<HTMLElement>("[data-action='play']")?.click(); }
    if (event.key.toLowerCase() === "f") this.renderer.focusSelected();
    if (event.key.toLowerCase() === "l") this.toggleCheckbox("labels");
    if (event.key.toLowerCase() === "t") this.toggleCheckbox("trails");
  };

  private toggleCheckbox(setting: string): void { const input = this.root.querySelector<HTMLInputElement>(`input[data-setting='${setting}']`); if (!input) return; input.checked = !input.checked; input.dispatchEvent(new Event("change", { bubbles: true })); }
}

function parseHistoricalValue(value: string): HistoricalTime { const trimmed = value.trim(); return /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed || "CUSTOM"; }
function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char); }
function escapeAttr(value: string): string { return escapeHtml(value).replace(/`/g, "&#96;"); }
