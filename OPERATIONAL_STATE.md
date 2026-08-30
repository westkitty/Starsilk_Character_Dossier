# OPERATIONAL_STATE

project_id: starsilk-character-dossier
project_name: Starsilk Compendium
revision: 26
freshness_policy: src/system/operational-state-policy.json

## Current baseline

- Repository default branch: `main`.
- Canon-infrastructure PR #1 merged at `6185a26e7f62adda5df3a4c053d3c192f9d9468e`.
- Pages source-compatibility PR #2 merged at `6c57256b32a6f75f1857919dba3015851e738f97`.
- Pages source-aware self-heal PR #3 merged at `a84a3440c0178ad256bbd5994392bb0d4caf5dde`.
- Live Pages proof PR #4 merged at `5a813a13e13dcaed19f496196de1302572fa9984`.
- Museum + AI Phase 1 PR #11 merged at `ea287f572264eee625708d22b95a2d482b7d8a87`.
- Museum + AI Phase 2 PR #12 merged at `d23d940ae306017550ef69265f0bea8d64a7c303`.
- Museum + AI Phase 3 PR #15 merged at `b7726adc86f967e914616c07b5b4b6179236dbf3`.
- Museum + AI Phase 4 PR #18 merged at `258ce10f9d0d73b22163ae22243b953af99427fc`.
- Museum + AI Phase 5 PR #21 merged at `0f31a280eebdbaf68bda9265d3fa54aed806f120`.
- Museum + AI Phase 6 PR #24 merged at `5dafd7c7cba11b728c9548b009847ca96e8e756f`.
- Museum + AI Phase 7 PR #27 merged at `72837ad5595a0380fe45d2aed1ed7cb5521b6432`.
- Museum + AI Phase 8 PR #30 merged at `6520f43574eac8de64d67da77dca19bc99f3eb46`.
- Museum + AI Phase 9 PR #34 merged at `3ed684897975065d89f5e12c8c15b36f936c0262`.
- Visual-coverage PR #47 merged at `3801b500c08c3842c3a54445db503610eac92200`, completing source-backed local image coverage for all 127 authored top-level records while preserving 138 observed-xref `mentions` edges and adding no new media binaries.
- Pages proof-hardening PR #48 merged at `be9bc848788e1a6e3972a615f050a5f2d10a9d59`, making visual-coverage publication proof exact-commit and semantic rather than generic-marker based.
- Pages source-delta PR #50 merged at `acf7a97b9872d6baf9d6c40f1fca03401671c263`, preserving exact source-change publication proof while skipping redundant legacy rebuild requests for workflow-only changes.
- Source-of-truth graph PR #52 merged at `48efb542b198383e9aaf3f55cedc6d66a0bb532b`; `src/system/derivation-map.json` now maps major authority/evidence groups, build generators, generated roots, and validation gates with deterministic projection/validation.
- Build-provenance PR #53 merged at `c91bfa0231982314edfb241ca10c38b94807ed51`; main CI run `33043525693` passed and Build Provenance run `33043645726` generated, reverified, boundary-checked, and uploaded the first exact-commit attestation for that merge.
- Operational State freshness sentinel PR #54 merged at `1c321fcbcad81f0e0116ee6748febe7e647703fe`. Main CI run `33045765364` compared exact previous main `c91bfa0231982314edfb241ca10c38b94807ed51`, classified 15 state-relevant paths, reported `state_update=closed`, passed deterministic build/docs parity, `223 passed, 1 skipped` Chromium coverage, and green Firefox/WebKit journeys. Build Provenance run `33045915082` then succeeded for the exact merge commit.
- Cold-start recovery protection is defined by `src/system/COLD_START_RECOVERY.md` and `src/system/cold-start-recovery-contract.json`, with `tests/test_cold_start_recovery.py` enforcing repository-only recoverability of project purpose, current baseline, authority/architecture, active paths, build/test/preview, environment/publication, protected invariants, known limitations/dependencies, pending work, and anti-inference boundaries. It is repository-resumption guidance only and creates no lore, canon, relationship, chronology, media-identity, or publication authority.
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
- `build/museum_publication.py` owns deterministic generation of `docs/objects/`; the museum object register is a public derivative of `docs/asset-manifest.json`, not a second canon or media-provenance authority.
- The museum human surface is `/objects/`; individual museum deep links are `/objects/#<object-id>`.
- `src/museum/AUTHORITY.md` and `src/schema/museum-object-index.schema.json` define the Phase 4 object/publication interpretation contract.
- `build/relationship_publication.py` owns deterministic generation of `docs/relationships/`; that observatory is a public evidence derivative of the existing observed-xref graph, not semantic relationship authority.
- `src/relationships/AUTHORITY.md` and `src/schema/relationship-observatory.schema.json` define the Phase 5 relationship evidence/publication contract.
- `build/canon_publication.py` owns deterministic generation of `docs/canon/`; that inspector is a public derivative of `src/canon/invariants.json`, not complete canon or a second editable canon authority.
- `src/canon/AUTHORITY.md` and `src/schema/canon-lock-register.schema.json` define the Phase 6 inspection/publication boundary.
- `build/discovery_publication.py` owns deterministic generation of `docs/discover/`; that surface is a public discovery/context convenience derivative, not canon, relationship, or media-provenance authority.
- `src/discovery/AUTHORITY.md`, `src/schema/discovery-index.schema.json`, `src/schema/context-packet.schema.json`, and `src/schema/context-packet-index.schema.json` define the Phase 7 discovery/context-packet interpretation boundary.
- `build/tour_publication.py` owns deterministic generation of `docs/tours/`; that surface is an editorial stable-ID navigation and browser-local convenience derivative, not canon, chronology, relationship, or user-account authority.
- `src/tours/tours.json` owns stable curated-tour IDs and their existing-navigation-group binding; `src/content/nav.json` remains authority for ordered tour-stop membership. `src/tours/AUTHORITY.md` and `src/schema/tour-index.schema.json` define the Phase 8 interpretation/publication boundary.
- `build/chronology_publication.py` owns deterministic generation of `docs/chronology/`; the explorer is a public source-backed derivative of `src/chronology/events.json`, not a second canon prose authority.
- `src/chronology/events.json` establishes Phase 9 publication event IDs only from direct labels in the existing `chronology` source record. `src/chronology/AUTHORITY.md` and `src/schema/chronology-index.schema.json` define the chronology interpretation boundary.
- `src/templates/_museum_nav.html.j2` is the single shared unified-museum-navigation partial, included by `shell.html.j2` and every secondary system template (`museum.html.j2`, `discovery.html.j2`, `canon-inspector.html.j2`, `relationships.html.j2`, `tours.html.j2`, `chronology.html.j2`, `worldsvault.html.j2`, `entity.html.j2`); each including template sets its own `nav_root`/`nav_current` before the include. It is presentation/navigation only and carries no canon, relationship, or provenance authority of its own.
- `data-museum-shell="unified"` is the deterministic integration marker proving the root page and every public system share one museum shell; it is asserted on the root `<body>` and on every page's rendered `_museum_nav.html.j2` header.
- Root hero statistics in `shell.html.j2` (`museum_stats`, computed in `build/generate.py::load_museum_stats`) are derived from `sections.json`, `docs/asset-manifest.json`, `src/tours/tours.json`, `src/chronology/events.json`, and `src/canon/invariants.json` at build time; they are never hand-maintained literals and must not be edited directly in generated output.

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
34. `docs/asset-manifest.json` remains the published-media provenance ledger. A Phase 4 museum `object_id` is the published media filename with only the final extension removed; the complete filename remains its provenance source key.
35. `logical_identity`, `match_status`, provenance, and section contexts are descriptive manifest evidence. They must not replace museum identity, become canon-status fields, or imply stronger semantic relationships.
36. Missing museum description/context evidence remains explicit unknown state. Do not infer logical identity, alt text, provenance, or relationships from filenames, imagery, adjacent lore, or presentation order.
37. `docs/objects/` is generator-owned output from `build/museum_publication.py`. Its current generated surface is six text/code files and must not contain copied media binaries or hand-authored canon prose.
38. `/objects/` must load the 213-record metadata register without requesting `/assets/media/` bytes. Media is on-demand: one selected/deep-linked object creates one media element only.
39. Museum videos must use user controls, metadata-only preload, and no autoplay. Closing the viewer must pause/unset/remove selected media so playback or downloading does not continue invisibly.
40. Museum object deep links use `/objects/#<object-id>`. They are stable client-side fragment destinations over one static human museum page, not separate server-side HTML resources.
41. Museum section contexts prove published placement only and may link to canonical entity pages; they do not establish Phase 5 relationship semantics.
42. Phase 4 consumes existing `docs/assets/media/` derivatives as-is and must not regenerate, replace, commit, or claim new backup coverage for canonical originals in `media/source/`.
43. Static IIIF is deliberately not adopted in Phase 4. Re-evaluate only if a later requirement needs tiled deep zoom, region-level annotation, or IIIF interoperability strongly enough to justify new derivative infrastructure.
44. Public museum derivatives must remain reproducible from the manifest/schema/templates, pass `tools/check_public_boundary.py`, and receive independent live Pages verification whenever the museum publication changes.
45. `docs/relationships/` is generator-owned output from `build/relationship_publication.py`; it must remain reproducible from the established observed-xref graph and must not become a semantic relationship database.
46. The Relationship Observatory may publish only `kind=mentions` with `evidence_class=observed-xref` until explicit semantic authority is authored. Incoming/outgoing direction means citation direction only.
47. Physical Compendium xrefs must retain deterministic public evidence anchors. Relationship edges may cite the first qualifying rendered xref inside the established source-section subtree projection; edge identity and observed-xref semantics are stable, while the generated relationship count is derived from authored xrefs rather than frozen as a historical literal. The verified PR #47 output remains at the pre-change source-derived 138 observed `mentions` edges.
48. `/relationships/#entity-<stable-id>` and `/relationships/#mention--<source>--<target>` are stable human fragment destinations over the static observatory. They do not create new entity or relationship identity outside the existing stable IDs and observed edge pair.
49. Zero incoming/outgoing counts are meaningful evidence states and must remain visible rather than being omitted or filled by inference.
50. Relationship discovery links on entity pages must not replace canonical entity permalinks, legacy Compendium anchors, or existing observed-xref related-record lists.
51. Public relationship derivatives must remain script-free where currently generated, pass deterministic build parity and `tools/check_public_boundary.py`, and receive independent live Pages verification whenever the relationship publication changes.
52. `docs/canon/` is generator-owned output from `build/canon_publication.py`. It may expose only machine-enforced locks and additional strict-validator inputs derived from `src/canon/invariants.json`; absence from the register never implies non-canon status.
53. Canon Inspector document locks apply to the complete generated Compendium, while section locks apply only to their declared stable section. Raw validator patterns are technical evidence, not standalone canon prose; generated `/canon/` artifacts must pass public-boundary and independent live-edge checks.
54. `docs/discover/` is generator-owned output from `build/discovery_publication.py`. It is an additive discovery/context derivative over established stable records and must not become canon/content authority, semantic relationship authority, media-provenance authority, or an editable duplicate lore database.
55. Phase 7 result classes remain structural publication metadata; navigation-group facets derive only from authored `src/content/nav.json`; archetypes are copied only when authored; media facets derive only from manifest associations; excerpts are mechanical source projections. Search matches, filtering, ranking/order, and no-result states are retrieval behavior only and never create or negate canon facts.
56. Phase 7 AI context packets must preserve cited source references, stable identity, explicit unknowns, visibility, canon status, spoiler publication value, related-media IDs, and relationship evidence boundaries. Packet relationships remain only `mentions` / `observed-xref`, and generated packets never outrank their cited source authority.
57. Phase 7 discovery is additive. The existing complete-Compendium `dossierSearch`, navigation behavior, canonical entity permalinks, legacy anchors, museum identities, relationship evidence identities, and Canon Inspector semantics must remain supported unless a later explicit phase contract intentionally changes them.
58. `docs/tours/` is generator-owned output from `build/tour_publication.py`. Stable tour IDs/bindings derive from `src/tours/tours.json`, while stop membership and order derive only from existing authored `src/content/nav.json` stable IDs; generated tour output must not become a second canon prose database.
59. Curated tour route membership and ordering are editorial navigation only. They do not prove chronology, causality, importance, faction membership, kinship, location, or any other semantic relationship. Missing lore facts remain unknown.
60. Phase 8 persistent library data is browser-local user state only: bookmarks, recent openings, timestamped local history, completion progress, and named collections. It requires no account and must not use analytics, telemetry, beacons, server writes, or external runtime services.
61. User-authored collection names and local history must not enter generated publication, machine indexes, canon/evidence surfaces, or public URLs. Local state is never canon/relationship evidence; clearing site storage removes persistence, and unavailable storage falls back to current-page memory rather than remote persistence.
62. Phase 8 is additive to the existing human surfaces. Canonical entity pages remain script-free except inert JSON-LD and may only link into the `/tours/` local-library surface; root `dossierSearch`, legacy anchors, museum identities, observed-xref semantics, and Canon Inspector authority boundaries remain intact.
63. Public tour/machine derivatives must remain deterministic, boundary-checked, and independently verified at the live Pages edge whenever Phase 8 publication changes.
64. Phase 9 chronology publication may preserve only direct authored labels, exact authored markers, explicit relative markers/relations, and authored durations from the cited chronology source. It must never convert a marker into a fabricated absolute calendar date or infer chronology from source-list order.
65. Phase 9 `event_id` is a source-backed publication identity established from a direct label; it is neither a claim of authored historical identity nor a substitute for the stable `chronology` source-record ID.
66. Event visibility, canon status, spoiler level, and temporal certainty are independent. Existing public source visibility does not establish canon; absent structured event canon/spoiler metadata remains `unknown`.
67. `/chronology/` filters may hide rendered cards only. They must not mutate, omit, or otherwise change chronology JSON status fields or temporal values.
68. Public chronology/machine derivatives must remain deterministic, boundary-checked, and independently verified at the live Pages edge whenever the chronology publication changes.
69. The root page and every public system page must share one unified museum navigation (`src/templates/_museum_nav.html.j2`) carrying the `data-museum-shell="unified"` marker. Adding a future public system requires adding it to that shared partial, not a page-local one-off header.
70. The root museum entrance is presentation over the existing Compendium, not a second content or authority surface. It must not invent canon, relationships, chronology, or WorldsVault facts; its statistics must remain derived from existing source/generated data; and the full, unabridged Compendium plus every legacy `/#stable-id` anchor must remain intact below it.
71. `src/content/visual-coverage.json` is presentation-only fallback placement authority for authored top-level records that lack a visible authored image. Every referenced `source_filename` must already exist in `docs/asset-manifest.json`; the map cannot create canon, media provenance, semantic relationships, dates, locations, identities, or unauthored appearances.
72. Every one of the 127 authored top-level records must retain locally resolvable image coverage on both the complete Compendium and its canonical `/entities/<stable-id>/` page. Existing authored visuals take precedence; fallbacks are additive only for image-less authored bodies. The cover may satisfy this contract through the existing local poster frame attached to its hero video.
73. Character context fallbacks must explicitly state that they are not portraits so unknown appearance remains unknown. Fallback presentation must not create `.xref-link` evidence or alter the observed-xref relationship graph; manifest-derived `related_media_ids` remain governed by invariant 30.
74. Visual-coverage completion must not add or replace canonical media binaries, write back to `media/source/`, or weaken provenance checks. Any deliberately changed visual-regression baseline must be generated and immediately re-compared inside the pinned Playwright Linux environment before merge.

75. `OPERATIONAL_STATE.md` must close every state-relevant repository change in the same change set with an increased revision and matching revision-log entry. `src/system/operational-state-policy.json` defines the bounded material/exemption policy; `tools/check_operational_state_freshness.py` is read-only and must not auto-edit project state.

## Visual coverage completion — VERIFIED ON PR #47

- Implementation head `e81aacafac80de3542ce1c466de8b8df2434bfce` passed clean read-only CI run `32738410496`: deterministic build/check and deployable `docs/` parity, `git diff --check`, full Chromium pytest + Playwright, Firefox, and WebKit all passed.
- Strict validation on the completed publication reports 0 duplicate IDs, 0 broken anchors, 0 missing local assets, 0 data URIs, 0 local machine-path leaks, 0 external runtime dependencies, 16 canon locks with 0 violations, 36 Drakken identity assertions with 0 failures, and 0 manifest-invariant errors.
- The visual-coverage regression contract requires all 127 authored records to have locally resolvable image coverage on both root and canonical entity pages, while preserving source-text authority and explicit unknown appearances.
- The generated relationship graph remains at 138 source-derived `kind=mentions` / `evidence_class=observed-xref` edges; fallback captions are regression-locked against creating relationship evidence.
- No new media binary is introduced by the visual-coverage map. The one changed peripheral visual baseline was regenerated in the pinned Playwright Linux container and immediately re-compared successfully.
- PR merge state and live GitHub Pages publication are intentionally not inferred from this verification record; they require separate proof under invariant 10.

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

## Museum + AI Phase 4 museum object model and media viewer — VERIFIED

Phase 4 of 12, **Museum Object Model and Media Viewer**, is complete.

Repository evidence:

- starting `main`: `06c1acaee9bdb1127df7902d702d8d062b62a40c`
- work branch: `phase-04-museum-objects`
- exact generated-publication commit: `bed865afb3195ce972c41b58d4d0eed516a3aa92`
- final validated implementation head: `0603379d0ea6a364e0d5d608685f38b27f95bfc9`
- one-shot generation/focused proof: run `32642163782`, job `97200820702`
- successful final CI: run `32642262682`
- implementation repair passes used: zero
- implementation PR: `#18`
- merged to `main`: `258ce10f9d0d73b22163ae22243b953af99427fc`

Phase 4 verified capabilities:

- `build/museum_publication.py` deterministically generates/checks the complete `docs/objects/` publication from `docs/asset-manifest.json`.
- the museum register contains exactly 213 records, one for every existing published-media manifest entry.
- museum `object_id` is derived only by removing the final extension from the published filename; the complete filename remains the manifest provenance identity/source key.
- `logical_identity`, `match_status`, provenance, and context are preserved exactly as descriptive evidence rather than promoted into new identity, canon, or relationship authority.
- missing logical identity, context, or authored alt evidence is represented explicitly in `unknowns` rather than inferred.
- `/objects/` is a responsive human museum register with stable `/objects/#<object-id>` fragment deep links.
- initial collection load is metadata-only and makes no `/assets/media/` request; selected objects create one media element on demand.
- image and MP4 objects share the same model; video uses controls, `preload=metadata`, never autoplays, and is removed/cleared when the viewer closes.
- the viewer uses native `<dialog>` semantics with keyboard/Escape closure, previous/next navigation, focus handling, responsive layout, and optional user-triggered Fullscreen API entry.
- `docs/objects/objects.json`, `schema.json`, and generated `AUTHORITY.md` provide source-backed machine/interpretation surfaces without duplicating canon prose.
- the entity index exposes `Browse museum objects`; individual Phase 3 entity pages and their stable identities were not rewritten.
- the generated museum tree contains no media binaries and consumes existing `docs/assets/media/` files as-is.
- canonical originals in `media/source/` remain outside Git and unchanged.
- static IIIF was evaluated and deliberately rejected for this phase because no current deep-zoom, region-annotation, or interoperability requirement justifies tile/derivative infrastructure.
- root Compendium content, canon sources, `docs/asset-manifest.json`, published media bytes, dependencies, Archive Tools, and Phase 5 semantic relationship scope were not changed.

Final CI run `32642262682` on head `0603379d0ea6a364e0d5d608685f38b27f95bfc9` passed:

- authoritative source build;
- deterministic committed `docs/` parity including museum publication;
- strict existing DOM/canon validation;
- public derivative boundary validation;
- `git diff --check`;
- full Chromium pytest + Playwright suite, including Phase 4 object/viewer tests;
- representative Firefox journeys including museum deep-link/Escape behavior;
- representative WebKit journeys including museum deep-link/Escape behavior.

Live publication was independently verified by execution-only PR #19, closed without merge after proof. The first browser-proof attempt had already proven all exact live bytes and the public boundary, then failed on a single immediate `inner_text()` equality assertion after the live dialog had opened. The read-only proof harness was changed to Playwright retry-aware assertions; no product bytes changed. GitHub Actions run `32642574092`, job `97201827679`, then established:

- `LIVE_PHASE4_BYTES_OK objects=213 exact_files=9 identity=ok provenance=ok unknowns=ok root=ok`;
- the changed museum files, entity index, root Compendium, and source asset manifest were byte-identical to merged repository authority at the Pages edge;
- all 213 live object IDs were unique and exactly followed the filename-stem identity rule;
- live provenance/context evidence and explicit unknowns remained source-backed and unpromoted;
- the downloaded live text/object surfaces passed `tools/check_public_boundary.py`;
- `LIVE_PHASE4_BROWSER_OK metadata_only=ok image=ok video=ok escape=ok teardown=ok discovery=ok`;
- live `/objects/` rendered 213 records without eager media requests;
- a live image deep link opened one image, preserved its entity context, and Escape removed the media/cleared the fragment;
- a live video deep link created one controlled, paused, non-autoplaying metadata-preload video and close removed it;
- the live entity index exposed the museum discovery link.

Therefore Phase 4 is **VERIFIED COMPLETE** at authority, identity, generation, browser, CI, merge, provenance, source-boundary, and live-publication layers.

## Museum + AI Phase 5 relationship observatory — VERIFIED

Phase 5 of 12, **Relationship Observatory**, is complete.

Repository evidence:

- starting `main`: `980823f8e5545d1963e447f213af07cec74658c7`
- work branch: `phase-05-relationship-observatory`
- exact generated-publication commit: `e56b2dceb3bd4424f3138229f9212f3aa0c990bc`
- final validated implementation head: `72cf3f42f2014e2bc7a6d408f366185a7f5e7d07`
- successful required CI: run `32649254977`
- implementation PR: `#21`
- merged to `main`: `0f31a280eebdbaf68bda9265d3fa54aed806f120`

Phase 5 verified capabilities:

- `build/relationship_publication.py` deterministically generates/checks the five-file `docs/relationships/` publication.
- the observatory mirrors exactly 127 authored top-level records and the established 136 observed xref edges.
- every published edge remains `kind=mentions` and `evidence_class=observed-xref`; no friendship, hostility, kinship, membership, authorship, causation, chronology, location, or other semantic relationship is inferred.
- incoming/outgoing lists preserve citation direction only.
- all physical rendered Compendium xrefs receive deterministic evidence anchors; an observatory edge links to the first qualifying physical xref inside its source section subtree, preserving the pre-existing graph projection rather than changing graph counts or semantics.
- stable human fragments are `/relationships/#entity-<stable-id>` and `/relationships/#mention--<source>--<target>`.
- `relationships.json`, `relationships.md`, generated `AUTHORITY.md`, and the versioned relationship-observatory schema provide machine/text alternatives and interpretation boundaries.
- records with no observed connections remain represented with explicit zero counts.
- canonical entity pages expose a Relationship Observatory discovery link without changing stable record identity or replacing existing observed-xref related-record links.
- the public observatory is static and contains no executable script.
- `docs/machine/index.json`, `docs/llms.txt`, and `docs/sitemap.xml` discover the new relationship publication/schema.
- no dependency, lockfile, media, canonical-original, canon prose, chronology-event identity, WorldsVault identity, museum-object identity, or Phase 6 implementation changed.

The relationship implementation required one bounded evidence-mapping repair after generation proved that the established graph can rely on pre-existing rendered xrefs as well as newly inserted xrefs. The repair normalized evidence identity across all physical xrefs and resolved each edge through its source section subtree without changing the 136-edge graph. Later corrections were limited to test/release mechanics and deterministic right-edge whitespace normalization; they did not alter relationship meaning or promote new semantics.

Final CI run `32649254977` on head `72cf3f42f2014e2bc7a6d408f366185a7f5e7d07` passed:

- source build and deterministic `./tools/build.sh --check`;
- all five relationship outputs reproducible from their generator;
- strict DOM/canon validation with 11 canon locks and 0 violations;
- public derivative boundary validation across 404 text/machine files;
- `git diff --check`;
- full Chromium pytest + Playwright suite: `135 passed, 1 skipped`;
- representative Firefox journeys;
- representative WebKit journeys.

Diff-scope verification against starting `main` found every persistent path explained by the Phase 5 source/templates/tests or their generated `docs/` derivatives. There were no dependency/lockfile changes, media changes, deletions, renames, unrelated configuration changes, or surviving temporary generation/release helpers.

Live publication was independently verified by execution-only PR #22, closed without merge after proof. GitHub Actions run `32649700329`, job `97219258645`, cache-busted the Pages edge and established:

- `LIVE_PHASE5_BYTES_OK records=127 edges=136 exact_files=11 evidence=xref-codec--dao semantics=observed-only`;
- the selected live root, Codec entity page, all five relationship files, machine index/schema, `llms.txt`, and sitemap were byte-identical to merged `docs/`;
- the live Codec -> Dao edge retained stable deep link `#mention--codec--dao` and exact physical Compendium evidence anchor `#xref-codec--dao`;
- all live relationships remained `mentions` / `observed-xref` only;
- the live observatory remained script-free and retained its explicit interpretation boundary;
- the downloaded live Phase 5 surfaces passed `tools/check_public_boundary.py` across 10 text/machine files;
- `LIVE_PHASE5_BROWSER_OK edge=ok evidence=ok entity-discovery=ok mobile=ok` proved the edge fragment, physical evidence fragment, entity discovery link, and 375px no-overflow path in Chromium.

Therefore Phase 5 is **VERIFIED COMPLETE** at authority, evidence identity, deterministic generation, CI, diff scope, merge, and live-publication layers.

## Museum + AI Phase 6 Canon Inspector and Authority UI — VERIFIED

Phase 6 of 12, **Canon Inspector and Authority UI**, is complete.

Repository evidence:

- starting `main`: `0013e72cc8d3ca471f5ed2b1a71be96cc988469d`
- work branch: `phase-06-canon-inspector`
- primary implementation commit: `d124b1c3fe8990d0cab2e7308f968ed9027463b6`
- one bounded repair: wording-only authority-note repair that removed Markdown emphasis from the explicit complete-canon boundary; no lock data, enforcement behavior, or public scope changed
- successful required CI: run `32656216440`
- implementation PR: `#24`
- merged to `main`: `5dafd7c7cba11b728c9548b009847ca96e8e756f`
- execution-only live proof PR: `#25`, closed unmerged
- successful live proof: run `32656422914`, job `97235761397`

Phase 6 verified capabilities:

- `build/canon_publication.py` deterministically generates/checks the six-file `docs/canon/` publication: static inspector HTML/CSS, lock-register JSON/Markdown, schema, and authority note.
- all 11 public lock records derive from `src/canon/invariants.json` in source order: 2 document locks and 9 section locks. Structural counts, principal-name expectations, and 36 Drakken art-identity section IDs remain explicitly labeled additional strict-validator inputs.
- each record preserves lock ID, source description, scope, declared target, positive requirements, prohibitions, source references, machine-validation authority, validator status, and actual document-versus-section enforcement semantics.
- the human inspector is static and accessible without executable JavaScript; it has stable `#lock-<lock-id>` deep links, explicit technical-pattern disclosures, and links to established public entity material where a lock targets a section.
- the authority boundary is explicit on human, JSON, Markdown, and authority surfaces: authored dossier content remains canon/content authority; `src/canon/invariants.json` is the limited machine-validation authority; generated `/canon/` is a public derivative. Absence from the register does not imply a fact is non-canon, false, or available for invention.
- machine discovery adds `/canon/` to the generated machine index, `llms.txt`, sitemap, versioned schema set, and conservative entity-page discovery links.
- no dependency, canonical-media, authored canon-prose, stable section ID, museum-object identity, or observed `mentions` / `observed-xref` relationship semantic changed. Phase 7 was not started.

Final CI run `32656216440` passed:

- source build and deterministic `./tools/build.sh --check`, including six Canon Inspector outputs;
- strict validator: 11 locks checked, 0 violations;
- public derivative boundary check across 410 text/machine files;
- `git diff --check`;
- pinned Chromium full suite: `140 passed, 1 skipped` including committed visual baselines;
- representative Firefox and WebKit journeys: `7 passed` each.

Live publication was independently verified by execution-only PR #25, closed without merge after proof. GitHub Actions run `32656422914`, job `97235761397`, cache-busted the Pages edge and established:

- `LIVE_PHASE6_BYTES_OK locks=11 document=2 section=9 exact_files=12 boundary=complete`;
- the selected root, Dao entity page, all six Canon Inspector files, machine index/schema, `llms.txt`, and sitemap were byte-identical to merged `docs/`;
- each live lock remained an exact invariant-file derivative, with document/section scope, counts, additional validator inputs, authority boundary, and no script promotion intact;
- downloaded live artifacts passed `tools/check_public_boundary.py` across 11 text/machine files;
- `LIVE_PHASE6_BROWSER_OK deep-link=ok entity-discovery=ok mobile=ok` proved the Dao lock fragment, entity discovery link, and 375px no-overflow path in live Chromium.

Therefore Phase 6 is **VERIFIED COMPLETE** at authority, deterministic generation, scope semantics, CI, merge, and live-publication layers.

## Museum + AI Phase 7 faceted discovery and AI context packets — VERIFIED

Phase 7 of 12, **Faceted Discovery and AI Context Packets**, is complete.

Repository evidence:

- starting `main`: `34846a32eb3ea68d6f58520cc3d36246f0fdb49b`
- work branch: `phase-07-faceted-discovery`
- final validated implementation head: `c9d7bc811ae4d62fc492aefbe197cf4c785de71f`
- one bounded repair commit: `8136b8288632aa340fdf5f4d301316d9a81b44bb`
- repair reason: two pre-existing machine-publication tests still encoded the pre-Phase-7 finite schema/URL set; only those expectations were expanded to the legitimate Phase 7 surface, with no product-semantic change
- successful required CI: run `32658677512`
- implementation PR: `#27`
- merged to `main`: `72837ad5595a0380fe45d2aed1ed7cb5521b6432`
- execution-only live proof PR: `#28`, closed unmerged
- successful live proof: run `32658856927`, job `97241822080`

Phase 7 verified capabilities:

- `build/discovery_publication.py` deterministically generates/checks `docs/discover/`.
- the discovery register contains exactly 127 authored top-level stable records and preserves existing stable IDs/canonical entity destinations.
- the generated surface contains 137 files: 10 fixed discovery/index/schema/authority assets plus 127 per-record JSON context packets.
- the human `/discover/` surface supports structured result classes, authored navigation-group facets, authored archetype facets where available, published-media presence facets, deterministic source excerpts, query/facet URL state, stable result fragments, keyboard result movement, and mobile layout.
- excerpts are mechanical whitespace-normalized truncations of authored source content, not generated summaries or new canon prose.
- every context packet is a compact source-backed convenience derivative preserving the existing record's visibility, `canon_status`, spoiler publication value, related media, source refs, explicit unknowns, and observed-xref direction.
- relationship data remains only `kind=mentions` / `evidence_class=observed-xref`; Phase 7 introduces no friendship, hostility, kinship, causation, chronology, location, or other semantic relationship authority.
- `docs/machine/index.json`, versioned schemas, `llms.txt`, and sitemap discover the Phase 7 human/machine surfaces and packet URLs.
- the entity index exposes a Discover entry point without replacing canonical entity permalinks or legacy Compendium anchors.
- the existing root `dossierSearch` and complete-Compendium navigation remain unchanged and separately supported.
- no dependency, lockfile, canonical-media, authored canon-prose, museum-object identity, or stable section identity changed; Phase 8 was not started.

Final required CI run `32658677512` passed the normal repository matrix, including Chromium and representative Firefox/WebKit journeys. The final diff was clean under `git diff --check`, deterministic build/check parity passed, strict canon validation remained 11 locks / 0 violations, and the public derivative boundary gate included the new discovery surface.

Live publication was independently verified by execution-only PR #28, closed without merge after proof. GitHub Actions run `32658856927`, job `97241822080`, established:

- `LIVE_PHASE7_BYTES_OK records=127 packets=127 exact_files=15 relationships=observed-only root-search=unchanged`;
- 15 selected live root/entity/discovery/machine/orientation files were byte-identical to the merged `docs/` authority;
- the downloaded live proof set passed `tools/check_public_boundary.py` across 13 text/machine files;
- Dao's packet retained `canon_status=unknown` and `mentions` / `observed-xref` relationship evidence only;
- the root still contained `id="dossierSearch"`, proving the complete-Compendium search was not replaced;
- `LIVE_PHASE7_BROWSER_OK deep-link=ok facets=ok keyboard=ok entity-discovery=ok mobile=ok` proved query/facet restoration, stable result deep linking, keyboard result navigation, entity discovery, and 375px no-overflow behavior.

Therefore Phase 7 is **VERIFIED COMPLETE** at authority, deterministic generation, stable identity, context-packet semantics, browser behavior, CI, merge, public-boundary, and live-publication layers.

## Museum + AI Phase 8 curated museum tours and local collections — VERIFIED

Phase 8 of 12, **Curated Museum Tours and Local Collections**, is complete.

Repository evidence:

- starting `main`: `bbb228e21e06883a09210c0e063272a80596190c`
- work branch: `phase-08-tours-local-collections`
- primary generated implementation commit: `36e119f5f5a1b7915e8c4600f66cb349daafa100`
- final validated implementation head: `d2a772baacf606cb6085a84e8378e69d3c19be99`
- implementation repair passes used: zero
- successful one-shot implementation/build/focused proof: run `32659489379`
- successful required CI: run `32659617585` (Chromium, Firefox, WebKit PASS)
- implementation PR: `#30`
- merged to `main`: `6520f43574eac8de64d67da77dca19bc99f3eb46`
- execution-only live proof PR: `#31`, closed unmerged
- successful live proof: run `32659776026`, job `97244053606`

Phase 8 verified capabilities:

- `build/tour_publication.py` deterministically generates/checks the six-file `docs/tours/` publication.
- six stable curated-tour IDs bind to the six existing authored navigation groups; 29 tour stops derive exactly from `src/content/nav.json` order and established stable IDs.
- tour machine records carry stable IDs, display labels, canonical/legacy destinations, source refs, and editorial-navigation authority only; they do not duplicate section body prose, excerpts, per-record canon status, spoiler data, or inferred lore.
- the human `/tours/` surface provides stable tour fragments plus record-library fragments while keeping canonical record links on `/entities/<stable-id>/`.
- the browser-local library persists bookmarks, recent openings, timestamped local history, completion progress, and user-named collections with a clear-data control; storage failure degrades to page-session memory.
- private local names and history are not generated, published, or placed in public URLs; no account, analytics, telemetry, beacon, server-write path, or external runtime service is introduced.
- local library state is explicitly user preference/state, never canon, chronology, relationship, or evidence authority.
- existing entity pages remain script-free except inert JSON-LD and expose only conservative links to the tours/local-library surface; the root complete-Compendium search remains unchanged.
- machine publication now discovers the tour human/JSON/schema/authority endpoints through the existing machine index, versioned schema directory, `llms.txt`, and sitemap.
- Phase 9 was not started.

Live publication proof established:

- `LIVE_PHASE8_BYTES_OK tours=6 exact_files=13 local_state=browser-only private_urls=clean root-search=unchanged`;
- selected live entity/discovery/tour/machine/orientation files were byte-identical to merged `docs/`;
- downloaded live text/machine artifacts passed `tools/check_public_boundary.py` across 11 files;
- exact principal-character tour order remained `shard-god`, `codec`, `dao`, `kail`, `marcel`, `jazen`;
- the browser-local policy remained no-account, no-telemetry, unpublished, and private-text-out-of-URLs;
- `LIVE_PHASE8_BROWSER_OK deep-link=ok bookmark=ok collections=ok progress=ok recent-history=ok entity-discovery=ok mobile=ok network=local-origin-only` proved live persistence/clearing, record navigation, private collection URL isolation, origin-local networking, entity discovery, and 375px no-overflow behavior.

Therefore Phase 8 is **VERIFIED COMPLETE** at authority, deterministic generation, privacy/local-state semantics, CI, diff scope, merge, public-boundary, and live-publication layers.

## Museum + AI Phase 9 interactive chronology, canon status, and spoiler views — VERIFIED

Phase 9 of 12, **Interactive Chronology, Canon Status, and Spoiler Views**, is complete.

Repository evidence:

- starting `main`: `31de35ab9f4e0b6ad284c2ce11c4b3da24b4e642`
- work branch: `phase-09-interactive-chronology`
- final validated implementation head: `b1de688352db864860e97b2e4103790360065ae5`
- one bounded pre-commit repair corrected a schema/source-record key mismatch; no event fact, temporal value, or public behavior changed
- successful required CI: run `32671213475` (Chromium job `97272242223`, Firefox job `97272242125`, WebKit job `97272242054`)
- implementation PR: `#34`; merged to `main`: `3ed684897975065d89f5e12c8c15b36f936c0262`
- execution-only live proof PR: `#35`, closed unmerged; successful run `32671419187`, job `97272730778`

Phase 9 verified capabilities:

- `build/chronology_publication.py` deterministically generates/checks seven `/chronology/` artifacts: accessible HTML explorer, CSS, JavaScript, JSON, Markdown, schema copy, and authority note.
- 27 events derive only from direct labels in `src/content/sections/chronology.body.html`, cited through stable record `chronology` and authored source key `five-phase-canon-chronology`; no source-list order becomes an inferred chronology relation.
- the temporal model preserves 5 exact authored markers, 6 relative markers, 1 authored 170-year duration, and 15 unknown temporal states. All absolute dates are null.
- event visibility remains public because the cited source is already public; event-level canon status and spoiler level remain unknown because no structured authority authors them. These dimensions remain independent from temporal certainty.
- filters are current-view behavior only. The underlying `chronology.json` continues to expose every event and its status/temporal values regardless of a browser filter.
- machine index, versioned schema directory, `llms.txt`, sitemap, and entity navigation expose the chronology surface without changing root search, entity identity, observed relationship semantics, museum identity, discovery/context packets, or tours/local state.

Live publication proof established:

- `LIVE_PHASE9_BYTES_OK events=27 exact_files=13 exact_markers=5 relative=6 duration=1 unknown=15 status=independent root-search=unchanged` proved byte parity for chronology, machine, orientation, sitemap, and selected entity artifacts.
- downloaded live artifacts passed `tools/check_public_boundary.py` across 11 text/machine files.
- `LIVE_PHASE9_BROWSER_OK deep-link=ok filter=view-only status=preserved keyboard=ok source-links=ok mobile=ok network=local-origin-only` proved live Chromium deep links, no JSON mutation from filtering, keyboard focus, source links, 375px layout, and same-origin networking.

Therefore Phase 9 is **VERIFIED COMPLETE** at authority, deterministic generation, source/status/temporal semantics, CI, merge, public-boundary, and live-publication layers.

## Museum + AI Phase 10 WorldsVault Cosmic Topology Explorer — VERIFIED

Phase 10 of 12 is complete.

- starting main: eeb01b3695d5c289786293b8a8204085817120b8; implementation commit: 9c713c7591fd8fb350faff5605cbdb961e233efa
- implementation PR #36 merged at 9b05fe5873e171b63399558215189436213ae62f after CI run 32673667684 passed Chromium job 97278239393, Firefox job 97278239466, and WebKit job 97278239455.
- deterministic WorldsVault publication: seven files under /worldsvault/ (human explorer, CSS/JS, JSON, Markdown, schema, and authority) sourced from 11 cited nodes and 6 direct authored semantic edges.
- direct relations only: WorldsVault contains the extinct template set; the set seeds the Partition; the Siege Wall contains the Drakken domain; Mother is in the Aureal Nebula; Meridian Station orbits Virgil; Codified Waves uses the Hookshot Network.
- mother reuses its authored stable ID. Other node and edge IDs are explicit deterministic publication derivatives, not new authored permanent identities.
- each record exposes cited source path/stable record/heading/source key where authored, direct-authored certainty, public visibility, unknown canon status/spoiler level, explicit unknowns, and separate non-canonical layout group/order. No coordinates, distances, directions, route geometry, spatial extent, membership, or complete map was invented.
- the 127 existing stable records and 136 mentions / observed-xref edges remain unchanged and separate from topology evidence. The 30 WorldsVault template display labels are not silently promoted to permanent IDs or map positions.
- the explorer includes node/edge fragments, source cards, complete textual equivalent, keyboard selection/clear behavior, responsive mobile layout, JSON/Markdown/schema/authority alternatives, and same-origin-only behavior. Machine index, schema, llms orientation, sitemap, public-boundary declarations, and entity navigation discover it.
- focused topology/machine/cross-browser coverage passed 26 tests with deterministic build/check, strict validation, boundary validation, and diff check. The macOS full suite had seven known visual-baseline mismatches on unchanged root captures; hosted pinned Chromium passed the complete suite.
- live proof PR #37 was execution-only and closed without merge. Initial run 32673848241 reached the live page and found only an overescaped proof regex; no product bytes changed. One harness-only repair followed.
- repaired proof run 32673946000 established LIVE_PHASE10_BYTES_OK for nodes=11, edges=6, 14 exact merged surfaces, machine/sitemap/orientation/entity discovery/root parity, and public-boundary safety; LIVE_PHASE10_BROWSER_OK confirmed the Meridian deep link, keyboard edge selection, text equivalent, source availability, 375px layout, and same-origin networking.

Therefore Phase 10 is **VERIFIED COMPLETE** at authority, deterministic generation, topology semantics, identity/unknown boundaries, CI, merge, public boundary, accessibility, and live publication layers.

## Museum + AI Phase 11 Installable Offline Museum — VERIFIED

Phase 11 of 12 is complete.

- implementation commit: `5768362`; PR #38 merged to `main` at `457d5226b03a5ae1a2d58278ed6af850a532c73e`.
- `build/offline_publication.py` owns and deterministically checks six generated root artifacts: manifest, project-scoped service worker, client, fallback HTML/CSS, and icon. The root shell supplies installation metadata plus accessible cache status/clear controls.
- the worker precaches only the reading shell and selected public JSON indexes (under 2 MB). `docs/assets/media/` is explicitly excluded from the precache and worker cache writes, so all 213 published media assets remain on demand.
- registration uses `scope: './'`; installed start and worker scope remain inside the repository Pages path. Failed/partial cache work and clear errors leave normal network browsing usable and are reported through the root status region.
- offline navigation has two deliberately separate outcomes: the project root serves cached `index.html`; unavailable/unknown routes serve the explicit fallback page.
- first PR CI run `32675003892` passed all functional tests but exposed four intentional visual reference changes from the new root controls. A single bounded repair replaced only those four references with the pinned CI runner captures. Required PR CI run `32675229686` then passed Chromium job `97282054859`, Firefox job `97282054918`, and WebKit job `97282054919`; merge CI run `32675377118` passed as well.
- GitHub Pages built merge `457d522` successfully. Live byte parity passed for `index.html`, manifest, worker, client, fallback HTML, and fallback CSS. A real live HTTPS Chromium session established exact project scope, shell/metadata-only cache contents, absence of `/assets/media/` cache entries, cached-root offline behavior, and explicit fallback behavior.

Therefore Phase 11 is **VERIFIED COMPLETE** at deterministic generation, bounded offline policy, project scope, cache-clearing/failure behavior, CI, merge, Pages publication, and live browser layers. Phase 12 has not been started.

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

## Drakken information architecture regrouping — BUILD-VERIFIED

- `src/content/nav.json` has exactly six top-level navigation groups and one dedicated `Drakken` group.
- That group contains `drakken-registry` plus every authored top-level record classified `drakken-page`, exactly once and in source order.
- Mother is classified as Drakken genesis; Cradle.exe, Foldhowl, and Manifest.Discord are classified as glitch-touched Drakken. They are no longer members of the peripheral registry.
- The Drakken records are contiguous in `src/content/sections.json`; stable section IDs and legacy folio literals are preserved.
- The strict structural taxonomy counts are now `peripheral=41` and `drakken=60`, matching the corrected record classifications; the count gate remains enforced.
- `starsilk-material` and `blood-rings` remain non-Drakken records and now live in the existing `Canon & cosmology` navigation group.
- The stable tour ID `drakken-blood-systems` is preserved but now binds to the renamed `Drakken` navigation group; the six-tour architecture remains intact.
- `tests/test_drakken_navigation.py` prevents incomplete Drakken grouping, accidental peripheral reclassification, count-lock drift, seventh-group drift, and tour-binding drift.
- The deterministic publication is rebuilt and checked in GitHub Actions run `33052821820` before the repair commit. Full Chromium/Firefox/WebKit PR CI remains the merge gate.

## Known limitations

- The durable cold-start gate proves that required recovery evidence remains present and source-linked in the repository; it does not claim that every external AI model will reason correctly from that evidence or that external services are reachable without fresh probes.
- Google Drive connector transfer ceilings require the durable backup to be stored as verified ordered chunks rather than one 582 MB Drive object. This is a transport constraint, not a content-integrity gap.
- One-time recovery branch `recovery/canonical-media-archive` may remain until branch cleanup is available; its PR is execution-only and must not be merged into production.
- Chronology event publication IDs are Phase 9 source-backed derivatives from direct authored labels; they are not authored historical IDs. Unsupported absolute dates, ordering, durations, and event-level canon/spoiler status remain unknown.
- Many WorldsVault template records do not yet have authored stable IDs; display labels/media references are not silently promoted into permanent object identity.
- The Relationship Observatory exposes the current 138 observed xref `mentions` edges with source/evidence traceability, but no stronger semantic relationship authority exists; semantic meaning remains unauthored unless a later explicit authority is added.
- Per-section canon status remains unauthored in the current source model; Phase 2 publishes `canon_status=unknown` rather than guessing.
- Phase 2 uses `spoiler_level=major` as a conservative publication default; that is publication policy, not a canon fact.
- Phase 4 museum deep links are fragment routes over one static `/objects/` document, not separate server-side HTML resources.
- Static IIIF is not part of the current publication; it remains a future option only if later requirements justify tile/deep-zoom/interoperability infrastructure.
- Phase 4 context links preserve published placement evidence only; richer relationship semantics remain unauthored and belong to Phase 5.
- The canonical human permalink layer covers only the 127 authored top-level section IDs. Phase 9 chronology fragments are source-backed publication deep links; WorldsVault record IDs remain unknown rather than being inferred.
- Phase 7 faceted discovery and AI context packets likewise cover only those 127 authored top-level stable records. They do not manufacture WorldsVault IDs, semantic relationships, dates, or coordinates.
- Phase 8 browser-local bookmarks/history/progress/collections are intentionally per browser origin/profile and do not sync through an account or server; this privacy/locality constraint is deliberate, not missing canon infrastructure.

## Pending

- None. Museum + AI remains complete at Phase 12 of 12; there is no Phase 13. The post-program Drakken archive repair is locally closed with fresh Operational State and a source-derived live Pages proof contract; promotion must run the required CI and live-edge proof.

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
- Revision 12: completed Museum + AI Phase 4. Added a deterministic 213-record manifest-derived museum object model, stable filename-stem object IDs, explicit provenance/unknown semantics, `/objects/` metadata register, on-demand accessible image/video dialog viewer, hash deep links, entity-index discovery, schema/authority publication, build integration, and regression coverage. No implementation repair pass was needed. PR #18 passed final Chromium/Firefox/WebKit CI and merged at `258ce10f9d0d73b22163ae22243b953af99427fc`; live proof run `32642574092` verified exact Pages bytes plus metadata-only/image/video/teardown behavior, and proof PR #19 was closed unmerged. Static IIIF was evaluated and not adopted.
- Revision 13: completed Museum + AI Phase 5. Added the deterministic 127-record/136-edge Relationship Observatory, stable entity/edge fragments, exact physical xref evidence anchors, JSON/Markdown/schema/authority alternatives, entity discovery, build integration, observed-only semantic locks, clean-output regression coverage, and live Pages proof. PR #21 passed final Chromium/Firefox/WebKit CI (`135 passed, 1 skipped`) and merged at `0f31a280eebdbaf68bda9265d3fa54aed806f120`; execution-only proof PR #22 was closed unmerged after run `32649700329` proved exact live bytes, public-boundary safety, evidence fragments, entity discovery, and mobile Chromium behavior.
- Revision 14: completed Museum + AI Phase 6. Added the deterministic six-file Canon Inspector, exact 11-lock register, explicit document/section enforcement semantics, technical-pattern labeling, authority/schema alternatives, machine/sitemap/orientation and entity discovery, and focused regression coverage. One bounded wording-only repair preserved an explicit plain-text complete-canon boundary. PR #24 passed final pinned Chromium/Firefox/WebKit CI (`140 passed, 1 skipped`) and merged at `5dafd7c7cba11b728c9548b009847ca96e8e756f`; execution-only proof PR #25 was closed unmerged after run `32656422914` proved exact live bytes, public-boundary safety, lock scope/derivation, deep links, discovery, and mobile Chromium behavior. Phase 7 was not started.
- Revision 15: completed Museum + AI Phase 7. Added deterministic 127-record faceted discovery, 127 compact source-backed AI context packets, 137-file `/discover/` publication, mechanical source excerpts, structural/authored facets, query/facet deep links, keyboard navigation, versioned schemas, machine/sitemap/orientation discovery, and entity-index discovery while preserving the root `dossierSearch`. One bounded test-expectation repair updated the pre-Phase-7 finite machine schema/URL assertions without changing product semantics. PR #27 passed final Chromium/Firefox/WebKit CI run `32658677512` and merged at `72837ad5595a0380fe45d2aed1ed7cb5521b6432`; execution-only proof PR #28 was closed unmerged after run `32658856927` / job `97241822080` proved exact live bytes, public-boundary safety, source/unknown/observed-xref packet semantics, deep links, facets, keyboard behavior, entity discovery, unchanged root search, and mobile Chromium behavior. Phase 8 was not started.
- Revision 16: completed Museum + AI Phase 8. Added six stable-ID curated routes/29 authored-navigation stops, deterministic `/tours/` human/JSON/schema/authority publication, browser-local bookmarks/recent/history/progress/named collections with clear/fallback behavior, privacy/locality authority rules, machine/sitemap/orientation discovery, and conservative entity/discovery entry points without changing root search or record authority. No implementation repair was needed. PR #30 passed final Chromium/Firefox/WebKit CI run `32659617585` and merged at `6520f43574eac8de64d67da77dca19bc99f3eb46`; execution-only proof PR #31 was closed unmerged after run `32659776026` / job `97244053606` proved exact live bytes, public-boundary safety, exact tour derivation, private-text URL isolation, persistence/clear behavior, origin-local networking, entity discovery, and mobile Chromium behavior. Phase 9 was not started.
- Revision 17: completed Museum + AI Phase 9. Added deterministic source-backed `/chronology/` human/JSON/Markdown/schema/authority publication for 27 direct-label events, preserving 5 exact authored markers, 6 relative markers, one 170-year authored duration, null absolute dates, and 15 unknown temporal states. Event visibility remains public while canon status and spoiler level remain independently unknown; UI filters are view-only and cannot mutate machine status. One bounded pre-commit schema/source-record key repair was made. PR #34 passed Chromium/Firefox/WebKit CI run `32671213475` and merged at `3ed684897975065d89f5e12c8c15b36f936c0262`; execution-only proof PR #35 was closed unmerged after run `32671419187` / job `97272730778` proved live byte parity, public-boundary safety, deep links, filter/status preservation, keyboard/source-link behavior, mobile layout, and same-origin networking. Phase 10 was not started.
- Revision 18: completed Museum + AI Phase 10. Added deterministic seven-file WorldsVault topology publication from 11 source-cited nodes and 6 direct-authored edges, explicit publication-derived identity, separate non-canonical layout, independent public/unknown/unknown status, accessible text/keyboard/mobile behavior, and machine/schema/sitemap/entity discovery. Existing stable IDs, observed-xref mentions, and unauthored template positions remained unchanged. PR #36 passed CI run `32673667684` and merged at `9b05fe5873e171b63399558215189436213ae62f`. Execution-only proof PR #37 closed unmerged after repaired proof run `32673946000` proved byte parity, boundary safety, deep links, keyboard behavior, text equivalent, mobile layout, source links, and same-origin networking. Phase 11 was not started.
- Revision 19: completed Museum + AI Phase 11. Added deterministic six-file installable offline publication with root manifest/client UI, project-relative service-worker scope, under-2-MB shell/metadata precache, strict on-demand media boundary, cache clear/failure reporting, cached-root and explicit fallback navigation, focused browser coverage, and a bounded pinned visual-reference refresh. PR #38 CI run `32675229686` passed Chromium/Firefox/WebKit, merged at `457d5226b03a5ae1a2d58278ed6af850a532c73e`, and live Pages proof established byte parity plus real HTTPS worker/cache/offline behavior. Phase 12 was not started.
- Revision 20: completed Museum + AI Phase 12, both parts. Part A (PR #39, merged `3431f14941f20a0105ac70275360d6aaa07f6014`) published the agent evaluation harness: `src/agents/AUTHORITY.md`/`evaluation-fixtures.json`, `build/agent_publication.py`, and the `docs/agents/` publication set, with a 10/10-check deterministic integration certificate and a 13-category/7-penalty evaluation contract; CI run `32676564639` and live-proof run `32676803602` (job `97286337702`, PR #40, closed unmerged) both passed. Part B (PR #42, branch `fix/unified-museum-final-integration`, merged `e2950ec0645f699fcd311f891129e7b558285476`) closed the one remaining integration defect Part A left open: the root page still looked like the pre-museum dossier shell with no visible path into any of the eight public systems. Added the shared `src/templates/_museum_nav.html.j2` navigation partial (included by the root shell and every secondary system template plus entity records -- no new build-script code required), a real museum entrance on the root page (hero, exploration cards, Data/AI strip, lead-in to the unabridged Compendium below) with every statistic computed in `build/generate.py` from existing source/generated data, and a deterministic `data-museum-shell="unified"` marker verified by `tests/test_unified_museum_shell.py`. Fixed three tests whose assumptions no longer held once the cover section stopped being the first thing in the viewport (ambient-watermark initial state, a lazy-loaded image needing an explicit scroll, and the page `<title>`). Visual baselines for the seven screenshots whose layout legitimately changed were regenerated inside the pinned CI Playwright container via a one-shot `workflow_dispatch` runner that was removed once its commit landed. PR #42 CI run `32682068700` passed the full Chromium suite (180 tests) plus Firefox/WebKit representative journeys; GitHub Pages built the merged commit (`pages/builds/1170882630`, status `built`), and live verification confirmed the unified-shell marker and HTTP 200 responses at `/`, `/discover/`, `/entities/`, `/objects/`, `/relationships/`, `/canon/`, `/tours/`, `/chronology/`, and `/worldsvault/`. The Museum + AI program (Phases 1-12) is now complete; there is no Phase 13.
- Revision 21: closed the post-Phase-12 visual-coverage publication gap. PR #47 merged at `3801b500c08c3842c3a54445db503610eac92200` with source-backed visual coverage for all 127 authored records and 138 observed-xref relationships preserved; PR #48 merged at `be9bc848788e1a6e3972a615f050a5f2d10a9d59` to make Pages proof exact-commit and semantic; PR #50 merged at `acf7a97b9872d6baf9d6c40f1fca03401671c263` to skip redundant legacy rebuilds for workflow-only changes while retaining strict source-change/live proof.
- Revision 22: reconciled the ledger to current `main` through `c91bfa0231982314edfb241ca10c38b94807ed51`, recording source-of-truth graph PR #52 and build-provenance PR #53 plus successful main/provenance evidence; added the bounded read-only Operational State freshness contract, policy, checker, CI gate, regression coverage, and derivation-graph integration on `uplift/operational-state-sentinel`. Merge and post-merge main proof remain pending.
- Revision 23: closed the Operational State freshness sentinel after PR #54 merged at `1c321fcbcad81f0e0116ee6748febe7e647703fe`. Main CI run `33045765364` proved exact-base freshness closure from `c91bfa0231982314edfb241ca10c38b94807ed51`, deterministic build/docs parity, `223 passed, 1 skipped` Chromium coverage, and green Firefox/WebKit journeys; Build Provenance run `33045915082` succeeded for the merge. No media, dependency, generated-publication, or public-UI source changed, so Pages/live-edge proof was not required.
- Revision 24: added the zero-memory cold-start recovery entrypoint, ten-category machine evidence contract, README discovery path, and dependency-free regression gate so a successor can reconstruct the project from repository evidence without chat memory; recorded the external-model reasoning limit without creating a second state/canon/publication authority.
- Revision 25: regrouped all authored Drakken records under one dedicated navigation section, corrected four Drakken records previously typed/indexed as peripheral, aligned strict structural taxonomy counts to 41 peripheral / 60 Drakken, preserved the six-group/six-tour architecture and stable tour ID, added regression coverage, and rebuilt deterministic publication in GitHub Actions run 33052821820.
- Revision 26: closed the local post-program Drakken archive repair. Recorded the root disclosure/template/test changes required by the freshness sentinel, proved the source-derived relationship publication at 135 `kind=mentions` / `evidence_class=observed-xref` edges, and changed the Pages live proof to compare the cache-busted publication byte-for-byte with checked-in `docs/relationships/relationships.json` while retaining semantic boundary assertions for promotion-time CI.
