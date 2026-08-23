from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


metadata = _load_module("validate_metadata_contract", ROOT / "tools" / "validate_metadata_contract.py")
boundary = _load_module("check_public_boundary", ROOT / "tools" / "check_public_boundary.py")
relationships = _load_module("build_relationship_graph", ROOT / "tools" / "build_relationship_graph.py")


def test_metadata_schema_contract_and_example_record():
    assert metadata.validate_schema_contract() == []

    record = {
        "stable_id": "codec",
        "object_type": "character",
        "display_label": "Codec",
        "aliases": [],
        "canonical_url": "https://westkitty.github.io/Starsilk_Character_Dossier/#codec",
        "source_refs": [
            {
                "path": "src/content/sections/codec.body.html",
                "anchor": "codec",
                "kind": "authoritative-content",
            }
        ],
        "visibility": "public",
        "canon_status": "canon",
        "spoiler_level": "major",
        "related_media_ids": [],
        "evidence": [
            {
                "class": "authoritative-content",
                "source_ref": "src/content/sections/codec.body.html",
            }
        ],
        "unknowns": [],
    }
    assert metadata.validate_record(record) == []

    missing_unknowns = dict(record)
    missing_unknowns.pop("unknowns")
    assert any("unknowns" in error for error in metadata.validate_record(missing_unknowns))


def test_public_boundary_rejects_private_and_local_state(tmp_path: Path):
    clean = tmp_path / "clean.json"
    clean.write_text(
        json.dumps(
            {
                "stable_id": "codec",
                "visibility": "public",
                "source": "src/content/sections/codec.body.html",
            }
        ),
        encoding="utf-8",
    )
    assert boundary.check_paths([clean]) == []

    private = tmp_path / "private.json"
    private.write_text(json.dumps({"visibility": "private", "stable_id": "hidden-note"}), encoding="utf-8")
    errors = boundary.check_paths([private])
    assert any("private visibility" in error for error in errors)

    local = tmp_path / "local.json"
    local.write_text(json.dumps({"visibility": "public", "path": "/Users/example/secret.txt"}), encoding="utf-8")
    errors = boundary.check_paths([local])
    assert any("local path" in error for error in errors)

    token = tmp_path / "token.txt"
    token.write_text("github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890", encoding="utf-8")
    errors = boundary.check_paths([token])
    assert any("GitHub personal token" in error for error in errors)


def test_existing_section_and_navigation_ids_are_consistent_and_unique():
    sections = json.loads((ROOT / "src" / "content" / "sections.json").read_text(encoding="utf-8"))["sections"]
    section_ids = [section["id"] for section in sections]
    assert len(section_ids) == len(set(section_ids))

    nav = json.loads((ROOT / "src" / "content" / "nav.json").read_text(encoding="utf-8"))["groups"]
    nav_ids = [link["id"] for group in nav for link in group["links"]]
    assert set(nav_ids).issubset(set(section_ids))

    chronology = next(section for section in sections if section["id"] == "chronology")
    assert chronology["attrs"]["data-source-key"] == "five-phase-canon-chronology"


def test_archive_asset_keys_are_unique_stable_identifiers():
    archive = ROOT / "src" / "content" / "sections" / "archive.body.html"
    soup = BeautifulSoup(archive.read_text(encoding="utf-8"), "lxml")
    keys = [node["data-asset-key"] for node in soup.select("[data-asset-key]")]
    assert keys
    assert len(keys) == len(set(keys))
    assert "asset-19" in keys


def test_relationship_derivative_never_upgrades_observed_mentions():
    graph = relationships.build_graph(ROOT / "docs" / "index.html")
    assert graph["schema"] == "starsilk-entity-relationships/1"
    assert graph["relationships"]
    assert {edge["kind"] for edge in graph["relationships"]} == {"mentions"}


def test_foundation_contract_keeps_publication_dimensions_separate():
    contract = (ROOT / "MUSEUM_AI_FOUNDATION.md").read_text(encoding="utf-8")
    assert "Visibility" in contract
    assert "Canon status" in contract
    assert "Spoiler level" in contract
    assert "does not imply canon status or visibility" in contract
    assert "does **not** prove semantic relations" in contract
    assert "do not create a second manually maintained canon prose database" in contract.lower()
