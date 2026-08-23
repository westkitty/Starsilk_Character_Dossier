# OPERATIONAL_STATE

project_id: starsilk-character-dossier
project_name: Starsilk Compendium
revision: 8

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
13. Canonical-media backup claims require exact manifest verification and a tested restore. The current verified recovery package is anchored to historical source commit `97ae39c745933a024791ed75924f2a5d1d7844a5` and current `docs/asset-manifest.json` provenance.
14. The durable off-repository backup is stored in Google Drive folder `Starsilk Canonical Media Recovery - 2026-08-23`; keep its seven ordered transfer chunks plus verification bundle together. Restore only after reassembly and SHA-256 verification of the final recovery ZIP.
15. Public Archive Tools remain local-only browser maintenance controls with no repository-write path. They must load locked in Reader mode, require the exact search-field unlock phrase for the current page session, and must not persist an unlocked state across reloads.
16. Archive implementation handoff prompts must bind every changed legacy slot to its stable `data-asset-key` captured from authoritative archive markup. Browser-local attachment data is evidence, not canonical repo state, and implementation still requires the exported HTML copy or original local files.

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

Therefore the hosted GitHub Pages site is **verified current**.

## Canonical media recovery state — VERIFIED RESTORABLE AND DURABLY STORED

One-time recovery PR #5 reconstructed the canonical source media from the pre-optimization repository snapshot at commit `97ae39c745933a024791ed75924f2a5d1d7844a5` without merging recovery machinery into production.

GitHub Actions recovery runs proved:

- current manifest expected: 213 canonical source files;
- reconstructed: 213;
- missing: 0;
- mismatched byte counts/SHA-256: 0;
- extras: 0;
- `tools/media_source_archive.py verify`: 213/213 valid;
- guarded recovery package creation succeeded;
- isolated extraction of the produced ZIP succeeded;
- verification of the restored extracted set: 213/213 valid;
- ZIP integrity test passed.

Verified recovery ZIP identity:

- filename: `starsilk-canonical-media-recovery.zip`
- size: `582148268` bytes
- SHA-256: `1228fad6e2a816e9d60082fe377293a07035aae8f5bda1f2fa5cd584bcf0f58a`

The exact ZIP was also reassembled inside the ChatGPT execution runtime from transfer chunks and matched the same size and SHA-256; archive integrity passed there independently.

### Durable external copy

Google Drive folder:

- name: `Starsilk Canonical Media Recovery - 2026-08-23`
- folder ID: `16mSC5uufIW5zGnM__c4x1lFpidXjdGrg`
- URL: `https://drive.google.com/drive/folders/16mSC5uufIW5zGnM__c4x1lFpidXjdGrg`

Because connector ingress is capped below the full archive size, the durable copy is stored as seven ordered GitHub-artifact wrapper ZIPs containing contiguous 80 MiB raw recovery-ZIP chunks (`part-00` through `part-06`) plus `starsilk-media-durable-verification.zip` containing source verification, restore verification, archive size/checksum, and chunk checksums.

All seven Drive chunk files and the verification bundle were downloaded back from Google Drive after upload. Their SHA-256 values matched the GitHub-produced artifact digests exactly. Therefore the off-repository Drive copy is byte-verified end to end, not merely reported present.

To restore from Drive: download all seven `starsilk-media-durable-part-XX.zip` wrappers, extract the single raw `starsilk-canonical-media-recovery.zip.part-XX` file from each, concatenate raw parts in numeric order, require final size `582148268` and SHA-256 `1228fad6e2a816e9d60082fe377293a07035aae8f5bda1f2fa5cd584bcf0f58a`, then extract the recovery ZIP and run `python3 tools/media_source_archive.py verify` against its `media-source/` contents.

## Archive Tools access gate and cover title — VERIFIED

GitHub Actions run `32632022530` applied and verified the bounded frontend change in the pinned Playwright environment before commit:

- Archive Tools are hidden and locked on every load.
- The exact, case-sensitive search-field phrase activates Archive Tools for the current page session.
- Reader mode relocks the controls; the old localStorage persistence key is removed and ignored.
- The public page still has no repository-write path; archive attachments remain browser-local maintenance data rather than canonical lore edits.
- `Starsilk Compendium` remains one source text node and is verified to render on one line without horizontal overflow at 320, 375, 951, 1024, 1280, and 1920 px viewports.
- Generated `docs/index.html` was rebuilt from authoritative `src/` sources.
- Intentional visual baselines were regenerated in the pinned Playwright Linux environment.
- Full Chromium pytest/Playwright suite passed.
- Firefox representative journeys passed.
- WebKit representative journeys passed.
- `./tools/build.sh --check` and `git diff --check` passed.

## Archive implementation prompt handoff — VERIFIED

GitHub Actions run `32634313313` verified the Archive-mode implementation handoff before commit:

- `Copy implementation prompt` is hidden in Reader mode, appears only after the existing exact `ajd` Archive Tools unlock, relocks with Reader mode, and does not persist across reloads.
- All 26 legacy attachment stages expose unique stable archive identities; the focused proof uses authoritative `asset-19` / slot `19` rather than assuming DOM order.
- Local attachment changes are bound to identity captured from authoritative archive markup at initialization rather than inferred later from ordinal DOM position.
- The actual browser clipboard contained the changed-slot manifest with `asset-19`, slot `19`, title `Administration allocation facility`, local filename metadata, and the instruction to validate, stage, commit, push, and land the verified change on `main`.
- The copied handoff requires the locally exported HTML copy or original image files and explicitly blocks implementation for any changed slot whose stable asset identity is missing.
- Exported HTML still embeds locally attached images as data URIs for handoff evidence while stripping the maintenance copy-prompt controls.
- `./tools/build.sh`, `./tools/build.sh --check`, `git diff --check`, focused clipboard/export tests, the full Chromium suite, and representative Firefox/WebKit journeys passed before commit.

## Known limitations

- Google Drive connector transfer ceilings require the durable backup to be stored as verified ordered chunks rather than one 582 MB Drive object. This is a transport constraint, not a content-integrity gap.
- One-time recovery branch `recovery/canonical-media-archive` may remain until branch cleanup is available; its PR is execution-only and must not be merged into production.

## Pending

- None for the canon-infrastructure / hosted-site / canonical-media-recovery upgrade batch.

## Revision log

- Revision 1: initialized canon-infrastructure state.
- Revision 2: recorded PR #1, corrected canon-validation scope semantics, and preserved CI as pending rather than verified.
- Revision 3: recorded CI environment/parity repairs, pinned visual-baseline migration, hidden-placeholder fix, and successful final read-only validation run `32622800992`.
- Revision 4: recorded PR #1 merge and the then-unresolved Pages edge-verification gap.
- Revision 5: recorded PRs #2-#4, authoritative Pages configuration `legacy / main / docs`, successful Pages build at `a84a3440c0178ad256bbd5994392bb0d4caf5dde`, and fresh GitHub-runner verification that the public site serves the current Compendium markers.
- Revision 6: closed the final recovery gap: reconstructed and verified 213/213 canonical originals from Git history, created and restore-tested recovery ZIP `1228fad6...f58a`, stored the backup outside Git in Google Drive, and round-trip SHA-256 verified every Drive transfer chunk plus verification bundle.
- Revision 7: locked Archive Tools behind the session-only search-field phrase gate, removed persisted archive-mode activation, kept `Starsilk Compendium` on one responsive line, regenerated deployable output/visual baselines, and verified Chromium/Firefox/WebKit behavior before commit.
- Revision 8: added the Archive-mode `Copy implementation prompt` handoff, locked changed-slot identity to authoritative `data-asset-key` values, required exported local evidence for implementation, and verified clipboard/export behavior plus full browser regressions before commit.
