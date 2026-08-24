import json
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "build"))

import agent_publication  # noqa: E402


def load(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def test_vendor_neutral_fixture_covers_phase_12_contract():
    fixtures = load("src/agents/evaluation-fixtures.json")
    agent_publication.validate_fixtures(fixtures)

    assert {case["category"] for case in fixtures["cases"]} == agent_publication.REQUIRED_CATEGORIES
    assert {item["id"] for item in fixtures["penalties"]} == agent_publication.REQUIRED_PENALTIES
    assert len(fixtures["cases"]) == 13


def test_agent_guide_preserves_authority_and_unknown_boundaries():
    guide = (ROOT / "src/agents/AUTHORITY.md").read_text(encoding="utf-8")

    required = [
        "Unknown is data.",
        "Generated files under `docs/` are public derivatives.",
        "An observed mention does **not** prove friendship",
        "do not outrank cited authored sources",
        "Do not fill gaps",
        "Do not infer a media identity",
        "It is not the complete Starsilk canon.",
        "do not require a particular model vendor",
    ]
    for text in required:
        assert text in guide


def test_final_integration_certificate_passes_current_generated_system():
    fixtures = load("src/agents/evaluation-fixtures.json")
    report = agent_publication.integration_report(fixtures)

    assert report["overall_status"] == "pass"
    assert report["fail_count"] == 0
    assert report["check_count"] == report["pass_count"]
    assert {item["status"] for item in report["checks"]} == {"pass"}

    ids = {item["id"] for item in report["checks"]}
    assert {
        "stable-entity-identity",
        "context-packet-parity",
        "relationship-evidence-boundary",
        "media-provenance-parity",
        "chronology-unknowns-preserved",
        "topology-no-false-precision",
        "tour-local-state-boundary",
        "offline-project-scope",
        "agent-entry-points",
        "evaluation-contract",
    } <= ids


def test_machine_orientation_discovers_agent_surfaces():
    machine = load("docs/machine/index.json")
    endpoints = machine["endpoints"]
    assert endpoints["agent_guide"].endswith("/agents/AGENT_GUIDE.md")
    assert endpoints["agent_evaluation"].endswith("/agents/evaluation.json")
    assert endpoints["agent_integration"].endswith("/agents/integration.json")

    llms = (ROOT / "docs/llms.txt").read_text(encoding="utf-8")
    assert "/agents/AGENT_GUIDE.md" in llms
    assert "/agents/evaluation.json" in llms
    assert "/agents/integration.json" in llms


def test_generated_agent_publication_matches_sources():
    outputs = agent_publication.render_outputs()
    assert set(outputs) == {
        "agents/AGENT_GUIDE.md",
        "agents/evaluation.json",
        "agents/evaluation.md",
        "agents/integration.json",
        "agents/schema.json",
    }
    assert agent_publication.check_outputs(outputs) == []
