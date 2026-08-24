import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OBJECTS = DOCS / "objects"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"


def load_manifest():
    return json.loads((DOCS / "asset-manifest.json").read_text(encoding="utf-8"))


def load_objects():
    return json.loads((OBJECTS / "objects.json").read_text(encoding="utf-8"))


def test_museum_publication_is_deterministic_against_committed_output():
    proc = subprocess.run(
        [sys.executable, "build/museum_publication.py", "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "museum object outputs match generator output" in proc.stdout


def test_museum_tree_is_small_generated_surface_not_a_media_copy():
    expected = {"index.html", "museum.css", "museum.js", "objects.json", "schema.json", "AUTHORITY.md"}
    actual = {
        path.relative_to(OBJECTS).as_posix()
        for path in OBJECTS.rglob("*")
        if path.is_file()
    }
    assert actual == expected
    assert not any(path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm"} for path in OBJECTS.rglob("*"))


def test_object_records_are_exact_manifest_derived_views():
    manifest = load_manifest()
    publication = load_objects()
    records = publication["records"]
    assert publication["schema"] == "starsilk-museum-object-index/1"
    assert publication["source_manifest"] == SITE_BASE + "asset-manifest.json"
    assert publication["record_count"] == manifest["unique_binary_assets"] == len(manifest["assets"]) == len(records)

    ids = []
    for asset, record in zip(manifest["assets"], records):
        expected_id = Path(asset["filename"]).stem
        ids.append(expected_id)
        assert record["object_id"] == expected_id
        assert record["filename"] == asset["filename"]
        assert record["canonical_url"] == f"{SITE_BASE}objects/#{expected_id}"
        assert record["media_url"] == f"{SITE_BASE}assets/media/{asset['filename']}"
        assert record["mime_type"] == asset["mime_type"]
        assert record["sha256"] == asset["sha256"]
        assert record["bytes"] == asset["bytes"]
        assert record["source"] == {
            "filename": asset.get("source_filename"),
            "sha256": asset.get("source_sha256"),
            "bytes": asset.get("source_bytes"),
        }
        assert record["logical_identity"] == asset.get("logical_identity")
        assert record["match_status"] == asset.get("match_status")
        assert record["provenance"] == asset.get("provenance")
        assert record["evidence"]["class"] == "published-media-provenance"
        assert record["evidence"]["source_key"] == asset["filename"]
        assert record["contexts"] == [
            {
                "section_id": context["section_id"],
                "alt": context.get("alt"),
                "entity_url": f"{SITE_BASE}entities/{context['section_id']}/",
            }
            for context in asset.get("contexts", [])
        ]
    assert len(ids) == len(set(ids))


def test_museum_model_keeps_unknowns_explicit_and_does_not_promote_descriptive_fields():
    publication = load_objects()
    by_id = {record["object_id"]: record for record in publication["records"]}

    blood_rings = by_id["0ab4d1542df260c447aee4c0"]
    assert blood_rings["logical_identity"] == "Blood Rings"
    assert blood_rings["match_status"] == "incident"
    assert blood_rings["object_id"] != blood_rings["logical_identity"]
    assert blood_rings["contexts"] == []
    assert any("No published section context" in item for item in blood_rings["unknowns"])

    media_vault = by_id["0b4e8ad4a9a36b115a126026"]
    assert media_vault["logical_identity"] is None
    assert any("No logical identity" in item for item in media_vault["unknowns"])
    assert media_vault["contexts"][0]["section_id"] == "media-vault"


def test_museum_supports_image_and_video_objects_without_autoload_markup():
    publication = load_objects()
    kinds = {record["media_kind"] for record in publication["records"]}
    assert "image" in kinds
    assert "video" in kinds

    raw = (OBJECTS / "index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(raw, "html.parser")
    assert soup.find("dialog", id="objectViewer") is not None
    assert soup.find("link", rel="canonical")["href"] == SITE_BASE + "objects/"
    assert soup.find("link", rel="alternate", attrs={"type": "application/json"})["href"] == SITE_BASE + "objects/objects.json"
    assert soup.find_all("img") == []
    assert soup.find_all("video") == []
    assert soup.find("script", src="museum.js") is not None


def test_entity_index_exposes_human_museum_entry_point():
    soup = BeautifulSoup((DOCS / "entities/index.html").read_text(encoding="utf-8"), "html.parser")
    actions = soup.find("div", class_="entity-actions", attrs={"aria-label": "Related publication"})
    assert actions is not None
    link = actions.find("a", href="../objects/")
    assert link is not None
    assert "museum objects" in link.get_text(" ", strip=True).lower()


def test_museum_base_page_loads_metadata_without_requesting_media(page: Page, local_server):
    media_requests = []
    page.on("request", lambda request: media_requests.append(request.url) if "/assets/media/" in request.url else None)
    page.goto(f"{local_server}/objects/")
    expect(page.locator("#collectionStatus")).to_contain_text("museum objects")
    expect(page.locator("#objectList li")).to_have_count(load_objects()["record_count"])
    page.wait_for_timeout(500)
    assert media_requests == []


def test_image_deep_link_opens_one_accessible_viewer_and_close_releases_media(page: Page, local_server):
    object_id = "0cb9f2fd4623694ffca06f45"
    page.goto(f"{local_server}/objects/#{object_id}")
    dialog = page.locator("#objectViewer")
    expect(dialog).to_be_visible()
    expect(page.locator("#viewerId")).to_have_text(object_id)
    expect(page.locator("#viewerMedia img")).to_have_count(1)
    expect(page.locator("#viewerMedia video")).to_have_count(0)
    expect(page.locator("#viewerMedia img")).to_have_attribute("src", f"../assets/media/{object_id}.webp")
    expect(page.locator("#viewerContexts a[href='../entities/shard-god/']")).to_be_visible()
    expect(page.locator("#closeViewer")).to_be_focused()

    page.keyboard.press("Escape")
    expect(dialog).to_be_hidden()
    expect(page.locator("#viewerMedia img")).to_have_count(0)
    assert page.url == f"{local_server}/objects/"


def test_video_deep_link_creates_only_selected_controls_and_never_autoplays(page: Page, local_server):
    object_id = "2867ab757325a18d4e86e47d"
    page.goto(f"{local_server}/objects/#{object_id}")
    video = page.locator("#viewerMedia video")
    expect(video).to_have_count(1)
    expect(video).to_have_attribute("src", f"../assets/media/{object_id}.mp4")
    expect(video).to_have_attribute("controls", "")
    assert video.evaluate("el => el.autoplay") is False
    assert video.evaluate("el => el.paused") is True
    expect(page.locator("#viewerMedia img")).to_have_count(0)


def test_filtering_and_invalid_deep_link_have_clear_recovery_states(page: Page, local_server):
    page.goto(f"{local_server}/objects/")
    search = page.locator("#objectSearch")
    search.fill("Cirrulite XXX")
    expect(page.locator("#collectionStatus")).to_contain_text("1 of")
    expect(page.locator("li[data-object-id='100a6b911c0af4e1b21d4495']")).to_be_visible()

    page.goto(f"{local_server}/objects/#does-not-exist")
    expect(page.locator("#collectionError")).to_be_visible()
    expect(page.locator("#collectionError")).to_contain_text("does-not-exist")
    expect(page.locator("#objectViewer")).to_be_hidden()


def test_museum_publication_contains_no_authorship_residue():
    forbidden = ("chatgpt", "openai", "claude", "gemini", "generated by ai", "made by ai")
    for name in ("index.html", "museum.css", "museum.js", "AUTHORITY.md"):
        lower = (OBJECTS / name).read_text(encoding="utf-8").lower()
        for term in forbidden:
            assert term not in lower
