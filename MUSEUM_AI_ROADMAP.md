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
| 6 | Canon Inspector and Authority UI | NOT STARTED | — | deferred |
| 7 | Faceted Discovery and AI Context Packets | NOT STARTED | — | deferred |
| 8 | Curated Museum Tours and Local Collections | NOT STARTED | — | deferred |
| 9 | Interactive Chronology, Canon Status, and Spoiler Views | NOT STARTED | — | deferred |
| 10 | WorldsVault Cosmic Topology Explorer | NOT STARTED | — | deferred |
| 11 | Installable Offline Museum | NOT STARTED | — | deferred |
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

### Phase 7 — Faceted Discovery and AI Context Packets

Preserve existing search/navigation behavior while adding structured result classes, facets, excerpts, keyboard/deep-link support, and compact deterministic source-backed context packets.

### Phase 8 — Curated Museum Tours and Local Collections

Build stable-ID-based guided tours plus browser-local bookmarks/recent/history/collections. No account, analytics, telemetry, duplicated canon prose, or private text in public URLs by default.

### Phase 9 — Interactive Chronology, Canon Status, and Spoiler Views

Create a source-backed event model and explorable chronology. Never guess dates. Keep visibility, canon status, and spoiler level separate; preserve status in machine output regardless of human filters.

### Phase 10 — WorldsVault Cosmic Topology Explorer

Represent supported topology without inventing coordinates or spatial precision. Reuse relationship primitives and provide an accessible non-visual equivalent.

### Phase 11 — Installable Offline Museum

Add install/offline support with shell/metadata first and media on demand. Do not pre-cache the archive. Keep service-worker scope inside the project and provide explicit cache clearing/failure handling.

### Phase 12 — AI Agent Evaluation Harness and Final Integration

Publish agent guidance and reusable source-grounded evaluation fixtures, then verify the finished system across authority, machine endpoints, museum UX, accessibility, privacy, browsers, offline behavior, generated/source parity, and GitHub Pages publication. Fix integration defects only; do not redesign.

## Program completion rule

The program is complete only when all twelve rows above are `COMPLETE` with inspectable completion evidence. A planning document, code presence, PR, commit, push, or running CI job alone is never completion.
