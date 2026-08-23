import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
DISCOVER = DOCS / "discover"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
BASE_FILES = {"index.html", "discovery.css", "discovery.js", "discovery.json", "discovery.md", "context-packets.json", "schema.json", "context-packet.schema.json", "context-packet-index.schema.json", "AUTHORITY.md"}

def read_json(path: Path): return json.loads(path.read_text(encoding="utf-8"))

def test_discovery_file_set_is_exact_build_owned_and_deterministic():
    entities = read_json(DOCS / "machine/entities.json")["records"]
    expected = BASE_FILES | {f"packets/{record['stable_id']}.json" for record in entities}
    actual = {path.relative_to(DISCOVER).as_posix() for path in DISCOVER.rglob("*") if path.is_file()}
    assert actual == expected
    assert len(actual) == 10 + len(entities) == 137
    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert "build/discovery_publication.py" in build and "docs/discover" in build
    proc = subprocess.run([sys.executable, "build/discovery_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "discovery outputs match generator output" in proc.stdout

def test_discovery_records_are_source_backed_and_preserve_existing_identity_and_status():
    discovery = read_json(DISCOVER / "discovery.json")
    machine_records = read_json(DOCS / "machine/entities.json")["records"]
    sections = read_json(ROOT / "src/content/sections.json")["sections"]
    nav = read_json(ROOT / "src/content/nav.json")
    by_id = {record["stable_id"]: record for record in machine_records}
    section_by_id = {record["id"]: record for record in sections}
    nav_by_id = {link["id"]: group["label"] for group in nav["groups"] for link in group["links"]}
    assert discovery["schema"] == "starsilk-discovery-index/1"
    assert discovery["record_count"] == len(machine_records) == 127
    assert [item["stable_id"] for item in discovery["records"]] == [item["stable_id"] for item in machine_records]
    for item in discovery["records"]:
        source = by_id[item["stable_id"]]; section = section_by_id[item["stable_id"]]
        assert item["display_label"] == source["display_label"] and item["canonical_url"] == source["canonical_url"]
        assert item["legacy_url"] == SITE_BASE + "#" + item["stable_id"] and item["result_class"] == source["object_type"]
        assert item["navigation_group"] == nav_by_id.get(item["stable_id"])
        assert item["archetype"] == section.get("attrs", {}).get("data-archetype")
        assert item["has_media"] == bool(source["related_media_ids"]) and item["media_count"] == len(source["related_media_ids"])
        assert item["excerpt_source_ref"] == f"src/content/sections/{item['stable_id']}.body.html" and len(item["excerpt"]) <= 321

def test_context_packets_are_compact_derivatives_not_new_authority():
    entities = read_json(DOCS / "machine/entities.json")["records"]
    relationships = read_json(DOCS / "machine/relationships.json"); outgoing = relationships.get("outgoing", {}); incoming = relationships.get("backlinks", {})
    for source in entities:
        stable_id = source["stable_id"]; packet = read_json(DISCOVER / "packets" / f"{stable_id}.json")
        assert packet["stable_id"] == stable_id and packet["canonical_url"] == source["canonical_url"]
        assert packet["visibility"] == source["visibility"] and packet["canon_status"] == source["canon_status"] and packet["spoiler_level"] == source["spoiler_level"]
        assert packet["related_media_ids"] == source["related_media_ids"] and packet["source_refs"] == source["source_refs"]
        assert packet["observed_relationships"] == {"kind": "mentions", "evidence_class": "observed-xref", "outgoing_stable_ids": outgoing.get(stable_id, []), "incoming_stable_ids": incoming.get(stable_id, [])}
        assert "convenience packet" in packet["authority_note"] and "not new canon prose" in packet["authority_note"]
    dao = read_json(DISCOVER / "packets/dao.json")
    assert dao["canon_status"] == "unknown" and dao["observed_relationships"]["kind"] == "mentions" and dao["observed_relationships"]["evidence_class"] == "observed-xref"

def test_discovery_human_machine_schema_and_public_boundary_surfaces():
    html = (DISCOVER / "index.html").read_text(encoding="utf-8"); soup = BeautifulSoup(html, "lxml")
    assert soup.find("main", id="main") is not None and soup.find("form", id="discoveryFilters") is not None
    assert len(soup.select("article.discovery-result-card[data-stable-id]")) == 127
    assert "without replacing the complete Compendium search" in html and "mechanical projections" in html
    authority = (DISCOVER / "AUTHORITY.md").read_text(encoding="utf-8")
    assert "discovery convenience layer" in authority and "Search matches, facet inclusion, result ordering, and no-result states are retrieval behavior only" in authority and "Packets never outrank their cited sources" in authority
    for name in ("discovery-index.schema.json", "context-packet.schema.json", "context-packet-index.schema.json"):
        source = read_json(ROOT / "src/schema" / name); assert read_json(DOCS / "machine/schema/v1" / name) == source
    index = read_json(DOCS / "machine/index.json")
    assert index["endpoints"]["discovery"] == SITE_BASE + "discover/" and index["endpoints"]["discovery_index"] == SITE_BASE + "discover/discovery.json" and index["endpoints"]["context_packet_index"] == SITE_BASE + "discover/context-packets.json"
    assert SITE_BASE + "discover/" in index["public_urls"] and SITE_BASE + "discover/packets/dao.json" in index["public_urls"]
    llms = (DOCS / "llms.txt").read_text(encoding="utf-8"); assert "Human faceted discovery:" in llms and "AI context packet pattern:" in llms
    entity_index = (DOCS / "entities/index.html").read_text(encoding="utf-8"); assert 'href="../discover/"' in entity_index
    proc = subprocess.run([sys.executable, "tools/check_public_boundary.py", "docs/discover"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr

def test_discovery_facets_deep_link_keyboard_and_mobile(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/discover/?class=character-section&q=Dao#result-dao")
    expect(page.locator("#result-dao")).to_be_visible(); expect(page.locator("#discoveryStatus")).to_contain_text("1 of 127 records")
    expect(page.locator("#discoveryQuery")).to_have_value("Dao"); expect(page.locator("#classFacet")).to_have_value("character-section")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.locator("#resetFilters").click(); expect(page.locator("#discoveryStatus")).to_contain_text("127 of 127 records"); expect(page.locator("#discoveryQuery")).to_be_focused()
    page.locator("#discoveryQuery").fill("Codec"); page.keyboard.press("ArrowDown"); expect(page.locator("#result-codec .result-link")).to_be_focused()
