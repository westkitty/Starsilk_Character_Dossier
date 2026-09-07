# STARSiLK Temporal Cartographer — dossier integration seam

This package is a **standalone, framework-neutral** cartographic editor/viewer.
It is intentionally isolated from the Character Dossier generator (`docs/index.html`
must never be hand-edited). Future integration should mount the renderer; it
should not rewrite the dossier publication pipeline.

## Public API

```ts
import { mountStarsilkStarmap, defineStarsilkStarmap } from "./index.ts";
```

### Imperative mount

```ts
const handle = await mountStarsilkStarmap(container, {
  mode: "viewer",                 // or "editor"
  src: "./data/starsilk-map.json", // URL or already-parsed StarMapProject
  startEntityId: "sys-fallenstar",
  startEra: 3,                    // number | "pre-war" | "post-siege-wall" | "main-narrative"
  disableAuthoring: true,
});
handle.destroy();
```

### Custom element

```html
<starsilk-starmap
  mode="viewer"
  src="./data/starsilk-map.json"
  start-entity="sys-fallenstar"
  start-era="3">
</starsilk-starmap>
```

```ts
defineStarsilkStarmap();
```

Viewer mode retains navigation and inspection and hides authoring, import, and
destructive edits. CSS is encapsulated in Shadow DOM and must not leak into the
dossier page. No global store is created.

## Data

- Schema lives in `model/types.ts` (`schemaVersion: 1`).
- Demo archive: `model/demo-project.ts`.
- Validate with `parseProjectJson` / `validateProject` before replacing state.
- Exports are portable JSON. Three.js objects are never serialized.
- Autosave (editor only) uses IndexedDB key `starsilk-temporal-cartographer / autosave`.

## Historical time vs orbital time

These clocks are independent. Hierarchical historical time (`inherit` / `override`
on galaxy → starfield → system → object) resolves world state. Orbital simulation
time only drives revolution, rotation, and trails.

## Canon constraints (do not “fix”)

- Starsilk is a literal programmable cosmological substance. It is not sentient.
- Blood Rings are solid vitrified remains of murdered worlds, not Saturn rings.
- The Siege Wall is a swath of missing starlight / collapsed-star locks, not a
  fence or lattice. The analyst overlay is non-diegetic and off by default.
- Demonstration coordinates are **SCHEMATIC / NON-CANON POSITION**.
- Do not invent a Siege Wall node census or an exact year for the main narrative.
