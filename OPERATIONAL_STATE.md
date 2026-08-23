# OPERATIONAL_STATE

project_id: starsilk-character-dossier
project_name: Starsilk Compendium
revision: 3

## Current baseline

- Branch baseline before this work: `main` at `e35207b5d4714bd53e02b17af7dce00694d81244`.
- Active implementation branch: `upgrade/canon-infrastructure`.
- Verified implementation head: `2480789e3a69eee6d8352123288df43a21d4ed9d`.
- Pull request: #1, `Add canon infrastructure surfaces`.
- Publication architecture: `src/content/` + `src/templates/` -> `build/generate.py` -> `docs/index.html` -> `build/validate.py`.
- `docs/index.html` is generated output and must not be hand-edited as an authority.
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
8. Visual regression references belong to the pinned Playwright Linux environment; visual captures must wait for target images to load and decode rather than depending on lazy-load timing.
9. HTML `hidden` semantics must remain effective even when component CSS sets `display` on the same element.

## Verified on implementation head `2480789e3a69eee6d8352123288df43a21d4ed9d`

GitHub Actions run `32622800992` completed with all required jobs passing in the final read-only workflow:

- Chromium: build from source passed.
- Chromium: `./tools/build.sh --check` passed.
- Chromium: deployable `docs/` parity passed; only `docs/qa-report.txt` is excluded because it records runner-dependent validation telemetry rather than deployable source output.
- Chromium: `git diff --check` passed.
- Chromium: full pytest + Playwright suite passed, including committed visual regressions.
- Firefox representative journeys passed.
- WebKit representative journeys passed.
- No visual-baseline regeneration, auto-commit, or write permission existed in this verification workflow.

Verified changes include:

- `tools/media_source_archive.py`: verifies canonical originals against provenance and packages a recovery archive only after complete verification.
- `tools/build_relationship_graph.py`: emits an observed entity mention/backlink graph from published xref links.
- `tools/validate_canon.py`: candidate/complete reusable canon validation with corrected document-vs-section completeness scope.
- `tests/test_infrastructure_tools.py`: regression coverage for all three infrastructure surfaces.
- Visual regression tests explicitly wait for non-hidden target images to load/decode before element screenshots.
- Visual baselines were regenerated in the pinned Playwright Chromium container and visually inspected before acceptance.
- The generated site preserves native `[hidden]` behavior, fixing the Dao unattached-image placeholder regression without changing production lazy-loading semantics.
- `docs/.nojekyll` marks `/docs` as static GitHub Pages output.
- CI uses the pinned Playwright container's Python directly instead of attempting an unavailable Debian `venv` bootstrap.

## Known limitations / unknowns

- An independently stored canonical-media recovery ZIP cannot be created from Git alone because `media/source/` is intentionally absent from the repository. The verification/packaging path is implemented and tested, but the actual archive remains pending until run where canonical originals are mounted.
- The hosted GitHub Pages URL was observed stale before this repair. Deployment is not considered fixed until PR #1 is merged and the live URL is re-read and shown to match current `main/docs`.

## Pending

- Re-run CI on this documentation-only state update and require the same checks to pass.
- Merge PR #1 only after that final head is green.
- Verify `https://westkitty.github.io/Starsilk_Character_Dossier/` serves the current Compendium build after merge.
- Run `python3 tools/media_source_archive.py package` on a machine containing the real `media/source/`, then store the resulting ZIP on durable storage outside this repository.

## Revision log

- Revision 1: initialized canon-infrastructure state.
- Revision 2: recorded PR #1, corrected canon-validation scope semantics, and preserved CI as pending rather than verified.
- Revision 3: recorded the CI environment/parity repairs, pinned visual-baseline migration, hidden-placeholder fix, and successful final read-only validation run `32622800992` on implementation head `2480789e3a69eee6d8352123288df43a21d4ed9d`.
