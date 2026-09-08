/**
 * Editor bootstrap.
 *
 * Wires the store, the historical/orbital clocks, the renderer, and the editor
 * chrome together. Nothing here owns authored data: the store is the only writer.
 */

import { createAutosave, createIndexedDbStorage, createMemoryStorage } from '../core/persistence';
import {
  addEntity,
  ALLOWED_CHILDREN,
  canContain,
  createProject,
  duplicateEntity,
  entityById,
  removeEntity,
  TYPE_GLYPHS,
} from '../core/project';
import {
  absenceLabel,
  derivationContextFor,
  resolveHistoricalState,
  type ResolvedEntity,
} from '../core/resolve';
import { createDemoProject } from '../core/demo';
import { describeTime, describeTimeShort } from '../core/time';
import { ENTITY_TYPE_LABELS, type EntityType } from '../core/types';
import { exportProject, parseProjectText, readFileText } from './transfer';
import { serializeProject } from '../core/schema';
import { ProjectStore } from '../core/store';
import { SimulationClock } from '../core/simulation';
import type { StarMapProject } from '../core/types';
import { HierarchyPanel } from './hierarchy';
import { InspectorPanel } from './inspector';
import { ViewportControls } from './viewportControls';
import { TimeRail } from './timeRail';
import {
  renderHistorical,
  renderOrbit,
  renderTimeline,
  renderVisual,
} from './inspectorSections';
import { StarMapRenderer } from '../render/renderer';
import { confirmDialog, createShell, infoDialog, type ShellRefs } from './shell';
import { button, el } from './dom';
import { selectInput } from './inspector';
// Standalone app stylesheet. The embeddable viewer injects the same rules into a
// shadow root instead (see src/viewer/mount.ts), so nothing leaks globally there.
import '../styles/cartographer.css';

export interface EditorOptions {
  mount?: HTMLElement;
  project?: StarMapProject;
  /** `viewer` disables authoring mutations (undo/redo included). */
  mode?: 'editor' | 'viewer';
  /** Force in-memory storage (used by tests and by embedded viewers). */
  memoryStorage?: boolean;
  /** Skip WebGL entirely (headless tests). */
  headless?: boolean;
  reducedMotion?: boolean;
}

export interface EditorHandle {
  refs: ShellRefs;
  store: ProjectStore;
  clock: SimulationClock;
  hierarchy: HierarchyPanel;
  inspector: InspectorPanel;
  controls: ViewportControls;
  renderer: StarMapRenderer | null;
  /** The current authored document (never a Three.js object). */
  projectSnapshot: () => StarMapProject;
  destroy(): void;
}

const SAVE_LABELS: Record<string, string> = {
  saved: 'SAVED',
  saving: 'SAVING…',
  unsaved: 'UNSAVED',
  error: 'SAVE FAILED',
};

export function detectReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function startEditor(options: EditorOptions = {}): EditorHandle {
  const mount = options.mount ?? document.getElementById('cartographer-root') ?? document.body;
  const refs = createShell(mount);

  const store = new ProjectStore(options.project ?? createProject());
  store.authoringEnabled = options.mode !== 'viewer';

  const storage = options.memoryStorage ? createMemoryStorage() : createIndexedDbStorage();
  const autosave = createAutosave(
    (listener) => store.subscribe(listener),
    () => store.project,
    storage,
  );

  const reducedMotion = options.reducedMotion ?? detectReducedMotion();
  const clock = new SimulationClock({ speed: store.project.settings.simulation.speed });

  const hierarchy = new HierarchyPanel(refs, store, {}, {});
  const inspector = new InspectorPanel(refs, store, {});

  const renderer = options.headless
    ? null
    : new StarMapRenderer({
        canvasHost: refs.canvasHost,
        overlayHost: refs.overlay,
        fallbackHost: refs.fallback,
        store,
        reducedMotion,
        getDays: () => clock.days,
        onFrame: (delta) => clock.advance(delta),
      });
  const rendererStarted = renderer ? renderer.start() : false;
  if (!rendererStarted) {
    refs.fallback.style.display = '';
  }

  const controls = new ViewportControls({ refs, store, clock, renderer: rendererStarted ? renderer : null });

  /* --------------------------------------------------------------- *
   * HISTORICAL RESOLUTION — recomputed whenever the document changes.
   * --------------------------------------------------------------- */
  let resolution: Map<string, ResolvedEntity> = resolveHistoricalState(store.project, {
    canonOnly: store.project.settings.render.canonOnly,
  });

  const timeRail = new TimeRail({ refs, store, getResolution: () => resolution });

  const refreshHistorical = () => {
    resolution = resolveHistoricalState(store.project, {
      canonOnly: store.project.settings.render.canonOnly,
    });
    if (rendererStarted) renderer?.setHistoricalContext(derivationContextFor(resolution));
    hierarchy.setDecorations({
      isAbsent: (id) => !(resolution.get(id)?.present ?? true),
      displayName: (entity) => {
        const state = resolution.get(entity.id);
        return state && state.effectiveName !== entity.name ? state.effectiveName : undefined;
      },
      glyph: (entity) => {
        const effective = resolution.get(entity.id)?.effectiveType;
        return effective ? (TYPE_GLYPHS[effective] ?? TYPE_GLYPHS[entity.type]) : undefined;
      },
      tag: (entity) => {
        const state = resolution.get(entity.id);
        if (!state) return null;
        const short = describeTimeShort(state.resolution.time, store.project.eraPresets);
        const full = describeTime(state.resolution.time, store.project.eraPresets);
        if (!state.present) {
          return {
            text: 'ABSENT',
            tone: 'absent' as const,
            title: `Historically absent${
              state.absenceReason ? ` ·${absenceLabel(state.absenceReason)}` : ''
            } (scope reads ${full})`,
          };
        }
        const typeChanged = state.effectiveType !== entity.type;
        return {
          text: typeChanged
            ? `${short} · NOW ${ENTITY_TYPE_LABELS[state.effectiveType] ?? state.effectiveType.toUpperCase()}`
            : short,
          tone: state.resolution.mode === 'override' ? ('override' as const) : ('inherit' as const),
          title: `${state.resolution.mode === 'override' ? 'Local override' : 'Inherited'} · ${full}`,
        };
      },
    });
    timeRail.render();
    inspector.render();
  };

  const setSaveState = (status: string) => {
    refs.saveStateEl.textContent = SAVE_LABELS[status] ?? status.toUpperCase();
    refs.saveStateEl.className = `sktc-badge sktc-badge--${
      status === 'saved' ? 'ok' : status === 'error' ? 'danger' : 'warn'
    }`;
  };

  const announce = (message: string) => {
    refs.liveRegion.textContent = message;
  };

  /* header wiring ----------------------------------------------------- */
  refs.undoBtn.addEventListener('click', () => {
    const label = store.undoLabel;
    if (store.undo()) announce(`Undid: ${label ?? 'last change'}`);
  });
  refs.redoBtn.addEventListener('click', () => {
    const label = store.redoLabel;
    if (store.redo()) announce(`Redid: ${label ?? 'last change'}`);
  });
  refs.exportBtn.addEventListener('click', () => {
    exportProject(store.project);
    announce(`Exported ${store.project.title}`);
  });

  const ingestFile = async (file: File) => {
    if (!store.authoringEnabled) {
      store.setStatus('Import is disabled in viewer mode.', 'warn');
      return;
    }
    let text: string;
    try {
      text = await readFileText(file);
    } catch (error) {
      await infoDialog(refs, 'IMPORT FAILED', [
        el('p', { class: 'sktc-warning', text: `Could not read ${file.name}: ${(error as Error).message}` }),
      ]);
      announce('Import failed: the file could not be read.');
      return;
    }
    const outcome = parseProjectText(text, file.name);
    if (!outcome.ok || !outcome.project) {
      await infoDialog(refs, 'IMPORT REFUSED', [
        el('p', { class: 'sktc-warning', text: outcome.message ?? 'Unknown validation failure.' }),
      ]);
      announce('Import refused: invalid project file.');
      return;
    }
    store.loadProject(outcome.project);
    store.setStatus(
      outcome.message ?? `Imported ${outcome.project.title}`,
      outcome.message ? 'warn' : 'neutral',
    );
    announce(`Imported ${outcome.project.title}`);
  };

  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'sktc-hidden',
    ariaHidden: 'true',
    tabIndex: -1,
  }) as HTMLInputElement;
  refs.root.append(fileInput);
  refs.importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) await ingestFile(file);
  });

  /* drag-and-drop import (the IMPORT button remains the accessible path) --- */
  let dragDepth = 0;
  const setDropTarget = (active: boolean) => {
    if (active) refs.root.dataset.dropTarget = 'true';
    else delete refs.root.dataset.dropTarget;
  };
  refs.root.addEventListener('dragenter', (event) => {
    event.preventDefault();
    dragDepth += 1;
    setDropTarget(true);
  });
  refs.root.addEventListener('dragover', (event) => event.preventDefault());
  refs.root.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setDropTarget(false);
  });
  refs.root.addEventListener('drop', async (event) => {
    event.preventDefault();
    dragDepth = 0;
    setDropTarget(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) await ingestFile(file);
  });

  refs.helpBtn.addEventListener('click', () => {
    void infoDialog(refs, 'CARTOGRAPHER NOTES', [
      el('p', {
        class: 'sktc-prose',
        text: 'Two independent clocks are in play. ORBITAL SIMULATION TIME drives revolution, rotation, and trails. HISTORICAL TIME decides what exists, what has collapsed, and what has been renamed. They never merge: you can pause the orbits and still scrub eras.',
      }),
      el('p', {
        class: 'sktc-note',
        text: 'Historical time is hierarchical: GALAXY → SECTOR → SYSTEM → OBJECT. Children inherit unless they carry an override; RETURN TO PARENT TIME resumes inheritance immediately.',
      }),
      el('p', {
        class: 'sktc-note',
        text: 'SHORTCUTS — SPACE play/pause · F focus · L labels · P paths · T trails · DELETE remove · CTRL+Z undo · CTRL+SHIFT+Z redo · ESCAPE dismiss. Every shortcut also has a visible control.',
      }),
      el('p', {
        class: 'sktc-warning',
        text: 'Records marked SCHEMATIC / NON-CANON carry invented coordinates. They must never be cited as canon.',
      }),
    ]);
  });

  /* drawer toggles (narrow screens) ----------------------------------- */
  refs.hierarchyToggle.addEventListener('click', () => {
    store.setUi({ drawer: store.ui.drawer === 'hierarchy' ? 'none' : 'hierarchy' });
  });
  refs.inspectorToggle.addEventListener('click', () => {
    store.setUi({ drawer: store.ui.drawer === 'inspector' ? 'none' : 'inspector' });
  });

  /* reduced-motion changes at runtime --------------------------------- */
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (event: MediaQueryListEvent) => renderer?.setReducedMotion(event.matches);
    motionQuery.addEventListener?.('change', onMotionChange);
  }

  /* inspector sections ------------------------------------------------- */
  inspector.setHooks({
    renderHistorical: (entity) => renderHistorical({ refs, store, resolution }, entity),
    renderOrbit: (entity) => renderOrbit({ refs, store, resolution }, entity),
    renderVisual: (entity) => renderVisual({ refs, store, resolution }, entity),
    renderTimeline: (entity) => renderTimeline({ refs, store, resolution }, entity),
    onSelectEntity: (entityId) => renderer?.focusEntity(entityId),
  });

  /* hierarchy authoring actions --------------------------------------- */
  mountHierarchyActions(refs, store, rendererStarted ? renderer : null);

  /* demo dataset ------------------------------------------------------- */
  refs.demoBtn.addEventListener('click', async () => {
    const confirmed = await confirmDialog(refs, {
      title: 'LOAD DEMONSTRATION PLATE',
      message:
        'Replace the working project with the STARSiLK demonstration plate? Your current project stays in its last export, and this can be undone only by importing that export again.',
      confirmLabel: 'LOAD DEMO',
    });
    if (!confirmed) return;
    store.loadProject(createDemoProject());
    store.setUi({ view: 'galaxy', viewEntityId: null, railScopeId: null });
    store.setStatus(
      'DEMO PLATE LOADED — try: scrub to YEAR 3 for the first Blood Ring, then POST-SIEGE-WALL for the stellar collapse and the Siege Wall.',
      'neutral',
    );
    announce('Demonstration plate loaded.');
  });

  /* viewer mode -------------------------------------------------------- */
  // An embedded viewer must not offer a way back into authoring.
  if (options.mode === 'viewer') {
    refs.viewerModeBtn.remove();
  }

  const syncAuthoringAffordances = () => {
    const readOnly = !store.authoringEnabled;
    refs.importBtn.disabled = readOnly;
    refs.demoBtn.disabled = readOnly;
    refs.undoBtn.disabled = readOnly || !store.canUndo;
    refs.redoBtn.disabled = readOnly || !store.canRedo;
  };

  refs.viewerModeBtn.addEventListener('click', () => {
    const next = !store.authoringEnabled;
    store.authoringEnabled = next;
    refs.viewerModeBtn.setAttribute('aria-pressed', String(!next));
    refs.viewerModeBtn.textContent = next ? 'VIEWER' : 'EDITOR';
    store.setStatus(
      next
        ? 'EDITOR MODE — authoring controls enabled.'
        : 'VIEWER MODE — authoring disabled; navigation and inspection remain available (this is the embeddable dossier surface).',
      next ? 'neutral' : 'warn',
    );
    syncAuthoringAffordances();
    refreshHistorical();
  });

  /* panel mount ------------------------------------------------------- */
  hierarchy.mount();
  inspector.mount();
  timeRail.mount();
  controls.mount();
  autosave.start();
  autosave.onStatus((status) => setSaveState(status));
  setSaveState(autosave.getStatus());

  // The standalone app owns the page, so it takes keyboard focus for shortcuts.
  // An embedded viewer must not (it would scroll or trap the host document).
  if (options.mode !== 'viewer') {
    refs.canvasHost.focus?.({ preventScroll: true });
  }

  store.subscribe((change) => {
    if (change === 'project') refreshHistorical();
  });
  refreshHistorical();

  // Keep the drawer attribute in sync with UI state (CSS drives the transform).
  store.subscribe(() => {
    refs.root.dataset.drawer = store.ui.drawer;
    syncAuthoringAffordances();
  });
  syncAuthoringAffordances();

  /* restore a previous autosaved session ------------------------------ */
  // An embed always supplies its own document, so it never prompts.
  if (options.mode !== 'viewer' && !options.project) {
    void (async () => {
      const stored = await storage.load();
      if (!stored) return;
      if (serializeProject(stored.project) === serializeProject(store.project)) return;
      const restore = await confirmDialog(refs, {
        title: 'RESTORE PREVIOUS SESSION',
        message: `An autosaved session was found: “${stored.title}”, saved ${stored.savedAt}.`,
        confirmLabel: 'RESTORE',
        details: ['Choosing otherwise starts from the current plate; the stored copy is replaced on your next edit.'],
      });
      if (restore) {
        store.loadProject(stored.project);
        store.setStatus(`Restored autosaved session “${stored.title}”.`, 'neutral');
        announce('Restored autosaved session.');
      } else {
        store.setStatus('Starting from the current plate; the previous autosave was left behind.', 'neutral');
        announce('Previous autosave discarded.');
      }
    })();
  }

  const onBeforeUnload = () => {
    void autosave.flush();
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  return {
    refs,
    store,
    clock,
    hierarchy,
    inspector,
    controls,
    renderer: rendererStarted ? renderer : null,
    projectSnapshot: () => store.project,
    destroy() {
      window.removeEventListener('beforeunload', onBeforeUnload);
      autosave.stop();
      hierarchy.destroy();
      inspector.destroy();
      timeRail.destroy();
      controls.destroy();
      renderer?.dispose();
      refs.root.remove();
    },
  };
}

/** ADD / DUPLICATE / DELETE controls for the hierarchy panel. */
function mountHierarchyActions(
  refs: ShellRefs,
  store: ProjectStore,
  renderer: StarMapRenderer | null,
): void {
  const typeSelect = selectInput<EntityType>(
    'system',
    ['starfield', 'system', 'star', 'planet', 'moon', 'bloodRing', 'orbitalStructure', 'largeScaleStructure', 'other'],
    {
      starfield: ENTITY_TYPE_LABELS.starfield,
      system: ENTITY_TYPE_LABELS.system,
      star: ENTITY_TYPE_LABELS.star,
      planet: ENTITY_TYPE_LABELS.planet,
      moon: ENTITY_TYPE_LABELS.moon,
      bloodRing: ENTITY_TYPE_LABELS.bloodRing,
      orbitalStructure: ENTITY_TYPE_LABELS.orbitalStructure,
      largeScaleStructure: ENTITY_TYPE_LABELS.largeScaleStructure,
      other: ENTITY_TYPE_LABELS.other,
    } as Record<EntityType, string>,
    () => {},
    'New entity type',
  );

  const addBtn = button('ADD', { title: 'Add the chosen type under the selected entity' });
  addBtn.addEventListener('click', () => {
    const parent = entityById(store.project, store.selectionId) ?? store.project.entities.find((e) => e.parentId === null);
    if (!parent) return;
    const type = typeSelect.value as EntityType;
    if (!canContain(parent.type, type)) {
      store.setStatus(
        `A ${ENTITY_TYPE_LABELS[parent.type]} cannot contain a ${ENTITY_TYPE_LABELS[type]}. Allowed: ${(
          ALLOWED_CHILDREN[parent.type] ?? []
        ).map((t) => ENTITY_TYPE_LABELS[t]).join(', ')}.`,
        'warn',
      );
      return;
    }
    const siblings = store.project.entities.filter((e) => e.parentId === parent.id).length;
    store.commit(`Add ${ENTITY_TYPE_LABELS[type]}`, (draft) => {
      const result = addEntity(draft, {
        type,
        name: `NEW ${ENTITY_TYPE_LABELS[type]} ${siblings + 1}`,
        parentId: parent.id,
        orbit: type === 'moon' ? undefined : undefined,
      });
      draft.entities = result.project.entities;
      store.select(result.entity.id);
    });
    store.setStatus(`Added ${ENTITY_TYPE_LABELS[type]} under ${parent.name}.`, 'neutral');
  });

  const duplicateBtn = button('DUPLICATE', { title: 'Duplicate the selected entity and its subtree' });
  duplicateBtn.addEventListener('click', () => {
    const id = store.selectionId;
    if (!id) return;
    store.commit('Duplicate entity', (draft) => {
      const result = duplicateEntity(draft, id);
      if (result) {
        draft.entities = result.project.entities;
        store.select(result.entity.id);
      }
    });
  });

  const deleteBtn = button('DELETE', { title: 'Delete the selected entity (with confirmation)', class: 'sktc-btn sktc-btn--danger' });
  deleteBtn.addEventListener('click', async () => {
    const id = store.selectionId;
    if (!id) return;
    const entity = entityById(store.project, id);
    if (!entity) return;
    if (entity.parentId === null) {
      store.setStatus('The galaxy root cannot be deleted.', 'warn');
      return;
    }
    const doomed = store.project.entities.filter((candidate) => {
      let cursor: string | null = candidate.parentId;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        if (cursor === id) return true;
        seen.add(cursor);
        cursor = entityById(store.project, cursor)?.parentId ?? null;
      }
      return false;
    });
    const confirmed = await confirmDialog(refs, {
      title: 'DELETE RECORD',
      message: `Delete “${entity.name}”? Everything parented to it is deleted too. Undoable with Ctrl+Z.`,
      details: doomed.length > 0 ? [`Also deleted: ${doomed.map((d) => d.name).join(', ')}`] : undefined,
      confirmLabel: 'DELETE',
      tone: 'danger',
    });
    if (!confirmed) return;
    store.commit(`Delete ${entity.name}`, (draft) => {
      draft.entities = removeEntity(draft, id).entities;
    });
    store.select(null);
    renderer?.invalidate();
    store.setStatus(`Deleted ${entity.name}.`, 'neutral');
  });

  refs.hierarchyActions.append(
    el('div', { class: 'sktc-field', style: 'flex:1 1 100%' }, [
      el('span', { class: 'sktc-field-label', text: 'ADD UNDER SELECTION' }),
      typeSelect,
    ]),
    addBtn,
    duplicateBtn,
    deleteBtn,
  );
}

const bootHost = typeof document === 'undefined' ? null : document.getElementById('cartographer-root');
if (bootHost) startEditor({ mount: bootHost });

export { entityById };
