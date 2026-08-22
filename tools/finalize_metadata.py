#!/usr/bin/env python3
"""Finalize metadata for Starsilk Character Dossier Web Edition (UX-032, UX-033).
- Scrubs private environment origin paths from provenance while preserving logical provenance.
- Updates generated_index_size_bytes and asset counts accurately.
- Preserves all 192 assets in docs/asset-manifest.json.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
MANIFEST = DOCS / "asset-manifest.json"
INDEX = DOCS / "index.html"
MEDIA_DIR = DOCS / "assets" / "media"


def main() -> int:
    if not MANIFEST.exists():
        print(f"ERROR: {MANIFEST} not found.", file=sys.stderr)
        return 1

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    # UX-032: Scrub private machine paths from manifest top-level & provenance
    if "source_file" in manifest and manifest["source_file"]:
        src_path = Path(manifest["source_file"])
        manifest["source_file"] = src_path.name

    for asset in manifest.get("assets", []):
        if "provenance" in asset and isinstance(asset["provenance"], dict):
            prov = asset["provenance"]
            # Remove private workstation / Google Drive path
            if "origin" in prov:
                del prov["origin"]

    # UX-033: Update metadata truth
    if INDEX.exists():
        manifest["generated_index_size_bytes"] = INDEX.stat().st_size

    if MEDIA_DIR.exists():
        media_files = [f for f in MEDIA_DIR.glob("*") if f.is_file()]
        manifest["unique_binary_assets"] = len(media_files)
        manifest["total_unique_binary_size_bytes"] = sum(f.stat().st_size for f in media_files)

    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("Metadata finalized and scrubbed for publication.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
