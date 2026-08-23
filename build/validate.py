#!/usr/bin/env python3
"""Validate the generated Web Edition (docs/) using a real parsed DOM
(BeautifulSoup/lxml) rather than regex-on-raw-HTML-text, so a `<section>`
string sitting inside a JavaScript comment or string literal can never be
miscounted as a real element, and structural checks (duplicate ids, broken
anchors, disclosure semantics) reflect what a browser actually parses.

Writes a human-readable report to docs/qa-report.txt and prints a summary.

  --strict          Exit non-zero on any invariant violation.
  --site <dir>       Path to site directory (default: docs).
  --report <path>     Path to output QA report file (default: docs/qa-report.txt).
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
CANON_FILE = ROOT / "src" / "canon" / "invariants.json"

LOCAL_PATH_PATTERNS = [
    r"file://",
    r"/Users/",
    r"/mnt/data/",
    r"localhost:",
    r"127\.0\.0\.1:",
    r"GoogleDrive-",
    r"MacBook Google Drive",
]


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate Starsilk Compendium Web Edition")
    ap.add_argument("--strict", action="store_true", default=False)
    ap.add_argument("--site", default=str(ROOT / "docs"))
    ap.add_argument("--report", default=None)
    args, unknown = ap.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2

    site_dir = Path(args.site).resolve()
    report_file = Path(args.report).resolve() if args.report else (site_dir / "qa-report.txt")
    index_file = site_dir / "index.html"
    manifest_file = site_dir / "asset-manifest.json"
    media_dir = site_dir / "assets" / "media"

    if not index_file.exists():
        print(f"ERROR: {index_file} not found.", file=sys.stderr)
        return 1

    html = index_file.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "lxml")

    lines, failures = [], []

    def emit(s=""):
        lines.append(s)
        print(s)

    emit("=" * 70)
    emit("STARSILK COMPENDIUM — WEB EDITION QA REPORT (parsed-DOM validator)")
    emit("=" * 70)
    emit()

    # 1. Duplicate ids (parsed elements only -- ignores anything inside
    #    <script>/<style> text content, unlike a raw regex scan).
    ids = [el.get("id") for el in soup.find_all(id=True)]
    seen = {}
    for i in ids:
        seen[i] = seen.get(i, 0) + 1
    dupes = sorted(k for k, v in seen.items() if v > 1)
    emit(f"[1] DUPLICATE IDS: {len(dupes)}")
    for d in dupes:
        emit(f"    - id=\"{d}\" appears {seen[d]} times")
    if dupes:
        failures.append(f"duplicate_ids ({len(dupes)})")
    emit()

    # 2. Broken internal anchors (only real <a href="#..."> elements).
    id_set = set(ids)
    hrefs = {a.get("href")[1:] for a in soup.find_all("a", href=True) if a.get("href", "").startswith("#") and len(a.get("href")) > 1}
    broken_anchors = sorted(h for h in hrefs if h not in id_set)
    emit(f"[2] BROKEN ANCHORS: {len(broken_anchors)} (of {len(hrefs)} unique #hash hrefs)")
    for b in broken_anchors:
        emit(f"    - href=\"#{b}\" has no matching id")
    if broken_anchors:
        failures.append(f"broken_anchors ({len(broken_anchors)})")
    emit()

    # 3. Local asset paths (real element attributes only).
    local_refs = set()
    for tag, attr in (("img", "src"), ("video", "src"), ("video", "poster"), ("source", "src"), ("link", "href"), ("a", "href")):
        for el in soup.find_all(tag):
            v = el.get(attr)
            if v:
                local_refs.add(v)
    for el in soup.find_all(["video", "source"]):
        v = el.get("data-lazy-src")
        if v:
            local_refs.add(v)
    missing_assets, checked = [], 0
    for ref in sorted(local_refs):
        if ref.startswith(("http://", "https://", "data:", "#", "mailto:")):
            continue
        checked += 1
        if not (site_dir / ref).exists():
            missing_assets.append(ref)
    emit(f"[3] LOCAL ASSET PATHS: {checked} checked, {len(missing_assets)} missing")
    for m in missing_assets:
        emit(f"    - MISSING: {m}")
    if missing_assets:
        failures.append(f"missing_local_assets ({len(missing_assets)})")
    emit()

    # 4. No remaining data URIs (fully externalized media).
    data_uri_count = sum(1 for v in local_refs if v.startswith("data:"))
    emit(f"[4] REMAINING DATA URIS: {data_uri_count}")
    if data_uri_count:
        failures.append(f"remaining_data_uris ({data_uri_count})")
    emit()

    # 5. Local machine path leaks anywhere in the document text.
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

    # 6. Unexpected external runtime dependencies (real elements the browser
    #    would actually fetch -- excludes <link rel="canonical"> and <a>
    #    hrefs, which are metadata/navigation, not runtime dependencies).
    ext_urls = set()
    for tag, attr in (("script", "src"), ("img", "src"), ("video", "src"), ("source", "src")):
        for el in soup.find_all(tag):
            v = el.get(attr)
            if v and v.startswith(("http://", "https://")):
                ext_urls.add(v)
    for el in soup.find_all("link", href=True):
        if el.get("rel") and "canonical" in el.get("rel"):
            continue
        v = el.get("href")
        if v and v.startswith(("http://", "https://")):
            ext_urls.add(v)
    emit(f"[6] EXTERNAL RUNTIME DEPENDENCIES: {len(ext_urls)}")
    for u in sorted(ext_urls):
        emit(f"    - {u}")
    if ext_urls:
        failures.append(f"external_runtime_dependencies ({len(ext_urls)})")
    emit()

    # 7. Section counts (parsed <section> elements only).
    all_sections = soup.find_all("section")
    principal_ids = {"shard-god", "codec", "dao", "kail", "marcel", "jazen"}
    principal_count = sum(1 for s in all_sections if s.get("id") in principal_ids and "character-page" in (s.get("class") or []))
    peripheral_count = sum(1 for s in all_sections if {"character-page", "peripheral-page"} <= set(s.get("class") or []))
    drakken_count = sum(1 for s in all_sections if {"character-page", "drakken-page"} <= set(s.get("class") or []))
    emit(f"[7] SECTION COUNTS: total={len(all_sections)}, principal={principal_count}, "
         f"peripheral={peripheral_count}, drakken={drakken_count}")
    emit()

    # 8. <summary>/disclosure semantics: every page-disclosure's <summary>
    #    must be a direct child of its <details>, and must not contain
    #    invalid interactive-in-interactive flow content.
    disclosure_errors = []
    for details in soup.find_all("details", class_="page-disclosure"):
        summary = details.find("summary", recursive=False)
        if summary is None:
            disclosure_errors.append(f"details.page-disclosure (id-context={details.parent.get('id') if details.parent else '?'}) has no direct-child <summary>")
            continue
        nested_interactive = summary.find(["a", "button", "input", "select", "textarea", "details"])
        if nested_interactive is not None:
            disclosure_errors.append(
                f"summary inside #{details.parent.get('id') if details.parent else '?'} contains "
                f"nested interactive <{nested_interactive.name}> (invalid inside <summary> flow content)"
            )
    emit(f"[8] DISCLOSURE (<summary>) SEMANTICS: {len(disclosure_errors)} error(s)")
    for e in disclosure_errors:
        emit(f"    - {e}")
    if disclosure_errors:
        failures.append(f"disclosure_semantics ({len(disclosure_errors)})")
    emit()

    # 9. Media counts (informational).
    img_refs = len(soup.find_all("img"))
    video_refs = len(soup.find_all("video"))
    emit(f"[9] MEDIA COUNTS: image_refs={img_refs}, video_refs={video_refs}")
    emit()

    # 10-11. Canon invariants (see src/canon/invariants.json).
    canon_failures = run_canon_checks(soup, html, emit)
    failures.extend(canon_failures)

    # 12. JavaScript syntax (real <script> elements, no src).
    scripts = [s.string or s.get_text() for s in soup.find_all("script") if not s.get("src")]
    node_available = subprocess.run(["which", "node"], capture_output=True).returncode == 0
    js_failures = []
    if scripts and node_available:
        import tempfile
        for i, s in enumerate(scripts):
            if not s or not s.strip():
                continue
            with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as tf:
                tf.write(s)
                tmp_path = tf.name
            r = subprocess.run(["node", "--check", tmp_path], capture_output=True, text=True)
            if r.returncode != 0:
                js_failures.append((i, r.stderr.strip()))
            Path(tmp_path).unlink(missing_ok=True)
    emit(f"[12] JAVASCRIPT SYNTAX: {len(scripts)} script block(s), {len(js_failures)} syntax error(s)"
         + ("" if node_available else " (node unavailable, skipped)"))
    for i, err in js_failures:
        emit(f"    - script block #{i}: {err}")
    if js_failures:
        failures.append(f"js_syntax_errors ({len(js_failures)})")
    emit()

    # 13. Size report (informational -- no byte-count regression lock; see
    #     check 16 for identity/provenance-based media integrity instead).
    index_size = index_file.stat().st_size
    docs_total = sum(f.stat().st_size for f in site_dir.rglob("*") if f.is_file())
    media_total = sum(f.stat().st_size for f in media_dir.rglob("*") if f.is_file()) if media_dir.exists() else 0
    media_count = len([f for f in media_dir.glob("*") if f.is_file()]) if media_dir.exists() else 0
    emit("[13] SIZE REPORT")
    emit(f"    Generated docs/index.html: {index_size:,} bytes")
    emit(f"    Total docs/ directory: {docs_total:,} bytes")
    emit(f"    Total published media: {media_total:,} bytes across {media_count} files")
    emit()

    # 14. Drakken art-identity assertions (from canon invariants file).
    canon = json.loads(CANON_FILE.read_text(encoding="utf-8")) if CANON_FILE.exists() else {}
    art_missing = []
    for section_id in canon.get("drakken_art_identities", []):
        sec = soup.find(id=section_id)
        if sec is None:
            art_missing.append((section_id, "section not found"))
            continue
        imgs = sec.find_all("img")
        broken = [img.get("src") for img in imgs if img.get("src") and not img["src"].startswith(("http", "data:")) and not (site_dir / img["src"]).exists()]
        if not imgs:
            art_missing.append((section_id, "no image in section"))
        elif broken:
            art_missing.append((section_id, f"broken src {broken}"))
    emit(f"[14] DRAKKEN ART IDENTITY ASSERTIONS: {len(canon.get('drakken_art_identities', []))} checked, {len(art_missing)} missing/broken")
    for sid, reason in art_missing:
        emit(f"    - MISSING: {sid} ({reason})")
    if art_missing:
        failures.append(f"drakken_art_missing ({len(art_missing)})")
    emit()

    # 15. (reserved -- historical import-inventory summary; no longer applicable
    #      to the deterministic generator, kept as a numbered no-op for report
    #      layout stability.)
    emit("[15] (not applicable: one-time import tooling has been retired)")
    emit()

    # 16. Manifest invariants: identity/provenance/inventory based, NOT a
    #     byte-count regression floor -- a legitimate size-reducing media
    #     optimization must never fail this gate merely for being smaller.
    manifest_errors = []
    if not manifest_file.exists():
        manifest_errors.append("asset-manifest.json not found")
    else:
        try:
            manifest_obj = json.loads(manifest_file.read_text(encoding="utf-8"))
            m_assets = manifest_obj.get("assets", [])
            disk_files_map = {f.name: f for f in media_dir.glob("*") if f.is_file()} if media_dir.exists() else {}

            m_filenames = set()
            for idx, a in enumerate(m_assets):
                fn = a.get("filename")
                if not fn:
                    manifest_errors.append(f"asset #{idx} missing filename")
                    continue
                if fn in m_filenames:
                    manifest_errors.append(f"duplicate manifest filename: {fn}")
                m_filenames.add(fn)
                disk_f = disk_files_map.get(fn)
                if not disk_f:
                    manifest_errors.append(f"manifest asset missing on disk: {fn}")
                    continue
                if a.get("bytes") != disk_f.stat().st_size:
                    manifest_errors.append(f"asset {fn} byte mismatch: manifest {a.get('bytes')} vs disk {disk_f.stat().st_size}")
                if a.get("sha256"):
                    actual_sha = hashlib.sha256(disk_f.read_bytes()).hexdigest()
                    if a["sha256"] != actual_sha:
                        manifest_errors.append(f"asset {fn} published-SHA256 mismatch: manifest {a['sha256']} vs disk {actual_sha}")
                if not a.get("source_filename") or not a.get("source_sha256"):
                    manifest_errors.append(f"asset {fn} missing source provenance (source_filename/source_sha256)")

            for disk_fn in disk_files_map:
                if disk_fn not in m_filenames:
                    manifest_errors.append(f"disk media file not represented in manifest: {disk_fn}")

            source_dir = ROOT / "media" / "source"
            if source_dir.exists():
                source_files = {f.name for f in source_dir.glob("*") if f.is_file()}
                manifest_sources = {a.get("source_filename") for a in m_assets}
                missing_sources = source_files - manifest_sources
                if missing_sources:
                    manifest_errors.append(f"media/source files not represented in manifest: {sorted(missing_sources)}")
        except Exception as e:
            manifest_errors.append(f"manifest JSON parse/read error: {e}")

    emit(f"[16] MANIFEST INVARIANTS (identity/provenance-based): {len(manifest_errors)} error(s)")
    for me in manifest_errors:
        emit(f"    - {me}")
    if manifest_errors:
        failures.append(f"manifest_invariants ({len(manifest_errors)})")
    emit()

    emit("=" * 70)
    emit("END OF REPORT")
    emit("=" * 70)

    report_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nReport written to {report_file}")

    if failures:
        print(f"\nSTRICT VALIDATION FAILED: {', '.join(failures)}", file=sys.stderr)
        if args.strict:
            return 1

    return 0


def run_canon_checks(soup: BeautifulSoup, html: str, emit) -> list:
    if not CANON_FILE.exists():
        emit("[10-11] CANON INVARIANTS: src/canon/invariants.json not found")
        return ["canon_invariants_file_missing"]
    canon = json.loads(CANON_FILE.read_text(encoding="utf-8"))
    failures = []
    violations = []

    for lock in canon.get("document_locks", []):
        for pat in lock.get("must_match", []):
            if not re.search(pat, html):
                violations.append(f"{lock['id']}: required pattern not found: {pat}")
        for pat in lock.get("must_not_match", []):
            if re.search(pat, html):
                violations.append(f"{lock['id']}: forbidden pattern present: {pat}")

    for lock in canon.get("section_locks", []):
        sec = soup.find(id=lock["section"])
        scope_html = str(sec) if sec is not None else ""
        if sec is None:
            violations.append(f"{lock['id']}: section #{lock['section']} not found")
            continue
        for pat in lock.get("must_match", []):
            if not re.search(pat, scope_html):
                violations.append(f"{lock['id']}: required pattern not found in #{lock['section']}: {pat}")
        for pat in lock.get("must_not_match", []):
            if re.search(pat, scope_html):
                violations.append(f"{lock['id']}: forbidden pattern present in #{lock['section']}: {pat}")

    counts = canon.get("counts", {})
    all_sections = soup.find_all("section")
    principal_ids = {"shard-god", "codec", "dao", "kail", "marcel", "jazen"}
    principal_count = sum(1 for s in all_sections if s.get("id") in principal_ids and "character-page" in (s.get("class") or []))
    peripheral_count = sum(1 for s in all_sections if {"character-page", "peripheral-page"} <= set(s.get("class") or []))
    drakken_count = sum(1 for s in all_sections if {"character-page", "drakken-page"} <= set(s.get("class") or []))
    if len(all_sections) < counts.get("total_sections_min", 0):
        violations.append(f"total sections {len(all_sections)} < required minimum {counts['total_sections_min']}")
    if principal_count != counts.get("principal"):
        violations.append(f"principal count {principal_count} != required {counts.get('principal')}")
    if peripheral_count != counts.get("peripheral"):
        violations.append(f"peripheral count {peripheral_count} != required {counts.get('peripheral')}")
    if drakken_count != counts.get("drakken"):
        violations.append(f"drakken count {drakken_count} != required {counts.get('drakken')}")

    for name in canon.get("principal_names", []):
        if not re.search(re.escape(name), html):
            violations.append(f"principal name missing from document: {name}")

    emit(f"[10-11] CANON INVARIANTS: {len(canon.get('document_locks', [])) + len(canon.get('section_locks', []))} lock(s) checked, {len(violations)} violation(s)")
    for v in violations:
        emit(f"    - {v}")
    if violations:
        failures.append(f"canon_invariant_violations ({len(violations)})")
    emit()
    return failures


if __name__ == "__main__":
    raise SystemExit(main())
