/**
 * Editor bootstrap.
 *
 * Phase 1 surface: project document + store + autosave + hierarchy + inspector +
 * JSON import/export. The 3D atlas, historical rail, and simulation bar attach to
 * this same shell in later phases.
 */

import { createAutosave, createIndexedDbStorage, createMemoryStorage } from '../core/persistence';
import { createProject } from '../core/project';
import { parseProjectText, exportProject } from './transfer';
import { ProjectStore } from '../core/store';
import type { StarMapProject } from '../core/types';
import { HierarchyPanel } from './hierarchy';
import { InspectorPanel } from './inspector';
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
}

export interface EditorHandle {
  refs: ShellRefs;
  store: ProjectStore;
  hierarchy: HierarchyPanel;
  inspector: InspectorPanel;
  destroy(): void;
}

const SAVE_LABELS: Record<string, string> = {
  saved: 'SAVED',
  saving: 'SAVING…',
  unsaved: 'UNSAVED',
  error: 'SAVE FAILED',
};

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

  const hierarchy = new HierarchyPanel(refs, store, {}, {});
  const inspector = new InspectorPanel(refs, store, {});

  const setSaveState = (status: string) => {
    refs.saveStateEl.textContent = SAVE_LABELS[status] ?? status.toUpperCase();
    refs.saveStateEl.className = `sktc-badge sktc-badge--${status === 'saved' ? 'ok' : status === 'error' ? 'danger' : 'warn'}`;
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
    hierarchy.render();
    inspector.render();
    store.setStatus(outcome.message ?? `Imported ${outcome.project.title}`, outcome.message ? 'warn' : 'neutral');
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
        class: 'sktc-warning',
        text: 'Records marked SCHEMATIC / NON-CANON carry invented coordinates. They must never be cited as canon.',
      }),
    ]);
  });

  /* panel mount ------------------------------------------------------- */
  hierarchy.mount();
  inspector.mount();
  autosave.start();
  autosave.onStatus((status) => setSaveState(status));
  setSaveState(autosave.getStatus());

  /* restore a previous autosaved session ------------------------------ */
  void (async () => {
    const stored = await storage.load();
    if (stored && !options.project) {
      store.loadProject(stored.project);
      store.setStatus(`Restored autosaved session “${stored.title}” from ${stored.savedAt}.`, 'neutral');
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
    hierarchy,
    inspector,
    destroy() {
      window.removeEventListener('beforeunload', onBeforeUnload);
      autosave.stop();
      hierarchy.destroy();
      inspector.destroy();
      refs.root.remove();
    },
  };
}

const bootHost = typeof document === 'undefined' ? null : document.getElementById('cartographer-root');
if (bootHost) startEditor({ mount: bootHost });
