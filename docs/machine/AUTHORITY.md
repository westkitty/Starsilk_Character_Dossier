# Starsilk public machine authority

This file is publication metadata, not lore authority. It exists so humans and machine clients can determine what governs the generated public machine and entity-publication layers.

## Authority order

1. `src/content/sections/*.title.html` and `src/content/sections/*.body.html` govern published prose/content.
2. `src/content/sections.json` governs ordered section identity and structural metadata.
3. `src/content/nav.json` governs published navigation grouping.
4. `src/canon/invariants.json` governs machine-enforced canon locks only; it is not the entirety of Starsilk canon.
5. `docs/asset-manifest.json` governs published-media provenance. Canonical original media remains outside Git.
6. `MUSEUM_AI_FOUNDATION.md` governs machine-publication identity, evidence, unknown-state, and public-boundary rules.
7. Everything under `docs/machine/`, `docs/entities/`, plus `docs/llms.txt` and `docs/sitemap.xml`, is generated derivative output and never outranks those sources.

## Identity and public locations

Existing section IDs, their original Compendium anchors, authored source keys, legacy archive asset keys, and manifest media identities are stable. Display labels and URLs are not substitutes for stable IDs.

For authored top-level section records:

- stable identity is the existing section ID;
- the canonical human permalink is `/entities/<stable-id>/`;
- the original `/#<stable-id>` Compendium anchor remains a valid legacy public location and must not be removed merely because a canonical permalink exists;
- per-record machine alternatives are `/machine/entities/<stable-id>.json` and `/machine/entities/<stable-id>.md`.

Individual chronology-event IDs and many WorldsVault record IDs are not yet authored. The publication layer does not manufacture them.

## Status dimensions

Visibility, canon status, and spoiler level are independent.

- Published section records are `visibility: public` because they already exist in the public Compendium.
- Per-section `canon_status` is currently `unknown` unless a future explicit authority authors it.
- Per-section `spoiler_level` is currently `major` as a conservative publication default. That value is a publication policy, not a canon fact.

## Relationship evidence

The current relationship graph and entity-page relationship lists are generated from published cross-reference links. Every generated relationship is:

- kind: `mentions`
- evidence class: `observed-xref`

A mention proves reference only. It does not prove friendship, hostility, kinship, command, causation, authorship, creation, death responsibility, or any other semantic relation.

## Related media

Entity-page related media is derived only from `docs/asset-manifest.json` contexts attached to the same stable section ID. A media association proves published placement/provenance only. Phase 3 does not create museum-object identity or viewer semantics.

## Unknowns

Missing facts remain missing. No generator may plausibly invent an unauthored identifier, date, coordinate, relationship, canon status, or other fact to make a machine or entity page look complete.

## Public boundary

Every generated machine publication is checked by `tools/check_public_boundary.py`. Public machine files must not contain records marked private, credentials, private-key material, local user filesystem locations, file-runtime URLs, or private/localhost runtime endpoints.

Generated entity pages are public projections of content already published in the Compendium. They must be generated from declared public source authority and must not ingest private/local-only browser state.

Browser hiding, Archive mode, search unlock phrases, robots metadata, and orientation files are not privacy controls.

## JSON-LD policy

JSON-LD describes the Compendium and its published section/permalink resources as `CreativeWork` resources and structural membership only. It deliberately does not type fictional subjects as real people or infer semantic relationships that the source model has not authored.
