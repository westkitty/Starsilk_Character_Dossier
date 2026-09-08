/**
 * Public entry for the embeddable viewer build (`npm run build:viewer`).
 *
 * Everything a host page needs, and nothing it does not:
 *
 *   import { mountStarsilkStarmap, registerStarsilkStarmap } from '.../viewer.js';
 *
 * The editor bootstrap is reachable through `mountStarsilkStarmap({ mode: 'editor' })`;
 * there is no separate global, no window pollution, and no page-level layout
 * assumption anywhere in this surface.
 */

export {
  mountStarsilkStarmap,
  parseEraValue,
  type CartographerHandle,
  type CartographerMode,
  type MountOptions,
} from './mount';
export {
  registerStarsilkStarmap,
  StarsilkStarmapElement,
  STARSILK_STARMAP_TAG,
  type StarsilkStarmapDetail,
} from './element';
export { SCHEMA_VERSION } from '../core/types';
export { validateProject, parseProject } from '../core/schema';
export { createDemoProject } from '../core/demo';
