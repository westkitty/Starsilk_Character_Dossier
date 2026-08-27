import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))

def test_all_drakken_are_in_one_dedicated_navigation_group():
    sections = load("src/content/sections.json")["sections"]
    nav = load("src/content/nav.json")
    tours = load("src/tours/tours.json")
    groups = nav["groups"]
    assert len(groups) == 6
    assert [g["label"] for g in groups].count("Drakken") == 1
    drakken = next(g for g in groups if g["label"] == "Drakken")
    assert drakken["links"][0]["id"] == "drakken-registry"
    expected = [r["id"] for r in sections if "drakken-page" in r["classes"].split()]
    actual = [link["id"] for link in drakken["links"][1:]]
    assert actual == expected
    assert len(actual) == len(set(actual))
    assert "starsilk-material" not in actual
    assert "blood-rings" not in actual
    canon = next(g for g in groups if g["label"] == "Canon & cosmology")
    canon_ids = [link["id"] for link in canon["links"]]
    assert "starsilk-material" in canon_ids
    assert "blood-rings" in canon_ids
    tour = next(t for t in tours["tours"] if t["tour_id"] == "drakken-blood-systems")
    assert tour["navigation_group"] == "Drakken"

def test_formerly_peripheral_drakken_are_typed_and_positioned_as_drakken():
    sections = load("src/content/sections.json")["sections"]
    by_id = {r["id"]: r for r in sections}
    expected_archetypes = {
        "mother": "genesis",
        "cradle-exe": "glitch-touched",
        "foldhowl": "glitch-touched",
        "manifest-discord": "glitch-touched",
    }
    for sid, archetype in expected_archetypes.items():
        classes = by_id[sid]["classes"].split()
        assert "drakken-page" in classes
        assert "peripheral-page" not in classes
        assert by_id[sid]["attrs"]["data-archetype"] == archetype
    drakken_positions = [i for i, r in enumerate(sections) if r["id"] == "drakken-registry" or "drakken-page" in r["classes"].split()]
    assert max(drakken_positions) - min(drakken_positions) + 1 == len(drakken_positions)
    peripheral = (ROOT / "src/content/sections/peripheral-index.body.html").read_text(encoding="utf-8")
    for sid in expected_archetypes:
        assert f'href="#{sid}"' not in peripheral

def test_structural_count_locks_match_the_corrected_taxonomy():
    sections = load("src/content/sections.json")["sections"]
    counts = load("src/canon/invariants.json")["counts"]
    peripheral = sum(1 for r in sections if {"character-page", "peripheral-page"} <= set(r["classes"].split()))
    drakken = sum(1 for r in sections if {"character-page", "drakken-page"} <= set(r["classes"].split()))
    assert (peripheral, drakken) == (41, 60)
    assert (counts["peripheral"], counts["drakken"]) == (peripheral, drakken)
