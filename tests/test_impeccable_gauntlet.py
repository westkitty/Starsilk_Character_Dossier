"""Regression proof for the bounded seven-finding Impeccable UX gauntlet."""
import re

import pytest
from playwright.sync_api import Page, expect


@pytest.mark.parametrize("width", [375, 768, 1024, 1440])
def test_principal_dossier_geometry_is_readable(page: Page, local_server, width: int):
    page.set_viewport_size({"width": width, "height": 812})
    page.goto(f"{local_server}/index.html#dao")
    grid = page.locator("#dao .dossier-grid")
    expect(grid).to_be_visible()
    positions = grid.evaluate("""el => [...el.children].slice(0, 2).map(child => {
      const r = child.getBoundingClientRect();
      return {x:r.x, y:r.y, width:r.width, height:r.height};
    })""")
    assert len(positions) == 2, "dossier fixture should contain two grid columns"
    if width <= 760:
        assert abs(positions[0]["x"] - positions[1]["x"]) <= 2
        assert positions[0]["width"] >= 280, positions
        assert positions[1]["y"] >= positions[0]["y"] + positions[0]["height"] - 2
    else:
        assert positions[1]["x"] > positions[0]["x"] + 10
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width


def test_mobile_closed_index_is_not_in_tab_order_and_escape_restores_focus(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html")
    toggle = page.locator("#menuToggle")
    toggle.focus()
    page.keyboard.press("Tab")
    assert not page.evaluate(
        "document.querySelector('.index-panel').contains(document.activeElement)"
    )
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "true")
    page.keyboard.press("Escape")
    expect(toggle).to_be_focused()
    expect(toggle).to_have_attribute("aria-expanded", "false")
    assert page.evaluate(
        "getComputedStyle(document.querySelector('.index-panel')).visibility === 'hidden'"
    )


def test_small_link_targets_and_focus_ring(page: Page, local_server):
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(f"{local_server}/index.html")
    link = page.locator(".index nav a:visible").first
    assert link.bounding_box()["height"] >= 43.5
    machine = page.locator(".archive-junction .museum-data-links a").first
    assert machine.bounding_box()["height"] >= 43.5
    card = page.locator(".archive-junction a.archive-lens[href='palimpsest/']")
    card.focus()
    style = card.evaluate("""el => {
        const s=getComputedStyle(el);return {kind:s.outlineStyle,width:parseFloat(s.outlineWidth)};
    }""")
    assert style["kind"] != "none" and style["width"] >= 2.9


def test_archive_progressive_disclosure_keeps_all_eleven_routes(page: Page, local_server):
    page.goto(f"{local_server}/index.html")
    junction = page.locator(".archive-junction")
    cards = junction.locator("a.archive-lens")
    expect(cards).to_have_count(11)
    assert junction.locator("a.archive-lens:visible").count() == 3
    summary = junction.locator(".archive-lenses-more summary")
    summary.click()
    assert junction.locator("a.archive-lens:visible").count() == 11
    expect(junction.locator("a.archive-lens[href='worldsvault/']")).to_be_visible()


def test_record_explorer_empty_error_and_retry_states(page: Page, local_server):
    page.goto(f"{local_server}/records/")
    expect(page.locator("#recordGrid li").first).to_be_visible()
    page.locator("#recordQuery").fill("this-is-not-a-starsilk-record-987654")
    expect(page.locator("#recordEmptyState")).to_be_visible()
    page.locator("#recordClearFilters").click()
    expect(page.locator("#recordEmptyState")).to_be_hidden()
    expect(page.locator("#recordGrid li").first).to_be_visible()

    page.route("**/records/search.json", lambda route: route.abort())
    page.reload()
    expect(page.locator("#recordLoadError")).to_be_visible()
    expect(page.locator("#recordGrid li")).to_have_count(0)
    page.unroute("**/records/search.json")
    page.locator("#recordRetry").click()
    expect(page.locator("#recordLoadError")).to_be_hidden()
    expect(page.locator("#recordGrid li").first).to_be_visible()


@pytest.mark.parametrize("target,opener,focused", [
    ("witnessEngine", "witnessEngineToggle", "witnessDraft"),
    ("revisionChamber", "readerWorkbenchToggle", "revisionProposal"),
])
def test_authoring_workspace_traps_focus_natively(
    page: Page, local_server, target: str, opener: str, focused: str
):
    page.goto(f"{local_server}/index.html#codec")
    if target == "witnessEngine":
        page.locator("#witnessEngineToggle").click()
    else:
        page.locator("#readerWorkbenchToggle").click()
        page.locator("#readerToRevision").click()
    dialog = page.locator(f"#{target}")
    expect(dialog).to_be_visible()
    expect(dialog).to_have_attribute("open", re.compile(r".*"))
    assert dialog.evaluate("el => el.tagName === 'DIALOG'")
    expect(page.locator(f"#{focused}")).to_be_focused()
    for _ in range(12):
        page.keyboard.press("Tab")
        assert dialog.evaluate("el => el.contains(document.activeElement)"), target
    page.keyboard.press("Escape")
    expect(dialog).to_be_hidden()
    expect(page.locator(f"#{opener}")).to_be_focused()


def test_witness_to_revision_preserves_draft_and_focus(page: Page, local_server):
    page.goto(f"{local_server}/index.html#codec")
    page.locator("#witnessEngineToggle").click()
    page.locator("#witnessDraft").fill("Codec does not mistake necessity for innocence.")
    page.locator("#witnessToRevision").click()
    expect(page.locator("#witnessEngine")).to_be_hidden()
    expect(page.locator("#revisionChamber")).to_be_visible()
    expect(page.locator("#revisionProposal")).to_have_value(
        "Codec does not mistake necessity for innocence."
    )
    expect(page.locator("#revisionProposal")).to_be_focused()


def test_archive_helper_text_meets_normal_text_contrast(page: Page, local_server):
    page.goto(f"{local_server}/index.html#archive")
    helper = page.locator(".image-empty em").first
    assert helper.count() == 1
    foreground = helper.evaluate("el => getComputedStyle(el).color")
    assert foreground == "rgb(143, 168, 184)"

    def light(channel):
        n=channel/255.0
        return n/12.92 if n <= .04045 else ((n+.055)/1.055)**2.4

    def luminance(channels):
        return sum(a*light(b) for a,b in zip((.2126,.7152,.0722),channels))

    foreground_lum=luminance((143,168,184))
    background_lum=luminance((5,10,16))
    assert (foreground_lum+.05)/(background_lum+.05)>=4.5


def test_palimpsest_stage_rail_hit_targets(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/palimpsest/")
    page.locator("#beginWitness").click()
    expect(page.locator("#witnessRail")).to_be_visible()
    heights = page.locator("#witnessRail button").evaluate_all(
        "buttons => buttons.map(btn => btn.getBoundingClientRect().height)"
    )
    assert heights and min(heights) >= 43.5, heights
