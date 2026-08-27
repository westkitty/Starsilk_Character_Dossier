from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ENTRYPOINT = r'''# Starsilk Cold-Start Recovery Contract

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
'''

CONTRACT = {
    "schema": "starsilk-cold-start-recovery/1",
    "project_id": "starsilk-character-dossier",
    "entrypoint": "src/system/COLD_START_RECOVERY.md",
    "authority_note": "Repository-resumption evidence contract only. This does not create lore, canon, relationship, chronology, media identity, or publication authority.",
    "zero_memory_rule": "Recover required facts from repository evidence and direct runtime probes only; never fill gaps from prior chat or model memory.",
    "min_operational_state_revision": 24,
    "required_categories": [
        {
            "id": "identity_purpose",
            "evidence": [
                {"path": "README.md", "contains": ["publishes the **Starsilk Compendium**", "Public site:"]},
                {"path": "OPERATIONAL_STATE.md", "contains": ["project_id: starsilk-character-dossier", "project_name: Starsilk Compendium"]},
            ],
        },
        {
            "id": "current_baseline",
            "evidence": [
                {"path": "OPERATIONAL_STATE.md", "contains": ["## Current baseline", "## Active invariants", "## Pending"]},
                {"path": "MUSEUM_AI_ROADMAP.md", "contains": ["`OPERATIONAL_STATE.md` records what is currently real and verified", "reality wins"]},
            ],
        },
        {
            "id": "architecture_authority",
            "evidence": [
                {"path": "README.md", "contains": ["## Architecture", "`docs/index.html` is **generated output**"]},
                {"path": "MUSEUM_AI_FOUNDATION.md", "contains": ["**One authority. Many views.**", "## Authority hierarchy", "Generated outputs"]},
                {"path": "src/system/AUTHORITY.md", "contains": ["repository authority and derivation topology", "generated `docs/` surfaces never become a second source of truth"]},
                {"path": "src/system/derivation-map.json", "contains": ["starsilk-derivation-map/1", "operational_state", "state_freshness"]},
            ],
        },
        {
            "id": "active_user_paths",
            "evidence": [
                {"path": "README.md", "contains": ["Public site:", "## Preview locally"]},
                {"path": "OPERATIONAL_STATE.md", "contains": ["Canonical human record destinations are `/entities/<stable-id>/`", "The museum human surface is `/objects/`"]},
            ],
        },
        {
            "id": "build_test_preview",
            "evidence": [
                {"path": "README.md", "contains": ["./tools/build.sh --check", ".venv/bin/pytest tests/ -q", "python3 -m http.server 4173 --directory docs"]},
                {"path": ".github/workflows/ci.yml", "contains": ["Verify Operational State freshness", "Full pytest + Playwright suite (Chromium)", "Representative journeys (Firefox, WebKit)"]},
            ],
        },
        {
            "id": "environment_publication",
            "evidence": [
                {"path": "README.md", "contains": ["Served via GitHub Pages from `main` / `/docs`."]},
                {"path": "OPERATIONAL_STATE.md", "contains": ["build_type=legacy", "Repository merge state, Pages configuration, Pages build execution, and live-edge content are separate proof states"]},
                {"path": ".github/workflows/pages.yml", "contains": ["name: Publish Compendium to GitHub Pages", "Inspect active Pages source", "build_type"]},
            ],
        },
        {
            "id": "protected_invariants",
            "evidence": [
                {"path": "OPERATIONAL_STATE.md", "contains": ["## Active invariants", "Preserve the deterministic source/build/docs pipeline", "Unknown is a first-class machine state"]},
                {"path": "MUSEUM_AI_FOUNDATION.md", "contains": ["## Stable identity policy", "## Unknown handling", "## Relationship evidence rules"]},
            ],
        },
        {
            "id": "limitations_dependencies",
            "evidence": [
                {"path": "OPERATIONAL_STATE.md", "contains": ["## Known limitations", "## Canonical media recovery state — VERIFIED RESTORABLE AND DURABLY STORED"]},
                {"path": "README.md", "contains": ["### Why `media/source/` isn't committed", "requires `media/source/` locally"]},
                {"path": "RIGHTS.md", "contains": ["Starsilk"]},
            ],
        },
        {
            "id": "pending_work",
            "evidence": [
                {"path": "OPERATIONAL_STATE.md", "contains": ["## Pending"]},
                {"path": "MUSEUM_AI_ROADMAP.md", "contains": ["Phase 12", "COMPLETE", "Never begin the next phase automatically"]},
            ],
        },
        {
            "id": "anti_inference_stop_rules",
            "evidence": [
                {"path": "MUSEUM_AI_FOUNDATION.md", "contains": ["Unknown is a first-class state", "Generated derivatives may never upgrade `mentions` into a stronger relation by inference", "When authorities disagree, do not silently reconcile them"]},
                {"path": "src/system/AUTHORITY.md", "contains": ["absence of an edge means **not declared**, not permission to infer one", "If the graph conflicts with explicit source behavior or a stronger authority, the conflict is a defect to resolve"]},
            ],
        },
    ],
    "required_entrypoint_markers": [
        "zero prior chat/session memory",
        "Do not recover facts from remembered chat",
        "RECOVERABLE",
        "AMBIGUOUS",
        "MISSING",
        "STALE",
        "CONTRADICTORY",
        "python3 tests/test_cold_start_recovery.py",
        "not lore authority",
    ],
    "forbidden_required_evidence_prefixes": ["docs/"],
}

TEST = r'''from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "src/system/cold-start-recovery-contract.json"
ENTRYPOINT_PATH = ROOT / "src/system/COLD_START_RECOVERY.md"


def load_contract() -> dict:
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_cold_start_contract_shape() -> None:
    contract = load_contract()
    assert contract["schema"] == "starsilk-cold-start-recovery/1"
    assert contract["project_id"] == "starsilk-character-dossier"
    categories = contract["required_categories"]
    assert len(categories) == 10
    ids = [item["id"] for item in categories]
    assert len(ids) == len(set(ids))
    assert contract["entrypoint"] == "src/system/COLD_START_RECOVERY.md"


def test_every_required_category_has_live_source_evidence() -> None:
    contract = load_contract()
    forbidden = tuple(contract["forbidden_required_evidence_prefixes"])
    evidence_count = 0
    for category in contract["required_categories"]:
        assert category.get("evidence"), category["id"]
        for evidence in category["evidence"]:
            path = evidence["path"]
            assert not path.startswith(forbidden), f"generated docs cannot be required cold-start authority: {path}"
            source = ROOT / path
            assert source.is_file(), f"missing recovery evidence: {path}"
            body = source.read_text(encoding="utf-8")
            for marker in evidence.get("contains", []):
                assert marker in body, f"{category['id']} lost anchor {marker!r} in {path}"
            evidence_count += 1
    assert evidence_count >= 20


def test_entrypoint_is_zero_memory_and_non_authoritative() -> None:
    contract = load_contract()
    body = ENTRYPOINT_PATH.read_text(encoding="utf-8")
    for marker in contract["required_entrypoint_markers"]:
        assert marker in body
    assert "not canon authority" in body
    assert "not publication authority" in body
    assert not re.search(r"\b[0-9a-f]{40}\b", body), "entrypoint must not snapshot a current Git SHA"


def test_readme_exposes_the_cold_start_entrypoint() -> None:
    body = text("README.md")
    assert "[src/system/COLD_START_RECOVERY.md](src/system/COLD_START_RECOVERY.md)" in body
    assert "without prior chat" in body


def test_operational_state_is_recoverable_and_current_enough() -> None:
    contract = load_contract()
    body = text("OPERATIONAL_STATE.md")
    match = re.search(r"^revision:\s*(\d+)\s*$", body, re.MULTILINE)
    assert match
    assert int(match.group(1)) >= int(contract["min_operational_state_revision"])
    for heading in ("## Current baseline", "## Active invariants", "## Known limitations", "## Pending", "## Revision log"):
        assert heading in body
    policy = re.search(r"^freshness_policy:\s*(\S+)\s*$", body, re.MULTILINE)
    assert policy
    assert (ROOT / policy.group(1)).is_file()


def test_recovery_contract_does_not_become_a_second_state_ledger() -> None:
    contract_text = CONTRACT_PATH.read_text(encoding="utf-8")
    entrypoint = ENTRYPOINT_PATH.read_text(encoding="utf-8")
    assert "current_commit" not in contract_text
    assert "current_branch_sha" not in contract_text
    assert "Do not turn this file into another current-state ledger" in entrypoint
    assert "Current facts belong in their existing authorities" in entrypoint


def test_recovery_path_preserves_unknown_and_authority_boundaries() -> None:
    foundation = text("MUSEUM_AI_FOUNDATION.md")
    system_authority = text("src/system/AUTHORITY.md")
    assert "Unknown is a first-class state" in foundation
    assert "do not silently reconcile them" in foundation
    assert "generated `docs/` surfaces never become a second source of truth" in system_authority


def run_gate() -> tuple[int, int]:
    tests = (
        test_cold_start_contract_shape,
        test_every_required_category_has_live_source_evidence,
        test_entrypoint_is_zero_memory_and_non_authoritative,
        test_readme_exposes_the_cold_start_entrypoint,
        test_operational_state_is_recoverable_and_current_enough,
        test_recovery_contract_does_not_become_a_second_state_ledger,
        test_recovery_path_preserves_unknown_and_authority_boundaries,
    )
    for check in tests:
        check()
    contract = load_contract()
    evidence_count = sum(len(item["evidence"]) for item in contract["required_categories"])
    return len(contract["required_categories"]), evidence_count


if __name__ == "__main__":
    categories, evidence = run_gate()
    print(f"COLD_START_RECOVERY_OK categories={categories} evidence_groups={evidence}")
'''


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.rstrip() + "\n", encoding="utf-8")


def patch_readme() -> None:
    path = ROOT / "README.md"
    body = path.read_text(encoding="utf-8")
    heading = "## Cold start / successor handoff"
    if heading in body:
        return
    marker = "Served via GitHub Pages from `main` / `/docs`.\n\n"
    assert marker in body
    section = (
        "## Cold start / successor handoff\n\n"
        "If you are resuming this repository **without prior chat, session, or operator context**, start with "
        "[src/system/COLD_START_RECOVERY.md](src/system/COLD_START_RECOVERY.md). It defines the repository-only "
        "recovery order and the facts that must be recoverable before mutation. Do not promote generated `docs/` "
        "derivatives into authority or fill unknowns from memory.\n\n"
    )
    path.write_text(body.replace(marker, marker + section, 1), encoding="utf-8")


def patch_operational_state() -> None:
    path = ROOT / "OPERATIONAL_STATE.md"
    body = path.read_text(encoding="utf-8")
    if "revision: 23" in body:
        body = body.replace("revision: 23", "revision: 24", 1)
    assert "revision: 24" in body

    baseline_marker = "- Cold-start recovery protection is defined by `src/system/COLD_START_RECOVERY.md`"
    if baseline_marker not in body:
        lines = body.splitlines()
        insert_at = None
        for index, line in enumerate(lines):
            if line.startswith("- Operational State freshness sentinel PR #54 merged at"):
                insert_at = index + 1
                break
        assert insert_at is not None
        lines.insert(
            insert_at,
            "- Cold-start recovery protection is defined by `src/system/COLD_START_RECOVERY.md` and `src/system/cold-start-recovery-contract.json`, with `tests/test_cold_start_recovery.py` enforcing repository-only recoverability of project purpose, current baseline, authority/architecture, active paths, build/test/preview, environment/publication, protected invariants, known limitations/dependencies, pending work, and anti-inference boundaries. It is repository-resumption guidance only and creates no lore, canon, relationship, chronology, media-identity, or publication authority.",
        )
        body = "\n".join(lines) + "\n"

    limitation = "- The durable cold-start gate proves that required recovery evidence remains present and source-linked in the repository; it does not claim that every external AI model will reason correctly from that evidence or that external services are reachable without fresh probes."
    if limitation not in body:
        marker = "## Known limitations\n\n"
        assert marker in body
        body = body.replace(marker, marker + limitation + "\n", 1)

    revision_line = "- Revision 24: added the zero-memory cold-start recovery entrypoint, ten-category machine evidence contract, README discovery path, and dependency-free regression gate so a successor can reconstruct the project from repository evidence without chat memory; recorded the external-model reasoning limit without creating a second state/canon/publication authority."
    if revision_line not in body:
        assert "## Revision log" in body
        body = body.rstrip() + "\n" + revision_line + "\n"

    path.write_text(body, encoding="utf-8")


def main() -> None:
    write("src/system/COLD_START_RECOVERY.md", ENTRYPOINT)
    write("src/system/cold-start-recovery-contract.json", json.dumps(CONTRACT, indent=2, ensure_ascii=False))
    write("tests/test_cold_start_recovery.py", TEST)
    patch_readme()
    patch_operational_state()
    compile(TEST, "tests/test_cold_start_recovery.py", "exec")
    print("COLD_START_BOOTSTRAP_OK")


if __name__ == "__main__":
    main()
