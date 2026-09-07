import type {
  Entity,
  HistoricalTimeValue,
  MountOptions,
  StarMapProject,
  ViewScale,
} from "../model/types.ts";
import { cloneProject } from "../model/validate.ts";
import { createDemoProject } from "../model/demo-project.ts";
import { parseProjectJson, serializeProject } from "../persist/import-export.ts";
import {
  addEntity,
  deleteEntity,
  duplicateEntity,
  patchEntity,
  patchEntityDeep,
  renameEntity,
} from "../model/mutations.ts";
import { clearOverride, setGalaxyTime, setOverride } from "../model/resolve-time.ts";
import type { EntityType } from "../model/types.ts";

export type SaveStatus = "saved" | "saving" | "unsaved";

export interface EditorState {
  project: StarMapProject;
  selectionId: string | null;
  viewScale: ViewScale;
  focusId: string | null;
  simTime: number;
  reducedMotion: boolean;
  mode: "editor" | "viewer";
  saveStatus: SaveStatus;
  confirmDeleteId: string | null;
  drawers: { hierarchy: boolean; inspector: boolean };
  errorMessage: string | null;
}

type Listener = () => void;

const MAX_HISTORY = 80;

export class EditorStore {
  state: EditorState;
  private past: string[] = [];
  private future: string[] = [];
  private listeners = new Set<Listener>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persist: ((json: string) => Promise<void>) | null = null;
  private applying = false;

  constructor(options: MountOptions = {}) {
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.state = {
      project: createDemoProject(),
      selectionId: "gal-archive",
      viewScale: "galaxy",
      focusId: "gal-archive",
      simTime: 0,
      reducedMotion: !!reducedMotion,
      mode: options.mode === "viewer" || options.disableAuthoring ? "viewer" : "editor",
      saveStatus: "saved",
      confirmDeleteId: null,
      drawers: { hierarchy: false, inspector: false },
      errorMessage: null,
    };
    if (options.startEra !== undefined) {
      this.state.project = setGalaxyTime(this.state.project, options.startEra);
    }
    if (options.startEntityId) {
      this.state.selectionId = options.startEntityId;
      this.state.focusId = options.startEntityId;
    }
    if (options.src && typeof options.src === "object") {
      this.state.project = cloneProject(options.src);
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  setPersister(fn: (json: string) => Promise<void>) {
    this.persist = fn;
  }

  private snapshot(): string {
    return serializeProject(this.state.project);
  }

  private markDirty() {
    this.state.saveStatus = "unsaved";
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.flushSave(), 700);
    this.emit();
  }

  async flushSave() {
    if (!this.persist) {
      this.state.saveStatus = "saved";
      this.emit();
      return;
    }
    this.state.saveStatus = "saving";
    this.emit();
    try {
      await this.persist(this.snapshot());
      this.state.saveStatus = "saved";
    } catch (err) {
      this.state.saveStatus = "unsaved";
      this.state.errorMessage = err instanceof Error ? err.message : "Save failed";
    }
    this.emit();
  }

  loadProject(project: StarMapProject, pushHistory = false) {
    if (pushHistory) this.pushUndo();
    this.state.project = cloneProject(project);
    this.state.errorMessage = null;
    this.markDirty();
  }

  importJson(text: string) {
    const project = parseProjectJson(text);
    this.past.push(this.snapshot());
    this.future = [];
    this.state.project = project;
    this.state.selectionId = project.entities[0]?.id ?? null;
    this.state.errorMessage = null;
    this.markDirty();
  }

  replaceFromAutosave(project: StarMapProject) {
    this.state.project = project;
    this.state.saveStatus = "saved";
    this.emit();
  }

  private pushUndo() {
    this.past.push(this.snapshot());
    if (this.past.length > MAX_HISTORY) this.past.shift();
    this.future = [];
  }

  commit(mutator: (p: StarMapProject) => StarMapProject) {
    if (this.state.mode === "viewer") return;
    this.pushUndo();
    this.state.project = mutator(this.state.project);
    this.markDirty();
  }

  undo() {
    if (this.state.mode === "viewer" || !this.past.length) return;
    this.future.push(this.snapshot());
    this.state.project = parseProjectJson(this.past.pop()!);
    this.markDirty();
  }

  redo() {
    if (this.state.mode === "viewer" || !this.future.length) return;
    this.past.push(this.snapshot());
    this.state.project = parseProjectJson(this.future.pop()!);
    this.markDirty();
  }

  canUndo() {
    return this.past.length > 0 && this.state.mode === "editor";
  }

  canRedo() {
    return this.future.length > 0 && this.state.mode === "editor";
  }

  select(id: string | null) {
    this.state.selectionId = id;
    this.emit();
  }

  setView(scale: ViewScale, focusId: string | null) {
    this.state.viewScale = scale;
    this.state.focusId = focusId;
    this.emit();
  }

  drillInto(entity: Entity) {
    if (entity.type === "galaxy") this.setView("galaxy", entity.id);
    else if (entity.type === "starfield" || entity.type === "largeScaleStructure") {
      this.setView("sector", entity.id);
    } else if (entity.type === "system") {
      this.setView("system", entity.id);
    } else {
      const parent = this.state.project.entities.find((e) => e.id === entity.parentId);
      if (parent?.type === "system") this.setView("system", parent.id);
      else if (parent) this.drillInto(parent);
    }
    this.select(entity.id);
  }

  goUp() {
    const focus = this.state.project.entities.find((e) => e.id === this.state.focusId);
    if (!focus?.parentId) {
      this.setView("galaxy", this.state.project.entities.find((e) => e.type === "galaxy")?.id ?? null);
      return;
    }
    const parent = this.state.project.entities.find((e) => e.id === focus.parentId);
    if (parent) this.drillInto(parent);
  }

  tick(dt: number) {
    if (this.state.project.settings.orbitalPaused) return;
    const speed = this.state.project.settings.orbitalSpeed;
    this.state.simTime += dt * speed;
  }

  setPaused(paused: boolean) {
    this.state.project = {
      ...this.state.project,
      settings: { ...this.state.project.settings, orbitalPaused: paused },
    };
    this.emit();
  }

  setSpeed(speed: number) {
    this.state.project = {
      ...this.state.project,
      settings: { ...this.state.project.settings, orbitalSpeed: speed },
    };
    this.emit();
  }

  toggleSetting(key: "labels" | "orbitPaths" | "trails" | "analystOverlay" | "canonOnly" | "annotations" | "referenceGrid") {
    this.state.project = {
      ...this.state.project,
      settings: { ...this.state.project.settings, [key]: !this.state.project.settings[key] },
    };
    this.emit();
  }

  setGalaxyTime(value: HistoricalTimeValue) {
    this.commit((p) => setGalaxyTime(p, value));
  }

  overrideSelected(value: HistoricalTimeValue) {
    if (!this.state.selectionId) return;
    const id = this.state.selectionId;
    this.commit((p) => setOverride(p, id, value));
  }

  returnToParentTime() {
    if (!this.state.selectionId) return;
    const id = this.state.selectionId;
    this.commit((p) => clearOverride(p, id));
  }

  renameSelected(name: string) {
    if (!this.state.selectionId) return;
    const id = this.state.selectionId;
    this.commit((p) => renameEntity(p, id, name));
  }

  patchSelected(patch: Partial<Entity>) {
    if (!this.state.selectionId) return;
    const id = this.state.selectionId;
    this.commit((p) => patchEntity(p, id, patch));
  }

  updateSelected(fn: (e: Entity) => Entity) {
    if (!this.state.selectionId) return;
    const id = this.state.selectionId;
    this.commit((p) => patchEntityDeep(p, id, fn));
  }

  addChild(type: EntityType) {
    const parentId = this.state.selectionId;
    if (!parentId) return;
    let newId = "";
    this.commit((p) => {
      const r = addEntity(p, parentId, type);
      newId = r.id;
      return r.project;
    });
    if (newId) this.select(newId);
  }

  duplicateSelected() {
    if (!this.state.selectionId) return;
    const id = this.state.selectionId;
    let newId = id;
    this.commit((p) => {
      const r = duplicateEntity(p, id);
      newId = r.id;
      return r.project;
    });
    this.select(newId);
  }

  requestDelete(id: string) {
    this.state.confirmDeleteId = id;
    this.emit();
  }

  cancelDelete() {
    this.state.confirmDeleteId = null;
    this.emit();
  }

  confirmDelete() {
    const id = this.state.confirmDeleteId;
    if (!id) return;
    this.state.confirmDeleteId = null;
    this.commit((p) => deleteEntity(p, id));
    if (this.state.selectionId === id) this.select(null);
  }

  toggleDrawer(which: "hierarchy" | "inspector") {
    this.state.drawers[which] = !this.state.drawers[which];
    this.emit();
  }

  closeDrawers() {
    this.state.drawers.hierarchy = false;
    this.state.drawers.inspector = false;
    this.emit();
  }

  setError(msg: string | null) {
    this.state.errorMessage = msg;
    this.emit();
  }

  resetDemo() {
    this.pushUndo();
    this.state.project = createDemoProject();
    this.state.selectionId = "gal-archive";
    this.state.viewScale = "galaxy";
    this.state.focusId = "gal-archive";
    this.markDirty();
  }

  selected(): Entity | undefined {
    return this.state.project.entities.find((e) => e.id === this.state.selectionId);
  }
}

export function isApplying(_store: EditorStore) {
  return false;
}
