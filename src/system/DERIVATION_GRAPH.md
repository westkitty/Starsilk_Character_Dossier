# Starsilk Source-of-Truth Derivation Graph

> GENERATED from `src/system/derivation-map.json` by `tools/validate_derivation_map.py`.
> Do not hand-edit this projection. It maps authority topology; it is not lore or canon authority.

## Coverage

Major authority/evidence groups, every Python generator in tools/build.sh, generated roots, and validation gates.

## Nodes

| ID | Role | Type | Repository paths | Scope |
| --- | --- | --- | --- | --- |
| `foundation` | authoritative | source | `MUSEUM_AI_FOUNDATION.md` | foundation |
| `content` | authoritative | source | `src/content/**`<br>`src/templates/*` | content |
| `canon` | authoritative | source | `src/canon/AUTHORITY.md`<br>`src/canon/invariants.json` | canon |
| `media` | evidence | source | `docs/asset-manifest.json` | media |
| `schemas` | authoritative | source | `src/schema/*.schema.json` | schemas |
| `subsystems` | authoritative | source | `src/machine/AUTHORITY.md`<br>`src/relationships/AUTHORITY.md`<br>`src/discovery/AUTHORITY.md`<br>`src/tours/**`<br>`src/chronology/**`<br>`src/worldsvault/**`<br>`src/museum/AUTHORITY.md`<br>`src/offline/**`<br>`src/agents/**` | subsystems |
| `topology` | authoritative | source | `src/system/AUTHORITY.md`<br>`src/system/derivation-map.json` | topology |
| `media_originals` | authoritative | external | `media/source/` | media_originals |
| `media_gen` | authoritative | generator | `build/media_pipeline.py` | media_gen |
| `root_gen` | authoritative | generator | `build/generate.py` | root_gen |
| `machine_gen` | authoritative | generator | `build/machine_publication.py` | machine_gen |
| `relationships_gen` | authoritative | generator | `build/relationship_publication.py` | relationships_gen |
| `canon_gen` | authoritative | generator | `build/canon_publication.py` | canon_gen |
| `discovery_gen` | authoritative | generator | `build/discovery_publication.py` | discovery_gen |
| `tours_gen` | authoritative | generator | `build/tour_publication.py` | tours_gen |
| `chronology_gen` | authoritative | generator | `build/chronology_publication.py` | chronology_gen |
| `worldsvault_gen` | authoritative | generator | `build/worldsvault_publication.py` | worldsvault_gen |
| `entities_gen` | authoritative | generator | `build/entity_publication.py` | entities_gen |
| `museum_gen` | authoritative | generator | `build/museum_publication.py` | museum_gen |
| `offline_gen` | authoritative | generator | `build/offline_publication.py` | offline_gen |
| `agents_gen` | authoritative | generator | `build/agent_publication.py` | agents_gen |
| `build` | authoritative | orchestrator | `tools/build.sh` | build |
| `strict` | authoritative | validator | `build/validate.py` | strict |
| `boundary` | authoritative | validator | `tools/check_public_boundary.py` | boundary |
| `graph_validator` | authoritative | validator | `tools/validate_derivation_map.py` | graph_validator |
| `media_out` | generated | output | `docs/assets/media/**` | media_out |
| `root_out` | generated | output | `docs/index.html` | root_out |
| `machine_out` | generated | output | `docs/machine/**`<br>`docs/llms.txt`<br>`docs/sitemap.xml` | machine_out |
| `relationships_out` | generated | output | `docs/relationships/**` | relationships_out |
| `canon_out` | generated | output | `docs/canon/**` | canon_out |
| `discovery_out` | generated | output | `docs/discover/**` | discovery_out |
| `tours_out` | generated | output | `docs/tours/**` | tours_out |
| `chronology_out` | generated | output | `docs/chronology/**` | chronology_out |
| `worldsvault_out` | generated | output | `docs/worldsvault/**` | worldsvault_out |
| `entities_out` | generated | output | `docs/entities/**` | entities_out |
| `museum_out` | generated | output | `docs/objects/**` | museum_out |
| `offline_out` | generated | output | `docs/manifest.webmanifest`<br>`docs/service-worker.js`<br>`docs/offline-client.js`<br>`docs/offline.html`<br>`docs/offline.css`<br>`docs/offline-icon.svg` | offline_out |
| `agents_out` | generated | output | `docs/agents/**` | agents_out |
| `graph_out` | generated | output | `src/system/DERIVATION_GRAPH.md` | graph_out |

## Mermaid

```mermaid
flowchart LR
    foundation["foundation\nauthoritative / source"]
    content["content\nauthoritative / source"]
    canon["canon\nauthoritative / source"]
    media["media\nevidence / source"]
    schemas["schemas\nauthoritative / source"]
    subsystems["subsystems\nauthoritative / source"]
    topology["topology\nauthoritative / source"]
    media_originals["media_originals\nauthoritative / external"]
    media_gen["media_gen\nauthoritative / generator"]
    root_gen["root_gen\nauthoritative / generator"]
    machine_gen["machine_gen\nauthoritative / generator"]
    relationships_gen["relationships_gen\nauthoritative / generator"]
    canon_gen["canon_gen\nauthoritative / generator"]
    discovery_gen["discovery_gen\nauthoritative / generator"]
    tours_gen["tours_gen\nauthoritative / generator"]
    chronology_gen["chronology_gen\nauthoritative / generator"]
    worldsvault_gen["worldsvault_gen\nauthoritative / generator"]
    entities_gen["entities_gen\nauthoritative / generator"]
    museum_gen["museum_gen\nauthoritative / generator"]
    offline_gen["offline_gen\nauthoritative / generator"]
    agents_gen["agents_gen\nauthoritative / generator"]
    build["build\nauthoritative / orchestrator"]
    strict["strict\nauthoritative / validator"]
    boundary["boundary\nauthoritative / validator"]
    graph_validator["graph_validator\nauthoritative / validator"]
    media_out["media_out\ngenerated / output"]
    root_out["root_out\ngenerated / output"]
    machine_out["machine_out\ngenerated / output"]
    relationships_out["relationships_out\ngenerated / output"]
    canon_out["canon_out\ngenerated / output"]
    discovery_out["discovery_out\ngenerated / output"]
    tours_out["tours_out\ngenerated / output"]
    chronology_out["chronology_out\ngenerated / output"]
    worldsvault_out["worldsvault_out\ngenerated / output"]
    entities_out["entities_out\ngenerated / output"]
    museum_out["museum_out\ngenerated / output"]
    offline_out["offline_out\ngenerated / output"]
    agents_out["agents_out\ngenerated / output"]
    graph_out["graph_out\ngenerated / output"]
    foundation -->|governs| topology
    media_originals -->|input_to| media_gen
    media_gen -->|generates| media_out
    media_gen -->|generates| media
    content -->|input_to| root_gen
    canon -->|input_to| root_gen
    media -->|input_to| root_gen
    subsystems -->|input_to| root_gen
    root_gen -->|generates| root_out
    content -->|input_to| machine_gen
    media -->|input_to| machine_gen
    schemas -->|input_to| machine_gen
    subsystems -->|input_to| machine_gen
    root_out -->|input_to| machine_gen
    machine_gen -->|generates| machine_out
    content -->|input_to| relationships_gen
    media -->|input_to| relationships_gen
    subsystems -->|input_to| relationships_gen
    root_out -->|input_to| relationships_gen
    relationships_gen -->|generates| relationships_out
    content -->|input_to| canon_gen
    canon -->|input_to| canon_gen
    schemas -->|input_to| canon_gen
    subsystems -->|input_to| canon_gen
    canon_gen -->|generates| canon_out
    content -->|input_to| discovery_gen
    media -->|input_to| discovery_gen
    schemas -->|input_to| discovery_gen
    subsystems -->|input_to| discovery_gen
    discovery_gen -->|generates| discovery_out
    content -->|input_to| tours_gen
    media -->|input_to| tours_gen
    schemas -->|input_to| tours_gen
    subsystems -->|input_to| tours_gen
    tours_gen -->|generates| tours_out
    schemas -->|input_to| chronology_gen
    subsystems -->|input_to| chronology_gen
    chronology_gen -->|generates| chronology_out
    schemas -->|input_to| worldsvault_gen
    subsystems -->|input_to| worldsvault_gen
    worldsvault_gen -->|generates| worldsvault_out
    content -->|input_to| entities_gen
    media -->|input_to| entities_gen
    entities_gen -->|generates| entities_out
    media -->|input_to| museum_gen
    schemas -->|input_to| museum_gen
    subsystems -->|input_to| museum_gen
    museum_gen -->|generates| museum_out
    content -->|input_to| offline_gen
    media -->|input_to| offline_gen
    subsystems -->|input_to| offline_gen
    root_out -->|input_to| offline_gen
    machine_out -->|input_to| offline_gen
    relationships_out -->|input_to| offline_gen
    canon_out -->|input_to| offline_gen
    discovery_out -->|input_to| offline_gen
    tours_out -->|input_to| offline_gen
    chronology_out -->|input_to| offline_gen
    worldsvault_out -->|input_to| offline_gen
    museum_out -->|input_to| offline_gen
    offline_gen -->|generates| offline_out
    media -->|input_to| agents_gen
    schemas -->|input_to| agents_gen
    subsystems -->|input_to| agents_gen
    machine_out -->|input_to| agents_gen
    relationships_out -->|input_to| agents_gen
    discovery_out -->|input_to| agents_gen
    tours_out -->|input_to| agents_gen
    chronology_out -->|input_to| agents_gen
    worldsvault_out -->|input_to| agents_gen
    museum_out -->|input_to| agents_gen
    offline_out -->|input_to| agents_gen
    agents_gen -->|generates| agents_out
    topology -->|input_to| graph_validator
    build -->|references| graph_validator
    graph_validator -->|generates| graph_out
    root_out -->|validates| strict
    canon -->|input_to| strict
    machine_out -->|validates| boundary
    relationships_out -->|validates| boundary
    canon_out -->|validates| boundary
    discovery_out -->|validates| boundary
    tours_out -->|validates| boundary
    chronology_out -->|validates| boundary
    worldsvault_out -->|validates| boundary
    entities_out -->|validates| boundary
    museum_out -->|validates| boundary
    offline_out -->|validates| boundary
    agents_out -->|validates| boundary
```

## Stale-risk summary

- **content** -> agents_out, canon_out, discovery_out, entities_out, machine_out, offline_out, relationships_out, root_out, tours_out
- **canon** -> agents_out, canon_out, machine_out, offline_out, relationships_out, root_out
- **media** -> agents_out, discovery_out, entities_out, machine_out, museum_out, offline_out, relationships_out, root_out, tours_out
- **schemas** -> agents_out, canon_out, chronology_out, discovery_out, machine_out, museum_out, offline_out, tours_out, worldsvault_out
- **subsystems** -> agents_out, canon_out, chronology_out, discovery_out, machine_out, museum_out, offline_out, relationships_out, root_out, tours_out, worldsvault_out
- **topology** -> graph_out
- **media_originals** -> agents_out, discovery_out, entities_out, machine_out, media_out, museum_out, offline_out, relationships_out, root_out, tours_out

## Integrity rules

- Every graph edge carries repository evidence.
- Every generated node has a declared generator.
- Derivation edges must remain acyclic.
- Every Python entrypoint invoked by `tools/build.sh` must have exactly one graph node.
- Every `tools/check_public_boundary.py` target must have exactly one generated/evidence owner.
- The checked-in Mermaid/table projection must byte-match this JSON graph.
