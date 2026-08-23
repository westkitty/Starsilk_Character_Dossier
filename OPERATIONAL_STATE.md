# OPERATIONAL_STATE

project_id: starsilk-character-dossier
project_name: Starsilk Compendium
revision: 4

## Current baseline

- Repository default branch: `main`.
- Pull request #1, `Add canon infrastructure surfaces`, was merged on 2026-08-23 at merge commit `6185a26e7f62adda5df3a4c053d3c192f9d9468e`.
- Current Pages-deployment commit before this state-only update: `ee9b5eeffefff093bfe6a716d817c27f2286dfb4` (`fix: deploy Compendium docs explicitly to GitHub Pages`).
- Verified implementation head before merge: `2480789e3a69eee6d8352123288df43a21d4ed9d`.
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
10. Repository merge state, Pages deployment configuration, deployment execution, and live-edge content are separate proof states. Never infer the latter from the former.

## Verified implementation

GitHub Actions run `32622800992` completed with all required jobs passing on implementation head `2480789e3a69eee6d8352123288df43a21d4ed9d` in the final read-only workflow:

- Chromium: build from source passed.
- Chromium: `./tools/build.sh --check` passed.
- Chromium: deployable `docs/` parity passed; only `docs/qa-report.txt` is excluded because it records runner-dependent validation telemetry rather than deployable source output.
- Chromium: `git diff --check` passed.
- Chromium: full pytest + Playwright suite passed, including committed visual regressions.
- Firefox representative journeys passed.
- WebKit representative journeys passed.
- No visual-baseline regeneration, auto-commit, or write permission existed in this verification workflow.

Verified implementation includes:

- `tools/media_source_archive.py`: verifies canonical originals against provenance and packages a recovery archive only after complete verification.
- `tools/build_relationship_graph.py`: emits an observed entity mention/backlink graph from published xref links.
- `tools/validate_canon.py`: candidate/complete reusable canon validation with corrected document-vs-section completeness scope.
- `tests/test_infrastructure_tools.py`: regression coverage for all three infrastructure surfaces.
- Visual regression tests explicitly wait for non-hidden target images to load/decode before element screenshots.
- Visual baselines were regenerated in the pinned Playwright Chromium container and visually inspected before acceptance.
- The generated site preserves native `[hidden]` behavior, fixing the Dao unattached-image placeholder regression without changing production lazy-loading semantics.
- `docs/.nojekyll` marks `/docs` as static GitHub Pages output.
- CI uses the pinned Playwright container's Python directly instead of attempting an unavailable Debian `venv` bootstrap.

## Pages deployment state

### Confirmed

- PR #1 is merged into `main`.
- `main/docs/index.html` is the current Compendium build and contains the identity markers `Starsilk — Compendium`, `Starsilk Compendium`, the `Archive tools` control, and unified `dossierSearch` search UI.
- Commit `ee9b5eeffefff093bfe6a716d817c27f2286dfb4` added `.github/workflows/pages.yml` with an explicit GitHub Pages artifact deployment: checkout -> `actions/configure-pages@v5` -> `actions/upload-pages-artifact@v4` for `docs` -> `actions/deploy-pages@v4`.
- The workflow triggers on `main` changes to `docs/**` or to `.github/workflows/pages.yml`, and also supports manual dispatch.

### Currently unverifiable from this runtime

- The connector does not expose the push-triggered Pages workflow run or the repository Pages deployment record for commit `ee9b5eeffefff093bfe6a716d817c27f2286dfb4`.
- The available public-web reader still returns an older Character Dossier snapshot (`Starsilk — Character Dossier`, `Filter sections...`, `STAR SILK DOSSIER`), but that reader is cache-ambiguous and does not expose a crawl timestamp precise enough to prove current edge state.
- Direct origin retrieval from the execution container is unavailable because outbound DNS/network access to the Pages host is blocked.

Therefore: repository implementation and deployment configuration are fixed and confirmed; actual current GitHub Pages edge convergence must remain `currently-unverifiable` rather than being promoted to `verified` from cached evidence.

## Known limitations

- An independently stored canonical-media recovery ZIP cannot be created from Git alone because `media/source/` is intentionally absent from the repository. The verification/packaging path is implemented and tested, but the actual archive remains pending until run where canonical originals are mounted.

## Pending

- Obtain one authoritative uncached read of `https://westkitty.github.io/Starsilk_Character_Dossier/` or a GitHub Pages deployment record and confirm it contains the current Compendium identity markers from `main/docs/index.html`.
- Run `python3 tools/media_source_archive.py package` on a machine containing the real `media/source/`, then store the resulting ZIP on durable storage outside this repository.

## Revision log

- Revision 1: initialized canon-infrastructure state.
- Revision 2: recorded PR #1, corrected canon-validation scope semantics, and preserved CI as pending rather than verified.
- Revision 3: recorded the CI environment/parity repairs, pinned visual-baseline migration, hidden-placeholder fix, and successful final read-only validation run `32622800992` on implementation head `2480789e3a69eee6d8352123288df43a21d4ed9d`.
- Revision 4: recorded PR #1 merge, explicit Pages deployment workflow commit `ee9b5eeffefff093bfe6a716d817c27f2286dfb4`, current deployable identity markers, and the remaining cache/network limitation preventing an authoritative live-edge verification.
