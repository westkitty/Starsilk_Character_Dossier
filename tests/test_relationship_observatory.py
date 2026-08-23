import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
REL_DIR = DOCS / "relationships"
EXPECTED_FILES = {
    "index.html",
    "relationships.css",
    "relationships.json",
    "relationships.md",
    "AUTHORITY.md",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def evidence_fragment(url: str) -> str:
    return urlsplit(url).fragment


def test_relationship_publication_file_set_is_exact_and_build_owned():
    actual = {
        path.relative_to(REL_DIR).as_posix()
        for path in REL_DIR.rglob("*")
        if path.is_file()
    }
    assert actual == EXPECTED_FILES

    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert "build/relationship_publication.py" in build
    assert "docs/relationships" in build

    proc = subprocess.run(
        [sys.executable, "build/relationship_publication.py", "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "relationship publication outputs match generator output" in proc.stdout


def test_relationship_publication_outputs_have_no_trailing_whitespace():
    for name in EXPECTED_FILES:
        text = (REL_DIR / name).read_text(encoding="utf-8")
        assert text.endswith("\n")
        for line_number, line in enumerate(text.splitlines(), start=1):
            assert line == line.rstrip(" \t"), f"{name}:{line_number} has trailing whitespace"


def test_relationship_model_is_same_observed_graph_with_evidence_not_semantic_promotion():
    model = read_json(REL_DIR / "relationships.json")
    graph = read_json(DOCS / "machine/relationships.json")
    entities = read_json(DOCS / "machine/entities.json")["records"]
    ids = {record["stable_id"] for record in entities}

    assert model["schema"] == "starsilk-relationship-observatory/1"
    assert model["schema_url"] == SITE_BASE + "machine/schema/v1/relationship-observatory.schema.json"
    assert model["project_id"] == "starsilk-character-dossier"
    assert model["canonical_url"] == SITE_BASE + "relationships/"
    assert model["relationship_graph_url"] == SITE_BASE + "machine/relationships.json"
    assert model["entity_count"] == len(entities) == 127
    assert model["relationship_count"] == graph["relationship_count"] == len(model["relationships"])
    assert model["relationship_count"] == 136
    assert 0 <= model["connected_entity_count"] <= model["entity_count"]

    graph_pairs = {(item["source"], item["target"]) for item in graph["relationships"]}
    model_pairs = {(item["source"], item["target"]) for item in model["relationships"]}
    assert model_pairs == graph_pairs

    edge_ids = []
    for relation in model["relationships"]:
        source = relation["source"]
        target = relation["target"]
        edge_ids.append(relation["edge_id"])
        assert source in ids and target in ids and source != target
        assert relation["edge_id"] == f"mention--{source}--{target}"
        assert relation["kind"] == "mentions"
        assert relation["evidence_class"] == "observed-xref"
        assert relation["canonical_url"] == SITE_BASE + f"relationships/#mention--{source}--{target}"
        assert relation["source_url"] == SITE_BASE + f"entities/{source}/"
        assert relation["target_url"] == SITE_BASE + f"entities/{target}/"
        assert relation["source_ref"] == f"src/content/sections/{source}.body.html"
        assert relation["public_evidence_url"].startswith(SITE_BASE + "#xref-")
        assert evidence_fragment(relation["public_evidence_url"])
        assert relation["observed_href"] == f"#{target}"
    assert len(edge_ids) == len(set(edge_ids))

    rendered = json.dumps(model).lower()
    for forbidden in ("friend", "enemy", "parent", "child", "creator", "member_of", "caused_by"):
        assert f'"kind": "{forbidden}"' not in rendered
    assert any("semantic relationship" in item.lower() for item in model["unknowns"])
    assert any("section-subtree" in item.lower() for item in model["unknowns"])


def test_every_observatory_edge_resolves_to_exact_generated_compendium_xref_inside_source_subtree():
    model = read_json(REL_DIR / "relationships.json")
    soup = BeautifulSoup((DOCS / "index.html").read_text(encoding="utf-8"), "lxml")
    physical_xrefs = soup.select("a.xref-link[id]")
    physical_ids = [link.get("id") for link in physical_xrefs]

    assert physical_ids
    assert len(physical_ids) == len(set(physical_ids))

    for relation in model["relationships"]:
        source = relation["source"]
        target = relation["target"]
        evidence_id = evidence_fragment(relation["public_evidence_url"])
        matches = soup.find_all("a", id=evidence_id)
        assert len(matches) == 1
        link = matches[0]
        source_section = soup.find("section", id=source)
        assert source_section is not None
        assert link in source_section.find_all("a", class_="xref-link", href=f"#{target}")
        assert "xref-link" in (link.get("class") or [])
        assert link.get("href") == f"#{target}"
        assert link.get("data-xref-target") == target
        assert link.get("data-xref-source")


def test_human_observatory_exposes_direction_deep_links_zero_states_and_text_alternative():
    model = read_json(REL_DIR / "relationships.json")
    html = (REL_DIR / "index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")

    assert soup.find("main", id="main") is not None
    assert soup.find("script") is None
    assert soup.find("link", {"rel": "alternate", "type": "application/json", "href": "relationships.json"}) is not None
    assert soup.find("link", {"rel": "alternate", "type": "text/markdown", "href": "relationships.md"}) is not None
    assert "Nothing here asserts friendship" in html
    assert "Zero counts are meaningful" in html

    entity_sections = soup.select("article.relationship-record[data-stable-id]")
    assert len(entity_sections) == model["entity_count"]
    for entity in model["entities"]:
        assert soup.find(id=f"entity-{entity['stable_id']}") is not None

    edge_nodes = soup.select("li.relationship-edge[data-relationship='mentions'][data-evidence-class='observed-xref']")
    assert len(edge_nodes) == model["relationship_count"]
    assert len({node.get("id") for node in edge_nodes}) == model["relationship_count"]

    markdown = (REL_DIR / "relationships.md").read_text(encoding="utf-8")
    assert "# Starsilk Compendium — Relationship Observatory" in markdown
    assert "Every edge is `mentions / observed-xref`" in markdown
    assert "### Outgoing observed mentions" in markdown
    assert "### Incoming observed mentions" in markdown
    assert "published xref evidence" in markdown
    assert "None observed." in markdown
    assert "section subtree" in markdown.lower()


def test_relationship_schema_and_authority_lock_observed_only_contract():
    schema = read_json(ROOT / "src/schema/relationship-observatory.schema.json")
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    relation = schema["properties"]["relationships"]["items"]["properties"]
    assert relation["kind"] == {"const": "mentions"}
    assert relation["evidence_class"] == {"const": "observed-xref"}

    published_schema = read_json(DOCS / "machine/schema/v1/relationship-observatory.schema.json")
    assert published_schema == schema

    authority = (REL_DIR / "AUTHORITY.md").read_text(encoding="utf-8")
    assert "It is not a semantic relationship database" in authority
    assert "kind: mentions" in authority
    assert "evidence_class: observed-xref" in authority
    assert "section-subtree projection" in authority
    assert "must not guess" in authority


def test_entity_publication_discovers_observatory_without_replacing_existing_relationship_links():
    entity_index = (DOCS / "entities/index.html").read_text(encoding="utf-8")
    codec = (DOCS / "entities/codec/index.html").read_text(encoding="utf-8")
    assert 'href="../relationships/"' in entity_index
    assert 'href="../../relationships/"' in codec
    assert 'data-relationship="mentions"' in codec
    assert '../dao/' in codec


def test_relationship_public_boundary_guard_passes_real_outputs():
    proc = subprocess.run(
        [sys.executable, "tools/check_public_boundary.py", "docs/relationships"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "Public-boundary check OK" in proc.stdout


def test_relationship_observatory_runtime_deep_link_and_mobile_layout(page: Page, local_server):
    model = read_json(REL_DIR / "relationships.json")
    relation = next(item for item in model["relationships"] if item["source"] == "codec" and item["target"] == "dao")
    edge_id = relation["edge_id"]
    page.set_viewport_size({"width": 1280, "height": 800})
    page.goto(f"{local_server}/relationships/#{edge_id}")
    edge = page.locator(f"#{edge_id}")
    expect(edge).to_be_visible()
    expect(edge.locator("a", has_text="Published xref evidence")).to_have_attribute("href", relation["public_evidence_url"])
    expect(page.locator("#entity-codec")).to_be_visible()

    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/relationships/#entity-codec")
    expect(page.locator("#entity-codec")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
