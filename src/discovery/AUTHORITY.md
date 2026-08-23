# Starsilk faceted discovery and AI context packets — authority boundary

`docs/discover/` is generated Phase 7 publication. It is a discovery convenience layer, not canon/content authority, relationship authority, media-provenance authority, or a second editable lore database. The existing complete-Compendium search remains separate and unchanged.

Authority remains upstream:

1. `src/content/sections/*.title.html`, `src/content/sections/*.body.html`, and `src/content/sections.json` own authored section identity and content.
2. `src/content/nav.json` owns authored navigation-group membership.
3. `docs/asset-manifest.json` owns published-media provenance and section-context evidence.
4. Existing rendered xrefs support only `mentions` / `observed-xref` relationship evidence.
5. Existing machine metadata preserves independent visibility, canon-status, spoiler, evidence, and unknown fields.

## Discovery semantics

- `stable_id` is the established top-level section identity. Display labels never replace it.
- `result_class` copies the existing structural `object_type` publication classification. It is not a claim about the fictional subject's ontology.
- `navigation_group` is copied only from `src/content/nav.json`. A null value means no authored navigation-group assignment was found; it does not imply isolation, non-membership, or non-canon status.
- `archetype` is copied only from an authored section `data-archetype` attribute. Missing values remain null.
- Media facets derive only from published manifest association counts. They do not imply story relationships.
- Excerpts are deterministic whitespace-normalized truncations of authored source text. They are not summaries, interpretations, new lore, or replacement source text.
- Search matches, facet inclusion, result ordering, and no-result states are retrieval behavior only. They do not create or negate canon facts.

## AI context-packet semantics

Each `docs/discover/packets/<stable-id>.json` file is a compact deterministic convenience bundle for an existing stable record. A packet may bring together source-backed identifiers, publication metadata, a mechanical excerpt, published-media IDs, and observed xref direction so an AI can orient itself without first fetching every project surface.

Packets never outrank their cited sources. They must preserve:

- `canon_status: unknown` where the current source model does not author a per-section canon status;
- the existing conservative spoiler publication value without treating it as a canon fact;
- observed relationships strictly as `kind=mentions` and `evidence_class=observed-xref`;
- explicit unknown state rather than invented chronology-event IDs, WorldsVault IDs, dates, coordinates, or semantic relations.

If a generated packet conflicts with its cited source authority, the generated packet is wrong and must be regenerated or repaired. Absence from discovery results or packets is never evidence that something is false or non-canon.
