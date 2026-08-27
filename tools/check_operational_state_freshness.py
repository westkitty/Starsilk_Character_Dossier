#!/usr/bin/env python3
"""Fail when state-relevant repository changes outrun OPERATIONAL_STATE.md.

This checker is read-only. It does not decide project meaning or rewrite state.
It enforces only the mechanical closure contract declared in
src/system/operational-state-policy.json.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_POLICY = ROOT / "src" / "system" / "operational-state-policy.json"
REQUIRED_TRACKED_PATTERNS = {
    ".github/workflows/**",
    "build/**",
    "src/**",
    "tools/**",
    "tests/**",
    "requirements.txt",
    "MUSEUM_AI_FOUNDATION.md",
    "MUSEUM_AI_ROADMAP.md",
    "docs/asset-manifest.json",
}
REQUIRED_EXEMPT_PATTERNS = {"OPERATIONAL_STATE.md", "tests/visual_baselines/**", "docs/**"}
REQUIRED_REINCLUDE_PATTERNS = {"docs/asset-manifest.json"}
HARD_PROTECTED_PATHS = {
    ".github/workflows/ci.yml",
    "src/system/operational-state-policy.json",
    "tools/check_operational_state_freshness.py",
}


@dataclass(frozen=True)
class StateInfo:
    project_id: str
    revision: int
    text: str


def _run_git(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(root), *args],
        check=check,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def load_policy(path: Path = DEFAULT_POLICY) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema") != "starsilk-operational-state-policy/1":
        raise ValueError("policy schema must be starsilk-operational-state-policy/1")
    if data.get("project_id") != "starsilk-character-dossier":
        raise ValueError("policy project_id must be starsilk-character-dossier")
    if not isinstance(data.get("state_file"), str) or not data["state_file"]:
        raise ValueError("policy state_file must be a non-empty string")
    for key in ("tracked_patterns", "exempt_patterns", "reinclude_patterns", "required_state_markers"):
        values = data.get(key)
        if not isinstance(values, list) or not all(isinstance(item, str) and item for item in values):
            raise ValueError(f"policy {key} must be a string list")
    missing_tracked = REQUIRED_TRACKED_PATTERNS - set(data["tracked_patterns"])
    missing_exempt = REQUIRED_EXEMPT_PATTERNS - set(data["exempt_patterns"])
    missing_reinclude = REQUIRED_REINCLUDE_PATTERNS - set(data["reinclude_patterns"])
    if missing_tracked:
        raise ValueError("policy is missing protected tracked patterns: " + ", ".join(sorted(missing_tracked)))
    if missing_exempt:
        raise ValueError("policy is missing required anti-churn exemptions: " + ", ".join(sorted(missing_exempt)))
    if missing_reinclude:
        raise ValueError("policy is missing required reinclude patterns: " + ", ".join(sorted(missing_reinclude)))
    return data


def _matches(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(path, pattern) for pattern in patterns)


def is_state_relevant(path: str, policy: dict) -> bool:
    normalized = path.replace("\\", "/").lstrip("./")
    if normalized in HARD_PROTECTED_PATHS:
        return True
    if _matches(normalized, policy["reinclude_patterns"]):
        return True
    if _matches(normalized, policy["exempt_patterns"]):
        return False
    return _matches(normalized, policy["tracked_patterns"])


def parse_state(text: str) -> StateInfo:
    project_match = re.search(r"(?m)^project_id:\s*([a-z0-9_.-]+)\s*$", text)
    revision_match = re.search(r"(?m)^revision:\s*(\d+)\s*$", text)
    if not project_match:
        raise ValueError("OPERATIONAL_STATE.md is missing project_id")
    if not revision_match:
        raise ValueError("OPERATIONAL_STATE.md is missing integer revision")
    return StateInfo(project_id=project_match.group(1), revision=int(revision_match.group(1)), text=text)


def validate_current_state(root: Path, policy: dict) -> tuple[StateInfo | None, list[str]]:
    errors: list[str] = []
    state_path = root / policy["state_file"]
    if not state_path.exists():
        return None, [f"state file is missing: {policy['state_file']}"]
    try:
        state = parse_state(state_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return None, [str(exc)]
    if state.project_id != policy["project_id"]:
        errors.append(
            f"state project_id {state.project_id!r} does not match policy project_id {policy['project_id']!r}"
        )
    for marker in policy["required_state_markers"]:
        if marker not in state.text:
            errors.append(f"state file is missing required freshness marker: {marker}")
    revision_log = re.compile(rf"(?m)^- Revision {state.revision}:\s+.+$")
    if not revision_log.search(state.text):
        errors.append(f"state revision {state.revision} has no matching revision-log entry")
    if is_state_relevant(policy["state_file"], policy):
        errors.append("policy must exempt the state file from state-relevant material classification")
    return state, errors


def changed_paths(root: Path, base_ref: str) -> list[str]:
    result = _run_git(root, "diff", "--name-only", "--diff-filter=ACMRDTUXB", base_ref, "HEAD", "--")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _read_state_at_ref(root: Path, state_file: str, ref: str) -> StateInfo:
    result = _run_git(root, "show", f"{ref}:{state_file}")
    return parse_state(result.stdout)


def _state_changed(root: Path, state_file: str, base_ref: str) -> bool:
    result = _run_git(root, "diff", "--quiet", base_ref, "HEAD", "--", state_file, check=False)
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stderr.strip() or "git diff failed while checking state file")
    return result.returncode == 1


def validate_against_base(root: Path, policy: dict, state: StateInfo, base_ref: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    paths = changed_paths(root, base_ref)
    material = sorted(path for path in paths if is_state_relevant(path, policy))
    if not material:
        return errors, material

    try:
        old_state = _read_state_at_ref(root, policy["state_file"], base_ref)
    except (subprocess.CalledProcessError, ValueError) as exc:
        errors.append(f"cannot read base operational state at {base_ref}: {exc}")
        return errors, material

    try:
        changed = _state_changed(root, policy["state_file"], base_ref)
    except RuntimeError as exc:
        errors.append(str(exc))
        return errors, material

    if not changed:
        errors.append(
            "OPERATIONAL STATE STALE: state-relevant files changed but OPERATIONAL_STATE.md did not change"
        )
    if state.revision <= old_state.revision:
        errors.append(
            "OPERATIONAL STATE STALE: current revision "
            f"{state.revision} must be greater than base revision {old_state.revision} when state-relevant files change"
        )
    return errors, material


def validate_repository(root: Path = ROOT, policy_path: Path | None = None, base_ref: str | None = None) -> tuple[list[str], list[str]]:
    policy_file = policy_path or (root / "src" / "system" / "operational-state-policy.json")
    try:
        policy = load_policy(policy_file)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        return [f"cannot load operational-state policy: {exc}"], []
    state, errors = validate_current_state(root, policy)
    material: list[str] = []
    if state is not None and base_ref:
        try:
            base_errors, material = validate_against_base(root, policy, state, base_ref)
            errors.extend(base_errors)
        except subprocess.CalledProcessError as exc:
            errors.append(exc.stderr.strip() or f"git comparison against {base_ref} failed")
    return errors, material


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-ref", help="Git ref representing the state before the current change")
    parser.add_argument("--policy", type=Path, help="override policy path")
    args = parser.parse_args()

    errors, material = validate_repository(ROOT, args.policy, args.base_ref)
    if material:
        print(f"STATE_RELEVANT_CHANGES count={len(material)}")
        for path in material:
            print(f"  {path}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    if args.base_ref and not material:
        print(f"OPERATIONAL_STATE_FRESHNESS_OK base={args.base_ref} material_changes=0 state_update=not-required")
    elif args.base_ref:
        print(f"OPERATIONAL_STATE_FRESHNESS_OK base={args.base_ref} material_changes={len(material)} state_update=closed")
    else:
        print("OPERATIONAL_STATE_STRUCTURE_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
