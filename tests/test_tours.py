import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
TOURS = DOCS / "tours"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
BASE_FILES = {"index.html", "tours.css", "tours.js", "tours.json", "schema.json", "AUTHORITY.md"}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_tour_file_set_is_exact_build_owned_and_deterministic():
    actual = {path.relative_to(TOURS).as_posix() for path in TOURS.rglob("*") if path.is_file()}
    assert actual == BASE_FILES
    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert "build/tour_publication.py" in build and "docs/tours" in build
    proc = subprocess.run([sys.executable, "build/tour_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "tour outputs match generator output" in proc.stdout


def test_curated_tours_derive_only_from_stable_bindings_and_authored_navigation():
    source = read_json(ROOT / "src/tours/tours.json")
    nav = read_json(ROOT / "src/content/nav.json")
    entities = read_json(DOCS / "machine/entities.json")["records"]
    index = read_json(TOURS / "tours.json")
    groups = {group["label"]: group for group in nav["groups"]}
    labels = {record["stable_id"]: record["display_label"] for record in entities}
    urls = {record["stable_id"]: record["canonical_url"] for record in entities}

    assert index["schema"] == "starsilk-tour-index/1"
    assert index["tour_count"] == len(source["tours"]) == 6
    assert [tour["tour_id"] for tour in index["tours"]] == [spec["tour_id"] for spec in source["tours"]]
    for spec, tour in zip(source["tours"], index["tours"]):
        group = groups[spec["navigation_group"]]
        expected_ids = [link["id"] for link in group["links"]]
        assert tour["tour_id"] == spec["tour_id"]
        assert tour["label"] == group["label"] == tour["navigation_group"]
        assert tour["stop_count"] == len(expected_ids) == len(tour["stops"])
        assert [stop["stable_id"] for stop in tour["stops"]] == expected_ids
        assert [stop["position"] for stop in tour["stops"]] == list(range(1, len(expected_ids) + 1))
        for stop in tour["stops"]:
            assert set(stop) == {"position", "stable_id", "display_label", "canonical_url", "legacy_url", "source_ref"}
            assert stop["display_label"] == labels[stop["stable_id"]]
            assert stop["canonical_url"] == urls[stop["stable_id"]]
            assert stop["legacy_url"] == SITE_BASE + "#" + stop["stable_id"]
            assert stop["source_ref"] == "src/content/nav.json"
    rendered = json.dumps(index)
    for forbidden in ("body_html", "excerpt", "description", "canon_status", "spoiler_level"):
        assert f'"{forbidden}"' not in rendered


def test_tour_authority_machine_discovery_and_privacy_contract():
    index = read_json(TOURS / "tours.json")
    assert index["local_state_policy"] == {
        "scope": "browser-local",
        "account_required": False,
        "analytics_or_telemetry": False,
        "published": False,
        "private_text_in_urls": False,
    }
    authority = (TOURS / "AUTHORITY.md").read_text(encoding="utf-8")
    assert "editorial navigation" in authority
    assert "Tour order is navigation order only" in authority
    assert "no analytics, telemetry, beacon, or server write" in authority
    assert "never serialized into public URLs" in authority
    script = (TOURS / "tours.js").read_text(encoding="utf-8")
    assert "localStorage" in script
    assert "fetch(" not in script and "XMLHttpRequest" not in script and "sendBeacon" not in script

    source_schema = read_json(ROOT / "src/schema/tour-index.schema.json")
    assert read_json(TOURS / "schema.json") == source_schema
    assert read_json(DOCS / "machine/schema/v1/tour-index.schema.json") == source_schema
    machine = read_json(DOCS / "machine/index.json")
    assert machine["endpoints"]["tours"] == SITE_BASE + "tours/"
    assert machine["endpoints"]["tour_index"] == SITE_BASE + "tours/tours.json"
    for url in (SITE_BASE + "tours/", SITE_BASE + "tours/tours.json", SITE_BASE + "tours/schema.json", SITE_BASE + "tours/AUTHORITY.md"):
        assert url in machine["public_urls"]
    llms = (DOCS / "llms.txt").read_text(encoding="utf-8")
    assert "Human curated tours and local library:" in llms and "Curated tour JSON index:" in llms
    assert "browser-local" in llms and "not serialized into public URLs" in llms
    entity_index = (DOCS / "entities/index.html").read_text(encoding="utf-8")
    assert 'href="../tours/"' in entity_index
    discovery = (DOCS / "discover/index.html").read_text(encoding="utf-8")
    assert 'href="../tours/"' in discovery
    proc = subprocess.run([sys.executable, "tools/check_public_boundary.py", "docs/tours"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_tour_human_surface_contains_stable_routes_without_duplicate_prose():
    html = (TOURS / "index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")
    assert soup.find("main", id="main") is not None
    assert len(soup.select("article.tour-card[data-tour-id]")) == 6
    index = read_json(TOURS / "tours.json")
    expected_stops = sum(tour["stop_count"] for tour in index["tours"])
    assert len(soup.select(".tour-stops li[data-stable-id]")) == expected_stops
    assert soup.find(id="localLibrary") is not None
    assert "tour order is navigation, not chronology or relationship evidence" in html
    assert "No account, analytics, telemetry, or server write is used" in html


def test_local_library_persists_without_private_url_or_external_requests(page: Page, local_server):
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/tours/#tour-principal-characters")
    page.evaluate("localStorage.clear()")
    page.reload()
    expect(page.locator("#tour-principal-characters")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    page.locator("#libraryRecord").select_option("codec")
    page.locator("#bookmarkSelected").click()
    expect(page.locator("#bookmarksList")).to_contain_text("Codec")

    private_name = "Private Test Collection"
    page.locator("#collectionName").fill(private_name)
    page.locator("#createCollection").click()
    expect(page.locator("#collectionSelect")).to_contain_text(private_name)
    page.locator("#addSelectedToCollection").click()
    expect(page.locator("#collectionsList")).to_contain_text(private_name)
    expect(page.locator("#collectionsList")).to_contain_text("Codec")
    assert private_name not in page.url

    first_checkbox = page.locator("#tour-principal-characters input[data-tour-progress]").first
    first_checkbox.check()
    page.reload()
    expect(page.locator("#bookmarksList")).to_contain_text("Codec")
    expect(page.locator("#collectionsList")).to_contain_text(private_name)
    expect(page.locator("#tour-principal-characters input[data-tour-progress]").first).to_be_checked()

    page.locator("#libraryRecord").select_option("codec")
    page.locator("#openSelected").click()
    expect(page).to_have_url(f"{local_server}/entities/codec/")
    page.go_back()
    expect(page.locator("#recentList")).to_contain_text("Codec")
    expect(page.locator("#historyList")).to_contain_text("Codec")
    assert all(url.startswith(local_server) for url in requests)

    page.locator("#clearLocalData").click()
    expect(page.locator("#bookmarksEmpty")).to_be_visible()
    expect(page.locator("#collectionsEmpty")).to_be_visible()
