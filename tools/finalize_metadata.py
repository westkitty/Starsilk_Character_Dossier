#!/usr/bin/env python3
"""Finalize metadata for Starsilk Character Dossier Web Edition (UX-032, UX-033).
- Scrubs private environment origin paths from provenance while preserving logical provenance.
- Enforces strict mutual consistency between manifest records, declared totals, and disk files:
    len(manifest["assets"]) == unique_binary_assets == actual media file count
    sum(manifest asset bytes) == total_unique_binary_size_bytes == actual media bytes
- Validates that every asset exists, byte counts match, SHA256 matches, and no unrepresented files exist.
- Updates generated_index_size_bytes accurately.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
MANIFEST = DOCS / "asset-manifest.json"
INDEX = DOCS / "index.html"
MEDIA_DIR = DOCS / "assets" / "media"
DRAKKEN_INV = ROOT / "tools" / "drakken_art_inventory.json"

LOCAL_PATH_PATTERNS = [
    r"/Users/",
    r"file://",
    r"MacBook Google Drive",
    r"GoogleDrive-",
]


def main() -> int:
    if not MANIFEST.exists():
        print(f"ERROR: {MANIFEST} not found.", file=sys.stderr)
        return 1

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    # 1. Scrub private machine paths from manifest top-level & provenance (UX-032)
    if "source_file" in manifest and manifest["source_file"]:
        src_path = Path(manifest["source_file"])
        manifest["source_file"] = src_path.name

    assets = manifest.get("assets", [])
    for asset in assets:
        if "provenance" in asset and isinstance(asset["provenance"], dict):
            prov = asset["provenance"]
            if "origin" in prov:
                del prov["origin"]

    # 2. Update generated index size
    if INDEX.exists():
        manifest["generated_index_size_bytes"] = INDEX.stat().st_size

    # 3. Enforce strict manifest consistency with disk media
    if not MEDIA_DIR.exists():
        print(f"ERROR: Media directory {MEDIA_DIR} does not exist.", file=sys.stderr)
        return 1

    media_files = {f.name: f for f in MEDIA_DIR.glob("*") if f.is_file()}
    disk_file_count = len(media_files)
    disk_total_bytes = sum(f.stat().st_size for f in media_files.values())

    manifest_filenames = set()
    manifest_duplicates = []
    missing_on_disk = []
    size_mismatches = []
    sha_mismatches = []

    for a in assets:
        fn = a.get("filename")
        if not fn:
            print("ERROR: Asset record missing filename.", file=sys.stderr)
            return 1
        if fn in manifest_filenames:
            manifest_duplicates.append(fn)
        manifest_filenames.add(fn)

        disk_file = media_files.get(fn)
        if not disk_file:
            missing_on_disk.append(fn)
        else:
            actual_size = disk_file.stat().st_size
            declared_size = a.get("bytes")
            if declared_size != actual_size:
                size_mismatches.append((fn, declared_size, actual_size))
            if "sha256" in a and a["sha256"]:
                actual_sha = hashlib.sha256(disk_file.read_bytes()).hexdigest()
                if a["sha256"] != actual_sha:
                    sha_mismatches.append((fn, a["sha256"], actual_sha))

    unrepresented_on_disk = [fn for fn in media_files if fn not in manifest_filenames]

    errors = []
    if manifest_duplicates:
        errors.append(f"Duplicate filenames in manifest: {manifest_duplicates}")
    if missing_on_disk:
        errors.append(f"Manifest assets missing on disk: {missing_on_disk}")
    if unrepresented_on_disk:
        errors.append(f"Disk media files not in manifest: {unrepresented_on_disk}")
    if size_mismatches:
        errors.append(f"Asset size mismatches: {size_mismatches}")
    if sha_mismatches:
        errors.append(f"Asset SHA-256 mismatches: {sha_mismatches}")
    if len(assets) != disk_file_count:
        errors.append(f"Manifest asset count ({len(assets)}) does not match disk count ({disk_file_count})")

    sum_manifest_bytes = sum(a.get("bytes", 0) for a in assets)
    if sum_manifest_bytes != disk_total_bytes:
        errors.append(f"Manifest total bytes ({sum_manifest_bytes}) does not match disk total ({disk_total_bytes})")

    if errors:
        print("ERROR: Manifest consistency validation failed:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    manifest["unique_binary_assets"] = len(assets)
    manifest["total_unique_binary_size_bytes"] = sum_manifest_bytes

    # Ensure no path leaks remain in the finalized manifest text
    manifest_text = json.dumps(manifest, indent=2) + "\n"
    for pat in LOCAL_PATH_PATTERNS:
        if re.search(pat, manifest_text):
            print(f"ERROR: Local path pattern '{pat}' detected in finalized manifest.", file=sys.stderr)
            return 1

    MANIFEST.write_text(manifest_text, encoding="utf-8")

    # 4. Scrub drakken_art_inventory.json if present
    if DRAKKEN_INV.exists():
        try:
            inv = json.loads(DRAKKEN_INV.read_text(encoding="utf-8"))
            for entry in inv.get("files", []):
                if "source_path" in entry:
                    sp = str(entry["source_path"])
                    if "/drakken/" in sp:
                        entry["source_path"] = "drakken/" + sp.split("/drakken/", 1)[1]
                    else:
                        entry["source_path"] = Path(sp).name
            DRAKKEN_INV.write_text(json.dumps(inv, indent=2) + "\n", encoding="utf-8")
        except Exception as e:
            print(f"WARNING: Could not scrub drakken_art_inventory.json: {e}", file=sys.stderr)

    print("Metadata finalized and scrubbed for publication.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
