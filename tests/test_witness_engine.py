"""Production-path checks for the browser-local Starsilk Witness Engine."""
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Page, expect


def open_engine(page: Page) -> None:
    page.get_by_role("button", name="Witness engine").click()
    expect(page.locator("#witnessEngine")).to_be_visible()
    expect(page.locator("#witnessDraft")).to_be_focused()


def test_witness_engine_detects_only_explicit_applicable_lock_conflicts(page: Page, local_server):
    page.goto(f"{local_server}/index.html#dao")
    open_engine(page)
    page.locator("#witnessDraft").fill(
        "The Blood Eclipse War lasted 17 years. Dao replaced his left arm. WordStreamer recorded it."
    )
    page.get_by_role("button", name="Compile draft").click()
    expect(page.locator("#witnessReport")).to_contain_text("Conflicts")
    assert page.locator(".witness-conflict").count() >= 3
    text = page.locator("#witnessReport").inner_text()
    assert "one hundred seventy years" in text
    assert "right" in text.lower()
    assert "Wordstreamer" in text
    expect(page.locator("#witnessStatus")).to_contain_text("explicit conflict")


def test_witness_engine_separates_exact_source_support_from_draft_local_claims(page: Page, local_server):
    page.goto(f"{local_server}/index.html#codec")
    source_phrase = page.locator("#codec").evaluate(
        "el => el.innerText.replace(/\\s+/g, ' ').trim().split(' ').slice(0, 18).join(' ')"
    )
    open_engine(page)
    page.locator("#witnessDraft").fill(source_phrase)
    page.get_by_role("button", name="Compile draft").click()
    assert page.locator(".witness-supported").count() >= 1
    page.locator(".witness-supported").first.click()
    expect(page.locator("#witnessTrace")).to_contain_text("Exact source phrase")

    page.locator("#witnessDraft").fill("Codec proved the mauve theorem on an otherwise ordinary Tuesday.")
    page.get_by_role("button", name="Compile draft").click()
    assert page.locator(".witness-source-local").count() >= 1
    expect(page.locator("#witnessReport")).to_contain_text("remains draft-local")
    assert page.locator(".witness-conflict").count() == 0


def test_witness_engine_import_copy_export_and_no_draft_persistence(page: Page, local_server):
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.goto(f"{local_server}/index.html#codec")
    page.evaluate("""() => {
      window.__witnessCopies = [];
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: text => { window.__witnessCopies.push(text); return Promise.resolve(); }}});
    }""")
    open_engine(page)
    page.locator("#witnessFile").set_input_files({
        "name": "draft.md", "mimeType": "text/markdown", "buffer": b"Codec refuses to call necessity innocence."
    })
    expect(page.locator("#witnessStatus")).to_contain_text("Draft remains local")
    page.get_by_role("button", name="Compile draft").click()
    page.get_by_role("button", name="Copy context pack").click()
    copies = page.evaluate("window.__witnessCopies")
    assert copies and "evidence, not canon authority" in copies[-1]
    assert "Do not invent missing lore" in copies[-1]

    with page.expect_download() as info:
        page.get_by_role("button", name="Export report").click()
    payload = json.loads(Path(info.value.path()).read_text(encoding="utf-8"))
    assert payload["schema"] == "starsilk-witness-report/1"
    assert payload["draft_length"] > 0
    assert not any("witness" in key.lower() or "draft" in key.lower() for key in page.evaluate("Object.keys(localStorage)"))
    assert all(urlparse(url).netloc in {"", urlparse(local_server).netloc} for url in requests)


def test_witness_engine_mobile_keyboard_and_touch_targets(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html#codec")
    expect(page.locator("#witnessEngineToggle")).to_be_hidden()
    page.get_by_role("button", name="Reader workbench").click()
    page.get_by_role("button", name="Witness engine").click()
    expect(page.locator("#witnessEngine")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    undersized = page.locator("#witnessEngine button, #witnessEngine .witness-file-label").evaluate_all(
        "nodes => nodes.filter(n => n.getBoundingClientRect().height < 43.5).map(n => [n.textContent.trim(), n.getBoundingClientRect().height])"
    )
    assert undersized == []
    page.keyboard.press("Escape")
    expect(page.locator("#witnessEngine")).to_be_hidden()
    expect(page.locator("#readerWorkbenchToggle")).to_be_focused()
