#!/usr/bin/env python3
"""Extract embedded base64 data URIs from starsilk_character_dossier.html into
external, content-addressed, deduplicated media files under docs/assets/media/,
rewriting docs/index.html to reference them by relative path.

Usage: python3 tools/extract_embedded_media.py
Reads:  starsilk_character_dossier.html (repo root, never modified)
Writes: docs/index.html, docs/assets/media/*, docs/asset-manifest.json
"""
import base64
import bisect
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "starsilk_character_dossier.html"
DOCS = ROOT / "docs"
MEDIA_DIR = DOCS / "assets" / "media"
INDEX_OUT = DOCS / "index.html"
MANIFEST_OUT = DOCS / "asset-manifest.json"

EXT_MAP = {
    "png": "png",
    "jpeg": "jpg",
    "jpg": "jpg",
    "webp": "webp",
    "gif": "gif",
    "svg+xml": "svg",
    "mp4": "mp4",
    "webm": "webm",
    "quicktime": "mov",
}

DATA_URI_RE = re.compile(
    rb'src="data:(image|video)/([a-zA-Z0-9.+-]+);base64,([^"]*)"'
)
SECTION_ID_RE = re.compile(rb'<section\b[^>]*\bid="([^"]+)"')
ALT_RE = re.compile(rb'alt="([^"]*)"')


def find_enclosing_tag_start(data: bytes, pos: int) -> int:
    lt = data.rfind(b"<", 0, pos)
    return lt if lt != -1 else pos


def main() -> int:
    if not SOURCE.exists():
        print(f"ERROR: source file not found: {SOURCE}", file=sys.stderr)
        return 1

    print(f"Reading {SOURCE} ({SOURCE.stat().st_size:,} bytes)...")
    data = SOURCE.read_bytes()
    print(f"Read {len(data):,} bytes.")

    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    # Pre-index all <section id="..."> positions for nearest-ancestor lookup.
    section_positions = []
    section_ids = []
    for m in SECTION_ID_RE.finditer(data):
        section_positions.append(m.start())
        section_ids.append(m.group(1).decode("utf-8", "replace"))

    def nearest_section_id(pos: int):
        i = bisect.bisect_right(section_positions, pos) - 1
        if i >= 0:
            return section_ids[i]
        return None

    matches = list(DATA_URI_RE.finditer(data))
    print(f"Found {len(matches)} data URI occurrences in src=\"...\".")

    manifest_by_hash = {}  # sha256 -> record dict
    hash_to_filename = {}
    pieces = []
    last_end = 0
    total_ref_bytes_saved = 0

    for idx, m in enumerate(matches, 1):
        kind = m.group(1).decode("ascii")  # image | video
        subtype = m.group(2).decode("ascii").lower()
        payload_raw = m.group(3)
        payload_clean = re.sub(rb"\s+", b"", payload_raw)

        try:
            binary = base64.b64decode(payload_clean, validate=False)
        except Exception as e:
            print(f"WARNING: failed to decode payload #{idx} ({kind}/{subtype}): {e}", file=sys.stderr)
            pieces.append(data[last_end:m.end()])
            last_end = m.end()
            continue

        sha256 = hashlib.sha256(binary).hexdigest()
        ext = EXT_MAP.get(subtype, re.sub(r"[^a-z0-9]", "", subtype) or "bin")
        mime_type = f"{kind}/{subtype}"

        if sha256 not in manifest_by_hash:
            hash24 = sha256[:24]
            filename = f"{hash24}.{ext}"
            # Guard against (extremely unlikely) truncated-hash collision with a different mime.
            suffix = 0
            while filename in hash_to_filename.values() and manifest_by_hash.get(sha256, {}).get("filename") != filename:
                suffix += 1
                filename = f"{hash24}-{suffix}.{ext}"
            out_path = MEDIA_DIR / filename
            out_path.write_bytes(binary)
            manifest_by_hash[sha256] = {
                "sha256": sha256,
                "mime_type": mime_type,
                "filename": filename,
                "bytes": len(binary),
                "reference_count": 0,
                "contexts": [],
            }
            hash_to_filename[sha256] = filename
        else:
            total_ref_bytes_saved += len(binary)

        record = manifest_by_hash[sha256]
        record["reference_count"] += 1

        # Best-effort context capture (does not affect published HTML).
        tag_start = find_enclosing_tag_start(data, m.start())
        tag_snippet = data[tag_start:m.start()]
        alt_m = ALT_RE.search(tag_snippet)
        alt_text = alt_m.group(1).decode("utf-8", "replace") if alt_m else None
        sec_id = nearest_section_id(m.start())
        if len(record["contexts"]) < 20:
            record["contexts"].append({"section_id": sec_id, "alt": alt_text})

        replacement = f'src="assets/media/{record["filename"]}"'.encode("utf-8")
        pieces.append(data[last_end:m.start()])
        pieces.append(replacement)
        last_end = m.end()

        if idx % 25 == 0 or idx == len(matches):
            print(f"  processed {idx}/{len(matches)} media references...")

    pieces.append(data[last_end:])
    output = b"".join(pieces)

    DOCS.mkdir(parents=True, exist_ok=True)
    INDEX_OUT.write_bytes(output)
    print(f"Wrote {INDEX_OUT} ({len(output):,} bytes).")

    unique_assets = list(manifest_by_hash.values())
    total_unique_bytes = sum(r["bytes"] for r in unique_assets)
    total_decoded_bytes = total_unique_bytes + total_ref_bytes_saved
    duplicate_refs_eliminated = sum(r["reference_count"] - 1 for r in unique_assets)

    manifest = {
        "source_file": SOURCE.name,
        "source_size_bytes": SOURCE.stat().st_size,
        "generated_index_size_bytes": len(output),
        "total_data_uri_references": len(matches),
        "unique_binary_assets": len(unique_assets),
        "duplicate_references_eliminated": duplicate_refs_eliminated,
        "total_decoded_binary_size_bytes": total_decoded_bytes,
        "total_unique_binary_size_bytes": total_unique_bytes,
        "bytes_saved_by_deduplication": total_ref_bytes_saved,
        "assets": unique_assets,
    }
    MANIFEST_OUT.write_text(json.dumps(manifest, indent=2))
    print(f"Wrote {MANIFEST_OUT}.")

    print("\n--- Summary ---")
    print(f"Data URI references found:        {len(matches)}")
    print(f"Unique binary assets written:      {len(unique_assets)}")
    print(f"Duplicate references eliminated:   {duplicate_refs_eliminated}")
    print(f"Total decoded binary size:         {total_decoded_bytes:,} bytes")
    print(f"Total unique binary size on disk:  {total_unique_bytes:,} bytes")
    print(f"Bytes saved by dedup:              {total_ref_bytes_saved:,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
