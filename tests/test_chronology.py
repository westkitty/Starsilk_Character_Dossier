import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CHRONOLOGY = DOCS / "chronology"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
EXPECTED_FILES = {"index.html", "chronology.css", "chronology.js", "chronology.json", "chronology.md", "schema.json", "AUTHORITY.md"}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_chronology_is_exact_build_owned_and_deterministic():
    actual = {path.relative_to(CHRONOLOGY).as_posix() for path in CHRONOLOGY.rglob("*") if path.is_file()}
    assert actual == EXPECTED_FILES
    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert "build/chronology_publication.py" in build and "docs/chronology" in build
    proc = subprocess.run([sys.executable, "build/chronology_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_every_event_is_directly_source_backed_and_preserves_authored_markers():
    source = read_json(ROOT / "src/chronology/events.json")
    model = read_json(CHRONOLOGY / "chronology.json")
    body = BeautifulSoup((ROOT / "src/content/sections/chronology.body.html").read_text(encoding="utf-8"), "html.parser").get_text(" ", strip=True)
    assert model["event_count"] == len(source["events"]) == len(model["events"]) == 27
    assert model["source_record"] == {"stable_id": "chronology", "source_key": "five-phase-canon-chronology", "path": "src/content/sections/chronology.body.html", "canonical_url": SITE_BASE + "entities/chronology/", "legacy_url": SITE_BASE + "#chronology"}
    for spec, event in zip(source["events"], model["events"]):
        assert spec["label"] in body and spec["source_heading"] in body
        assert event["event_id"] == spec["event_id"] and event["label"] == spec["label"]
        assert event["source"]["stable_record_id"] == "chronology"
        assert event["source"]["heading"] == spec["source_heading"]
        assert event["canonical_url"] == SITE_BASE + f"chronology/#event-{event['event_id']}"
        assert event["temporal"] == spec["temporal"]
        assert event["temporal"]["absolute_date"] is None
    markers = {event["event_id"]: event["temporal"] for event in model["events"]}
    assert markers["first-contact"]["exact_authored_marker"] == "Year 0"
    assert markers["long-attrition"]["exact_authored_marker"] == "Years 7–120"
    assert markers["first-dirt"]["relative_marker"] == "31 days post-war"
    assert markers["breach-zentrum"]["relative_marker"] == "256 years later"
    assert markers["blood-eclipse-war"]["duration"] == {"authored_text": "one hundred seventy years", "value": 170, "unit": "years"}


def test_status_dimensions_and_unknown_temporal_data_are_independent():
    model = read_json(CHRONOLOGY / "chronology.json")
    for event in model["events"]:
        assert event["visibility"] == "public"
        assert event["canon_status"] == "unknown"
        assert event["spoiler_level"] == "unknown"
        assert event["status_provenance"]["canon_status"] == "no structured event canon status is authored"
        assert event["temporal"]["absolute_date"] is None
    unknowns = [event for event in model["events"] if event["temporal"]["certainty"] == "unknown"]
    assert unknowns and all(event["temporal"]["exact_authored_marker"] is None and event["temporal"]["relative_marker"] is None for event in unknowns)
    assert {event["temporal"]["certainty"] for event in model["events"]} == {"unknown", "authored-duration", "exact-authored-marker", "relative-authored-marker"}


def test_schema_surface_machine_discovery_and_boundary_contract():
    source_schema = read_json(ROOT / "src/schema/chronology-index.schema.json")
    model = read_json(CHRONOLOGY / "chronology.json")
    assert read_json(CHRONOLOGY / "schema.json") == source_schema
    assert read_json(DOCS / "machine/schema/v1/chronology-index.schema.json") == source_schema
    assert source_schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert set(source_schema["required"]) <= set(model)
    for event in model["events"]:
        assert set(source_schema["$defs"]["event"]["required"]) <= set(event)
        assert set(source_schema["$defs"]["temporal"]["required"]) <= set(event["temporal"])
    index = read_json(DOCS / "machine/index.json")
    assert index["endpoints"]["chronology"] == SITE_BASE + "chronology/"
    assert index["endpoints"]["chronology_index"] == SITE_BASE + "chronology/chronology.json"
    assert SITE_BASE + "chronology/chronology.json" in index["public_urls"]
    assert "chronology-index" in index["schemas"]
    assert 'href="../chronology/"' in (DOCS / "entities/index.html").read_text(encoding="utf-8")
    proc = subprocess.run([sys.executable, "tools/check_public_boundary.py", "docs/chronology"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_chronology_filters_only_change_view_and_deep_links_work(page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/chronology/?temporal=exact-authored-marker#event-first-contact")
    first = page.locator("#event-first-contact")
    expect(first).to_be_visible()
    expect(page.locator("#chronologyStatus")).to_contain_text("5 of 27 events")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#temporalFilter").select_option("unknown")
    expect(first).to_be_hidden()
    assert read_json(CHRONOLOGY / "chronology.json")["events"][10]["temporal"]["exact_authored_marker"] == "Year 0"
    page.locator("#resetFilters").click()
    expect(first).to_be_visible()
    expect(page.locator("#visibilityFilter")).to_be_focused()
