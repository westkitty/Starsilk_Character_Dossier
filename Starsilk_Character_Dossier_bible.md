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

## 2026-08-23 — GitHub Pages source diagnosis and verified live repair

The earlier hypothesis that repository Settings needed to be switched to GitHub Actions was tested rather than assumed. A read-only GitHub Actions diagnostic queried the repository Pages API directly. Run `32627339040`, job `97164575182`, reported the actual production configuration:

- `build_type=legacy`
- `source_branch=main`
- `source_path=/docs`
- `html_url=https://westkitty.github.io/Starsilk_Character_Dossier/`

Therefore the actual production site was and remains branch-based `main / docs`; switching to workflow mode was not required to fix the stale publication.

Three bounded publication repairs followed:

1. PR #2, merged at `6c57256b32a6f75f1857919dba3015851e738f97`, added a repository-root compatibility redirect for a possible root source, expanded Pages workflow trigger coverage, and touched `docs/.nojekyll` to force a legacy docs-source rebuild without changing Compendium content.
2. PR #3, merged at `a84a3440c0178ad256bbd5994392bb0d4caf5dde`, made `.github/workflows/pages.yml` inspect the active Pages `build_type`. In legacy mode it validates the source and explicitly requests a GitHub Pages branch-source rebuild; in workflow mode it uses the Pages artifact deployment path. Publication refuses to report success until live Compendium markers appear.
3. PR #4, merged at `5a813a13e13dcaed19f496196de1302572fa9984`, retained read-only Pages configuration/build diagnostics and a cache-busted live-site proof check for future regressions.

All three browser lanes passed before the publication workflow changes were merged: Chromium full pytest/Playwright, Firefox representative journeys, and WebKit representative journeys.

Final deployment proof came from GitHub Actions run `32627553716`, job `97165136754`, on a fresh GitHub-hosted Ubuntu runner. It established:

- active source still `legacy / main / docs`;
- latest Pages build status `built`;
- latest Pages build commit `a84a3440c0178ad256bbd5994392bb0d4caf5dde`;
- build created `2026-08-23T08:08:59Z` and updated `2026-08-23T08:09:28Z`;
- no Pages build error;
- a cache-busted fetch of the real public URL contained all three current-build markers: `Starsilk Compendium`, `id="dossierSearch"`, and `Archive tools`.

This closes the stale-hosted-site incident. The public GitHub Pages deployment is **verified current**. Earlier stale responses from the external web reader were cache artifacts and are superseded by the authoritative Pages build record plus the fresh GitHub-runner fetch.

Durable rule: do not infer GitHub Pages mode from the existence of a workflow file. Read the Pages API first; then use the publication path that matches the observed `build_type` and verify the live endpoint independently.

## 2026-08-24 — Museum + AI program complete: Phase 12 final root-integration repair

Baseline: `main` at `75e75dc` (Phase 12 Part A -- the agent evaluation harness, PR #39 -- already merged at `3431f14941f20a0105ac70275360d6aaa07f6014`, with formal state closure still open).

Purpose preserved: the Starsilk Compendium/Museum remains one deterministic static publication generated from versioned source; no canon prose was rewritten, no stable ID changed, no relationship/chronology/WorldsVault fact was invented, and media provenance was untouched.

The problem: Phases 3-10 had built eight real public museum systems (`/discover/`, `/entities/`, `/objects/`, `/relationships/`, `/canon/`, `/tours/`, `/chronology/`, `/worldsvault/`), and Phase 12 Part A had published an agent evaluation harness on top of them -- but the root page (`/`) still rendered as the original dossier-only Compendium shell. A visitor opening `/` had no visible way to discover that any of those eight systems existed. That is a real integration defect, not a missing feature: every system worked in isolation but the project did not present as one museum.

Implemented change group (branch `fix/unified-museum-final-integration`, PR #42):

1. Shared navigation
   - Added `src/templates/_museum_nav.html.j2`, one Jinja partial included by the root shell and all eight secondary system templates plus entity records. Each template sets `nav_root`/`nav_current` before the include; no build-script (`build/*.py`) changes were needed for this, since every generator already shares the same `src/templates/` Jinja loader.
   - Replaced each system's previously inconsistent, partial local header nav (some linked to three sibling systems, some to none) with the same complete ten-destination navigation everywhere, plus a secondary Data/AI panel.
2. Root museum entrance
   - Added a hero, eight visitor-facing exploration cards (one per system), a Data/AI strip, and a lead-in section to `src/templates/shell.html.j2`, all ahead of the unchanged, unabridged Compendium.
   - Added `load_museum_stats()` to `build/generate.py`: every hero statistic (record count, museum object count, cross-reference count, chronology event count, tour count, canon lock count) is computed from existing source/generated files at build time, never hand-written.
   - Marked the shell `data-museum-shell="unified"` on the root `<body>` and on every page's rendered nav header, as a deterministic, test-checked integration marker.
3. Visitor-facing cleanup
   - Normalized "Phase 7"/"Phase 8" eyebrow labels on Discover/Tours to plain museum language. Internal documents (this ledger, the roadmap, operational state) still record full phase history; that is presentation cleanup, not a canon or record change.
4. Layout fixes found during verification
   - The fixed dossier sidebar (`.index`) and the new nav bar both anchored near the top-left corner; fixed the sidebar's `top`/`max-height` to clear the nav bar at every breakpoint, and gave the nav a compact two-row, horizontally-scrolling mobile layout instead of letting ten links wrap unbounded.
   - Removed a `.museum-entrance{isolation:isolate}` rule that had trapped the nav's `z-index` inside its own stacking context, which let the fixed sidebar visually cover the new nav bar on narrow viewports.
5. Test repairs (three, all caused by the cover section legitimately no longer being the first thing in the viewport)
   - `test_watermark_pauses_while_cover_dominant`: the ambient watermark now correctly plays at initial load (the hero, not the cover, is on screen) and pauses once the reader actually scrolls to the cover -- updated the test to assert the new, correct sequence rather than the old load-time assumption.
   - `test_portable_release_package_is_self_contained`: a natively lazy-loaded canon image sits far enough below the fold now that it needs an explicit scroll to trigger browser lazy-loading, matching real reader behavior -- added that scroll before the wait.
   - `test_cover_title_is_starsilk_compendium`: updated the expected `<title>` from `Starsilk — Compendium` to `Starsilk Museum & Compendium`.
6. New coverage
   - Added `tests/test_unified_museum_shell.py`: marker presence, full navigation coverage from the root, exploration cards, derived-not-hardcoded hero statistics, every system resolving on disk and carrying the same shell with a working "back to home" link, entity records also carrying the shell, and no external runtime dependency in the shared nav -- plus two Chromium browser journeys.
   - Added a unified-shell journey to `tests/test_cross_browser.py`, run on Chromium, Firefox, and WebKit.

Visual regression baselines for the seven screenshots whose layout legitimately changed (`cover-desktop`, `cover-mobile`, `cover-reduced-motion`, `drakken-the-egg`, `media-vault`, `peripheral-index`, `principal-dao`) were regenerated inside the exact pinned CI Playwright container (`mcr.microsoft.com/playwright/python:v1.62.0-noble`), via a temporary `workflow_dispatch` runner added, triggered, and then removed once its commit landed -- following this repository's own established pattern (see the immediately preceding chore commits on `main`) for one-time pinned-environment operations rather than trusting locally-captured macOS screenshots as references.

Verification before merge:

- `./tools/build.sh` and `./tools/build.sh --check` -- deterministic, clean.
- `.venv/bin/python3 build/validate.py --strict` -- 0 violations (duplicate ids, broken anchors, local asset paths, data URIs, path leaks, external dependencies, section counts, disclosure semantics, JS syntax, canon invariants, Drakken art identities, manifest invariants all clean).
- `tools/check_public_boundary.py` over every generated public surface -- OK, 576 files.
- `git diff --check` -- clean.
- Full pytest suite: 180 passed (Chromium), including the two new test files.
- `tests/test_cross_browser.py` on Chromium, Firefox, and WebKit -- all passed.
- PR #42 CI run `32682068700` -- all three required jobs (Chromium build+validate+test, Firefox journeys, WebKit journeys) passed green.

Merge and live publication:

- PR #42 merged at `e2950ec0645f699fcd311f891129e7b558285476`.
- GitHub Pages built that commit (`pages/builds/1170882630`, status `built`, matching `last-modified` header on the live response).
- Independent cache-busted live verification confirmed the unified-shell marker, hero navigation, and derived statistics at `https://westkitty.github.io/Starsilk_Character_Dossier/`, and HTTP 200 with the same marker at `/discover/`, `/entities/`, `/objects/`, `/relationships/`, `/canon/`, `/tours/`, `/chronology/`, `/worldsvault/`, and a representative entity record (`/entities/codec/`).

This closes the Museum + AI program. All twelve phases are now `COMPLETE` with inspectable evidence (see `MUSEUM_AI_ROADMAP.md`); `OPERATIONAL_STATE.md` revision 20 records the same closure. There is no Phase 13 -- further work on this project is ordinary maintenance against the finished museum, not a new program phase.

## 2026-09-15 — Reader Workbench forensic uplift, implementation evidence only

An additive root Reader Workbench was added through the existing template/generator path. It uses existing stable section IDs and rendered in-document cross-reference anchors only, keeps queue/saved/recent/comparison/preferences and bounded counters in browser-local state, and does not author lore, infer semantic relationships, add a service, or request remote code. The current unclosed uplift adds local ID/title/group search, inventory and citation counts, genuine different-record random selection, real prior-session resume, queue navigation/reorder/reversal, narrow local clears, stable-link copy surfaces, dismissible guidance, active-preference/import summaries, export-schema explanation, and a current-record-only Thread Atlas with next-unvisited navigation and stable-ID evidence copy. `tests/test_forensic_uplift.py` prepares adversarial production-path coverage for local-state sanitization, local-storage fallback, queue/saved/recent/comparison controls, preferences/guidance/keyboard control, hostile import handling, copy/export boundaries, exact rendered-xref Atlas behavior, mobile targets, reduced-motion scrolling, and post-load request auditing.

Pre-delivery proof now exists outside the coding sandbox: the focused Chromium Workbench suite passed 6/6, representative Firefox and WebKit journeys passed 12/12 each, and a CI-like copy excluding only the intentionally uncommitted `media/source/` passed deterministic build/check, strict validation, public-boundary validation across 576 files, and the 42-node / 92-edge derivation map. Strict validation held 16 canon locks at zero violations and all 36 Drakken art assertions. Authoritative GitHub Actions run `35031504532` then passed pinned Linux Chromium at 242 passed / 1 skipped plus Firefox 12/12 and WebKit 12/12, with exact-base Operational State freshness and deterministic docs parity. No visual baseline was changed. Protected merge and live Pages proof remain the final closure gates. There is no Phase 13.

Closure evidence: PR #64 merged at `1828b0f1cff57b9107cc548b5fa49deba6139839`. Exact-state PR CI `35031829035` and main CI `35032076500` passed; Pages publish `35032076495`, Pages deployment `35032090194`, and Build Provenance succeeded. Cache-busted live proof matched `docs/index.html` byte-for-byte at SHA-256 `c0eea9e3a0412ed0f9c5f78e08cf1061ec10d2d861d1fb9925209dd187380811` and `docs/service-worker.js` at SHA-256 `c87b3dd810d93256296c265872048904cffa4d5357988e7008f3c7cfeb74c304`, with the Reader Workbench and Thread Atlas markers present on the live root. The 100-item uplift plus WOW-01 is closed; no Phase 13 was created.


## 2026-09-18 — Cross-Surface Record Explorer implementation and local verification

Implementation commit: `a7f6f17db45c285ff1aaf3fd2472392a8a049203` (`feat: add cross-surface record explorer`).

Summary:
- Added a deterministic Cross-Surface Record Explorer keyed only by the 127 existing stable top-level Compendium record IDs.
- Added `/records/` human search/facet UI, full `records.json` evidence index, compact offline `search.json`, versioned schema and explicit derivative-only authority contract.
- Added an `Explore this record` context map plus accessible text equivalent to every entity permalink.
- Integrated the explorer into machine orientation, sitemap, shared museum navigation, offline publication, derivation topology, README and regression coverage.
- Preserved evidence classes rather than collapsing them into a semantic graph. Existing `observed-xref` edges remain `mentions`; chronology, canon locks, WorldsVault references and Film Vault references appear only where their owning source explicitly supports the stable record.

Reason / Intent:
- Make existing Starsilk records navigable across already-published evidence surfaces without inventing a second canon, stronger relationship semantics, unsupported chronology or new object identities.
- Keep the result static, deterministic, privacy-preserving and within the established offline-shell budget.

Files Changed:
- New authoritative/implementation surfaces: `src/records/AUTHORITY.md`, `src/schema/cross-surface-record-index.schema.json`, `build/record_explorer.py`, `src/templates/records.{html.j2,css,js}`.
- Existing integration surfaces: `build/entity_publication.py`, `build/machine_publication.py`, `src/templates/entity.html.j2`, `src/templates/entity.css`, `src/templates/_museum_nav.html.j2`, `src/offline/config.json`, `src/system/derivation-map.json`, `tools/build.sh`, `README.md`, `OPERATIONAL_STATE.md`.
- Tests: `tests/test_cross_surface_record_explorer.py`, `tests/test_cross_browser.py`, `tests/test_machine_publication.py`.
- Generated public derivatives: `docs/records/**`, versioned machine schema, machine index/orientation/sitemap, service worker, shared-nav pages and all 127 generated entity permalinks.

Commands Run:
```sh
git fetch origin --prune
git merge-base --is-ancestor feature/administration-film-vault origin/main
git switch -c feature/cross-surface-record-explorer origin/main
./tools/build.sh --check
.venv/bin/python3 -m pytest tests/test_cross_surface_record_explorer.py tests/test_machine_publication.py tests/test_derivation_map.py tests/test_entity_permalinks.py -q
.venv/bin/python3 -m pytest tests/test_offline_museum.py --browser chromium -q
.venv/bin/python3 -m pytest tests/test_cross_browser.py --browser chromium -q
.venv/bin/python3 -m pytest tests/test_cross_browser.py --browser firefox -q
.venv/bin/python3 -m pytest tests/test_cross_browser.py --browser webkit -q
.venv/bin/python3 tools/validate_derivation_map.py --write
.venv/bin/python3 tools/check_operational_state_freshness.py --base-ref origin/main
git diff --check
git commit -m "feat: add cross-surface record explorer"
```

Command Intent:
- Prove the previous Film Vault branch was already incorporated before branching from current `origin/main`.
- Verify deterministic publication parity, strict canon/media/public-boundary invariants, evidence-class behavior, entity integration, offline behavior and representative browser journeys.
- Keep Git delivery limited to the bounded explorer change set.

Outputs Generated:
- `docs/records/index.html`
- `docs/records/records.json`
- `docs/records/search.json`
- `docs/records/schema.json`
- `docs/records/AUTHORITY.md`
- `docs/records/records.css`
- `docs/records/records.js`
- `docs/machine/schema/v1/cross-surface-record-index.schema.json`
- Regenerated entity permalinks and shared-navigation/public machine derivatives.

Decisions:
- The full evidence index remains published but is not eagerly precached. Only the small explorer shell and compact 127-record search projection are precached, keeping the established offline ceiling below 2 MB.
- Unsupported evidence categories are omitted rather than filled with guesses.
- No canon prose, stable ID, semantic relationship authority, authored chronology, canonical media binary, backend, account, analytics, remote search service or Phase 13 was added.
- Runner-dependent `docs/qa-report.txt` telemetry was restored to its pre-task tracked bytes rather than committed as unrelated churn.

Verification:
- Normal `./tools/build.sh --check`: PASS with 278 machine outputs, 7 record-explorer outputs, 129 entity outputs, strict validation clean and public-boundary validation clean across 587 files.
- Strict validation: 0 duplicate IDs, 0 broken anchors, 0 missing local assets, 0 external runtime dependencies, 16 canon locks / 0 violations, 36 Drakken art assertions / 0 failures, 0 manifest invariant errors.
- Focused explorer/machine/derivation/entity suite: 34/34 PASS.
- Offline Chromium suite: 4/4 PASS.
- Representative Chromium: 15/15 PASS.
- Representative WebKit: 15/15 PASS.
- Representative Firefox: first long run produced one transient existing unified-shell visibility failure; the exact failing journey passed 1/1 alone and a clean full rerun passed 15/15. No unrelated navigation repair was made.
- `git diff --check`: PASS.
- DEX//REACH pre-commit checkpoint: `2026-09-18T22-56-42-443Z-a2e1a9`.

Bugs / Blockers:
- At the task baseline, strict validation showed 47 local PNGs in `media/source/` that were not represented in `docs/asset-manifest.json`.
- During source-only validation the local `media/source/` directory later became absent. The repository-authoritative 213-file canonical original set was reconstructed exactly from historical commit `97ae39c745933a024791ed75924f2a5d1d7844a5` using the documented recovery path and independently verified 213/213 with `tools/media_source_archive.py verify --json`.
- The 47 pre-existing nonmanifest PNGs remain unrecovered. Bounded exact-copy recovery checked ordinary Mac user folders, Google Drive filename search and several hundred recent ChatGPT Library images by SHA-256 filename prefix with no matches. They were outside repository/manifest authority, but their loss is still a local-work preservation gap and must not be described as recovered.

Correction:
- An early Firefox failure was initially ambiguous. Isolation proved the same unified-shell journey passed, and the clean full Firefox rerun passed 15/15; it is recorded as transient rather than “fixed.”
- An early offline Chromium timeout occurred only while Chromium, Firefox and WebKit suites competed concurrently; the same offline suite passed 4/4 when rerun serially.

State After Completion:
- Branch: `feature/cross-surface-record-explorer`.
- Implementation commit: `a7f6f17db45c285ff1aaf3fd2472392a8a049203`.
- Tracked explorer implementation is locally verified.
- Canonical manifest-backed media authority is restored and verified at 213/213.
- The 47 baseline nonmanifest local PNGs remain an explicit unresolved recovery issue.
- Protected PR CI, merge, Pages deployment and live-edge publication are not yet claimed.

Next Step / Handoff:
- Commit this additive Bible entry as the documentation follow-up, push both commits to `origin/feature/cross-surface-record-explorer`, then use protected PR CI before any merge/publication claim.
- Do not infer successful recovery of the 47 nonmanifest PNGs unless exact bytes are later found and verified against their SHA-256-derived filenames.

## 2026-09-25 — Deep Systems integration

The Compendium’s Cross-Surface Record Explorer is now the integration seam for ten evidence-aware capabilities rather than ten disconnected subsystems: contradiction/tension records, authored semantic edges, a universal command palette, global temporal lens, canon delta history, claim-level evidence traces, source-backed causal edges, visual generation packets, a conservative Drakken morphology comparison atlas, and portable browser-local Research Trails.

Authority remains deliberately split. Observed xrefs remain mentions. Semantic edges and causal edges require authored evidence. Chronological proximity does not imply causation. The contradiction registry is incomplete by design. Unknown dates and morphology remain unknown. Visual packets expose only existing sources/media/locks and may not invent physical canon. Reader-created trails never become canon.

The implementation is deterministic under `build/record_explorer.py`, with `src/records/deep-systems.json` plus `src/schema/deep-systems.schema.json` as the new structured source/schema pair. Global palette assets are generated root tools. Advanced record-analysis assets remain optional outside the offline precache so the established under-2-MB offline contract survives unchanged.

Local proof: strict build/validator and public-boundary PASS; 48 focused/source/machine/offline/unified-shell tests PASS; 15 representative Chromium cross-browser journeys PASS; deep-systems browser journey PASS; offline precache 1,996,773 bytes; derivation topology 46/105 PASS. CI/merge/live publication remain separate proof states until actually observed.
