import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(*args):
    return subprocess.run([sys.executable, *map(str, args)], cwd=ROOT, capture_output=True, text=True)


def test_relationship_graph_builds_from_published_site(tmp_path):
    out = tmp_path / "relationships.json"
    r = run("tools/build_relationship_graph.py", "--out", out)
    assert r.returncode == 0, r.stderr
    graph = json.loads(out.read_text(encoding="utf-8"))
    assert graph["schema"] == "starsilk-entity-relationships/1"
    assert graph["entity_count"] >= 100
    assert graph["relationship_count"] >= 100
    assert any(e["id"] == "codec" for e in graph["entities"])
    assert "codec" in graph["backlinks"]


def test_reusable_canon_validator_rejects_forbidden_name():
    r = run("tools/validate_canon.py", "--text", "William enters the room.", "--json")
    assert r.returncode == 1
    result = json.loads(r.stdout)
    assert result["valid"] is False
    assert any(v["lock"] == "no-william" for v in result["violations"])


def test_reusable_canon_validator_section_complete_mode():
    text = "Dao has an eyepatch and a right mechanical arm."
    r = run("tools/validate_canon.py", "--text", text, "--section", "dao", "--complete", "--json")
    assert r.returncode == 0, r.stdout + r.stderr
    result = json.loads(r.stdout)
    assert result["valid"] is True
    assert "dao-right-arm" in result["locks_checked"]
    assert "dao-eyepatch-left" in result["locks_checked"]


def test_media_source_archive_verifies_and_packages(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    payload = b"canonical-starsilk-media"
    (source / "example.bin").write_bytes(payload)
    digest = hashlib.sha256(payload).hexdigest()
    manifest = {
        "assets": [{
            "filename": "published.bin",
            "sha256": digest,
            "bytes": len(payload),
            "source_filename": "example.bin",
            "source_sha256": digest,
            "source_bytes": len(payload),
        }]
    }
    manifest_path = tmp_path / "asset-manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    verify = run("tools/media_source_archive.py", "verify", "--manifest", manifest_path, "--source-dir", source, "--json")
    assert verify.returncode == 0, verify.stderr
    assert json.loads(verify.stdout)["verified_count"] == 1

    archive = tmp_path / "recovery.zip"
    package = run("tools/media_source_archive.py", "package", "--manifest", manifest_path, "--source-dir", source, "--out", archive)
    assert package.returncode == 0, package.stderr
    with zipfile.ZipFile(archive) as zf:
        names = set(zf.namelist())
        assert "media-source/example.bin" in names
        assert "asset-manifest.json" in names
        assert "RECOVERY_MANIFEST.json" in names
        assert "README.txt" in names
