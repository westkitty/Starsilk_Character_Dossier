# Starsilk Build Provenance

This subsystem records **evidence of build ancestry**. It does not create canon, alter source authority, sign lore, or replace the independently stored and restore-tested canonical-media recovery package.

## Evidence model

`tools/build_provenance.py` consumes the current `src/system/derivation-map.json` plus `src/system/provenance-policy.json` and emits one JSON attestation for one checked-out Git commit.

The attestation records:

- the exact Git commit and tree;
- SHA-256 identity of the derivation map, provenance policy, and provenance tool;
- content-addressed **materials** from source/evidence nodes in the derivation graph;
- content-addressed **tools** from generator/orchestrator/validator/helper nodes;
- content-addressed **subjects** from generated-output nodes;
- the graph's typed lineage edges;
- explicit exclusions and their evidence state;
- workflow/run context and validation claims supplied by the workflow that produced the attestation.

Each file group has a deterministic group digest over sorted `{path, sha256, bytes}` records. Filenames alone are never artifact identity.

## Media boundary

`media/source/` is intentionally absent from CI and remains governed by the separate canonical-media backup/restore proof. It is therefore recorded as `unavailable-by-design`, not silently omitted and not falsely marked verified.

Published media under `docs/assets/media/` uses the SHA-256 and byte counts already recorded in `docs/asset-manifest.json`. The normal strict build validator proves manifest-to-disk parity. Provenance therefore hashes the manifest records instead of re-reading every media binary only to duplicate a check the build already performs.

This optimization does **not** make the media manifest a backup.

## Why attestations are not committed beside the build

An attestation includes the Git commit it describes. Committing that attestation into the same commit would create a recursive identity problem: changing the attestation changes the commit it claims to identify.

Instead, successful `main` CI and Pages workflow runs trigger `.github/workflows/provenance.yml`. That read-only workflow checks out the exact successful source-run commit, generates the attestation, verifies it against the checkout, runs the existing public-boundary scanner over it, and uploads the JSON plus `.sha256` sidecar as a GitHub Actions artifact.

The source workflow itself remains the authority for whether its tests or live-publication proof passed. The provenance artifact records that successful run as evidence; it does not upgrade a failed/skipped check into success.

## Main-only execution boundary

The provenance workflow runs only when the completed source workflow's `head_branch` is `main`. It never executes repository code from an unmerged pull-request head under a `workflow_run` context.

## Create locally

```bash
python3 tools/build_provenance.py \
  --output /tmp/starsilk-build-provenance.json \
  --validation local-build=pass
```

This also writes `/tmp/starsilk-build-provenance.json.sha256`.

## Verify

Verification must occur from the exact checked-out commit described by the attestation:

```bash
python3 tools/build_provenance.py \
  --verify /tmp/starsilk-build-provenance.json
```

Verification recomputes commit/tree identity, policy/tool/graph hashes, grouped material/tool/subject digests, exclusions, and lineage edges. If a covered file changed, verification fails.

## Scope limits

This is deliberately **not**:

- a claim of SLSA compliance;
- a cryptographic signature or identity assertion;
- a replacement for GitHub's own commit/workflow evidence;
- a canonical-media backup or restore test;
- a new canon, relationship, chronology, topology, or media-identity authority;
- proof that a live Pages edge matches the repository unless the cited successful Pages workflow established that separately.
