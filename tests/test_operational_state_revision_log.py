from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_operational_state_current_revision_has_one_log_entry():
    text = (ROOT / "OPERATIONAL_STATE.md").read_text(encoding="utf-8")
    revision = int(re.search(r"(?m)^revision:\s*(\d+)\s*$", text).group(1))
    entries = re.findall(rf"(?m)^- Revision {revision}:\s+.+$", text)
    assert len(entries) == 1
