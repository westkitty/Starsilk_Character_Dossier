# OPERATIONAL_STATE

project_id: starsilk-temporal-cartographer
project_name: STARSiLK Temporal Cartographer
revision: 2

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

- Phase 2 source implements one Three.js render-loop owner, galaxy/sector/system views, 10,000-point stress starfield, deterministic Keplerian body motion, labels, bounded trails, orbit paths, click selection, focus/reset camera, pointer/touch OrbitControls, and synchronized hierarchy selection.
- Deterministic orbital tests pass in the dependency-free harness.
- Project schema version 1 exists with stable IDs, parent IDs, canon metadata, timeline events, time inheritance fields, project settings, and import-safe serializable values.
- Core validation rejects duplicate IDs, missing parents, invalid root shape, and parent cycles.
- ProjectStore supports bounded undo/redo plus add/duplicate/delete operations without mutating Three.js runtime state.

## Implemented but unverified

- Vite production build command is defined but cannot be executed in the current isolated runtime because npm dependency download is unavailable.

## Pending

- Phase 3: hierarchical era resolution and STARSiLK-specific historical mechanics.
- Phase 4: full authoring, persistence, responsive accessibility, and reusable viewer seam.
- Phase 5: complete acceptance/bug sweep and integration hardening.
