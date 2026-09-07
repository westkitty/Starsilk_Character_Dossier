# OPERATIONAL_STATE

project_id: starsilk-temporal-cartographer
project_name: STARSiLK Temporal Cartographer
revision: 4

## Current baseline

- Isolated standalone subsystem under `cartographer/`.
- Parent repository: `westkitty/Starsilk_Character_Dossier`.
- Parent dossier generated `docs/` output is out of scope and must not be hand-edited.
- Persistent Cartographer state is schema-versioned JSON; Three.js runtime objects are derivatives only.

## Active invariants

1. Preserve the parent dossier source/build/docs pipeline unchanged.
2. Never make Cartographer demo placement or invented dates implied canon.
3. Blood Rings are first-class solid orbital bands, not Saturn-like dust rings or generic energy circles.
4. Siege Wall default representation is missing light / stellar absence, never a literal glowing wall or lattice.
5. Orbital simulation time and historical era time remain independent.
6. Historical time supports galaxy, starfield, system, and individual-object inheritance/override.
7. `starsilkExtractionCollapse` resolves star to black hole and system to historically destroyed after the event.
8. Viewer mode must consume the same project JSON without authoring controls or global CSS leakage.

## Verified

- Phase 4 source provides hierarchy search, constrained add/duplicate/reorder/delete, accessible delete confirmation, editable identity/position/orbit/visual/canon/provenance/timeline controls, undo/redo, canon-only filtering, JSON import/export validation, IndexedDB autosave with save state, responsive mobile drawers, and keyboard equivalents.
- Viewer mode is exposed through both `mountStarsilkStarmap(...)` and a Shadow-DOM `<starsilk-starmap>` custom element consuming the same project JSON with start-entity and era options.
- Eighteen dependency-free schema, authoring, import/export, orbital, and temporal tests pass; complete TypeScript static checking passes using the local Three.js declaration shim.
- Phase 3 resolves historical time at galaxy, starfield, system, and object scope with real inheritance, override, sibling isolation, event markers, exact/custom input, and return-to-parent behavior.
- Blood Ring history renders the solid ring absent before Year 3 and present from Year 3 onward without deleting the event when scrubbing backward.
- `starsilkExtractionCollapse` renders its targeted star as a subdued black hole and marks/hides the historically destroyed system branch after the authored event.
- Siege Wall history is represented by missing stars / black absence; the optional `ANALYST OVERLAY — NON-DIEGETIC` is off by default.
- Fourteen dependency-free schema, hierarchy, orbital, and temporal tests pass.
- Phase 2 source implements one Three.js render-loop owner, galaxy/sector/system views, 10,000-point stress starfield, deterministic Keplerian body motion, labels, bounded trails, orbit paths, click selection, focus/reset camera, pointer/touch OrbitControls, and synchronized hierarchy selection.
- Deterministic orbital tests pass in the dependency-free harness.
- Project schema version 1 exists with stable IDs, parent IDs, canon metadata, timeline events, time inheritance fields, project settings, and import-safe serializable values.
- Core validation rejects duplicate IDs, missing parents, invalid root shape, and parent cycles.
- ProjectStore supports bounded undo/redo plus add/duplicate/delete operations without mutating Three.js runtime state.

## Implemented but unverified

- Vite production build command is defined but cannot be executed in the current isolated runtime because npm dependency download is unavailable.

## Pending

- Phase 5: complete acceptance/bug sweep and integration hardening.
