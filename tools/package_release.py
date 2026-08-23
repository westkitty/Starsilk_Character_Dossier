#!/usr/bin/env python3
"""Build a genuinely self-contained portable release package: a ZIP
containing docs/index.html, docs/assets/media/, and docs/asset-manifest.json
-- extract it anywhere and open index.html (or serve the directory) and it
works standalone, with no dependency on the rest of the project repository.

This is the truthful counterpart to the in-page "Export HTML copy" button,
which downloads only the current DOM state and still depends on a
companion assets/media/ directory to render canon images/video (see
src/content/sections/archive.body.html for that in-page disclosure).

Usage: python3 tools/package_release.py [--out dist/starsilk-compendium.zip]
"""
import argparse
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "dist" / "starsilk-compendium.zip"))
    args, unknown = ap.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2

    out_path = Path(args.out)
    if not (DOCS / "index.html").exists():
        print("ERROR: docs/index.html not found. Run tools/build.sh first.", file=sys.stderr)
        return 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    files = sorted(p for p in DOCS.rglob("*") if p.is_file() and p.name != "qa-report.txt")
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.write(f, arcname=str(f.relative_to(DOCS)))

    print(f"Wrote {out_path} ({out_path.stat().st_size:,} bytes, {len(files)} files)")
    print("This archive is self-contained: extract it and open index.html directly, "
          "or serve the extracted directory with any static file server.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
