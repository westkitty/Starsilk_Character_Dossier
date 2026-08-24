# Starsilk Museum + AI Roadmap

This is the durable execution ledger for the twelve-phase Starsilk Compendium museum + AI-readable knowledge-system program.

It records **desired/planned work and phase progress**. `OPERATIONAL_STATE.md` records what is currently real and verified. If this roadmap conflicts with repository/runtime evidence, reality wins and the discrepancy must be resolved before implementation continues.

## Execution law

- Execute exactly one numbered phase per chat turn.
- Every phase begins by verifying current repository reality.
- Preserve the static `src/content/ + src/templates/ -> build/generate.py -> docs/index.html -> build/validate.py` publication architecture unless evidence proves it cannot satisfy a necessary capability.
- Use one coherent implementation pass and at most one bounded repair pass.
- A phase is complete only after required validation, diff review, commit/push, CI, merge to `main`, and publication verification when public artifacts changed.
- Never begin the next phase automatically.
- Do not create a second canon prose authority. Prefer authoritative source -> deterministic derivative.

## Phase ledger

| Phase | Title | Status | Completion evidence | Blocker / deferred note |
|---|---|---|---|---|
| 1 | Foundation, Roadmap, and Publication Boundary | COMPLETE | PR #11; implementation head `45ce3ae4e8cea26f29c46d221bc7539274ee1fb3`; CI `32637622651` PASS; merged `ea287f572264eee625708d22b95a2d482b7d8a87` | none |
| 2 | Machine Publication Layer | COMPLETE | PR #12; final head `e64068a821df51cfb67cdd335007287d64d31fc7`; CI `32639102690` PASS; merged `d23d940ae306017550ef69265f0bea8d64a7c303`; live proof `32639347205` PASS | none |
| 3 | Stable Entity Pages and Permalinks | COMPLETE | PR #15; final head `54da12779396175622aab1faafa64fbb4b652c2a`; CI `32640613872` PASS; merged `b7726adc86f967e914616c07b5b4b6179236dbf3`; live proof `32640932505` PASS | none |
| 4 | Museum Object Model and Media Viewer | COMPLETE | PR #18; final head `0603379d0ea6a364e0d5d608685f38b27f95bfc9`; CI `32642262682` PASS; merged `258ce10f9d0d73b22163ae22243b953af99427fc`; live proof `32642574092` PASS | none |
| 5 | Relationship Observatory | COMPLETE | PR #21; final head `72cf3f42f2014e2bc7a6d408f366185a7f5e7d07`; CI `32649254977` PASS; merged `0f31a280eebdbaf68bda9265d3fa54aed806f120`; live proof `32649700329` PASS | none |
| 6 | Canon Inspector and Authority UI | COMPLETE | PR #24; implementation head `d124b1c3fe8990d0cab2e7308f968ed9027463b6`; CI `32656216440` PASS; merged `5dafd7c7cba11b728c9548b009847ca96e8e756f`; live proof `32656422914` PASS | none |
| 7 | Faceted Discovery and AI Context Packets | COMPLETE | PR #27; final head `c9d7bc811ae4d62fc492aefbe197cf4c785de71f`; CI `32658677512` PASS; merged `72837ad5595a0380fe45d2aed1ed7cb5521b6432`; live proof `32658856927` PASS | none |
| 8 | Curated Museum Tours and Local Collections | COMPLETE | PR #30; final head `d2a772baacf606cb6085a84e8378e69d3c19be99`; CI `32659617585` PASS; merged `6520f43574eac8de64d67da77dca19bc99f3eb46`; live proof `32659776026` PASS | none |
| 9 | Interactive Chronology, Canon Status, and Spoiler Views | COMPLETE | PR #34; final head `b1de688352db864860e97b2e4103790360065ae5`; CI `32671213475` PASS; merged `3ed684897975065d89f5e12c8c15b36f936c0262`; live proof `32671419187` PASS | none |
| 10 | WorldsVault Cosmic Topology Explorer | COMPLETE | PR #36; implementation `9c713c7`; CI `32673667684` PASS; merged `9b05fe5`; live proof `32673946000` PASS | none |
| 11 | Installable Offline Museum | COMPLETE | PR #38; implementation `5768362`; CI `32675229686` PASS; merged `457d522`; Pages build and live shell/metadata/media-boundary proof PASS | none |
| 12 | AI Agent Evaluation Harness and Final Integration | NOT STARTED | — | deferred |

## Phase 1 — Foundation, Roadmap, and Publication Boundary

### Objective

Create the durable knowledge contract upon which every later museum and agent-facing derivative depends, without redesigning the public UI.

### Required outcome

- preserve existing stable public/project identifiers;
- document the authority hierarchy;
- establish a minimal metadata contract with independent visibility, canon-status, and spoiler dimensions;
- preserve explicit unknown state;
- define relationship evidence semantics;
- add schema/metadata validation without a new dependency;
- add a regression guard against private/local-only material entering future public machine exports;
- keep the existing build healthy.

### Stable-identity findings

Observed current identities that are already suitable for preservation:

- section IDs in `src/content/sections.json` and their generated public anchors;
- navigation references in `src/content/nav.json`;
- xref targets emitted as `#<section-id>`;
- existing section `data-source-key` values such as `five-phase-canon-chronology`;
- legacy archive `data-asset-key` identifiers;
- media filenames/hashes/provenance identities in `docs/asset-manifest.json`.

Observed gaps that remain explicit rather than guessed:

- individual chronology-event IDs are not authored in the current chronology prose;
- many WorldsVault records have display labels/media references but no authored stable record ID;
- current relationship generation proves `mentions` edges, not richer semantic relations;
- later museum object IDs must derive from stable asset/media authority rather than decorative ordering.

The detailed governing contract is `MUSEUM_AI_FOUNDATION.md` and the v1 metadata schema is `src/schema/metadata-record.schema.json`.

### Completion record

- starting `main`: `f885a18cade0d81e02c0d7ed52ff2d9549521bd3`
- work branch: `phase-01-foundation`
- primary implementation commit: `b8e60a9577108ad3b339dcc1b39a319e7b0db562`
- bounded repair commit: `45ce3ae4e8cea26f29c46d221bc7539274ee1fb3`
- repair reason: one new assertion compared required contract wording case-sensitively; the repair made that wording assertion case-insensitive without weakening the contract or changing implementation behavior
- successful CI run: `32637622651`
- PR: `#11`
- implementation merge on `main`: `ea287f572264eee625708d22b95a2d482b7d8a87`
- public `docs/` output changed: no
- Pages/publication rebuild required by Phase 1: no
- files introduced: `MUSEUM_AI_FOUNDATION.md`, `MUSEUM_AI_ROADMAP.md`, `src/schema/metadata-record.schema.json`, `tools/validate_metadata_contract.py`, `tools/check_public_boundary.py`, `tests/test_museum_foundation.py`

## Remaining phase contracts

### Phase 2 — Machine Publication Layer

Generate deterministic public machine entry points: versioned schemas, project/entity indexes, Markdown alternatives, relationship JSON, sitemap/orientation surfaces, source/authority documentation, and only semantically valid JSON-LD. Verify all public URLs and boundaries live.

#### Completion record

- starting `main`: `55427686853a8f8ee049ad38b01fe92ec097aa20`
- work branch: `phase-02-machine-publication`
- primary implementation commit: `d4d73223a2f5975945ad1aa607f1880f0a54936a`
- one bounded implementation repair: `0f42f2527ac3bef7b1d17e8bb5322363a1f87e0e`
- repair reason: the focused test incorrectly required `llms.txt` to link to itself; the assertion was corrected without changing publication semantics
- exact generated-publication commit: `d60b66214598f0263d79d48059d32e715e9699c9`
- final CI head: `e64068a821df51cfb67cdd335007287d64d31fc7`
- successful required CI: `32639102690`
- implementation PR: `#12`
- implementation merge on `main`: `d23d940ae306017550ef69265f0bea8d64a7c303`
- execution-only live proof PR: `#13`, closed unmerged
- successful live proof: run `32639347205`, job `97193914513`
- machine entity index: 127 authored top-level `src/content/sections.json` records; this is deliberately distinct from the existing DOM validator's 138 rendered `<section>` count
- observed relationship graph: 136 `mentions` edges, each classified `observed-xref`
- public machine surface: 14 declared URLs total (site root + 13 text/machine files)
- live proof result: all 13 non-root files were byte-identical to merged `docs/`; root retained current Compendium markers; downloaded live machine files passed `tools/check_public_boundary.py`
- Phase 2 did not add entity HTML pages, event IDs, WorldsVault IDs, richer relationship semantics, new dependencies, canon prose, media-source mutations, or public UI redesign

**Completion verdict: VERIFIED.**

### Phase 3 — Stable Entity Pages and Permalinks

Generate first-class human/shareable entity destinations from existing authority while preserving the complete Compendium, source parity, related media/entities, machine alternatives, and old anchors.

#### Completion record

- starting `main`: `5e8e6d1d43326b43440689b72ce81e4d57a29da9`
- work branch: `phase-03-entity-permalinks`
- final validated implementation head: `54da12779396175622aab1faafa64fbb4b652c2a`
- successful required CI: `32640613872`
- one bounded implementation repair: `6143bde80d354d70788252cad280edfc1ac33825`
- repair reason: the pre-existing repo-wide `archive/` ignore rule silently excluded the generated permalink for the authored stable ID `archive`; the repair preserved the local/offline archive ignore while explicitly allowing `docs/entities/archive/index.html` and added a regression proving every authored permalink path is trackable
- implementation PR: `#15`
- implementation merge on `main`: `b7726adc86f967e914616c07b5b4b6179236dbf3`
- execution-only live proof PR: `#16`, closed unmerged
- successful live proof: run `32640932505`, job `97197796536`
- canonical human publication: 127 `/entities/<stable-id>/` pages plus `/entities/` index and shared stylesheet
- per-record machine alternatives: 127 JSON + 127 Markdown files keyed by the same stable IDs
- declared live surface: 396 URLs; all were served byte-for-byte from merged `docs/`
- legacy compatibility: every original `/#<stable-id>` Compendium anchor remained present and every entity page linked back to its legacy location
- repaired collision proof: `/entities/archive/` was live with `data-stable-id="archive"`
- live public-boundary recheck: 395 downloaded text/machine derivative files passed
- first exhaustive live-proof attempt encountered a transient CDN HTTP 503; only the proof harness was paced/retried, with no product mutation, and the complete rerun passed
- Phase 3 did not create museum-object IDs/viewer behavior, chronology-event IDs, WorldsVault IDs, richer relationship semantics, new dependencies, canon prose changes, media-source changes, or a root Compendium redesign

**Completion verdict: VERIFIED.**

### Phase 4 — Museum Object Model and Media Viewer

Promote existing media identities into provenance-aware museum objects and build an accessible, deep-linkable fullscreen viewer without eager-loading the archive or committing canonical originals. Evaluate static IIIF only if it cleanly fits the static architecture.

#### Completion record

- starting `main`: `06c1acaee9bdb1127df7902d702d8d062b62a40c`
- work branch: `phase-04-museum-objects`
- exact generated-publication commit: `bed865afb3195ce972c41b58d4d0eed516a3aa92`
- final validated implementation head: `0603379d0ea6a364e0d5d608685f38b27f95bfc9`
- successful one-shot generation/focused proof: run `32642163782`, job `97200820702`
- successful required final CI: `32642262682`
- implementation repair passes used: zero
- implementation PR: `#18`
- implementation merge on `main`: `258ce10f9d0d73b22163ae22243b953af99427fc`
- execution-only live proof PR: `#19`, closed unmerged
- successful live proof: run `32642574092`, job `97201827679`
- museum object register: 213 records, exactly matching the 213 existing `docs/asset-manifest.json` published-media entries
- stable object identity: `object_id` is the published filename with only its final extension removed; the complete filename remains the provenance source key
- generated public museum surface: six `docs/objects/` text/code files (`index.html`, `museum.css`, `museum.js`, `objects.json`, `schema.json`, `AUTHORITY.md`); no media binaries are copied into the museum tree
- human deep links: `/objects/#<object-id>`; the base register loads metadata only and creates exactly one media element only after selection/deep-link
- viewer behavior: native dialog, keyboard/Escape closure, previous/next navigation, optional user-triggered browser fullscreen, controlled image/video rendering, no video autoplay, and media teardown on close
- provenance semantics: `logical_identity`, `match_status`, provenance, and section context remain descriptive manifest evidence and never replace object identity or create stronger relationship/canon claims
- explicit unknowns are preserved when logical identity, context, or authored alt text is absent
- entity index now exposes a human `Browse museum objects` entry point; existing entity records, stable IDs, and legacy Compendium anchors remain unchanged
- static IIIF was evaluated and deliberately not adopted because current requirements need neither tiled deep zoom, region annotation, nor IIIF interoperability; adding it would create unnecessary derivative/distribution infrastructure
- first live-browser proof attempt used one brittle immediate text assertion after the dialog opened; only the read-only proof harness was changed to Playwright retry-aware assertions, with no product mutation, and the full rerun passed
- live proof established `LIVE_PHASE4_BYTES_OK objects=213 exact_files=9 identity=ok provenance=ok unknowns=ok root=ok`
- live browser proof established `LIVE_PHASE4_BROWSER_OK metadata_only=ok image=ok video=ok escape=ok teardown=ok discovery=ok`
- live downloaded Phase 4 surfaces passed `tools/check_public_boundary.py`
- Phase 4 did not modify root Compendium content, canon sources, `docs/asset-manifest.json`, `docs/assets/media/`, `media/source/`, dependencies, Phase 3 stable identities, or Phase 5 relationship semantics

**Completion verdict: VERIFIED.**

### Phase 5 — Relationship Observatory

Expose source-traceable incoming/outgoing observed relationships with deep links and an accessible text representation. Do not promote mentions into semantic facts.

#### Completion record

- starting `main`: `980823f8e5545d1963e447f213af07cec74658c7`
- work branch: `phase-05-relationship-observatory`
- exact generated-publication commit: `e56b2dceb3bd4424f3138229f9212f3aa0c990bc`
- final validated implementation head: `72cf3f42f2014e2bc7a6d408f366185a7f5e7d07`
- successful required final CI: run `32649254977`
- implementation PR: `#21`
- implementation merge on `main`: `0f31a280eebdbaf68bda9265d3fa54aed806f120`
- execution-only live proof PR: `#22`, closed unmerged
- successful live proof: run `32649700329`, job `97219258645`
- relationship observatory: 127 published records and the existing 136 observed `mentions` / `observed-xref` edges; no semantic relationship class was introduced
- evidence identity: every physical rendered xref has a deterministic public evidence anchor; graph edges cite the first qualifying physical xref inside the established source-section subtree projection
- canonical human surface: `/relationships/` with stable `#entity-<stable-id>` and `#mention--<source>--<target>` fragments, plus JSON, Markdown, authority, and versioned schema alternatives
- discovery: canonical entity pages expose the observatory while preserving their existing observed-xref related-record lists and stable identities
- public observatory is static and script-free; mobile/deep-link behavior is covered by Chromium plus representative Firefox/WebKit CI
- deterministic generation/checking is owned by `build/relationship_publication.py`; `tools/build.sh --check` includes all five relationship outputs
- final CI established `135 passed, 1 skipped`, 11 canon locks / 0 violations, 404 public text/machine files boundary-clean, and Chromium/Firefox/WebKit PASS
- diff-scope verification found no dependency, lockfile, media, deletion, rename, canon-prose, chronology, museum-identity, or Phase 6 changes
- live proof established `LIVE_PHASE5_BYTES_OK records=127 edges=136 exact_files=11 evidence=xref-codec--dao semantics=observed-only`
- live public-boundary recheck passed across 10 downloaded text/machine files
- live Chromium proof established `LIVE_PHASE5_BROWSER_OK edge=ok evidence=ok entity-discovery=ok mobile=ok`
- one bounded relationship-evidence repair normalized pre-existing as well as newly generated physical xrefs; later test/release-hygiene corrections did not promote or alter relationship semantics

**Completion verdict: VERIFIED.**

### Phase 6 — Canon Inspector and Authority UI

Expose suitable public machine-enforced locks from `src/canon/invariants.json` with precise authority/status labeling. Never imply the invariant file is the entirety of Starsilk canon.

#### Completion record

- starting `main`: `0013e72cc8d3ca471f5ed2b1a71be96cc988469d`
- work branch: `phase-06-canon-inspector`
- primary implementation commit: `d124b1c3fe8990d0cab2e7308f968ed9027463b6`
- one bounded implementation repair: wording-only authority-note repair; removed Markdown emphasis so the explicit “not the complete Starsilk canon” boundary remains machine-readable without changing lock data or enforcement behavior
- successful required CI: run `32656216440` (`140 passed, 1 skipped`; Chromium, Firefox, and WebKit PASS)
- implementation PR: `#24`
- implementation merge on `main`: `5dafd7c7cba11b728c9548b009847ca96e8e756f`
- execution-only live proof PR: `#25`, closed unmerged
- successful live proof: run `32656422914`, job `97235761397`
- generated public Canon Inspector: `/canon/` with static human HTML, JSON, Markdown, schema, and authority alternatives; all 11 public lock records derive in source order from `src/canon/invariants.json`
- scope/evidence guarantees: 2 document locks retain complete-document positive requirements and global prohibitions; 9 section locks retain their declared stable-section targets; raw regex strings are labeled technical validation patterns rather than canon prose
- authority guarantee: the inspector distinguishes authored canon/content authority, `src/canon/invariants.json` machine-validation authority, and generated public derivative; absence from the register explicitly does not imply non-canon status
- discovery/identity guarantees: `/canon/` is listed in the machine index, `llms.txt`, and sitemap; entity pages link to it; existing section IDs, 136 `mentions` / `observed-xref` edges, museum object identities, canonical media, and authored canon prose remain unchanged
- validation: deterministic six-file Canon Inspector parity; strict validator 11 locks / 0 violations; public boundary 410 files; `git diff --check`; live byte proof across 12 selected files; downloaded live boundary pass across 11 text/machine files; live Chromium deep-link, entity-discovery, and 375px no-overflow proof
- Phase 7 was not started

**Completion verdict: VERIFIED.**

### Phase 7 — Faceted Discovery and AI Context Packets

Preserve existing search/navigation behavior while adding structured result classes, facets, excerpts, keyboard/deep-link support, and compact deterministic source-backed context packets.

#### Completion record

- starting `main`: `34846a32eb3ea68d6f58520cc3d36246f0fdb49b`
- work branch: `phase-07-faceted-discovery`
- final validated implementation head: `c9d7bc811ae4d62fc492aefbe197cf4c785de71f`
- one bounded repair commit: `8136b8288632aa340fdf5f4d301316d9a81b44bb`
- repair reason: Phase 7 legitimately expanded the machine publication schema/URL surface, but two pre-existing Phase 2 tests still asserted the old fixed schema and URL sets; the repair updated only those stale test expectations and did not change discovery behavior, authority semantics, stable identities, canon status, media identity, or relationship meaning
- successful required final CI: run `32658677512` (Chromium, Firefox, and WebKit PASS)
- implementation PR: `#27`
- implementation merge on `main`: `72837ad5595a0380fe45d2aed1ed7cb5521b6432`
- execution-only live proof PR: `#28`, closed unmerged
- successful live proof: run `32658856927`, job `97241822080`
- generated discovery publication: 137 files total under `/discover/` — 10 fixed human/machine/schema/authority assets plus 127 stable-ID context packets
- discovery register: exactly 127 authored top-level stable records in source order; `result_class` remains structural publication metadata, navigation-group facets derive only from authored `src/content/nav.json`, authored archetypes are copied only when present, and published-media facets derive only from manifest association evidence
- excerpts are deterministic whitespace-normalized truncations of authored source text; they are retrieval aids, not summaries, interpretations, or new canon prose
- AI context packets preserve stable identity, source references, visibility, `canon_status`, spoiler publication value, related-media IDs, explicit unknowns, and observed relationship direction; observed relationships remain strictly `kind=mentions` / `evidence_class=observed-xref`
- the existing complete-Compendium `dossierSearch` and navigation behavior remain separate and unchanged; Phase 7 is an additive discovery surface rather than a root-search replacement
- human discovery supports query/facet URL state, stable `#result-<stable-id>` deep links, keyboard navigation, reset behavior, and responsive 375px rendering; the entity index exposes a conservative Discover entry point
- machine discovery adds versioned discovery/context-packet schemas, `/discover/` endpoints, packet URLs, `llms.txt` orientation, and sitemap coverage through the established deterministic machine publisher
- final diff-scope review found no dependency/lockfile changes, canonical-media changes, authored canon-prose changes, stable-ID renames, museum-object identity changes, semantic relationship promotion, or Phase 8 implementation
- live proof established `LIVE_PHASE7_BYTES_OK records=127 packets=127 exact_files=15 relationships=observed-only root-search=unchanged`
- downloaded live proof set passed `tools/check_public_boundary.py` across 13 text/machine files
- live Chromium proof established `LIVE_PHASE7_BROWSER_OK deep-link=ok facets=ok keyboard=ok entity-discovery=ok mobile=ok`
- Phase 8 was not started

**Completion verdict: VERIFIED.**

### Phase 8 — Curated Museum Tours and Local Collections

Build stable-ID-based guided tours plus browser-local bookmarks/recent/history/collections. No account, analytics, telemetry, duplicated canon prose, or private text in public URLs by default.

#### Completion record

- starting `main`: `bbb228e21e06883a09210c0e063272a80596190c`
- work branch: `phase-08-tours-local-collections`
- primary generated implementation commit: `36e119f5f5a1b7915e8c4600f66cb349daafa100`
- final validated implementation head: `d2a772baacf606cb6085a84e8378e69d3c19be99`
- implementation repair passes used: zero
- one-shot implementation/build/focused-proof run: `32659489379` PASS
- successful required final CI: run `32659617585` (Chromium, Firefox, and WebKit PASS)
- implementation PR: `#30`
- implementation merge on `main`: `6520f43574eac8de64d67da77dca19bc99f3eb46`
- execution-only live proof PR: `#31`, closed unmerged
- successful live proof: run `32659776026`, job `97244053606`
- generated public tour surface: six deterministic files under `/tours/` (`index.html`, `tours.css`, `tours.js`, `tours.json`, `schema.json`, `AUTHORITY.md`)
- curated route source: six stable tour IDs in `src/tours/tours.json`; each binds only to an existing authored `src/content/nav.json` navigation group, producing 29 ordered stable-record stops without duplicating canon prose
- tour semantics remain editorial navigation only: route membership/order does not assert chronology, causality, importance, faction membership, kinship, or other semantic relationships
- browser-local library supports bookmarks, recent openings, timestamped local history, per-tour completion progress, and user-named collections via origin-local storage; storage failure falls back to page-session memory
- privacy guarantees: no account/sign-in, analytics, telemetry, beacon, server write, or external runtime request; user-authored collection names/history are not published and local private text is never serialized into public URLs
- local bookmarks, history, collections, and completion marks are user state only and never canon or relationship evidence
- entity and discovery surfaces expose conservative `/tours/` / `#record-<stable-id>` entry points while canonical entity permalinks, legacy anchors, script-free entity-page behavior, root `dossierSearch`, museum identities, relationship evidence, and Canon Inspector semantics remain intact
- machine publication adds the versioned tour-index schema, `/tours/` endpoints, `llms.txt` orientation, sitemap coverage, and `src/tours/tours.json` source declaration through the existing deterministic publisher
- final diff-scope review found no dependency/lockfile changes, canonical-media changes, authored canon-prose changes, stable-ID renames, museum-object identity changes, relationship-semantic promotion, or Phase 9 implementation
- live proof established `LIVE_PHASE8_BYTES_OK tours=6 exact_files=13 local_state=browser-only private_urls=clean root-search=unchanged`
- downloaded live proof set passed `tools/check_public_boundary.py` across 11 text/machine files
- live Chromium proof established `LIVE_PHASE8_BROWSER_OK deep-link=ok bookmark=ok collections=ok progress=ok recent-history=ok entity-discovery=ok mobile=ok network=local-origin-only`
- Phase 9 was not started

**Completion verdict: VERIFIED.**

### Phase 9 — Interactive Chronology, Canon Status, and Spoiler Views

Create a source-backed event model and explorable chronology. Never guess dates. Keep visibility, canon status, and spoiler level separate; preserve status in machine output regardless of human filters.

#### Completion record

- starting `main`: `31de35ab9f4e0b6ad284c2ce11c4b3da24b4e642`
- work branch: `phase-09-interactive-chronology`
- final validated implementation head: `b1de688352db864860e97b2e4103790360065ae5`
- implementation repair passes used: one bounded pre-commit model repair; corrected the top-level source-record key to match the declared schema without changing event facts, temporal values, or public behavior
- successful required final CI: run `32671213475` (Chromium, Firefox, and WebKit PASS)
- implementation PR: `#34`
- implementation merge on `main`: `3ed684897975065d89f5e12c8c15b36f936c0262`
- execution-only live proof PR: `#35`, closed unmerged
- successful live proof: run `32671419187`, job `97272730778`
- source authority: `src/content/sections/chronology.body.html`, existing stable record `chronology`, authored source key `five-phase-canon-chronology`
- event model: 27 direct authored-label events; 5 exact authored markers (`Year 0`, `Year 3`, `Years 7–120`, `Year 121`, `Year 170`), 6 relative markers, 1 authored duration, and 15 events with unknown temporal certainty; all absolute dates remain null
- status model: all 27 events retain independent `visibility=public`, `canon_status=unknown`, and `spoiler_level=unknown`; public source visibility does not assert canon and no event spoiler class was invented
- generated surface: seven deterministic `/chronology/` files (`index.html`, CSS, JS, JSON, Markdown, schema, authority), plus a versioned machine schema, machine index/orientation/sitemap discovery, and conservative entity navigation links
- validation: deterministic `--check`, strict build, public-boundary pass, focused chronology/machine/cross-browser coverage, pinned Chromium full suite, and Firefox/WebKit journeys all passed; root `dossierSearch`, 127 section identities, museum identities, discovery/context packets, tours/local state, and 136 `mentions` / `observed-xref` relationships remain unchanged
- live proof established `LIVE_PHASE9_BYTES_OK events=27 exact_files=13 exact_markers=5 relative=6 duration=1 unknown=15 status=independent root-search=unchanged`
- live browser proof established `LIVE_PHASE9_BROWSER_OK deep-link=ok filter=view-only status=preserved keyboard=ok source-links=ok mobile=ok network=local-origin-only`
- Phase 10 remained planned at the time of this Phase 9 closure

**Completion verdict: VERIFIED.**

### Phase 10 — WorldsVault Cosmic Topology Explorer

Represent supported topology without inventing coordinates or spatial precision. Reuse relationship primitives and provide an accessible non-visual equivalent.

#### Completion record

- starting main: eeb01b3695d5c289786293b8a8204085817120b8
- implementation commit: 9c713c7591fd8fb350faff5605cbdb961e233efa; merged by PR #36 at 9b05fe5873e171b63399558215189436213ae62f
- required CI passed in run 32673667684: Chromium 97278239393, Firefox 97278239466, and WebKit 97278239455
- execution-only proof PR #37 was closed unmerged; repaired proof run 32673946000 passed
- deterministic publication: seven /worldsvault/ files for the human explorer, CSS/JS, JSON, Markdown, schema, and authority boundary
- topology: 11 source-cited nodes and 6 direct authored edges. Existing mother reuses an authored stable ID; all other node/edge IDs are marked deterministic publication derivatives, never new authored permanent identity.
- every node/edge carries direct source, certainty, independent public/unknown/unknown status, unknowns, and separate non-canonical layout group/order. No coordinates, distance, direction, route geometry, complete map, or spatial precision was invented.
- the 127 stable records, 136 observed mentions / observed-xref edges, and 30 WorldsVault template display labels remain distinct from topology identity and relation authority.
- the explorer has node/edge deep links, cited sources, a complete textual equivalent, keyboard selection, mobile/no-overflow behavior, JSON/Markdown/schema/authority alternatives, and same-origin-only client behavior.
- machine orientation, versioned schema, sitemap, public boundary declarations, and entity navigation discover the surface.
- focused coverage passed 26 tests with deterministic build/check, strict validator, public-boundary, and diff checks. Local full-suite visual failures were seven known macOS root-capture baseline mismatches; hosted pinned Chromium passed the full suite.
- live proof established exact bytes for 14 selected merged surfaces, public-boundary safety, deep link, keyboard relation selection, text equivalent, source links, 375px layout, and same-origin networking.
- Phase 11 was not started.

**Completion verdict: VERIFIED.**

### Phase 11 — Installable Offline Museum

Completed at merge `457d5226b03a5ae1a2d58278ed6af850a532c73e`.

- `build/offline_publication.py` deterministically generates six root deployment artifacts from `src/offline/` and `src/templates/`: web manifest, project-scoped service worker, client controller, offline fallback, styling, and icon.
- The precache is deliberately limited to the root reading shell and public JSON metadata (under 2 MB). `docs/assets/media/` is neither precached nor runtime-cached; it remains on demand.
- The manifest starts at `./` and the client registers `service-worker.js` with `scope: './'`, keeping control inside the GitHub Pages project path.
- The root has an accessible live status region and an explicit `Clear offline cache` control. Unsupported registration, partial cache population, and clearing failures preserve ordinary network browsing and report their state.
- Offline navigation returns cached `index.html` at the project root and the purpose-built fallback page for unknown/unavailable routes.
- PR #38 CI run `32675229686` passed the full Chromium suite and Firefox/WebKit representative journeys after one bounded visual-reference update using the pinned runner captures. Merge CI run `32675377118` also passed; GitHub Pages built merged commit `457d522` successfully.
- Live verification established byte parity for `index.html`, `manifest.webmanifest`, `service-worker.js`, `offline-client.js`, `offline.html`, and `offline.css`; a real HTTPS Chromium session verified project scope, shell/metadata-only cache contents, no media cache entries, cached-root offline navigation, and explicit fallback navigation.

**Completion verdict: VERIFIED.**

### Phase 12 — AI Agent Evaluation Harness and Final Integration

Publish agent guidance and reusable source-grounded evaluation fixtures, then verify the finished system across authority, machine endpoints, museum UX, accessibility, privacy, browsers, offline behavior, generated/source parity, and GitHub Pages publication. Fix integration defects only; do not redesign.

## Program completion rule

The program is complete only when all twelve rows above are `COMPLETE` with inspectable completion evidence. A planning document, code presence, PR, commit, push, or running CI job alone is never completion.
