#!/usr/bin/env python3
"""Generate Phase 12 agent guidance, evaluation fixtures, and integration certificate.

The outputs are deterministic public derivatives. They do not create lore or canon
and they do not replace browser/CI/live-publication proof.

Usage: python3 build/agent_publication.py [--check]
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
AGENT_SOURCE = ROOT / "src" / "agents"
SCHEMA_SOURCE = ROOT / "src" / "schema" / "agent-evaluation.schema.json"
OUTPUT_DIR = DOCS / "agents"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"

REQUIRED_CATEGORIES = {
    "entity-identity",
    "canon-retrieval",
    "development-vs-canon",
    "historical-material",
    "speculative-material",
    "unknown-information",
    "chronology",
    "relationships",
    "mention-vs-semantic",
    "media-provenance",
    "canon-locks",
    "source-passage-retrieval",
    "spoiler-metadata",
}
REQUIRED_PENALTIES = {
    "invented-relationship",
    "status-promotion",
    "guessed-date",
    "invented-coordinate",
    "mention-to-causality",
    "lost-source-reference",
    "derivative-over-source",
}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def validate_fixtures(fixtures: dict) -> None:
    if fixtures.get("schema") != "starsilk-agent-evaluation/1":
        raise RuntimeError("unexpected evaluation schema identifier")
    if fixtures.get("project_id") != "starsilk-character-dossier":
        raise RuntimeError("unexpected evaluation project_id")
    cases = fixtures.get("cases")
    penalties = fixtures.get("penalties")
    if not isinstance(cases, list) or len(cases) < len(REQUIRED_CATEGORIES):
        raise RuntimeError("evaluation fixture must include every required category")
    if not isinstance(penalties, list):
        raise RuntimeError("evaluation penalties must be a list")
    categories = {case.get("category") for case in cases}
    if categories != REQUIRED_CATEGORIES:
        missing = sorted(REQUIRED_CATEGORIES - categories)
        extra = sorted(categories - REQUIRED_CATEGORIES)
        raise RuntimeError(f"evaluation categories mismatch; missing={missing} extra={extra}")
    case_ids = [case.get("id") for case in cases]
    if len(case_ids) != len(set(case_ids)) or any(not item for item in case_ids):
        raise RuntimeError("evaluation case IDs must be unique and non-empty")
    penalty_ids = {item.get("id") for item in penalties}
    if penalty_ids != REQUIRED_PENALTIES:
        raise RuntimeError("evaluation penalty set does not match Phase 12 contract")
    for case in cases:
        for key in ("prompt", "source_expectation"):
            if not isinstance(case.get(key), str) or not case[key].strip():
                raise RuntimeError(f"case {case.get('id')} missing {key}")
        for key in ("evidence_urls", "must_assert", "must_not_assert"):
            values = case.get(key)
            if not isinstance(values, list) or not values:
                raise RuntimeError(f"case {case.get('id')} missing {key}")
        if not all(url.startswith(SITE_BASE) for url in case["evidence_urls"]):
            raise RuntimeError(f"case {case.get('id')} has non-project evidence URL")


def all_relationships_are_mentions(payload: dict) -> bool:
    relations = payload.get("relationships", [])
    return bool(relations) and all(
        relation.get("kind") == "mentions" and relation.get("evidence_class") == "observed-xref"
        for relation in relations
    )


def integration_report(fixtures: dict) -> dict:
    machine = load_json(DOCS / "machine" / "index.json")
    entities = load_json(DOCS / "machine" / "entities.json")
    relationships = load_json(DOCS / "machine" / "relationships.json")
    objects = load_json(DOCS / "objects" / "objects.json")
    asset_manifest = load_json(DOCS / "asset-manifest.json")
    packets = load_json(DOCS / "discover" / "context-packets.json")
    chronology = load_json(DOCS / "chronology" / "chronology.json")
    worldsvault = load_json(DOCS / "worldsvault" / "worldsvault.json")
    tours = load_json(DOCS / "tours" / "tours.json")
    manifest = load_json(DOCS / "manifest.webmanifest")
    service_worker = (DOCS / "service-worker.js").read_text(encoding="utf-8")
    llms = (DOCS / "llms.txt").read_text(encoding="utf-8")

    checks = []

    def add(check_id: str, ok: bool, evidence: str) -> None:
        checks.append({"id": check_id, "status": "pass" if ok else "fail", "evidence": evidence})

    entity_records = entities.get("records", [])
    object_records = objects.get("records", [])
    asset_records = asset_manifest.get("assets", [])
    chronology_events = chronology.get("events", [])
    topology_edges = worldsvault.get("edges", [])

    add(
        "stable-entity-identity",
        entities.get("record_count") == len(entity_records) == 127
        and all(record.get("stable_id") and record.get("canonical_url") for record in entity_records),
        f"entities={entities.get('record_count')} expected=127",
    )
    add(
        "context-packet-parity",
        packets.get("packet_count") == entities.get("record_count") == len(packets.get("packets", [])),
        f"packets={packets.get('packet_count')} entities={entities.get('record_count')}",
    )
    add(
        "relationship-evidence-boundary",
        all_relationships_are_mentions(relationships),
        f"relationships={relationships.get('relationship_count')} kind=mentions evidence=observed-xref",
    )
    add(
        "media-provenance-parity",
        objects.get("record_count") == len(object_records) == len(asset_records) == 213
        and all(record.get("evidence", {}).get("source_ref") == "docs/asset-manifest.json" for record in object_records),
        f"objects={objects.get('record_count')} manifest_assets={len(asset_records)} expected=213",
    )
    add(
        "chronology-unknowns-preserved",
        chronology.get("event_count") == len(chronology_events) == 27
        and all("absolute_date" in event.get("temporal", {}) for event in chronology_events)
        and any(event.get("temporal", {}).get("absolute_date") is None for event in chronology_events),
        f"events={chronology.get('event_count')} expected=27; null dates remain representable",
    )
    add(
        "topology-no-false-precision",
        worldsvault.get("edge_count") == len(topology_edges) == 6
        and all(edge.get("source_evidence") and edge.get("unknowns") for edge in topology_edges)
        and all(edge.get("relation_class") == "direct-authored-topology" for edge in topology_edges),
        f"topology_edges={worldsvault.get('edge_count')} expected=6 with source evidence and explicit unknowns",
    )
    add(
        "tour-local-state-boundary",
        tours.get("tour_count") == 6
        and tours.get("local_state_policy", {}).get("scope") == "browser-local"
        and tours.get("local_state_policy", {}).get("published") is False
        and tours.get("local_state_policy", {}).get("analytics_or_telemetry") is False,
        "six tours; local state remains browser-local, unpublished, and telemetry-free",
    )
    add(
        "offline-project-scope",
        manifest.get("scope") == "./" and manifest.get("start_url") == "./"
        and "const MEDIA_PATH = '/assets/media/';" in service_worker
        and '"objects/objects.json"' in service_worker,
        "manifest scope/start_url are project-relative; service worker excludes published media and caches metadata indexes",
    )
    endpoints = machine.get("endpoints", {})
    agent_urls = {
        SITE_BASE + "agents/AGENT_GUIDE.md",
        SITE_BASE + "agents/evaluation.json",
        SITE_BASE + "agents/integration.json",
    }
    add(
        "agent-entry-points",
        endpoints.get("agent_guide") == SITE_BASE + "agents/AGENT_GUIDE.md"
        and endpoints.get("agent_evaluation") == SITE_BASE + "agents/evaluation.json"
        and endpoints.get("agent_integration") == SITE_BASE + "agents/integration.json"
        and agent_urls.issubset(set(machine.get("public_urls", [])))
        and "/agents/evaluation.json" in llms,
        "machine index and llms orientation declare the Phase 12 agent surfaces",
    )
    add(
        "evaluation-contract",
        {case.get("category") for case in fixtures.get("cases", [])} == REQUIRED_CATEGORIES
        and {penalty.get("id") for penalty in fixtures.get("penalties", [])} == REQUIRED_PENALTIES,
        f"cases={len(fixtures.get('cases', []))} required_categories={len(REQUIRED_CATEGORIES)} penalties={len(fixtures.get('penalties', []))}",
    )

    failures = [item for item in checks if item["status"] != "pass"]
    return {
        "schema": "starsilk-final-integration/1",
        "project_id": "starsilk-character-dossier",
        "canonical_url": SITE_BASE + "agents/integration.json",
        "authority_note": "Deterministic structural integration certificate. It does not replace CI, browser, live Pages, public-boundary, or source-authority proof.",
        "check_count": len(checks),
        "pass_count": len(checks) - len(failures),
        "fail_count": len(failures),
        "overall_status": "pass" if not failures else "fail",
        "checks": checks,
    }


def evaluation_markdown(fixtures: dict) -> str:
    lines = [
        "# Starsilk agent evaluation fixtures",
        "",
        fixtures["authority_note"],
        "",
        "## Penalty rules",
        "",
    ]
    for penalty in fixtures["penalties"]:
        lines.append(f"- **{penalty['id']}** (`{penalty['severity']}`): {penalty['description']}")
    lines.extend(["", "## Reference cases", ""])
    for case in fixtures["cases"]:
        lines.extend(
            [
                f"### {case['id']}",
                "",
                f"Category: `{case['category']}`",
                "",
                f"Prompt: {case['prompt']}",
                "",
                "Must assert:",
                *[f"- {item}" for item in case["must_assert"]],
                "",
                "Must not assert:",
                *[f"- {item}" for item in case["must_not_assert"]],
                "",
                f"Source expectation: {case['source_expectation']}",
                "",
                "Evidence:",
                *[f"- {url}" for url in case["evidence_urls"]],
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def render_outputs() -> dict[str, str]:
    fixtures = load_json(AGENT_SOURCE / "evaluation-fixtures.json")
    validate_fixtures(fixtures)
    report = integration_report(fixtures)
    if report["overall_status"] != "pass":
        failed = ", ".join(item["id"] for item in report["checks"] if item["status"] != "pass")
        raise RuntimeError(f"final integration checks failed: {failed}")
    return {
        "agents/AGENT_GUIDE.md": (AGENT_SOURCE / "AUTHORITY.md").read_text(encoding="utf-8").rstrip() + "\n",
        "agents/evaluation.json": json_text(fixtures),
        "agents/evaluation.md": evaluation_markdown(fixtures),
        "agents/integration.json": json_text(report),
        "agents/schema.json": SCHEMA_SOURCE.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual_files() -> set[str]:
    if not OUTPUT_DIR.exists():
        return set()
    return {path.relative_to(DOCS).as_posix() for path in OUTPUT_DIR.rglob("*") if path.is_file()}


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors = []
    expected = set(outputs)
    actual = actual_files()
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        if missing:
            errors.append("missing generated agent files: " + ", ".join(missing))
        if extra:
            errors.append("unexpected generated agent files: " + ", ".join(extra))
    for relative, expected_text in outputs.items():
        path = DOCS / relative
        if not path.exists():
            errors.append(f"missing generated output: docs/{relative}")
            continue
        try:
            actual_text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated output docs/{relative}: {exc}")
            continue
        if actual_text != expected_text:
            errors.append(f"generated output differs: docs/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    for relative, content in outputs.items():
        path = DOCS / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError) as exc:
        print(f"ERROR: agent publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} agent evaluation/publication outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
