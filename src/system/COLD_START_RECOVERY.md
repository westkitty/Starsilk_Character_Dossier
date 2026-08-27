# Starsilk Cold-Start Recovery Contract

This file is the repository-resumption entrypoint for a future maintainer, coding agent, or AI that has **zero prior chat/session memory** of this project.

It is operational guidance only. It is **not lore authority**, not canon authority, not publication authority, and not a replacement for `OPERATIONAL_STATE.md`, `MUSEUM_AI_FOUNDATION.md`, or any subsystem authority file.

## Zero-memory rule

Assume the conversation that created this repository is gone.

Use only evidence available in the checked-out repository and directly observed execution/runtime state. Do not recover facts from remembered chat, model memory, operator biography, or plausible inference.

If the repository does not support a required fact, classify it as `AMBIGUOUS`, `MISSING`, `STALE`, or `CONTRADICTORY`. Do not fill the gap from memory.

## Start here, in this order

1. `README.md` — project purpose, public product name, source/build architecture, local build/test/preview commands, and public site entry point.
2. `OPERATIONAL_STATE.md` — current baseline, active invariants, verified capabilities, known limitations, pending work, publication/recovery state, and revision history.
3. `MUSEUM_AI_FOUNDATION.md` — repository-level authority hierarchy, stable identity policy, unknown handling, relationship-evidence limits, and public-boundary rules.
4. `MUSEUM_AI_ROADMAP.md` — completed program history and planned-vs-real precedence. It never outranks observed reality or `OPERATIONAL_STATE.md`.
5. `src/system/AUTHORITY.md` plus `src/system/derivation-map.json` — repository authority/derivation topology and validation ownership.
6. `src/system/operational-state-policy.json` — which project changes require Operational State closure.
7. `.github/workflows/ci.yml` and `.github/workflows/pages.yml` — current CI and publication behavior. Read the actual workflows rather than assuming a remembered deployment mode.
8. `RIGHTS.md` — reuse/legal boundary.
9. The relevant subsystem `AUTHORITY.md` and source records for whatever you intend to change.
10. Only after the above are reconciled: mutate the repository.

Generated `docs/` files are useful evidence and deployable derivatives, but they do not become controlling source merely because they are convenient to read. The exception is a file whose declared authority is itself evidentiary, such as the published-media provenance ledger `docs/asset-manifest.json`.

## Required recovery matrix

Before consequential work, a cold starter must be able to recover all ten categories below from repository evidence:

| Category | What must be recoverable |
| --- | --- |
| Project identity and purpose | What repository this is, the public product name, what it publishes, and the public entry point. |
| Current baseline | Which Operational State revision controls, what is currently verified, and which state source outranks historical planning. |
| Architecture and authority | What sources govern content/canon/media/system topology, what is generated, and what must never become a second canon source. |
| Active user/public paths | The public Compendium entry point, canonical entity path, legacy anchor compatibility, museum/object path, and local preview path. |
| Build, test, and preview | Exact repository commands for deterministic build/check, validation/test execution, and local serving. |
| Environment and publication | Current Pages source model, CI baseline, and the rule that merge, build, deployment, and live-edge proof are separate states. |
| Protected invariants | The active project invariants and stable identity/unknown/evidence rules that changes must preserve. |
| Known limitations and external dependencies | Current limitations, intentionally external state such as canonical media originals/recovery material, and what cannot be inferred from file presence. |
| Pending work | The current `## Pending` state, including an explicit `None` when there is no authorized next phase. |
| Anti-inference and stop rules | What must remain unknown, when contradictions block implementation, and which generated/evidentiary surfaces may not be promoted into authority. |

The machine-readable evidence contract is `src/system/cold-start-recovery-contract.json`.

## Evidence states

Use exactly these recovery states when auditing a cold start:

- `RECOVERABLE` — repository evidence directly supports the required fact.
- `AMBIGUOUS` — multiple supported readings remain and the difference matters.
- `MISSING` — required evidence is absent.
- `STALE` — evidence exists but no longer matches observed repository/runtime reality.
- `CONTRADICTORY` — controlling sources disagree.

A cold start is implementation-safe only when every required category is `RECOVERABLE` or an explicitly documented limitation does not block the intended task.

## Before mutation

1. Verify repository identity, current branch/ref, and clean intended base.
2. Read the current Operational State revision; never copy a revision or commit from this file as a shortcut.
3. Run the dependency-free cold-start gate:

```bash
python3 tests/test_cold_start_recovery.py
```

The normal pytest suite also executes the same assertions.
4. Read the authority file for the subsystem you will change.
5. Recheck the affected protected invariants.
6. If public `docs/` source changes, preserve the repository's separate publication/live-proof rules.
7. If authority is contradictory or a required fact is missing, stop mutation and surface the conflict instead of guessing.

## What the durable gate proves

`tests/test_cold_start_recovery.py` proves that the repository still exposes the evidence paths and anchor facts needed to reconstruct the ten categories above, that the entrypoint remains zero-memory and non-authoritative, and that the recovery path does not silently depend on generated `docs/` convenience surfaces.

It does **not** prove that every external AI model will reason correctly, that inaccessible credentials/services are available, or that a runtime claim is current without a fresh runtime probe. Those remain separate evidence questions.

## Maintenance rule

Do not turn this file into another current-state ledger. Current facts belong in their existing authorities. This entrypoint should remain a short, stable map to those authorities; the regression contract should fail when those pointers or required anchor facts drift.
