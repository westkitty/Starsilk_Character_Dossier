# Operational State Freshness Contract

This subsystem prevents `OPERATIONAL_STATE.md` from silently falling behind material repository changes. It is **project-state governance only**. It does not create or replace lore, canon, chronology, relationship, spatial, media-identity, publication, or backup authority.

## Governing surfaces

- `OPERATIONAL_STATE.md` remains the human project-state ledger.
- `src/system/operational-state-policy.json` declares which repository paths are operationally state-relevant and which high-churn generated surfaces are exempt.
- `tools/check_operational_state_freshness.py` is the read-only mechanical gate.
- `.github/workflows/ci.yml` supplies the pre-change Git ref and runs the gate.

## Closure rule

For each pull request or push to `main`, CI compares the current tree with the exact pre-change Git ref.

If one or more **state-relevant** paths changed, the same change set must also:

1. change `OPERATIONAL_STATE.md`; and
2. increase its integer `revision:` value above the base revision; and
3. contain a revision-log entry matching the new revision.

The checker reports the state-relevant changed paths before failing. It never edits, regenerates, commits, or semantically interprets the state ledger.

## State-relevant scope

The policy deliberately covers project authority, source, generators, validation, workflows, tests, dependencies, operational documentation, and published-media provenance evidence. Changes to the freshness policy, checker, or CI gate are hard-protected against self-exemption.

This is a **closure trigger**, not a demand to duplicate implementation details in the state ledger. The state update should remain bounded to facts that future work needs in order to route, preserve, or validate the project correctly.

## Anti-churn boundary

Generated publication output under `docs/` is normally exempt because deterministic build parity, public-boundary validation, Pages proof, and other existing gates already govern those bytes. `docs/asset-manifest.json` is explicitly re-included because it is the published-media provenance ledger rather than ordinary generated presentation output.

`tests/visual_baselines/` is exempt because intentional visual-reference refreshes are already governed by the pinned Playwright visual-regression workflow. The source or behavior change that justified such a refresh remains state-relevant through its own source path.

`OPERATIONAL_STATE.md` itself is excluded from material classification so a state-only correction does not recursively require another state revision.

## Evidence boundary

A passing freshness check proves only that:

- the current state file has the correct project identity and required freshness marker;
- its declared revision has a matching revision-log entry; and
- a state-relevant repository delta was accompanied by a state-file change and revision advance.

It does **not** prove that every sentence in the state file is semantically complete or correct. Human/project review still owns that judgment. Existing tests, build parity, provenance, Pages proof, backup verification, and runtime evidence retain their separate proof scopes.

## No self-referential commit lock

The contract deliberately does not embed the current Git commit SHA into `OPERATIONAL_STATE.md`. Such a marker would become stale the instant the state file itself was committed. Freshness is instead evaluated against the exact pre-change Git ref supplied by CI, which avoids a self-referential commit cycle.

## Failure message

A material change without closure fails with `OPERATIONAL STATE STALE` and lists the paths that caused the requirement. The repair is to reconcile the ledger against the actual change and increment the revision—not to weaken the tracked-path policy or add a blanket exemption.
