#!/usr/bin/env python3
"""Media delivery pipeline: separates canonical originals (media/source/,
versioned, never recompressed) from optimized web-delivery derivatives
(docs/assets/media/, generated, disposable, regenerable at any time).

Images (.png/.jpg/.jpeg) are re-encoded to WebP (quality 82, capped at
IMAGE_MAX_DIMENSION on the long edge) via cwebp. Videos (.mp4) are
transcoded to a capped-resolution/bitrate H.264 stream via ffmpeg, keeping
the .mp4 extension and filename identity (so no content reference needs to
change) since the *bytes* differ but the *identity* under which the file is
published does not. If a derivative would not end up smaller than its
source, the source is published unchanged instead -- optimization must
never be allowed to fail merely because a file was already small, and must
never silently bloat a file that was already efficient.

Writes docs/asset-manifest.json recording, per published asset: the
*published* filename/sha256/bytes (what docs/ actually serves) alongside
the *source* filename/sha256/bytes (what media/source/ holds) plus
whatever contexts/provenance/logical_identity/match_status metadata the
legacy manifest had recorded for that source file, so identity/provenance
survives even though a straight byte-count comparison across an
optimization pass legitimately will not.
"""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "media" / "source"
PUBLISH_DIR = ROOT / "docs" / "assets" / "media"
MANIFEST_FILE = ROOT / "docs" / "asset-manifest.json"
LEGACY_MANIFEST_KEYS = {"contexts", "logical_identity", "match_status", "provenance"}

IMAGE_MAX_DIMENSION = 2400
IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
VIDEO_EXTS = {".mp4"}

WEBP_QUALITY = "82"
VIDEO_CRF = "26"
VIDEO_MAX_WIDTH = 1920


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_legacy_metadata() -> dict:
    """filename -> subset of legacy manifest fields worth carrying forward."""
    if not MANIFEST_FILE.exists():
        return {}
    try:
        data = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}
    out = {}
    for a in data.get("assets", []):
        fn = a.get("filename")
        if not fn:
            continue
        out[fn] = {k: v for k, v in a.items() if k in LEGACY_MANIFEST_KEYS}
    return out


def make_image_derivative(src: Path, dest: Path) -> bool:
    """Returns True if a WebP derivative was written to dest."""
    cwebp = shutil.which("cwebp")
    if not cwebp:
        return False
    try:
        with Image.open(src) as im:
            w, h = im.size
    except (OSError, ValueError):
        return False
    args = [cwebp, "-quiet", "-q", WEBP_QUALITY]
    long_edge = max(w, h)
    if long_edge > IMAGE_MAX_DIMENSION:
        scale = IMAGE_MAX_DIMENSION / long_edge
        new_w, new_h = max(1, round(w * scale)), max(1, round(h * scale))
        args += ["-resize", str(new_w), str(new_h)]
    args += [str(src), "-o", str(dest)]
    r = subprocess.run(args, capture_output=True, text=True)
    return r.returncode == 0 and dest.exists()


def make_video_derivative(src: Path, dest: Path) -> bool:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    args = [
        ffmpeg, "-y", "-loglevel", "error", "-i", str(src),
        "-vf", f"scale='min({VIDEO_MAX_WIDTH},iw)':-2",
        "-c:v", "libx264", "-crf", VIDEO_CRF, "-preset", "medium",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        str(dest),
    ]
    r = subprocess.run(args, capture_output=True, text=True)
    return r.returncode == 0 and dest.exists()


def main() -> int:
    if not SOURCE_DIR.exists():
        print(f"ERROR: {SOURCE_DIR} not found", file=sys.stderr)
        return 1

    legacy = load_legacy_metadata()
    PUBLISH_DIR.mkdir(parents=True, exist_ok=True)
    for existing in PUBLISH_DIR.glob("*"):
        if existing.is_file():
            existing.unlink()

    assets = []
    total_source_bytes = 0
    total_published_bytes = 0
    tmp_dir = ROOT / ".media_pipeline_tmp"
    tmp_dir.mkdir(exist_ok=True)

    source_files = sorted(SOURCE_DIR.glob("*"))
    for src in source_files:
        if not src.is_file():
            continue
        ext = src.suffix.lower()
        source_bytes = src.stat().st_size
        source_sha = sha256_of(src)
        total_source_bytes += source_bytes
        stem = src.stem

        published_path = None
        published_ext = ext
        mime_type = None

        if ext in IMAGE_EXTS:
            mime_type = "image/png" if ext == ".png" else "image/jpeg"
            candidate = tmp_dir / f"{stem}.webp"
            if make_image_derivative(src, candidate) and candidate.stat().st_size < source_bytes:
                published_ext = ".webp"
                published_path = PUBLISH_DIR / f"{stem}.webp"
                shutil.move(str(candidate), published_path)
                mime_type = "image/webp"
            else:
                candidate.unlink(missing_ok=True)
                published_path = PUBLISH_DIR / src.name
                shutil.copy2(src, published_path)
        elif ext in VIDEO_EXTS:
            mime_type = "video/mp4"
            candidate = tmp_dir / f"{stem}.mp4"
            if make_video_derivative(src, candidate) and candidate.stat().st_size < source_bytes:
                published_path = PUBLISH_DIR / src.name
                shutil.move(str(candidate), published_path)
            else:
                candidate.unlink(missing_ok=True)
                published_path = PUBLISH_DIR / src.name
                shutil.copy2(src, published_path)
        else:
            published_path = PUBLISH_DIR / src.name
            shutil.copy2(src, published_path)
            mime_type = "application/octet-stream"

        published_bytes = published_path.stat().st_size
        published_sha = sha256_of(published_path)
        total_published_bytes += published_bytes

        entry = {
            "filename": published_path.name,
            "sha256": published_sha,
            "bytes": published_bytes,
            "mime_type": mime_type,
            "source_filename": src.name,
            "source_sha256": source_sha,
            "source_bytes": source_bytes,
        }
        entry.update(legacy.get(src.name, {}))
        assets.append(entry)

    shutil.rmtree(tmp_dir, ignore_errors=True)

    rename_map = {a["source_filename"]: a["filename"] for a in assets if a["source_filename"] != a["filename"]}
    manifest = {
        "schema": "starsilk-media-manifest/2",
        "source_dir": "media/source",
        "publish_dir": "docs/assets/media",
        "unique_binary_assets": len(assets),
        "total_source_size_bytes": total_source_bytes,
        "total_unique_binary_size_bytes": total_published_bytes,
        "assets": assets,
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    reduction_pct = 100 * (1 - total_published_bytes / total_source_bytes) if total_source_bytes else 0.0
    print(f"Media pipeline: {len(assets)} assets. Source {total_source_bytes:,} bytes -> "
          f"published {total_published_bytes:,} bytes "
          f"({reduction_pct:.1f}% reduction). "
          f"{len(rename_map)} filename(s) changed (format conversions).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
