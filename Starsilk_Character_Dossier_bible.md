# Starsilk Character Dossier Bible

Append-only project continuity ledger.

## 2026-08-23 — Canon infrastructure expansion

Baseline: `main` at `e35207b5d4714bd53e02b17af7dce00694d81244`.

Purpose preserved: Starsilk Compendium remains a deterministic static publication generated from versioned source, with canon locks and media provenance validated separately from presentation.

Implemented change groups:

1. Canonical-media recoverability tooling
   - Added SHA-256/byte verification against `docs/asset-manifest.json`.
   - Added guarded recovery-ZIP creation for `media/source/`.
   - The tool refuses to package an incomplete or mismatched canonical set.
   - Actual off-repository storage remains an operational step because canonical originals are not present in Git.

2. Entity relationship graph
   - Added a generator that derives entity-to-entity `mentions` edges from the xref links already present in the published Compendium.
   - Output includes entity inventory, directed edges, outgoing relations, and backlinks.
   - No speculative semantic relationship types are inferred.

3. Reusable canon validation
   - Added a CLI around `src/canon/invariants.json` for candidate prose/prompts and complete reference entries.
   - Candidate mode enforces forbidden patterns without requiring every positive identity statement.
   - `--complete` enables positive `must_match` requirements for selected scopes.

Regression coverage: `tests/test_infrastructure_tools.py` exercises relationship generation, forbidden-name validation, section-complete validation, and media verification/package behavior.

Execution limitation: the active shell could not resolve github.com, so a local clone/test run was unavailable. GitHub connector write access was available. Final repository verification therefore belongs to GitHub Actions on the implementation branch/PR; do not upgrade these changes from implemented-unverified to verified until those checks pass.

Do not hand-edit `docs/index.html`. Do not move canon authority out of `src/canon/invariants.json`. Do not claim canonical media is durably backed up merely because provenance metadata or packaging code exists.

## 2026-08-23 — Canon validation scope correction

During pre-merge review, section-complete validation was found to be over-broad: `--complete --section dao` would have required the document-wide positive Blood Eclipse War duration lock inside a Dao-only fragment.

Correction committed as `c53f03d126d4cc8854507536f5772dd19f0940dd`:

- document-wide prohibitions still apply to every candidate;
- positive document locks are required only for full-document completeness;
- positive section locks are required only for explicitly selected sections in section-complete mode.

Pull request: #1 `Add canon infrastructure surfaces`.

Verification state at recording time: implemented-unverified. The GitHub connector exposed no workflow run or commit status for the current PR head, so absence of CI evidence must not be treated as success.

## 2026-08-23 — Hosted Pages and release-gate repair

A direct read of the hosted GitHub Pages URL showed it was serving an older Character Dossier build while `main/docs/index.html` already contained the newer Starsilk Compendium shell. PR #1 was also still unmerged, so its infrastructure additions could not yet be published from the configured `main` / `docs` Pages source.

Release-gate findings and repairs:

- The pinned Playwright Chromium container did not include Debian `ensurepip/python3-venv`; CI failed before tests while attempting to create `.venv`. The containerized job now uses its provided Python directly for dependency installation and pytest.
- `docs/index.html` rebuilt byte-for-byte from authoritative source, but the release gate originally diffed `docs/qa-report.txt` too. That report varies legitimately by runner capabilities and even reports its own directory size. The parity gate now excludes only that telemetry file while continuing to diff every deployable `docs/` artifact.
- `docs/.nojekyll` was added as an explicit static GitHub Pages marker.
- Existing visual baselines had been captured on macOS even though CI intentionally renders in a pinned Linux Playwright container. Baselines were deliberately regenerated in the pinned container rather than weakening thresholds.
- Inspection of the first regenerated captures found two separate issues: a real hidden-placeholder CSS regression on Dao, and lazy images being photographed before decode in long element screenshots.
- Native `[hidden]` semantics are now enforced in the generated shell so the intentional unattached Dao image remains hidden and its designed empty-state card is shown.
- The Balmera Ridge incident WebP was extracted from the repository and independently decoded; the asset itself was valid. The apparent blank panel was test timing, not corrupt media.
- Visual tests now wait for every non-hidden target image to finish loading and decoding before element screenshots. Production lazy-loading behavior remains unchanged.
- Temporary migration jobs used to synchronize generator output and pinned baselines were removed before final verification. The final workflow is read-only.

Verification evidence:

- GitHub Actions run `32622800992` on implementation head `2480789e3a69eee6d8352123288df43a21d4ed9d` passed the Chromium source build, generated-output parity check, whitespace gate, full pytest/Playwright suite, Firefox representative journeys, and WebKit representative journeys.
- The accepted Dao baseline shows the intended empty-state card with no broken placeholder image.
- The accepted Drakken Egg baseline shows the actual Balmera Ridge incident artwork after explicit image settling.
- The accepted Media Vault baseline shows its image galleries populated rather than partially photographed during lazy loading.

Deployment remains a separate proof state: this work is not complete until PR #1 is merged and the public GitHub Pages URL is observed serving the current Compendium build.

## 2026-08-23 — Merge and explicit GitHub Pages deployment path

PR #1 was merged at `6185a26e7f62adda5df3a4c053d3c192f9d9468e` on 2026-08-23. This promotes the verified infrastructure, CI repairs, visual-baseline migration, and generated Compendium output into `main`.

A follow-up `main` commit, `ee9b5eeffefff093bfe6a716d817c27f2286dfb4` (`fix: deploy Compendium docs explicitly to GitHub Pages`), added `.github/workflows/pages.yml`. The workflow explicitly deploys the repository's `docs/` directory using the supported GitHub Pages artifact path:

- `actions/checkout@v4`
- `actions/configure-pages@v5`
- `actions/upload-pages-artifact@v4` with `path: docs`
- `actions/deploy-pages@v4`

It has `pages: write` and `id-token: write`, targets the `github-pages` environment, triggers when `main` changes `docs/**` or the Pages workflow itself, and supports manual dispatch.

Current `main/docs/index.html` contains the intended deployment identity markers:

- document title `Starsilk — Compendium`;
- cover heading `Starsilk Compendium`;
- `Archive tools` mode control;
- unified search field `dossierSearch` with `Search dossier…`.

Proof-state boundary after the repair:

- **Confirmed:** implementation passed the final read-only CI run before merge.
- **Confirmed:** PR #1 is merged.
- **Confirmed:** current `main` contains the intended generated Compendium output and an explicit GitHub Pages deployment workflow.
- **Currently unverifiable from this runtime:** the exact push-triggered Pages deployment run/result for `ee9b5eeffefff093bfe6a716d817c27f2286dfb4`; the GitHub connector available here does not expose that record.
- **Currently unverifiable from this runtime:** the uncached current GitHub Pages edge. The available public-web reader continues to return an older Character Dossier snapshot, but that reader is cache-ambiguous and cannot be forced to refresh; direct origin access is blocked from the execution container.

Do not collapse these states. A merged repository and a configured deploy workflow are not sufficient evidence that a particular edge response has converged. Promote Pages to verified only after an authoritative uncached read or GitHub Pages deployment record confirms the current Compendium markers.
