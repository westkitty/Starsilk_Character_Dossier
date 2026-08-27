# Starsilk Source-of-Truth Topology Authority

This subsystem maps **repository authority and derivation topology**. It does not create or replace lore, canon, chronology, relationship, spatial, media-identity, or publication authority.

## Governing rule

`src/system/derivation-map.json` is the machine-readable topology declaration for the major authorities, build entrypoints, generated publication roots, and validation gates in this repository.

The graph records **what governs or feeds what**. The underlying sources keep their own authority scopes. In particular:

- `MUSEUM_AI_FOUNDATION.md` remains the repository-level machine-derivative authority contract;
- authored content remains under `src/content/`;
- machine canon locks remain under `src/canon/invariants.json`;
- published-media provenance remains `docs/asset-manifest.json` with canonical originals outside Git under `media/source/`;
- subsystem `AUTHORITY.md` files and source JSON continue to define their own narrow interpretation boundaries;
- generated `docs/` surfaces never become a second source of truth merely because they appear in this graph.

If the graph conflicts with explicit source behavior or a stronger authority, the conflict is a defect to resolve. The graph must not silently rewrite the stronger authority.

## Graph roles

Each node is classified as `authoritative`, `derived`, `generated`, `mirror`, `evidence`, `cache`, `deprecated`, or `unknown`, and separately typed as source, external source, generator, output, validator, orchestrator, or helper.

Every relationship carries repository evidence. Derivation edges are intentionally conservative: absence of an edge means **not declared**, not permission to infer one.

## Coverage boundary

Version 1 maps:

- major authored/evidentiary source groups;
- every Python generator entrypoint invoked by `tools/build.sh`;
- major generated publication roots;
- the strict validator and public-boundary validator;
- the source-of-truth graph validator itself;
- the CI-enforced Operational State freshness policy and read-only validator.

It does not enumerate every individual dossier fragment, template, media binary, helper function, test, or transitive Python import as a separate node. Those are represented through bounded source groups unless later work demonstrates that finer-grained topology is necessary.

## Deterministic projection

`src/system/DERIVATION_GRAPH.md` is generated from the JSON graph by:

```bash
python3 tools/validate_derivation_map.py --write-projection
```

Do not hand-edit the Markdown projection. Normal validation fails if it differs from the JSON graph.

## Validation contract

`tools/validate_derivation_map.py` fails when it detects any of the following:

- malformed or duplicate nodes/edges;
- unsupported roles, node types, or edge kinds;
- missing required repository paths or missing edge-evidence paths;
- a generated node with no declared generator;
- a generator with no generated output;
- a derivation cycle;
- multiple graph owners for the same declared root;
- a Python build entrypoint invoked by `tools/build.sh` but absent from the graph;
- a graph generator that is no longer invoked by `tools/build.sh`;
- drift between the graph's public-boundary target list and the actual `tools/check_public_boundary.py` invocation;
- a public-boundary target without exactly one generated/evidence owner;
- a stale Markdown/Mermaid projection.

CI exercises this validator through `tests/test_derivation_map.py`.

## Change protocol

When an authority, generator, output root, or validation boundary changes:

1. change the controlling source/implementation;
2. update `src/system/derivation-map.json` in the same work unit;
3. regenerate `src/system/DERIVATION_GRAPH.md`;
4. run the derivation-map tests and the normal repository validation;
5. do not claim downstream propagation merely because the graph was updated.

Use the graph to identify stale-risk surfaces. Actual downstream correction still requires implementation and proof.
