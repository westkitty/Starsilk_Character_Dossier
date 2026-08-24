import json
import re
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"


def load_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def test_worldsvault_generator_is_deterministic_and_build_owned():
    proc = subprocess.run([sys.executable, "build/worldsvault_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "7 WorldsVault outputs match generator output" in proc.stdout
    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert "build/worldsvault_publication.py" in build
    assert "docs/worldsvault" in build


def test_topology_is_source_backed_direct_and_has_no_canonical_spatial_precision():
    model = load_json("docs/worldsvault/worldsvault.json")
    schema = load_json("src/schema/worldsvault-topology.schema.json")
    source = load_json("src/worldsvault/topology.json")
    assert model["schema"] == "starsilk-worldsvault-topology/1"
    assert model["schema_url"] == SITE_BASE + "machine/schema/v1/worldsvault-topology.schema.json"
    assert model["node_count"] == len(model["nodes"]) == len(source["nodes"]) == 11
    assert model["edge_count"] == len(model["edges"]) == len(source["edges"]) == 6
    assert schema["$id"] == model["schema_url"]
    assert len({node["node_id"] for node in model["nodes"]}) == model["node_count"]
    assert len({edge["edge_id"] for edge in model["edges"]}) == model["edge_count"]
    node_ids = {node["node_id"] for node in model["nodes"]}
    for node in model["nodes"]:
        assert node["certainty"] == "direct-authored"
        assert node["status"] == {"visibility": "public", "canon_status": "unknown", "spoiler_level": "unknown"}
        assert node["canonical_url"] == SITE_BASE + f"worldsvault/#node-{node['node_id']}"
        assert node["layout"]["coordinate_status"] == "non-canonical rendering order only"
        assert set(node["layout"]) == {"rendering_group", "rendering_order", "coordinate_status"}
        assert not ({"x", "y", "latitude", "longitude", "distance", "direction"} & set(node["layout"]))
        assert node["identity_status"] in {"existing-authored-stable-id", "publication-derived"}
        body = (ROOT / node["source"]["path"]).read_text(encoding="utf-8")
        assert node["source"]["heading"] in BeautifulSoup(body, "lxml").get_text(" ", strip=True)
    for edge in model["edges"]:
        assert edge["source"] in node_ids and edge["target"] in node_ids
        assert edge["relation_class"] == "direct-authored-topology"
        assert edge["certainty"] == "direct-authored"
        assert edge["status"] == {"visibility": "public", "canon_status": "unknown", "spoiler_level": "unknown"}
        assert edge["edge_id"] == f"{edge['relation']}--{edge['source']}--{edge['target']}"
        body = (ROOT / edge["source_evidence"]["path"]).read_text(encoding="utf-8")
        assert edge["source_evidence"]["heading"] in BeautifulSoup(body, "lxml").get_text(" ", strip=True)
    rendered = json.dumps(model).lower()
    assert "coordinate_status" in rendered and "non-canonical" in rendered
    assert "observed-xref" in rendered
    assert not re.search(r'"(?:x|y|latitude|longitude|distance|direction)"\s*:', rendered)


def test_existing_publication_id_and_observed_xref_boundaries_are_preserved():
    entities = load_json("docs/machine/entities.json")
    relationships = load_json("docs/machine/relationships.json")
    assert entities["record_count"] == len(entities["records"]) == 127
    section_ids = [section["id"] for section in load_json("src/content/sections.json")["sections"]]
    assert [record["stable_id"] for record in entities["records"]] == section_ids
    assert relationships["relationship_count"] == len(relationships["relationships"])
    assert all(edge["kind"] == "mentions" and edge["evidence_class"] == "observed-xref" for edge in relationships["relationships"])
    topology = load_json("docs/worldsvault/worldsvault.json")
    assert all(edge["relation_class"] != "observed-xref" for edge in topology["edges"])


def test_worldsvault_human_surface_has_text_equivalent_sources_and_safe_client_code():
    html = (DOCS / "worldsvault/index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")
    model = load_json("docs/worldsvault/worldsvault.json")
    assert soup.select_one("#text-heading")
    assert soup.select_one("#topologyStatus").get("aria-live") == "polite"
    assert soup.select_one("#clearSelection")
    assert soup.select_one("a[href='worldsvault.json']")
    for node in model["nodes"]:
        card = soup.select_one(f"#node-{node['node_id']}")
        assert card and card.get("tabindex") == "0"
        assert card.select_one(f"a[href='{node['source']['canonical_url']}']")
    for edge in model["edges"]:
        item = soup.select_one(f"#edge-{edge['edge_id']}")
        assert item and item.get("data-source") == edge["source"] and item.get("data-target") == edge["target"]
        assert item.select_one(f"a[href='{edge['source_evidence']['canonical_url']}']")
    js = (DOCS / "worldsvault/worldsvault.js").read_text(encoding="utf-8")
    assert "fetch(" not in js and "XMLHttpRequest" not in js and "navigator.sendBeacon" not in js
    assert "keydown" in js and "Enter" in js and "clearSelection" in js
