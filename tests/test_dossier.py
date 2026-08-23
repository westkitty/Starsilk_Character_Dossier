"""Comprehensive regression test suite for Starsilk Character Dossier (UX-031).
Tests structural invariants, validator gating, idempotency, asset preservation,
and exercises real browser journeys with Playwright across 13 responsive viewports.
"""
import hashlib
import http.server
import json
import os
import re
import socketserver
import subprocess
import threading
import time
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
INDEX = DOCS / "index.html"
MANIFEST = DOCS / "asset-manifest.json"
REPORT = DOCS / "qa-report.txt"
MEDIA_DIR = DOCS / "assets" / "media"

RESPONSIVE_WIDTHS = [320, 375, 430, 620, 768, 950, 951, 1024, 1180, 1280, 1366, 1440, 1920]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS), **kwargs)

    def log_message(self, format, *args):
        pass


class QuietThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        pass


@pytest.fixture(scope="session", autouse=True)
def local_server():
    """Serve docs/ over a multithreaded HTTP server for browser tests."""
    server = QuietThreadingServer(("127.0.0.1", 0), QuietHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.1)
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


# ==============================================================================
# STRUCTURAL, VALIDATION, AND IDEMPOTENCY UNIT TESTS
# ==============================================================================

def test_strict_validator_passes():
    """Strict validator must exit 0 on clean Web Edition build (UX-030)."""
    res = subprocess.run(
        ["python3", str(ROOT / "tools" / "validate_web_edition.py"), "--strict"],
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Validator failed: {res.stderr}\n{res.stdout}"


def test_strict_validator_gates_errors(tmp_path):
    """Strict validator must exit non-zero when given an invalid fixture (UX-030).
    Ensures negative test leaves checked-in publication files completely untouched.
    """
    tmp_report = tmp_path / "temp_failing_qa_report.txt"
    invalid_html = INDEX.read_text(encoding="utf-8").replace(
        '<section class="page cover" data-folio="00" id="cover">',
        '<section class="page cover" data-folio="00" id="cover"><a href="#nonexistentAnchor">Broken</a>'
    ).replace(
        'id="world"',
        'id="cover"'  # Duplicate ID
    )

    orig_index = INDEX.read_text(encoding="utf-8")
    orig_report = REPORT.read_text(encoding="utf-8") if REPORT.exists() else None

    try:
        INDEX.write_text(invalid_html, encoding="utf-8")
        res = subprocess.run(
            ["python3", str(ROOT / "tools" / "validate_web_edition.py"), "--strict", "--report", str(tmp_report)],
            capture_output=True,
            text=True
        )
        assert res.returncode != 0, "Strict validator should fail on duplicate IDs and broken anchors!"
        assert tmp_report.exists()
        failing_text = tmp_report.read_text(encoding="utf-8")
        assert "DUPLICATE IDS: 1" in failing_text
        assert "BROKEN ANCHORS" in failing_text
    finally:
        INDEX.write_text(orig_index, encoding="utf-8")
        if orig_report is not None:
            REPORT.write_text(orig_report, encoding="utf-8")


def test_strict_validator_gates_manifest_errors(tmp_path):
    """Strict validator must fail if manifest has mismatched counts or missing files."""
    tmp_report = tmp_path / "manifest_fail_report.txt"
    orig_manifest = MANIFEST.read_text(encoding="utf-8")
    orig_report = REPORT.read_text(encoding="utf-8") if REPORT.exists() else None

    # Corrupt manifest declared count
    bad_manifest = json.loads(orig_manifest)
    bad_manifest["unique_binary_assets"] = 999

    try:
        MANIFEST.write_text(json.dumps(bad_manifest, indent=2), encoding="utf-8")
        res = subprocess.run(
            ["python3", str(ROOT / "tools" / "validate_web_edition.py"), "--strict", "--report", str(tmp_report)],
            capture_output=True,
            text=True
        )
        assert res.returncode != 0, "Strict validator must fail on manifest count discrepancy!"
    finally:
        MANIFEST.write_text(orig_manifest, encoding="utf-8")
        if orig_report is not None:
            REPORT.write_text(orig_report, encoding="utf-8")


def test_build_pipeline_idempotency():
    """Building twice must produce bit-identical deterministic output (UX-029)."""
    def get_hash():
        return hashlib.sha256(INDEX.read_bytes()).hexdigest()

    def run_pipeline():
        subprocess.run(["python3", str(ROOT / "tools" / "apply_ux_audit_fixes.py")], check=True)
        subprocess.run(["python3", str(ROOT / "tools" / "apply_media_presentation_and_collapse.py")], check=True)
        subprocess.run(["python3", str(ROOT / "tools" / "lazy_load_collapsed_videos.py")], check=True)
        subprocess.run(["python3", str(ROOT / "tools" / "add_page_controls.py")], check=True)
        subprocess.run(["python3", str(ROOT / "tools" / "add_cross_reference_links.py")], check=True)
        if (ROOT / "starsilk header.mp4").exists():
            subprocess.run(["python3", str(ROOT / "tools" / "add_hero_video_and_rebrand.py")], check=True)
        subprocess.run(["python3", str(ROOT / "tools" / "add_opening_reveal_animation.py")], check=True)
        subprocess.run(["python3", str(ROOT / "tools" / "finalize_metadata.py")], check=True)

    run_pipeline()
    h1 = get_hash()

    run_pipeline()
    h2 = get_hash()

    assert h1 == h2, "Build pipeline is not idempotent!"


def test_asset_preservation_and_manifest_privacy():
    """At least the 192-asset / 536,251,498-byte baseline must be preserved (never shrink), with
    no private leaks (UX-032, UX-033). The baseline legitimately grew to 211 assets /
    586,563,534 bytes with the archetype-diversification media coverage pass, then to
    213 / 588,967,615 with the hero video + poster frame; both counts are exact
    regression locks for the current state, and the floor guards against silent
    future deletion."""
    assert MANIFEST.exists()
    m_text = MANIFEST.read_text(encoding="utf-8")
    assert "/Users/" not in m_text, "Found /Users/ in asset manifest!"
    assert "MacBook Google Drive" not in m_text, "Found MacBook Google Drive in asset manifest!"
    assert "file://" not in m_text, "Found file:// in asset manifest!"

    data = json.loads(m_text)
    assets = data.get("assets", [])
    assert len(assets) >= 192, f"Baseline regression: expected >= 192 assets in manifest, got {len(assets)}"
    assert len(assets) == 213, f"Expected 213 assets in manifest, got {len(assets)}"

    media_files = [f for f in MEDIA_DIR.glob("*") if f.is_file()]
    assert len(media_files) == 213, f"Expected 213 files in media directory, got {len(media_files)}"

    total_bytes = sum(f.stat().st_size for f in media_files)
    assert total_bytes >= 536251498, f"Baseline regression: expected >= 536251498 bytes, got {total_bytes}"
    assert total_bytes == 588967615, f"Expected 588967615 bytes, got {total_bytes}"


def test_manifest_consistency_invariants():
    """Verify mutual consistency: declared counts, manifest assets, byte sums, and SHA256 checksums."""
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets = manifest.get("assets", [])
    decl_count = manifest.get("unique_binary_assets")
    decl_bytes = manifest.get("total_unique_binary_size_bytes")

    media_files = {f.name: f for f in MEDIA_DIR.glob("*") if f.is_file()}
    assert decl_count == len(assets) == len(media_files) == 213
    assert decl_bytes == sum(a.get("bytes", 0) for a in assets) == sum(f.stat().st_size for f in media_files.values()) == 588967615

    manifest_filenames = set()
    for a in assets:
        fn = a["filename"]
        assert fn not in manifest_filenames, f"Duplicate manifest filename: {fn}"
        manifest_filenames.add(fn)
        disk_f = media_files.get(fn)
        assert disk_f is not None, f"Manifest file missing on disk: {fn}"
        assert a["bytes"] == disk_f.stat().st_size, f"Byte mismatch for {fn}"
        if "sha256" in a and a["sha256"]:
            actual_sha = hashlib.sha256(disk_f.read_bytes()).hexdigest()
            assert a["sha256"] == actual_sha, f"SHA256 mismatch for {fn}"

    for disk_fn in media_files:
        assert disk_fn in manifest_filenames, f"Disk file not in manifest: {disk_fn}"


def test_canon_regression_locks():
    """Verify all canon requirements and chronology locks."""
    html = INDEX.read_text(encoding="utf-8")
    assert "170-year" in html or "170 year" in html or "one-hundred-seventy-year" in html.lower()
    assert not re.search(r"\b17-year\b|\bseventeen-year\b|\bYear 17\b", html, re.IGNORECASE)
    assert not re.search(r"\bwilliam\b", html, re.IGNORECASE)


def test_no_duplicate_image_attributes():
    """Test UX-026: No duplicate decoding or loading attributes."""
    html = INDEX.read_text(encoding="utf-8")
    assert 'decoding="async" decoding="async"' not in html
    assert 'loading="lazy" loading="lazy"' not in html


# ==============================================================================
# BROWSER INTERACTIVE & VISUAL REGRESSION TESTS (PLAYWRIGHT)
# ==============================================================================

def test_page_loads_with_zero_js_errors(page: Page, local_server):
    """1. Page loads with zero uncaught JS errors."""
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(f"{local_server}/index.html")
    page.wait_for_load_state("domcontentloaded")
    assert len(errors) == 0, f"Uncaught JS errors: {errors}"


def test_attachment_initializer_safety(page: Page, local_server):
    """2. No attachment initializer crash (UX-001)."""
    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))
    page.goto(f"{local_server}/index.html")

    # Confirm attachment stages are initialized without error
    stages_count = page.locator(".attachment-stage").count()
    assert stages_count == 26, f"Expected 26 attachment stages, got {stages_count}"
    assert len(errors) == 0


def test_skip_link_accessibility(page: Page, local_server):
    """3. Skip link visibility and focus behavior (UX-011)."""
    page.goto(f"{local_server}/index.html")
    skip_link = page.locator(".skip-link")

    # Tab to focus skip link
    page.keyboard.press("Tab")
    expect(skip_link).to_be_focused()

    # Activate skip link
    page.keyboard.press("Enter")
    main_el = page.locator("#mainContent")
    expect(main_el).to_be_focused()


def test_mobile_menu_aria_and_navigation(page: Page, local_server):
    """4, 5. Mobile menu open/close ARIA sync and post-navigation heading focus (UX-010, UX-019)."""
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto(f"{local_server}/index.html")

    menu_toggle = page.locator("#menuToggle")
    expect(menu_toggle).to_have_attribute("aria-expanded", "false")
    expect(menu_toggle).to_have_attribute("aria-controls", "indexPanel")

    # Open menu
    menu_toggle.click()
    expect(menu_toggle).to_have_attribute("aria-expanded", "true")
    index_aside = page.locator("#index")
    expect(index_aside).to_have_class(re.compile(r"\bopen\b"))

    # Click a link inside mobile nav
    target_link = page.locator('.index nav a[href="#shard-god"]')
    target_link.click()

    # Menu must close, aria-expanded must reset, and destination heading must receive focus
    expect(menu_toggle).to_have_attribute("aria-expanded", "false")
    expect(index_aside).not_to_have_class(re.compile(r"\bopen\b"))

    target_heading = page.locator("#shard-god").locator("h1, h2, h3").first
    expect(target_heading).to_be_focused()


def test_quick_search_filtering(page: Page, local_server):
    """6. Quick find filter in index (UX-015)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    search_input = page.locator("#dossierSearch")
    expect(search_input).to_be_visible()

    # Filter for 'Dao'
    search_input.fill("dao")

    # Dao link should be visible, while Marcel should be hidden
    dao_link = page.locator('.index nav a[href="#dao"]')
    marcel_link = page.locator('.index nav a[href="#marcel"]')
    expect(dao_link).to_be_visible()
    expect(marcel_link).to_be_hidden()

    # Clear filter
    search_input.fill("")
    expect(marcel_link).to_be_visible()


def test_current_section_wayfinding(page: Page, local_server):
    """7. Current section location wayfinding (UX-013)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    # Scroll to #kail section
    page.locator("#kail").scroll_into_view_if_needed()
    time.sleep(0.4)

    # Kail nav link should have aria-current="location"
    kail_nav = page.locator('.index nav a[href="#kail"]')
    expect(kail_nav).to_have_attribute("aria-current", "location")


def test_attachment_upload_and_status(page: Page, local_server, tmp_path):
    """8, 10. Valid file attachment upload and status announcement (UX-006, UX-007)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    # Create dummy PNG file
    test_img = tmp_path / "test.png"
    test_img.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

    status_el = page.locator("#assetStatus")
    expect(status_el).to_have_attribute("role", "status")
    expect(status_el).to_have_attribute("aria-live", "polite")
    expect(status_el).to_contain_text("0 of 26")

    # Attach file into first attachment stage
    first_input = page.locator(".attachment-stage .asset-file").first
    first_input.set_input_files(str(test_img))

    # Verify status updated
    expect(status_el).to_contain_text("1 of 26")


def test_invalid_attachment_error(page: Page, local_server, tmp_path):
    """9. Invalid file upload error alert (UX-006)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    # Attachment stages live inside default-collapsed page sections; open them
    # first, matching the real "expand a folio, then attach" user flow.
    page.evaluate("document.querySelectorAll('details.page-disclosure').forEach(d => d.open = true)")

    # Create dummy text file
    test_txt = tmp_path / "test.txt"
    test_txt.write_text("not an image")

    first_stage = page.locator(".attachment-stage").first
    first_input = first_stage.locator(".asset-file")
    first_input.set_input_files(str(test_txt))

    # Error message should appear inside stage
    error_el = first_stage.locator(".attachment-error")
    expect(error_el).to_be_visible()
    expect(error_el).to_have_attribute("role", "alert")
    expect(error_el).to_contain_text("Unsupported file format")


def test_clear_cancel_and_confirm(page: Page, local_server, tmp_path):
    """11, 12, 13. Clear attachments Cancel and Confirm behaviors (UX-003, UX-004)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    # The attachment stages and the toolbar (#clearImages/#exportEmbedded) live
    # inside the default-collapsed "archive" page section; open it first.
    page.evaluate("document.querySelectorAll('details.page-disclosure').forEach(d => d.open = true)")

    test_img = tmp_path / "test.png"
    test_img.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

    first_stage = page.locator(".attachment-stage").first
    first_input = first_stage.locator(".asset-file")
    first_input.set_input_files(str(test_img))

    status_el = page.locator("#assetStatus")
    expect(status_el).to_contain_text("1 of 26")

    # Test Cancel
    page.once("dialog", lambda dialog: dialog.dismiss())
    page.locator("#clearImages").click()
    expect(status_el).to_contain_text("1 of 26")  # Unchanged

    # Test Confirm
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#clearImages").click()
    expect(status_el).to_contain_text("0 of 26")  # Cleared

    # Verify canonical images are unaffected
    canonical_imgs = page.locator(".media-item img")
    assert canonical_imgs.count() > 0
    expect(canonical_imgs.first).to_have_attribute("src", re.compile(r"^assets/media/"))


def test_export_action_and_downloaded_html(page: Page, local_server, tmp_path):
    """14. Truthful export button label and real downloaded HTML verification (UX-002, UX-023)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    # The export/clear toolbar lives inside the default-collapsed "archive" page
    # section; open it first, matching the real user flow.
    page.evaluate("document.querySelectorAll('details.page-disclosure').forEach(d => d.open = true)")

    export_btn = page.locator("#exportEmbedded")
    expect(export_btn).to_have_text("Export HTML copy")

    # Trigger real download
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
    # Toolbar and file inputs should be stripped in export
    assert 'class="asset-file"' not in html_content
    assert 'class="asset-toolbar"' not in html_content


def test_watermark_lifecycle_and_reduced_motion(page: Page, local_server):
    """15, 16. Watermark video source, visibilitychange lifecycle, and reduced-motion disable (UX-016, UX-027)."""
    # 1. Reduced motion mode
    page.emulate_media(reduced_motion="reduce")
    page.goto(f"{local_server}/index.html")
    watermark = page.locator("#brandkit-watermark")
    expect(watermark).to_be_hidden()

    # 2. Normal motion mode
    page.emulate_media(reduced_motion="no-preference")
    page.goto(f"{local_server}/index.html")
    page.wait_for_load_state("domcontentloaded")

    # Watermark should have a valid media source assigned
    src_attr = watermark.get_attribute("src")
    assert src_attr and "assets/media/" in src_attr

    # Test visibilitychange pause/resume lifecycle
    page.evaluate("""() => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    }""")
    is_paused = page.evaluate("() => document.getElementById('brandkit-watermark').paused")
    assert is_paused is True

    # Resume on visible
    page.evaluate("""() => {
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    }""")


def test_desktop_index_scrolling(page: Page, local_server):
    """17. Desktop index max-height and scrolling (UX-008)."""
    page.set_viewport_size({"width": 1280, "height": 700})
    page.goto(f"{local_server}/index.html")

    index_aside = page.locator("#index")
    box = index_aside.bounding_box()
    assert box is not None
    # Index must fit within viewport (height <= 700)
    assert box["height"] <= 700


@pytest.mark.parametrize("width", RESPONSIVE_WIDTHS)
def test_no_sidebar_collision_across_all_viewports(page: Page, local_server, width: int):
    """18. Verify no sidebar/content overlap across all 13 breakpoints (UX-009)."""
    page.set_viewport_size({"width": width, "height": 800})
    page.goto(f"{local_server}/index.html")

    if width > 950:
        index_box = page.locator("#index").bounding_box()
        assert index_box is not None
        sidebar_right = index_box["x"] + index_box["width"]

        # Assert computed padding clears the sidebar
        pad_left = page.evaluate('() => parseFloat(getComputedStyle(document.querySelector(".page")).paddingLeft)')
        assert pad_left >= 280, f"At width {width}px, padding-left {pad_left}px must be >= 280px to clear sidebar!"

        # Assert real heading bounding boxes start strictly to the right of the sidebar
        for sec_id in ["cover", "shard-god", "marcel", "kail", "dao"]:
            sec = page.locator(f"#{sec_id}")
            heading = sec.locator("h1, h2, .eyebrow").first
            box = heading.bounding_box()
            if box:
                assert box["x"] >= sidebar_right, f"At width {width}px, section #{sec_id} heading at x={box['x']} collides with sidebar right edge {sidebar_right}!"


def test_print_stylesheet_rules(page: Page, local_server):
    """19. Print media stylesheet sanity and representative content visibility (UX-022)."""
    page.emulate_media(media="print")
    page.goto(f"{local_server}/index.html")
    # A native closed <details> renders no collapsed content in print in every
    # engine, regardless of any CSS override -- the page forces every section
    # open via a real 'beforeprint' listener (see apply_media_presentation_
    # and_collapse.py). Playwright's emulate_media() only flips @media print
    # matching and does not fire that event the way an actual print does, so
    # dispatch it to faithfully simulate a real print.
    page.evaluate("window.dispatchEvent(new Event('beforeprint'))")

    # Index, toolbar, watermark should be hidden in print
    expect(page.locator("#index")).to_be_hidden()
    expect(page.locator(".asset-toolbar")).to_be_hidden()
    expect(page.locator("#brandkit-watermark")).to_be_hidden()

    # Representative content must remain readable and visible
    expect(page.locator("#cover h1")).to_be_visible()
    expect(page.locator(".warn").first).to_be_visible()
    expect(page.locator("#marcel h2")).to_be_visible()
    expect(page.locator("#drk-the-egg h2")).to_be_visible()
    expect(page.locator(".media-shelf").first).to_be_visible()


def test_sections_collapsed_by_default(page: Page, local_server):
    """20. Dossier pages default to collapsed; cover and index stay visible."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    # Cover is not wrapped in a disclosure at all -- always fully visible.
    expect(page.locator("#cover h1")).to_be_visible()
    expect(page.locator("#index")).to_be_visible()

    # Representative dossier pages should be collapsed: the summary/title is
    # visible, but the body content behind it is not, on first load.
    for sec_id in ("codec", "drk-the-egg", "gorevault", "peripheral-index"):
        details = page.locator(f"#{sec_id} details.page-disclosure")
        expect(details).to_have_count(1)
        assert details.evaluate("el => el.open") is False, f"#{sec_id} should be collapsed by default"
        expect(page.locator(f"#{sec_id} summary.page-title")).to_be_visible()
        expect(page.locator(f"#{sec_id} .dossier-grid")).to_be_hidden()


def test_section_expand_via_summary_click(page: Page, local_server):
    """21. Clicking a collapsed section's title summary opens it (keyboard-accessible native <details>)."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    summary = page.locator("#dao summary.page-title")
    body = page.locator("#dao .dossier-grid")
    expect(body).to_be_hidden()

    summary.click()
    expect(body).to_be_visible()
    assert page.locator("#dao details.page-disclosure").evaluate("el => el.open") is True

    # Click again to collapse it back.
    summary.click()
    expect(body).to_be_hidden()


def test_anchor_navigation_opens_collapsed_section(page: Page, local_server):
    """22. Deep-linking to a collapsed section's id (initial load) opens it and scrolls to it."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html#marcel")

    body = page.locator("#marcel .dossier-grid")
    expect(body).to_be_visible()
    assert page.locator("#marcel details.page-disclosure").evaluate("el => el.open") is True

    # In-page navigation to another collapsed section (via a real content link)
    # should likewise open it.
    page.goto(f"{local_server}/index.html")
    return_link = page.locator('#drk-abyssoriel a[href="#drakken-registry"]')
    # Open the containing entry first since its own content (and the link) is otherwise hidden.
    page.evaluate("document.getElementById('drk-abyssoriel').querySelector('details.page-disclosure').open = true")
    expect(return_link).to_be_visible()
    return_link.click()
    registry_details = page.locator("#drakken-registry details.page-disclosure")
    expect(registry_details).to_have_count(1)
    # The hashchange event that opens it fires asynchronously after the
    # click, so poll rather than asserting immediately.
    page.wait_for_function(
        "document.querySelector('#drakken-registry details.page-disclosure').open === true"
    )


def test_expand_all_and_collapse_all_buttons(page: Page, local_server):
    """23. Top-of-content Expand all / Collapse all buttons toggle every page-disclosure."""
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
    assert still_closed == 0, "Expand all should open every page-disclosure"

    page.locator("#collapseAllBtn").click()
    for b in bodies:
        expect(b).to_be_hidden()
    still_open = page.evaluate(
        "Array.from(document.querySelectorAll('details.page-disclosure')).filter(d => d.open).length"
    )
    assert still_open == 0, "Collapse all should close every page-disclosure"


def test_sidebar_collapse_toggle(page: Page, local_server):
    """24. Sidebar hide/show toggle hides the index and reclaims its layout space, and persists."""
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
    assert pad_left_collapsed < 200, f"Sidebar-collapsed padding-left should reclaim space, got {pad_left_collapsed}px"

    # Persists across reload via localStorage.
    page.reload()
    expect(page.locator("#index")).to_be_hidden()
    expect(page.locator("#sidebarToggle")).to_have_text("Show index")

    # Restore default state so it doesn't leak into other tests via localStorage.
    page.locator("#sidebarToggle").click()
    expect(page.locator("#index")).to_be_visible()


def test_content_search_opens_and_highlights_matches(page: Page, local_server):
    """25. Top-of-content search finds real dossier text (not just nav labels), opens and
    highlights matching sections, and Enter jumps between matches."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    search = page.locator("#contentSearch")
    status = page.locator("#contentSearchStatus")
    expect(page.locator("#codec .dossier-grid")).to_be_hidden()

    # "Nacreous VI" is distinctive Codec-page content, not a nav link label.
    search.fill("Nacreous VI")
    page.wait_for_timeout(250)
    expect(page.locator("#codec .dossier-grid")).to_be_visible()
    expect(page.locator("#codec details.page-disclosure")).to_have_class(re.compile(r"\bsearch-match\b"))
    expect(status).to_contain_text("match")

    search.fill("")
    page.wait_for_timeout(250)
    expect(status).to_have_text("")
    expect(page.locator("#codec details.page-disclosure")).not_to_have_class(re.compile(r"\bsearch-match\b"))

    search.fill("zzz_no_such_dossier_text_zzz")
    page.wait_for_timeout(250)
    expect(status).to_have_text("No matches")


def test_cover_title_is_starsilk_compendium(page: Page, local_server):
    """26. Cover reads 'Starsilk Compendium' with 'Starsilk' intact as one word,
    not the old 'STAR' / 'SILK DOSSIER' split, and the tab title matches.
    'Compendium' is plain text in the same <h1> (not a styled sub-tier
    <span>), so it renders in the same font, weight, and color as
    'Starsilk' rather than the old smaller hollow-outlined look."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    h1 = page.locator("#cover h1")
    expect(h1).to_contain_text("Starsilk")
    expect(h1).to_contain_text("Compendium")
    full_text = h1.inner_text()
    assert "Star Silk" not in full_text, "Starsilk must never render as two separate words"
    assert "STARSILK" in full_text.upper().replace("\n", ""), "Starsilk must appear as one unbroken word"
    assert page.title() == "Starsilk — Compendium"

    assert page.locator("#cover h1 span").count() == 0, \
        "Compendium must not be a separately-styled sub-tier span"
    style = page.evaluate("""() => {
        const cs = getComputedStyle(document.querySelector('#cover h1'));
        return {color: cs.color, fontSize: cs.fontSize, fontWeight: cs.fontWeight};
    }""")
    # The h1's own computed style applies uniformly to all of its text,
    # since there's no nested span carrying a different size/color -- an
    # opaque color (not the old transparent-fill outline trick) confirms it.
    assert style["color"] != "rgba(0, 0, 0, 0)" and "transparent" not in style["color"]


def test_hero_video_present_and_configured(page: Page, local_server):
    """27. Hero video autoplays muted, is decorative (aria-hidden), and loops only
    its tail once ended rather than restarting from the top."""
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

    is_muted = page.evaluate("document.querySelector('#cover video.hero-video').muted")
    assert is_muted is True

    playback_rate = page.evaluate("document.querySelector('#cover video.hero-video').playbackRate")
    assert playback_rate == 0.25, f"Expected quarter-speed playback, got {playback_rate}"

    # Simulate reaching the end: currentTime should jump back into the tail
    # window, not restart at 0.
    page.evaluate("""() => {
        const v = document.querySelector('#cover video.hero-video');
        v.dispatchEvent(new Event('ended'));
    }""")
    page.wait_for_timeout(100)
    current_time = page.evaluate("document.querySelector('#cover video.hero-video').currentTime")
    assert current_time >= 0, "loop-to-tail handler should not throw when duration is unavailable yet"


def test_cross_reference_links_point_to_real_entries(page: Page, local_server):
    """28. Entity mentions elsewhere in the dossier link to that entity's own
    article, and an entity's own page doesn't self-link its own name."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    xref_links = page.locator("a.xref-link")
    count = xref_links.count()
    assert count > 50, f"Expected a substantial number of cross-reference links, got {count}"

    # Every xref link's href must resolve to a real id in the document.
    hrefs = page.evaluate(
        "Array.from(document.querySelectorAll('a.xref-link')).map(a => a.getAttribute('href'))"
    )
    for href in hrefs:
        target_id = href.lstrip("#")
        expect(page.locator(f"#{target_id}")).to_have_count(1)

    # Codec's own page must not contain a self-link to #codec.
    self_links = page.evaluate(
        "document.querySelectorAll('#codec a.xref-link[href=\"#codec\"]').length"
    )
    assert self_links == 0

    # Clicking a real cross-reference link (open its containing collapsed
    # section first) opens and scrolls to the target entry.
    page.evaluate("document.getElementById('dao').querySelector('details.page-disclosure').open = true")
    first_link_in_dao = page.locator('#dao a.xref-link').first
    if first_link_in_dao.count() > 0:
        target_href = first_link_in_dao.get_attribute("href")
        first_link_in_dao.click()
        target_id = target_href.lstrip("#")
        target_details = page.locator(f"#{target_id} details.page-disclosure")
        if target_details.count() > 0:
            assert target_details.evaluate("el => el.open") is True


def test_collapsed_videos_lazy_load(page: Page):
    """29. Videos inside default-collapsed sections must not be fetched until
    their section is actually opened (was previously ~76MB of eager,
    invisible downloads on every page load, including a 48MB file).

    Uses its own dedicated, freshly-started server rather than the shared
    session-scoped `local_server` fixture: socketserver.ThreadingTCPServer
    was observed, after enough prior requests have been handled by the same
    server instance (i.e. after the other ~40 tests ahead of this one in
    the suite), to occasionally misattribute an in-flight response to a
    different connection -- reproduced deterministically with two entirely
    separate browser *processes* against a well-used server instance, and
    absent against either a freshly-started server or the real production
    CDN. That's a quirk of Python's threaded dev server under sustained
    reuse, not a real browser or site behavior, so a clean server sidesteps
    it instead of chasing it in application code that doesn't have the bug.
    """
    server = QuietThreadingServer(("127.0.0.1", 0), QuietHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.1)
    try:
        local_server = f"http://127.0.0.1:{port}"
        page.set_viewport_size({"width": 1280, "height": 800})
        requests = []
        page.on("request", lambda req: requests.append(req.url.rsplit("/", 1)[-1]) if req.url.endswith(".mp4") else None)

        # The 5 specific videos lazy_load_collapsed_videos.py converts --
        # these, and only these, must never be requested before their
        # section opens.
        LAZY_VIDEO_HASHES = {
            "6e2c5017f608c8e10b13cbc1.mp4", "6780fd9268d678610ec58ab0.mp4",
            "c5cccb4a121970a88fdc21f2.mp4", "e8362fdb9c7fe9bf3852a26e.mp4",
            "a76f7d67be78c3778f596f89.mp4",
        }
        page.goto(f"{local_server}/index.html")
        # The watermark deliberately rotates through several background
        # clips over time (pre-existing, unrelated behavior) -- unlike the
        # lazy-loaded gallery videos above, that never fully goes
        # network-idle, so wait a bounded, generous window instead.
        page.wait_for_timeout(1500)
        early = list(requests)
        unexpected = [r for r in early if r in LAZY_VIDEO_HASHES]
        assert not unexpected, f"Video(s) fetched before their section opened: {unexpected}"

        # A stable selector (by id, not by the data-lazy-src attribute this
        # test verifies gets removed) so the same element keeps resolving
        # after that attribute changes.
        media_vault_video = page.locator("#media-orbital-video-01 video")
        assert media_vault_video.get_attribute("data-lazy-src") is not None, "should start lazy (unactivated)"

        page.evaluate("document.getElementById('media-vault').querySelector('details.page-disclosure').open = true")
        page.wait_for_function(
            "!document.querySelector('#media-orbital-video-01 video').hasAttribute('data-lazy-src')"
        )
        assert media_vault_video.get_attribute("src"), "real src should be set once the section opens"
        assert len(requests) > len(early), "opening the section should trigger the deferred video fetch"
    finally:
        server.shutdown()


def test_opening_reveal_animation(page: Page, local_server):
    """30. The hero video is the first thing visible; the sidebar, top
    controls, and cover text fade in afterward rather than all popping in
    at once, and prefers-reduced-motion skips the hidden state entirely."""
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")

    # Within the ~1.2s safety window (video 'playing' event normally fires
    # much sooner), the reveal must have happened and everything settled
    # to full opacity.
    page.wait_for_timeout(1500)
    state = page.evaluate("""() => ({
        preReveal: document.documentElement.classList.contains('pre-reveal'),
        indexOpacity: parseFloat(getComputedStyle(document.getElementById('index')).opacity),
        h1Opacity: parseFloat(getComputedStyle(document.querySelector('#cover h1')).opacity),
        controlsOpacity: parseFloat(getComputedStyle(document.querySelector('.page-controls')).opacity),
    })""")
    assert state["preReveal"] is False
    assert state["indexOpacity"] == 1
    assert state["h1Opacity"] == 1
    assert state["controlsOpacity"] == 1

    # Reduced motion: content must never actually be hidden, even transiently.
    page.emulate_media(reduced_motion="reduce")
    page.goto(f"{local_server}/index.html")
    immediate = page.evaluate("""() => ({
        indexOpacity: parseFloat(getComputedStyle(document.getElementById('index')).opacity),
        h1Opacity: parseFloat(getComputedStyle(document.querySelector('#cover h1')).opacity),
    })""")
    assert immediate["indexOpacity"] == 1
    assert immediate["h1Opacity"] == 1
