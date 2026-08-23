#!/usr/bin/env python3
"""Generate Phase 8 curated stable-ID tours and browser-local library shell.

Curated tour IDs are authored in src/tours/tours.json. Stop membership and
order come only from the bound src/content/nav.json navigation group. Human
local-library state is runtime browser-local data and is never generated into
or read back into repository publication.

Usage: python3 build/tour_publication.py [--check]
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
TOUR_DIR = DOCS_DIR / "tours"
TEMPLATES_DIR = ROOT / "src" / "templates"
SOURCE_FILE = ROOT / "src" / "tours" / "tours.json"
AUTHORITY_FILE = ROOT / "src" / "tours" / "AUTHORITY.md"
SCHEMA_FILE = ROOT / "src" / "schema" / "tour-index.schema.json"
NAV_FILE = ROOT / "src" / "content" / "nav.json"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
PROJECT_ID = "starsilk-character-dossier"
PROJECT_NAME = "Starsilk Compendium"
TOUR_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")

sys.path.insert(0, str(ROOT / "build"))
import generate  # noqa: E402
import machine_publication as machine  # noqa: E402


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def load_records() -> list[dict]:
    rename_map = generate.load_media_rename_map()
    sections = generate.load_sections(rename_map)
    manifest = machine.load_manifest()
    return machine.build_entity_records(sections, manifest)


def load_navigation() -> dict[str, dict]:
    payload = json.loads(NAV_FILE.read_text(encoding="utf-8"))
    groups: dict[str, dict] = {}
    seen_ids: set[str] = set()
    for group in payload.get("groups", []):
        label = group.get("label")
        links = group.get("links")
        if not isinstance(label, str) or not label or not isinstance(links, list) or not links:
            raise RuntimeError("every authored navigation group used by tours must have a label and non-empty links")
        if label in groups:
            raise RuntimeError(f"duplicate navigation group label: {label}")
        for link in links:
            stable_id = link.get("id")
            if not isinstance(stable_id, str) or not stable_id:
                raise RuntimeError(f"navigation group {label} has a link without stable ID")
            if stable_id in seen_ids:
                raise RuntimeError(f"stable ID appears in multiple authored navigation groups: {stable_id}")
            seen_ids.add(stable_id)
        groups[label] = group
    return groups


def build_index() -> tuple[dict, list[dict]]:
    source = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    if source.get("schema") != "starsilk-curated-tour-source/1":
        raise RuntimeError("unsupported curated tour source schema")
    specs = source.get("tours")
    if not isinstance(specs, list) or not specs:
        raise RuntimeError("curated tour source must contain a non-empty tours array")

    records = load_records()
    by_id = {record["stable_id"]: record for record in records}
    groups = load_navigation()
    seen_tour_ids: set[str] = set()
    seen_groups: set[str] = set()
    tours: list[dict] = []

    for spec in specs:
        tour_id = spec.get("tour_id")
        group_label = spec.get("navigation_group")
        if not isinstance(tour_id, str) or not TOUR_ID_RE.fullmatch(tour_id):
            raise RuntimeError(f"invalid stable tour ID: {tour_id!r}")
        if tour_id in seen_tour_ids:
            raise RuntimeError(f"duplicate stable tour ID: {tour_id}")
        if not isinstance(group_label, str) or group_label not in groups:
            raise RuntimeError(f"tour {tour_id} references unknown navigation group: {group_label!r}")
        if group_label in seen_groups:
            raise RuntimeError(f"navigation group is bound to multiple curated tour IDs: {group_label}")
        seen_tour_ids.add(tour_id)
        seen_groups.add(group_label)

        stops = []
        for position, link in enumerate(groups[group_label]["links"], start=1):
            stable_id = link["id"]
            record = by_id.get(stable_id)
            if record is None:
                raise RuntimeError(f"tour {tour_id} references unknown stable record: {stable_id}")
            stops.append(
                {
                    "position": position,
                    "stable_id": stable_id,
                    "display_label": record["display_label"],
                    "canonical_url": record["canonical_url"],
                    "legacy_url": machine.legacy_anchor(stable_id),
                    "source_ref": "src/content/nav.json",
                }
            )
        tours.append(
            {
                "tour_id": tour_id,
                "label": group_label,
                "canonical_url": machine.canonical(f"tours/#tour-{tour_id}"),
                "navigation_group": group_label,
                "source_refs": [
                    {"path": "src/tours/tours.json", "anchor": tour_id, "kind": "editorial-navigation"},
                    {"path": "src/content/nav.json", "anchor": group_label, "kind": "authoritative-navigation"},
                ],
                "stop_count": len(stops),
                "stops": stops,
            }
        )

    index = {
        "schema": "starsilk-tour-index/1",
        "schema_url": machine.canonical("machine/schema/v1/tour-index.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": machine.canonical("tours/tours.json"),
        "human_url": machine.canonical("tours/"),
        "source_ref": "src/tours/tours.json",
        "tour_count": len(tours),
        "tours": tours,
        "local_state_policy": {
            "scope": "browser-local",
            "account_required": False,
            "analytics_or_telemetry": False,
            "published": False,
            "private_text_in_urls": False,
        },
        "interpretation_rules": [
            "Tour order is editorial navigation only and does not assert chronology, causality, importance, or semantic relationships.",
            "Tour stops reference existing stable records and do not duplicate or replace canon prose.",
            "Bookmarks, recent openings, history, progress, and named collections are browser-local user state and never canon evidence.",
            "User-authored local collection names are not serialized into public URLs or generated publication.",
        ],
    }
    return index, records


def render_outputs() -> dict[str, str]:
    index, records = build_index()
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True, trim_blocks=False, lstrip_blocks=False)
    template = env.get_template("tours.html.j2")
    base_css = (TEMPLATES_DIR / "style.css").read_text(encoding="utf-8").rstrip()
    tour_css = (TEMPLATES_DIR / "tours.css").read_text(encoding="utf-8").rstrip()
    return {
        "index.html": template.render(project_name=PROJECT_NAME, canonical_url=machine.canonical("tours/"), tours=index["tours"], records=records),
        "tours.css": base_css + "\n\n" + tour_css + "\n",
        "tours.js": (TEMPLATES_DIR / "tours.js").read_text(encoding="utf-8").rstrip() + "\n",
        "tours.json": json_text(index),
        "schema.json": SCHEMA_FILE.read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": AUTHORITY_FILE.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual_files() -> set[str]:
    if not TOUR_DIR.exists():
        return set()
    return {path.relative_to(TOUR_DIR).as_posix() for path in TOUR_DIR.rglob("*") if path.is_file()}


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors: list[str] = []
    expected = set(outputs)
    actual = actual_files()
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        if missing:
            errors.append("missing generated tour files: " + ", ".join(missing))
        if extra:
            errors.append("unexpected generated tour files: " + ", ".join(extra))
    for relative, expected_text in outputs.items():
        path = TOUR_DIR / relative
        if not path.exists():
            continue
        try:
            current = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated tour output docs/tours/{relative}: {exc}")
            continue
        if current != expected_text:
            errors.append(f"generated tour output differs: docs/tours/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if TOUR_DIR.exists():
        shutil.rmtree(TOUR_DIR)
    for relative, content in outputs.items():
        path = TOUR_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if generated tour publication differs from committed docs output")
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: tour publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} tour outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
