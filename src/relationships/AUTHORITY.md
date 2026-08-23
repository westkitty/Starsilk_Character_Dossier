# Relationship Observatory authority

The Relationship Observatory is a deterministic public view of cross-reference evidence already present in the generated Starsilk Compendium. It is not a semantic relationship database and it is not canon authority.

## What an edge means

Every published edge has:

- `kind: mentions`
- `evidence_class: observed-xref`

An edge proves only that one published Compendium section contains the generated cross-reference link to another indexed entity. Direction is citation direction: `source -> target` means the source section mentions the target.

Do **not** reinterpret an observed mention as friendship, hostility, family, ownership, authorship, creation, allegiance, causation, chronology, location, membership, or any other stronger semantic relationship.

## Authority chain

1. Authored section content in `src/content/sections/*.body.html` and existing stable section IDs remain source authority.
2. `build/xref.py` deterministically inserts at most one cross-reference for a source/target pair inside a top-level section.
3. `docs/index.html` is generated publication evidence and exposes a stable evidence anchor for each generated xref.
4. `tools/build_relationship_graph.py` projects those observed xrefs into the existing `mentions` graph.
5. `build/relationship_publication.py` renders the human observatory plus JSON and Markdown alternatives from that same observed graph.

Generated relationship publication may be discarded and rebuilt. It must never become a second lore source.

## Stable publication identities

- Entity identity remains the existing top-level section stable ID.
- Edge publication identity is deterministic: `mention--<source-id>--<target-id>`.
- Exact rendered evidence anchor identity is deterministic: `xref-<source-id>--<target-id>`.
- Entity observatory anchor identity is deterministic: `entity-<stable-id>`.

These publication identities identify views/evidence. They do not add semantic facts.

## Evidence and unknowns

Each observatory edge must retain:

- source stable ID;
- target stable ID;
- exact source file reference;
- source and target canonical entity URLs;
- canonical observatory deep link;
- exact public Compendium xref-evidence link;
- `mentions / observed-xref` classification.

If stronger relationship meaning is not explicitly authored by a future source of authority, it remains unknown. Phase 5 must not guess it from prose proximity, imagery, filenames, chronology, media context, or common-sense interpretation.

## Public boundary

The observatory is public generated output. It must pass `tools/check_public_boundary.py`, contain no private/local-only material, and remain reproducible from declared repository authority. It must not expose browser-local Archive Tools state or canonical media originals.
