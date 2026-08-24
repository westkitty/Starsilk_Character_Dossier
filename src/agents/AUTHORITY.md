# Starsilk agent reference contract

This document is agent guidance, not lore authority. It explains how an AI or other machine client should retrieve, cite, and interpret the public Starsilk Compendium without inventing facts or promoting generated derivatives above their sources.

## Retrieval order

Use the smallest source-backed path that answers the question:

1. Start with `/llms.txt` or `/machine/index.json` for orientation and endpoint discovery.
2. Resolve a subject by its stable ID in `/machine/entities.json` or its canonical `/entities/<stable-id>/` page.
3. Prefer `/discover/packets/<stable-id>.json` for compact entity context when it is sufficient.
4. Follow `source_refs`, `excerpt_source_ref`, or specialized evidence links when a claim needs source passage support.
5. Use the specialized registers for their declared domains:
   - `/relationships/relationships.json` for observed cross-reference mentions;
   - `/canon/canon-locks.json` for machine-enforced canon locks only;
   - `/chronology/chronology.json` for source-backed event publication;
   - `/worldsvault/worldsvault.json` for the explicitly published topology relations;
   - `/objects/objects.json` for media provenance;
   - `/tours/tours.json` for editorial navigation only.
6. Use generated Markdown alternatives when text traversal is more useful than JSON, but do not treat Markdown derivatives as more authoritative than their cited source fragments.

Do not scrape the entire site when a deterministic entity packet, index, or specialized register already answers the request.

## Authority and provenance

The controlling source hierarchy is defined by `/machine/AUTHORITY.md` and `MUSEUM_AI_FOUNDATION.md`.

Generated files under `docs/` are public derivatives. They are useful retrieval surfaces, but they do not outrank:

- authored section fragments and their structural records;
- authored navigation where navigation order is the question;
- `src/canon/invariants.json` for machine-enforced locks;
- `docs/asset-manifest.json` for published-media provenance;
- specialized authored Phase 8-10 source records where those publications explicitly cite them.

When answering a factual question, preserve the source reference supplied by the machine record whenever practical. A generated convenience packet is evidence navigation, not a new authority.

## Stable identity

Use stable IDs exactly as published. Do not replace them with display labels, inferred slugs, filenames, or an agent-created identifier.

For top-level authored records:

- canonical human URL: `/entities/<stable-id>/`;
- legacy location: `/#<stable-id>`;
- machine JSON: `/machine/entities/<stable-id>.json`;
- machine Markdown: `/machine/entities/<stable-id>.md`;
- compact context packet: `/discover/packets/<stable-id>.json`.

Publication IDs introduced by chronology or topology derivatives have only the authority explicitly declared by those surfaces. Do not silently upgrade a deterministic publication ID into a creator-authored permanent identity.

## Canon status, spoiler level, and visibility

Treat `visibility`, `canon_status`, and `spoiler_level` as independent fields.

- `canon_status: unknown` means the current structured source does not author a stronger status. It does not mean non-canon.
- A future value such as `development`, `historical`, or `speculative` must remain that value unless a stronger controlling source explicitly supersedes it.
- `spoiler_level: major` on current top-level entity records is a conservative publication default, not a lore fact.
- Event-level spoiler or canon values may be `unknown`; do not substitute the enclosing record's values.
- Public visibility does not imply canon.

Never promote development, historical, speculative, or unknown material to canon merely because it is public, prominent, repeated, or generated into a convenient machine file.

## Unknown handling

Unknown is data.

If the public source does not author a date, coordinate, distance, direction, route, semantic relationship, canon status, spoiler classification, identity, provenance field, or other requested fact, report it as unknown or unsupported by the current source.

Do not fill gaps for narrative neatness, visualization, chronology, or apparent completeness.

## Relationship semantics

Two relationship classes currently require different interpretation:

1. `mentions` + `observed-xref` means one published record links to or references another. It proves reference only.
2. `direct-authored-topology` means the WorldsVault topology publication captured a relation directly stated by a cited source passage. It proves only the named relation and nothing beyond it.

An observed mention does **not** prove friendship, hostility, kinship, command, creation, causality, responsibility, location, chronology, alliance, or any other semantic relation.

A direct topology relation does **not** prove coordinates, distance, direction, route geometry, complete membership, or temporal order unless those facts are independently authored.

## Media provenance

Use `/objects/objects.json` and `docs/asset-manifest.json` for media provenance.

- `object_id` is a deterministic view of the published media filename with only its final extension removed.
- The published filename remains the provenance source key.
- Section context proves published placement, not a semantic lore relationship.
- `logical_identity`, `match_status`, alt text, or provenance that is null/absent remains unknown.

Do not infer a media identity from visual appearance, filename shape, nearby prose, or presentation order.

## Canon locks

The Canon Inspector exposes the machine-enforced validation subset from `src/canon/invariants.json`.

It is not the complete Starsilk canon. Absence from the lock register does not imply that a proposition is non-canon, optional, or false.

## What agents must not infer

Do not:

- invent relationships;
- convert mentions into causality or other semantic relations;
- promote development, historical, speculative, or unknown material to canon;
- guess dates or manufacture chronology for layout convenience;
- invent coordinates, distances, directions, or routes;
- replace stable IDs with generated identities;
- discard source references when the machine record provides them;
- treat a generated derivative as more authoritative than its cited source;
- treat tour order as chronology, importance, or causality;
- treat public visibility as canon status;
- treat local bookmarks, history, progress, or collections as published evidence;
- infer missing media identity or provenance from appearance or filenames.

## Vendor-neutral evaluation

`/agents/evaluation.json` contains reusable reference cases and explicit penalty rules. The fixtures do not require a particular model vendor. A system passes by respecting the evidence and authority boundaries, not by matching a preferred writing style.

`/agents/integration.json` is a deterministic integration certificate generated from the current public derivatives. It proves structural compatibility checks only; it does not replace runtime browser, CI, live Pages, or source-authority evidence.