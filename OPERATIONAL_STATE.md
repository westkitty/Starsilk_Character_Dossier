# OPERATIONAL_STATE

project_id: starsilk-character-dossier
project_name: Starsilk Compendium
revision: 11

## Current baseline

- Repository default branch: `main`.
- Canon-infrastructure PR #1 merged at `6185a26e7f62adda5df3a4c053d3c192f9d9468e`.
- Pages source-compatibility PR #2 merged at `6c57256b32a6f75f1857919dba3015851e738f97`.
- Pages source-aware self-heal PR #3 merged at `a84a3440c0178ad256bbd5994392bb0d4caf5dde`.
- Live Pages proof PR #4 merged at `5a813a13e13dcaed19f496196de1302572fa9984`.
- Museum + AI Phase 1 PR #11 merged at `ea287f572264eee625708d22b95a2d482b7d8a87`.
- Museum + AI Phase 2 PR #12 merged at `d23d940ae306017550ef69265f0bea8d64a7c303`.
- Museum + AI Phase 3 PR #15 merged at `b7726adc86f967e914616c07b5b4b6179236dbf3`.
- Publication architecture remains `src/content/` + `src/templates/` -> `build/generate.py` -> `docs/index.html` -> `build/validate.py`.
- `docs/index.html` is generated output and must not be hand-edited as an authority.
- `src/canon/invariants.json` is the machine-readable canon-lock authority.
- `docs/asset-manifest.json` is the published-media provenance ledger.
- `media/source/` contains canonical original media and is intentionally not committed.
- `MUSEUM_AI_ROADMAP.md` is the durable twelve-phase plan/progress ledger; it does not override observed repository reality.
- `MUSEUM_AI_FOUNDATION.md` is the Phase 1 authority/identity/publication contract for future machine derivatives.
- `src/schema/metadata-record.schema.json` is the v1 metadata wrapper contract; it stores provenance/status/identity metadata and must not become a duplicate canon prose database.
- `build/machine_publication.py` owns deterministic generation of `docs/machine/`, `docs/llms.txt`, and `docs/sitemap.xml`; those files are public generated derivatives, not lore authority.
- `src/machine/AUTHORITY.md` and `src/schema/*` are the authored source surfaces for Phase 2 public authority notes and versioned machine schemas.
- `build/entity_publication.py` owns deterministic generation of `docs/entities/`; those permalink pages are public generated derivatives of existing section authority, not a second canon source.
- Canonical human record destinations are `/entities/<stable-id>/`; original `/#<stable-id>` Compendium anchors remain supported legacy public locations.
- Per-record machine alternatives are `/machine/entities/<stable-id>.json` and `/machine/entities/<stable-id>.md`, keyed by the same existing stable IDs.

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
17. Existing section IDs/public anchors, xref targets, authored `data-source-key` values, legacy `data-asset-key` values, and media provenance identities are stable identities. Later views may add canonical URLs/aliases but must not casually rename or orphan these identities.
18. Visibility (`public`/`private`), canon status (`canon`/`development`/`historical`/`speculative`/`unknown`), and spoiler level (`none`/`minor`/`major`) are independent dimensions and must never be collapsed into one another.
19. Unknown is a first-class machine state. Missing event IDs, dates, coordinates, semantic relationships, or other unauthored facts must remain unknown rather than being plausibly invented.
20. Observed xref edges prove only `mentions`/references. Stronger relationship semantics require explicit authored semantic authority and source evidence.
21. Future public machine exports must pass `tools/check_public_boundary.py` and retain source/evidence references. JavaScript hiding, Archive mode, `ajd`, robots metadata, and agent-orientation files are not privacy controls.
22. `docs/machine/`, `docs/llms.txt`, and `docs/sitemap.xml` are generator-owned derivatives. They must remain reproducible from declared source authority and must not be hand-promoted into a second canon database.
23. The Phase 2 entity index mirrors the 127 authored top-level records in `src/content/sections.json`. The existing validator's 138 rendered `<section>` count is a different DOM-level invariant; neither count should be forced to equal the other.
24. Public relationship output may expose only observed xref `mentions` / `observed-xref` evidence until an explicit semantic authority is authored.
25. Phase 2 JSON-LD is structural `CreativeWork` / `hasPart` metadata only. Do not type fictional subjects as real `Person` entities or infer unsupported schema.org relationships.
26. Any new public machine URL must be generator-owned, declared in the machine index/sitemap as appropriate, boundary-checked before merge, and independently verified at the live Pages edge when publication changes.
27. For authored top-level records, the existing section ID remains identity; `/entities/<stable-id>/` is the canonical human permalink and `/#<stable-id>` remains a supported legacy public location.
28. `docs/entities/` is generator-owned output from `build/entity_publication.py`; hand-editing generated entity pages is not an authority change.
29. Per-record JSON and Markdown alternatives must derive from the same stable ID and source authority as the human permalink; canonical URL migration must not fork identity.
30. Entity-page related media may derive only from `docs/asset-manifest.json` section contexts. A media association proves published placement/provenance only and does not create Phase 4 museum-object identity.
31. Entity-page related-record lists may expose only observed xref `mentions` / `observed-xref` evidence until an explicit semantic authority exists.
32. The authored stable ID `archive` collides with the repo-wide local `archive/` ignore pattern. Keep the root/offline `archive/` exclusion, but preserve the exact `!docs/entities/archive/` and `!docs/entities/archive/index.html` exceptions plus `tests/test_entity_tracking.py`; deleting them silently drops a canonical permalink.
33. Generated entity pages must remain static and accessible with no executable JavaScript beyond inert JSON-LD; the complete root Compendium remains the legacy all-in-one destination and its stable anchors must not be removed.

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

## Museum + AI Phase 1 foundation — VERIFIED

Phase 1 of 12, **Foundation, Roadmap, and Publication Boundary**, is complete.

Repository evidence:

- starting `main`: `f885a18cade0d81e02c0d7ed52ff2d9549521bd3`
- work branch: `phase-01-foundation`
- primary implementation commit: `b8e60a9577108ad3b339dcc1b39a319e7b0db562`
- one bounded repair commit: `45ce3ae4e8cea26f29c46d221bc7539274ee1fb3`
- PR: `#11`
- successful required CI: run `32637622651`
- implementation merged to `main`: `ea287f572264eee625708d22b95a2d482b7d8a87`

The first CI run exposed one new-test-only defect: a case-sensitive assertion demanded lowercase `do not` while the governing contract correctly used sentence-initial `Do not`. The single allowed repair made that assertion case-insensitive. It did not weaken the requirement or alter implementation behavior. The repaired head then passed all required CI jobs.

Phase 1 verified capabilities:

- `MUSEUM_AI_ROADMAP.md` now owns the twelve planned phases, order, status, completion evidence, blockers, and explicit deferrals.
- `MUSEUM_AI_FOUNDATION.md` defines the authority hierarchy, stable-identity policy, public/private boundary, independent canon/spoiler dimensions, relationship-evidence rules, and explicit unknown handling.
- `src/schema/metadata-record.schema.json` defines the v1 metadata contract for stable ID, object type, label, aliases, canonical URL, source references, visibility, canon status, spoiler level, related media IDs, evidence classification, and unknowns.
- `tools/validate_metadata_contract.py` validates the project metadata contract and candidate records using only the Python standard library; no new dependency was added.
- `tools/check_public_boundary.py` rejects obvious private visibility, credentials, local filesystem paths, and localhost/private-runtime leakage from future public machine exports.
- `tests/test_museum_foundation.py` locks schema behavior, publication-boundary behavior, uniqueness/consistency of existing section/navigation IDs, the existing chronology source key, archive asset-key uniqueness, and the rule that generated relationship edges remain `mentions`.
- No existing canon prose, source section, template, media file, generated `docs/` publication file, dependency, or public UI was changed.

CI run `32637622651` verified on the repaired implementation head:

- source build passed;
- strict existing validation/canon gate passed;
- generated `docs/` parity passed;
- `git diff --check` passed;
- full Chromium pytest + Playwright suite passed;
- Firefox representative journeys passed;
- WebKit representative journeys passed.

Because Phase 1 did not change `docs/` or introduce a public machine artifact, a GitHub Pages rebuild/live-edge publication proof was not required for this phase. The previously verified Pages authority remains `legacy / main /docs` unless a future authoritative read proves otherwise.

## Museum + AI Phase 2 machine publication — VERIFIED

Phase 2 of 12, **Machine Publication Layer**, is complete.

Repository evidence:

- starting `main`: `55427686853a8f8ee049ad38b01fe92ec097aa20`
- work branch: `phase-02-machine-publication`
- primary implementation commit: `d4d73223a2f5975945ad1aa607f1880f0a54936a`
- one bounded implementation repair: `0f42f2527ac3bef7b1d17e8bb5322363a1f87e0e`
- exact generated-publication commit: `d60b66214598f0263d79d48059d32e715e9699c9`
- final validation head: `e64068a821df51cfb67cdd335007287d64d31fc7`
- successful CI: run `32639102690`
- PR: `#12`
- merged to `main`: `d23d940ae306017550ef69265f0bea8d64a7c303`

Phase 2 verified capabilities:

- `build/machine_publication.py` deterministically generates and checks the complete Phase 2 public machine surface.
- `tools/build.sh` now owns both human HTML and machine-publication generation/checking, followed by strict canon/DOM validation and the public-boundary gate.
- `docs/machine/index.json` is the finite public orientation/index surface.
- `docs/machine/entities.json` contains 127 records, exactly matching authored top-level `src/content/sections.json` IDs in source order. This intentionally differs from the existing DOM validator's 138 rendered `<section>` count.
- `docs/machine/relationships.json` contains 136 observed xref relationships and exposes only `kind=mentions` with `evidence_class=observed-xref`.
- `docs/machine/project.jsonld` describes the Compendium and section resources using conservative structural `CreativeWork` / `hasPart` semantics only.
- `docs/machine/compendium.md` and `docs/machine/entities.md` provide deterministic Markdown alternatives.
- public v1 schemas are copied byte-for-byte from authored `src/schema/` sources into `docs/machine/schema/v1/`.
- `docs/llms.txt`, `docs/sitemap.xml`, and generated `docs/machine/AUTHORITY.md` provide orientation, URL discovery, authority, evidence, unknown-state, and interpretation rules.
- no chronology-event IDs, WorldsVault record IDs, coordinates, richer semantic relationships, per-section canon statuses, or other unauthored facts were invented.
- no public Compendium UI, canon prose, media source, dependency set, or Phase 3 entity-page surface was changed.

Final CI run `32639102690` on head `e64068a821df51cfb67cdd335007287d64d31fc7` passed:

- source build;
- deterministic committed `docs/` parity, including machine publication;
- strict existing DOM/canon validation;
- public machine-boundary validation;
- `git diff --check`;
- full Chromium pytest + Playwright suite;
- representative Firefox journeys;
- representative WebKit journeys.

Live publication was independently verified by execution-only PR #13, which was closed without merge after proof. GitHub Actions run `32639347205`, job `97193914513`, fetched the cache-busted GitHub Pages edge and established:

- `LIVE_MACHINE_PROOF_OK urls=14 records=127 exact_machine_files=13`;
- all 13 non-root declared public machine/text files were byte-identical to the merged `docs/` files;
- the root still contained the current `dossierSearch` and `Archive tools` markers;
- live entity records retained `visibility=public` and `canon_status=unknown`;
- live relationship edges remained `mentions` / `observed-xref` only;
- live JSON-LD remained `CreativeWork`-only structural metadata;
- the downloaded live publication passed `tools/check_public_boundary.py` across 13 text/machine files.

Therefore Phase 2 is **VERIFIED COMPLETE** at repository, CI, merge, and live-publication layers.

## Museum + AI Phase 3 stable entity pages — VERIFIED

Phase 3 of 12, **Stable Entity Pages and Permalinks**, is complete.

Repository evidence:

- starting `main`: `5e8e6d1d43326b43440689b72ce81e4d57a29da9`
- work branch: `phase-03-entity-permalinks`
- final validated implementation head: `54da12779396175622aab1faafa64fbb4b652c2a`
- one bounded implementation repair: `6143bde80d354d70788252cad280edfc1ac33825`
- repair cause: pre-existing `archive/` ignore semantics excluded the generated `archive` stable-ID permalink from Git staging; the fix retained the local archive ignore while unignoring the exact generated permalink and added `tests/test_entity_tracking.py`
- successful final CI: run `32640613872`
- implementation PR: `#15`
- merged to `main`: `b7726adc86f967e914616c07b5b4b6179236dbf3`

Phase 3 verified capabilities:

- `build/entity_publication.py` deterministically generates and checks `docs/entities/`.
- `/entities/` is a generated human index over all 127 authored top-level stable records.
- every authored stable ID has a first-class canonical human destination at `/entities/<stable-id>/`.
- every canonical page derives its published source content from the existing authoritative section fragments; no duplicate canon prose database was introduced.
- original `/#<stable-id>` Compendium anchors remain present and are linked as legacy locations from entity pages.
- every record has matching JSON and Markdown alternatives at `/machine/entities/<stable-id>.json` and `/machine/entities/<stable-id>.md`.
- machine metadata, project JSON-LD, `llms.txt`, Markdown indexes, and sitemap now address the canonical human permalinks while preserving stable ID authority.
- entity-page related media is derived only from `docs/asset-manifest.json` section contexts.
- entity-page related records are derived only from observed xref `mentions`; no semantic promotion occurred.
- entity pages are static, responsive, keyboard-addressable HTML and contain no executable JavaScript beyond inert `application/ld+json` metadata.
- the root Compendium remained byte-stable during Phase 3 generation and retained all existing stable anchors.
- no new dependency, canon prose mutation, canonical-media mutation, chronology-event ID, WorldsVault ID, coordinate, richer relationship semantic, or Phase 4 museum-object/viewer implementation was added.

Final CI run `32640613872` on head `54da12779396175622aab1faafa64fbb4b652c2a` passed:

- source build;
- deterministic committed `docs/` parity for root, machine, and entity publication;
- strict existing DOM/canon validation;
- public derivative boundary validation;
- `git diff --check`;
- full Chromium pytest + Playwright suite;
- representative Firefox journeys;
- representative WebKit journeys.

Live publication was independently verified by execution-only PR #16, closed without merge after proof. The first exhaustive proof attempt hit a transient GitHub Pages HTTP 503 during a deliberate high-rate sweep; no product code changed. The proof harness was paced and given retry handling for transient transport errors. GitHub Actions run `32640932505`, job `97197796536`, then established:

- `LIVE_PHASE3_PROOF_OK entity_pages=127 declared_urls=396 per_record_machine=254 archive=ok legacy_anchors=ok root=ok exact_bytes=ok`;
- all 396 machine-declared public URLs were live and byte-identical to merged `docs/`;
- all 127 canonical human permalink pages had the correct stable ID, canonical URL, JSON/Markdown alternates, legacy Compendium location, published source marker, and JSON-LD-only script policy;
- all 127 original root Compendium section anchors remained live;
- `/entities/archive/` was live, proving the bounded ignore-collision repair landed correctly;
- live per-record JSON retained the matching stable ID/canonical URL plus `visibility=public` and `canon_status=unknown`;
- live relationship output remained `mentions` / `observed-xref` only;
- live project JSON-LD remained structural `CreativeWork` metadata only;
- the downloaded live derivative set passed `tools/check_public_boundary.py` across 395 text/machine files.

Therefore Phase 3 is **VERIFIED COMPLETE** at repository, CI, merge, permalink, legacy-compatibility, and live-publication layers.

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

Therefore the hosted GitHub Pages site is **verified current** for the public content represented by that proof state.

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
- Individual chronology events do not yet have authored stable IDs; Phase 1 deliberately preserves this as unknown rather than deriving IDs from presentation order or guessed labels.
- Many WorldsVault template records do not yet have authored stable IDs; display labels/media references are not silently promoted into permanent object identity.
- No semantic relationship authority currently exists beyond observed xref `mentions` relationships.
- Per-section canon status remains unauthored in the current source model; Phase 2 publishes `canon_status=unknown` rather than guessing.
- Phase 2 uses `spoiler_level=major` as a conservative publication default; that is publication policy, not a canon fact.
- Phase 3 does not create museum-object identities, fullscreen viewer semantics, or IIIF surfaces; those remain Phase 4 work.
- The canonical human permalink layer covers only the 127 authored top-level section IDs. Unauthored chronology-event and WorldsVault record IDs remain unknown rather than being inferred.

## Pending

- Museum + AI program: Phase 4 of 12 — Museum Object Model and Media Viewer. It must begin only in a fresh chat after re-reading `MUSEUM_AI_ROADMAP.md`, this Operational State, current `main`, and relevant CI/publication state.

## Revision log

- Revision 1: initialized canon-infrastructure state.
- Revision 2: recorded PR #1, corrected canon-validation scope semantics, and preserved CI as pending rather than verified.
- Revision 3: recorded CI environment/parity repairs, pinned visual-baseline migration, hidden-placeholder fix, and successful final read-only validation run `32622800992`.
- Revision 4: recorded PR #1 merge and the then-unresolved Pages edge-verification gap.
- Revision 5: recorded PRs #2-#4, authoritative Pages configuration `legacy / main / docs`, successful Pages build at `a84a3440c0178ad256bbd5994392bb0d4caf5dde`, and fresh GitHub-runner verification that the public site serves the current Compendium markers.
- Revision 6: closed the final recovery gap: reconstructed and verified 213/213 canonical originals from Git history, created and restore-tested recovery ZIP `1228fad6...f58a`, stored the backup outside Git in Google Drive, and round-trip SHA-256 verified every Drive transfer chunk plus verification bundle.
- Revision 7: locked Archive Tools behind the session-only search-field phrase gate, removed persisted archive-mode activation, kept `Starsilk Compendium` on one responsive line, regenerated deployable output/visual baselines, and verified Chromium/Firefox/WebKit behavior before commit.
- Revision 8: added the Archive-mode `Copy implementation prompt` handoff, locked changed-slot identity to authoritative `data-asset-key` values, required exported local evidence for implementation, and verified clipboard/export behavior plus full browser regressions before commit.
- Revision 9: completed Museum + AI Phase 1. Added the durable twelve-phase roadmap, authority/stable-identity/publication contract, v1 metadata schema, dependency-free metadata validation, future public-machine boundary checks, focused regression tests, explicit unknown handling, and independent visibility/canon/spoiler semantics; PR #11 passed required Chromium/Firefox/WebKit CI after one bounded test-only repair and merged at `ea287f572264eee625708d22b95a2d482b7d8a87`.
- Revision 10: completed Museum + AI Phase 2. Added deterministic public machine generation, versioned schemas, 127 section-backed records, 136 observed `mentions` relationships, Markdown alternatives, conservative `CreativeWork` JSON-LD, `llms.txt`, sitemap, authority notes, build integration, public-boundary checks, and exact live-edge verification of all 14 declared URLs; PR #12 passed final Chromium/Firefox/WebKit CI and merged at `d23d940ae306017550ef69265f0bea8d64a7c303`; live proof run `32639347205` passed and proof PR #13 was closed unmerged.
- Revision 11: completed Museum + AI Phase 3. Added 127 canonical human `/entities/<stable-id>/` pages, the entity index, 254 per-record JSON/Markdown alternatives, manifest-backed related media, observed-xref related-record lists, canonical URL migration, static accessible entity templates, deterministic entity generation/checking, and legacy-anchor preservation. One bounded repair protected the authored `archive` permalink from the repo-wide `archive/` ignore rule. PR #15 passed final Chromium/Firefox/WebKit CI and merged at `b7726adc86f967e914616c07b5b4b6179236dbf3`; exhaustive live proof run `32640932505` verified 396 declared URLs byte-for-byte and proof PR #16 was closed unmerged.