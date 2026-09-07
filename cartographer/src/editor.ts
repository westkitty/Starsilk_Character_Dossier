import {
  ProjectStore,
  childrenOf,
  getEntity,
  type CanonStatus,
  type Entity,
  type EntityType,
  type HistoricalTime,
  type StarMapProject,
  type TimelineEventType
} from "./core.js";
import { allowedChildTypes, createAuthoredChild, createTimelineEvent, moveSibling } from "./authoring.js";
import { downloadProject, parseProjectJson, saveAutosave } from "./persistence.js";
import { CartographerRenderer, type ViewScale } from "./renderer.js";
import {
  eventsForScope,
  historicalOrder,
  historicalTimeLabel,
  resolveHistoricalTime,
  returnToParentTime,
  setHistoricalOverride
} from "./timeline.js";

export class CartographerEditor {
  private root: HTMLElement;
  private store: ProjectStore;
  private renderer: CartographerRenderer;
  private treeHost: HTMLElement;
  private inspectorHost: HTMLElement;
  private breadcrumbHost: HTMLElement;
  private historyHost: HTMLElement;
  private shell: HTMLElement;
  private saveStatus: HTMLElement;
  private importInput: HTMLInputElement;
  private confirmDialog: HTMLDialogElement;
  private search = "";
  private view: { scale: ViewScale; id: string | null } = { scale: "galaxy", id: null };
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveGeneration = 0;

  constructor(root: HTMLElement, project: StarMapProject) {
    this.root = root;
    this.store = new ProjectStore(project);
    root.innerHTML = `<div class="cartographer-shell">
      <header class="topbar">
        <div><span class="eyebrow">ADMINISTRATION CARTOGRAPHIC ARCHIVE</span><strong>STARSiLK TEMPORAL CARTOGRAPHER</strong></div>
        <div class="top-actions">
          <span class="save-status" aria-live="polite">SAVED</span>
          <button class="mobile-toggle" data-action="toggle-hierarchy" aria-controls="hierarchy-panel">HIERARCHY</button>
          <button class="mobile-toggle" data-action="toggle-inspector" aria-controls="inspector-panel">INSPECTOR</button>
          <button data-action="undo">UNDO</button><button data-action="redo">REDO</button>
          <button data-action="export">EXPORT JSON</button><button data-action="import">IMPORT JSON</button>
          <button data-action="reset-camera">RESET CAMERA</button>
        </div>
      </header>
      <nav class="breadcrumbs" aria-label="Map hierarchy"></nav>
      <aside id="hierarchy-panel" class="hierarchy-panel" aria-label="Hierarchy">
        <div class="panel-title">HIERARCHY</div>
        <label class="tree-search">SEARCH <input type="search" data-tree-search placeholder="Filter entities" /></label>
        <div class="hierarchy-actions">
          <select data-add-type aria-label="Child entity type"></select><button data-action="add-child">ADD</button>
          <button data-action="duplicate">DUPLICATE</button><button data-action="move-up">↑</button><button data-action="move-down">↓</button><button data-action="delete">DELETE</button>
        </div>
        <div class="tree" role="tree"></div>
      </aside>
      <section class="viewport-panel" aria-label="3D cartographic view"><div class="space" id="cartographer-space"></div><div class="selected-text" aria-live="polite"></div></section>
      <aside id="inspector-panel" class="inspector-panel" aria-label="Selection inspector"><div class="panel-title">INSPECTOR</div><div class="inspector-content"></div></aside>
      <section class="history-rail" aria-label="Historical time controls"></section>
      <section class="simulation-rail" aria-label="Orbital simulation controls">
        <span class="rail-label">ORBITAL SIMULATION</span><button data-action="play">PAUSE</button>
        <label>SPEED <select data-setting="speed"><option value="0.1">0.1×</option><option value="1" selected>1×</option><option value="10">10×</option><option value="100">100×</option></select></label>
        <label><input type="checkbox" data-setting="labels" checked /> LABELS</label><label><input type="checkbox" data-setting="paths" checked /> ORBIT PATHS</label><label><input type="checkbox" data-setting="trails" /> TRAILS</label>
        <label><input type="checkbox" data-setting="grid" /> REFERENCE GRID</label><label><input type="checkbox" data-setting="analyst" /> ANALYST OVERLAY</label><label><input type="checkbox" data-setting="canon" /> CANON ONLY</label><label><input type="checkbox" data-setting="annotations" checked /> ANNOTATIONS</label>
        <button data-action="focus">FOCUS SELECTED</button><button data-action="open">OPEN SELECTED</button><button data-action="up">UP</button>
      </section>
      <input class="visually-hidden" type="file" accept="application/json,.json" data-import-file />
      <dialog class="confirm-dialog" aria-labelledby="confirm-title"><form method="dialog"><h2 id="confirm-title">DELETE ENTITY?</h2><p data-confirm-copy></p><div><button value="cancel">CANCEL</button><button value="confirm" class="danger">DELETE</button></div></form></dialog>
    </div>`;

    this.shell = root.querySelector(".cartographer-shell")!;
    this.treeHost = root.querySelector(".tree")!;
    this.inspectorHost = root.querySelector(".inspector-content")!;
    this.breadcrumbHost = root.querySelector(".breadcrumbs")!;
    this.historyHost = root.querySelector(".history-rail")!;
    this.saveStatus = root.querySelector(".save-status")!;
    this.importInput = root.querySelector("[data-import-file]")!;
    this.confirmDialog = root.querySelector(".confirm-dialog")!;
    const space = root.querySelector<HTMLElement>("#cartographer-space")!;
    this.renderer = new CartographerRenderer(space, this.store.project, {
      onSelect: (id) => this.store.select(id),
      onActivate: (id) => { this.store.select(id); this.openSelected(); }
    });

    this.store.addEventListener("selection", () => this.renderSelection());
    this.store.addEventListener("change", () => {
      this.renderer.setProject(this.store.project);
      this.renderTree();
      this.renderSelection();
      this.scheduleAutosave();
    });
    root.addEventListener("click", this.onClick);
    root.addEventListener("change", this.onChange);
    root.addEventListener("input", this.onInput);
    root.addEventListener("keydown", this.onKeydown);
    this.renderTree();
    this.renderSelection();
    this.syncSimulationControls();
  }

  destroy(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.renderer.destroy();
    this.root.removeEventListener("click", this.onClick);
    this.root.removeEventListener("change", this.onChange);
    this.root.removeEventListener("input", this.onInput);
    this.root.removeEventListener("keydown", this.onKeydown);
  }

  getProject(): StarMapProject { return structuredClone(this.store.project); }

  private scheduleAutosave(): void {
    this.saveGeneration += 1;
    const generation = this.saveGeneration;
    this.saveStatus.textContent = "UNSAVED";
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(async () => {
      this.saveStatus.textContent = "SAVING…";
      try {
        await saveAutosave(this.store.project);
        if (generation === this.saveGeneration) this.saveStatus.textContent = "SAVED";
      } catch (error) {
        this.saveStatus.textContent = "UNSAVED";
        this.reportError(error);
      }
    }, 350);
  }

  private renderTree(): void {
    const rootEntity = this.store.project.entities.find((entity) => entity.type === "galaxy");
    if (!rootEntity) return;
    this.treeHost.innerHTML = this.treeBranch(rootEntity);
    this.renderAddTypes();
  }

  private treeBranch(entity: Entity, depth = 0): string {
    const children = childrenOf(this.store.project, entity.id);
    const childHtml = children.map((child) => this.treeBranch(child, depth + 1)).join("");
    const searchable = `${entity.name} ${entity.type} ${(entity.meta.tags ?? []).join(" ")}`.toLowerCase();
    const selfMatches = !this.search || searchable.includes(this.search);
    const hasVisibleChild = childHtml.includes('data-tree-visible="true"');
    if (!selfMatches && !hasVisibleChild) return "";
    const icon = entity.type === "star" ? "★" : entity.type === "planet" ? "●" : entity.type === "moon" ? "·" : entity.type === "bloodRing" ? "◉" : entity.type === "system" ? "✦" : entity.type === "largeScaleStructure" ? "▰" : "◇";
    const resolved = resolveHistoricalTime(this.store.project, entity.id);
    const mode = entity.time.mode === "override" ? "OVERRIDE" : resolved.inherited ? "INHERITED" : "";
    return `<div data-tree-visible="true"><div class="tree-row ${entity.id === this.store.selectedId ? "selected" : ""}" style="--depth:${depth}"><button role="treeitem" aria-selected="${entity.id === this.store.selectedId}" data-select="${entity.id}">${icon} ${escapeHtml(entity.name)} <small>${mode}</small></button></div>${childHtml}</div>`;
  }

  private renderAddTypes(): void {
    const entity = getEntity(this.store.project, this.store.selectedId);
    const select = this.root.querySelector<HTMLSelectElement>("[data-add-type]");
    const button = this.root.querySelector<HTMLButtonElement>("[data-action='add-child']");
    if (!select || !button || !entity) return;
    const types = allowedChildTypes(entity);
    select.innerHTML = types.map((type) => `<option value="${type}">${escapeHtml(typeLabel(type))}</option>`).join("");
    select.disabled = types.length === 0;
    button.disabled = types.length === 0;
  }

  private renderSelection(): void {
    const entity = getEntity(this.store.project, this.store.selectedId);
    if (!entity) return;
    const time = resolveHistoricalTime(this.store.project, entity.id);
    this.renderer.setSelection(entity.id);
    const selectedText = this.root.querySelector<HTMLElement>(".selected-text");
    if (selectedText) selectedText.textContent = `SELECTED: ${entity.name} // ${entity.type.toUpperCase()} // ${entity.meta.canonStatus.toUpperCase()} // ${historicalTimeLabel(time.value)}`;
    this.inspectorHost.innerHTML = this.inspectorMarkup(entity);
    this.renderHistory(entity);
    this.renderBreadcrumbs();
    this.renderAddTypes();
  }

  private inspectorMarkup(entity: Entity): string {
    const orbit = entity.orbit;
    const position = entity.position;
    const visual = entity.visual ?? {};
    const events = entity.timeline.map((event, index) => `<fieldset class="event-editor"><legend>${escapeHtml(event.eventType)}</legend>
      <label>LABEL <input data-event-field="label" data-event-index="${index}" value="${escapeAttr(event.label)}" /></label>
      <label>TIME <input data-event-field="time" data-event-index="${index}" value="${escapeAttr(String(event.time))}" /></label>
      <label>TYPE <select data-event-field="eventType" data-event-index="${index}">${eventTypes().map((type) => `<option value="${type}" ${type === event.eventType ? "selected" : ""}>${type}</option>`).join("")}</select></label>
      <label>CANON <select data-event-field="canonStatus" data-event-index="${index}">${canonOptions(event.canonStatus)}</select></label>
      <label>SOURCE <textarea data-event-field="sourceNote" data-event-index="${index}">${escapeHtml(event.sourceNote ?? "")}</textarea></label>
      <button data-action="delete-event" data-event-index="${index}">DELETE EVENT</button>
    </fieldset>`).join("");
    return `<section class="inspector-section"><h3>IDENTITY</h3>
      <label>NAME <input data-entity-field="name" value="${escapeAttr(entity.name)}" /></label>
      <label>TYPE <input value="${escapeAttr(entity.type)}" disabled /></label>
      <label>PARENT <input value="${escapeAttr(getEntity(this.store.project, entity.parentId)?.name ?? "ROOT")}" disabled /></label>
      <label>DESCRIPTION <textarea data-entity-field="meta.description">${escapeHtml(entity.meta.description ?? "")}</textarea></label>
      <label>TAGS <input data-entity-field="meta.tags" value="${escapeAttr((entity.meta.tags ?? []).join(", "))}" /></label>
      <label>NOTES <textarea data-entity-field="meta.notes">${escapeHtml(entity.meta.notes ?? "")}</textarea></label>
    </section>
    ${position ? `<section class="inspector-section"><h3>POSITION</h3><div class="field-grid"><label>X <input type="number" step="any" data-entity-field="position.x" value="${position.x}" /></label><label>Y <input type="number" step="any" data-entity-field="position.y" value="${position.y}" /></label><label>Z <input type="number" step="any" data-entity-field="position.z" value="${position.z}" /></label></div><p class="warning">${entity.meta.positionStatus === "schematic" ? "SCHEMATIC / NON-CANON POSITION" : "AUTHOR POSITION"}</p></section>` : ""}
    ${orbit ? `<section class="inspector-section"><h3>ORBIT</h3><div class="field-grid">${orbitFields().map(([key, label]) => `<label>${label}<input type="number" step="any" data-entity-field="orbit.${key}" value="${orbit[key]}" /></label>`).join("")}</div></section>` : ""}
    <section class="inspector-section"><h3>VISUAL</h3><div class="field-grid"><label>DISPLAY RADIUS <input type="number" step="0.05" min="0.05" data-entity-field="visual.displayRadius" value="${Number(visual.displayRadius ?? 1)}" /></label><label>COLOR <input type="color" data-entity-field="visual.color" value="${escapeAttr(String(visual.color ?? "#8fa8b8"))}" /></label><label>EMISSIVE <input type="number" step="0.1" data-entity-field="visual.emissive" value="${Number(visual.emissive ?? 0)}" /></label><label>ROUGHNESS <input type="number" step="0.05" min="0" max="1" data-entity-field="visual.roughness" value="${Number(visual.roughness ?? 0.8)}" /></label></div></section>
    <section class="inspector-section"><h3>CANON / PROVENANCE</h3><label>STATUS <select data-entity-field="meta.canonStatus">${canonOptions(entity.meta.canonStatus)}</select></label><label>SOURCE NOTE <textarea data-entity-field="meta.sourceNote">${escapeHtml(entity.meta.sourceNote ?? "")}</textarea></label><label>SOURCE URL <input type="url" data-entity-field="meta.sourceHref" value="${escapeAttr(entity.meta.sourceHref ?? "")}" /></label><label>DOSSIER HREF <input data-entity-field="meta.dossierHref" value="${escapeAttr(entity.meta.dossierHref ?? "")}" /></label></section>
    <section class="inspector-section"><h3>TIMELINE</h3><button data-action="add-event">ADD EVENT</button>${events || `<p>No local events.</p>`}</section>`;
  }

  private renderHistory(entity: Entity): void {
    const resolved = resolveHistoricalTime(this.store.project, entity.id);
    const source = getEntity(this.store.project, resolved.sourceId);
    const events = eventsForScope(this.store.project, entity.id);
    const numeric = historicalOrder(resolved.value);
    const railValue = numeric !== null && numeric >= 0 && numeric <= 170 ? numeric : 170;
    const presetOptions = this.store.project.eraPresets.map((preset) => `<option value="${escapeAttr(preset.id)}" ${preset.value === resolved.value ? "selected" : ""}>${escapeHtml(preset.label)}</option>`).join("");
    const markers = events.length ? events.map((timelineEvent, index) => `<button class="event-marker" data-event-jump="${index}" title="${escapeAttr(timelineEvent.sourceNote ?? timelineEvent.label)}">${escapeHtml(timelineEvent.label)} · ${escapeHtml(historicalTimeLabel(timelineEvent.time))}</button>`).join("") : `<span class="no-events">NO LOCAL EVENT MARKERS</span>`;
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

  private syncSimulationControls(): void {
    const settings = this.store.project.settings;
    setChecked(this.root, "labels", settings.view.labels);
    setChecked(this.root, "paths", settings.view.orbitPaths);
    setChecked(this.root, "trails", settings.view.trails);
    setChecked(this.root, "grid", settings.view.referenceGrid);
    setChecked(this.root, "analyst", settings.view.analystOverlay);
    setChecked(this.root, "canon", settings.view.canonOnly);
    setChecked(this.root, "annotations", settings.view.annotations);
    const speed = this.root.querySelector<HTMLSelectElement>("[data-setting='speed']");
    if (speed) speed.value = String(settings.simulation.speed);
    const play = this.root.querySelector<HTMLButtonElement>("[data-action='play']");
    if (play) play.textContent = settings.simulation.running ? "PAUSE" : "PLAY";
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
    const ordered = events.map((timelineEvent) => ({ timelineEvent, order: historicalOrder(timelineEvent.time) })).filter((item) => item.order !== null) as { timelineEvent: (typeof events)[number]; order: number }[];
    if (!ordered.length) return;
    const target = direction > 0 ? ordered.find((item) => item.order > current) ?? ordered[ordered.length - 1] : [...ordered].reverse().find((item) => item.order < current) ?? ordered[0];
    if (target) this.setSelectedTime(target.timelineEvent.time, `jump to ${target.timelineEvent.label}`);
  }

  private async confirmDelete(): Promise<boolean> {
    const entity = getEntity(this.store.project, this.store.selectedId);
    if (!entity || entity.type === "galaxy") return false;
    const copy = this.confirmDialog.querySelector<HTMLElement>("[data-confirm-copy]");
    if (copy) copy.textContent = `Delete ${entity.name} and all descendants? This is undoable until the session history is exhausted.`;
    this.confirmDialog.showModal();
    return new Promise((resolve) => {
      const close = () => { this.confirmDialog.removeEventListener("close", close); resolve(this.confirmDialog.returnValue === "confirm"); };
      this.confirmDialog.addEventListener("close", close);
    });
  }

  private mutateEntityField(field: string, value: string, control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
    const id = this.store.selectedId;
    this.store.mutate(`edit ${field}`, (project) => {
      const entity = getEntity(project, id);
      if (!entity) return;
      if (field === "name") entity.name = value.trim() || entity.name;
      else if (field === "meta.description") entity.meta.description = value;
      else if (field === "meta.tags") entity.meta.tags = value.split(",").map((tag) => tag.trim()).filter(Boolean);
      else if (field === "meta.notes") entity.meta.notes = value;
      else if (field === "meta.canonStatus") entity.meta.canonStatus = value as CanonStatus;
      else if (field === "meta.sourceNote") entity.meta.sourceNote = value;
      else if (field === "meta.sourceHref") entity.meta.sourceHref = value;
      else if (field === "meta.dossierHref") entity.meta.dossierHref = value;
      else if (field.startsWith("position.") && entity.position) setNumeric(entity.position, field.split(".")[1]!, control);
      else if (field.startsWith("orbit.") && entity.orbit) setNumeric(entity.orbit, field.split(".")[1]!, control);
      else if (field.startsWith("visual.")) {
        entity.visual ??= {};
        const key = field.split(".")[1]!;
        if (["displayRadius", "emissive", "roughness"].includes(key)) (entity.visual as Record<string, unknown>)[key] = Number(value);
        else (entity.visual as Record<string, unknown>)[key] = value;
      }
    });
  }

  private mutateEventField(index: number, field: string, value: string): void {
    const id = this.store.selectedId;
    this.store.mutate(`edit event ${field}`, (project) => {
      const event = getEntity(project, id)?.timeline[index];
      if (!event) return;
      if (field === "label") event.label = value || event.label;
      else if (field === "time") event.time = parseHistoricalValue(value);
      else if (field === "eventType") event.eventType = value as TimelineEventType;
      else if (field === "canonStatus") event.canonStatus = value as CanonStatus;
      else if (field === "sourceNote") event.sourceNote = value;
    });
  }

  private onClick = async (event: Event): Promise<void> => {
    const target = event.target as HTMLElement;
    const select = target.closest<HTMLElement>("[data-select]");
    if (select?.dataset.select) { this.store.select(select.dataset.select); return; }
    const jump = target.closest<HTMLElement>("[data-event-jump]")?.dataset.eventJump;
    if (jump !== undefined) { const timelineEvent = eventsForScope(this.store.project, this.store.selectedId)[Number(jump)]; if (timelineEvent) this.setSelectedTime(timelineEvent.time, `jump to ${timelineEvent.label}`); return; }
    const actionNode = target.closest<HTMLElement>("[data-action]");
    const action = actionNode?.dataset.action;
    if (!action) return;
    try {
      if (action === "play") this.store.mutate("toggle simulation", (project) => { project.settings.simulation.running = !project.settings.simulation.running; });
      else if (action === "focus") this.renderer.focusSelected();
      else if (action === "open") this.openSelected();
      else if (action === "up") this.goUp();
      else if (action === "reset-camera") this.renderer.resetCamera();
      else if (action === "return-parent") this.store.mutate("return to parent time", (project) => returnToParentTime(project, this.store.selectedId));
      else if (action === "previous-event") this.jumpEvent(-1);
      else if (action === "next-event") this.jumpEvent(1);
      else if (action === "apply-exact") { const input = this.root.querySelector<HTMLInputElement>("[data-history='exact']"); if (input) this.setSelectedTime(parseHistoricalValue(input.value), "set exact historical time"); }
      else if (action === "undo") this.store.undo();
      else if (action === "redo") this.store.redo();
      else if (action === "export") downloadProject(this.store.project, `${safeFilename(this.store.project.title)}.json`);
      else if (action === "import") this.importInput.click();
      else if (action === "add-child") {
        const type = this.root.querySelector<HTMLSelectElement>("[data-add-type]")?.value as EntityType | undefined;
        if (type) this.store.add(createAuthoredChild(this.store.project, this.store.selectedId, type));
      } else if (action === "duplicate") this.store.duplicate(this.store.selectedId);
      else if (action === "move-up") this.store.mutate("move entity up", (project) => moveSibling(project, this.store.selectedId, -1));
      else if (action === "move-down") this.store.mutate("move entity down", (project) => moveSibling(project, this.store.selectedId, 1));
      else if (action === "delete") { if (await this.confirmDelete()) this.store.delete(this.store.selectedId); }
      else if (action === "add-event") this.store.mutate("add timeline event", (project) => getEntity(project, this.store.selectedId)?.timeline.push(createTimelineEvent(project, this.store.selectedId)));
      else if (action === "delete-event") {
        const index = Number(actionNode?.dataset.eventIndex);
        this.store.mutate("delete timeline event", (project) => { const entity = getEntity(project, this.store.selectedId); if (entity && Number.isInteger(index)) entity.timeline.splice(index, 1); });
      } else if (action === "toggle-hierarchy") this.shell.classList.toggle("show-hierarchy");
      else if (action === "toggle-inspector") this.shell.classList.toggle("show-inspector");
      this.syncSimulationControls();
    } catch (error) { this.reportError(error); }
  };

  private onChange = async (event: Event): Promise<void> => {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    try {
      const setting = target.dataset.setting;
      if (setting) {
        this.store.mutate(`set ${setting}`, (project) => {
          if (setting === "speed") project.settings.simulation.speed = Number(target.value);
          if (setting === "labels") project.settings.view.labels = (target as HTMLInputElement).checked;
          if (setting === "paths") project.settings.view.orbitPaths = (target as HTMLInputElement).checked;
          if (setting === "trails") project.settings.view.trails = (target as HTMLInputElement).checked;
          if (setting === "grid") project.settings.view.referenceGrid = (target as HTMLInputElement).checked;
          if (setting === "analyst") project.settings.view.analystOverlay = (target as HTMLInputElement).checked;
          if (setting === "canon") project.settings.view.canonOnly = (target as HTMLInputElement).checked;
          if (setting === "annotations") project.settings.view.annotations = (target as HTMLInputElement).checked;
        });
        return;
      }
      if (target.dataset.history === "preset") {
        const preset = this.store.project.eraPresets.find((candidate) => candidate.id === target.value);
        if (preset && preset.id !== "custom") this.setSelectedTime(preset.value, `set era ${preset.label}`);
        return;
      }
      if (target === this.importInput) {
        const file = this.importInput.files?.[0];
        if (!file) return;
        const imported = parseProjectJson(await file.text());
        this.store.replace(imported, "import project");
        this.importInput.value = "";
        this.syncSimulationControls();
        return;
      }
      if (target.dataset.entityField) { this.mutateEntityField(target.dataset.entityField, target.value, target); return; }
      if (target.dataset.eventField) { this.mutateEventField(Number(target.dataset.eventIndex), target.dataset.eventField, target.value); return; }
    } catch (error) { this.reportError(error); }
  };

  private onInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.history === "scrub") this.setSelectedTime(Number(target.value), "scrub historical time");
    if (target.dataset.treeSearch !== undefined) { this.search = target.value.trim().toLowerCase(); this.renderTree(); }
  };

  private onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && this.confirmDialog.open) { this.confirmDialog.close("cancel"); return; }
    const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? this.store.redo() : this.store.undo(); return; }
    if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); this.store.redo(); return; }
    if (editing) return;
    if (event.code === "Space") { event.preventDefault(); this.root.querySelector<HTMLElement>("[data-action='play']")?.click(); }
    else if (event.key.toLowerCase() === "f") this.renderer.focusSelected();
    else if (event.key.toLowerCase() === "l") this.toggleCheckbox("labels");
    else if (event.key.toLowerCase() === "t") this.toggleCheckbox("trails");
    else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); this.root.querySelector<HTMLElement>("[data-action='delete']")?.click(); }
  };

  private toggleCheckbox(setting: string): void {
    const input = this.root.querySelector<HTMLInputElement>(`input[data-setting='${setting}']`);
    if (!input) return;
    input.checked = !input.checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  private reportError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    const selected = this.root.querySelector<HTMLElement>(".selected-text");
    if (selected) { selected.textContent = `ERROR: ${message}`; selected.classList.add("error"); setTimeout(() => selected.classList.remove("error"), 3500); }
    console.error("STARSiLK Temporal Cartographer:", error);
  }
}

function parseHistoricalValue(value: string): HistoricalTime { const trimmed = value.trim(); return /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed || "CUSTOM"; }
function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char); }
function escapeAttr(value: string): string { return escapeHtml(value).replace(/`/g, "&#96;"); }
function safeFilename(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "starsilk-map"; }
function typeLabel(type: EntityType): string { return type.replace(/([A-Z])/g, " $1").toUpperCase(); }
function canonOptions(selected: CanonStatus): string { return (["locked", "working", "provisional", "schematic"] as CanonStatus[]).map((status) => `<option value="${status}" ${status === selected ? "selected" : ""}>${status === "locked" ? "LOCKED CANON" : status === "working" ? "WORKING CANON" : status === "provisional" ? "PROVISIONAL" : "SCHEMATIC / NON-CANON"}</option>`).join(""); }
function eventTypes(): TimelineEventType[] { return ["created", "destroyed", "renamed", "visualChanged", "orbitChanged", "bloodRingCreated", "bloodRingDestroyed", "starsilkExtractionCollapse", "annotation", "custom"]; }
function orbitFields(): [keyof NonNullable<Entity["orbit"]>, string][] { return [["semiMajorAxis", "SEMI-MAJOR AXIS"], ["eccentricity", "ECCENTRICITY"], ["inclination", "INCLINATION"], ["ascendingNode", "ASCENDING NODE"], ["argumentOfPeriapsis", "ARG. PERIAPSIS"], ["meanAnomalyAtEpoch", "MEAN ANOMALY"], ["epoch", "EPOCH"], ["period", "PERIOD"]]; }
function setNumeric(target: object, key: string, control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void { const numeric = Number(control.value); if (!Number.isFinite(numeric)) throw new Error(`${key} must be a finite number.`); (target as Record<string, unknown>)[key] = numeric; }
function setChecked(root: HTMLElement, setting: string, value: boolean): void { const input = root.querySelector<HTMLInputElement>(`input[data-setting='${setting}']`); if (input) input.checked = value; }
