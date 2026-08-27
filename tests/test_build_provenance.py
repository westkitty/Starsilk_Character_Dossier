from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


provenance = _load_module("build_provenance", ROOT / "tools" / "build_provenance.py")


def _fixture_repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    for directory in (
        "tools",
        "build",
        "src/system",
        "src/content",
        "src/templates",
        "docs/assets/media",
    ):
        (root / directory).mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "tools" / "build_provenance.py", root / "tools" / "build_provenance.py")
    (root / "MUSEUM_AI_FOUNDATION.md").write_text("foundation\n", encoding="utf-8")
    (root / "src/content/codec.txt").write_text("Codec\n", encoding="utf-8")
    (root / "src/templates/shell.j2").write_text("shell\n", encoding="utf-8")
    (root / "build/generate.py").write_text("print('build')\n", encoding="utf-8")
    (root / "docs/index.html").write_text("<html>Starsilk</html>\n", encoding="utf-8")
    manifest = {
        "assets": [
            {
                "filename": "codec.webp",
                "sha256": "a" * 64,
                "bytes": 123,
            }
        ]
    }
    (root / "docs/asset-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    graph = {
        "schema": "starsilk-derivation-map/1",
        "project_id": "starsilk-character-dossier",
        "nodes": [
            {"id": "foundation", "role": "authoritative", "node_type": "source", "paths": ["MUSEUM_AI_FOUNDATION.md"]},
            {"id": "content", "role": "authoritative", "node_type": "source", "paths": ["src/content/**", "src/templates/*"]},
            {"id": "media", "role": "evidence", "node_type": "source", "paths": ["docs/asset-manifest.json"]},
            {"id": "media_originals", "role": "authoritative", "node_type": "external", "paths": ["media/source/"], "required_present": False},
            {"id": "root_gen", "role": "authoritative", "node_type": "generator", "paths": ["build/generate.py"]},
            {"id": "root_out", "role": "generated", "node_type": "output", "paths": ["docs/index.html"]},
            {"id": "media_out", "role": "generated", "node_type": "output", "paths": ["docs/assets/media/**"]},
        ],
        "edges": [
            {"id": "content-root", "from": "content", "to": "root_gen", "kind": "input_to"},
            {"id": "root-out", "from": "root_gen", "to": "root_out", "kind": "generates"},
        ],
    }
    (root / "src/system/derivation-map.json").write_text(json.dumps(graph), encoding="utf-8")
    policy = {
        "schema": "starsilk-provenance-policy/1",
        "project_id": "starsilk-character-dossier",
        "excluded_nodes": {"media_originals": "outside Git by design"},
        "digest_overrides": {
            "media_out": {
                "mode": "manifest-records",
                "manifest": "docs/asset-manifest.json",
                "path_prefix": "docs/assets/media",
            }
        },
    }
    (root / "src/system/provenance-policy.json").write_text(json.dumps(policy), encoding="utf-8")
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.email", "fixture@example.com"], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.name", "fixture"], check=True)
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "fixture"], check=True)
    return root


def test_attestation_round_trip_and_manifest_backed_media(tmp_path: Path):
    root = _fixture_repo(tmp_path)
    attestation = provenance.build_attestation(
        root,
        validations={"ci": "pass"},
        claims={"source_workflow": "CI"},
        generated_at="2026-08-27T00:00:00+00:00",
    )
    out = tmp_path / "provenance.json"
    sidecar, digest = provenance.write_attestation(out, attestation)
    assert len(digest) == 64
    assert sidecar.exists()
    assert provenance.verify_attestation(out, root) == []
    media = next(item for item in attestation["subjects"] if item["node_id"] == "media_out")
    assert media["digest_basis"] == "manifest-records"
    assert media["files"] == [{"path": "docs/assets/media/codec.webp", "sha256": "a" * 64, "bytes": 123}]
    assert attestation["excluded_nodes"] == [
        {"node_id": "media_originals", "reason": "outside Git by design", "evidence_state": "unavailable-by-design"}
    ]


def test_changed_subject_invalidates_attestation(tmp_path: Path):
    root = _fixture_repo(tmp_path)
    out = tmp_path / "provenance.json"
    provenance.write_attestation(
        out,
        provenance.build_attestation(root, generated_at="2026-08-27T00:00:00+00:00"),
    )
    (root / "docs/index.html").write_text("tampered\n", encoding="utf-8")
    errors = provenance.verify_attestation(out, root)
    assert any("digests differ" in error for error in errors)


def test_sidecar_tamper_is_rejected(tmp_path: Path):
    root = _fixture_repo(tmp_path)
    out = tmp_path / "provenance.json"
    sidecar, _ = provenance.write_attestation(
        out,
        provenance.build_attestation(root, generated_at="2026-08-27T00:00:00+00:00"),
    )
    sidecar.write_text("0" * 64 + "  provenance.json\n", encoding="utf-8")
    assert "attestation SHA-256 sidecar does not match attestation bytes" in provenance.verify_attestation(out, root)


def test_policy_rejects_unknown_node(tmp_path: Path):
    root = _fixture_repo(tmp_path)
    policy_path = root / "src/system/provenance-policy.json"
    policy = json.loads(policy_path.read_text(encoding="utf-8"))
    policy["excluded_nodes"]["invented"] = "no such node"
    policy_path.write_text(json.dumps(policy), encoding="utf-8")
    with pytest.raises(ValueError, match="excluded node is absent"):
        provenance.build_attestation(root, generated_at="2026-08-27T00:00:00+00:00")


def test_provenance_workflow_is_main_only_and_boundary_checked():
    workflow = (ROOT / ".github" / "workflows" / "provenance.yml").read_text(encoding="utf-8")
    assert "workflow_run:" in workflow
    assert "head_branch == 'main'" in workflow
    assert "tools/build_provenance.py" in workflow
    assert "tools/check_public_boundary.py" in workflow
    assert "actions/upload-artifact@v4" in workflow
    assert "--verify" in workflow
