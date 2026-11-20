# Living Archive Guest-Exhibit Registry — Authority Boundary

This directory curates **external exhibit sources**, not Starsilk lore or canon. `src/experiences/registry.json` is the editable, versioned inventory of the **exact twelve user-selected guest IDs**. It does not grant copyright permissions, declare canonical images, authorize a public runtime launch, or replace another repository's source of truth.

## Source and evidence policy

- Existing `MUSEUM_AI_FOUNDATION.md`, `src/content/sections/`, `src/canon/invariants.json`, and `docs/asset-manifest.json` retain their separate authority.
- The GitHub revision field is a checked source commit, not proof that the same bytes are served by Pages. A successful deployment workflow is not a live-edge/browser parity certificate.
- Private Google Drive folders are held, owner-only, and represented **without folder IDs, file IDs, private URLs, local paths, or copied art**. The authored registry also rejects common private-link, ID, local-path and credential patterns even in free-text notes, because it will itself be visible in a public GitHub repository. Their contents must not enter `docs/` by projection.
- The three dimensions `visibility`, `canon_status`, and `spoiler_level` remain independent. An unknown or proposed exhibit stays unknown or proposed.
- `admission.status=hold` prohibits launching or embedding. Public source **metadata** may be shown for specifically selected, already-public GitHub repositories while their **exhibition admission stays held**. This is not a release approval.
- `show_public_metadata` is independent of admission; it is never sufficient to permit launch.
- All entries are labelled as curatorial/external interpretations. Cross-project links never establish an in-world semantic relationship or canon affiliation.

## Derivation contract

`build/experiences_publication.py` reads the authored registry and `src/schema/guest-exhibit-registry.schema.json`. It produces only `docs/experiences/index.html` and `docs/experiences/experiences.json` through the normal `tools/build.sh` pipeline.

Only selected `visibility=public`, `source.kind=github`, and `admission.show_public_metadata=true` records may appear in public outputs; the generator strips any private-only fields and rejects invalid combinations. All public records must retain their `hold` and unknown-status labels.

No existing Compendium navigation, canon prose, media ledger, offline precache, service worker, or other repository is modified by Phase 1. The isolated page has no scripts, iframes, image assets, launches, autonomous remote requests, or persistence.

## Next-phase release gate

A separate explicit authorization is required before adding root-navigation links, contextual canon-adjacent links, external live launches, embedded runtimes, media or third-party assets, or publishing previously private Drive material. Independently confirm live byte parity, runtime/browser behavior, copyright approval, visual canon where relevant, origin/CSP and storage boundaries, and an explicit per-exhibit admission decision. Revert by disabling the metadata bit or removing the separate generator in a later approved change; the existing canon stays untouched.
