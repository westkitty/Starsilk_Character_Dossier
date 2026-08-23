"""A smaller, high-value journey set run across all Playwright-supported
engines (Chromium, Firefox, WebKit) -- see tools/build.sh / CI, which
invokes this file once per `--browser` flag. tests/test_dossier.py is the
broader Chromium-only suite (item 20: "a smaller representative
cross-browser matrix plus a broader Chromium suite").
"""
import re

from playwright.sync_api import Page, expect


def test_nav_and_disclosure_journey(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    expect(page.locator("#cover h1")).to_be_visible()

    body = page.locator("#dao .dossier-grid")
    expect(body).to_be_hidden()
    page.locator("#dao summary.page-title").click()
    expect(body).to_be_visible()

    closed_box = page.locator("#marcel").bounding_box()
    assert closed_box["height"] < 300


def test_deep_link_and_keyboard_navigation(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html#marcel")
    expect(page.locator("#marcel .dossier-grid")).to_be_visible()

    page.goto(f"{local_server}/index.html")
    skip_link = page.locator(".skip-link")
    page.keyboard.press("Tab")
    expect(skip_link).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.locator("#mainContent")).to_be_focused()


def test_unified_search_journey(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/index.html")
    search = page.locator("#dossierSearch")
    search.fill("Nacreous VI")
    page.wait_for_timeout(300)
    expect(page.locator("#codec .dossier-grid")).to_be_visible()
    expect(page.locator("#codec mark.search-hit").first).to_be_visible()
    search.fill("")
    page.wait_for_timeout(300)
    expect(page.locator("#codec .dossier-grid")).to_be_hidden()


def test_expand_all_does_not_fetch_video_archive(page: Page, local_server):
    requests = []
    page.on("request", lambda req: requests.append(req.url) if req.url.endswith(".mp4") else None)
    page.goto(f"{local_server}/index.html")
    page.wait_for_timeout(300)
    baseline = len(requests)
    page.locator("#expandAllBtn").click()
    page.wait_for_timeout(1000)
    assert len(requests) == baseline, "Expand All should not fetch additional off-screen video"


def test_mobile_menu_and_reader_mode(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html")
    toggle = page.locator("#menuToggle")
    toggle.click()
    expect(page.locator("#index")).to_have_class(re.compile(r"\bopen\b"))

    mode_toggle = page.locator("#modeToggle")
    expect(mode_toggle).to_have_attribute("aria-pressed", "false")


def test_museum_object_deep_link_and_escape_journey(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    object_id = "0cb9f2fd4623694ffca06f45"
    page.goto(f"{local_server}/objects/#{object_id}")
    expect(page.locator("#objectViewer")).to_be_visible()
    expect(page.locator("#viewerId")).to_have_text(object_id)
    expect(page.locator("#viewerMedia img")).to_have_count(1)
    expect(page.locator("#closeViewer")).to_be_focused()
    page.keyboard.press("Escape")
    expect(page.locator("#objectViewer")).to_be_hidden()
    assert page.url == f"{local_server}/objects/"


def test_relationship_observatory_deep_link_journey(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 800})
    edge_id = "mention--codec--dao"
    page.goto(f"{local_server}/relationships/#{edge_id}")
    edge = page.locator(f"#{edge_id}")
    expect(edge).to_be_visible()
    expect(edge).to_have_attribute("data-relationship", "mentions")
    expect(edge).to_have_attribute("data-evidence-class", "observed-xref")
    expect(page.locator("#entity-codec")).to_be_visible()
    expect(edge.locator("a", has_text="Published xref evidence")).to_have_attribute(
        "href",
        "https://westkitty.github.io/Starsilk_Character_Dossier/#xref-codec--dao",
    )
