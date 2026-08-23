# Starsilk Character Dossier Bible

Append-only project continuity ledger.

## 2026-08-23 — Canon infrastructure expansion

Baseline: `main` at `e35207b5d4714bd53e02b17af7dce00694d81244`.

Purpose preserved: Starsilk Compendium remains a deterministic static publication generated from versioned source, with canon locks and media provenance validated separately from presentation.

Implemented change groups:

1. Canonical-media recoverability tooling
   - Added SHA-256/byte verification against `docs/asset-manifest.json`.
   - Added guarded recovery-ZIP creation for `media/source/`.
   - The tool refuses to package an incomplete or mismatched canonical set.
   - Actual off-repository storage remains an operational step because canonical originals are not present in Git.

2. Entity relationship graph
   - Added a generator that derives entity-to-entity `mentions` edges from the xref links already present in the published Compendium.
   - Output includes entity inventory, directed edges, outgoing relations, and backlinks.
   - No speculative semantic relationship types are inferred.

3. Reusable canon validation
   - Added a CLI around `src/canon/invariants.json` for candidate prose/prompts and complete reference entries.
   - Candidate mode enforces forbidden patterns without requiring every positive identity statement.
   - `--complete` enables positive `must_match` requirements for selected scopes.

Regression coverage: `tests/test_infrastructure_tools.py` exercises relationship generation, forbidden-name validation, section-complete validation, and media verification/package behavior.

Execution limitation: the active shell could not resolve github.com, so a local clone/test run was unavailable. GitHub connector write access was available. Final repository verification therefore belongs to GitHub Actions on the implementation branch/PR; do not upgrade these changes from implemented-unverified to verified until those checks pass.

Do not hand-edit `docs/index.html`. Do not move canon authority out of `src/canon/invariants.json`. Do not claim canonical media is durably backed up merely because provenance metadata or packaging code exists.

## 2026-08-23 — Canon validation scope correction

During pre-merge review, section-complete validation was found to be over-broad: `--complete --section dao` would have required the document-wide positive Blood Eclipse War duration lock inside a Dao-only fragment.

Correction committed as `c53f03d126d4cc8854507536f5772dd19f0940dd`:

- document-wide prohibitions still apply to every candidate;
- positive document locks are required only for full-document completeness;
- positive section locks are required only for explicitly selected sections in section-complete mode.

Pull request: #1 `Add canon infrastructure surfaces`.

Verification state at recording time: implemented-unverified. The GitHub connector exposed no workflow run or commit status for the current PR head, so absence of CI evidence must not be treated as success.
