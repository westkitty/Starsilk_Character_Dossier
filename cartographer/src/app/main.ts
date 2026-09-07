/**
 * Editor bootstrap.
 *
 * Wires the store, the historical/orbital clocks, the renderer, and the editor
 * chrome together. Nothing here owns authored data: the store is the only writer.
 */

import { createAutosave, createIndexedDbStorage, createMemoryStorage } from '../core/persistence';
import { createProject, entityById } from '../core/project';
import { parseProjectText, exportProject } from './transfer';
import { ProjectStore } from '../core/store';
import { SimulationClock } from '../core/simulation';
import type { StarMapProject } from '../core/types';
import { HierarchyPanel } from './hierarchy';
import { InspectorPanel } from './inspector';
import { ViewportControls } from './viewportControls';
import { StarMapRenderer } from '../render/renderer';
import { createShell, infoDialog, type ShellRefs } from './shell';
import { el } from './dom';
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
    if (!file) return;
    const text = await file.text();
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

  /* panel mount ------------------------------------------------------- */
  hierarchy.mount();
  inspector.mount();
  controls.mount();
  autosave.start();
  autosave.onStatus((status) => setSaveState(status));
  setSaveState(autosave.getStatus());

  // Keep the drawer attribute in sync with UI state (CSS drives the transform).
  store.subscribe(() => {
    refs.root.dataset.drawer = store.ui.drawer;
    refs.undoBtn.disabled = !store.canUndo || !store.authoringEnabled;
    refs.redoBtn.disabled = !store.canRedo || !store.authoringEnabled;
  });
  refs.undoBtn.disabled = !store.canUndo;
  refs.redoBtn.disabled = !store.canRedo;

  /* restore a previous autosaved session ------------------------------ */
  void (async () => {
    const stored = await storage.load();
    if (stored && !options.project) {
      store.loadProject(stored.project);
      store.setStatus(
        `Restored autosaved session “${stored.title}” from ${stored.savedAt}.`,
        'neutral',
      );
      announce('Restored autosaved session.');
    }
  })();

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
    destroy() {
      window.removeEventListener('beforeunload', onBeforeUnload);
      autosave.stop();
      hierarchy.destroy();
      inspector.destroy();
      controls.destroy();
      renderer?.dispose();
      refs.root.remove();
    },
  };
}

const bootHost = typeof document === 'undefined' ? null : document.getElementById('cartographer-root');
if (bootHost) startEditor({ mount: bootHost });

export { entityById };
