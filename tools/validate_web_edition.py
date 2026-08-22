#!/usr/bin/env python3
"""Validate the generated Web Edition (docs/) for structural and safety issues.
Writes a human-readable report to docs/qa-report.txt and prints a summary.
Exit code is 0 even on findings (this is a report, not a hard gate) unless the
script itself errors; callers should read the report for PASS/FAIL detail.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
INDEX = DOCS / "index.html"
SOURCE = ROOT / "starsilk_character_dossier.html"
REPORT = DOCS / "qa-report.txt"

LOCAL_PATH_PATTERNS = [
    r"file://",
    r"/Users/andrew/",
    r"/mnt/data/",
    r"localhost:",
    r"127\.0\.0\.1:",
]


def main() -> int:
    if not INDEX.exists():
        print(f"ERROR: {INDEX} not found. Run extract_embedded_media.py first.", file=sys.stderr)
        return 1

    html = INDEX.read_text(encoding="utf-8", errors="replace")
    lines = []

    def emit(s=""):
        lines.append(s)
        print(s)

    emit("=" * 70)
    emit("STARSILK CHARACTER DOSSIER — WEB EDITION QA REPORT")
    emit("=" * 70)
    emit()

    # 1. Duplicate IDs
    ids = re.findall(r'\bid="([^"]+)"', html)
    seen = {}
    dupes = []
    for i in ids:
        seen[i] = seen.get(i, 0) + 1
    dupes = sorted([k for k, v in seen.items() if v > 1])
    emit(f"[1] DUPLICATE IDS: {len(dupes)}")
    for d in dupes:
        emit(f"    - id=\"{d}\" appears {seen[d]} times")
    emit()

    # 2. Hash navigation
    hrefs = set(re.findall(r'href="#([^"]+)"', html))
    id_set = set(ids)
    broken_anchors = sorted(h for h in hrefs if h and h not in id_set)
    emit(f"[2] BROKEN ANCHORS: {len(broken_anchors)} (of {len(hrefs)} unique #hash hrefs)")
    for b in broken_anchors:
        emit(f"    - href=\"#{b}\" has no matching id")
    emit()

    # 3. Local asset paths
    local_refs = set()
    for attr in ["src", "poster"]:
        local_refs |= set(re.findall(rf'{attr}="([^"]+)"', html))
    local_refs |= set(re.findall(r'<link[^>]*href="([^"]+)"', html))
    missing_assets = []
    checked = 0
    for ref in sorted(local_refs):
        if ref.startswith(("http://", "https://", "data:", "#", "mailto:")):
            continue
        checked += 1
        p = DOCS / ref
        if not p.exists():
            missing_assets.append(ref)
    emit(f"[3] LOCAL ASSET PATHS: {checked} checked, {len(missing_assets)} missing")
    for m in missing_assets:
        emit(f"    - MISSING: {m}")
    emit()

    # 4. Data URIs
    img_data_uris = len(re.findall(r"data:image/", html))
    video_data_uris = len(re.findall(r"data:video/", html))
    emit(f"[4] REMAINING DATA URIS: image={img_data_uris}, video={video_data_uris}")
    emit()

    # 5. Local machine path leaks
    leaks = {}
    for pat in LOCAL_PATH_PATTERNS:
        matches = re.findall(pat, html)
        if matches:
            leaks[pat] = len(matches)
    emit(f"[5] LOCAL MACHINE PATH LEAKS: {sum(leaks.values())}")
    for pat, count in leaks.items():
        emit(f"    - pattern '{pat}': {count} occurrence(s)")
    emit()

    # 6. External runtime dependencies
    ext_urls = sorted(set(re.findall(r'(?:src|href)="(https?://[^"]+)"', html)))
    emit(f"[6] EXTERNAL RUNTIME DEPENDENCIES (http/https in src/href): {len(ext_urls)}")
    for u in ext_urls:
        emit(f"    - {u}")
    emit()

    # 7. Section counts
    total_sections = len(re.findall(r"<section\b", html))
    principal_names = ["tiger", "marcel", "kail", "jazen", "dao", "codec"]
    principal_count = 0
    for name in principal_names:
        if re.search(rf'<section\b[^>]*class="page character-page {name}"', html):
            principal_count += 1
    peripheral_count = len(re.findall(r'<section\b[^>]*class="page character-page peripheral-page"', html))
    drakken_count = len(re.findall(r'<section\b[^>]*class="page character-page drakken-page"', html))
    emit(f"[7] SECTION COUNTS: total={total_sections}, principal={principal_count}, "
         f"peripheral={peripheral_count}, drakken={drakken_count}")
    emit()

    # 8. Drakken validation
    drakken_sections = list(re.finditer(
        r'<section\b[^>]*class="page character-page drakken-page"[^>]*>(.*?)(?=<section\b|\Z)',
        html, re.DOTALL
    ))
    drakken_missing_id = 0
    drakken_missing_image = 0
    drakken_broken_image = 0
    for m in drakken_sections:
        full_tag_start = m.group(0)[:400]
        id_m = re.search(r'\bid="([^"]+)"', full_tag_start)
        if not id_m:
            drakken_missing_id += 1
        body = m.group(1)
        img_srcs = re.findall(r'<img\b[^>]*src="([^"]+)"', body)
        if not img_srcs:
            drakken_missing_image += 1
        else:
            for src in img_srcs:
                if src.startswith(("http://", "https://", "data:")):
                    continue
                if not (DOCS / src).exists():
                    drakken_broken_image += 1
    emit(f"[8] DRAKKEN VALIDATION: sections={len(drakken_sections)}, "
         f"missing_id={drakken_missing_id}, missing_image={drakken_missing_image}, "
         f"broken_image_src={drakken_broken_image}")
    emit()

    # 9. Media counts
    img_refs = len(re.findall(r"<img\b", html))
    video_refs = len(re.findall(r"<video\b", html))
    unique_img_files = len(set(re.findall(r'<img\b[^>]*src="assets/media/([^"]+)"', html)))
    unique_video_files = len(set(re.findall(r'src="assets/media/([^"]+\.(?:mp4|webm|mov))"', html)))
    emit(f"[9] MEDIA COUNTS: image_refs={img_refs}, unique_image_files={unique_img_files}, "
         f"video_refs={video_refs}, unique_video_files={unique_video_files}")
    emit()

    # 10. War chronology sanity
    obsolete_patterns = [r"17-year", r"seventeen-year", r"17 years", r"seventeen years", r"Year 17(?!\d)"]
    obsolete_hits = []
    for pat in obsolete_patterns:
        for m in re.finditer(pat, html, re.IGNORECASE):
            start = max(0, m.start() - 60)
            end = min(len(html), m.end() + 60)
            obsolete_hits.append((pat, html[start:end].replace("\n", " ")))
    has_170 = bool(re.search(r"170[- ]year|one[- ]hundred[- ]seventy[- ]year", html, re.IGNORECASE))
    emit(f"[10] WAR CHRONOLOGY: obsolete_17_year_matches={len(obsolete_hits)}, "
         f"170_year_reference_present={has_170}")
    for pat, ctx in obsolete_hits:
        emit(f"    - pattern '{pat}': ...{ctx}...")
    emit()

    # 11. William
    william_hits = re.findall(r"william", html, re.IGNORECASE)
    emit(f"[11] WILLIAM OCCURRENCES: {len(william_hits)} (expected 0)")
    emit()

    # 12. Internal JS syntax
    scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, re.DOTALL)
    js_result = "no inline scripts found"
    node_available = subprocess.run(["which", "node"], capture_output=True).returncode == 0
    if scripts:
        if node_available:
            import tempfile
            failures = []
            for i, s in enumerate(scripts):
                if not s.strip():
                    continue
                with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as tf:
                    tf.write(s)
                    tmp_path = tf.name
                r = subprocess.run(["node", "--check", tmp_path], capture_output=True, text=True)
                if r.returncode != 0:
                    failures.append((i, r.stderr.strip()))
                Path(tmp_path).unlink(missing_ok=True)
            js_result = f"{len(scripts)} script block(s) checked, {len(failures)} syntax error(s)"
            for i, err in failures:
                emit(f"    - script block #{i}: {err}")
        else:
            js_result = f"{len(scripts)} script block(s) found, node not available to check"
    emit(f"[12] JAVASCRIPT SYNTAX: {js_result}")
    emit()

    # 13. Sizes
    source_size = SOURCE.stat().st_size if SOURCE.exists() else None
    index_size = INDEX.stat().st_size
    docs_total = sum(f.stat().st_size for f in DOCS.rglob("*") if f.is_file())
    media_dir = DOCS / "assets" / "media"
    media_total = sum(f.stat().st_size for f in media_dir.rglob("*") if f.is_file()) if media_dir.exists() else 0
    media_count = len(list(media_dir.glob("*"))) if media_dir.exists() else 0
    emit("[13] SIZE REPORT")
    emit(f"    Original source HTML: {source_size:,} bytes" if source_size else "    Original source HTML: N/A")
    emit(f"    Generated docs/index.html: {index_size:,} bytes")
    emit(f"    Total docs/ directory: {docs_total:,} bytes")
    emit(f"    Total extracted media: {media_total:,} bytes across {media_count} files")
    emit()

    emit("=" * 70)
    emit("END OF REPORT")
    emit("=" * 70)

    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nReport written to {REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
