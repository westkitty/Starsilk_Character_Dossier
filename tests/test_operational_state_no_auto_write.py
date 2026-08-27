from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_operational_state_contract_explicitly_forbids_auto_write():
    contract = (ROOT / "src" / "system" / "OPERATIONAL_STATE_FRESHNESS.md").read_text(encoding="utf-8")
    assert "never edits, regenerates, commits" in contract
    assert "read-only" in contract
