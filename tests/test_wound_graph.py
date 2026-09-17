"""Production-path checks for the Codec-first source-backed Wound Graph."""
from urllib.parse import urlparse

from playwright.sync_api import Page, expect


def open_wound_graph(page: Page) -> None:
    page.locator("#readerWorkbenchToggle").click()
    expect(page.locator("#readerWorkbench")).to_be_visible()
    expect(page.locator("#readerToWoundGraph")).to_be_visible()
    page.locator("#readerToWoundGraph").click()
    expect(page.locator("#woundGraph")).to_be_visible()


def test_wound_graph_is_codec_bounded_and_uses_exact_authored_claims(page: Page, local_server):
    page.goto(f"{local_server}/index.html#codec")
    open_wound_graph(page)
    expect(page.locator("#woundGraphHeading")).to_have_text("Wound Graph")
    expect(page.locator("#woundGraph")).to_contain_text("Evidence network, not causal authority")
    assert page.locator("#woundLanes .wound-lane").count() == 6
    expect(page.locator('[data-claim-id="C094"]')).to_contain_text("The final confirmed death count exceeds the initial lethal model")
    page.locator('[data-claim-id="C094"]').click()
    dual = page.locator("#woundDualTruth")
    expect(dual).to_contain_text("seven hundred eighty-six million confirmed dead")
    expect(dual).to_contain_text("LOCAL ANALYSIS · ZERO CANON AUTHORITY")
    body = page.locator("#woundGraph").inner_text().lower()
    assert "morality score" not in body
    assert "global graph" not in body


def test_dual_truth_starts_unset_and_never_persists_analysis(page: Page, local_server):
    page.goto(f"{local_server}/index.html#codec")
    open_wound_graph(page)
    page.locator('[data-claim-id="C095"]').click()
    expect(page.locator("#woundAuthority")).to_have_value("UNSET")
    expect(page.locator("#woundStatementType")).to_have_value("UNSET")
    page.locator("#woundAuthority").select_option("INFERRED")
    page.locator("#woundStatementType").select_option("CHARACTER BELIEF")
    page.locator("#woundEraFrom").fill("post-Nacreous VI")
    expect(page.locator("#woundGraphStatus")).to_contain_text("Canon unchanged")
    keys = page.evaluate("Object.keys(localStorage).filter(k => /wound|dual.?truth/i.test(k))")
    assert keys == []
    page.reload()
    page.locator("#readerWorkbenchToggle").click()
    page.locator("#readerToWoundGraph").click()
    page.locator('[data-claim-id="C095"]').click()
    expect(page.locator("#woundAuthority")).to_have_value("UNSET")
    expect(page.locator("#woundStatementType")).to_have_value("UNSET")


def test_evidence_mode_exposes_provenance_without_promoting_analysis(page: Page, local_server):
    page.goto(f"{local_server}/index.html#codec")
    open_wound_graph(page)
    page.locator('[data-claim-id="C094"]').click()
    page.locator("#woundOpenEvidence").click()
    drawer = page.locator("#woundEvidence")
    expect(drawer).to_be_visible()
    expect(drawer).to_contain_text("C094")
    expect(drawer).to_contain_text("src/content/sections/canon-ledger.body.html")
    expect(drawer).to_contain_text('data-lore-record="C094"')
    expect(drawer).to_contain_text("authored-source")
    expect(drawer).to_contain_text("authored-lore-record")
    expect(drawer).to_contain_text("seven hundred eighty-six million confirmed dead")
    expect(drawer).to_contain_text("does not upgrade the selected Dual Truth reading into canon")
    page.keyboard.press("Escape")
    expect(drawer).to_be_hidden()
    expect(page.locator("#woundOpenEvidence")).to_be_focused()


def test_canon_ripple_is_review_neighborhood_not_causation(page: Page, local_server):
    page.goto(f"{local_server}/index.html#codec")
    open_wound_graph(page)
    page.locator('[data-claim-id="C095"]').click()
    ripple = page.locator("#woundRipple")
    expect(ripple).to_contain_text("Downstream review queue")
    expect(ripple).to_contain_text("Not proof of causation")
    expect(ripple).to_contain_text("Canon Ledger order is evidence order, not guaranteed chronology")
    expect(ripple).to_contain_text("C096")
    expect(ripple).to_contain_text("C097")
    expect(ripple).to_contain_text("mentions · observed-xref")
    ripple.locator('[data-ripple-id="C096"]').click()
    expect(page.locator("#woundDualTruth")).to_contain_text("C096")
    expect(page.locator("#woundDualTruth")).to_contain_text("The First Dirt is rebellion reduced to a cylinder of soil")


def test_wound_graph_mobile_keyboard_focus_and_network_boundary(page: Page, local_server):
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html#codec")
    page.keyboard.press("Control+Shift+G")
    expect(page.locator("#woundGraph")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    undersized = page.locator("#woundGraph button").evaluate_all(
        "nodes => nodes.filter(n => !n.disabled && n.getBoundingClientRect().height < 43.5).map(n => [n.textContent.trim(), n.getBoundingClientRect().height])"
    )
    assert undersized == []
    page.keyboard.press("Escape")
    expect(page.locator("#woundGraph")).to_be_hidden()
    expect(page.locator("#readerWorkbench")).to_be_visible()
    expect(page.locator("#readerToWoundGraph")).to_be_focused()
    origin = urlparse(local_server).netloc
    assert all(urlparse(url).netloc in {"", origin} for url in requests)
