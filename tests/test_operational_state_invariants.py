from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_operational_state_invariant_manifest_is_complete_and_source_backed():
    path = ROOT / "src" / "system" / "operational-state-invariants.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["schema"] == "starsilk-capability-invariants/1"
    assert data["project_id"] == "starsilk-character-dossier"
    assert data["scope"] == "operational-state-freshness"

    invariants = data["invariants"]
    assert [item["id"] for item in invariants] == [
        "OPS-001",
        "OPS-002",
        "OPS-003",
        "OPS-004",
        "OPS-005",
        "OPS-006",
    ]
    for item in invariants:
        assert item["statement"].strip()
        assert item["proof"].strip()
        assert item["evidence"]
        for evidence in item["evidence"]:
            assert (ROOT / evidence).exists(), f"missing invariant evidence: {evidence}"
