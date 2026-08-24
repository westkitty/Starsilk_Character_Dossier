import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
ENTITIES = DOCS / "entities"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"

sys.path.insert(0, str(ROOT / "build"))
import generate  # noqa: E402


def load_sections():
    return generate.load_sections(generate.load_media_rename_map())


def load_records():
    return json.loads((DOCS / "machine/entities.json").read_text(encoding="utf-8"))["records"]


def load_graph():
    return json.loads((DOCS / "machine/relationships.json").read_text(encoding="utf-8"))


def normalized_text(fragment: str) -> str:
    return " ".join(BeautifulSoup(fragment, "html.parser").stripped_strings)


def entity_page(stable_id: str) -> BeautifulSoup:
    return BeautifulSoup((ENTITIES / stable_id / "index.html").read_text(encoding="utf-8"), "html.parser")


def test_entity_tree_is_exactly_one_page_per_authored_top_level_record():
    ids = [section.id for section in load_sections()]
    expected = {"entity.css", "index.html"} | {f"{stable_id}/index.html" for stable_id in ids}
    actual = {
        path.relative_to(ENTITIES).as_posix()
        for path in ENTITIES.rglob("*")
        if path.is_file()
    }
    assert actual == expected
    assert len(ids) == len(set(ids)) == len(load_records())


def test_entity_publication_is_deterministic_against_committed_output():
    proc = subprocess.run(
        [sys.executable, "build/entity_publication.py", "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "entity permalink outputs match generator output" in proc.stdout


def test_entity_index_exposes_every_stable_permalink_once():
    records = load_records()
    soup = BeautifulSoup((ENTITIES / "index.html").read_text(encoding="utf-8"), "html.parser")
    assert soup.find("main", id="main") is not None
    assert soup.find("link", rel="canonical")["href"] == SITE_BASE + "entities/"
    links = [link.get("href") for link in soup.select(".entity-index-grid a")]
    assert links == [f"{record['stable_id']}/" for record in records]
    assert len(links) == len(set(links)) == len(records)


def test_every_permalink_has_canonical_machine_alternatives_and_legacy_location():
    for record in load_records():
        stable_id = record["stable_id"]
        soup = entity_page(stable_id)
        canonical = f"{SITE_BASE}entities/{stable_id}/"
        legacy = f"{SITE_BASE}#{stable_id}"
        assert record["canonical_url"] == canonical
        assert soup.find("link", rel="canonical")["href"] == canonical
        alternates = {
            link.get("type"): link.get("href")
            for link in soup.find_all("link", rel="alternate")
        }
        assert alternates == {
            "application/json": f"{SITE_BASE}machine/entities/{stable_id}.json",
            "text/markdown": f"{SITE_BASE}machine/entities/{stable_id}.md",
        }
        legacy_links = [link.get("href") for link in soup.find_all("a") if "Compendium" in link.get_text(" ", strip=True)]
        assert legacy in legacy_links
        article = soup.select_one(f'article[data-stable-id="{stable_id}"]')
        assert article is not None


def test_entity_pages_preserve_authoritative_source_text():
    by_id = {section.id: section for section in load_sections()}
    for record in load_records():
        stable_id = record["stable_id"]
        source = normalized_text(by_id[stable_id].body_html)
        page = entity_page(stable_id)
        published = page.find(id="entitySource")
        assert published is not None
        assert " ".join(published.stripped_strings) == source


def test_root_compendium_retains_every_original_stable_anchor():
    root = BeautifulSoup((DOCS / "index.html").read_text(encoding="utf-8"), "lxml")
    ids = [record["stable_id"] for record in load_records()]
    for stable_id in ids:
        assert root.find("section", id=stable_id) is not None


def test_known_section_xrefs_route_to_canonical_entity_pages_without_semantic_promotion():
    ids = {record["stable_id"] for record in load_records()}
    by_id = {section.id: section for section in load_sections()}
    for stable_id, section in by_id.items():
        source = BeautifulSoup(section.body_html, "html.parser")
        local_ids = {node.get("id") for node in source.find_all(id=True)}
        expected_targets = {
            link["href"][1:]
            for link in source.find_all("a", href=True)
            if link["href"].startswith("#")
            and link["href"][1:] in ids
            and link["href"][1:] not in local_ids
        }
        page = entity_page(stable_id)
        actual_hrefs = {link.get("href") for link in page.select("#entitySource a[href]")}
        for target in expected_targets:
            assert f"../{target}/" in actual_hrefs


def test_related_media_is_exactly_manifest_backed_record_media():
    records = load_records()
    manifest = json.loads((DOCS / "asset-manifest.json").read_text(encoding="utf-8"))
    asset_ids = {asset["filename"] for asset in manifest["assets"]}
    for record in records:
        expected = record["related_media_ids"]
        assert set(expected) <= asset_ids
        page = entity_page(record["stable_id"])
        links = page.select("a[data-media-id]")
        actual = [link["data-media-id"] for link in links]
        assert actual == expected
        for link in links:
            assert link["href"] == f"../../assets/media/{link['data-media-id']}"


def test_observed_relationship_lists_match_graph_and_remain_mentions_only():
    graph = load_graph()
    labels = {record["stable_id"]: record["display_label"] for record in load_records()}
    for stable_id in labels:
        page = entity_page(stable_id)
        outgoing = [link["href"].removeprefix("../").removesuffix("/") for link in page.select('a[data-relationship="mentions"]')]
        incoming = [link["href"].removeprefix("../").removesuffix("/") for link in page.select('a[data-relationship="mentioned-by"]')]
        expected_outgoing = [item for item in graph.get("outgoing", {}).get(stable_id, []) if item in labels]
        expected_incoming = [item for item in graph.get("backlinks", {}).get(stable_id, []) if item in labels]
        assert outgoing == expected_outgoing
        assert incoming == expected_incoming

    assert all(item["kind"] == "mentions" for item in graph["relationships"])
    assert all(item["evidence_class"] == "observed-xref" for item in graph["relationships"])


def test_entity_pages_have_only_structural_creativework_jsonld_and_no_executable_js():
    forbidden_production_terms = ("chatgpt", "openai", "claude", "gemini", "generated by ai", "made by ai")
    for record in load_records():
        stable_id = record["stable_id"]
        raw = (ENTITIES / stable_id / "index.html").read_text(encoding="utf-8")
        soup = BeautifulSoup(raw, "html.parser")
        scripts = soup.find_all("script")
        assert len(scripts) == 1
        assert scripts[0].get("type") == "application/ld+json"
        payload = json.loads(scripts[0].string)
        assert payload["@type"] == "CreativeWork"
        assert payload["@id"] == record["canonical_url"]
        assert payload["identifier"] == stable_id
        assert payload["sameAs"] == f"{SITE_BASE}#{stable_id}"
        assert payload["isPartOf"]["@type"] == "CreativeWork"
        assert "Person" not in json.dumps(payload)
        lower = raw.lower()
        for term in forbidden_production_terms:
            assert term not in lower


def test_entity_pages_have_accessible_landmarks_and_responsive_css():
    css = (ENTITIES / "entity.css").read_text(encoding="utf-8")
    assert "@media(max-width:760px)" in css
    assert "@media(prefers-reduced-motion:reduce)" in css
    assert ".asset-file,.entity-source .asset-toolbar" in css

    for stable_id in ("cover", "codec", "chronology", "shard-god"):
        soup = entity_page(stable_id)
        assert soup.find("a", class_="skip-link", href="#main") is not None
        assert soup.find("main", id="main") is not None
        assert soup.find("header", attrs={"data-museum-shell": "unified"}) is not None
        assert soup.find("nav", attrs={"aria-label": "Unified Starsilk Museum navigation"}) is not None
        assert soup.find(id="published-source-heading") is not None
