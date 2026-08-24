"""Regression suite for the Starsilk Compendium Web Edition. Structural/unit
checks first, then Playwright browser behavioral tests across responsive
viewports (default browser: Chromium; tests/test_cross_browser.py covers a
representative subset across Firefox/WebKit too).
"""
import hashlib
import json
import re
import subprocess
import sys
import time
import zipfile
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

from conftest import assert_matches_baseline, fresh_server

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
INDEX = DOCS / "index.html"
MANIFEST = DOCS / "asset-manifest.json"
REPORT = DOCS / "qa-report.txt"
MEDIA_DIR = DOCS / "assets" / "media"
SOURCE_DIR = ROOT / "media" / "source"

RESPONSIVE_WIDTHS = [320, 375, 430, 620, 768, 950, 951, 1024, 1180, 1280, 1366, 1440, 1920]

LAZY_VIDEO_HASHES = {
    "6e2c5017f608c8e10b13cbc1.mp4", "6780fd9268d678610ec58ab0.mp4",
    "c5cccb4a121970a88fdc21f2.mp4", "e8362fdb9c7fe9bf3852a26e.mp4",
    "a76f7d67be78c3778f596f89.mp4",
}


# ==============================================================================
# BUILD / VALIDATION / STRUCTURAL UNIT TESTS
# ==============================================================================

def test_strict_validator_passes():
    res = subprocess.run(
        [sys.executable, str(ROOT / "build" / "validate.py"), "--strict"],
        capture_output=True, text=True,
    )
    assert res.returncode == 0, f"Validator failed: {res.stderr}\n{res.stdout}"


def test_strict_validator_gates_duplicate_ids_and_broken_anchors(tmp_path):
    tmp_report = tmp_path / "temp_failing_qa_report.txt"
    orig_index = INDEX.read_text(encoding="utf-8")
    invalid_html = orig_index.replace(
        '<section class="page cover" id="cover"',
        '<section class="page cover" id="cover"><a href="#nonexistentAnchor">Broken</a',
        1,
    ).replace('id="world"', 'id="cover"', 1)
    try:
        INDEX.write_text(invalid_html, encoding="utf-8")
        res = subprocess.run(
            [sys.executable, str(ROOT / "build" / "validate.py"), "--strict", "--report", str(tmp_report)],
            capture_output=True, text=True,
        )
        assert res.returncode != 0, "Strict validator should fail on duplicate IDs and broken anchors!"
        assert tmp_report.exists()
        failing_text = tmp_report.read_text(encoding="utf-8")
        assert "DUPLICATE IDS: 1" in failing_text
        assert "BROKEN ANCHORS" in failing_text
        assert re.search(r"BROKEN ANCHORS: [1-9]", failing_text)
    finally:
        INDEX.write_text(orig_index, encoding="utf-8")


def test_strict_validator_gates_manifest_errors(tmp_path):
    tmp_report = tmp_path / "manifest_fail_report.txt"
    orig_manifest = MANIFEST.read_text(encoding="utf-8")
    bad_manifest = json.loads(orig_manifest)
    bad_manifest["assets"][0]["bytes"] = 999999999
    try:
        MANIFEST.write_text(json.dumps(bad_manifest, indent=2), encoding="utf-8")
        res = subprocess.run(
            [sys.executable, str(ROOT / "build" / "validate.py"), "--strict", "--report", str(tmp_report)],
            capture_output=True, text=True,
        )
        assert res.returncode != 0, "Strict validator must fail on manifest byte mismatch!"
    finally:
        MANIFEST.write_text(orig_manifest, encoding="utf-8")


def test_strict_validator_rejects_unknown_flag():
    res = subprocess.run(
        [sys.executable, str(ROOT / "build" / "validate.py"), "--strict", "--this-flag-does-not-exist"],
        capture_output=True, text=True,
    )
    assert res.returncode != 0, "Validator must reject unknown CLI flags rather than silently ignore them"


def test_build_script_rejects_unknown_flag():
    res = subprocess.run(
        ["bash", str(ROOT / "tools" / "build.sh"), "--totally-bogus-flag"],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    assert res.returncode != 0, "build.sh must exit non-zero on an unrecognized option, not silently proceed"


def test_generator_rejects_unknown_flag():
    res = subprocess.run(
        [sys.executable, str(ROOT / "build" / "generate.py"), "--not-a-real-flag"],
        capture_output=True, text=True,
    )
    assert res.returncode != 0


def test_build_is_deterministic_and_matches_committed_output():
    """Re-running the generator from src/content/ + src/templates/ must
    reproduce docs/index.html byte-for-byte (UX-029 equivalent): proves
    docs/index.html is disposable generated output, not a hand-mutated
    source file."""
    res = subprocess.run(
        [sys.executable, str(ROOT / "build" / "generate.py"), "--check"],
        capture_output=True, text=True,
    )
    assert res.returncode == 0, f"Generated output diverged from committed docs/index.html:\n{res.stdout}\n{res.stderr}"


def test_build_pipeline_idempotency():
    def get_hash():
        return hashlib.sha256(INDEX.read_bytes()).hexdigest()

    subprocess.run([sys.executable, str(ROOT / "build" / "generate.py")], check=True, cwd=str(ROOT))
    h1 = get_hash()
    subprocess.run([sys.executable, str(ROOT / "build" / "generate.py")], check=True, cwd=str(ROOT))
    h2 = get_hash()
    assert h1 == h2, "Generator is not idempotent!"


def test_media_manifest_identity_and_provenance():
    """Media integrity is checked by identity/provenance/inventory, NOT a
    byte-count regression floor -- a legitimate optimization pass that
    shrinks published media must never fail this test merely for being
    smaller (UX-032/UX-033 successor)."""
    assert MANIFEST.exists()
    m_text = MANIFEST.read_text(encoding="utf-8")
    assert "/Users/" not in m_text
    assert "MacBook Google Drive" not in m_text
    assert "file://" not in m_text

    data = json.loads(m_text)
    assets = data.get("assets", [])
    media_files = {f.name: f for f in MEDIA_DIR.glob("*") if f.is_file()}
    assert len(assets) == len(media_files) == data["unique_binary_assets"]

    for a in assets:
        assert a.get("source_filename"), f"asset {a['filename']} missing source_filename provenance"
        assert a.get("source_sha256"), f"asset {a['filename']} missing source_sha256 provenance"
        disk_f = media_files[a["filename"]]
        assert a["bytes"] == disk_f.stat().st_size
        actual_sha = hashlib.sha256(disk_f.read_bytes()).hexdigest()
        assert a["sha256"] == actual_sha

    if SOURCE_DIR.exists():
        source_files = {f.name for f in SOURCE_DIR.glob("*") if f.is_file()}
        manifest_sources = {a["source_filename"] for a in assets}
        assert source_files <= manifest_sources, "every media/source/ file must be traceable in the manifest"


def test_published_media_smaller_than_source_when_available():
    """A valid media optimization must not fail merely because the
    optimized files are smaller -- this test *expects* a reduction."""
    if not SOURCE_DIR.exists():
        pytest.skip("media/source/ not present in this environment")
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    total_source = sum(a["source_bytes"] for a in data["assets"])
    total_published = sum(a["bytes"] for a in data["assets"])
    assert total_published < total_source, "published derivatives should be smaller than canonical sources"


def test_canon_regression_locks():
    html = INDEX.read_text(encoding="utf-8")
    assert "170-year" in html or "170 year" in html or "one-hundred-seventy-year" in html.lower()
    assert not re.search(r"\b17-year\b|\bseventeen-year\b|\bYear 17\b", html, re.IGNORECASE)
    assert not re.search(r"\bwilliam\b", html, re.IGNORECASE)


def test_no_duplicate_image_attributes():
    html = INDEX.read_text(encoding="utf-8")
    assert 'decoding="async" decoding="async"' not in html
    assert 'loading="lazy" loading="lazy"' not in html


def test_portable_release_package_is_self_contained(page: Page, tmp_path):
    """tools/package_release.py must produce a ZIP that works completely
    independent of the project directory (UX-023 successor: truthful
    export). Extract it into an unrelated temp dir, serve *that* directory
    alone, and confirm the page and its canon media actually load."""
    out_zip = tmp_path / "release.zip"
    res = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "package_release.py"), "--out", str(out_zip)],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    assert res.returncode == 0, res.stderr
    assert out_zip.exists()

    extract_dir = tmp_path / "extracted"
    extract_dir.mkdir()
    with zipfile.ZipFile(out_zip) as zf:
        zf.extractall(extract_dir)

    assert (extract_dir / "index.html").exists()
    assert (extract_dir / "asset-manifest.json").exists()
    media = list((extract_dir / "assets" / "media").glob("*"))
    assert len(media) > 0

    import http.server
    import socketserver
    import threading

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(extract_dir), **kw)

        def log_message(self, *a):
            pass

    server = socketserver.TCPServer(("127.0.0.1", 0), Handler)
    port = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    try:
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.goto(f"http://127.0.0.1:{port}/index.html")
        page.wait_for_load_state("load")
        # Open a collapsed section first -- images inside it are
        # display:none until opened, by design; loading correctly from
        # a standalone package is what's under test, not visibility.
        page.evaluate("document.getElementById('shard-god').querySelector('details.page-disclosure').open = true")
        # The unified museum entrance sits above the Compendium, so
        # shard-god's native-lazy-loaded image is now well outside the
        # browser's initial lazy-load distance; scroll it into view (as a
        # real reader would) instead of waiting on it from scroll position 0.
        page.locator("#shard-god").scroll_into_view_if_needed()
        page.wait_for_function(
            "document.querySelector('#shard-god .reference-record img, #shard-god .media-item img')?.complete"
        )
        natural_width = page.evaluate("document.querySelector('#shard-god .reference-record img, #shard-god .media-item img').naturalWidth")
        assert natural_width and natural_width > 0, "canon image failed to load from the standalone package"
        assert not errors
    finally:
        server.shutdown()


# ==============================================================================
# BROWSER INTERACTIVE TESTS (PLAYWRIGHT, CHROMIUM)
# ==============================================================================

def test_page_loads_with_zero_js_errors(page: Page, local_server):
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(f"{local_server}/index.html")
    page.wait_for_load_state("domcontentloaded")
    assert len(errors) == 0, f"Uncaught JS errors: {errors}"


def test_no_content_blocking_gate(page: Page, local_server):
    """Nav, controls, title, and cover content must be usable immediately
    -- no artificial delay gated on the hero video reaching 'playing'."""
    page.goto(f"{local_server}/index.html")
    expect(page.locator("#cover h1")).to_be_visible()
    expect(page.locator("#index")).to_be_visible()
    expect(page.locator("#expandAllBtn")).to_be_visible()
    opacity = page.evaluate("parseFloat(getComputedStyle(document.getElementById('index')).opacity)")
    assert opacity == 1
    assert "pre-reveal" not in page.evaluate("document.documentElement.className")
    # Functionality must not depend on the hero video ever reaching 'playing'.
    page.locator("#expandAllBtn").click()
    expect(page.locator("#dao .dossier-grid")).to_be_visible()


def test_attachment_initializer_safety(page: Page, local_server):
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(f"{local_server}/index.html")
    stages_count = page.locator(".attachment-stage").count()
    assert stages_count == 26, f"Expected 26 attachment stages, got {stages_count}"
    assert len(errors) == 0


def test_skip_link_accessibility(page: Page, local_server):
    page.goto(f"{local_server}/index.html")
    skip_link = page.locator(".skip-link")
    page.keyboard.press("Tab")
    expect(skip_link).to_be_focused()
    page.keyboard.press("Enter")
    main_el = page.locator("#mainContent")
    expect(main_el).to_be_focused()


def test_mobile_menu_aria_and_navigation(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto(f"{local_server}/index.html")
    menu_toggle = page.locator("#menuToggle")
    expect(menu_toggle).to_have_attribute("aria-expanded", "false")
    expect(menu_toggle).to_have_attribute("aria-controls", "indexPanel")
    menu_toggle.click()
    expect(menu_toggle).to_have_attribute("aria-expanded", "true")
    index_aside = page.locator("#index")
    expect(index_aside).to_have_class(re.compile(r"\bopen\b"))
    target_link = page.locator('.index nav a[href="#shard-god"]')
    target_link.click()
    expect(menu_toggle).to_have_attribute("aria-expanded", "false")
    expect(index_aside).not_to_have_class(re.compile(r"\bopen\b"))
    target_heading = page.locator("#shard-god").locator("h1, h2, h3").first
    expect(target_heading).to_be_focused()


def test_current_section_wayfinding(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    page.evaluate("document.getElementById('kail').querySelector('details.page-disclosure').open = true")
    page.locator("#kail").scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    kail_nav = page.locator('.index nav a[href="#kail"]')
    expect(kail_nav).to_have_attribute("aria-current", "location")


def test_archive_tools_require_search_phrase_and_do_not_persist(page: Page, local_server):
    """Archive controls stay out of ordinary reading, require the exact
    search-field phrase, and relock instead of persisting across reloads."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    page.evaluate("document.getElementById('archive').querySelector('details.page-disclosure').open = true")

    mode_toggle = page.locator("#modeToggle")
    expect(mode_toggle).to_be_hidden()
    expect(mode_toggle).to_have_attribute("aria-pressed", "false")
    expect(mode_toggle).to_have_text("Archive tools")
    assert "archive-mode" not in page.evaluate("document.documentElement.className")

    file_input = page.locator(".attachment-stage .asset-file").first
    assert page.evaluate("getComputedStyle(document.querySelector('.attachment-stage .asset-file')).display") == "none"

    search = page.locator("#dossierSearch")
    search.fill("AJD")
    expect(mode_toggle).to_be_hidden()
    search.fill("aj")
    expect(mode_toggle).to_be_hidden()
    search.fill("ajd")

    expect(mode_toggle).to_be_visible()
    expect(mode_toggle).to_have_attribute("aria-pressed", "true")
    expect(mode_toggle).to_have_text("Reader mode")
    expect(search).to_have_value("")
    assert "archive-mode" in page.evaluate("document.documentElement.className")
    assert page.evaluate("getComputedStyle(document.querySelector('.attachment-stage .asset-file')).display") != "none"

    mode_toggle.click()
    expect(mode_toggle).to_be_hidden()
    expect(mode_toggle).to_have_attribute("aria-pressed", "false")
    expect(mode_toggle).to_have_text("Archive tools")
    assert "archive-mode" not in page.evaluate("document.documentElement.className")
    assert page.evaluate("getComputedStyle(document.querySelector('.attachment-stage .asset-file')).display") == "none"

    page.reload()
    expect(page.locator("#modeToggle")).to_be_hidden()
    expect(page.locator("#modeToggle")).to_have_attribute("aria-pressed", "false")
    assert "archive-mode" not in page.evaluate("document.documentElement.className")
    assert page.evaluate("localStorage.getItem('starsilk-archive-mode')") is None


def test_attachment_upload_and_status(page: Page, local_server, tmp_path):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    page.locator("#dossierSearch").fill("ajd")
    expect(page.locator("#modeToggle")).to_be_visible()
    test_img = tmp_path / "test.png"
    test_img.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
    status_el = page.locator("#assetStatus")
    expect(status_el).to_have_attribute("role", "status")
    expect(status_el).to_have_attribute("aria-live", "polite")
    expect(status_el).to_contain_text("0 of 26")
    first_input = page.locator(".attachment-stage .asset-file").first
    first_input.set_input_files(str(test_img))
    expect(status_el).to_contain_text("1 of 26")


def test_invalid_attachment_error(page: Page, local_server, tmp_path):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    page.locator("#dossierSearch").fill("ajd")
    expect(page.locator("#modeToggle")).to_be_visible()
    page.evaluate("document.querySelectorAll('details.page-disclosure').forEach(d => d.open = true)")
    test_txt = tmp_path / "test.txt"
    test_txt.write_text("not an image")
    first_stage = page.locator(".attachment-stage").first
    first_input = first_stage.locator(".asset-file")
    first_input.set_input_files(str(test_txt))
    error_el = first_stage.locator(".attachment-error")
    expect(error_el).to_be_visible()
    expect(error_el).to_have_attribute("role", "alert")
    expect(error_el).to_contain_text("Unsupported file format")


def test_clear_cancel_and_confirm(page: Page, local_server, tmp_path):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    page.locator("#dossierSearch").fill("ajd")
    expect(page.locator("#modeToggle")).to_be_visible()
    page.evaluate("document.querySelectorAll('details.page-disclosure').forEach(d => d.open = true)")
    test_img = tmp_path / "test.png"
    test_img.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
    first_stage = page.locator(".attachment-stage").first
    first_input = first_stage.locator(".asset-file")
    first_input.set_input_files(str(test_img))
    status_el = page.locator("#assetStatus")
    expect(status_el).to_contain_text("1 of 26")
    page.once("dialog", lambda dialog: dialog.dismiss())
    page.locator("#clearImages").click()
    expect(status_el).to_contain_text("1 of 26")
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#clearImages").click()
    expect(status_el).to_contain_text("0 of 26")
    canonical_imgs = page.locator(".media-item img")
    assert canonical_imgs.count() > 0
    expect(canonical_imgs.first).to_have_attribute("src", re.compile(r"^assets/media/"))


def test_export_action_truthfully_labeled_and_downloads(page: Page, local_server, tmp_path):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    page.locator("#dossierSearch").fill("ajd")
    expect(page.locator("#modeToggle")).to_be_visible()
    page.evaluate("document.querySelectorAll('details.page-disclosure').forEach(d => d.open = true)")
    export_btn = page.locator("#exportEmbedded")
    expect(export_btn).to_contain_text("Export HTML copy")
    expect(export_btn).to_contain_text("needs assets folder")

    with page.expect_download() as download_info:
        export_btn.click()
    download = download_info.value
    assert download.suggested_filename == "starsilk_character_dossier_copy.html"
    export_dest = tmp_path / download.suggested_filename
    download.save_as(str(export_dest))
    assert export_dest.exists()
    assert export_dest.stat().st_size > 50000
    html_content = export_dest.read_text(encoding="utf-8")
    assert "<!doctype html>" in html_content.lower()
    assert 'id="cover"' in html_content
    assert 'id="shard-god"' in html_content
    assert 'id="marcel"' in html_content
    assert 'class="asset-file"' not in html_content
    assert 'class="asset-toolbar"' not in html_content


def test_watermark_lifecycle_and_reduced_motion(page: Page, local_server):
    page.emulate_media(reduced_motion="reduce")
    page.goto(f"{local_server}/index.html")
    watermark = page.locator("#brandkit-watermark")
    expect(watermark).to_be_hidden()

    page.emulate_media(reduced_motion="no-preference")
    page.goto(f"{local_server}/index.html")
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(200)
    src_attr = watermark.get_attribute("src")
    assert src_attr and "assets/media/" in src_attr

    page.evaluate("""() => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    }""")
    is_paused = page.evaluate("() => document.getElementById('brandkit-watermark').paused")
    assert is_paused is True
    page.evaluate("""() => {
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    }""")


def test_watermark_pauses_while_cover_dominant(page: Page, local_server):
    """Decorative-video lifecycle (item 10): don't run both the hero video
    and the full-bleed watermark at once while the cover is what's on
    screen -- the watermark defers until the reader has actually scrolled
    past the cover."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    page.wait_for_timeout(300)
    paused_at_cover = page.evaluate("document.getElementById('brandkit-watermark').paused")
    assert paused_at_cover is True

    page.locator("#dao").scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    paused_after_scroll = page.evaluate("document.getElementById('brandkit-watermark').paused")
    assert paused_after_scroll is False


def test_desktop_index_scrolling(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 700})
    page.goto(f"{local_server}/index.html")
    index_aside = page.locator("#index")
    box = index_aside.bounding_box()
    assert box is not None
    assert box["height"] <= 700


@pytest.mark.parametrize("width", RESPONSIVE_WIDTHS)
def test_no_sidebar_collision_across_all_viewports(page: Page, local_server, width: int):
    page.set_viewport_size({"width": width, "height": 800})
    page.goto(f"{local_server}/index.html")
    if width > 950:
        index_box = page.locator("#index").bounding_box()
        assert index_box is not None
        sidebar_right = index_box["x"] + index_box["width"]
        pad_left = page.evaluate('() => parseFloat(getComputedStyle(document.querySelector(".page")).paddingLeft)')
        assert pad_left >= 280, f"At width {width}px, padding-left {pad_left}px must be >= 280px to clear sidebar!"
        for sec_id in ["cover", "shard-god", "marcel", "kail", "dao"]:
            sec = page.locator(f"#{sec_id}")
            heading = sec.locator("h1, h2, .eyebrow").first
            box = heading.bounding_box()
            if box:
                assert box["x"] >= sidebar_right, f"At width {width}px, section #{sec_id} heading collides with sidebar!"


def test_print_stylesheet_rules(page: Page, local_server):
    page.emulate_media(media="print")
    page.goto(f"{local_server}/index.html")
    page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
    expect(page.locator("#index")).to_be_hidden()
    expect(page.locator(".asset-toolbar")).to_be_hidden()
    expect(page.locator("#brandkit-watermark")).to_be_hidden()
    expect(page.locator("#cover h1")).to_be_visible()
    expect(page.locator(".warn").first).to_be_visible()
    expect(page.locator("#marcel h2")).to_be_visible()
    expect(page.locator("#drk-the-egg h2")).to_be_visible()
    expect(page.locator(".media-shelf").first).to_be_visible()


def test_sections_collapsed_by_default(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    expect(page.locator("#cover h1")).to_be_visible()
    expect(page.locator("#index")).to_be_visible()
    for sec_id in ("codec", "drk-the-egg", "gorevault", "peripheral-index"):
        details = page.locator(f"#{sec_id} details.page-disclosure")
        expect(details).to_have_count(1)
        assert details.evaluate("el => el.open") is False, f"#{sec_id} should be collapsed by default"
        expect(page.locator(f"#{sec_id} summary.page-title")).to_be_visible()
        expect(page.locator(f"#{sec_id} .dossier-grid")).to_be_hidden()


def test_collapsed_section_compact_height(page: Page, local_server):
    """Collapsed sections must not occupy ~100vh; opening one restores the
    full immersive layout (item 12)."""
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    closed_box = page.locator("#dao").bounding_box()
    assert closed_box is not None
    assert closed_box["height"] < 300, f"Collapsed #dao should be compact, got {closed_box['height']}px"

    page.locator("#dao summary.page-title").click()
    open_box = page.locator("#dao").bounding_box()
    assert open_box["height"] > 700, "An opened section should use the full immersive layout"

    page.locator("#dao summary.page-title").click()
    closed_again = page.locator("#dao").bounding_box()
    assert closed_again["height"] < 300


def test_section_expand_via_summary_click(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    summary = page.locator("#dao summary.page-title")
    body = page.locator("#dao .dossier-grid")
    expect(body).to_be_hidden()
    summary.click()
    expect(body).to_be_visible()
    assert page.locator("#dao details.page-disclosure").evaluate("el => el.open") is True
    summary.click()
    expect(body).to_be_hidden()


def test_anchor_navigation_opens_collapsed_section(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html#marcel")
    body = page.locator("#marcel .dossier-grid")
    expect(body).to_be_visible()
    assert page.locator("#marcel details.page-disclosure").evaluate("el => el.open") is True

    page.goto(f"{local_server}/index.html")
    return_link = page.locator('#drk-abyssoriel a[href="#drakken-registry"]')
    page.evaluate("document.getElementById('drk-abyssoriel').querySelector('details.page-disclosure').open = true")
    expect(return_link).to_be_visible()
    return_link.click()
    registry_details = page.locator("#drakken-registry details.page-disclosure")
    expect(registry_details).to_have_count(1)
    page.wait_for_function(
        "document.querySelector('#drakken-registry details.page-disclosure').open === true"
    )


def test_expand_all_and_collapse_all_buttons(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    bodies = [page.locator(f"#{sid} .dossier-grid") for sid in ("codec", "dao", "jazen", "drk-the-egg")]
    for b in bodies:
        expect(b).to_be_hidden()
    page.locator("#expandAllBtn").click()
    for b in bodies:
        expect(b).to_be_visible()
    still_closed = page.evaluate(
        "Array.from(document.querySelectorAll('details.page-disclosure')).filter(d => !d.open).length"
    )
    assert still_closed == 0
    page.locator("#collapseAllBtn").click()
    for b in bodies:
        expect(b).to_be_hidden()
    still_open = page.evaluate(
        "Array.from(document.querySelectorAll('details.page-disclosure')).filter(d => d.open).length"
    )
    assert still_open == 0


def test_sidebar_collapse_toggle(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    index_aside = page.locator("#index")
    toggle = page.locator("#sidebarToggle")
    expect(index_aside).to_be_visible()
    expect(toggle).to_have_text("Hide index")
    expect(toggle).to_have_attribute("aria-expanded", "true")
    toggle.click()
    expect(index_aside).to_be_hidden()
    expect(toggle).to_have_text("Show index")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    pad_left_collapsed = page.evaluate(
        "parseFloat(getComputedStyle(document.querySelector('.page-controls')).paddingLeft)"
    )
    assert pad_left_collapsed < 200
    page.reload()
    expect(page.locator("#index")).to_be_hidden()
    expect(page.locator("#sidebarToggle")).to_have_text("Show index")
    page.locator("#sidebarToggle").click()
    expect(page.locator("#index")).to_be_visible()


def test_unified_search_titles_and_content(page: Page, local_server):
    """Item 13: one search box does BOTH title/nav filtering and
    full-content search, highlights matches, and reports position."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    search = page.locator("#dossierSearch")
    status = page.locator("#dossierSearchStatus")

    # Title/nav filtering still works.
    search.fill("dao")
    page.wait_for_timeout(250)
    dao_link = page.locator('.index nav a[href="#dao"]')
    marcel_link = page.locator('.index nav a[href="#marcel"]')
    expect(dao_link).to_be_visible()
    expect(marcel_link).to_be_hidden()

    # Full-content search: distinctive Codec-page prose, not a nav label.
    search.fill("Nacreous VI")
    page.wait_for_timeout(250)
    expect(page.locator("#codec .dossier-grid")).to_be_visible()
    expect(page.locator("#codec details.page-disclosure")).to_have_class(re.compile(r"\bsearch-match\b"))
    expect(page.locator("#codec mark.search-hit").first).to_be_visible()
    expect(status).to_contain_text("/")

    search.fill("")
    page.wait_for_timeout(250)
    expect(status).to_have_text("")
    expect(page.locator("#codec details.page-disclosure")).not_to_have_class(re.compile(r"\bsearch-match\b"))
    expect(page.locator("#codec mark.search-hit")).to_have_count(0)

    search.fill("zzz_no_such_dossier_text_zzz")
    page.wait_for_timeout(250)
    expect(status).to_have_text("No matches")


def test_search_result_stepping_and_keyboard(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    search = page.locator("#dossierSearch")
    status = page.locator("#dossierSearchStatus")
    search.fill("the")
    page.wait_for_timeout(250)
    match_count = page.locator("mark.search-hit").count()
    assert match_count > 1, "expected multiple matches for a common word"
    search.press("Enter")
    page.wait_for_timeout(150)
    expect(status).to_contain_text("1 /")
    search.press("Enter")
    page.wait_for_timeout(150)
    expect(status).to_contain_text("2 /")
    search.press("Shift+Enter")
    page.wait_for_timeout(150)
    expect(status).to_contain_text("1 /")


def test_search_state_restoration(page: Page, local_server):
    """Sections opened only because of the search revert on clear; a
    section the reader independently opened stays open (item 13)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    # Manually open #marcel first.
    page.locator("#marcel summary.page-title").click()
    expect(page.locator("#marcel .dossier-grid")).to_be_visible()

    search = page.locator("#dossierSearch")
    search.fill("Nacreous VI")  # matches #codec only
    page.wait_for_timeout(250)
    expect(page.locator("#codec .dossier-grid")).to_be_visible()
    expect(page.locator("#marcel .dossier-grid")).to_be_visible()

    search.fill("")
    page.wait_for_timeout(250)
    expect(page.locator("#codec .dossier-grid")).to_be_hidden(), "search-only-opened section should re-collapse"
    expect(page.locator("#marcel .dossier-grid")).to_be_visible(), "manually-opened section must stay open"


def test_search_does_not_trigger_deep_link_regression(page: Page, local_server):
    """Deep-link navigation keeps working after using search (item 13)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    page.locator("#dossierSearch").fill("Nacreous VI")
    page.wait_for_timeout(250)
    page.locator("#dossierSearch").fill("")
    page.wait_for_timeout(250)
    page.goto(f"{local_server}/index.html#marcel")
    expect(page.locator("#marcel .dossier-grid")).to_be_visible()


def test_cover_title_is_starsilk_compendium(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    h1 = page.locator("#cover h1")
    expect(h1).to_contain_text("Starsilk")
    expect(h1).to_contain_text("Compendium")
    full_text = h1.inner_text()
    assert "Star Silk" not in full_text
    assert "STARSILK" in full_text.upper().replace("\n", "")
    assert page.title() == "Starsilk Compendium"
    assert page.locator("#cover h1 span").count() == 0
    style = page.evaluate("""() => {
        const cs = getComputedStyle(document.querySelector('#cover h1'));
        return {color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight};
    }""")
    assert style["color"] != "rgba(0, 0, 0, 0)" and "transparent" not in style["color"]


@pytest.mark.parametrize("width", [320, 375, 951, 1024, 1280, 1920])
def test_cover_title_stays_on_one_line(page: Page, local_server, width: int):
    page.set_viewport_size({"width": width, "height": 800})
    page.goto(f"{local_server}/index.html")
    rect_count = page.evaluate("""() => {
        const h1 = document.querySelector('#cover h1');
        const range = document.createRange();
        range.selectNodeContents(h1);
        return range.getClientRects().length;
    }""")
    assert rect_count == 1, f"cover title wrapped at {width}px"
    box = page.locator("#cover h1").bounding_box()
    assert box is not None
    viewport_width = page.evaluate("document.documentElement.clientWidth")
    assert box["x"] + box["width"] <= viewport_width + 1, f"cover title overflowed at {width}px"


def test_hero_video_present_and_loops_true_tail(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    video = page.locator("#cover video.hero-video")
    expect(video).to_have_count(1)
    expect(video).to_have_attribute("autoplay", re.compile(r".*"))
    expect(video).to_have_attribute("muted", re.compile(r".*"))
    expect(video).to_have_attribute("playsinline", re.compile(r".*"))
    expect(video).to_have_attribute("aria-hidden", "true")
    src = page.locator("#cover video.hero-video source").get_attribute("src")
    assert src and src.startswith("assets/media/") and src.endswith(".mp4")
    assert page.evaluate("document.querySelector('#cover video.hero-video').muted") is True
    assert page.evaluate("document.querySelector('#cover video.hero-video').playbackRate") == 0.25

    # Wait for REAL metadata (a genuine duration/seekable range -- a video
    # with no loaded media silently ignores currentTime assignment and
    # snaps back to 0, which is why a naive test here proves nothing), then
    # fire 'ended' and prove the handler actually seeks into the TAIL
    # window rather than merely not throwing.
    page.wait_for_function(
        "document.querySelector('#cover video.hero-video').readyState >= 1", timeout=10000
    )
    real_duration = page.evaluate("document.querySelector('#cover video.hero-video').duration")
    assert real_duration and real_duration > 3, f"hero video duration too short to test tail loop: {real_duration}"
    page.evaluate("document.querySelector('#cover video.hero-video').dispatchEvent(new Event('ended'))")
    # Seeking is asynchronous (a 'seeking' -> 'seeked' round trip, possibly
    # involving a new HTTP range request) -- poll instead of a fixed sleep.
    expected = max(0, real_duration - 2.5)
    page.wait_for_function(
        f"Math.abs(document.querySelector('#cover video.hero-video').currentTime - {expected}) < 0.5",
        timeout=10000,
    )
    current_time = page.evaluate("document.querySelector('#cover video.hero-video').currentTime")
    assert abs(current_time - expected) < 0.5, (
        f"expected the tail window (duration {real_duration:.2f} - 2.5s = {expected:.2f}s), got {current_time:.2f}s"
    )


def test_cross_reference_links_point_to_real_entries(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    xref_links = page.locator("a.xref-link")
    count = xref_links.count()
    assert count > 50, f"Expected a substantial number of cross-reference links, got {count}"
    hrefs = page.evaluate(
        "Array.from(document.querySelectorAll('a.xref-link')).map(a => a.getAttribute('href'))"
    )
    for href in hrefs:
        target_id = href.lstrip("#")
        expect(page.locator(f"#{target_id}")).to_have_count(1)
    self_links = page.evaluate(
        "document.querySelectorAll('#codec a.xref-link[href=\"#codec\"]').length"
    )
    assert self_links == 0
    page.evaluate("document.getElementById('dao').querySelector('details.page-disclosure').open = true")
    first_link_in_dao = page.locator('#dao a.xref-link').first
    if first_link_in_dao.count() > 0:
        target_href = first_link_in_dao.get_attribute("href")
        first_link_in_dao.click()
        target_id = target_href.lstrip("#")
        target_details = page.locator(f"#{target_id} details.page-disclosure")
        if target_details.count() > 0:
            assert target_details.evaluate("el => el.open") is True


# ==============================================================================
# NETWORK / MEDIA-LOADING REGRESSION TESTS (item 9, 10 -- Pass D)
# ==============================================================================

def test_initial_load_does_not_fetch_lazy_video_archive(page: Page):
    server, base_url = fresh_server()
    try:
        page.set_viewport_size({"width": 1280, "height": 800})
        requests = []
        page.on("request", lambda req: requests.append(req.url.rsplit("/", 1)[-1]) if req.url.endswith(".mp4") else None)
        page.goto(f"{base_url}/index.html")
        page.wait_for_timeout(1200)
        unexpected = [r for r in requests if r in LAZY_VIDEO_HASHES]
        assert not unexpected, f"Video(s) fetched on initial load before any section opened: {unexpected}"
    finally:
        server.shutdown()


def test_expand_all_does_not_fetch_offscreen_video_archive(page: Page):
    """Item 9: Expand All must not cascade into downloading the entire
    video archive merely because <details> elements became open."""
    server, base_url = fresh_server()
    try:
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto(f"{base_url}/index.html")
        requests = []
        page.on("request", lambda req: requests.append(req.url.rsplit("/", 1)[-1]) if req.url.endswith(".mp4") else None)
        page.locator("#expandAllBtn").click()
        page.wait_for_timeout(1200)
        # Confirm sections genuinely opened (the fix is about NOT fetching,
        # not about failing to expand).
        still_closed = page.evaluate(
            "Array.from(document.querySelectorAll('details.page-disclosure')).filter(d => !d.open).length"
        )
        assert still_closed == 0
        unexpected = [r for r in requests if r in LAZY_VIDEO_HASHES]
        assert not unexpected, f"Expand All fetched video(s) still far off-screen: {unexpected}"
    finally:
        server.shutdown()


def test_search_does_not_fetch_video_archive(page: Page):
    """Item 9: search must not trigger expensive media fetches merely
    because it discovers and opens matching sections."""
    server, base_url = fresh_server()
    try:
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto(f"{base_url}/index.html")
        requests = []
        page.on("request", lambda req: requests.append(req.url.rsplit("/", 1)[-1]) if req.url.endswith(".mp4") else None)
        page.locator("#dossierSearch").fill("archival")
        page.wait_for_timeout(600)
        unexpected = [r for r in requests if r in LAZY_VIDEO_HASHES]
        assert not unexpected, f"Search fetched video(s): {unexpected}"
    finally:
        server.shutdown()


def test_print_preparation_does_not_fetch_video_archive(page: Page):
    """Item 9: print preparation opens every section but must not trigger
    hidden video downloads (videos are display:none in print)."""
    server, base_url = fresh_server()
    try:
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto(f"{base_url}/index.html")
        requests = []
        page.on("request", lambda req: requests.append(req.url.rsplit("/", 1)[-1]) if req.url.endswith(".mp4") else None)
        page.evaluate("window.dispatchEvent(new Event('beforeprint'))")
        page.wait_for_timeout(800)
        unexpected = [r for r in requests if r in LAZY_VIDEO_HASHES]
        assert not unexpected, f"Print preparation fetched video(s): {unexpected}"
    finally:
        server.shutdown()


def test_lazy_video_activates_when_scrolled_near(page: Page):
    """Positive case: a lazy video DOES load once genuinely opened and
    scrolled near -- the fix is about intent/visibility, not permanent
    starvation."""
    server, base_url = fresh_server()
    try:
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto(f"{base_url}/index.html")
        requests = []
        page.on("request", lambda req: requests.append(req.url.rsplit("/", 1)[-1]) if req.url.endswith(".mp4") else None)

        media_vault_video = page.locator("#media-orbital-video-01 video")
        assert media_vault_video.get_attribute("data-lazy-src") is not None

        page.evaluate("document.getElementById('media-vault').querySelector('details.page-disclosure').open = true")
        media_vault_video.scroll_into_view_if_needed()
        page.wait_for_function(
            "!document.querySelector('#media-orbital-video-01 video').hasAttribute('data-lazy-src')",
            timeout=5000,
        )
        assert media_vault_video.get_attribute("src")
        assert len(requests) > 0, "opening + scrolling to the section should trigger the deferred video fetch"
    finally:
        server.shutdown()


# ==============================================================================
# VISUAL REGRESSION (item 19) -- real screenshot comparison, not merely
# behavioral assertions. pytest-playwright's Python API has no built-in
# to_have_screenshot() (that's a JS @playwright/test-only feature), so
# assert_matches_baseline() (tests/conftest.py) does the pixel comparison
# by hand against tests/visual_baselines/. A baseline that doesn't exist
# yet is created from the current render (bootstrap) and passes; delete a
# baseline deliberately to accept an intentional design change.
# ==============================================================================

def _freeze_decorative_video(page: Page):
    """Visual regression captures must be deterministic -- pause and pin
    every autoplaying decorative <video> to a fixed frame before
    screenshotting, so encoder/frame-timing jitter never causes a false
    positive diff."""
    page.evaluate("""() => {
        document.querySelectorAll('video').forEach(v => {
            v.pause();
            try { v.currentTime = 0; } catch (e) {}
        });
    }""")
    page.wait_for_timeout(100)



def _wait_for_visual_assets(page: Page, selector: str):
    """Make visual-regression captures wait for every real image in
    the target section to load and decode. Hidden attachment
    placeholders are intentionally excluded."""
    page.evaluate("""selector => {
        document.querySelectorAll(`${selector} img`).forEach(img => {
            if (img.hidden) return;
            img.loading = 'eager';
            if (!img.getAttribute('src') && img.dataset.lazySrc) {
                img.setAttribute('src', img.dataset.lazySrc);
            }
        });
    }""", selector)
    page.wait_for_function("""selector => Array.from(document.querySelectorAll(`${selector} img`))
        .filter(img => !img.hidden && (img.getAttribute('src') || img.dataset.lazySrc))
        .every(img => img.complete && img.naturalWidth > 0)""", arg=selector, timeout=10_000)
    page.evaluate("""selector => Promise.all(Array.from(document.querySelectorAll(`${selector} img`))
        .filter(img => !img.hidden && img.complete && img.naturalWidth > 0)
        .map(img => img.decode().catch(() => undefined)))""", selector)
    page.wait_for_timeout(50)

def test_visual_cover_desktop(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    page.wait_for_timeout(300)
    _freeze_decorative_video(page)
    assert_matches_baseline(page.screenshot(), "cover-desktop.png")


def test_visual_cover_mobile(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html")
    page.wait_for_timeout(300)
    _freeze_decorative_video(page)
    assert_matches_baseline(page.screenshot(), "cover-mobile.png")


def test_visual_principal_character_page(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    page.evaluate("document.getElementById('dao').querySelector('details.page-disclosure').open = true")
    page.locator("#dao").scroll_into_view_if_needed()
    _wait_for_visual_assets(page, "#dao")
    _freeze_decorative_video(page)
    assert_matches_baseline(page.locator("#dao").screenshot(), "principal-dao.png")


def test_visual_drakken_entry(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    page.evaluate("document.getElementById('drk-the-egg').querySelector('details.page-disclosure').open = true")
    page.locator("#drk-the-egg").scroll_into_view_if_needed()
    _wait_for_visual_assets(page, "#drk-the-egg")
    _freeze_decorative_video(page)
    assert_matches_baseline(page.locator("#drk-the-egg").screenshot(), "drakken-the-egg.png")


def test_visual_peripheral_entry(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    page.evaluate("document.getElementById('peripheral-index').querySelector('details.page-disclosure').open = true")
    page.locator("#peripheral-index").scroll_into_view_if_needed()
    _wait_for_visual_assets(page, "#peripheral-index")
    _freeze_decorative_video(page)
    assert_matches_baseline(page.locator("#peripheral-index").screenshot(), "peripheral-index.png")


def test_visual_media_vault(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    page.evaluate("document.getElementById('media-vault').querySelector('details.page-disclosure').open = true")
    page.locator("#media-vault").scroll_into_view_if_needed()
    _wait_for_visual_assets(page, "#media-vault")
    _freeze_decorative_video(page)
    assert_matches_baseline(page.locator("#media-vault").screenshot(), "media-vault.png")


def test_visual_reduced_motion(page: Page, local_server):
    page.emulate_media(reduced_motion="reduce")
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    page.wait_for_timeout(300)
    _freeze_decorative_video(page)
    assert_matches_baseline(page.screenshot(), "cover-reduced-motion.png")
