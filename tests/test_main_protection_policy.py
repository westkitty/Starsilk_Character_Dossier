from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "src/system/main-protection-policy.json"
WORKFLOW_PATH = ROOT / ".github/workflows/ci.yml"


def test_main_protection_policy_declares_current_pr_checks() -> None:
    policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert policy["schema"] == "starsilk-main-protection-policy/1"
    assert policy["target"] == {
        "repository": "westkitty/Starsilk_Character_Dossier",
        "branch": "main",
    }
    enforcement = policy["enforcement"]
    assert enforcement["mechanism"] == "branch-protection"
    assert enforcement["required_pull_request"] is True
    assert enforcement["strict_status_checks"] is True
    assert enforcement["enforce_admins"] is True
    assert enforcement["allow_force_pushes"] is False
    assert enforcement["allow_deletions"] is False
    assert len(enforcement["required_status_checks"]) == 3
    assert f"name: {enforcement['required_status_checks'][0]}" in workflow
    assert "name: Representative journeys (Firefox, WebKit)" in workflow
    assert "browser: [firefox, webkit]" in workflow


def test_main_protection_policy_does_not_require_solo_maintainer_review() -> None:
    policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    intentionally_unrequired = set(policy["intentionally_unrequired"])
    assert "required_pull_request_reviews" in intentionally_unrequired
    assert "CODEOWNERS" in intentionally_unrequired
    assert "merge_queue" in intentionally_unrequired
