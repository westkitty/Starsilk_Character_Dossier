# OPERATIONAL_STATE

project_id: starsilk-character-dossier
project_name: Starsilk Compendium
revision: 5

## Current baseline

- Repository default branch: `main`.
- Canon-infrastructure PR #1 merged at `6185a26e7f62adda5df3a4c053d3c192f9d9468e`.
- Pages source-compatibility PR #2 merged at `6c57256b32a6f75f1857919dba3015851e738f97`.
- Pages source-aware self-heal PR #3 merged at `a84a3440c0178ad256bbd5994392bb0d4caf5dde`.
- Live Pages proof PR #4 merged at `5a813a13e13dcaed19f496196de1302572fa9984`.
- Publication architecture remains `src/content/` + `src/templates/` -> `build/generate.py` -> `docs/index.html` -> `build/validate.py`.
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
10. Repository merge state, Pages configuration, Pages build execution, and live-edge content are separate proof states. Never infer one from another.
11. Current GitHub Pages authority is the observed repository setting `build_type=legacy`, source branch `main`, source path `/docs`. Do not assume workflow-mode publishing unless a future Pages API read proves `build_type=workflow`.
12. `.github/workflows/pages.yml` must inspect the active Pages mode before publishing: request a legacy branch-source rebuild when legacy mode is active; use Pages artifact deployment only when workflow mode is active; verify live Compendium markers after publication.

## Verified implementation

GitHub Actions run `32622800992` completed with all required jobs passing on implementation head `2480789e3a69eee6d8352123288df43a21d4ed9d` in the final read-only infrastructure workflow:

- Chromium: build from source passed.
- Chromium: `./tools/build.sh --check` passed.
- Chromium: deployable `docs/` parity passed; only `docs/qa-report.txt` is excluded because it records runner-dependent validation telemetry rather than deployable source output.
- Chromium: `git diff --check` passed.
- Chromium: full pytest + Playwright suite passed, including committed visual regressions.
- Firefox representative journeys passed.
- WebKit representative journeys passed.

Verified infrastructure includes:

- `tools/media_source_archive.py`: verifies canonical originals against provenance and packages a recovery archive only after complete verification.
- `tools/build_relationship_graph.py`: emits an observed entity mention/backlink graph from published xref links.
- `tools/validate_canon.py`: candidate/complete reusable canon validation with corrected document-vs-section completeness scope.
- `tests/test_infrastructure_tools.py`: regression coverage for all three infrastructure surfaces.
- Visual regression tests explicitly wait for non-hidden target images to load/decode before element screenshots.
- The generated site preserves native `[hidden]` behavior for intentionally unattached images.
- CI uses the pinned Playwright container's Python directly instead of attempting an unavailable Debian `venv` bootstrap.

## GitHub Pages deployment state — VERIFIED

### Authoritative configuration

GitHub Actions diagnostic run `32627339040`, job `97164575182`, read the repository Pages API directly and established:

- `build_type=legacy`
- `source_branch=main`
- `source_path=/docs`
- `html_url=https://westkitty.github.io/Starsilk_Character_Dossier/`

This disproved the earlier hypothesis that the site needed to be switched to GitHub Actions. The actual production source is branch-based `main / docs`.

### Publication repair

- PR #2 added a root compatibility redirect, included `index.html` in Pages workflow trigger coverage, and touched `docs/.nojekyll` so legacy branch publication could be retriggered without changing Compendium content.
- PR #3 made `.github/workflows/pages.yml` source-aware. When Pages reports `legacy`, it validates the configured branch/path and requests a Pages branch-source rebuild through the GitHub Pages API. If a future configuration reports `workflow`, it uses `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages` instead.
- PR #3 passed Chromium, Firefox, and WebKit CI before merge.
- PR #4 retained read-only Pages configuration/build diagnostics and a cache-busted live-site proof path; its ordinary Chromium, Firefox, and WebKit CI also passed before merge.

### Authoritative build and live-edge proof

GitHub Actions proof run `32627553716`, job `97165136754`, executed from a fresh GitHub-hosted Ubuntu runner and established all of the following on 2026-08-23:

- Pages configuration remained `legacy / main / docs`.
- Latest GitHub Pages build status: `built`.
- Latest Pages build commit: `a84a3440c0178ad256bbd5994392bb0d4caf5dde`.
- Latest build created: `2026-08-23T08:08:59Z`.
- Latest build updated: `2026-08-23T08:09:28Z`.
- Latest build error: none.
- A cache-busted fetch of `https://westkitty.github.io/Starsilk_Character_Dossier/` from the GitHub runner succeeded and contained all required current-build markers:
  - `Starsilk Compendium`
  - `id="dossierSearch"`
  - `Archive tools`

Therefore the hosted GitHub Pages site is now **verified current**, not merely configured or assumed current. Earlier stale responses from the external public-web reader were cache artifacts and must not override the authoritative Pages build record plus independent fresh runner fetch.

## Known limitations

- An independently stored canonical-media recovery ZIP cannot be created from Git alone because `media/source/` is intentionally absent from the repository. The verification/packaging path is implemented and tested, but the actual archive remains pending until run where canonical originals are mounted.

## Pending

- Run `python3 tools/media_source_archive.py package` on a machine containing the real `media/source/`, then store the resulting ZIP on durable storage outside this repository.

## Revision log

- Revision 1: initialized canon-infrastructure state.
- Revision 2: recorded PR #1, corrected canon-validation scope semantics, and preserved CI as pending rather than verified.
- Revision 3: recorded CI environment/parity repairs, pinned visual-baseline migration, hidden-placeholder fix, and successful final read-only validation run `32622800992`.
- Revision 4: recorded PR #1 merge and the then-unresolved Pages edge-verification gap.
- Revision 5: recorded PRs #2-#4, authoritative Pages configuration `legacy / main / docs`, successful Pages build at `a84a3440c0178ad256bbd5994392bb0d4caf5dde`, and fresh GitHub-runner verification that the public site serves the current Compendium markers.
