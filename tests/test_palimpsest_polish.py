"""Regression coverage for the Palimpsest tactile/visual polish pass.

These tests deliberately target behavior, evidence boundaries, and input parity rather
than animation frame timing. The canonical Palimpsest tests remain authoritative for
the full source-backed journey.
"""
from pathlib import Path

from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent


def _reach_wall(page: Page, local_server: str) -> None:
    page.goto(f"{local_server}/palimpsest/")
    page.locator("#beginWitness").click()
    page.locator("#extractStar").click()
    expect(page.locator("#starEvidence")).to_be_visible()
    page.locator("#starEvidence [data-next='blood-ring']").click()
    page.locator("#ringFilter").fill("0")
    expect(page.locator("#ringEvidence")).to_be_visible()
    page.locator("#ringEvidence [data-next='nacreous']").click()
    page.locator("[data-nacreous-choice='withhold']").click()
    expect(page.locator("#nacreousEvidence")).to_be_visible()
    page.locator("#nacreousEvidence [data-next='siege-wall']").click()
    expect(page.locator("#phase-siege-wall")).to_be_visible()


def test_palimpsest_polish_keeps_no_new_runtime_dependency():
    source = (ROOT / "src/templates/palimpsest.html.j2").read_text(encoding="utf-8")
    runtime = (ROOT / "src/templates/palimpsest.js").read_text(encoding="utf-8")
    css = (ROOT / "src/templates/palimpsest.css").read_text(encoding="utf-8")

    assert 'src="palimpsest.js"' in source
    assert 'href="palimpsest.css"' in source
    assert "https://" not in runtime
    assert "http://" not in runtime
    assert "localStorage" not in runtime
    assert "sessionStorage" in runtime
    assert "navigator.vibrate" not in runtime
    assert "color-mix(" not in css


def test_palimpsest_reduced_motion_resolves_star_consequence_without_animation_delay(page: Page, local_server):
    page.emulate_media(reduced_motion="reduce")
    page.goto(f"{local_server}/palimpsest/")
    page.locator("#beginWitness").click()
    page.locator("#extractStar").click()
    expect(page.locator("#starEvidence")).to_be_visible()
    expect(page.locator("#starSceneLabel")).to_have_text("OBSERVED: STELLAR COLLAPSE")


def test_siege_wall_single_click_has_one_normalized_increment(page: Page, local_server):
    _reach_wall(page, local_server)
    page.locator("#containButton").click()
    expect(page.locator("#containmentMetric")).to_have_text("13%")
    state = page.evaluate("JSON.parse(sessionStorage.getItem('starsilk-palimpsest-session-v1'))")
    assert state["wallProgress"] == 13


def test_siege_wall_completes_in_eight_discrete_taps(page: Page, local_server):
    _reach_wall(page, local_server)
    for _ in range(8):
        page.locator("#containButton").click()
    expect(page.locator("#containmentMetric")).to_have_text("100%")
    expect(page.locator("#wallEvidence")).to_be_visible()
    expect(page.locator("#containButton")).to_be_disabled()


def test_witness_rail_becomes_navigation_only_after_witnessing(page: Page, local_server):
    page.goto(f"{local_server}/palimpsest/")
    page.locator("#beginWitness").click()
    star_rail = page.locator("[data-rail='star-law']")
    expect(star_rail).to_be_disabled()
    page.locator("#extractStar").click()
    expect(star_rail).to_be_enabled()
    page.locator("#starEvidence [data-next='blood-ring']").click()
    expect(page.locator("#phase-blood-ring")).to_be_visible()
    star_rail.click()
    expect(page.locator("#phase-star-law")).to_be_visible()


def test_long_silence_does_not_invent_intermediate_history(page: Page, local_server):
    _reach_wall(page, local_server)
    for _ in range(8):
        page.locator("#containButton").click()
    page.locator("#wallEvidence [data-next='beyond-wall']").click()

    page.locator("#timeSlider").fill("3")
    expect(page.locator("#contactFrame")).to_be_hidden()
    expect(page.locator("#timeSignal")).to_contain_text("missing record")

    page.locator("#timeSlider").fill("6")
    expect(page.locator("#contactFrame")).to_be_visible()
    expect(page.locator("#timeSignal")).to_contain_text("source-backed")


def test_final_claim_exposes_non_color_evidence_states(page: Page, local_server):
    _reach_wall(page, local_server)
    for _ in range(8):
        page.locator("#containButton").click()
    page.locator("#wallEvidence [data-next='beyond-wall']").click()
    page.locator("#timeSlider").fill("6")
    page.locator("#receiveHail").click()
    expect(page.locator("#beyondEvidence")).to_be_visible()
    page.locator("#beyondEvidence [data-next='witness-record']").click()

    us = page.locator("[data-final-word='us']")
    saved = page.locator("[data-final-word='saved']")
    drakken = page.locator("[data-final-word='drakken']")
    expect(us).to_have_attribute("data-evidence-state", "unknown")
    expect(saved).to_have_attribute("data-evidence-state", "contested")
    expect(drakken).to_have_attribute("data-evidence-state", "temporal")
    expect(us).to_have_attribute("aria-label", "us. UNRESOLVED REFERENT")


def test_palimpsest_polish_mobile_has_no_horizontal_overflow(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/palimpsest/")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    _reach_wall(page, local_server)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

def test_palimpsest_defers_hidden_heavy_visual_nodes_until_needed(page: Page, local_server):
    page.goto(f"{local_server}/palimpsest/")
    expect(page.locator("#wallField .wall-node")).to_have_count(0)
    expect(page.locator("#mirrorField .mirror-star")).to_have_count(0)

    _reach_wall(page, local_server)
    expect(page.locator("#wallField .wall-node")).to_have_count(40)
    expect(page.locator("#mirrorField .mirror-star")).to_have_count(0)

    for _ in range(8):
        page.locator("#containButton").click()
    page.locator("#wallEvidence [data-next='beyond-wall']").click()
    page.locator("#timeSlider").fill("6")
    page.locator("#receiveHail").click()
    expect(page.locator("#beyondEvidence")).to_be_visible()
    page.locator("#beyondEvidence [data-next='witness-record']").click()
    expect(page.locator("#mirrorField .mirror-star")).to_have_count(120)


def test_witnessed_state_update_is_idempotent_in_runtime_source():
    runtime = (ROOT / "src/templates/palimpsest.js").read_text(encoding="utf-8")
    assert "if(state.witnessed.indexOf(id)>=0)return false" in runtime
    assert "if(id==='siege-wall'&&!document.getElementById('wallField').children.length)wall();" in runtime
    assert "function ledger(){\n  ensureMirror();" in runtime
    assert "lastRingBand=null;ring();time();" in runtime
