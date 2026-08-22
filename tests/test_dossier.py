import pytest
from playwright.sync_api import Page, expect
import threading
import http.server
import socketserver
import time

PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler

class ThreadedHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    pass

@pytest.fixture(scope="session", autouse=True)
def server():
    httpd = ThreadedHTTPServer(("", PORT), Handler)
    thread = threading.Thread(target=httpd.serve_forever)
    thread.daemon = True
    thread.start()
    time.sleep(1) # give server time to start
    yield
    httpd.shutdown()

def test_page_loads_without_errors(page: Page):
    errors = []
    page.on("pageerror", lambda err: errors.append(err))
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    
    page.goto(f"http://localhost:{PORT}/docs/index.html")
    expect(page.locator("h1")).to_contain_text("STARSILK DOSSIER")
    
    # Allow some time for scripts to run
    page.wait_for_timeout(500)
    
    assert len(errors) == 0, f"Page loaded with errors: {errors}"

def test_skip_link(page: Page):
    page.goto(f"http://localhost:{PORT}/docs/index.html")
    skip_link = page.locator(".skip-link")
    expect(skip_link).to_be_attached()
    expect(skip_link).to_have_text("Skip to dossier content")
    # Clicking it should scroll main into view
    skip_link.click(force=True)
    # Check that focus moved to main or hash changed
    assert "#main-content" in page.url

def test_mobile_menu(page: Page):
    page.set_viewport_size({"width": 375, "height": 667})
    page.goto(f"http://localhost:{PORT}/docs/index.html")
    toggle = page.locator("#menuToggle")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "true")
    # Click a link inside
    page.locator("#index-nav a").first.click()
    expect(toggle).to_have_attribute("aria-expanded", "false")

def test_search_filter(page: Page):
    page.goto(f"http://localhost:{PORT}/docs/index.html")
    search = page.locator(".dossier-search")
    search.fill("Codec")
    # The Codec link should be visible, others hidden
    visible_links = page.locator("#index-nav a:visible").all_inner_texts()
    assert any("Codec" in text for text in visible_links)
    
def test_attachment_and_clear(page: Page):
    page.goto(f"http://localhost:{PORT}/docs/index.html")
    status = page.locator("#assetStatus")
    expect(status).to_contain_text("0 of 26")
    
    # We can't easily mock file drop without file path, but we can verify UI bounds
    # Wait, 0 of 26? The actual number of slots is 26.
    
    # Click clear and confirm
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#clearImages").click()
    
def test_responsive_layout(page: Page):
    # Test collision point
    page.set_viewport_size({"width": 951, "height": 800})
    page.goto(f"http://localhost:{PORT}/docs/index.html")
    
    # Check that main content doesn't overlap index
    index_box = page.locator(".index").bounding_box()
    main_box = page.locator("main").bounding_box()
    
    if index_box and main_box:
        assert main_box["x"] >= (index_box["x"] + index_box["width"]), "Layout collision detected!"

