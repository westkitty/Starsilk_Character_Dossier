import { ProjectStore, childrenOf, getEntity, type Entity, type StarMapProject } from "./core.js";
import { CartographerRenderer, type ViewScale } from "./renderer.js";

export class CartographerEditor {
  private root: HTMLElement;
  private store: ProjectStore;
  private renderer: CartographerRenderer;
  private treeHost: HTMLElement;
  private inspectorHost: HTMLElement;
  private breadcrumbHost: HTMLElement;
  private view: { scale: ViewScale; id: string | null } = { scale: "galaxy", id: null };

  constructor(root: HTMLElement, project: StarMapProject) {
    this.root = root; this.store = new ProjectStore(project);
    root.innerHTML = `<div class="cartographer-shell">
      <header class="topbar"><div><span class="eyebrow">ADMINISTRATION CARTOGRAPHIC ARCHIVE</span><strong>STARSiLK TEMPORAL CARTOGRAPHER</strong></div><div class="top-actions"><span class="status-chip">PHASE 2 // RENDERER</span><button data-action="reset-camera">RESET CAMERA</button></div></header>
      <nav class="breadcrumbs" aria-label="Map hierarchy"></nav>
      <aside class="hierarchy-panel" aria-label="Hierarchy"><div class="panel-title">HIERARCHY</div><div class="tree" role="tree"></div></aside>
      <section class="viewport-panel" aria-label="3D cartographic view"><div class="space" id="cartographer-space"></div></section>
      <aside class="inspector-panel" aria-label="Selection inspector"><div class="panel-title">INSPECTOR</div><div class="inspector-content"></div></aside>
      <section class="simulation-rail" aria-label="Orbital simulation controls">
        <button data-action="play">PAUSE</button><label>SPEED <select data-setting="speed"><option value="0.1">0.1×</option><option value="1" selected>1×</option><option value="10">10×</option><option value="100">100×</option></select></label>
        <label><input type="checkbox" data-setting="labels" checked /> LABELS</label><label><input type="checkbox" data-setting="paths" checked /> ORBIT PATHS</label><label><input type="checkbox" data-setting="trails" /> TRAILS</label>
        <button data-action="focus">FOCUS SELECTED</button><button data-action="open">OPEN SELECTED</button><button data-action="up">UP</button>
      </section></div>`;
    this.treeHost = root.querySelector(".tree")!; this.inspectorHost = root.querySelector(".inspector-content")!; this.breadcrumbHost = root.querySelector(".breadcrumbs")!;
    const space = root.querySelector<HTMLElement>("#cartographer-space")!;
    this.renderer = new CartographerRenderer(space, this.store.project, { onSelect: (id) => this.store.select(id), onActivate: (id) => { this.store.select(id); this.openSelected(); } });
    this.store.addEventListener("selection", () => this.renderSelection());
    this.store.addEventListener("change", () => { this.renderer.setProject(this.store.project); this.renderTree(); this.renderSelection(); });
    root.addEventListener("click", this.onClick); root.addEventListener("change", this.onChange); root.addEventListener("keydown", this.onKeydown);
    this.renderTree(); this.renderSelection();
  }

  destroy(): void { this.renderer.destroy(); this.root.removeEventListener("click", this.onClick); this.root.removeEventListener("change", this.onChange); this.root.removeEventListener("keydown", this.onKeydown); }

  private renderTree(): void { const rootEntity = this.store.project.entities.find((entity) => entity.type === "galaxy"); if (rootEntity) this.treeHost.innerHTML = this.treeBranch(rootEntity); }
  private treeBranch(entity: Entity, depth = 0): string {
    const children = childrenOf(this.store.project, entity.id); const icon = entity.type === "star" ? "★" : entity.type === "planet" ? "●" : entity.type === "moon" ? "·" : entity.type === "system" ? "✦" : "◇";
    return `<div class="tree-row ${entity.id === this.store.selectedId ? "selected" : ""}" style="--depth:${depth}"><button role="treeitem" aria-selected="${entity.id === this.store.selectedId}" data-select="${entity.id}">${icon} ${escapeHtml(entity.name)}</button></div>${children.map((child) => this.treeBranch(child, depth + 1)).join("")}`;
  }

  private renderSelection(): void {
    const entity = getEntity(this.store.project, this.store.selectedId); if (!entity) return; this.renderer.setSelection(entity.id);
    this.inspectorHost.innerHTML = `<dl class="meta-list"><div><dt>NAME</dt><dd>${escapeHtml(entity.name)}</dd></div><div><dt>TYPE</dt><dd>${entity.type}</dd></div><div><dt>CANON</dt><dd>${entity.meta.canonStatus.toUpperCase()}</dd></div><div><dt>POSITION</dt><dd>${entity.meta.positionStatus === "schematic" ? "SCHEMATIC / NON-CANON POSITION" : entity.meta.positionStatus ?? "UNKNOWN"}</dd></div><div><dt>TIME</dt><dd>${entity.time.mode.toUpperCase()}</dd></div></dl><p>${escapeHtml(entity.meta.sourceNote ?? entity.meta.description ?? "No source note supplied.")}</p>`;
    this.renderBreadcrumbs();
  }

  private renderBreadcrumbs(): void { const selected = getEntity(this.store.project, this.view.id); const galaxy = this.store.project.entities.find((entity) => entity.type === "galaxy"); const parts = [galaxy?.name ?? "GALAXY"]; if (selected && selected.type !== "galaxy") parts.push(selected.name); this.breadcrumbHost.innerHTML = parts.map((part) => `<span>${escapeHtml(part)}</span>`).join("<span aria-hidden='true'>›</span>"); }

  private openSelected(): void {
    const entity = getEntity(this.store.project, this.store.selectedId); if (!entity) return;
    if (entity.type === "galaxy") this.setView("galaxy", null); else if (entity.type === "starfield") this.setView("sector", entity.id); else if (entity.type === "system") this.setView("system", entity.id); else if (entity.parentId) { const parent = getEntity(this.store.project, entity.parentId); if (parent?.type === "system") this.setView("system", parent.id); }
  }
  private setView(scale: ViewScale, id: string | null): void { this.view = { scale, id }; this.renderer.setView(scale, id); this.renderBreadcrumbs(); }
  private goUp(): void { if (this.view.scale === "galaxy") return; const current = getEntity(this.store.project, this.view.id); if (this.view.scale === "system" && current?.parentId) this.setView("sector", current.parentId); else this.setView("galaxy", null); }

  private onClick = (event: Event): void => {
    const target = event.target as HTMLElement; const select = target.closest<HTMLElement>("[data-select]"); if (select?.dataset.select) { this.store.select(select.dataset.select); return; }
    const action = target.closest<HTMLElement>("[data-action]")?.dataset.action; if (!action) return;
    if (action === "play") { this.store.mutate("toggle simulation", (project) => { project.settings.simulation.running = !project.settings.simulation.running; }); target.textContent = this.store.project.settings.simulation.running ? "PAUSE" : "PLAY"; }
    else if (action === "focus") this.renderer.focusSelected(); else if (action === "open") this.openSelected(); else if (action === "up") this.goUp(); else if (action === "reset-camera") this.renderer.resetCamera();
  };

  private onChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement; const setting = target.dataset.setting; if (!setting) return;
    this.store.mutate(`set ${setting}`, (project) => { if (setting === "speed") project.settings.simulation.speed = Number(target.value); if (setting === "labels") project.settings.view.labels = (target as HTMLInputElement).checked; if (setting === "paths") project.settings.view.orbitPaths = (target as HTMLInputElement).checked; if (setting === "trails") project.settings.view.trails = (target as HTMLInputElement).checked; });
  };

  private onKeydown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.code === "Space") { event.preventDefault(); this.root.querySelector<HTMLElement>("[data-action='play']")?.click(); }
    if (event.key.toLowerCase() === "f") this.renderer.focusSelected(); if (event.key.toLowerCase() === "l") this.toggleCheckbox("labels"); if (event.key.toLowerCase() === "t") this.toggleCheckbox("trails");
  };

  private toggleCheckbox(setting: string): void { const input = this.root.querySelector<HTMLInputElement>(`input[data-setting='${setting}']`); if (!input) return; input.checked = !input.checked; input.dispatchEvent(new Event("change", { bubbles: true })); }
}

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char); }
