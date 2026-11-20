"""Approved Tiger identity locks in public source; private artwork never exported."""
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
BODY_PATH = ROOT / "src/content/sections/shard-god.body.html"
INVARIANTS_PATH = ROOT / "src/canon/invariants.json"
LOCK_IDS = {
    "shard-god-exact-height",
    "shard-god-compact-head",
    "shard-god-pupil-free-eyes",
}
PROVISIONAL_SOURCES = {
    "0cb9f2fd4623694ffca06f45.png",
    "7c7d87d4b3c4ebdf26105e88.jpg",
    "a551049aaf868d58772975ad.jpg",
    "b8d2878fc5065ecb2bb262e2.png",
}


def read_source():
    return BODY_PATH.read_text(encoding="utf-8")


def tiger_section_locks():
    data = json.loads(INVARIANTS_PATH.read_text(encoding="utf-8"))
    return {
        item["id"]: item
        for item in data["section_locks"]
        if item["section"] == "shard-god"
    }


def test_authored_tiger_has_exact_height_head_eyes_and_single_tail():
    text = BeautifulSoup(read_source(), "html.parser").get_text(" ", strip=True)
    for required in (
        "exactly nine feet (2.74 m)",
        "original compact angular wedge-shaped head",
        "short projecting muzzle",
        "Eyes glow solid cyan with no pupils or irises",
        "Single long tail",
    ):
        assert required in text
    assert "at or below roughly nine feet" not in text
    assert "without ordinary visible pupils" not in text


def test_all_four_existing_gallery_plates_remain_provisional():
    soup = BeautifulSoup(read_source(), "html.parser")
    figures = soup.select(".ref-grid figure.reference-record")
    assert len(figures) == 4
    assert {fig.find("img")["src"].split("/")[-1] for fig in figures} == PROVISIONAL_SOURCES
    assert all(fig.find("figcaption").find("b").get_text().startswith("Provisional") for fig in figures)
    text = soup.get_text(" ", strip=True)
    assert "approved primary visual reference" in text
    assert "not reproduced or linked in this public dossier" in text
    assert "Primary silhouette anchor" not in text


def test_private_reference_location_and_approval_record_do_not_leak():
    source = read_source().lower()
    assert "drive.google.com" not in source
    assert "github.com" not in source
    assert "approval-ledger" not in source
    assert "sha-256" not in source


def test_new_section_machine_locks_are_exact_and_enforced_by_patterns():
    locks = tiger_section_locks()
    assert LOCK_IDS.issubset(locks)
    content = read_source()
    for lock_id in LOCK_IDS:
        lock = locks[lock_id]
        assert lock["section"] == "shard-god"
        for pattern in lock["must_match"]:
            assert re.search(pattern, content), (lock_id, pattern)
        for pattern in lock.get("must_not_match", []):
            assert re.search(pattern, content) is None, (lock_id, pattern)
    assert locks["shard-god-single-tail"]["must_match"]
    bad_height = content.replace("exactly nine feet (2.74 m)", "at or below roughly nine feet")
    assert not re.search(locks["shard-god-exact-height"]["must_match"][0], bad_height)
    assert re.search(locks["shard-god-exact-height"]["must_not_match"][0], bad_height)
    bad_eyes = content.replace("Eyes glow solid cyan with no pupils or irises", "Eyes glow cyan with ordinary visible pupils")
    assert not re.search(locks["shard-god-pupil-free-eyes"]["must_match"][0], bad_eyes)
    bad_head = content.replace("compact angular wedge-shaped head", "elongated dragon head")
    assert not re.search(locks["shard-god-compact-head"]["must_match"][0], bad_head)


def test_generated_published_pages_and_machine_lock_register_match_authority():
    for page in (
        ROOT / "docs/index.html",
        ROOT / "docs/entities/shard-god/index.html",
    ):
        text = page.read_text(encoding="utf-8")
        assert "exactly nine feet (2.74 m)" in text, page
        assert "compact angular wedge-shaped head" in text, page
        assert "no pupils or irises" in text, page
        assert "approved primary visual reference" in text, page
        assert "at or below roughly nine feet" not in text, page
    model = json.loads((ROOT / "docs/canon/canon-locks.json").read_text(encoding="utf-8"))
    published = {r["lock_id"]: r for r in model["locks"]}
    for lock_id in LOCK_IDS:
        assert published[lock_id]["scope"] == "section"
        assert published[lock_id]["target"]["stable_id"] == "shard-god"
    assert model["lock_count"] == 19

def test_compact_canon_lock_register_preserves_values_and_offline_budget():
    import sys
    sys.path.insert(0, str(ROOT / "build"))
    import canon_publication

    model = canon_publication.build_model()
    published = (ROOT / "docs/canon/canon-locks.json").read_text(encoding="utf-8")
    assert json.loads(published) == model
    assert published == canon_publication.json_text(model)
    assert published.endswith("\n") and published.count("\n") == 1
    config = json.loads((ROOT / "src/offline/config.json").read_text(encoding="utf-8"))
    assert "canon/canon-locks.json" in config["precache"]
    paths = [("index.html" if x == "." else x) for x in config["precache"]]
    assert sum((ROOT / "docs" / path).stat().st_size for path in paths) < 2_000_000
