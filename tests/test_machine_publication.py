import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from tools.validate_metadata_contract import validate_record

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"

SCHEMAS = {
    "metadata-record.schema.json",
    "machine-publication-index.schema.json",
    "entity-index.schema.json",
    "relationship-graph.schema.json",
}
EXPECTED_MACHINE_FILES = {
    "machine/index.json",
    "machine/entities.json",
    "machine/relationships.json",
    "machine/project.jsonld",
    "machine/compendium.md",
    "machine/entities.md",
    "machine/AUTHORITY.md",
} | {f"machine/schema/v1/{name}" for name in SCHEMAS}


def read_json(relative: str):
    return json.loads((DOCS / relative).read_text(encoding="utf-8"))


def test_machine_publication_file_set_is_exact_and_build_owned():
    actual = {
        path.relative_to(DOCS).as_posix()
        for path in (DOCS / "machine").rglob("*")
        if path.is_file()
    }
    assert actual == EXPECTED_MACHINE_FILES
    assert (DOCS / "llms.txt").is_file()
    assert (DOCS / "sitemap.xml").is_file()

    build = (ROOT / "tools" / "build.sh").read_text(encoding="utf-8")
    assert "build/machine_publication.py" in build
    assert "tools/check_public_boundary.py docs/machine docs/llms.txt docs/sitemap.xml" in build


def test_machine_publication_is_deterministic_against_committed_output():
    proc = subprocess.run(
        [sys.executable, "build/machine_publication.py", "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "machine/publication outputs match generator output" in proc.stdout


def test_entity_index_is_exactly_section_backed_and_contract_valid():
    sections = json.loads((ROOT / "src/content/sections.json").read_text(encoding="utf-8"))["sections"]
    section_ids = [section["id"] for section in sections]
    entities = read_json("machine/entities.json")
    records = entities["records"]

    assert entities["schema"] == "starsilk-entity-index/1"
    assert entities["project_id"] == "starsilk-character-dossier"
    assert entities["record_count"] == len(section_ids) == len(records)
    assert [record["stable_id"] for record in records] == section_ids
    assert len(set(section_ids)) == len(section_ids)

    manifest = json.loads((DOCS / "asset-manifest.json").read_text(encoding="utf-8"))
    published_media_ids = {asset["filename"] for asset in manifest["assets"]}

    for record in records:
        assert validate_record(record) == []
        assert record["visibility"] == "public"
        assert record["canon_status"] == "unknown"
        assert record["spoiler_level"] == "major"
        assert record["canonical_url"] == f"{SITE_BASE}#{record['stable_id']}"
        assert set(record["related_media_ids"]) <= published_media_ids
        assert any(ref["path"].endswith(f"/{record['stable_id']}.body.html") for ref in record["source_refs"])
        assert any("canon status" in item.lower() for item in record["unknowns"])
        assert any("spoiler" in item.lower() for item in record["unknowns"])

    # Phase 2 must not manufacture event/world/object identities that do not
    # already exist as authored section IDs.
    assert set(record["stable_id"] for record in records) == set(section_ids)


def test_relationship_graph_is_observed_mentions_only():
    graph = read_json("machine/relationships.json")
    entity_index = read_json("machine/entities.json")
    section_ids = {record["stable_id"] for record in entity_index["records"]}
    graph_ids = {entity["id"] for entity in graph["entities"]}

    assert graph["schema"] == "starsilk-entity-relationships/1"
    assert graph["source"] == SITE_BASE
    assert graph["entity_count"] == len(graph["entities"])
    assert graph["relationship_count"] == len(graph["relationships"])
    assert graph_ids <= section_ids

    for relation in graph["relationships"]:
        assert relation == {
            "source": relation["source"],
            "target": relation["target"],
            "kind": "mentions",
            "evidence_class": "observed-xref",
        }
        assert relation["source"] in section_ids
        assert relation["target"] in section_ids
        assert relation["source"] != relation["target"]


def test_jsonld_uses_structural_creativework_semantics_only():
    payload = read_json("machine/project.jsonld")
    entities = read_json("machine/entities.json")["records"]

    assert payload["@context"] == "https://schema.org"
    assert payload["@type"] == "CreativeWork"
    assert payload["identifier"] == "starsilk-character-dossier"
    assert payload["url"] == SITE_BASE
    assert len(payload["hasPart"]) == len(entities)

    for part, record in zip(payload["hasPart"], entities):
        assert part["@type"] == "CreativeWork"
        assert part["@id"] == record["canonical_url"]
        assert part["identifier"] == record["stable_id"]
        assert part["name"] == record["display_label"]
        assert part["url"] == record["canonical_url"]
        assert set(part) == {"@type", "@id", "identifier", "name", "url"}

    rendered = json.dumps(payload)
    for forbidden in ("Person", "knows", "parent", "children", "creator", "employee", "memberOf"):
        assert forbidden not in rendered


def test_project_index_orients_to_all_public_machine_surfaces():
    index = read_json("machine/index.json")
    assert index["schema"] == "starsilk-machine-publication/1"
    assert index["project_id"] == "starsilk-character-dossier"
    assert index["canonical_url"] == SITE_BASE
    assert index["record_count"] == read_json("machine/entities.json")["record_count"]
    assert index["relationship_count"] == read_json("machine/relationships.json")["relationship_count"]
    assert len(index["public_urls"]) == len(set(index["public_urls"]))
    assert index["public_urls"][0] == SITE_BASE

    expected_paths = {
        "llms.txt",
        "sitemap.xml",
        "machine/index.json",
        "machine/entities.json",
        "machine/relationships.json",
        "machine/project.jsonld",
        "machine/compendium.md",
        "machine/entities.md",
        "machine/AUTHORITY.md",
    } | {f"machine/schema/v1/{name}" for name in SCHEMAS}
    expected_urls = {SITE_BASE} | {SITE_BASE + path for path in expected_paths}
    assert set(index["public_urls"]) == expected_urls

    llms = (DOCS / "llms.txt").read_text(encoding="utf-8")
    assert index["endpoints"]["orientation"] == SITE_BASE + "llms.txt"
    for name, url in index["endpoints"].items():
        if name != "orientation":
            assert url in llms
    assert "observed-xref" in llms
    assert "do not infer" in llms.lower()


def test_sitemap_matches_declared_public_urls():
    index = read_json("machine/index.json")
    root = ET.parse(DOCS / "sitemap.xml").getroot()
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [node.text for node in root.findall("sm:url/sm:loc", ns)]
    assert urls == index["public_urls"]


def test_versioned_public_schema_copies_match_sources():
    for name in SCHEMAS:
        source = ROOT / "src/schema" / name
        published = DOCS / "machine/schema/v1" / name
        assert source.is_file()
        assert published.is_file()
        assert published.read_text(encoding="utf-8") == source.read_text(encoding="utf-8").rstrip() + "\n"
        schema = json.loads(source.read_text(encoding="utf-8"))
        assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"


def test_markdown_alternatives_are_source_ordered_and_addressable():
    records = read_json("machine/entities.json")["records"]
    compendium = (DOCS / "machine/compendium.md").read_text(encoding="utf-8")
    entity_md = (DOCS / "machine/entities.md").read_text(encoding="utf-8")

    positions = []
    for record in records:
        marker = f"Stable ID: `{record['stable_id']}`"
        assert marker in compendium
        positions.append(compendium.index(marker))
        assert f"`{record['stable_id']}`" in entity_md
        assert record["canonical_url"] in entity_md
    assert positions == sorted(positions)


def test_public_authority_copy_is_generated_from_publication_source():
    source = (ROOT / "src/machine/AUTHORITY.md").read_text(encoding="utf-8").rstrip() + "\n"
    published = (DOCS / "machine/AUTHORITY.md").read_text(encoding="utf-8")
    assert published == source
    assert "mentions" in published
    assert "does not prove" in published
    assert "JSON-LD" in published


def test_public_machine_boundary_guard_passes_real_outputs():
    proc = subprocess.run(
        [
            sys.executable,
            "tools/check_public_boundary.py",
            "docs/machine",
            "docs/llms.txt",
            "docs/sitemap.xml",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "Public-boundary check OK" in proc.stdout
