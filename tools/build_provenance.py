#!/usr/bin/env python3
"""Create and verify Starsilk build-provenance attestations.

This tool records build ancestry and integrity evidence. It does not create
canon, replace source authority, or prove canonical-media backup/restorability.
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parent.parent
GRAPH_FILE = ROOT / "src" / "system" / "derivation-map.json"
POLICY_FILE = ROOT / "src" / "system" / "provenance-policy.json"
TOOL_PATH = ROOT / "tools" / "build_provenance.py"
SCHEMA = "starsilk-build-provenance/1"
POLICY_SCHEMA = "starsilk-provenance-policy/1"
PROJECT_ID = "starsilk-character-dossier"
VALIDATION_STATES = {"pass", "skipped", "unknown"}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def relative(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def expand_files(root: Path, patterns: Iterable[str]) -> list[Path]:
    found: dict[str, Path] = {}
    for pattern in patterns:
        for raw in glob.glob(str(root / pattern), recursive=True):
            path = Path(raw)
            if path.is_file():
                found[relative(root, path)] = path
    return [found[key] for key in sorted(found)]


def file_record(root: Path, path: Path) -> dict:
    return {
        "path": relative(root, path),
        "sha256": sha256_file(path),
        "bytes": path.stat().st_size,
    }


def group_from_records(node: dict, records: list[dict], *, digest_basis: str = "file-bytes", note: str | None = None) -> dict:
    records = sorted(records, key=lambda item: item["path"])
    result = {
        "node_id": node["id"],
        "role": node["role"],
        "node_type": node["node_type"],
        "digest_basis": digest_basis,
        "file_count": len(records),
        "total_bytes": sum(int(item["bytes"]) for item in records),
        "group_sha256": sha256_bytes(json_bytes(records)),
        "files": records,
    }
    if note:
        result["note"] = note
    return result


def manifest_backed_media_group(root: Path, node: dict, override: dict) -> dict:
    manifest_path = root / override["manifest"]
    manifest = load_json(manifest_path)
    assets = manifest.get("assets")
    if not isinstance(assets, list):
        raise ValueError(f"{override['manifest']} has no assets list")
    prefix = override.get("path_prefix", "docs/assets/media").rstrip("/")
    records: list[dict] = []
    for index, asset in enumerate(assets):
        filename = asset.get("filename")
        sha256 = asset.get("sha256")
        size = asset.get("bytes")
        if not isinstance(filename, str) or not filename:
            raise ValueError(f"manifest asset #{index} has no filename")
        if not isinstance(sha256, str) or len(sha256) != 64:
            raise ValueError(f"manifest asset {filename} has invalid sha256")
        if not isinstance(size, int) or size < 0:
            raise ValueError(f"manifest asset {filename} has invalid bytes")
        records.append({"path": f"{prefix}/{filename}", "sha256": sha256, "bytes": size})
    return group_from_records(
        node,
        records,
        digest_basis="manifest-records",
        note=(
            "Binary digests come from docs/asset-manifest.json. The normal strict build validation "
            "proves manifest-to-disk parity; this avoids re-reading every media binary solely for attestation."
        ),
    )


def validate_policy(graph: dict, policy: dict) -> list[str]:
    errors: list[str] = []
    if policy.get("schema") != POLICY_SCHEMA:
        errors.append(f"policy schema must be {POLICY_SCHEMA}")
    if policy.get("project_id") != PROJECT_ID:
        errors.append(f"policy project_id must be {PROJECT_ID}")
    node_ids = {node.get("id") for node in graph.get("nodes", [])}
    excluded = policy.get("excluded_nodes", {})
    overrides = policy.get("digest_overrides", {})
    if not isinstance(excluded, dict):
        errors.append("excluded_nodes must be an object")
        excluded = {}
    if not isinstance(overrides, dict):
        errors.append("digest_overrides must be an object")
        overrides = {}
    for node_id, reason in excluded.items():
        if node_id not in node_ids:
            errors.append(f"excluded node is absent from derivation map: {node_id}")
        if not isinstance(reason, str) or not reason.strip():
            errors.append(f"excluded node {node_id} needs a reason")
    for node_id, override in overrides.items():
        if node_id not in node_ids:
            errors.append(f"digest override node is absent from derivation map: {node_id}")
            continue
        if not isinstance(override, dict):
            errors.append(f"digest override for {node_id} must be an object")
            continue
        if override.get("mode") != "manifest-records":
            errors.append(f"unsupported digest override mode for {node_id}: {override.get('mode')!r}")
        if not isinstance(override.get("manifest"), str) or not override["manifest"]:
            errors.append(f"digest override for {node_id} needs manifest")
    return errors


def git_value(root: Path, *args: str) -> str:
    result = subprocess.run(["git", "-C", str(root), *args], check=True, capture_output=True, text=True)
    return result.stdout.strip()


def workflow_context() -> dict:
    keys = {
        "repository": "GITHUB_REPOSITORY",
        "workflow": "GITHUB_WORKFLOW",
        "run_id": "GITHUB_RUN_ID",
        "run_attempt": "GITHUB_RUN_ATTEMPT",
        "event_name": "GITHUB_EVENT_NAME",
        "ref": "GITHUB_REF",
        "github_sha": "GITHUB_SHA",
        "runner_os": "RUNNER_OS",
    }
    return {name: os.environ.get(env_name) for name, env_name in keys.items() if os.environ.get(env_name)}


def classify(node: dict) -> str | None:
    node_type = node.get("node_type")
    if node_type in {"source", "external"}:
        return "materials"
    if node_type in {"generator", "orchestrator", "validator", "helper"}:
        return "tools"
    if node_type == "output":
        return "subjects"
    return None


def collect_groups(root: Path, graph: dict, policy: dict) -> tuple[dict[str, list[dict]], list[dict]]:
    buckets: dict[str, list[dict]] = {"materials": [], "tools": [], "subjects": []}
    exclusions: list[dict] = []
    excluded = policy.get("excluded_nodes", {})
    overrides = policy.get("digest_overrides", {})
    for node in graph["nodes"]:
        node_id = node["id"]
        bucket = classify(node)
        if bucket is None:
            continue
        if node_id in excluded:
            exclusions.append({"node_id": node_id, "reason": excluded[node_id], "evidence_state": "unavailable-by-design"})
            continue
        if node_id in overrides:
            group = manifest_backed_media_group(root, node, overrides[node_id])
        else:
            paths = expand_files(root, node.get("paths", []))
            if not paths and node.get("required_present", True):
                raise ValueError(f"provenance node has no matched files: {node_id}")
            group = group_from_records(node, [file_record(root, path) for path in paths])
        buckets[bucket].append(group)
    for values in buckets.values():
        values.sort(key=lambda item: item["node_id"])
    exclusions.sort(key=lambda item: item["node_id"])
    return buckets, exclusions


def parse_pairs(values: list[str], *, allowed_states: bool = False) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw in values:
        if "=" not in raw:
            raise ValueError(f"expected KEY=VALUE, got {raw!r}")
        key, value = raw.split("=", 1)
        if not key or not value:
            raise ValueError(f"expected non-empty KEY=VALUE, got {raw!r}")
        if key in result:
            raise ValueError(f"duplicate key: {key}")
        if allowed_states and value not in VALIDATION_STATES:
            raise ValueError(f"validation {key} has unsupported state {value!r}")
        result[key] = value
    return dict(sorted(result.items()))


def build_attestation(
    root: Path = ROOT,
    *,
    validations: dict[str, str] | None = None,
    claims: dict[str, str] | None = None,
    generated_at: str | None = None,
    commit: str | None = None,
    tree: str | None = None,
) -> dict:
    graph_path = root / "src" / "system" / "derivation-map.json"
    policy_path = root / "src" / "system" / "provenance-policy.json"
    tool_path = root / "tools" / "build_provenance.py"
    graph = load_json(graph_path)
    policy = load_json(policy_path)
    if graph.get("schema") != "starsilk-derivation-map/1" or graph.get("project_id") != PROJECT_ID:
        raise ValueError("unsupported derivation map")
    errors = validate_policy(graph, policy)
    if errors:
        raise ValueError("; ".join(errors))
    buckets, exclusions = collect_groups(root, graph, policy)
    commit = commit or git_value(root, "rev-parse", "HEAD")
    tree = tree or git_value(root, "rev-parse", "HEAD^{tree}")
    generated_at = generated_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    lineage_edges = [
        {"id": edge["id"], "from": edge["from"], "to": edge["to"], "kind": edge["kind"]}
        for edge in graph["edges"]
    ]
    lineage_edges.sort(key=lambda item: item["id"])
    return {
        "schema": SCHEMA,
        "project_id": PROJECT_ID,
        "authority_note": (
            "Build-lineage evidence only. This attestation does not create canon, supersede source authority, "
            "or substitute for the independently stored and restore-tested canonical-media backup."
        ),
        "generated_at": generated_at,
        "subject_commit": {"git_commit": commit, "git_tree": tree},
        "workflow": workflow_context(),
        "policy": {"path": relative(root, policy_path), "sha256": sha256_file(policy_path)},
        "derivation_map": {"path": relative(root, graph_path), "sha256": sha256_file(graph_path)},
        "producer": {"path": relative(root, tool_path), "sha256": sha256_file(tool_path)},
        "materials": buckets["materials"],
        "tools": buckets["tools"],
        "subjects": buckets["subjects"],
        "excluded_nodes": exclusions,
        "lineage_edges": lineage_edges,
        "validation": dict(sorted((validations or {}).items())),
        "claims": dict(sorted((claims or {}).items())),
        "summary": {
            "material_groups": len(buckets["materials"]),
            "tool_groups": len(buckets["tools"]),
            "subject_groups": len(buckets["subjects"]),
            "lineage_edges": len(lineage_edges),
            "excluded_nodes": len(exclusions),
        },
    }


def write_attestation(path: Path, attestation: dict) -> tuple[Path, str]:
    payload = json.dumps(attestation, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload, encoding="utf-8")
    digest = sha256_bytes(payload.encode("utf-8"))
    sidecar = Path(str(path) + ".sha256")
    sidecar.write_text(f"{digest}  {path.name}\n", encoding="utf-8")
    return sidecar, digest


def comparable_groups(attestation: dict) -> dict[str, dict[str, dict]]:
    result: dict[str, dict[str, dict]] = {}
    for bucket in ("materials", "tools", "subjects"):
        result[bucket] = {
            item["node_id"]: {
                "digest_basis": item["digest_basis"],
                "file_count": item["file_count"],
                "total_bytes": item["total_bytes"],
                "group_sha256": item["group_sha256"],
            }
            for item in attestation.get(bucket, [])
        }
    return result


def verify_attestation(path: Path, root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    try:
        observed = load_json(path)
    except (OSError, json.JSONDecodeError) as exc:
        return [f"cannot read attestation: {exc}"]
    if observed.get("schema") != SCHEMA:
        errors.append(f"schema must be {SCHEMA}")
    if observed.get("project_id") != PROJECT_ID:
        errors.append(f"project_id must be {PROJECT_ID}")
    validation = observed.get("validation", {})
    if not isinstance(validation, dict):
        errors.append("validation must be an object")
    else:
        for key, state in validation.items():
            if state not in VALIDATION_STATES:
                errors.append(f"validation {key} has unsupported state {state!r}")
    subject = observed.get("subject_commit", {})
    commit = subject.get("git_commit")
    tree = subject.get("git_tree")
    if not isinstance(commit, str) or not commit:
        errors.append("subject_commit.git_commit is missing")
        return errors
    try:
        current_commit = git_value(root, "rev-parse", "HEAD")
        current_tree = git_value(root, "rev-parse", "HEAD^{tree}")
    except (OSError, subprocess.CalledProcessError) as exc:
        errors.append(f"cannot read current git identity: {exc}")
        return errors
    if commit != current_commit:
        errors.append(f"attested commit differs from checkout: {commit} != {current_commit}")
    if tree != current_tree:
        errors.append(f"attested tree differs from checkout: {tree} != {current_tree}")
    try:
        expected = build_attestation(
            root,
            validations=validation,
            claims=observed.get("claims", {}),
            generated_at=observed.get("generated_at"),
            commit=current_commit,
            tree=current_tree,
        )
    except (OSError, ValueError, json.JSONDecodeError, subprocess.CalledProcessError) as exc:
        errors.append(f"cannot recompute provenance: {exc}")
        return errors
    for key in ("policy", "derivation_map", "producer", "excluded_nodes", "lineage_edges", "summary"):
        if observed.get(key) != expected.get(key):
            errors.append(f"attestation {key} differs from current checkout")
    if comparable_groups(observed) != comparable_groups(expected):
        errors.append("attested material/tool/subject digests differ from current checkout")
    sidecar = Path(str(path) + ".sha256")
    if sidecar.exists():
        expected_digest = sha256_file(path)
        sidecar_text = sidecar.read_text(encoding="utf-8").strip()
        first = sidecar_text.split()[0] if sidecar_text else ""
        if first != expected_digest:
            errors.append("attestation SHA-256 sidecar does not match attestation bytes")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--output", type=Path, help="write a new attestation and .sha256 sidecar")
    mode.add_argument("--verify", type=Path, help="verify an attestation against the current checkout")
    parser.add_argument("--validation", action="append", default=[], metavar="NAME=STATE")
    parser.add_argument("--claim", action="append", default=[], metavar="KEY=VALUE")
    args = parser.parse_args()
    try:
        validations = parse_pairs(args.validation, allowed_states=True)
        claims = parse_pairs(args.claim)
    except ValueError as exc:
        print(f"ERROR: {exc}")
        return 2
    if args.verify:
        errors = verify_attestation(args.verify)
        if errors:
            for error in errors:
                print(f"ERROR: {error}")
            return 1
        print(f"PROVENANCE_VERIFY_OK {args.verify}")
        return 0
    try:
        attestation = build_attestation(validations=validations, claims=claims)
        sidecar, digest = write_attestation(args.output, attestation)
    except (OSError, ValueError, json.JSONDecodeError, subprocess.CalledProcessError) as exc:
        print(f"ERROR: {exc}")
        return 1
    print(
        "PROVENANCE_OK "
        f"commit={attestation['subject_commit']['git_commit']} "
        f"materials={attestation['summary']['material_groups']} "
        f"tools={attestation['summary']['tool_groups']} "
        f"subjects={attestation['summary']['subject_groups']} "
        f"sha256={digest} sidecar={sidecar}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
