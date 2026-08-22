#!/usr/bin/env python3
"""Validate the generated Web Edition (docs/) for structural, content, and safety invariants.
Writes a human-readable report to docs/qa-report.txt and prints a summary.

Supports --strict flag (default in build pipeline) which exits with code 1 upon any invariant violation.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
INDEX = DOCS / "index.html"
SOURCE = ROOT / "starsilk_character_dossier.html"
REPORT = DOCS / "qa-report.txt"
MANIFEST = DOCS / "asset-manifest.json"

LOCAL_PATH_PATTERNS = [
    r"file://",
    r"/Users/andrew/",
    r"/mnt/data/",
    r"localhost:",
    r"127\.0\.0\.1:",
]

BASELINE_UNIQUE_ASSETS = 192
BASELINE_MEDIA_BYTES = 536251498


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Starsilk Character Dossier Web Edition")
    parser.add_argument("--strict", action="store_true", default=False, help="Exit with non-zero code on validation failure")
    args = parser.parse_args()

    if not INDEX.exists():
        print(f"ERROR: {INDEX} not found. Run extract_embedded_media.py first.", file=sys.stderr)
        return 1

    html = INDEX.read_text(encoding="utf-8", errors="replace")
    lines = []
    failures = []

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
    for i in ids:
        seen[i] = seen.get(i, 0) + 1
    dupes = sorted([k for k, v in seen.items() if v > 1])
    emit(f"[1] DUPLICATE IDS: {len(dupes)}")
    for d in dupes:
        emit(f"    - id=\"{d}\" appears {seen[d]} times")
    if dupes:
        failures.append(f"duplicate_ids ({len(dupes)})")
    emit()

    # 2. Hash navigation
    hrefs = set(re.findall(r'href="#([^"]+)"', html))
    id_set = set(ids)
    broken_anchors = sorted(h for h in hrefs if h and h not in id_set)
    emit(f"[2] BROKEN ANCHORS: {len(broken_anchors)} (of {len(hrefs)} unique #hash hrefs)")
    for b in broken_anchors:
        emit(f"    - href=\"#{b}\" has no matching id")
    if broken_anchors:
        failures.append(f"broken_anchors ({len(broken_anchors)})")
    emit()

    # 3. Local asset paths
    local_refs = set()
    for attr in ["src", "poster"]:
        local_refs |= set(re.findall(rf'{attr}="([^"]+)"', html))
    local_refs |= set(re.findall(r'<link[^>]*href="([^"]+)"', html))
    # Quoted asset paths inside inline <script> (e.g. JS clip rotation)
    local_refs |= set(re.findall(r'"(assets/media/[^"]+)"', html))
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
    if missing_assets:
        failures.append(f"missing_local_assets ({len(missing_assets)})")
    emit()

    # 4. Data URIs
    img_data_uris = len(re.findall(r"data:image/", html))
    video_data_uris = len(re.findall(r"data:video/", html))
    emit(f"[4] REMAINING DATA URIS: image={img_data_uris}, video={video_data_uris}")
    if img_data_uris > 0 or video_data_uris > 0:
        failures.append(f"remaining_data_uris (img={img_data_uris}, vid={video_data_uris})")
    emit()

    # 5. Local machine path leaks in HTML
    leaks = {}
    for pat in LOCAL_PATH_PATTERNS:
        matches = re.findall(pat, html)
        if matches:
            leaks[pat] = len(matches)
    emit(f"[5] LOCAL MACHINE PATH LEAKS: {sum(leaks.values())}")
    for pat, count in leaks.items():
        emit(f"    - pattern '{pat}': {count} occurrence(s)")
    if sum(leaks.values()) > 0:
        failures.append(f"local_path_leaks ({sum(leaks.values())})")
    emit()

    # 6. External runtime dependencies
    ext_urls = sorted(set(re.findall(r'(?:src|href)="(https?://[^"]+)"', html)))
    emit(f"[6] EXTERNAL RUNTIME DEPENDENCIES (http/https in src/href): {len(ext_urls)}")
    for u in ext_urls:
        emit(f"    - {u}")
    if ext_urls:
        failures.append(f"external_runtime_dependencies ({len(ext_urls)})")
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
    if total_sections < 138 or principal_count != 6 or peripheral_count != 45 or drakken_count != 56:
        failures.append(f"section_counts (total={total_sections}, princ={principal_count}, periph={peripheral_count}, drk={drakken_count})")
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
    if len(drakken_sections) != 56 or drakken_missing_id > 0 or drakken_missing_image > 0 or drakken_broken_image > 0:
        failures.append(f"drakken_validation (sec={len(drakken_sections)}, no_id={drakken_missing_id}, no_img={drakken_missing_image}, broken={drakken_broken_image})")
    emit()

    # 9. Media counts
    img_refs = len(re.findall(r"<img\b", html))
    video_refs = len(re.findall(r"<video\b", html))
    unique_img_files = len(set(re.findall(r'<img\b[^>]*src="assets/media/([^"]+)"', html)))
    unique_video_files = len(set(re.findall(r'(?:src="|")assets/media/([^"]+\.(?:mp4|webm|mov))"', html)))
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
    if obsolete_hits or not has_170:
        failures.append(f"war_chronology (obsolete={len(obsolete_hits)}, has_170={has_170})")
    emit()

    # 11. William
    william_hits = re.findall(r"william", html, re.IGNORECASE)
    emit(f"[11] WILLIAM OCCURRENCES: {len(william_hits)} (expected 0)")
    if william_hits:
        failures.append(f"william_occurrences ({len(william_hits)})")
    emit()

    # 12. Internal JS syntax
    scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, re.DOTALL)
    js_result = "no inline scripts found"
    node_available = subprocess.run(["which", "node"], capture_output=True).returncode == 0
    js_failures = []
    if scripts:
        if node_available:
            import tempfile
            for i, s in enumerate(scripts):
                if not s.strip():
                    continue
                with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as tf:
                    tf.write(s)
                    tmp_path = tf.name
                r = subprocess.run(["node", "--check", tmp_path], capture_output=True, text=True)
                if r.returncode != 0:
                    js_failures.append((i, r.stderr.strip()))
                Path(tmp_path).unlink(missing_ok=True)
            js_result = f"{len(scripts)} script block(s) checked, {len(js_failures)} syntax error(s)"
            for i, err in js_failures:
                emit(f"    - script block #{i}: {err}")
        else:
            js_result = f"{len(scripts)} script block(s) found, node not available to check"
    emit(f"[12] JAVASCRIPT SYNTAX: {js_result}")
    if js_failures:
        failures.append(f"js_syntax_errors ({len(js_failures)})")
    emit()

    # 13. Sizes & Media Preservation Baseline
    source_size = SOURCE.stat().st_size if SOURCE.exists() else None
    index_size = INDEX.stat().st_size
    docs_total = sum(f.stat().st_size for f in DOCS.rglob("*") if f.is_file())
    media_dir = DOCS / "assets" / "media"
    media_total = sum(f.stat().st_size for f in media_dir.rglob("*") if f.is_file()) if media_dir.exists() else 0
    media_count = len([f for f in media_dir.glob("*") if f.is_file()]) if media_dir.exists() else 0
    emit("[13] SIZE REPORT")
    emit(f"    Original source HTML: {source_size:,} bytes" if source_size else "    Original source HTML: N/A")
    emit(f"    Generated docs/index.html: {index_size:,} bytes")
    emit(f"    Total docs/ directory: {docs_total:,} bytes")
    emit(f"    Total extracted media: {media_total:,} bytes across {media_count} files")
    if media_count < BASELINE_UNIQUE_ASSETS or media_total < BASELINE_MEDIA_BYTES:
        failures.append(f"media_preservation_loss (count={media_count} < {BASELINE_UNIQUE_ASSETS}, bytes={media_total} < {BASELINE_MEDIA_BYTES})")
    emit()

    # 14. Drakken art-integration identity assertions
    DRAKKEN_ART_IDENTITIES = [
        "drk-the-egg", "drk-magma-pleuron", "drk-granithelion", "drk-fault-tongue", "drk-obsidian-gul",
        "drk-tremorhound", "drk-glassspine", "drk-quarrymind", "drk-aerokarst", "drk-cloudmaw",
        "drk-atmantid", "drk-weathernode", "drk-vortenbray", "drk-fumericus", "drk-skymourn",
        "drk-verdgorge", "drk-pollenvault", "drk-mycethron", "drk-raintaster", "drk-terragullet",
        "drk-petalnest", "drk-feralseed", "drk-solnexus", "drk-nullthorn", "lyriboris",
        "drk-helionth", "drk-umbrakrael", "drk-cinderverge", "drk-singularch", "drk-redacted-grin",
        "drk-spinal-loop", "cradle-exe", "foldhowl", "manifest-discord", "drk-gloryfail", "drk-viral-bastion",
    ]
    manifest_path = DOCS / "asset-manifest.json"
    exact_filenames = set()
    manifest_leak_count = 0
    if manifest_path.exists():
        try:
            m_text = manifest_path.read_text(encoding="utf-8")
            for pat in LOCAL_PATH_PATTERNS:
                manifest_leak_count += len(re.findall(pat, m_text))
            manifest = json.loads(m_text)
            exact_filenames = {a["filename"] for a in manifest.get("assets", []) if a.get("match_status") == "exact"}
        except Exception:
            pass

    if manifest_leak_count > 0:
        failures.append(f"manifest_path_leaks ({manifest_leak_count})")

    art_missing = []
    art_not_exact = []
    for section_id in DRAKKEN_ART_IDENTITIES:
        sec_m = re.search(rf'<section\b[^>]*id="{re.escape(section_id)}"', html)
        if not sec_m:
            art_missing.append((section_id, "section not found"))
            continue
        sec_start = sec_m.start()
        next_sec = re.search(r"<section\b", html[sec_start + 10:])
        sec_end = sec_start + 10 + next_sec.start() if next_sec else len(html)
        section_html = html[sec_start:sec_end]
        img_srcs = re.findall(r'<img\b[^>]*src="assets/media/([^"]+)"', section_html)
        if not img_srcs:
            art_missing.append((section_id, "no image in section"))
            continue
        for src in img_srcs:
            if not (DOCS / "assets" / "media" / src).exists():
                art_missing.append((section_id, f"broken src {src}"))
        if exact_filenames and not any(s in exact_filenames for s in img_srcs):
            art_not_exact.append(section_id)
    emit(f"[14] DRAKKEN ART IDENTITY ASSERTIONS: {len(DRAKKEN_ART_IDENTITIES)} checked, "
         f"{len(art_missing)} missing/broken, {len(art_not_exact)} without exact-provenance asset")
    for sid, reason in art_missing:
        emit(f"    - MISSING: {sid} ({reason})")
    for sid in art_not_exact:
        emit(f"    - NOT EXACT (manifest match_status != 'exact'): {sid}")
    if art_missing:
        failures.append(f"drakken_art_missing ({len(art_missing)})")
    emit()

    # 15. Import inventory summary
    inv_path = ROOT / "tools" / "drakken_art_inventory.json"
    if inv_path.exists():
        try:
            inv = json.loads(inv_path.read_text())
            emit("[15] DRAKKEN ART IMPORT SUMMARY (last run)")
            for k, v in inv.get("stats", {}).items():
                if k == "missing_source_files":
                    emit(f"    missing_source_files: {len(v)}")
                else:
                    emit(f"    {k}: {v}")
            emit()
        except Exception as e:
            emit(f"[15] DRAKKEN ART IMPORT SUMMARY: unreadable ({e})")
            emit()

    emit("=" * 70)
    emit("END OF REPORT")
    emit("=" * 70)

    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nReport written to {REPORT}")

    if failures:
        print(f"\nSTRICT VALIDATION FAILED: {', '.join(failures)}", file=sys.stderr)
        if args.strict:
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
