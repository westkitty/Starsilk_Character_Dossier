# STARSiLK TEMPORAL CARTOGRAPHER

A standalone, browser-only **3D galaxy / star-system authoring tool with hierarchical
historical time**, built for the fictional STARSiLK universe.

> **Branch identity.** This implementation lives on
> `arena/01a07e1c-starsilk-character-dossier` (LLM Arena session), 6 commits, 58 files,
> 205 passing tests, tip `ef84738`. The remote branches
> `feature/temporal-cartographer-2026-09-07` and `feature/temporal-cartographer-2026-09-07-2`
> are a **separate, parallel implementation** by a different agent — same specification,
> different code and layout (`src/core.ts`, `src/editor.ts`, `src/authoring.ts`), and they
> share only the `main` base commit `5537f41` with this one. Do not assume they are
> interchangeable. To give this line of work a clearer name:
> `git push origin arena/01a07e1c-starsilk-character-dossier:refs/heads/llm-arena-temporal-cartographer`

This directory is an **isolated subsystem**. It does not participate in the
`src → build → docs` publication pipeline of the Starsilk Character Dossier, it does
not modify `docs/`, and it is not served by GitHub Pages from `main`. It exists so the
renderer and the authored map data can later be embedded into the dossier without a
rewrite (see **INTEGRATION SEAM** below).

```
cartographer/
  index.html            standalone editor entry
  src/core/             data model, schema, historical-time resolution, store, persistence
  src/render/           Three.js renderer (galaxy points, system bodies, camera, labels, trails)
  src/app/              editor chrome: shell, hierarchy, inspector, time rail, simulation bar
  src/viewer/           embeddable viewer seam (custom element + mount function)
  src/styles/           namespaced stylesheet (`.sktc-*`), injected into a shadow root when embedded
  tests/                vitest unit + integration tests
  data/                 portable demo map JSON (also the `src` target for the viewer example)
```

## Run it

```bash
cd cartographer
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build into cartographer/dist
npm run build:viewer # library build of the embeddable seam into cartographer/dist-viewer
npm run preview      # serve the production build
npm test             # vitest
npm run typecheck    # tsc --noEmit
npm run export:demo  # regenerate data/starsilk-map.json from src/core/demo.ts
```

There is no backend, no account, no telemetry, no analytics, and no CDN runtime
dependency.

## Persistence

Two independent mechanisms, both local:

* **Autosave** (`src/core/persistence.ts`) debounces committed documents into IndexedDB
  (`starsilk-cartographer` / `projects` / `active-project`), degrading to memory when
  IndexedDB is unavailable. Records are validated on the way back in, so a corrupt
  autosave is discarded rather than restored. On startup the standalone app offers an
  explicit **RESTORE / DISCARD** choice; an embedded viewer never prompts and never
  writes to the host origin unless `autosave: true` is passed.
* **Portable JSON** — EXPORT downloads `<slug>.starsilk-map.json`; IMPORT (button or
  drag-and-drop) validates first and reports precise errors instead of discarding state.
  Every document carries `"schemaVersion": 1`, and `src/core/schema.ts` holds the
  migration table for future versions.

`data/starsilk-map.json` is the generated demonstration plate. It is produced by
`npm run export:demo` and `tests/demo.test.ts` fails if the committed copy drifts from
`src/core/demo.ts`.

## The two clocks

The application deliberately keeps **two independent time systems**. They are never
merged.

| | ORBITAL SIMULATION TIME | HISTORICAL / ERA TIME |
|---|---|---|
| Kind | continuous, animated | discrete, authored |
| Drives | revolution, rotation, trails, speed | what exists, what collapsed, what was renamed |
| Controls | PAUSED · 0.1× · 1× · 10× · 100× · CUSTOM | era presets, scrubber, per-scope overrides |
| Source | `src/core/simulation.ts` | `src/core/time.ts` + `src/core/resolve.ts` |

You can pause orbital motion and still scrub history.

## Hierarchical historical time

Historical time exists at four scopes and children inherit unless they override:

```
GALAXY  →  STARFIELD / SECTOR  →  SOLAR SYSTEM  →  INDIVIDUAL OBJECT
```

This is real state, not UI sugar: every entity carries

```json
{ "time": { "mode": "inherit" } }
```

or

```json
{ "time": { "mode": "override", "overrideValue": 121 } }
```

`overrideValue` is either a Blood Eclipse War year (the war spans **170 years**) or an
era preset id such as `main-narrative` for anchors that deliberately carry no supplied
date. **RETURN TO PARENT TIME** sets the entity back to `inherit` and it immediately
resolves against its parent again. Resolution is implemented in
`src/core/resolve.ts` and covered by `tests/resolve.test.ts`.

### How an era is resolved

`resolveHistoricalState(project, { canonOnly })` runs in four passes and returns a
`Map<entityId, ResolvedEntity>`:

1. **Scope walk** — for every entity, walk up to the nearest ancestor carrying an
   `override` (`resolveTimeFor`). `mode` always describes *that entity's own* block: it
   is `override` only when the entity itself carries one, otherwise `inherit` with
   `fromEntityId` naming the supplying ancestor.
2. **Event merge** — the entity's timeline is sorted with `sortEvents` and every event
   at or before the resolved era applies its `statePatch` (shallow, one level of
   nesting). `name` becomes `effectiveName`, `type` becomes `effectiveType`, and a
   `starsilkExtractionCollapse` marks the star collapsed and flips it to `blackHole`.
3. **Absence propagation** — a collapsed star flags its system `systemDestroyed`; all
   non-star descendants of that system, all descendants of an absent ancestor, and all
   records whose creation event is later than the era are marked absent with a reason
   (`before-creation`, `destroyed`, `ancestor-absent`, `system-destroyed`,
   `canon-filtered`).
4. **Canon filter** — with `canonOnly`, `provisional` and `schematic` records are
   dropped from the render set while remaining in the document.

`derivationContextFor(resolution)` is the only bridge into the renderer: it exposes
`present(id)` / `effectiveType(entity)` / `annotate(entity)` and keeps era vocabulary out
of `src/render/*`. Authored values are never mutated to express an era.

### Rail scope

The historical rail edits exactly one scope at a time. Its scope is
`ui.railScopeId ?? selectionId ?? galaxyRoot`, and selecting an entity moves the scope to
it, so the rail follows selection until a scope is pinned explicitly from the rail or from
**EDIT THIS SCOPE ON THE RAIL** in the inspector.

### Demonstration plate

`src/core/demo.ts` builds `STARSiLK DEMONSTRATION PLATE` (`createDemoProject()`): four
sectors, five systems, two Blood Rings, one Starsilk extraction collapse, the Siege Wall
and the Drakken domain, with overrides demonstrated at all three subordinate scopes. Every
coordinate is labelled schematic, no post-war date is invented, and no Siege Wall node
count is asserted. `tests/demo.test.ts` asserts all of that, plus the Blood Ring and
collapse before/after behaviour.

## STARSiLK canon constraints encoded here

* **Starsilk** is a literal, programmable cosmological substance — never metaphorical,
  never sentient.
* Pulling Starsilk from the centre of a star collapses it into a black hole **and
  destroys its star system**. Modelled by the `starsilkExtractionCollapse` event type:
  before the event a star plus an extant system, after it a black hole plus a
  historically destroyed system. Reverse scrubbing restores the earlier *visualisation*;
  it does not imply resurrection.
* A **Blood Ring** is a first-class entity (`type: "bloodRing"`, parented to a planet):
  a huge solid orbital band built from the processed remains of a murdered world. It is
  not an asteroid belt, not Saturn-style dust, and not decorative. It appears at its
  creation event and disappears only at an authored destruction event.
* The **Siege Wall** is not a literal wall. It is rendered as a swath of black absence —
  lost stars, missing light, collapsed stellar systems — never as bricks, panels,
  fencing, force fields, grids, or glowing barriers. The optional `ANALYST OVERLAY —
  NON-DIEGETIC` topology layer is **off by default**.
* Demonstration coordinates are labelled `SCHEMATIC / NON-CANON`. No exact date is
  invented for the main narrative; the era list is a starting point, not an exhaustive
  history.

## Data model

The authored JSON is the source of truth; Three.js objects are runtime derivatives and
are never persisted. Schema lives in `src/core/types.ts`
(`StarMapProject`, `Entity`, `TimelineEvent`, `EraPreset`) with validation and
migration in `src/core/schema.ts`. Every export carries `schemaVersion`.

## INTEGRATION SEAM (dossier embed)

`npm run build:viewer` produces `dist-viewer/starsilk-viewer.js` (+ a `three` chunk and a
`.css` file the viewer does **not** need you to link — it injects the same rules into its
own shadow root). Two equivalent entry points:

```html
<script type="module" src="./cartographer/dist-viewer/starsilk-viewer.js"></script>

<starsilk-starmap mode="viewer"
                  src="./cartographer/data/starsilk-map.json"
                  entity="planet-fallenstar-prime"
                  era="3"></starsilk-starmap>
```

```js
import { mountStarsilkStarmap } from './cartographer/dist-viewer/starsilk-viewer.js';

const handle = mountStarsilkStarmap(container, {
  mode: 'viewer',                  // authoring disabled, inspection kept
  src: './data/starsilk-map.json', // or `project: <parsed JSON or JSON string>`
  entity: 'system-fallenstar',     // start on an entity id or name
  era: 170,                        // era preset id or Blood Eclipse War year
  view: 'system',                  // 'galaxy' | 'sector' | 'system'
  autosave: false,                 // default in viewer mode: never write to the host origin
  onNavigate: ({ entityId, name }) => { /* deep-link into the dossier */ },
  onError: (err) => console.warn(err),
});

handle.setEra('post-siege-wall');   // historical lens, allowed in viewer mode
handle.focusEntity('FIRST BLOOD RING');
handle.project();                   // authored JSON only — never a Three.js object
handle.destroy();
```

Element attributes: `mode`, `src`, `entity`, `era`, `view`, `autosave`. Events:
`starsilk-navigate` and `starsilk-error` (both bubble and are composed, with a `detail`
payload). `element.handle` exposes the imperative API; `element.setEra()` and
`element.focusEntity()` work without remounting. Changing an observed attribute remounts.

`viewer.html` is a working host page for this seam — a light-serif "dossier annex" with
its own palette and a global `* { font-family: Georgia }` rule, embedding the map in
viewer mode with host-side era buttons and an event log. It is built alongside the app
(`dist/viewer.html`, with `dist/data/starsilk-map.json` copied next to it) and is the
fastest way to see the isolation guarantees hold in a real browser.

Guarantees the seam keeps, all covered by `tests/viewer.test.ts`:

* styles go into a shadow root (`.sktc` namespace); nothing is injected into the host
  document and host CSS cannot reach in;
* no globals, no page-level layout assumption — the component fills its container;
* keyboard shortcuts are scoped to the component, so the host page keeps its keys;
* `viewer` mode refuses document edits (`store.commit` with the default `authoring` kind)
  while **era scrubbing keeps working** — commits of kind `view` move the historical lens,
  which is inspection rather than authoring;
* `src` resolves relative to the embedding document; a bad document is reported through
  `onError` / `starsilk-error`, never thrown;
* the API exposes authored JSON only — no `Object3D`, no geometry, no materials.

Header controls carry stable ids (`#sktc-import`, `#sktc-export`, `#sktc-demo`,
`#sktc-undo`, `#sktc-redo`, `#sktc-viewer-mode`, `#sktc-help`) so a host page can hide or
relabel them.

A dossier integration would place the built assets under its own path, ship the map JSON
as data, and render the element inside an existing dossier section. Nothing in this
subsystem writes to `docs/` or `src/content/`.
