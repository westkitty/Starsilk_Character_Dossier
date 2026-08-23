# Relationship Observatory authority

The Relationship Observatory is a deterministic public view of cross-reference evidence already present in the generated Starsilk Compendium. It is not a semantic relationship database and it is not canon authority.

## What an edge means

Every published edge has:

- `kind: mentions`
- `evidence_class: observed-xref`

An edge proves only that the rendered subtree of one published Compendium section contains a cross-reference link to another indexed entity. Direction is citation direction: `source -> target` means an xref to the target is observed somewhere inside the source section subtree.

The established v1 graph is intentionally preserved as a **section-subtree projection**. A physical xref inside a nested record can therefore also be observed by one or more ancestor source sections, and several graph edges may cite the same physical rendered xref as their exact evidence. That sharing does not create additional semantic meaning.

Do **not** reinterpret an observed mention as friendship, hostility, family, ownership, authorship, creation, allegiance, causation, chronology, location, membership, or any other stronger semantic relationship.

## Authority chain

1. Authored section content in `src/content/sections/*.body.html` and existing stable section IDs remain source authority.
2. `build/xref.py` deterministically inserts the current generated cross-references and normalizes every published `xref-link`—including xref markup already present in authored fragments—with a stable physical evidence anchor.
3. `docs/index.html` is generated publication evidence and exposes that stable evidence anchor for each physical xref.
4. `tools/build_relationship_graph.py` preserves the existing section-subtree projection of those observed xrefs into the `mentions` graph.
5. `build/relationship_publication.py` renders the human observatory plus JSON and Markdown alternatives from that same observed graph and resolves every graph edge to a qualifying physical xref inside its source subtree.

Generated relationship publication may be discarded and rebuilt. It must never become a second lore source.

## Stable publication identities

- Entity identity remains the existing top-level section stable ID.
- Edge publication identity is deterministic: `mention--<source-id>--<target-id>`.
- A physical rendered xref receives a deterministic evidence ID based on its nearest containing section and target, normally `xref-<physical-source-id>--<target-id>`; a deterministic numeric suffix is used only if more than one physical xref for that same pair exists.
- More than one observatory edge may point to the same physical evidence ID when the established section-subtree graph observes that link through ancestor sections.
- Entity observatory anchor identity is deterministic: `entity-<stable-id>`.

These publication identities identify views/evidence. They do not add semantic facts.

## Evidence and unknowns

Each observatory edge must retain:

- source stable ID;
- target stable ID;
- exact source-section file reference;
- source and target canonical entity URLs;
- canonical observatory deep link;
- exact public Compendium xref-evidence link;
- `mentions / observed-xref` classification.

If stronger relationship meaning is not explicitly authored by a future source of authority, it remains unknown. Phase 5 must not guess it from prose proximity, imagery, filenames, chronology, media context, or common-sense interpretation.

## Public boundary

The observatory is public generated output. It must pass `tools/check_public_boundary.py`, contain no private/local-only material, and remain reproducible from declared repository authority. It must not expose browser-local Archive Tools state or canonical media originals.
