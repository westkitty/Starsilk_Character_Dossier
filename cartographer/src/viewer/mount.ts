/**
 * Embeddable viewer seam.
 *
 * This is the surface a future Starsilk Character Dossier page will use:
 *
 *   <starsilk-starmap mode="viewer" src="./data/starsilk-map.json"
 *                     entity="fallenstar-prime" era="bew-3"></starsilk-starmap>
 *
 * or, imperatively:
 *
 *   import { mountStarsilkStarmap } from 'starsilk-temporal-cartographer/viewer';
 *   const handle = mountStarsilkStarmap(container, {
 *     mode: 'viewer',
 *     project: json,              // or `src` for a relative fetch
 *     entity: 'fallenstar-system',
 *     era: 'bew-170',
 *   });
 *   handle.destroy();
 *
 * Guarantees this seam must keep:
 *  - styles are injected into a shadow root, never into the host document;
 *  - no globals are created and no page-level layout is assumed;
 *  - authoring controls are disabled in `viewer` mode while navigation and
 *    inspection remain available;
 *  - `src` resolves relative to the embedding document.
 */

import cssText from '../styles/cartographer.css?inline';
import { validateProject, parseProject } from '../core/schema';
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
  /** Orbital scale to open on. Defaults to `system` when an entity is given. */
  view?: 'galaxy' | 'sector' | 'system';
  /** Disable autosave entirely (the embed should never write to the host origin). */
  autosave?: boolean;
  /** Called when the viewer signals it wants the host page to do something. */
  onNavigate?: (detail: { entityId: string; name: string }) => void;
  /** Called with import/validation problems instead of throwing. */
  onError?: (error: Error) => void;
}

export interface CartographerHandle {
  readonly element: HTMLElement;
  readonly mode: CartographerMode;
  /** Replace the loaded project at runtime. */
  setProject(project: unknown): boolean;
  /** Move to an era without touching orbital animation. */
  setEra(era: TimeValue): void;
  /** Focus an entity by id or name. */
  focusEntity(idOrName: string): boolean;
  /** Tear down listeners, WebGL context, and DOM. */
  destroy(): void;
}

function attachStyles(root: ShadowRoot | HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = cssText;
  root.appendChild(style);
}

/**
 * Mount the Cartographer into `container`.
 *
 * Phase 1 of the build ships the documented seam with a static, dependency-free
 * surface: it validates the document, resolves the requested era, and lists the
 * resolved entities. The interactive Three.js surface attaches to the same handle
 * in a later phase without changing this API.
 */
export function mountStarsilkStarmap(
  container: HTMLElement,
  options: MountOptions = {},
): CartographerHandle {
  const mode: CartographerMode = options.mode === 'editor' ? 'editor' : 'viewer';
  const host = el('div', { class: 'sktc-host', style: 'width:100%;height:100%;min-height:240px' });
  const shadow = container.attachShadow ? container.attachShadow({ mode: 'open' }) : null;
  const styleRoot: ShadowRoot | HTMLElement = shadow ?? container;
  attachStyles(styleRoot);

  const frame = el('div', { class: 'sktc', dataset: { mode } });
  const title = el('h2', {
    class: 'sktc-brand-name',
    style: 'margin:0;padding:8px 10px;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.2em',
    text: 'STARSiLK STAR MAP',
  });
  const body = el('div', { class: 'sktc-panel-body' });
  frame.append(title, body);
  host.append(frame);
  (shadow ?? container).append(host);

  let project: StarMapProject | null = null;
  let destroyed = false;

  const report = (error: Error) => {
    options.onError?.(error);
  };

  const renderStatic = () => {
    body.textContent = '';
    if (!project) {
      body.append(el('p', { class: 'sktc-note', text: 'No project loaded.' }));
      return;
    }
    const eraLabel =
      options.era === undefined
        ? 'author default'
        : typeof options.era === 'number'
          ? `YEAR ${options.era}`
          : String(options.era);
    body.append(
      el('dl', { class: 'sktc-kv' }, [
        el('dt', { text: 'PROJECT' }),
        el('dd', { text: project.title }),
        el('dt', { text: 'SCHEMA' }),
        el('dd', { text: String(project.schemaVersion) }),
        el('dt', { text: 'ENTITIES' }),
        el('dd', { text: String(project.entities.length) }),
        el('dt', { text: 'ERA' }),
        el('dd', { text: eraLabel }),
        el('dt', { text: 'MODE' }),
        el('dd', { text: mode === 'viewer' ? 'VIEWER (READ-ONLY)' : 'EDITOR' }),
      ]),
    );
    const list = el('ul', { class: 'sktc-dialog__list' }, [
      ...project.entities.map((entity) =>
        el('li', { text: `${entity.type.toUpperCase()} — ${entity.name}` }),
      ),
    ]);
    body.append(list);
  };

  const apply = (candidate: unknown): boolean => {
    const result = validateProject(candidate);
    if (!result.ok || !result.project) {
      report(new Error(`Invalid STARSiLK map project: ${result.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`));
      return false;
    }
    project = result.project;
    renderStatic();
    return true;
  };

  if (options.project) apply(options.project);
  else if (options.src) {
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
        if (!destroyed) {
          project = result.project;
          renderStatic();
        }
      })
      .catch((error: Error) => report(error));
  }

  return {
    element: host,
    mode,
    setProject: apply,
    setEra(era) {
      options.era = era;
      renderStatic();
    },
    focusEntity(idOrName) {
      const match = project?.entities.find(
        (entity) => entity.id === idOrName || entity.name.toLowerCase() === idOrName.toLowerCase(),
      );
      if (!match) return false;
      options.onNavigate?.({ entityId: match.id, name: match.name });
      return true;
    },
    destroy() {
      destroyed = true;
      host.remove();
    },
  };
}
