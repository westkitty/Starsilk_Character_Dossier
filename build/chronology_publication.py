#!/usr/bin/env python3
"""Generate the source-backed Phase 9 chronology explorer and derivatives."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
CHRONOLOGY_DIR = DOCS_DIR / "chronology"
TEMPLATES_DIR = ROOT / "src" / "templates"
SOURCE_FILE = ROOT / "src" / "chronology" / "events.json"
AUTHORITY_FILE = ROOT / "src" / "chronology" / "AUTHORITY.md"
SCHEMA_FILE = ROOT / "src" / "schema" / "chronology-index.schema.json"
PROJECT_ID = "starsilk-character-dossier"
PROJECT_NAME = "Starsilk Compendium"

sys.path.insert(0, str(ROOT / "build"))
import machine_publication as machine  # noqa: E402


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def event_source(source: dict) -> dict:
    return {
        "stable_record_id": source["stable_id"],
        "source_key": source["source_key"],
        "path": source["path"],
        "canonical_url": machine.entity_permalink(source["stable_id"]),
        "legacy_url": machine.legacy_anchor(source["stable_id"]),
    }


def root_source(source: dict) -> dict:
    return {
        "stable_id": source["stable_id"],
        "source_key": source["source_key"],
        "path": source["path"],
        "canonical_url": machine.entity_permalink(source["stable_id"]),
        "legacy_url": machine.legacy_anchor(source["stable_id"]),
    }


def build_model() -> dict:
    source = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    if source.get("schema") != "starsilk-chronology-source/1":
        raise RuntimeError("unsupported chronology source schema")
    source_record = source.get("source_record")
    policy = source.get("status_policy")
    specs = source.get("events")
    if not isinstance(source_record, dict) or not isinstance(policy, dict) or not isinstance(specs, list) or not specs:
        raise RuntimeError("chronology source needs source_record, status_policy, and non-empty events")
    required_source = {"stable_id", "source_key", "path"}
    if set(source_record) != required_source or source_record["stable_id"] != "chronology":
        raise RuntimeError("chronology source must cite the existing chronology record")
    if {policy.get("visibility"), policy.get("canon_status"), policy.get("spoiler_level")} != {"public", "unknown"}:
        raise RuntimeError("chronology status policy must preserve public visibility and unknown canon/spoiler status")

    ids: set[str] = set()
    events: list[dict] = []
    for spec in specs:
        event_id = spec.get("event_id")
        label = spec.get("label")
        heading = spec.get("source_heading")
        temporal = spec.get("temporal")
        if not all(isinstance(value, str) and value for value in (event_id, label, heading)) or not isinstance(temporal, dict):
            raise RuntimeError("every chronology event needs a direct label, heading, and temporal object")
        if event_id in ids:
            raise RuntimeError(f"duplicate chronology event ID: {event_id}")
        ids.add(event_id)
        if temporal.get("absolute_date") is not None:
            raise RuntimeError(f"unsupported absolute date for {event_id}")
        certainty = temporal.get("certainty")
        if certainty not in {"exact-authored-marker", "relative-authored-marker", "authored-duration", "unknown"}:
            raise RuntimeError(f"invalid temporal certainty for {event_id}")
        if certainty == "exact-authored-marker" and not temporal.get("exact_authored_marker"):
            raise RuntimeError(f"missing exact authored marker for {event_id}")
        if certainty == "relative-authored-marker" and not temporal.get("relative_marker"):
            raise RuntimeError(f"missing relative authored marker for {event_id}")
        if certainty == "authored-duration" and not isinstance(temporal.get("duration"), dict):
            raise RuntimeError(f"missing authored duration for {event_id}")
        source_ref = event_source(source_record) | {"heading": heading}
        events.append({
            "event_id": event_id,
            "label": label,
            "canonical_url": machine.canonical(f"chronology/#event-{event_id}"),
            "source": source_ref,
            "visibility": policy["visibility"],
            "canon_status": policy["canon_status"],
            "spoiler_level": policy["spoiler_level"],
            "status_provenance": {
                "visibility": "existing public source record",
                "canon_status": "no structured event canon status is authored",
                "spoiler_level": "no structured event spoiler level is authored",
            },
            "temporal": temporal,
        })
    for event in events:
        for relation in event["temporal"]["before_event_ids"] + event["temporal"]["after_event_ids"]:
            if relation not in ids:
                raise RuntimeError(f"event {event['event_id']} references unknown event {relation}")

    return {
        "schema": "starsilk-chronology-index/1",
        "schema_url": machine.canonical("machine/schema/v1/chronology-index.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": machine.canonical("chronology/chronology.json"),
        "human_url": machine.canonical("chronology/"),
        "source_record": root_source(source_record),
        "event_count": len(events),
        "events": events,
        "interpretation_rules": [
            "Each event is a direct label from the cited authored chronology source; generated chronology data never outranks that source.",
            "Absolute dates remain null because the source does not author a universal calendar date for these events.",
            "Exact markers retain their authored relative text and are not converted into calendar dates or inferred ordering.",
            "Visibility, canon status, spoiler level, and temporal certainty are independent fields. Explorer filters only change the current rendered view.",
        ],
    }


def build_markdown(model: dict) -> str:
    lines = ["# Starsilk chronology", "", "Generated source-backed chronology derivative; not a second canon authority.", ""]
    for event in model["events"]:
        temporal = event["temporal"]
        marker = temporal["exact_authored_marker"] or temporal["relative_marker"] or "Unknown date/order"
        lines += [f"## {event['label']}", "", f"- Stable deep link: {event['canonical_url']}", f"- Authored temporal marker: {marker}", f"- Temporal certainty: {temporal['certainty']}", f"- Visibility: {event['visibility']}", f"- Canon status: {event['canon_status']}", f"- Spoiler level: {event['spoiler_level']}", f"- Source: {event['source']['canonical_url']}", ""]
    return "\n".join(lines).rstrip() + "\n"


def render_outputs() -> dict[str, str]:
    model = build_model()
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True, trim_blocks=False, lstrip_blocks=False)
    return {
        "index.html": env.get_template("chronology.html.j2").render(project_name=PROJECT_NAME, canonical_url=machine.canonical("chronology/"), events=model["events"]),
        "chronology.css": (TEMPLATES_DIR / "chronology.css").read_text(encoding="utf-8").rstrip() + "\n",
        "chronology.js": (TEMPLATES_DIR / "chronology.js").read_text(encoding="utf-8").rstrip() + "\n",
        "chronology.json": json_text(model),
        "chronology.md": build_markdown(model),
        "schema.json": SCHEMA_FILE.read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": AUTHORITY_FILE.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual_files() -> set[str]:
    return {path.relative_to(CHRONOLOGY_DIR).as_posix() for path in CHRONOLOGY_DIR.rglob("*") if path.is_file()} if CHRONOLOGY_DIR.exists() else set()


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors: list[str] = []
    if actual_files() != set(outputs):
        errors.append("generated chronology file set differs from expected output")
    for relative, expected in outputs.items():
        path = CHRONOLOGY_DIR / relative
        if not path.exists() or path.read_text(encoding="utf-8") != expected:
            errors.append(f"generated chronology output differs: docs/chronology/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if CHRONOLOGY_DIR.exists():
        shutil.rmtree(CHRONOLOGY_DIR)
    for relative, content in outputs.items():
        path = CHRONOLOGY_DIR / relative
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
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: chronology publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            print("\n".join(f"ERROR: {error}" for error in errors), file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} chronology outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
