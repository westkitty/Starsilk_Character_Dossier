#!/usr/bin/env python3
"""Generate the deterministic public Canon Inspector.

The complete docs/canon/ tree is disposable publication output derived only
from src/canon/invariants.json and established source identities. It exposes a
machine-enforced subset of canon, never a complete or editable canon source.

Usage: python3 build/canon_publication.py [--check]
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
CANON_DIR = DOCS_DIR / "canon"
TEMPLATES_DIR = ROOT / "src" / "templates"
INVARIANTS_FILE = ROOT / "src" / "canon" / "invariants.json"
AUTHORITY_FILE = ROOT / "src" / "canon" / "AUTHORITY.md"
SCHEMA_FILE = ROOT / "src" / "schema" / "canon-lock-register.schema.json"
PROJECT_ID = "starsilk-character-dossier"

sys.path.insert(0, str(ROOT / "build"))
import generate  # noqa: E402
import machine_publication as machine  # noqa: E402


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def clean_text(value: str) -> str:
    return "\n".join(line.rstrip(" \t") for line in value.splitlines()).rstrip() + "\n"


def load_invariants() -> dict:
    canon = json.loads(INVARIANTS_FILE.read_text(encoding="utf-8"))
    if canon.get("schema") != "starsilk-canon-invariants/1":
        raise RuntimeError("unsupported canon invariant schema")
    locks = canon.get("document_locks", []) + canon.get("section_locks", [])
    lock_ids = [lock.get("id") for lock in locks]
    if not lock_ids or any(not isinstance(value, str) or not value for value in lock_ids):
        raise RuntimeError("canon invariant locks require non-empty IDs")
    if len(lock_ids) != len(set(lock_ids)):
        raise RuntimeError("canon invariant lock IDs must be unique")
    return canon


def source_target(scope: str, section_id: str | None) -> dict:
    if scope == "document":
        return {
            "kind": "complete-compendium-document",
            "stable_id": None,
            "canonical_url": machine.canonical(),
            "source_refs": [
                "src/content/sections.json",
                "src/content/sections/*.title.html",
                "src/content/sections/*.body.html",
            ],
        }
    assert section_id is not None
    return {
        "kind": "published-section",
        "stable_id": section_id,
        "canonical_url": machine.entity_permalink(section_id),
        "source_refs": ["src/content/sections.json", f"src/content/sections/{section_id}.body.html"],
    }


def lock_record(lock: dict, scope: str) -> dict:
    section_id = lock.get("section") if scope == "section" else None
    if scope == "section" and not isinstance(section_id, str):
        raise RuntimeError(f"section lock {lock.get('id')!r} lacks a stable section target")
    target = source_target(scope, section_id)
    scope_semantics = (
        "Applied to the complete generated Compendium document; positive requirements are evaluated at document scope and prohibitions apply globally."
        if scope == "document"
        else f"Applied only to generated section #{section_id}; positive requirements and prohibitions are evaluated inside that section."
    )
    return {
        "lock_id": lock["id"],
        "description": lock.get("description", ""),
        "scope": scope,
        "target": target,
        "positive_requirements": list(lock.get("must_match", [])),
        "prohibitions": list(lock.get("must_not_match", [])),
        "authority": {
            "canon_content": "authored dossier content in the target source references",
            "machine_validation": "src/canon/invariants.json",
            "public_derivative": "generated /canon/ publication",
        },
        "enforcement": {
            "validator": "build/validate.py --strict",
            "status": "enforced-on-generated-compendium-validation",
            "scope_semantics": scope_semantics,
        },
    }


def build_model() -> dict:
    canon = load_invariants()
    sections = generate.load_sections(generate.load_media_rename_map())
    section_ids = {section.id for section in sections}
    document_locks = [lock_record(lock, "document") for lock in canon.get("document_locks", [])]
    section_locks = [lock_record(lock, "section") for lock in canon.get("section_locks", [])]
    for lock in section_locks:
        if lock["target"]["stable_id"] not in section_ids:
            raise RuntimeError(f"canon lock {lock['lock_id']!r} targets a missing stable section")

    locks = document_locks + section_locks
    return {
        "schema": "starsilk-canon-lock-register/1",
        "schema_url": machine.canonical("machine/schema/v1/canon-lock-register.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": machine.canonical("canon/"),
        "source_invariants": "src/canon/invariants.json",
        "lock_count": len(locks),
        "document_lock_count": len(document_locks),
        "section_lock_count": len(section_locks),
        "locks": locks,
        "additional_validator_assertions": {
            "structural_counts": canon.get("counts", {}),
            "principal_names": canon.get("principal_names", []),
            "drakken_art_identity_section_ids": canon.get("drakken_art_identities", []),
        },
        "authority_boundary": [
            "This register is a machine-enforced validation subset extracted from existing authoritative dossier content; it is not the complete Starsilk canon.",
            "Absence from this register does not imply that a fact is non-canon, false, or available for invention.",
            "Raw pattern strings are technical machine-validation evidence, not standalone canon prose.",
            "Generated /canon/ artifacts are public derivatives and do not become editable canon authority.",
        ],
    }


def build_markdown(model: dict) -> str:
    lines = [
        "# Starsilk Compendium — Canon Inspector",
        "",
        f"Canonical: {model['canonical_url']}",
        f"JSON: {machine.canonical('canon/canon-locks.json')}",
        f"Schema: {model['schema_url']}",
        f"Authority: {machine.canonical('canon/AUTHORITY.md')}",
        "",
        "These are machine-enforced validation locks protecting selected established facts. They are not the complete Starsilk canon.",
        "Absence from this register does not imply non-canon status.",
        "",
        f"- Total locks: {model['lock_count']}",
        f"- Document locks: {model['document_lock_count']}",
        f"- Section locks: {model['section_lock_count']}",
        "",
    ]
    for lock in model["locks"]:
        target = lock["target"]
        lines.extend([
            f"## {lock['lock_id']}",
            "",
            lock["description"],
            "",
            f"- Scope: `{lock['scope']}`",
            f"- Target: [{target['kind']}]({target['canonical_url']})" + (f" (`{target['stable_id']}`)" if target["stable_id"] else ""),
            f"- Machine validation authority: `{lock['authority']['machine_validation']}`",
            f"- Enforcement: `{lock['enforcement']['validator']}` — `{lock['enforcement']['status']}`",
            f"- Scope semantics: {lock['enforcement']['scope_semantics']}",
            "",
            "### Machine validation patterns",
            "",
            "These raw patterns are technical evidence, not canon prose.",
            "",
            "#### Positive requirements",
            "",
        ])
        lines.extend([f"- `{value}`" for value in lock["positive_requirements"]] or ["- None."])
        lines.extend(["", "#### Prohibitions", ""])
        lines.extend([f"- `{value}`" for value in lock["prohibitions"]] or ["- None."])
        lines.append("")
    extra = model["additional_validator_assertions"]
    lines.extend([
        "## Additional strict-validator inputs",
        "",
        "These are invariant inputs used by the existing validator. They are not additional complete-canon claims.",
        "",
        "### Structural counts",
        "",
    ])
    lines.extend([f"- `{key}`: {value}" for key, value in extra["structural_counts"].items()])
    lines.extend(["", "### Principal-name expectations", ""])
    lines.extend([f"- {value}" for value in extra["principal_names"]])
    lines.extend(["", "### Drakken art-identity section IDs", ""])
    lines.extend([f"- `{value}`" for value in extra["drakken_art_identity_section_ids"]])
    return clean_text("\n".join(lines))


def render_outputs() -> dict[str, str]:
    model = build_model()
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)), autoescape=False)
    template = env.get_template("canon-inspector.html.j2")
    base_css = (TEMPLATES_DIR / "style.css").read_text(encoding="utf-8").rstrip()
    canon_css = (TEMPLATES_DIR / "canon-inspector.css").read_text(encoding="utf-8").rstrip()
    return {
        "index.html": clean_text(template.render(model=model)),
        "canon-inspector.css": base_css + "\n\n" + canon_css + "\n",
        "canon-locks.json": json_text(model),
        "canon-locks.md": build_markdown(model),
        "schema.json": SCHEMA_FILE.read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": AUTHORITY_FILE.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual_files() -> set[str]:
    if not CANON_DIR.exists():
        return set()
    return {path.relative_to(CANON_DIR).as_posix() for path in CANON_DIR.rglob("*") if path.is_file()}


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors: list[str] = []
    expected, actual = set(outputs), actual_files()
    if expected != actual:
        if expected - actual:
            errors.append("missing generated Canon Inspector files: " + ", ".join(sorted(expected - actual)))
        if actual - expected:
            errors.append("unexpected generated Canon Inspector files: " + ", ".join(sorted(actual - expected)))
    for relative, expected_text in outputs.items():
        path = CANON_DIR / relative
        if path.exists() and path.read_text(encoding="utf-8") != expected_text:
            errors.append(f"generated Canon Inspector output differs: docs/canon/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if CANON_DIR.exists():
        shutil.rmtree(CANON_DIR)
    for relative, content in outputs.items():
        path = CANON_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if generated Canon Inspector output differs from committed docs output")
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: Canon Inspector generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} Canon Inspector outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
