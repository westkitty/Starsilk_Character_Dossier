from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load():
    spec = importlib.util.spec_from_file_location(
        "operational_state_freshness_adversarial",
        ROOT / "tools" / "check_operational_state_freshness.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


freshness = _load()


def test_checker_has_no_write_or_commit_path():
    source = (ROOT / "tools" / "check_operational_state_freshness.py").read_text(encoding="utf-8")
    forbidden = (
        "write_text(",
        "write_bytes(",
        "unlink(",
        "rename(",
        "replace(",
        '"commit"',
        "'commit'",
        '"push"',
        "'push'",
    )
    for token in forbidden:
        assert token not in source


def test_policy_cannot_hide_guardrail_files_behind_broad_exemptions():
    policy = json.loads(
        (ROOT / "src" / "system" / "operational-state-policy.json").read_text(encoding="utf-8")
    )
    for path in freshness.HARD_PROTECTED_PATHS:
        assert freshness.is_state_relevant(path, policy)


def test_real_branch_delta_requires_and_contains_state_closure():
    base = subprocess.run(
        ["git", "merge-base", "HEAD", "origin/main"],
        check=True,
        stdout=subprocess.PIPE,
        text=True,
    ).stdout.strip()
    errors, material = freshness.validate_repository(ROOT, base_ref=base)
    assert material
    assert errors == []
