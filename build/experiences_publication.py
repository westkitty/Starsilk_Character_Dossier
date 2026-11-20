#!/usr/bin/env python3
"""Deterministic, metadata-only Living Archive publication.

No external exhibit runtime, media asset, private Drive source or canonical
record is ever published here. Public sources remain admission-held.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "src" / "experiences" / "registry.json"
SCHEMA = ROOT / "src" / "schema" / "guest-exhibit-registry.schema.json"
OUT = ROOT / "docs" / "experiences"
TEMPLATES = ROOT / "src" / "templates"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"

def stable_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"

def schema_errors(value: object, schema: dict, path: str = "$") -> list[str]:
    """Implement the fixed schema vocabulary used by this subsystem, without new dependencies."""
    errors: list[str] = []
    if "anyOf" in schema:
        if not any(not schema_errors(value, candidate, path) for candidate in schema["anyOf"]):
            return [f"{path}: no anyOf branch matches"]
    types = {
        "object": lambda v: isinstance(v, dict),
        "array": lambda v: isinstance(v, list),
        "string": lambda v: isinstance(v, str),
        "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
        "boolean": lambda v: isinstance(v, bool),
        "null": lambda v: v is None,
    }
    if "type" in schema and not types[schema["type"]](value):
        return [f"{path}: expected {schema['type']}"]
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path}: must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path}: value is not in allowed enum")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{path}: string is too short")
        if "pattern" in schema and not re.fullmatch(schema["pattern"], value):
            errors.append(f"{path}: pattern mismatch")
    if isinstance(value, int) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path}: below minimum")
    if isinstance(value, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                errors.append(f"{path}: missing {key}")
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            for key in value.keys() - properties.keys():
                errors.append(f"{path}: unexpected {key}")
        for key, sub_schema in properties.items():
            if key in value:
                errors.extend(schema_errors(value[key], sub_schema, f"{path}.{key}"))
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path}: too few items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path}: too many items")
        if schema.get("uniqueItems") and len({stable_json(x) for x in value}) != len(value):
            errors.append(f"{path}: repeated items")
        if "items" in schema:
            for idx, item in enumerate(value):
                errors.extend(schema_errors(item, schema["items"], f"{path}[{idx}]"))
    if "allOf" in schema:
        for rule in schema["allOf"]:
            if "if" in rule and "then" in rule and not schema_errors(value, rule["if"], path):
                errors.extend(schema_errors(value, rule["then"], path))
            elif "if" not in rule:
                errors.extend(schema_errors(value, rule, path))
    return errors

SOURCE_PRIVACY_PATTERNS = (
    ("Drive document/folder URL", re.compile(r"(?:https?://)?(?:drive|docs)\.google\.com/", re.I)),
    ("local user path", re.compile(r"(?:/Users/|/home/|file://|[A-Za-z]:\\Users\\)", re.I)),
    ("local runtime endpoint", re.compile(r"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?", re.I)),
    ("credential or private key", re.compile(r"(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,})")),
    ("identified private file/folder", re.compile(r"\b(?:drive|file|folder)[ _-]?(?:id|identifier)\s*[:=#]\s*[A-Za-z0-9_-]{18,}\b", re.I)),
)


def source_privacy_errors(data: object) -> list[str]:
    """Check public-repository source itself, not merely the docs/ derivative."""
    raw = stable_json(data)
    return [
        "authored registry contains " + description
        for description, pattern in SOURCE_PRIVACY_PATTERNS
        if pattern.search(raw)
    ]


def validate_registry(data: object, schema: dict) -> list[str]:
    errors = schema_errors(data, schema)
    errors.extend(source_privacy_errors(data))
    if errors:
        return errors
    assert isinstance(data, dict)
    ids = [record["id"] for record in data["exhibits"]]
    if len(set(ids)) != len(ids):
        errors.append("guest IDs must be unique")
    for record in data["exhibits"]:
        ident = record["id"]
        source = record["source"]
        evidence = record["evidence"]
        admission = record["admission"]
        if admission["launch_enabled"] or admission["status"] != "hold":
            errors.append(f"{ident}: Phase 1 launch/admission is forbidden")
        if record["visibility"] == "private":
            if source["kind"] != "private-drive" or any(source[k] is not None for k in ("repository", "revision", "url")):
                errors.append(f"{ident}: private Drive source locator must not be stored")
            if admission["show_public_metadata"]:
                errors.append(f"{ident}: private metadata cannot be emitted")
            if evidence["pages_deployment"] != "private-unreleased":
                errors.append(f"{ident}: private release state must remain private-unreleased")
        else:
            repo = "westkitty/" + ident
            if source["kind"] != "github" or source["repository"] != repo:
                errors.append(f"{ident}: repository identity mismatch")
            if source["url"] != f"https://github.com/{repo}/commit/{source['revision']}":
                errors.append(f"{ident}: source URL does not bind to checked commit")
            if not evidence["head_verified"]:
                errors.append(f"{ident}: source HEAD proof is missing")
            if evidence["pages_deployment"] == "private-unreleased":
                errors.append(f"{ident}: public GitHub source has private release state")
        if evidence["pages_deployment"] in ("matched-head-deploy", "older-commit-deploy") and evidence["pages_run_id"] is None:
            errors.append(f"{ident}: claimed deployment lacks run ID")
        if evidence["pages_deployment"] in ("not-proven", "private-unreleased") and evidence["pages_run_id"] is not None:
            errors.append(f"{ident}: unproved deployment cannot have a success run ID")
    return errors

def load_registry() -> dict:
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        raise ValueError("guest registry schema must use JSON Schema draft 2020-12")
    errors = validate_registry(data, schema)
    if errors:
        raise ValueError("invalid guest registry:\n" + "\n".join(errors))
    return data

def public_records(source: dict) -> list[dict]:
    """Explicit allowlist; never serialize the full authored registry."""
    result = []
    for exhibit in source["exhibits"]:
        if exhibit["visibility"] != "public" or not exhibit["admission"]["show_public_metadata"]:
            continue
        if exhibit["source"]["kind"] != "github" or exhibit["admission"]["launch_enabled"]:
            raise ValueError("attempted to publish an unauthorized guest launch")
        result.append({
            "id": exhibit["id"],
            "title": exhibit["title"],
            "collection": exhibit["collection"],
            "visibility": "public",
            "canon_status": exhibit["canon_status"],
            "spoiler_level": exhibit["spoiler_level"],
            "source_commit": exhibit["source"]["revision"],
            "source_url": exhibit["source"]["url"],
            "evidence_state": exhibit["evidence"]["pages_deployment"],
            "evidence_run_id": exhibit["evidence"]["pages_run_id"],
            "live_edge": exhibit["release"]["live_edge"],
            "admission": "hold",
            "hold_reason": exhibit["admission"]["hold_reason"],
            "unknowns": exhibit["unknowns"],
        })
    return result

def outputs() -> dict[str, str]:
    registry = load_registry()
    records = public_records(registry)
    index = {
        "schema": "starsilk-guest-exhibit-index/1",
        "stage": "phase-1-source-metadata",
        "guest_count": len(records),
        "release_policy": "metadata-only; no exhibit launches or embeds",
        "exhibits": records,
    }
    env = Environment(loader=FileSystemLoader(str(TEMPLATES)), autoescape=True)
    html = env.get_template("experiences.html.j2").render(
        records=records, url=SITE_BASE + "experiences/", root_url=SITE_BASE
    )
    return {"index.html": "\n".join(line.rstrip() for line in html.splitlines()).rstrip() + "\n", "experiences.json": stable_json(index)}

def check_outputs(expected: dict[str, str]) -> list[str]:
    actual = {p.name for p in OUT.iterdir() if p.is_file()} if OUT.exists() else set()
    errors = []
    if actual != set(expected):
        errors.append(f"Living Archive output file set drift: expected {sorted(expected)}, got {sorted(actual)}")
    for filename, content in expected.items():
        path = OUT / filename
        if not path.is_file() or path.read_text(encoding="utf-8") != content:
            errors.append(f"Living Archive generator parity failed: {path.relative_to(ROOT)}")
    return errors

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    try:
        expected = outputs()
        if args.check:
            errors = check_outputs(expected)
            if errors:
                raise ValueError("\n".join(errors))
            print(f"OK: {len(expected)} Living Archive files match authored sources")
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            for filename, content in expected.items():
                (OUT / filename).write_text(content, encoding="utf-8")
            errors = check_outputs(expected)
            if errors:
                raise ValueError("\n".join(errors))
            print(f"Generated {len(expected)} metadata-only Living Archive files")
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: Living Archive generation: {exc}", file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
