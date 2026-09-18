"""Production-path checks for the source-backed Starsilk Truth Lab."""
from urllib.parse import urlparse

from playwright.sync_api import Page, expect


def open_truth_lab(page: Page, local_server: str) -> None:
    page.goto(f"{local_server}/index.html#canon-ledger")
    reader = page.locator("#readerWorkbench")
    if not reader.is_visible():
        page.locator("#readerWorkbenchToggle").click()
    expect(reader).to_be_visible()
    page.locator("#readerToTruthLab").click()
    expect(page.locator("#truthLab")).to_be_visible()


def open_tab(page: Page, name: str) -> None:
    page.locator(f'[data-truth-tab="{name}"]').click()


def test_truth_lab_exposes_all_five_tools_with_zero_authority_boundary(page: Page, local_server):
    open_truth_lab(page, local_server)
    expect(page.locator("#truthLabHeading")).to_have_text("Truth Lab")
    expect(page.locator("#truthLab")).to_contain_text("Evidence tools, not canon authority")
    assert page.locator("[data-truth-tab]").count() == 5
    for label in ("Parallax Engine", "Truth Horizon", "Silence Index", "Canon Quarry", "Canon Change Receipt"):
        expect(page.locator("#truthLab")).to_contain_text(label)


def test_parallax_uses_authored_claims_and_local_assignment_never_persists(page: Page, local_server):
    open_truth_lab(page, local_server)
    expect(page.locator("#truthLabBody")).to_contain_text("C096")
    expect(page.locator("#truthLabBody")).to_contain_text("The First Dirt")
    select = page.locator('[data-perspective="C096"]')
    expect(select).to_have_value("UNASSIGNED")
    select.select_option("CODEC")
    expect(page.locator("#truthLabStatus")).to_contain_text("Canon unchanged")
    assert page.evaluate("Object.keys(localStorage).filter(k => /truth|parallax|quarry|receipt/i.test(k))") == []
    page.reload()
    open_truth_lab(page, local_server)
    expect(page.locator('[data-perspective="C096"]')).to_have_value("UNASSIGNED")


def test_truth_horizon_uses_authored_phase_and_year_markers_without_character_knowledge_claim(page: Page, local_server):
    open_truth_lab(page, local_server)
    open_tab(page, "horizon")
    page.locator("#truthHorizonSelect").select_option("siege-ruby-eclipse")
    current = page.locator('[data-event-id="siege-ruby-eclipse"]')
    expect(current).to_contain_text("HORIZON EVENT")
    expect(current).to_contain_text("Year 121")
    expect(page.locator('[data-event-id="standard-conquest"]')).to_contain_text("ESTABLISHED BY AUTHORED YEAR")
    expect(page.locator('[data-event-id="collapse-aureal-gate"]')).to_contain_text("NOT YET ESTABLISHED")
    expect(page.locator("#truthLabBody")).to_contain_text("not a claim about what any character personally knew")


def test_silence_index_reports_only_explicit_unknowns_and_inference_boundaries(page: Page, local_server):
    open_truth_lab(page, local_server)
    open_tab(page, "silence")
    body = page.locator("#truthLabBody")
    expect(body).to_contain_text("UNKNOWN TIME")
    expect(body).to_contain_text("FORBIDDEN INFERENCE")
    expect(body).to_contain_text("Claim order is evidence order, not guaranteed chronology")
    expect(body).to_contain_text("does not prove stronger relationship semantics")
    expect(body).to_contain_text("does not manufacture mystery from ordinary absence")


def test_canon_quarry_extracts_candidates_but_never_promotes_them(page: Page, local_server):
    open_truth_lab(page, local_server)
    open_tab(page, "quarry")
    page.locator("#quarryText").fill("The First Dirt is rebellion reduced to a cylinder of soil.")
    page.locator("#quarryAnalyze").click()
    body = page.locator("#truthLabBody")
    expect(body).to_contain_text("Q001")
    expect(body).to_contain_text("C096")
    expect(body).to_contain_text("Candidate extraction only")
    expect(page.locator("#truthLabStatus")).to_contain_text("Nothing was canonized")
    assert page.evaluate("Object.keys(localStorage).filter(k => /truth|quarry/i.test(k))") == []


def test_change_receipt_exposes_bounded_review_surfaces_not_causation(page: Page, local_server):
    open_truth_lab(page, local_server)
    open_tab(page, "receipt")
    page.locator("#receiptBefore").fill("The First Dirt is rebellion reduced to a cylinder of soil.")
    page.locator("#receiptAfter").fill(
        "The First Dirt is rebellion reduced to a cylinder of soil. Codec remembers the cost."
    )
    page.locator("#receiptBuild").click()
    body = page.locator("#truthLabBody")
    expect(body).to_contain_text("Codec remembers the cost.")
    expect(body).to_contain_text("entities/canon-ledger/")
    expect(body).to_contain_text("provable subset")
    expect(body).to_contain_text("not a complete dependency graph")
    expect(page.locator("#truthLabStatus")).to_contain_text("Canon unchanged")


def test_truth_lab_mobile_keyboard_focus_and_network_boundary(page: Page, local_server):
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.set_viewport_size({"width": 375, "height": 812})
    open_truth_lab(page, local_server)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    undersized = page.locator("#truthLab button").evaluate_all(
        "nodes => nodes.filter(n => !n.disabled && n.getClientRects().length && n.getBoundingClientRect().height < 43.5).map(n => [n.textContent.trim(), n.getBoundingClientRect().height])"
    )
    assert undersized == []
    page.keyboard.press("Escape")
    expect(page.locator("#truthLab")).to_be_hidden()
    expect(page.locator("#readerWorkbench")).to_be_visible()
    expect(page.locator("#readerToTruthLab")).to_be_focused()
    origin = urlparse(local_server).netloc
    assert all(urlparse(url).netloc in {"", origin} for url in requests)


def test_truth_lab_source_has_no_persistence_or_network_write_path():
    from pathlib import Path

    source = (Path(__file__).resolve().parents[1] / "src/templates/truth-lab.js").read_text(encoding="utf-8")
    assert "localStorage" not in source
    assert "sessionStorage" not in source
    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source
