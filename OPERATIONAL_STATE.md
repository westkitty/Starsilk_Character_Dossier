# OPERATIONAL_STATE

project_id: starsilk-character-dossier
project_name: Starsilk Compendium
revision: 2

## Current baseline

- Branch baseline before this work: `main` at `e35207b5d4714bd53e02b17af7dce00694d81244`.
- Active implementation branch: `upgrade/canon-infrastructure`.
- Current implementation head before this state update: `c53f03d126d4cc8854507536f5772dd19f0940dd`.
- Pull request: #1, `Add canon infrastructure surfaces`.
- Publication architecture: `src/content/` + `src/templates/` -> `build/generate.py` -> `docs/index.html` -> `build/validate.py`.
- `docs/index.html` is generated output and must not be hand-edited.
- `src/canon/invariants.json` is the machine-readable canon-lock authority.
- `docs/asset-manifest.json` is the published-media provenance ledger.
- `media/source/` contains canonical original media and is intentionally not committed.

## Active invariants

1. Preserve the deterministic source/build/docs pipeline.
2. Preserve existing published Compendium behavior and content.
3. Do not create a second canon source of truth.
4. Do not treat a checksum manifest as a substitute for an independently stored canonical-media backup.
5. Relationship data must be derived from observed xref links unless an explicit semantic authority is introduced later.
6. Reusable canon validation must preserve the existing invariant definitions in `src/canon/invariants.json` rather than duplicating them.
7. Full-document positive canon locks must not be incorrectly required inside a section-scoped fragment; global prohibitions still apply everywhere.

## Implemented, pending verification

- `tools/media_source_archive.py`: verifies canonical originals against provenance and packages a recovery archive only after verification.
- `tools/build_relationship_graph.py`: emits observed entity mention/backlink graph from the published Compendium.
- `tools/validate_canon.py`: candidate/complete reusable canon-validation CLI with corrected document-vs-section completeness scope.
- `tests/test_infrastructure_tools.py`: regression coverage for all three infrastructure surfaces.
- `CANON_INFRASTRUCTURE.md`: authority boundaries and usage documentation.

## Known limitations / unknowns

- An independently stored canonical-media recovery ZIP cannot be created from Git alone because `media/source/` is intentionally absent from the repository. The packaging tool exists, but actual archival remains pending until run where canonical originals are mounted.
- Final verification of this revision depends on GitHub Actions because the active execution environment cannot resolve github.com for a local clone.
- At the time of this state update, the GitHub connector exposed no workflow run or commit status for the PR head. Absence of status is not a pass.

## Pending

- GitHub Actions validation on pull request #1.
- Merge only after the required repository checks are observed passing or an equivalent explicit manual validation is performed.
- Run `python3 tools/media_source_archive.py package` on a machine containing the real `media/source/`, then store the resulting ZIP on durable storage outside this repository.

## Revision log

- Revision 1: initialized canon-infrastructure state.
- Revision 2: recorded PR #1, corrected canon-validation scope semantics, and preserved CI as pending rather than verified.
