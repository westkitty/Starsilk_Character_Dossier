#!/usr/bin/env python3
"""Verify and package canonical media originals for durable recovery.

The committed docs/asset-manifest.json is the provenance ledger. This tool
proves that a local media/source/ directory still contains every canonical
source at the expected byte count and SHA-256 before it is trusted as a backup,
and can package the verified originals with a recovery manifest.
"""
import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MANIFEST = ROOT / "docs" / "asset-manifest.json"
DEFAULT_SOURCE = ROOT / "media" / "source"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def expected_sources(manifest: dict) -> dict:
    sources = {}
    conflicts = []
    for asset in manifest.get("assets", []):
        name = asset.get("source_filename")
        digest = asset.get("source_sha256")
        size = asset.get("source_bytes")
        if not name or not digest:
            continue
        record = {"sha256": digest, "bytes": size}
        if name in sources and sources[name] != record:
            conflicts.append(name)
        sources[name] = record
    if conflicts:
        raise ValueError(f"conflicting provenance for source file(s): {sorted(set(conflicts))}")
    return sources


def verify(source_dir: Path, manifest: dict) -> dict:
    expected = expected_sources(manifest)
    issues = []
    verified = []
    for name, meta in sorted(expected.items()):
        path = source_dir / name
        if not path.is_file():
            issues.append({"file": name, "kind": "missing"})
            continue
        actual_size = path.stat().st_size
        if meta.get("bytes") is not None and actual_size != meta["bytes"]:
            issues.append({"file": name, "kind": "byte_mismatch", "expected": meta["bytes"], "actual": actual_size})
            continue
        actual_sha = sha256(path)
        if actual_sha != meta["sha256"]:
            issues.append({"file": name, "kind": "sha256_mismatch", "expected": meta["sha256"], "actual": actual_sha})
            continue
        verified.append(name)

    actual_names = {p.name for p in source_dir.iterdir() if p.is_file()} if source_dir.exists() else set()
    extras = sorted(actual_names - set(expected))
    return {
        "schema": "starsilk-media-source-verification/1",
        "source_dir": str(source_dir),
        "expected_count": len(expected),
        "verified_count": len(verified),
        "valid": not issues,
        "issues": issues,
        "extras": extras,
        "verified": verified,
    }


def package(source_dir: Path, manifest_path: Path, out_path: Path) -> int:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    result = verify(source_dir, manifest)
    if not result["valid"]:
        print(json.dumps(result, indent=2), file=sys.stderr)
        print("ERROR: refusing to package an incomplete or mismatched canonical media set", file=sys.stderr)
        return 1

    recovery = {
        "schema": "starsilk-media-recovery-package/1",
        "verification": result,
        "provenance_manifest": "asset-manifest.json",
        "restore_to": "media/source/",
    }
    readme = (
        "STARSILK CANONICAL MEDIA RECOVERY PACKAGE\n\n"
        "Restore every file under media-source/ to the repository's media/source/ directory.\n"
        "Then run: python3 tools/media_source_archive.py verify\n"
        "Only after verification passes should --regenerate-media be trusted.\n"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
        zf.write(manifest_path, "asset-manifest.json")
        zf.writestr("RECOVERY_MANIFEST.json", json.dumps(recovery, indent=2, sort_keys=True) + "\n")
        zf.writestr("README.txt", readme)
        for name in result["verified"]:
            zf.write(source_dir / name, f"media-source/{name}")
    print(f"Wrote verified recovery package: {out_path} ({len(result['verified'])} canonical source files)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify or package Starsilk canonical media sources")
    ap.add_argument("command", choices=["verify", "package"])
    ap.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    ap.add_argument("--source-dir", default=str(DEFAULT_SOURCE))
    ap.add_argument("--out", default=str(ROOT / "dist" / "starsilk-canonical-media-recovery.zip"))
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    manifest_path = Path(args.manifest)
    source_dir = Path(args.source_dir)
    if not manifest_path.is_file():
        print(f"ERROR: manifest not found: {manifest_path}", file=sys.stderr)
        return 2
    if not source_dir.is_dir():
        print(f"ERROR: canonical media source directory not found: {source_dir}", file=sys.stderr)
        return 2

    if args.command == "package":
        return package(source_dir, manifest_path, Path(args.out))

    result = verify(source_dir, json.loads(manifest_path.read_text(encoding="utf-8")))
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        state = "PASS" if result["valid"] else "FAIL"
        print(f"{state}: {result['verified_count']}/{result['expected_count']} canonical source files verified")
        for issue in result["issues"]:
            print(f"- {issue['file']}: {issue['kind']}")
        if result["extras"]:
            print(f"Untracked extras: {len(result['extras'])}")
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
