/**
 * Embeddable viewer seam — the surface a Starsilk Character Dossier page uses.
 *
 *   <starsilk-starmap mode="viewer" src="./data/starsilk-map.json"
 *                     entity="planet-fallenstar-prime" era="3"></starsilk-starmap>
 *
 * or, imperatively:
 *
 *   import { mountStarsilkStarmap } from 'starsilk-temporal-cartographer/viewer';
 *   const handle = mountStarsilkStarmap(container, {
 *     mode: 'viewer',
 *     project: json,              // or `src` for a relative fetch
 *     entity: 'system-fallenstar',
 *     era: 'bew-170',
 *   });
 *   handle.destroy();
 *
 * Guarantees this seam keeps:
 *  - all styles go into a shadow root; nothing is injected into the host document;
 *  - no globals are created and no page-level layout is assumed (the component
 *    fills its container and never owns the page);
 *  - `viewer` mode disables authoring (document edits, events, import, undo) while
 *    navigation, inspection, and historical-era scrubbing stay available;
 *  - keyboard shortcuts are scoped to the component, so the host page keeps its keys;
 *  - no Three.js object is ever exposed through this API — only authored data.
 */

import cssText from '../styles/cartographer.css?inline';
import { startEditor, type EditorHandle } from '../app/main';
import { parseProject } from '../core/schema';
import { ancestorsOf, entityById } from '../core/project';
import type { StarMapProject, TimeValue } from '../core/types';
import { el } from '../app/dom';

export type CartographerMode = 'editor' | 'viewer';

export interface MountOptions {
  /** `editor` = full authoring tool. `viewer` = read-only embeddable surface. */
  mode?: CartographerMode;
  /** Project JSON (already parsed). Mutually exclusive with `src`. */
  project?: unknown;
  /** URL (absolute or document-relative) to fetch project JSON from. */
  src?: string;
  /** Entity id (or name) to focus on startup. */
  entity?: string;
  /** Historical era to start at: a preset id or a Blood Eclipse War year. */
  era?: TimeValue;
  /** Orbital scale to open on. Defaults to the entity's own system when given. */
  view?: 'galaxy' | 'sector' | 'system';
  /**
   * Persist autosave to this origin's IndexedDB. Off by default in `viewer` mode:
   * an embed should never write to the host document's storage.
   */
  autosave?: boolean;
  /** Called when the selection changes, so the host page can deep-link. */
  onNavigate?: (detail: { entityId: string; name: string }) => void;
  /** Called with import/validation problems instead of throwing. */
  onError?: (error: Error) => void;
}

export interface CartographerHandle {
  readonly element: HTMLElement;
  readonly mode: CartographerMode;
  /** Replace the loaded project at runtime. Returns false when it is invalid. */
  setProject(project: unknown): boolean;
  /** Move to an era without touching orbital animation. */
  setEra(era: TimeValue): void;
  /** Focus an entity by id or name. */
  focusEntity(idOrName: string): boolean;
  /** The authored document currently on display (null before load). */
  project(): StarMapProject | null;
  /** Tear down listeners, WebGL context, and DOM. */
  destroy(): void;
}

function attachStyles(root: ShadowRoot | HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = cssText;
  root.appendChild(style);
}

/** Resolve an era attribute/option: numeric war years stay numeric. */
export function parseEraValue(value: TimeValue | string | null | undefined): TimeValue | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

/**
 * Mount the Cartographer into `container`.
 *
 * The full interactive application is mounted inside the container's shadow root,
 * so the embedder controls placement and sizing and the component styles only
 * itself.
 */
export function mountStarsilkStarmap(
  container: HTMLElement,
  options: MountOptions = {},
): CartographerHandle {
  const mode: CartographerMode = options.mode === 'editor' ? 'editor' : 'viewer';

  const host = el('div', {
    class: 'sktc-host',
    style: 'display:block;width:100%;height:100%;min-height:320px',
  });
  const shadow = container.attachShadow ? container.attachShadow({ mode: 'open' }) : null;
  const styleRoot: ShadowRoot | HTMLElement = shadow ?? container;
  attachStyles(styleRoot);

  let editor: EditorHandle | null = null;
  let destroyed = false;
  let unsubscribeNavigate: (() => void) | null = null;
  let current: StarMapProject | null = null;

  const report = (error: Error) => options.onError?.(error);

  const start = (project: StarMapProject) => {
    if (destroyed) return;
    editor?.destroy();
    editor = startEditor({
      mount: host,
      project,
      mode,
      // An embed must not write to the host origin unless it explicitly opts in.
      memoryStorage: !(options.autosave ?? mode === 'editor'),
    });
    current = project;

    // Subscribe before applying the startup era/entity so the host page sees the
    // initial focus too, not only later changes.
    unsubscribeNavigate?.();
    const store = editor.store;
    let lastSelection: string | null = null;
    unsubscribeNavigate = store.subscribe((change) => {
      if (change !== 'selection') return;
      const id = store.selectionId;
      if (!id || id === lastSelection) return;
      lastSelection = id;
      const entity = entityById(store.project, id);
      if (entity) options.onNavigate?.({ entityId: entity.id, name: entity.name });
    });

    if (options.era !== undefined) applyEra(options.era);
    if (options.entity) focus(options.entity);
    if (options.view) editor.store.setUi({ view: options.view, viewEntityId: null });
  };

  /** Era is always applied at the galaxy scope: the whole map reads that era. */
  const applyEra = (era: TimeValue) => {
    if (!editor) return;
    const root = editor.store.project.entities.find((entity) => entity.parentId === null);
    if (!root) return;
    editor.store.commit(
      `Set historical era — ${root.name}`,
      (draft) => {
        const target = entityById(draft, root.id);
        if (target) target.time = { mode: 'override', overrideValue: era };
      },
      { kind: 'view' },
    );
  };

  const focus = (idOrName: string): boolean => {
    if (!editor) return false;
    const wanted = idOrName.trim().toLowerCase();
    const match = editor.store.project.entities.find(
      (entity) => entity.id === idOrName || entity.name.toLowerCase() === wanted,
    );
    if (!match) return false;
    editor.store.select(match.id);
    editor.store.setUi({ railScopeId: match.id });

    // If the record lives inside a system, open that system so it is visible.
    const system = ancestorsOf(editor.store.project, match.id).find((a) => a.type === 'system');
    if (system && editor.store.ui.view === 'galaxy') {
      editor.renderer?.enterSystem(system.id);
    }
    editor.renderer?.focusEntity(match.id);
    return true;
  };

  const apply = (candidate: unknown): boolean => {
    const result = parseProject(typeof candidate === 'string' ? candidate : JSON.stringify(candidate));
    if (!result.ok || !result.project) {
      report(
        new Error(
          `Invalid STARSiLK map project: ${result.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
        ),
      );
      return false;
    }
    start(result.project);
    return true;
  };

  (shadow ?? container).append(host);

  if (options.project !== undefined) {
    apply(options.project);
  } else if (options.src) {
    fetch(options.src, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${options.src}`);
        return response.text();
      })
      .then((text) => {
        const result = parseProject(text);
        if (!result.ok || !result.project) {
          throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
        }
        if (!destroyed) start(result.project);
      })
      .catch((error: unknown) => report(error as Error));
  }

  return {
    element: host,
    mode,
    setProject: apply,
    setEra(era) {
      const value = parseEraValue(era);
      if (value === undefined) return;
      if (editor) applyEra(value);
      else options.era = value;
    },
    focusEntity: focus,
    project: () => (editor ? editor.projectSnapshot() : current),
    destroy() {
      destroyed = true;
      unsubscribeNavigate?.();
      unsubscribeNavigate = null;
      editor?.destroy();
      editor = null;
      host.remove();
    },
  };
}
