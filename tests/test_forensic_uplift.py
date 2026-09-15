"""Adversarial production-path coverage for the root Reader Workbench."""
import json
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import Page, expect


STATE_KEY = "starsilk-reader-workbench/v1"


def reader_state(page: Page) -> dict:
    raw = page.evaluate("key => localStorage.getItem(key)", STATE_KEY)
    return json.loads(raw) if raw else {}


def seed_state(page: Page, state: dict) -> None:
    page.evaluate("([key, value]) => localStorage.setItem(key, JSON.stringify(value))", [STATE_KEY, state])


def open_workbench(page: Page) -> None:
    page.locator("#readerWorkbenchToggle").click()
    expect(page.locator("#readerWorkbench")).to_be_visible()


def rendered_xref_pair(page: Page) -> tuple[str, str]:
    pair = page.evaluate(
        """() => {
          for (const section of document.querySelectorAll('main#mainContent section.page[id]')) {
            if (section.id === 'cover') continue;
            for (const link of section.querySelectorAll('a.xref-link[href^="#"], a[href^="#"]')) {
              const target = link.getAttribute('href').slice(1);
              if (target !== section.id && document.getElementById(target)) return [section.id, target];
            }
          }
          return null;
        }"""
    )
    assert pair, "fixture requires a rendered same-document cross-reference"
    return pair


def test_reader_workbench_sanitizes_state_and_never_requests_external_urls(page: Page, local_server):
    page.goto(f"{local_server}/index.html#dao")
    seed_state(page, {
        "version": 1,
        "preferences": {"font": "large", "leading": "relaxed", "focus": True, "contrast": "no"},
        "queue": ["dao", "dao", "not-a-record", 7], "saved": ["codec", "evil"],
        "recent": [{"id": "dao", "at": 9}, {"id": "dao", "at": 8}, {"id": "bad", "at": 10}],
        "compare": ["dao", "outside"], "last": "outside", "resume": "https://example.invalid/",
        "visits": {"dao": 4, "outside": 999999},
    })
    page.reload()
    requests: list[str] = []
    page.on("request", lambda request: requests.append(request.url))
    open_workbench(page)

    state = reader_state(page)
    assert state["queue"] == ["dao"] and state["saved"] == ["codec"]
    assert len(state["recent"]) == 1 and state["recent"][0]["id"] == "dao" and state["recent"][0]["at"] >= 9
    assert state["compare"] == ["dao", None] and state["last"] == "dao" and state["resume"] is None
    assert set(state["visits"]) == {"dao"}
    assert page.locator("html").evaluate("el => el.classList.contains('reader-font-large')")
    assert page.locator("html").evaluate("el => el.classList.contains('reader-leading-relaxed')")
    assert page.locator("html").evaluate("el => el.classList.contains('reader-focus')")
    page.get_by_role("button", name="Random record").click()
    assert not page.url.endswith("#dao"), "random selection must not stay on the current record when alternatives exist"
    assert all(urlparse(url).netloc in {"", urlparse(local_server).netloc} for url in requests)


def test_reader_workbench_route_saved_recent_comparison_and_local_storage_fallback(page: Page, local_server):
    page.goto(f"{local_server}/index.html#dao")
    open_workbench(page)
    page.get_by_role("button", name="Add to route").click()
    page.get_by_role("button", name="Save record").click()
    page.get_by_role("button", name="Compare left").click()
    page.get_by_role("button", name="Next record").click()
    page.get_by_role("button", name="Add to route").click()
    page.get_by_role("button", name="Compare right").click()
    state = reader_state(page)
    assert len(state["queue"]) == 2 and state["compare"] == ["dao", state["last"]]

    page.get_by_role("button", name="Reverse route").click()
    reversed_queue = reader_state(page)["queue"]
    assert reversed_queue == list(reversed(["dao", state["last"]]))
    page.locator('[data-reader-action="queue-down"]').first.click()
    assert reader_state(page)["queue"] == ["dao", state["last"]]
    page.get_by_role("button", name="Open first queued").click()
    assert page.url.endswith("#dao")
    page.get_by_role("button", name="Open next queued").click()
    assert page.url.endswith(f"#{state['last']}")
    page.get_by_role("button", name="Open previous queued").click()
    assert page.url.endswith("#dao")
    page.get_by_role("button", name="Swap sides").click()
    assert reader_state(page)["compare"] == [state["last"], "dao"]
    page.get_by_role("button", name="Clear comparison").click()
    page.get_by_role("button", name="Clear saved records").click()
    page.get_by_role("button", name="Clear recent history").click()
    page.get_by_role("button", name="Reset visit counters").click()
    cleared = reader_state(page)
    assert cleared["compare"] == [None, None] and cleared["saved"] == [] and cleared["recent"] == [] and cleared["visits"] == {}

    page.evaluate("""() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; }""")
    page.get_by_role("button", name="Add to route").click()
    expect(page.locator("[data-reader-import-summary]")).to_have_text("Browser storage is unavailable; this session is using memory only.")


def test_reader_workbench_preserves_real_prior_session_resume_destination(page: Page, local_server):
    page.goto(f"{local_server}/index.html#dao")
    source, target = rendered_xref_pair(page)
    seed_state(page, {"version": 1, "last": target, "visits": {target: 4}})
    page.goto(f"{local_server}/index.html?resume-test=1#{source}")
    open_workbench(page)
    expect(page.get_by_role("button", name="Resume previous")).to_be_visible()
    page.get_by_role("button", name="Resume previous").click()
    page.wait_for_url(f"**#{target}")
    page.wait_for_function("([key, expected]) => JSON.parse(localStorage.getItem(key)).last === expected", arg=[STATE_KEY, target])
    state = reader_state(page)
    assert state["resume"] == target and state["last"] == target


def test_reader_workbench_preferences_guidance_keyboard_search_inventory_and_counts(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html#dao")
    source, target = rendered_xref_pair(page)
    page.goto(f"{local_server}/index.html#{source}")
    page.keyboard.press("Control+K")
    expect(page.locator("#readerWorkbench")).to_be_visible()
    expect(page.locator("#readerWorkbenchClose")).to_be_focused()
    page.locator('[data-reader-preference="font"]').select_option("small")
    page.locator('[data-reader-preference="leading"]').select_option("tight")
    page.get_by_role("button", name="High contrast").click()
    page.get_by_role("button", name="Hide guidance").click()
    assert page.locator("html").evaluate("el => el.classList.contains('reader-font-small')")
    assert page.locator("html").evaluate("el => el.classList.contains('reader-leading-tight')")
    assert page.locator("html").evaluate("el => el.classList.contains('reader-contrast')")
    expect(page.locator("[data-reader-guidance]")).to_have_count(0)
    expect(page.locator("[data-reader-active-summary]")).to_contain_text("small type")
    expect(page.locator(".reader-workbench-meta")).to_contain_text("Inventory:")
    expect(page.locator(".reader-workbench-meta")).to_contain_text("Outgoing xrefs:")
    expect(page.locator(".reader-workbench-meta")).to_contain_text("Unvisited xrefs:")
    page.get_by_role("button", name="Open next queued").click()
    expect(page.locator("#readerWorkbenchStatus")).to_have_text("The reading route is empty.")
    search = page.locator('[data-reader-search]')
    search.fill("this-is-not-a-stable-record")
    expect(page.locator("[data-reader-search-results]")).to_have_text("No matching stable records.")
    search.fill(target)
    assert page.locator('[data-reader-search-result]').count() >= 1
    page.locator(f'[data-reader-search-result][data-id="{target}"]').click()
    page.wait_for_url(f"**#{target}")
    if page.locator("#readerWorkbench").is_hidden():
        page.keyboard.press("Control+K")
    expect(page.locator("#readerWorkbench")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    box = page.locator("#readerWorkbench").bounding_box()
    assert box and box["width"] == 375 and box["y"] + box["height"] == 812
    undersized = page.locator("#readerWorkbench button").evaluate_all("nodes => nodes.filter(node => node.getBoundingClientRect().height < 43.5).map(node => [node.textContent.trim(), node.getBoundingClientRect().height])")
    assert undersized == [], f"Workbench controls below 44px touch target (subpixel tolerance): {undersized}"
    page.keyboard.press("Escape")
    expect(page.locator("#readerWorkbench")).to_be_hidden()
    expect(page.locator("#readerWorkbenchToggle")).to_be_focused()
    page.reload()
    page.keyboard.press("Control+K")
    expect(page.locator("[data-reader-guidance]")).to_have_count(0)


def test_reader_workbench_import_copy_export_and_thread_atlas_boundary(page: Page, local_server):
    page.goto(f"{local_server}/index.html#dao")
    source, target = rendered_xref_pair(page)
    page.goto(f"{local_server}/index.html#{source}")
    page.evaluate("""() => {
      window.__readerCopies = [];
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: text => { window.__readerCopies.push(text); return Promise.resolve(); }}});
    }""")
    open_workbench(page)
    expected_ids = page.evaluate(
        """id => [...document.getElementById(id).querySelectorAll('a.xref-link[href^="#"],a[href^="#"]')]
          .map(link => link.getAttribute('href').slice(1))
          .filter((target, index, all) => document.getElementById(target) && target !== id && all.indexOf(target) === index)""",
        source,
    )
    assert page.locator("[data-atlas-link]").evaluate_all("nodes => nodes.map(node => node.dataset.id)") == expected_ids
    expect(page.locator(".reader-workbench-atlas")).to_contain_text("no semantic relationship is inferred")
    page.get_by_role("button", name="Copy Atlas evidence").click()
    page.get_by_role("button", name="Next unvisited citation").click()
    assert page.url.endswith(f"#{expected_ids[0]}")
    page.get_by_role("button", name="Add to route").click()
    page.get_by_role("button", name="Compare left").click()
    page.get_by_role("button", name="Copy route").click()
    page.get_by_role("button", name="Copy comparison pair").click()
    page.get_by_role("button", name="Copy stable link").click()
    copied = page.evaluate("window.__readerCopies")
    assert copied and all("#" in item for item in copied)
    assert any(f"#{expected_ids[0]}" in item for item in copied)
    assert all("<section" not in item and "Starsilk Compendium" not in item for item in copied)

    empty_atlas_id = page.evaluate(
        """() => [...document.querySelectorAll('main#mainContent section.page[id]')]
          .find(section => section.id !== 'cover' && ![...section.querySelectorAll('a.xref-link[href^="#"],a[href^="#"]')]
            .some(link => document.getElementById(link.getAttribute('href').slice(1))))?.id || null"""
    )
    assert empty_atlas_id, "fixture requires a record with no direct rendered citation"
    page.goto(f"{local_server}/index.html#{empty_atlas_id}")
    expect(page.locator("#readerWorkbench")).to_be_visible()
    page.get_by_role("button", name="Next unvisited citation").click()
    expect(page.locator("#readerWorkbenchStatus")).to_have_text("No unvisited direct citation remains.")

    import_input = page.locator('[data-reader-import]')
    import_input.set_input_files({"name": "bad.json", "mimeType": "application/json", "buffer": b'{"version": 99}'})
    expect(page.locator("#readerWorkbenchStatus")).to_have_text("Import rejected: expected a Reader Workbench v1 JSON export.")
    import_input.set_input_files({
        "name": "hostile.json", "mimeType": "application/json",
        "buffer": json.dumps({
            "version": 1, "queue": [source, source, "https://example.invalid/"],
            "saved": [target, "bogus"], "recent": [{"id": target, "at": 1}, {"id": "bogus", "at": 2}],
            "compare": [source, "bogus"], "last": "bogus", "resume": target,
            "visits": {target: 2, "bogus": 4}, "preferences": {"font": "large", "leading": "relaxed", "open": True},
        }).encode(),
    })
    expect(page.locator("[data-reader-import-summary]")).to_contain_text("Imported sanitized local state: 1 route, 1 saved, 1 recent, 1 visit counters.")
    state = reader_state(page)
    assert state["queue"] == [source] and state["saved"] == [target] and state["compare"] == [source, None]
    assert state["last"] is None and state["resume"] == target and state["visits"] == {target: 2}
    with page.expect_download() as download_info:
        page.get_by_role("button", name="Export local state").click()
    download = download_info.value
    payload = json.loads(Path(download.path()).read_text(encoding="utf-8"))
    assert payload["version"] == 1 and "prose" not in payload and "html" not in payload


def test_reader_workbench_reduced_motion_actions_use_instant_scroll(page: Page, local_server):
    page.emulate_media(reduced_motion="reduce")
    page.add_init_script("""
      window.__readerScrolls = [];
      HTMLElement.prototype.scrollIntoView = function(options) { window.__readerScrolls.push(options); };
      window.scrollTo = options => window.__readerScrolls.push(options);
    """)
    page.goto(f"{local_server}/index.html#dao")
    open_workbench(page)
    page.evaluate("window.__readerScrolls = []")
    page.get_by_role("button", name="Jump to current").click()
    page.get_by_role("button", name="Back to top").click()
    scrolls = page.evaluate("window.__readerScrolls")
    assert len(scrolls) == 2 and all(scroll["behavior"] == "auto" for scroll in scrolls)
