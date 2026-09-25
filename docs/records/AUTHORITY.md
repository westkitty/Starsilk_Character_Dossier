# Cross-Surface Record Explorer Authority

The Cross-Surface Record Explorer is a deterministic navigation and evidence-aggregation derivative. It creates no lore, canon, relationship, chronology, media-provenance, tour, WorldsVault, or Film Vault authority.

## Authority boundary

Record identity remains the stable top-level section ID already authored in `src/content/sections.json`.

The explorer may reference only evidence already established by the owning subsystem:

- authored record/source identity from `src/content/`;
- published media provenance from `docs/asset-manifest.json` and the existing visual-coverage rules;
- observed relationship edges from the existing `mentions` / `observed-xref` graph;
- authored chronology from `src/chronology/events.json` only where that source explicitly identifies the stable record;
- machine canon locks from `src/canon/invariants.json` only where a section lock explicitly names the stable record;
- discovery/context-packet derivatives generated from existing source authority;
- curated tour membership from `src/tours/tours.json` plus `src/content/nav.json`;
- WorldsVault context only where `src/worldsvault/topology.json` explicitly cites the stable record as source evidence;
- Administration Film Vault context only where `src/films/films.json` explicitly lists the stable record in `source_stable_ids`;
- existing per-record machine JSON/Markdown alternatives.

## Interpretation rules

1. Evidence classes remain distinct. The explorer must never flatten them into one semantic knowledge graph.
2. `observed-xref` proves a published mention only. It never becomes friend, enemy, lover, member, creator, cause, or any other stronger relation by inference.
3. Chronology is authored, not inferred from prose appearances or co-occurrence.
4. WorldsVault and Film Vault context is shown only from explicit source references.
5. Related media remains provenance/context evidence. Context or fallback art never becomes identity or relationship evidence.
6. Machine-lock presence means an explicit validation lock applies to that section; absence is not evidence of non-canon status.
7. Unknown remains unknown. The explorer may omit unsupported categories instead of manufacturing filler.
8. Generated `docs/records/` output is disposable publication and never outranks its sources.
9. Public outputs must pass the existing public-boundary gate.
10. This is ordinary post-program maintenance. It is not Phase 13.
