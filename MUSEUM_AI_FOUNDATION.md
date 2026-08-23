# Starsilk Museum + AI Foundation Contract

This file is the Phase 1 knowledge contract for the Starsilk Compendium. It governs future machine-readable derivatives without replacing any existing lore, canon, media, or publication authority.

## Governing principle

**One authority. Many views.**

Machine-readable output must be generated from existing authoritative sources. Do not create a second manually maintained canon prose database.

## Authority hierarchy

For the repository as currently implemented:

1. `src/content/sections/*.title.html` and `src/content/sections/*.body.html` — authoritative published prose/content.
2. `src/content/sections.json` — authoritative ordered section identity/structural metadata for the published Compendium.
3. `src/content/nav.json` — authoritative published navigation grouping.
4. `src/templates/` — authoritative presentation/runtime templates for the generated site.
5. `src/canon/invariants.json` — authoritative machine-enforced canon locks only; it is not the entirety of Starsilk canon.
6. `docs/asset-manifest.json` — authoritative published-media provenance ledger. Canonical originals remain outside Git under `media/source/`.
7. Generated outputs such as `docs/index.html` and future machine publications are derivatives and never outrank their sources.

When authorities disagree, do not silently reconcile them. Preserve the contradiction as an explicit unknown/blocker until creator authority or a dedicated reconciliation change resolves it.

## Stable identity policy

### Existing identities that are permanent

The following existing identifiers are treated as stable public/project identities and must not be casually renamed:

- every `src/content/sections.json` section `id`;
- matching public section anchors in generated `docs/index.html`;
- xref targets generated as `href="#<section-id>"`;
- `data-source-key` values already present in section metadata, including `five-phase-canon-chronology`;
- legacy archive `data-asset-key` values such as `asset-19` through the current archive range;
- published media derivative/source identities recorded by `docs/asset-manifest.json` (hashes, filenames, provenance fields).

A later permalink/entity-page phase may add canonical URLs, aliases, or redirects, but must preserve these existing public anchors as aliases/backward-compatible entry points.

### Identities not yet authored

Do **not** invent permanent IDs merely for layout convenience. At Phase 1, the following remain explicitly unresolved unless an existing stable source identifier is found:

- individual chronology-event IDs inside the chronology prose;
- individual WorldsVault template/world IDs for records that currently exist only as display labels and media references;
- semantic relationship IDs/types beyond observed xref mention edges;
- museum-object IDs beyond existing stable archive/media identities.

Later phases may establish these identities from explicit source-backed metadata. Until then their identity state is `unknown`.

## Metadata record model

Schema: `src/schema/metadata-record.schema.json`

Every machine metadata record must provide:

- `stable_id` — permanent identity, distinct from display label and URL;
- `object_type` — descriptive type (character, place, event, media-object, concept, section, etc.);
- `display_label`;
- `aliases`;
- `canonical_url`;
- `source_refs` pointing back to authority;
- `visibility`;
- `canon_status`;
- `spoiler_level`;
- `related_media_ids`;
- `evidence` classification;
- `unknowns` as an explicit list.

The schema describes metadata/provenance. It must not become a manually duplicated lore store.

## Publication dimensions are independent

### Visibility

Allowed values:

- `public`
- `private`

Private material must never be emitted into public `docs/` artifacts. Browser hiding, Archive mode, `ajd`, `robots.txt`, or `llms.txt` are not privacy mechanisms.

### Canon status

Allowed values:

- `canon`
- `development`
- `historical`
- `speculative`
- `unknown`

Public material may be development/speculative/historical. It must simply be labeled honestly.

### Spoiler level

Allowed values:

- `none`
- `minor`
- `major`

Spoiler level does not imply canon status or visibility. These three dimensions must remain separate in human and machine outputs.

## Relationship evidence rules

Observed xref edges prove only that one published section mentions/references another.

Current generated relationship evidence class:

- `observed-xref` / relationship kind `mentions`

An observed mention does **not** prove semantic relations such as friend, enemy, parent, subordinate, ally, caused, killed, created, or controls.

A semantic relationship may be published only when an explicit authored semantic authority exists. Such edges must retain both their semantic type and their source/evidence classification. Generated derivatives may never upgrade `mentions` into a stronger relation by inference.

## Unknown handling

Unknown is a first-class state, not an error to be patched with plausible invention.

Examples:

- no authored event ID -> unknown identity;
- no authoritative date -> unknown date;
- no physical coordinate -> unknown coordinate;
- no explicit semantic relationship -> do not infer one from proximity or mention.

Future machine outputs must preserve unknowns instead of silently filling them.

## Public-boundary rule

Any future generated public machine artifact must pass `tools/check_public_boundary.py` before publication. The check is intentionally conservative and rejects obvious private/local-only state such as:

- records whose JSON metadata declares `visibility: private`;
- local filesystem paths (`/Users/...`, `/home/...`, Windows drive paths);
- common credential/token/private-key signatures;
- localhost/private runtime URLs where they appear in public machine data.

The check complements, rather than replaces, human review and existing `build/validate.py` path/network/privacy checks.

## Dependency rule

Phase 1 adds no runtime dependency. Validation uses the Python standard library and the repository's existing pytest toolchain.

## Phase 1 scope boundary

This phase intentionally does **not**:

- redesign the public Compendium UI;
- generate entity pages;
- publish machine endpoints;
- invent event/WorldsVault coordinates or IDs;
- create semantic relationships;
- move the project off GitHub Pages;
- alter canon prose.
