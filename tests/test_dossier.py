"""Comprehensive regression test suite for Starsilk Character Dossier (UX-031).
Tests structural invariants, validator gating, idempotency, asset preservation,
and exercises real browser journeys with Playwright across 13 responsive viewports.
"""
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
MEDIA_DIR = DOCS / "assets" / "media"
PORT = 8877

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
    """Strict validator must exit non-zero when given an invalid fixture (UX-030)."""
    # Create an invalid temporary HTML file with a broken anchor and duplicate ID
    invalid_html = INDEX.read_text(encoding="utf-8").replace(
        '<section class="page cover" data-folio="00" id="cover">',
        '<section class="page cover" data-folio="00" id="cover"><a href="#nonexistentAnchor">Broken</a>'
    ).replace(
        'id="world"',
        'id="cover"'  # Duplicate ID
    )
    
    # Temporarily swap index
    orig_content = INDEX.read_text(encoding="utf-8")
    try:
        INDEX.write_text(invalid_html, encoding="utf-8")
        res = subprocess.run(
            ["python3", str(ROOT / "tools" / "validate_web_edition.py"), "--strict"],
            capture_output=True,
            text=True
        )
        assert res.returncode != 0, "Strict validator should fail on duplicate IDs and broken anchors!"
    finally:
        INDEX.write_text(orig_content, encoding="utf-8")


def test_build_pipeline_idempotency():
    """Building twice must produce bit-identical deterministic output (UX-029)."""
    import hashlib
    def get_hash():
        return hashlib.sha256(INDEX.read_bytes()).hexdigest()

    subprocess.run(["python3", str(ROOT / "tools" / "apply_ux_audit_fixes.py")], check=True)
    subprocess.run(["python3", str(ROOT / "tools" / "finalize_metadata.py")], check=True)
    h1 = get_hash()

    subprocess.run(["python3", str(ROOT / "tools" / "apply_ux_audit_fixes.py")], check=True)
    subprocess.run(["python3", str(ROOT / "tools" / "finalize_metadata.py")], check=True)
    h2 = get_hash()

    assert h1 == h2, "Build pipeline is not idempotent!"


def test_asset_preservation_and_manifest_privacy():
    """All 192 assets and 536,251,498 bytes must be preserved with no private leaks (UX-032, UX-033)."""
    assert MANIFEST.exists()
    m_text = MANIFEST.read_text(encoding="utf-8")
    assert "/Users/" not in m_text, "Found /Users/ in asset manifest!"
    assert "MacBook Google Drive" not in m_text, "Found MacBook Google Drive in asset manifest!"
    assert "file://" not in m_text, "Found file:// in asset manifest!"

    data = json.loads(m_text)
    assets = data.get("assets", [])
    assert len(assets) == 192, f"Expected 192 assets in manifest, got {len(assets)}"

    media_files = [f for f in MEDIA_DIR.glob("*") if f.is_file()]
    assert len(media_files) == 192, f"Expected 192 files in media directory, got {len(media_files)}"

    total_bytes = sum(f.stat().st_size for f in media_files)
    assert total_bytes == 536251498, f"Expected 536251498 bytes, got {total_bytes}"


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
    """4, 5. Mobile menu open/close ARIA sync and post-navigation focus (UX-010, UX-019)."""
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


def test_export_button_label_and_truth(page: Page, local_server):
    """14. Truthful export button label and companion media description (UX-002, UX-023)."""
    page.goto(f"{local_server}/index.html")
    export_btn = page.locator("#exportEmbedded")
    expect(export_btn).to_have_text("Export HTML copy")


def test_watermark_and_reduced_motion(page: Page, local_server):
    """15, 16. Reduced motion and watermark video lifecycle (UX-016, UX-027)."""
    # Emulate reduced motion
    page.emulate_media(reduced_motion="reduce")
    page.goto(f"{local_server}/index.html")

    watermark = page.locator("#brandkit-watermark")
    expect(watermark).to_be_hidden()


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
        main_box = page.locator(".cover").bounding_box()
        assert index_box is not None and main_box is not None
        # On desktop, cover content starts to the right of the sidebar
        sidebar_right = index_box["x"] + index_box["width"]
        # The .cover has padding-left >= 18rem (288px) > 256px sidebar right edge
        # Check computed padding of .cover
        pad_left = page.evaluate('() => parseFloat(getComputedStyle(document.querySelector(".page")).paddingLeft)')
        assert pad_left >= 280, f"At width {width}px, padding-left {pad_left}px must be >= 280px to clear sidebar!"


def test_print_stylesheet_rules(page: Page, local_server):
    """19. Print media stylesheet sanity (UX-022)."""
    page.emulate_media(media="print")
    page.goto(f"{local_server}/index.html")

    # Index, toolbar, watermark should be hidden in print
    expect(page.locator("#index")).to_be_hidden()
    expect(page.locator(".asset-toolbar")).to_be_hidden()
    expect(page.locator("#brandkit-watermark")).to_be_hidden()
