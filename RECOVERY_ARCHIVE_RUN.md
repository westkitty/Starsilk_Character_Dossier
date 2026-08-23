# Canonical media recovery archive run

Temporary execution marker for the recovery/canonical-media-archive branch.

The associated pull-request workflow reconstructs `media/source/` from pre-optimization commit `97ae39c745933a024791ed75924f2a5d1d7844a5`, verifies every reconstructed source against the current `docs/asset-manifest.json`, builds the guarded recovery ZIP with `tools/media_source_archive.py`, restores it into an isolated temporary directory, verifies the restored bytes again, and uploads the resulting package plus verification reports as a GitHub Actions artifact.

This file and the workflow are not intended to merge into `main`; they exist only to execute the one-time recovery packaging job without changing the production repository.
