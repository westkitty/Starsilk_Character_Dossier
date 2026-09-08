# Temporal Cartographer — Operational State

## Revision 1 — 2026-09-08 — Optimal synthesis branch

### Active branch

`feature/temporal-cartographer-optimal-2026-09-08`

Base at branch creation: `5a93d862ab3938550febfee7d55cdf8d8ec65853`
(`feature/temporal-cartographer-2026-09-07-2`, including the Drakken overwrite sequence).

Parent repository `main` baseline observed before work:
`5537f411354e3a3e83849f8c369cc628d4e5faaf`.

### Protected boundaries

- Do not merge automatically.
- Do not edit generated dossier `/docs` output.
- Cartographer JSON remains authoritative only for Cartographer-authored map state.
- Existing STARSiLK canon sources remain authoritative for lore/canon facts.
- Three.js objects are derived presentation state and never persistent authority.
- Orbital simulation time and historical/era time remain independent.
- Historical time remains hierarchical: galaxy → starfield → system → object.
- Main narrative remains `MAIN NARRATIVE — DATE UNSPECIFIED`; no numeric year may be invented.
- Unsourced coordinates remain `SCHEMATIC / NON-CANON POSITION` or `unknown`.
- Starsilk remains non-sentient.
- Blood Rings remain solid orbital bands, not Saturn-like rings or shields.
- Siege Wall default visualization remains missing light / stellar absence, not a literal wall.

### Implemented in this synthesis

- Branch B modular model/store/render/UI architecture retained as the base.
- Added `src/model/analyst.ts` as a pure analysis layer.
- Added ultimate temporal-authority tracing rather than only immediate-parent provenance.
- Added Palimpsest/composite-time detection and active local-pin inventory.
- Added historical TRACE / WHY explanation data.
- Added DELTA comparison of resolved historical states.
- Added optional field-level truth lattice (`EntityMeta.truth`).
- Added explicit `unknown` position certainty alongside locked/schematic.
- Added knowledge-gap detection and curated structured canon queries.
- Added independent accessible Analyst Mode workstation UI.
- Repaired system-collapse propagation so nested moons, Blood Rings, and structures under planets are destroyed with a collapsed system.
- Added analyst regression tests for authority, composite time, Blood Ring creation, Aureal collapse, nested collapse propagation, truth states, gaps, and queries.

### Evidence state

Implemented in source on synthesis branch: pending commit at this revision.

Runtime/build evidence is not yet claimed. The local worker used for this session cannot resolve github.com / npm network dependencies, so browser/build proof must come from repository CI or another clean runtime after the synthesis commit is pushed.

### Required validation before merge consideration

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. Browser journey:
   - open Analyst Mode
   - TRACE Fallenstar Blood Ring before and after Year 3
   - create divergent local era pin and verify PALIMPSEST marks composite view
   - DELTA Fallenstar Ring Year 0 → Year 3
   - DELTA Aureal star Year 121 → Year 170
   - confirm nested descendant disappears after Aureal system collapse
   - classify a truth field, reload, and verify persistence
   - inspect GAPS and focus a returned entity
   - run `changed-between` and `collapse-affected` queries
5. Confirm viewer mode still exposes no authoring controls.
6. Confirm no changed path outside `cartographer/`.
7. Confirm `main` remains unchanged.
