import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build"))

import canon_loom  # noqa: E402
import generate  # noqa: E402


def test_canon_loom_is_a_projection_of_the_authored_ledger_not_machine_locks():
    claims = canon_loom.load_claims()
    assert len(claims) == 120
    assert [claim["claim_id"] for claim in claims] == [f"C{i:03d}" for i in range(1, 121)]
    assert {claim["authority"] for claim in claims} == {"authored-source"}
    assert {claim["evidence_class"] for claim in claims} == {"authored-lore-record"}
    assert {claim["source_ref"] for claim in claims} == {"src/content/sections/canon-ledger.body.html"}
    assert all(claim["source_locator"] == f'data-lore-record="{claim["claim_id"]}"' for claim in claims)

    invariants = json.loads((ROOT / "src/canon/invariants.json").read_text(encoding="utf-8"))
    lock_ids = {item["id"] for key in ("document_locks", "section_locks") for item in invariants[key]}
    assert "C094" not in lock_ids
    assert "C096" not in lock_ids


def test_canon_loom_extracts_explicit_numeric_evidence_without_promoting_it_to_lock():
    claims = {claim["claim_id"]: claim for claim in canon_loom.load_claims()}
    assert 170 in {fact["value"] for fact in claims["C037"]["numeric_facts"]}
    assert 786_000_000 in {fact["value"] for fact in claims["C094"]["numeric_facts"]}
    assert 31 in {fact["value"] for fact in claims["C096"]["numeric_facts"]}


def test_revision_payload_carries_claim_evidence_and_keeps_lock_source_separate():
    sections = generate.load_sections(generate.load_media_rename_map())
    payload = generate.build_revision_data(sections)
    assert len(payload["claims"]) == 120
    assert payload["claim_source"] == "src/content/sections/canon-ledger.body.html"
    assert payload["canon_lock_source"] == "src/canon/invariants.json"
    assert payload["canon_delta_schema"] == "src/canon/canon-delta.schema.json"
    assert payload["claim_source"] != payload["canon_lock_source"]


def test_canon_delta_schema_requires_explicit_authority_and_preserves_unknowns():
    schema = json.loads((ROOT / "src/canon/canon-delta.schema.json").read_text(encoding="utf-8"))
    assert schema["properties"]["authority"]["enum"] == ["exploratory", "provisional", "accepted", "locked"]
    assert "unknowns" in schema["required"]
    assert schema["properties"]["schema"]["const"] == "starsilk-canon-delta/1"
