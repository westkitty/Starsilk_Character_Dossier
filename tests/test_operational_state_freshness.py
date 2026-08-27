from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


freshness = _load_module(
    "operational_state_freshness",
    ROOT / "tools" / "check_operational_state_freshness.py",
)


def _git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def _write_state(root: Path, revision: int) -> None:
    (root / "OPERATIONAL_STATE.md").write_text(
        "\n".join(
            [
                "# OPERATIONAL_STATE",
                "",
                "project_id: starsilk-character-dossier",
                "project_name: Starsilk Compendium",
                f"revision: {revision}",
                "freshness_policy: src/system/operational-state-policy.json",
                "",
                "## Revision log",
                "",
                f"- Revision {revision}: fixture state closure.",
                "",
            ]
        ),
        encoding="utf-8",
    )


def _fixture_repo(tmp_path: Path) -> tuple[Path, str]:
    root = tmp_path / "repo"
    for directory in (
        ".github/workflows",
        "build",
        "src/system",
        "src/content",
        "tools",
        "tests/visual_baselines",
        "docs",
    ):
        (root / directory).mkdir(parents=True, exist_ok=True)

    policy = {
        "schema": "starsilk-operational-state-policy/1",
        "project_id": "starsilk-character-dossier",
        "state_file": "OPERATIONAL_STATE.md",
        "tracked_patterns": [
            ".github/workflows/**",
            "build/**",
            "src/**",
            "tools/**",
            "tests/**",
            "requirements.txt",
            "MUSEUM_AI_FOUNDATION.md",
            "MUSEUM_AI_ROADMAP.md",
            "docs/asset-manifest.json",
        ],
        "exempt_patterns": [
            "OPERATIONAL_STATE.md",
            "tests/visual_baselines/**",
            "docs/**",
        ],
        "reinclude_patterns": ["docs/asset-manifest.json"],
        "required_state_markers": [
            "freshness_policy: src/system/operational-state-policy.json"
        ],
    }
    (root / "src/system/operational-state-policy.json").write_text(
        json.dumps(policy), encoding="utf-8"
    )
    (root / "src/content/record.txt").write_text("baseline\n", encoding="utf-8")
    (root / "docs/index.html").write_text("baseline\n", encoding="utf-8")
    (root / ".github/workflows/ci.yml").write_text("name: CI\n", encoding="utf-8")
    (root / "tools/check_operational_state_freshness.py").write_text(
        "# fixture sentinel\n", encoding="utf-8"
    )
    _write_state(root, 1)

    _git(root, "init", "-q")
    _git(root, "config", "user.email", "fixture@example.com")
    _git(root, "config", "user.name", "fixture")
    _git(root, "add", ".")
    _git(root, "commit", "-qm", "baseline")
    return root, _git(root, "rev-parse", "HEAD")


def test_material_change_without_state_closure_fails(tmp_path: Path):
    root, base = _fixture_repo(tmp_path)
    (root / "src/content/record.txt").write_text("changed\n", encoding="utf-8")
    _git(root, "add", ".")
    _git(root, "commit", "-qm", "material change")

    errors, material = freshness.validate_repository(root, base_ref=base)

    assert material == ["src/content/record.txt"]
    assert any("OPERATIONAL STATE STALE" in error for error in errors)


def test_material_change_with_revision_closure_passes(tmp_path: Path):
    root, base = _fixture_repo(tmp_path)
    (root / "src/content/record.txt").write_text("changed\n", encoding="utf-8")
    _write_state(root, 2)
    _git(root, "add", ".")
    _git(root, "commit", "-qm", "material change with state")

    errors, material = freshness.validate_repository(root, base_ref=base)

    assert material == ["src/content/record.txt"]
    assert errors == []


def test_generated_docs_and_visual_baselines_do_not_force_state_churn(tmp_path: Path):
    root, base = _fixture_repo(tmp_path)
    (root / "docs/index.html").write_text("regenerated\n", encoding="utf-8")
    (root / "tests/visual_baselines/root.png").write_bytes(b"visual")
    _git(root, "add", ".")
    _git(root, "commit", "-qm", "generated-only change")

    errors, material = freshness.validate_repository(root, base_ref=base)

    assert errors == []
    assert material == []


def test_asset_manifest_is_reincluded_as_state_relevant(tmp_path: Path):
    root, base = _fixture_repo(tmp_path)
    (root / "docs/asset-manifest.json").write_text("{}\n", encoding="utf-8")
    _git(root, "add", ".")
    _git(root, "commit", "-qm", "manifest change")

    errors, material = freshness.validate_repository(root, base_ref=base)

    assert material == ["docs/asset-manifest.json"]
    assert any("OPERATIONAL STATE STALE" in error for error in errors)


def test_policy_cannot_self_exempt_core_guardrails(tmp_path: Path):
    root, _ = _fixture_repo(tmp_path)
    policy_path = root / "src/system/operational-state-policy.json"
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    policy["tracked_patterns"].remove("src/**")
    policy_path.write_text(json.dumps(policy), encoding="utf-8")

    with pytest.raises(ValueError, match="missing protected tracked patterns"):
        freshness.load_policy(policy_path)


def test_current_repository_contract_and_ci_wiring_are_present():
    errors, material = freshness.validate_repository(ROOT)
    assert errors == []
    assert material == []

    policy = freshness.load_policy(ROOT / "src/system/operational-state-policy.json")
    assert freshness.is_state_relevant("src/content/sections.json", policy)
    assert freshness.is_state_relevant("build/generate.py", policy)
    assert freshness.is_state_relevant("tools/build.sh", policy)
    assert freshness.is_state_relevant("tests/test_museum_foundation.py", policy)
    assert freshness.is_state_relevant("docs/asset-manifest.json", policy)
    assert not freshness.is_state_relevant("docs/index.html", policy)
    assert not freshness.is_state_relevant("tests/visual_baselines/root-1280.png", policy)
    assert not freshness.is_state_relevant("OPERATIONAL_STATE.md", policy)

    workflow = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "check_operational_state_freshness.py" in workflow
    assert "STATE_BASE_REF" in workflow
    assert "git fetch --no-tags --depth=1 origin" in workflow
