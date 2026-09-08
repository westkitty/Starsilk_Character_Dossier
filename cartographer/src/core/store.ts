/**
 * Editor state container: project document + selection + UI state + undo/redo.
 *
 * The store is intentionally framework-neutral (no React, no globals): the DOM
 * layer and the renderer both subscribe to it, and the viewer embed uses the same
 * class with authoring mutations disabled.
 */

import { deepClone } from './project';
import type { StarMapProject } from './types';

export type ViewScale = 'galaxy' | 'sector' | 'system';

export type DrawerName = 'none' | 'hierarchy' | 'inspector';

export interface UiState {
  /** Camera focus target (may differ from selection during a transition). */
  focusEntityId: string | null;
  /** Which scale the viewport is showing. */
  view: ViewScale;
  /** The sector or system currently framed in the viewport. */
  viewEntityId: string | null;
  expandedIds: string[];
  hierarchyQuery: string;
  drawer: DrawerName;
  /** Entity whose historical time the rail is currently editing. */
  railScopeId: string | null;
  /** Transient status line text (import errors, confirmations, …). */
  statusMessage: string | null;
  statusTone: 'neutral' | 'warn' | 'danger';
}

export interface StoreSnapshot {
  project: StarMapProject;
  selectionId: string | null;
  ui: UiState;
}

export type ChangeKind = 'project' | 'selection' | 'ui';

type Listener = (change: ChangeKind) => void;

const HISTORY_LIMIT = 120;

export function defaultUiState(): UiState {
  return {
    focusEntityId: null,
    view: 'galaxy',
    viewEntityId: null,
    expandedIds: [],
    hierarchyQuery: '',
    drawer: 'none',
    railScopeId: null,
    statusMessage: null,
    statusTone: 'neutral',
  };
}

export interface CommitOptions {
  /** Skip history (used for bulk programmatic loads). */
  silentHistory?: boolean;
  /** Emit only these change kinds. Defaults to `['project']`. */
  changes?: ChangeKind[];
}

export class ProjectStore {
  project: StarMapProject;
  selectionId: string | null = null;
  ui: UiState = defaultUiState();

  private past: Array<{ project: StarMapProject; label: string }> = [];
  private future: Array<{ project: StarMapProject; label: string }> = [];
  private listeners = new Set<Listener>();

  /** Set false in viewer mode: authoring mutations are refused. */
  authoringEnabled = true;

  constructor(project: StarMapProject) {
    this.project = deepClone(project);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(change: ChangeKind) {
    for (const listener of [...this.listeners]) listener(change);
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoLabel(): string | null {
    return this.past.length > 0 ? this.past[this.past.length - 1]!.label : null;
  }

  get redoLabel(): string | null {
    return this.future.length > 0 ? this.future[this.future.length - 1]!.label : null;
  }

  get historyDepth(): { undo: number; redo: number } {
    return { undo: this.past.length, redo: this.future.length };
  }

  /**
   * Apply a mutation. The mutator receives a deep clone and may either mutate it
   * in place or return a replacement document. Returning the *same* object it was
   * given (or nothing) records no history entry when nothing changed.
   */
  commit(
    label: string,
    mutator: (draft: StarMapProject) => StarMapProject | void,
    options: CommitOptions = {},
  ): boolean {
    if (!this.authoringEnabled) return false;
    const draft = deepClone(this.project);
    const returned = mutator(draft);
    const next = returned ?? draft;
    if (next === this.project) return false;
    if (!options.silentHistory) {
      this.past.push({ project: this.project, label });
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
      this.future.length = 0;
    }
    this.project = next;
    this.pruneSelection();
    for (const change of options.changes ?? ['project']) this.emit(change);
    return true;
  }

  undo(): boolean {
    const entry = this.past.pop();
    if (!entry) return false;
    this.future.push({ project: this.project, label: entry.label });
    this.project = entry.project;
    this.pruneSelection();
    this.emit('project');
    this.emit('selection');
    this.emit('ui');
    return true;
  }

  redo(): boolean {
    const entry = this.future.pop();
    if (!entry) return false;
    this.past.push({ project: this.project, label: entry.label });
    this.project = entry.project;
    this.pruneSelection();
    this.emit('project');
    this.emit('selection');
    this.emit('ui');
    return true;
  }

  /** Replace the working document (import / demo load). Clears history. */
  loadProject(project: StarMapProject, options: { keepSelection?: boolean } = {}): void {
    this.project = deepClone(project);
    this.past = [];
    this.future = [];
    if (!options.keepSelection) this.selectionId = null;
    this.pruneSelection();
    this.emit('project');
    this.emit('selection');
    this.emit('ui');
  }

  select(entityId: string | null): void {
    if (this.selectionId === entityId) return;
    this.selectionId = entityId;
    // The historical rail follows the selection. An explicit pin (setUi with
    // railScopeId) overrides this until the next selection.
    if (entityId !== null && this.ui.railScopeId !== entityId) {
      this.ui = { ...this.ui, railScopeId: entityId };
    }
    this.emit('selection');
  }

  setUi(patch: Partial<UiState>): void {
    let changed = false;
    for (const [key, value] of Object.entries(patch) as Array<[keyof UiState, UiState[keyof UiState]]>) {
      if (this.ui[key] !== value) {
        (this.ui as unknown as Record<string, unknown>)[key as string] = value;
        changed = true;
      }
    }
    if (changed) this.emit('ui');
  }

  toggleExpanded(entityId: string, expanded?: boolean): void {
    const isExpanded = this.ui.expandedIds.includes(entityId);
    const next = expanded ?? !isExpanded;
    if (next === isExpanded) return;
    const expandedIds = next
      ? [...this.ui.expandedIds, entityId]
      : this.ui.expandedIds.filter((id) => id !== entityId);
    this.setUi({ expandedIds });
  }

  setStatus(message: string | null, tone: UiState['statusTone'] = 'neutral'): void {
    this.setUi({ statusMessage: message, statusTone: tone });
  }

  /** Drop a selection that no longer exists (after delete/undo/import). */
  private pruneSelection(): void {
    if (this.selectionId && !this.project.entities.some((e) => e.id === this.selectionId)) {
      this.selectionId = null;
    }
    if (this.ui.focusEntityId && !this.project.entities.some((e) => e.id === this.ui.focusEntityId)) {
      this.ui.focusEntityId = null;
    }
    if (this.ui.railScopeId && !this.project.entities.some((e) => e.id === this.ui.railScopeId)) {
      this.ui.railScopeId = null;
    }
    if (this.ui.viewEntityId && !this.project.entities.some((e) => e.id === this.ui.viewEntityId)) {
      this.ui.viewEntityId = null;
      if (this.ui.view !== 'galaxy') this.ui.view = 'galaxy';
    }
  }

  snapshot(): StoreSnapshot {
    return {
      project: deepClone(this.project),
      selectionId: this.selectionId,
      ui: { ...this.ui, expandedIds: [...this.ui.expandedIds] },
    };
  }
}
