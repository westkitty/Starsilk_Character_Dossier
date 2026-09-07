# STARSiLK Temporal Cartographer

Isolated 3D galaxy / starfield / solar-system authoring tool with
**hierarchical historical time** for the STARSiLK universe.

This package is a standalone static web application. It is deliberately **not**
wired into the published Character Dossier (`docs/index.html` is generated and
must never be hand-edited). The renderer and JSON schema are the future
integration seam.

## Run

```bash
cd cartographer
npm install
npm test
npm run typecheck
npm run dev      # http://127.0.0.1:4177
npm run build    # static assets in dist/
```

No backend, accounts, telemetry, or CDN runtime dependency.

## Two clocks

- **Orbital simulation time** — revolution, rotation, trails, play/pause, speed.
- **Historical / era time** — whether a planet, Blood Ring, star, or the Siege
  Wall exists. Independent of orbital animation.

Historical time has four scopes (galaxy → starfield → system → object).
Children inherit; any node may `override`; **Return to parent time** clears the
override.

## Canon (do not “fix”)

- Starsilk is a literal programmable cosmological substance. It is **not** sentient.
- Pulling Starsilk from a stellar core collapses the star into a black hole and
  historically destroys the system (`starsilkExtractionCollapse`).
- A Blood Ring is a solid orbital band of vitrified remains. Not Saturn dust.
- The Siege Wall is a swath of missing starlight / collapsed-star locks. It is
  **not** a fence, lattice, or force field. Analyst overlay is off by default.
- Demonstration coordinates are **SCHEMATIC / NON-CANON POSITION**.
- Blood Eclipse War is 170 years. The main narrative date is unspecified.

## Future dossier integration

See [src/INTEGRATION.md](src/INTEGRATION.md).

```html
<starsilk-starmap
  mode="viewer"
  src="./data/starsilk-map.json"
  start-entity="sys-fallenstar"
  start-era="3"></starsilk-starmap>
```

or

```ts
import { mountStarsilkStarmap } from "./src/index.ts";

await mountStarsilkStarmap(container, {
  mode: "viewer",
  src: "./data/starsilk-map.json",
  startEntityId: "sys-fallenstar",
  startEra: 3,
  disableAuthoring: true,
});
```

Schema: `src/model/types.ts` (`schemaVersion: 1`).
Demo archive: `src/model/demo-project.ts`.
