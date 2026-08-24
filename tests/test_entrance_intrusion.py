import re
from pathlib import Path

from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def set_intrusion_timing(page: Page, *, hold_ms: int):
    page.add_init_script(
        f"""
          window.__STARSILK_CANON_INTRUSION_TIMING__ = {{
            firstMin: 20,
            firstSpan: 0,
            nextMin: 5000,
            nextSpan: 0,
            holdMs: {hold_ms}
          }};
        """
    )


def test_starsilk_first_cover_and_archive_placement():
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    assert "Reality has a substrate." in html
    assert "Starsilk is the programmable filament running through the all" in html
    assert "Six principal character dossiers" not in html
    assert "One Compendium.<br/>Nine ways in." not in html
    assert html.index('id="cover"') < html.index('id="world"') < html.index('class="museum-entrance archive-junction"') < html.index('id="chronology"')
    for href in ('#world', '#shard-god', '#beyond-wall'):
        assert f'href="{href}"' in html


def test_archive_junction_preserves_every_major_system():
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    for system in ("discover", "entities", "objects", "relationships", "canon", "tours", "chronology", "worldsvault"):
        assert f'href="{system}/"' in html
    assert 'class="museum-data-strip archive-machine-row"' in html
    assert '<summary>Collection statistics</summary>' in html


def test_canon_intrusion_runtime(page: Page, local_server):
    set_intrusion_timing(page, hold_ms=1500)
    page.goto(f"{local_server}/index.html")
    title = page.locator("#coverTitle")
    expect(title).to_have_text("YOUR SKY IS BUILT FROM YOUR DEAD.", timeout=2500)
    expect(title).to_have_class(re.compile(r"\bis-canon-intrusion\b"))
    assert title.evaluate("el => getComputedStyle(el).color") == "rgb(255, 64, 84)"
    expect(title).to_have_text("Starsilk Compendium", timeout=4500)
    expect(title).not_to_have_class(re.compile(r"\bis-canon-intrusion\b"))


def test_canon_intrusion_reduced_motion_is_steady(page: Page, local_server):
    page.emulate_media(reduced_motion="reduce")
    set_intrusion_timing(page, hold_ms=2500)
    page.goto(f"{local_server}/index.html")
    title = page.locator("#coverTitle")
    expect(title).to_have_text("YOUR SKY IS BUILT FROM YOUR DEAD.", timeout=2500)
    page.wait_for_timeout(500)
    expect(title).to_have_text("YOUR SKY IS BUILT FROM YOUR DEAD.")
    assert title.evaluate("el => getComputedStyle(el).textShadow") == "none"


def test_canon_intrusion_does_not_overflow_320px(page: Page, local_server):
    page.set_viewport_size({"width": 320, "height": 760})
    set_intrusion_timing(page, hold_ms=1500)
    page.goto(f"{local_server}/index.html")
    expect(page.locator("#coverTitle")).to_have_text("YOUR SKY IS BUILT FROM YOUR DEAD.", timeout=2500)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    box = page.locator("#coverTitle").bounding_box()
    assert box is not None
    assert box["x"] >= -0.5
    assert box["x"] + box["width"] <= 320.5
