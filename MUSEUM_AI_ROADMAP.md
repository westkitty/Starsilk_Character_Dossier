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
| 2 | Machine Publication Layer | NOT STARTED | — | begin only in a fresh chat after verifying Phase 1 on current `main` |
| 3 | Stable Entity Pages and Permalinks | NOT STARTED | — | deferred |
| 4 | Museum Object Model and Media Viewer | NOT STARTED | — | deferred |
| 5 | Relationship Observatory | NOT STARTED | — | deferred |
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

### Phase 3 — Stable Entity Pages and Permalinks

Generate first-class human/shareable entity destinations from existing authority while preserving the complete Compendium, source parity, related media/entities, machine alternatives, and old anchors.

### Phase 4 — Museum Object Model and Media Viewer

Promote existing media identities into provenance-aware museum objects and build an accessible, deep-linkable fullscreen viewer without eager-loading the archive or committing canonical originals. Evaluate static IIIF only if it cleanly fits the static architecture.

### Phase 5 — Relationship Observatory

Expose source-traceable incoming/outgoing observed relationships with deep links and an accessible text representation. Do not promote mentions into semantic facts.

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
