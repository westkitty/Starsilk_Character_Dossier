import json
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CONTENT = ROOT / "src" / "content"
SECTIONS = CONTENT / "sections"


def visible_image_sources(node):
    """Return visible image-bearing URLs: img src plus video poster frames."""
    sources = []
    for img in node.find_all("img"):
        src = (img.get("src") or "").strip()
        if not src or img.has_attr("hidden"):
            continue
        if any(parent.has_attr("hidden") for parent in img.parents):
            continue
        sources.append(src)
    for video in node.find_all("video"):
        poster = (video.get("poster") or "").strip()
        if not poster or video.has_attr("hidden"):
            continue
        if any(parent.has_attr("hidden") for parent in video.parents):
            continue
        sources.append(poster)
    return sources


def assert_local_image_exists(page_path: Path, src: str) -> None:
    assert not src.startswith(("http://", "https://", "data:")), (
        f"visual-coverage image unexpectedly depends on external/data media: {src}"
    )
    target = (page_path.parent / src).resolve()
    assert target.exists(), f"visual-coverage image does not resolve: {src} from {page_path}"


def authored_section_records():
    payload = json.loads((CONTENT / "sections.json").read_text(encoding="utf-8"))
    return payload["sections"]


def authored_body_has_image(section_id: str) -> bool:
    body = (SECTIONS / f"{section_id}.body.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(body, "html.parser")
    return bool(visible_image_sources(soup))


def test_every_authored_compendium_entry_has_a_visible_resolvable_image():
    page_path = DOCS / "index.html"
    soup = BeautifulSoup(page_path.read_text(encoding="utf-8"), "lxml")
    missing = []

    for record in authored_section_records():
        section_id = record["id"]
        section = soup.find("section", id=section_id)
        assert section is not None, f"authored section missing from generated Compendium: {section_id}"
        sources = visible_image_sources(section)
        if not sources:
            missing.append(section_id)
            continue
        for src in sources:
            assert_local_image_exists(page_path, src)

    assert not missing, "authored Compendium entries without visible image coverage: " + ", ".join(missing)


def test_fallback_visuals_are_used_only_for_authored_bodies_without_images():
    page_path = DOCS / "index.html"
    soup = BeautifulSoup(page_path.read_text(encoding="utf-8"), "lxml")

    for record in authored_section_records():
        section_id = record["id"]
        section = soup.find("section", id=section_id)
        assert section is not None
        fallback = section.find(attrs={"data-visual-coverage": "fallback"})
        has_authored_image = authored_body_has_image(section_id)
        if has_authored_image:
            assert fallback is None, f"fallback duplicated an authored visual in {section_id}"
        else:
            assert fallback is not None, f"image-less authored body did not receive fallback coverage: {section_id}"


def test_fallback_visuals_do_not_create_xref_evidence():
    page_path = DOCS / "index.html"
    soup = BeautifulSoup(page_path.read_text(encoding="utf-8"), "lxml")
    offenders = []

    for fallback in soup.find_all(attrs={"data-visual-coverage": "fallback"}):
        links = fallback.find_all("a", class_="xref-link")
        if links:
            section = fallback.find_parent("section")
            section_id = section.get("id") if section else "unknown"
            offenders.append(section_id)

    assert not offenders, (
        "visual fallback presentation must not create observed-xref evidence: "
        + ", ".join(sorted(set(offenders)))
    )


def test_every_entity_permalink_has_a_visible_resolvable_image():
    missing = []
    for record in authored_section_records():
        section_id = record["id"]
        page_path = DOCS / "entities" / section_id / "index.html"
        assert page_path.exists(), f"entity permalink missing: {section_id}"
        soup = BeautifulSoup(page_path.read_text(encoding="utf-8"), "lxml")
        sources = visible_image_sources(soup)
        if not sources:
            missing.append(section_id)
            continue
        for src in sources:
            assert_local_image_exists(page_path, src)

    assert not missing, "entity permalinks without visible image coverage: " + ", ".join(missing)


def test_context_fallbacks_do_not_claim_unknown_character_portraits():
    coverage = json.loads((CONTENT / "visual-coverage.json").read_text(encoding="utf-8"))
    records = {record["id"]: record for record in authored_section_records()}

    for placement in coverage["placements"]:
        if placement["role"] != "context":
            continue
        language = (placement["alt"] + " " + placement["note"]).lower()
        for section_id in placement["sections"]:
            classes = set(records[section_id]["classes"].split())
            if "character-page" in classes:
                assert "not a portrait" in language, (
                    f"character context fallback must explicitly disclaim portrait identity: {section_id}"
                )
