from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_operational_state_freshness_cli_structure_check_passes():
    result = subprocess.run(
        ["python3", "tools/check_operational_state_freshness.py"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert "OPERATIONAL_STATE_STRUCTURE_OK" in result.stdout
