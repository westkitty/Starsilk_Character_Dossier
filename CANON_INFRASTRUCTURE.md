# Starsilk Canon Infrastructure

This repository now exposes three reusable infrastructure surfaces without changing the existing `src -> build -> docs` publication architecture.

## Canonical media recovery

The committed `docs/asset-manifest.json` remains the provenance ledger for published media. Canonical originals still live outside Git under `media/source/`.

Verify a local canonical source set before trusting, deleting, moving, or regenerating from it:

```bash
python3 tools/media_source_archive.py verify
```

Create a recovery package only after every source file matches its recorded SHA-256 and byte count:

```bash
python3 tools/media_source_archive.py package \
  --out dist/starsilk-canonical-media-recovery.zip
```

The package contains the verified originals, the published provenance manifest, a recovery manifest, and restore instructions. The ZIP itself should be stored on durable storage outside the Git repository. A Git commit cannot substitute for an independently stored copy of `media/source/`.

## Entity relationship graph

The published Compendium already contains deterministic `xref-link` edges. Generate a machine-readable graph from those observed relationships:

```bash
python3 tools/build_relationship_graph.py \
  --out dist/entity-relationships.json
```

The output contains entities, directed `mentions` relationships, outgoing links, and backlinks. It intentionally does not invent relationship types that are not evidenced by the current Compendium.

## Reusable canon validation

Validate partial candidate material against forbidden canon patterns:

```bash
python3 tools/validate_canon.py --file candidate.txt
```

Apply character/section-specific locks:

```bash
python3 tools/validate_canon.py --file dao-scene.txt --section dao
```

For a complete reference entry that must also contain every positive required pattern:

```bash
python3 tools/validate_canon.py --file dao-entry.html --section dao --complete --json
```

Candidate mode is deliberately conservative: it checks forbidden patterns without demanding that an ordinary scene repeat every positive identity fact. `--complete` is the strict completeness mode.

## Authority boundaries

- `src/content/` and `src/templates/` remain authoritative for published prose/site presentation.
- `src/canon/invariants.json` remains authoritative for machine-enforced canon locks.
- `docs/index.html` remains generated output and should not be hand-edited.
- `docs/asset-manifest.json` remains the published-media provenance ledger.
- `media/source/` remains the canonical source-media directory and must be backed up independently.

These tools add reusable interfaces around existing authority; they do not create a competing canon or publication system.
