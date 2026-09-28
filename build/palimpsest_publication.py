#!/usr/bin/env python3
"""Generate the source-backed Starsilk: Palimpsest onboarding experience."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = DOCS / "palimpsest"
SOURCE = ROOT / "src" / "palimpsest" / "experience.json"
AUTHORITY = ROOT / "src" / "palimpsest" / "AUTHORITY.md"
SCHEMA = ROOT / "src" / "schema" / "palimpsest-experience.schema.json"
SECTIONS = ROOT / "src" / "content" / "sections.json"
TEMPLATES = ROOT / "src" / "templates"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def load_experience() -> dict:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    if data.get("schema") != "starsilk-palimpsest-experience/1":
        raise RuntimeError("unsupported Palimpsest source schema")
    if data.get("state_policy") != "session-only-noncanonical":
        raise RuntimeError("Palimpsest state policy must remain session-only-noncanonical")
    phases = data.get("phases")
    if not isinstance(phases, list) or not phases:
        raise RuntimeError("Palimpsest must declare at least one phase")
    phase_ids = [phase.get("phase_id") for phase in phases]
    if len(phase_ids) != len(set(phase_ids)) or any(not re.fullmatch(r"[a-z0-9][a-z0-9-]*", value or "") for value in phase_ids):
        raise RuntimeError("Palimpsest phase IDs must be unique stable slugs")

    stable_ids = {item["id"] for item in json.loads(SECTIONS.read_text(encoding="utf-8"))["sections"]}
    for phase in phases:
        refs = phase.get("source_stable_ids")
        if not isinstance(refs, list) or not refs or len(refs) != len(set(refs)):
            raise RuntimeError(f"{phase.get('phase_id')} must declare unique source stable IDs")
        missing = set(refs) - stable_ids
        if missing:
            raise RuntimeError(f"{phase['phase_id']} references unknown stable IDs: {sorted(missing)}")
    return data


def outputs() -> dict[str, str]:
    experience = load_experience()
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(TEMPLATES)), autoescape=True)
    html = env.get_template("palimpsest.html.j2").render(
        experience=experience,
        phases={phase["phase_id"]: phase for phase in experience["phases"]},
        canonical_url=SITE_BASE + "palimpsest/",
    )
    return {
        "index.html": html.rstrip() + "\n",
        "palimpsest.css": (TEMPLATES / "palimpsest.css").read_text(encoding="utf-8").rstrip() + "\n",
        "palimpsest.js": (TEMPLATES / "palimpsest.js").read_text(encoding="utf-8").rstrip() + "\n",
        "experience.json": json_text(experience),
        "schema.json": SCHEMA.read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": AUTHORITY.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual() -> set[str]:
    return {path.relative_to(OUT).as_posix() for path in OUT.rglob("*") if path.is_file()} if OUT.exists() else set()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        rendered = outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: Palimpsest generation failed: {exc}", file=sys.stderr)
        return 1

    if args.check:
        errors: list[str] = []
        if actual() != set(rendered):
            errors.append(f"generated Palimpsest file set differs: expected={sorted(rendered)} actual={sorted(actual())}")
        for name, expected in rendered.items():
            path = OUT / name
            if not path.exists():
                errors.append(f"missing generated Palimpsest output: docs/palimpsest/{name}")
            elif path.read_text(encoding="utf-8") != expected:
                errors.append(f"generated Palimpsest output differs: docs/palimpsest/{name}")
        if errors:
            print("\n".join("ERROR: " + error for error in errors), file=sys.stderr)
            return 1
        print(f"OK: {len(rendered)} Palimpsest outputs match generator output.")
        return 0

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for name, content in rendered.items():
        path = OUT / name
        path.write_text(content, encoding="utf-8")
        print("Wrote", path.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
