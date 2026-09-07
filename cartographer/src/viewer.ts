import { deepClone, getEntity, validateProject, type HistoricalTime, type StarMapProject } from "./core.js";
import { CartographerRenderer } from "./renderer.js";
import { setHistoricalOverride } from "./timeline.js";
import { parseProjectJson } from "./persistence.js";

export interface ViewerOptions {
  project: StarMapProject;
  startEntityId?: string;
  era?: HistoricalTime;
}

export interface ViewerHandle {
  destroy(): void;
  setProject(project: StarMapProject): void;
  focus(entityId: string): void;
}

export function mountStarsilkStarmap(container: HTMLElement, options: ViewerOptions): ViewerHandle {
  let project = prepareProject(options.project, options.era);
  container.innerHTML = `<div class="starsilk-viewer"><div class="viewer-space"></div><aside class="viewer-info" aria-live="polite"></aside></div>`;
  const space = container.querySelector<HTMLElement>(".viewer-space")!;
  const info = container.querySelector<HTMLElement>(".viewer-info")!;
  let selectedId = options.startEntityId && getEntity(project, options.startEntityId) ? options.startEntityId : project.entities.find((entity) => entity.type === "galaxy")?.id ?? project.entities[0]!.id;
  const renderer = new CartographerRenderer(space, project, {
    onSelect: (id) => { selectedId = id; renderInfo(); renderer.setSelection(id); },
    onActivate: (id) => { selectedId = id; openEntity(id); renderInfo(); renderer.setSelection(id); }
  });

  const openEntity = (id: string) => {
    const entity = getEntity(project, id);
    if (!entity) return;
    if (entity.type === "galaxy") renderer.setView("galaxy", null);
    else if (entity.type === "starfield") renderer.setView("sector", entity.id);
    else if (entity.type === "system") renderer.setView("system", entity.id);
    else if (entity.parentId) {
      const parent = getEntity(project, entity.parentId);
      if (parent?.type === "system") renderer.setView("system", parent.id);
      else if (parent?.parentId && getEntity(project, parent.parentId)?.type === "system") renderer.setView("system", parent.parentId);
    }
  };

  const renderInfo = () => {
    const entity = getEntity(project, selectedId);
    if (!entity) return;
    info.innerHTML = `<strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.type.toUpperCase())}</span><p>${escapeHtml(entity.meta.description ?? entity.meta.sourceNote ?? "No description supplied.")}</p><span>${escapeHtml(entity.meta.canonStatus.toUpperCase())}</span>`;
  };

  if (options.startEntityId) openEntity(options.startEntityId);
  renderer.setSelection(selectedId);
  renderInfo();
  return {
    destroy: () => { renderer.destroy(); container.innerHTML = ""; },
    setProject: (next) => { project = prepareProject(next); renderer.setProject(project); renderInfo(); },
    focus: (id) => { if (!getEntity(project, id)) return; selectedId = id; renderer.setSelection(id); openEntity(id); renderer.focusSelected(); renderInfo(); }
  };
}

function prepareProject(project: StarMapProject, era?: HistoricalTime): StarMapProject {
  const validation = validateProject(project);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  const copy = deepClone(project);
  if (era !== undefined) {
    const galaxy = copy.entities.find((entity) => entity.type === "galaxy");
    if (galaxy) setHistoricalOverride(copy, galaxy.id, era);
  }
  return copy;
}

const VIEWER_CSS = `
:host { display:block; min-height:420px; color:#c9d5df; background:#05070d; font-family:Inter,system-ui,sans-serif; }
* { box-sizing:border-box; }
.starsilk-viewer { display:grid; grid-template-columns:minmax(0,1fr) minmax(220px,18rem); min-height:420px; height:100%; background:#05070d; border:1px solid #27374b; }
.viewer-space { position:relative; min-height:420px; }
.viewer-info { padding:1rem; border-left:1px solid #27374b; background:#0d1320; display:flex; flex-direction:column; gap:.5rem; font-size:.86rem; line-height:1.45; }
.viewer-info strong { color:#a6efff; }
.viewer-info span { color:#8fa8b8; font:700 .65rem ui-monospace,monospace; letter-spacing:.08em; }
.space-host,.space,.canvas-host { position:absolute; inset:0; width:100%; height:100%; }
.canvas-host canvas { display:block; width:100%; height:100%; touch-action:none; }
.space-labels { position:absolute; inset:0; overflow:hidden; pointer-events:none; }
.space-label { position:absolute; padding:.18rem .3rem; color:#8fa8b8; border-left:1px solid #27374b; font:700 .62rem ui-monospace,monospace; white-space:nowrap; }
.space-label.selected { color:#a6efff; border-color:#55dfff; }
.void-note,.analyst-note { position:absolute; left:1rem; top:1rem; padding:.35rem .5rem; border:1px solid #27374b; background:rgba(5,7,13,.8); color:#8fa8b8; font:700 .62rem ui-monospace,monospace; }
.analyst-note { top:2.8rem; color:#55dfff; }
@media (max-width:700px) { .starsilk-viewer { grid-template-columns:1fr; } .viewer-info { border-left:0; border-top:1px solid #27374b; } }
`;

export class StarsilkStarmapElement extends HTMLElement {
  private handle: ViewerHandle | null = null;
  private projectValue: StarMapProject | null = null;
  private mount: HTMLElement | null = null;

  set project(value: StarMapProject | null) {
    this.projectValue = value ? deepClone(value) : null;
    if (this.isConnected) void this.render();
  }

  get project(): StarMapProject | null { return this.projectValue ? deepClone(this.projectValue) : null; }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = VIEWER_CSS;
      this.mount = document.createElement("div");
      this.mount.style.minHeight = "inherit";
      shadow.append(style, this.mount);
    }
    void this.render();
  }

  disconnectedCallback(): void { this.handle?.destroy(); this.handle = null; }

  private async render(): Promise<void> {
    if (!this.mount) return;
    try {
      let project = this.projectValue;
      const src = this.getAttribute("src");
      if (!project && src) {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`Unable to load map JSON (${response.status}).`);
        project = parseProjectJson(await response.text());
      }
      if (!project) {
        this.mount.innerHTML = `<p style="padding:1rem">No STARSiLK map project supplied.</p>`;
        return;
      }
      this.handle?.destroy();
      const startEntityId = this.getAttribute("start-entity") ?? undefined;
      const eraAttr = this.getAttribute("era");
      const era = eraAttr === null ? undefined : parseEra(eraAttr);
      this.handle = mountStarsilkStarmap(this.mount, { project, startEntityId, era });
    } catch (error) {
      this.mount.innerHTML = `<p role="alert" style="padding:1rem;color:#d95d6c">${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    }
  }
}

export function registerStarsilkStarmap(): void {
  if (!customElements.get("starsilk-starmap")) customElements.define("starsilk-starmap", StarsilkStarmapElement);
}

function parseEra(value: string): HistoricalTime {
  const trimmed = value.trim();
  return /^-?\d+(?:\.\d+)?$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}
