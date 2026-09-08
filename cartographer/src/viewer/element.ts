/**
 * `<starsilk-starmap>` — the custom element form of the viewer seam.
 *
 *   <script type="module" src="./viewer.js"></script>
 *
 *   <starsilk-starmap
 *     mode="viewer"
 *     src="./data/starsilk-map.json"
 *     entity="planet-fallenstar-prime"
 *     era="3">
 *   </starsilk-starmap>
 *
 * Attributes:
 *   mode    "viewer" (default) | "editor"
 *   src     URL of a project document, resolved against the embedding page
 *   entity  entity id or name to open on
 *   era     era preset id ("bew-170") or Blood Eclipse War year ("3")
 *   view    "galaxy" | "sector" | "system"
 *   autosave  "true" opts into IndexedDB autosave on the host origin (off in viewer mode)
 *
 * The element owns a shadow root: the host document's CSS cannot reach in, and
 * none of the Cartographer's CSS leaks out. Sizing is the embedder's job — the
 * element fills its box (`width/height: 100%`, `min-height: 320px`).
 *
 * Events: `starsilk-navigate` (bubbles, composed) whenever the selection changes,
 * with `{ entityId, name }` in `event.detail`.
 */

import { mountStarsilkStarmap, parseEraValue, type CartographerHandle } from './mount';

export const STARSILK_STARMAP_TAG = 'starsilk-starmap';

export interface StarsilkStarmapDetail {
  entityId: string;
  name: string;
}

export class StarsilkStarmapElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['mode', 'src', 'entity', 'era', 'view', 'autosave'];
  }

  #handle: CartographerHandle | null = null;
  #lastOptionsKey = '';

  connectedCallback(): void {
    this.#mount();
  }

  disconnectedCallback(): void {
    this.#handle?.destroy();
    this.#handle = null;
    this.#lastOptionsKey = '';
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    const key = this.#optionsKey();
    if (key === this.#lastOptionsKey) return;
    this.#handle?.destroy();
    this.#handle = null;
    this.#mount();
  }

  /** The mounted handle, for embedders that need imperative control. */
  get handle(): CartographerHandle | null {
    return this.#handle;
  }

  /** Move to an era without remounting. */
  setEra(era: string | number): void {
    const value = parseEraValue(era);
    if (value === undefined) return;
    if (this.#handle) this.#handle.setEra(value);
    else this.setAttribute('era', String(era));
  }

  /** Focus an entity by id or name without remounting. */
  focusEntity(idOrName: string): boolean {
    return this.#handle ? this.#handle.focusEntity(idOrName) : false;
  }

  #optionsKey(): string {
    return StarsilkStarmapElement.observedAttributes
      .map((name) => `${name}=${this.getAttribute(name) ?? ''}`)
      .join('|');
  }

  #mount(): void {
    const era = parseEraValue(this.getAttribute('era'));
    const view = this.getAttribute('view');
    this.#lastOptionsKey = this.#optionsKey();
    this.#handle = mountStarsilkStarmap(this, {
      mode: this.getAttribute('mode') === 'editor' ? 'editor' : 'viewer',
      src: this.getAttribute('src') ?? undefined,
      entity: this.getAttribute('entity') ?? undefined,
      era,
      view: view === 'galaxy' || view === 'sector' || view === 'system' ? view : undefined,
      autosave: this.getAttribute('autosave') === 'true',
      onNavigate: (detail) => {
        this.dispatchEvent(
          new CustomEvent<StarsilkStarmapDetail>('starsilk-navigate', {
            detail,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onError: (error) => {
        this.dispatchEvent(
          new CustomEvent<{ message: string }>('starsilk-error', {
            detail: { message: error.message },
            bubbles: true,
            composed: true,
          }),
        );
      },
    });
  }
}

/**
 * Register the element. Safe to call more than once; returns false in
 * environments without custom elements (SSR, older tooling).
 */
export function registerStarsilkStarmap(name = STARSILK_STARMAP_TAG): boolean {
  if (typeof customElements === 'undefined') return false;
  if (customElements.get(name)) return true;
  customElements.define(name, StarsilkStarmapElement);
  return true;
}

// Importing this module from a `<script type="module">` is all a host page needs
// before it can use the tag.
registerStarsilkStarmap();
