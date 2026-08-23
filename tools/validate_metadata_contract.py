#!/usr/bin/env python3
"""Validate the Starsilk Museum metadata contract without adding dependencies.

This is deliberately a narrow project validator, not a general JSON Schema
implementation. The schema file is the published contract; this tool verifies
its required enums/fields and validates candidate metadata records against the
same bounded rules using only the Python standard library.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SCHEMA = ROOT / "src" / "schema" / "metadata-record.schema.json"

REQUIRED_FIELDS = {
    "stable_id",
    "object_type",
    "display_label",
    "aliases",
    "canonical_url",
    "source_refs",
    "visibility",
    "canon_status",
    "spoiler_level",
    "related_media_ids",
    "evidence",
    "unknowns",
}
VISIBILITY = {"public", "private"}
CANON_STATUS = {"canon", "development", "historical", "speculative", "unknown"}
SPOILER_LEVEL = {"none", "minor", "major"}
EVIDENCE_CLASSES = {
    "authoritative-content",
    "canon-lock",
    "published-media-provenance",
    "observed-xref",
    "explicit-semantic-authority",
    "generated-derivative",
    "historical-source",
    "unknown",
}
STABLE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._:-]*$")


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate_schema_contract(schema_path: Path = DEFAULT_SCHEMA) -> list[str]:
    errors: list[str] = []
    try:
        schema = _load_json(schema_path)
    except (OSError, json.JSONDecodeError) as exc:
        return [f"schema unreadable: {exc}"]

    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        errors.append("schema must declare JSON Schema draft 2020-12")
    if set(schema.get("required", [])) != REQUIRED_FIELDS:
        errors.append("schema required fields differ from the Phase 1 contract")

    props = schema.get("properties") or {}
    for key in REQUIRED_FIELDS:
        if key not in props:
            errors.append(f"schema missing property: {key}")

    expected_enums = {
        "visibility": VISIBILITY,
        "canon_status": CANON_STATUS,
        "spoiler_level": SPOILER_LEVEL,
    }
    for key, expected in expected_enums.items():
        actual = set((props.get(key) or {}).get("enum", []))
        if actual != expected:
            errors.append(f"schema {key} enum mismatch: {sorted(actual)}")

    source_kinds = set(
        (((props.get("source_refs") or {}).get("items") or {}).get("properties") or {})
        .get("kind", {})
        .get("enum", [])
    )
    if source_kinds != EVIDENCE_CLASSES:
        errors.append("schema source_refs.kind evidence classes mismatch")

    evidence_classes = set(
        (((props.get("evidence") or {}).get("items") or {}).get("properties") or {})
        .get("class", {})
        .get("enum", [])
    )
    if evidence_classes != EVIDENCE_CLASSES:
        errors.append("schema evidence.class values mismatch")

    return errors


def _nonempty_string(value) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_record(record: object) -> list[str]:
    errors: list[str] = []
    if not isinstance(record, dict):
        return ["record must be a JSON object"]

    missing = sorted(REQUIRED_FIELDS - set(record))
    if missing:
        errors.append(f"missing required fields: {', '.join(missing)}")

    unknown_fields = sorted(set(record) - REQUIRED_FIELDS)
    if unknown_fields:
        errors.append(f"unexpected fields: {', '.join(unknown_fields)}")

    sid = record.get("stable_id")
    if not _nonempty_string(sid) or not STABLE_ID_RE.fullmatch(sid):
        errors.append("stable_id must match ^[a-z0-9][a-z0-9._:-]*$")

    for key in ("object_type", "display_label", "canonical_url"):
        if not _nonempty_string(record.get(key)):
            errors.append(f"{key} must be a non-empty string")

    if record.get("visibility") not in VISIBILITY:
        errors.append("visibility must be public or private")
    if record.get("canon_status") not in CANON_STATUS:
        errors.append("canon_status has an unsupported value")
    if record.get("spoiler_level") not in SPOILER_LEVEL:
        errors.append("spoiler_level has an unsupported value")

    for key in ("aliases", "related_media_ids", "unknowns"):
        value = record.get(key)
        if not isinstance(value, list) or any(not _nonempty_string(item) for item in value):
            errors.append(f"{key} must be an array of non-empty strings")
        elif len(value) != len(set(value)):
            errors.append(f"{key} must not contain duplicates")

    media_ids = record.get("related_media_ids")
    if isinstance(media_ids, list):
        for item in media_ids:
            if _nonempty_string(item) and not STABLE_ID_RE.fullmatch(item):
                errors.append(f"related_media_ids contains invalid stable id: {item}")

    source_refs = record.get("source_refs")
    if not isinstance(source_refs, list) or not source_refs:
        errors.append("source_refs must be a non-empty array")
    else:
        for idx, ref in enumerate(source_refs):
            if not isinstance(ref, dict):
                errors.append(f"source_refs[{idx}] must be an object")
                continue
            allowed = {"path", "anchor", "source_key", "kind"}
            extra = sorted(set(ref) - allowed)
            if extra:
                errors.append(f"source_refs[{idx}] unexpected fields: {', '.join(extra)}")
            if not _nonempty_string(ref.get("path")):
                errors.append(f"source_refs[{idx}].path must be non-empty")
            if ref.get("kind") not in EVIDENCE_CLASSES:
                errors.append(f"source_refs[{idx}].kind has an unsupported value")
            for optional in ("anchor", "source_key"):
                if optional in ref and not _nonempty_string(ref.get(optional)):
                    errors.append(f"source_refs[{idx}].{optional} must be non-empty when present")

    evidence = record.get("evidence")
    if not isinstance(evidence, list) or not evidence:
        errors.append("evidence must be a non-empty array")
    else:
        for idx, item in enumerate(evidence):
            if not isinstance(item, dict):
                errors.append(f"evidence[{idx}] must be an object")
                continue
            allowed = {"class", "source_ref", "note"}
            extra = sorted(set(item) - allowed)
            if extra:
                errors.append(f"evidence[{idx}] unexpected fields: {', '.join(extra)}")
            if item.get("class") not in EVIDENCE_CLASSES:
                errors.append(f"evidence[{idx}].class has an unsupported value")
            if not _nonempty_string(item.get("source_ref")):
                errors.append(f"evidence[{idx}].source_ref must be non-empty")
            if "note" in item and not _nonempty_string(item.get("note")):
                errors.append(f"evidence[{idx}].note must be non-empty when present")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate Starsilk metadata contract/records")
    ap.add_argument("--schema", default=str(DEFAULT_SCHEMA))
    ap.add_argument("--record", action="append", default=[], help="JSON metadata record to validate; repeatable")
    args = ap.parse_args()

    schema_errors = validate_schema_contract(Path(args.schema))
    if schema_errors:
        for error in schema_errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    record_errors = []
    for raw_path in args.record:
        path = Path(raw_path)
        try:
            record = _load_json(path)
        except (OSError, json.JSONDecodeError) as exc:
            record_errors.append(f"{path}: unreadable record: {exc}")
            continue
        for error in validate_record(record):
            record_errors.append(f"{path}: {error}")

    if record_errors:
        for error in record_errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print(f"Metadata contract OK: {args.schema}")
    if args.record:
        print(f"Validated metadata records: {len(args.record)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
