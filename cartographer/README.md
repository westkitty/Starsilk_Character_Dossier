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
npm ci
npm test
npm run typecheck
npm run dev      # http://127.0.0.1:4177
npm run build    # static assets in dist/
```

`package-lock.json` is committed and has a clean Ubuntu / Node 22 `npm ci`
validation. Use `npm ci` for reproduction and CI; use `npm install` only when
intentionally changing the dependency graph.

No backend, accounts, telemetry, or CDN runtime dependency.

## Two clocks

- **Orbital simulation time** — revolution, rotation, trails, play/pause, speed.
- **Historical / era time** — whether a planet, Blood Ring, star, or the Siege
  Wall exists. Independent of orbital animation.

Historical time has four scopes (galaxy → starfield → system → object).
Children inherit; any node may `override`; **Return to parent time** clears the
override.

## Analyst Mode — non-diegetic

The editor includes an independent Analyst workstation. It reads the same
schema-versioned project model and does not create a second map authority.

- **PALIMPSEST** — inspect a composite temporal view where selected scopes are
  deliberately pinned to different eras. This is an analytical view and never
  asserts that those eras coexisted.
- **TRACE / WHY?** — explain the selected entity's effective era, ultimate
  temporal authority, inheritance chain, historical state, and causal events.
- **DELTA** — compare one entity across two eras and report creation,
  destruction, transformation, collapse, rename, visual, orbit, and annotation
  changes.
- **TRUTH** — classify fact-level truth separately for existence, name,
  position, orbit, visual treatment, and timeline. Entity-level `canonStatus`
  remains the backwards-compatible fallback.
- **GAPS** — surface unknown positions/orbits, schematic information, and canon
  assertions without source notes. Unknown is never silently converted to a
  coordinate.
- **QUERY** — run curated structured queries over project JSON, not rendered
  Three.js objects.

`src/model/analyst.ts` is pure model logic. The floating workstation in
`src/ui/analyst-panel.ts` is an editor surface over those functions. This keeps
the analysis engine reusable by a later dossier viewer or alternate UI.

### Truth lattice

`EntityMeta.truth` is optional and backwards compatible with existing v1 map
JSON. Explicit field truth overrides the entity fallback. Supported statuses
are locked, working, provisional, schematic, unknown, and editorial.

`positionCanon` distinguishes `locked`, `schematic`, and `unknown`; **unknown**
means that no position is asserted, not that the entity belongs at `(0,0,0)`.

## Canon (do not “fix”)

- Starsilk is a literal programmable cosmological substance. It is **not** sentient.
- Pulling Starsilk from a stellar core collapses the star into a black hole and
  historically destroys the entire system hierarchy (`starsilkExtractionCollapse`).
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
Analyst API: `src/model/analyst.ts`.
