"""Production-path checks for the browser-local Starsilk Revision Chamber."""
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Page, expect


def open_chamber(page: Page) -> None:
    page.locator("#readerWorkbenchToggle").click()
    page.locator("#readerToRevision").click()
    expect(page.locator("#revisionChamber")).to_be_visible()
    expect(page.locator("#revisionProposal")).to_be_focused()


def test_revision_chamber_hard_conflicts_are_narrow_and_blocked(page: Page, local_server):
    page.goto(f"{local_server}/index.html#dao")
    open_chamber(page)
    page.locator("#revisionProposal").fill(
        "The Blood Eclipse War lasted 17 years. Dao replaced his left arm. WordStreamer recorded it."
    )
    page.locator("#revisionAnalyze").click()
    expect(page.locator("#revisionConsequences")).to_contain_text("BLOCKED BY MACHINE LOCK")
    assert page.locator("#revisionConsequences .revision-conflict").count() >= 3
    expect(page.locator("#revisionConsequences")).to_contain_text("Known blast radius only")
    expect(page.locator("#revisionConsequences")).to_contain_text("src/canon/invariants.json")


def test_revision_chamber_zero_conflict_never_means_safe_to_canonize(page: Page, local_server):
    page.goto(f"{local_server}/index.html#codec")
    open_chamber(page)
    page.locator("#revisionProposal").fill("Codec establishes the mauve theorem on an ordinary Tuesday.")
    page.locator("#revisionAnalyze").click()
    expect(page.locator("#revisionConsequences")).to_contain_text("HUMAN DECISION REQUIRED")
    expect(page.locator("#revisionConsequences")).to_contain_text("No conflict does not mean canon-compatible")
    assert page.locator("#revisionConsequences .revision-conflict").count() == 0
    expect(page.locator("#revisionConsequences")).to_contain_text("src/content/sections/codec.body.html")
    body = page.locator("#revisionConsequences").inner_text().lower()
    assert "safe to canonize" not in body
    assert "canon compatible" not in body


def test_revision_chamber_forks_witness_draft_and_compares_realities(page: Page, local_server):
    page.goto(f"{local_server}/index.html#codec")
    page.locator("#witnessEngineToggle").click()
    page.locator("#witnessDraft").fill("Codec refuses the mauve theorem.")
    page.locator("#witnessToRevision").click()
    expect(page.locator("#witnessEngine")).to_be_hidden()
    expect(page.locator("#revisionChamber")).to_be_visible()
    expect(page.locator("#revisionProposal")).to_have_value("Codec refuses the mauve theorem.")
    page.locator("#revisionAnalyze").click()
    first_id = page.locator("#revisionBranchList .revision-branch.is-active").get_attribute("data-branch-id")

    page.locator("#revisionNewBranch").click()
    page.locator("#revisionBranchName").fill("Dao branch")
    page.locator("#revisionBranchName").blur()
    page.locator("#revisionProposal").fill("Dao studies a different mauve theorem.")
    page.locator("#revisionAnalyze").click()
    page.locator("#revisionCompareTarget").select_option(first_id)
    page.locator("#revisionCompareBtn").click()
    expect(page.locator("#revisionComparison")).to_be_visible()
    expect(page.locator("#revisionComparison")).to_contain_text("Difference, not recommendation")
    expect(page.locator("#revisionComparison")).to_contain_text("Matched records")
    expect(page.locator("#revisionComparison")).to_contain_text("Codec")
    expect(page.locator("#revisionComparison")).to_contain_text("Dao")


def test_revision_chamber_sacrifice_packet_export_import_and_no_persistence(page: Page, local_server):
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.goto(f"{local_server}/index.html#first-dirt")
    page.evaluate("""() => {
      window.__revisionCopies = [];
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: text => { window.__revisionCopies.push(text); return Promise.resolve(); }}});
    }""")
    open_chamber(page)
    page.locator("#revisionBranchName").fill("First Dirt mutation")
    page.locator("#revisionBranchName").blur()
    page.locator("#revisionProposal").fill("The First Dirt occurs 31 days post-war and Codec changes its meaning.")
    page.locator("#revisionSacrifice").click()
    expect(page.locator("#revisionConsequences")).to_contain_text("What would I have to sacrifice?")
    expect(page.locator("#revisionConsequences")).to_contain_text("The First Dirt")
    expect(page.locator("#revisionConsequences")).to_contain_text("31 days post-war")
    page.locator("#revisionCopyPacket").click()
    copies = page.evaluate("window.__revisionCopies")
    assert copies and "No action in this packet changes canon" in copies[-1]

    with page.expect_download() as info:
        page.locator("#revisionExportWorkspace").click()
    payload = json.loads(Path(info.value.path()).read_text(encoding="utf-8"))
    assert payload["schema"] == "starsilk-revision-workspace/1"
    assert payload["branches"][0]["proposal"]
    page.locator("#revisionImport").set_input_files({
        "name": "workspace.json",
        "mimeType": "application/json",
        "buffer": json.dumps(payload).encode("utf-8"),
    })
    expect(page.locator("#revisionStatus")).to_contain_text("Imported")
    keys = page.evaluate("Object.keys(localStorage).filter(k => /revision|reality|branch/i.test(k))")
    assert keys == []
    assert all(urlparse(url).netloc in {"", urlparse(local_server).netloc} for url in requests)


def test_revision_chamber_mobile_keyboard_and_touch_targets(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html#codec")
    page.keyboard.press("Control+Shift+R")
    expect(page.locator("#revisionChamber")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    undersized = page.locator("#revisionChamber button, #revisionChamber .revision-file-label").evaluate_all(
        "nodes => nodes.filter(n => !n.disabled && n.getBoundingClientRect().height < 43.5).map(n => [n.textContent.trim(), n.getBoundingClientRect().height])"
    )
    assert undersized == []
    page.keyboard.press("Escape")
    expect(page.locator("#revisionChamber")).to_be_hidden()
    expect(page.locator("#readerWorkbenchToggle")).to_be_focused()
