from __future__ import annotations

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
