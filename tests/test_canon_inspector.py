import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CANON_DIR = DOCS / "canon"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
EXPECTED_FILES = {
    "index.html",
    "canon-inspector.css",
    "canon-locks.json",
    "canon-locks.md",
    "schema.json",
    "AUTHORITY.md",
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_canon_inspector_file_set_is_exact_build_owned_and_deterministic():
    actual = {path.relative_to(CANON_DIR).as_posix() for path in CANON_DIR.rglob("*") if path.is_file()}
    assert actual == EXPECTED_FILES

    build = (ROOT / "tools" / "build.sh").read_text(encoding="utf-8")
    assert "build/canon_publication.py" in build
    assert "docs/canon" in build

    proc = subprocess.run(
        [sys.executable, "build/canon_publication.py", "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "Canon Inspector outputs match generator output" in proc.stdout


def test_all_public_lock_records_are_exact_invariant_derivatives_with_correct_scope():
    source = read_json(ROOT / "src/canon/invariants.json")
    model = read_json(CANON_DIR / "canon-locks.json")
    source_locks = [("document", lock) for lock in source["document_locks"]] + [("section", lock) for lock in source["section_locks"]]

    assert model["schema"] == "starsilk-canon-lock-register/1"
    assert model["schema_url"] == SITE_BASE + "machine/schema/v1/canon-lock-register.schema.json"
    assert model["canonical_url"] == SITE_BASE + "canon/"
    assert model["source_invariants"] == "src/canon/invariants.json"
    assert model["lock_count"] == len(source_locks) == 11
    assert model["document_lock_count"] == len(source["document_locks"]) == 2
    assert model["section_lock_count"] == len(source["section_locks"]) == 9
    assert [record["lock_id"] for record in model["locks"]] == [lock["id"] for _, lock in source_locks]

    for record, (scope, source_lock) in zip(model["locks"], source_locks):
        assert record["lock_id"] == source_lock["id"]
        assert record["description"] == source_lock["description"]
        assert record["scope"] == scope
        assert record["positive_requirements"] == source_lock.get("must_match", [])
        assert record["prohibitions"] == source_lock.get("must_not_match", [])
        assert record["authority"] == {
            "canon_content": "authored dossier content in the target source references",
            "machine_validation": "src/canon/invariants.json",
            "public_derivative": "generated /canon/ publication",
        }
        assert record["enforcement"]["validator"] == "build/validate.py --strict"
        assert record["enforcement"]["status"] == "enforced-on-generated-compendium-validation"
        if scope == "document":
            assert record["target"] == {
                "kind": "complete-compendium-document",
                "stable_id": None,
                "canonical_url": SITE_BASE,
                "source_refs": ["src/content/sections.json", "src/content/sections/*.title.html", "src/content/sections/*.body.html"],
            }
            assert "positive requirements are evaluated at document scope" in record["enforcement"]["scope_semantics"]
            assert "prohibitions apply globally" in record["enforcement"]["scope_semantics"]
        else:
            section_id = source_lock["section"]
            assert record["target"] == {
                "kind": "published-section",
                "stable_id": section_id,
                "canonical_url": SITE_BASE + f"entities/{section_id}/",
                "source_refs": ["src/content/sections.json", f"src/content/sections/{section_id}.body.html"],
            }
            assert f"section #{section_id}" in record["enforcement"]["scope_semantics"]

    assert model["additional_validator_assertions"] == {
        "structural_counts": source["counts"],
        "principal_names": source["principal_names"],
        "drakken_art_identity_section_ids": source["drakken_art_identities"],
    }


def test_canon_inspector_human_machine_and_authority_surfaces_preserve_boundary():
    model = read_json(CANON_DIR / "canon-locks.json")
    html = (CANON_DIR / "index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "lxml")

    assert soup.find("main", id="main") is not None
    assert soup.find("script") is None
    assert soup.find("link", {"rel": "alternate", "type": "application/json", "href": "canon-locks.json"}) is not None
    assert soup.find("link", {"rel": "alternate", "type": "text/markdown", "href": "canon-locks.md"}) is not None
    assert "They are not the complete Starsilk canon." in html
    assert "Absence from this register does not imply non-canon status." in html
    assert "Raw patterns are implementation evidence" in html

    cards = soup.select("article.canon-lock[data-lock-id]")
    assert len(cards) == model["lock_count"]
    for record in model["locks"]:
        card = soup.find(id=f"lock-{record['lock_id']}")
        assert card is not None
        assert card.get("data-scope") == record["scope"]
        assert card.find("a", href=record["target"]["canonical_url"]) is not None
        assert card.find("details", class_="canon-patterns") is not None

    markdown = (CANON_DIR / "canon-locks.md").read_text(encoding="utf-8")
    assert "machine-enforced validation locks" in markdown
    assert "not the complete Starsilk canon" in markdown
    assert "Absence from this register does not imply non-canon status." in markdown
    assert "Machine validation patterns" in markdown

    authority = (CANON_DIR / "AUTHORITY.md").read_text(encoding="utf-8")
    assert "not the complete Starsilk canon" in authority
    assert "Absence from the public register" in authority
    assert "Document locks run over the complete generated document" in authority
    assert "section locks run only over their declared generated section" in authority

    schema = read_json(ROOT / "src/schema/canon-lock-register.schema.json")
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert read_json(CANON_DIR / "schema.json") == schema
    assert read_json(DOCS / "machine/schema/v1/canon-lock-register.schema.json") == schema


def test_canon_inspector_discovery_boundaries_and_public_boundary_guard():
    index = read_json(DOCS / "machine/index.json")
    assert index["endpoints"]["canon_inspector"] == SITE_BASE + "canon/"
    assert index["endpoints"]["canon_lock_register"] == SITE_BASE + "canon/canon-locks.json"
    assert SITE_BASE + "canon/" in index["public_urls"]
    assert SITE_BASE + "canon/canon-locks.json" in index["public_urls"]
    assert SITE_BASE + "canon/canon-locks.md" in index["public_urls"]
    assert SITE_BASE + "canon/schema.json" in index["public_urls"]
    assert SITE_BASE + "canon/AUTHORITY.md" in index["public_urls"]

    entity_index = (DOCS / "entities/index.html").read_text(encoding="utf-8")
    entity_page = (DOCS / "entities/dao/index.html").read_text(encoding="utf-8")
    assert 'href="../canon/"' in entity_index
    assert 'href="../../canon/"' in entity_page

    proc = subprocess.run([sys.executable, "tools/check_public_boundary.py", "docs/canon"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "Public-boundary check OK" in proc.stdout


def test_canon_inspector_deep_link_and_mobile_layout(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/canon/#lock-dao-right-arm")
    lock = page.locator("#lock-dao-right-arm")
    expect(lock).to_be_visible()
    expect(lock.locator("a", has_text="published section")).to_have_attribute("href", SITE_BASE + "entities/dao/")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
