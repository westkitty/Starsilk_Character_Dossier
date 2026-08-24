# Visual coverage authority

`visual-coverage.json` is an editorial fallback-placement map for the 127 authored top-level Compendium records. It exists only so a record whose authored body has no visible image can still render one source-backed visual on the complete Compendium and its canonical entity permalink.

The map is **not canon authority** and is **not media-provenance authority**. Every referenced `source_filename` must already exist in `docs/asset-manifest.json`; the manifest remains the binary/provenance ledger. The map cannot create identities, relationships, dates, locations, appearances, or museum-object semantics. It introduces no new media binary and never writes back to the source archive.

`role: identity` may be used only when the existing manifest evidence identifies the plate as the record's subject. `role: context` is incident, location, system, historical, or relational imagery. A context plate attached to a character record must explicitly state that it is **not a portrait** so an unknown appearance stays unknown.

`build/generate.py` adds a fallback only when the authored body has no visible image with a real `src`. Existing authored visuals always win. Generation fails if an image-less authored record lacks a valid fallback or if a fallback references media absent from the manifest/published media directory.

The cover is the one media-structure exception: its existing hero `<video>` carries the existing poster frame as native fallback `<img>` content. That satisfies image coverage without adding a second visible cover plate when video playback is available.

The regression contract in `tests/test_visual_coverage.py` requires visible, locally resolvable image coverage for every authored record on both the complete Compendium and `/entities/<stable-id>/` permalinks. Manifest-derived `related_media_ids` remain separate and continue to derive only from manifest section contexts.
