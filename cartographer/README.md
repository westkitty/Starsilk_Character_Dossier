# STARSiLK Temporal Cartographer

Standalone static authoring subsystem for the STARSiLK Character Dossier repository. It intentionally does not participate in the dossier's Python/Jinja `src/ -> docs/` publication pipeline and does not modify generated dossier output.

## Authority boundary

- Cartographer project JSON is authoritative only for Cartographer-authored spatial, visual, orbital, and historical map state.
- Existing STARSiLK canon authorities remain controlling for canon facts.
- Missing coordinates, dates, populations, relationships, or Siege Wall node counts stay unknown unless sourced.
- Demonstration coordinates are marked `SCHEMATIC / NON-CANON POSITION`.
- The renderer derives Three.js objects from project JSON; Three.js objects are never persistent authority.
- Orbital simulation time and historical/era time are independent systems.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

The production build is static and uses relative asset paths for later GitHub Pages or embedded dossier deployment.

## Authoring data

Project JSON uses `schemaVersion: 1`. The persistent model is defined in `src/core.ts`; historical inheritance/event resolution lives in `src/timeline.ts`; import/export and IndexedDB autosave live in `src/persistence.ts`.

The editor can add, duplicate, reorder, rename, edit, and delete hierarchy entities; edit orbital/visual/provenance data; add/edit/delete timeline events; undo/redo; import/export full projects; and autosave locally in IndexedDB.

## Reusable dossier viewer seam

`src/viewer.ts` exposes both a framework-neutral mount function and a Shadow-DOM Custom Element. Neither assumes ownership of the full page.

### JavaScript mount

```ts
import { mountStarsilkStarmap } from "./viewer.js";

const handle = mountStarsilkStarmap(container, {
  project,
  startEntityId: "system-fallenstar",
  era: 3,
});
```

### Custom Element

Register once:

```ts
import { registerStarsilkStarmap } from "./viewer.js";
registerStarsilkStarmap();
```

Then embed with relative data paths:

```html
<starsilk-starmap
  src="./data/starsilk-map.json"
  start-entity="system-fallenstar"
  era="3">
</starsilk-starmap>
```

Viewer mode retains navigation, selection, and information inspection but exposes no authoring controls. Its CSS is isolated in Shadow DOM. The same schema-versioned project JSON is consumed by editor and viewer, so later dossier integration does not require a second map model.
