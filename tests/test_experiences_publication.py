"""Phase 1 guest-exhibit registry, privacy, deterministic output, and runtime guards."""
from __future__ import annotations

import copy
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "src/experiences/registry.json"
SCHEMA = ROOT / "src/schema/guest-exhibit-registry.schema.json"
OUT = ROOT / "docs/experiences"

EXPECTED_IDS = [
    "Starsilk_Map_of_the_All",
    "Drakken_Lineage",
    "Palimpsest",
    "Heliocide_Viewer",
    "the-sixth-month-orbital-tomb",
    "Starsilk_Command",
    "DRAXIS_105_Drive",
    "Chorus_of_Dying_Stars",
    "The-Drakken-Terraforming-Laboratory",
    "STARSILK-_Unmaking",
    "AZURAVEL",
    "The_Machine_That_Eats_Worlds_Drive",
]

spec = importlib.util.spec_from_file_location(
    "experiences_publication", ROOT / "build/experiences_publication.py"
)
assert spec and spec.loader
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def _source() -> dict:
    return json.loads(REGISTRY.read_text(encoding="utf-8"))


def test_registry_exact_selected_identity_and_independent_status_axes():
    raw = _source()
    assert raw["schema"] == "starsilk-guest-exhibits/1"
    assert [x["id"] for x in raw["exhibits"]] == EXPECTED_IDS
    assert len(set(EXPECTED_IDS)) == 12
    assert generator.validate_registry(raw, json.loads(SCHEMA.read_text())) == []
    assert len([x for x in raw["exhibits"] if x["visibility"] == "public"]) == 10
    assert len([x for x in raw["exhibits"] if x["visibility"] == "private"]) == 2
    assert all(x["admission"]["status"] == "hold" for x in raw["exhibits"])
    assert all(x["admission"]["launch_enabled"] is False for x in raw["exhibits"])
    assert all(x["release"]["live_edge"] == "unverified" for x in raw["exhibits"])
    assert all(x["unknowns"] for x in raw["exhibits"])


def test_schema_contract_accepts_data_and_rejects_status_privacy_and_identity_corruption():
    raw = _source()
    schema = json.loads(SCHEMA.read_text())
    assert generator.schema_errors(raw, schema) == []
    copy = __import__("copy").deepcopy(raw)
    copy["exhibits"][6]["admission"]["show_public_metadata"] = True
    assert generator.validate_registry(copy, schema)
    copy = __import__("copy").deepcopy(raw)
    copy["exhibits"][6]["source"]["url"] = "https://drive.google.com/drive/folders/PRIVATE"
    assert generator.validate_registry(copy, schema)
    copy = __import__("copy").deepcopy(raw)
    copy["exhibits"][0]["admission"]["launch_enabled"] = True
    assert generator.validate_registry(copy, schema)
    copy = __import__("copy").deepcopy(raw)
    copy["exhibits"][1]["id"] = copy["exhibits"][0]["id"]
    assert any("unique" in e or "mismatch" in e for e in generator.validate_registry(copy, schema))
    copy = __import__("copy").deepcopy(raw)
    copy["exhibits"][0]["canon_status"] = "assumed-canon"
    assert generator.validate_registry(copy, schema)
    try:
        import jsonschema
    except ImportError:
        pass
    else:
        jsonschema.Draft202012Validator.check_schema(schema)
        jsonschema.validate(raw, schema)


@pytest.mark.parametrize("sensitive", [
    "https://drive.google.com/drive/folders/PRIVATE_FILE",
    "/Users/example/secret-folder",
    "folder id: 1234567890abcdefghij1234567890",
    "http://localhost:4567/private",
])
def test_free_text_in_public_repo_cannot_embed_private_source_locators(sensitive):
    raw = copy.deepcopy(_source())
    raw["exhibits"][6]["evidence"]["context"] += " " + sensitive
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    errors = generator.validate_registry(raw, schema)
    assert any("authored registry contains" in message for message in errors)


def test_public_metadata_allowlist_excludes_private_drive_and_launches():
    raw = _source()
    public = generator.public_records(raw)
    assert len(public) == 10
    assert [x["id"] for x in public] == [x for x in EXPECTED_IDS if not x.endswith("_Drive")]
    assert not any("Drive" in json.dumps(x) for x in public)
    for record in public:
        assert record["visibility"] == "public"
        assert record["admission"] == "hold"
        assert record["live_edge"] == "unverified"
        assert record["source_url"] == (
            "https://github.com/westkitty/" + record["id"] + "/commit/" + record["source_commit"]
        )
        assert record["unknowns"]
        assert "launch_url" not in record
        assert "embed_url" not in record


def test_generated_files_are_identical_to_source_and_public_boundary_is_clean():
    desired = generator.outputs()
    assert set(desired) == {"index.html", "experiences.json"}
    assert generator.check_outputs(desired) == []
    index = json.loads((OUT / "experiences.json").read_text())
    assert index["guest_count"] == 10
    assert index["release_policy"] == "metadata-only; no exhibit launches or embeds"
    assert "DRAXIS_105_Drive" not in json.dumps(index)
    assert "The_Machine_That_Eats_Worlds_Drive" not in json.dumps(index)
    checker_spec = importlib.util.spec_from_file_location(
        "boundary", ROOT / "tools/check_public_boundary.py"
    )
    assert checker_spec and checker_spec.loader
    boundary = importlib.util.module_from_spec(checker_spec)
    checker_spec.loader.exec_module(boundary)
    assert boundary.check_paths([OUT]) == []


def test_isolated_html_accessible_and_has_no_embedded_or_auto_requested_external_runtime():
    soup = BeautifulSoup((OUT / "index.html").read_text(encoding="utf-8"), "lxml")
    assert soup.find("html")["lang"] == "en"
    assert soup.find("main") and soup.find("h1")
    assert len(soup.select(".cards > .card")) == 10
    assert len(soup.select("a[href^='https://github.com/westkitty/']")) == 10
    assert not soup.select("script, iframe, frame, embed, object, video, audio, img, canvas, form")
    assert not soup.select("link[rel='stylesheet'], link[rel='preload'], link[rel='prefetch']")
    assert "admission withheld" in soup.get_text(" ", strip=True).lower()
    assert "DRAXIS_105_Drive" not in str(soup)
    assert "The_Machine_That_Eats_Worlds_Drive" not in str(soup)


def test_canon_offline_and_media_authority_are_not_redefined():
    section_data = json.loads((ROOT / "src/content/sections.json").read_text())
    assert len(section_data["sections"]) == 127
    assert len({s["id"] for s in section_data["sections"]}) == 127
    manifest = json.loads((ROOT / "docs/asset-manifest.json").read_text())
    # Support the manifest's own record name rather than creating a parallel media registry.
    assert len(manifest["assets"]) == 213
    offline = json.loads((ROOT / "src/offline/config.json").read_text())
    assert not any("experiences" in item for item in offline["precache"])
    assert "experiences" not in (ROOT / "docs/service-worker.js").read_text()


def test_check_only_does_not_change_generated_file_bytes():
    paths = sorted(OUT.iterdir())
    before = {p.name: p.read_bytes() for p in paths}
    proc = subprocess.run([sys.executable, str(ROOT / "build/experiences_publication.py"), "--check"],
                          cwd=ROOT, capture_output=True, text=True, check=False)
    assert proc.returncode == 0, proc.stderr
    assert before == {p.name: p.read_bytes() for p in paths}


def test_browser_metadata_route_has_no_implicit_external_network(page, local_server):
    external = []
    page.on("request", lambda req: external.append(req.url) if not req.url.startswith(local_server) else None)
    response = page.goto(local_server + "/experiences/", wait_until="load")
    assert response and response.status == 200
    assert page.get_by_role("heading", name="Living Archive").is_visible()
    assert page.locator(".card").count() == 10
    assert page.get_by_text("Phase 1: admission withheld.").is_visible()
    assert external == []
    assert page.locator("iframe, script, img, video, canvas").count() == 0
    page.set_viewport_size({"width": 375, "height": 812})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.keyboard.press("Tab")
    assert page.evaluate("document.activeElement.tagName") == "A"
