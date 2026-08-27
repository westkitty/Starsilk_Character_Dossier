from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_operational_state_policy_shape_is_bounded():
    data = json.loads(
        (ROOT / "src" / "system" / "operational-state-policy.json").read_text(encoding="utf-8")
    )
    assert data["schema"] == "starsilk-operational-state-policy/1"
    assert data["state_file"] == "OPERATIONAL_STATE.md"
    assert "docs/**" in data["exempt_patterns"]
    assert "tests/visual_baselines/**" in data["exempt_patterns"]
    assert data["reinclude_patterns"] == ["docs/asset-manifest.json"]
    assert data["rules"]["checker_is_read_only"] is True
