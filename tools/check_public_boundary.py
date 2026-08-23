#!/usr/bin/env python3
"""Reject obvious private/local-only state from public machine exports.

This guard is intentionally aimed at generated machine-readable publication,
not arbitrary public prose. It complements build/validate.py and human review.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

TEXT_PATTERNS = [
    ("macOS local path", re.compile(r"/Users/[A-Za-z0-9._-]+/")),
    ("Unix home path", re.compile(r"/home/[A-Za-z0-9._-]+/")),
    ("Windows user path", re.compile(r"[A-Za-z]:\\\\Users\\\\[^\\\\\s]+", re.I)),
    ("file URL", re.compile(r"\bfile://", re.I)),
    ("localhost URL", re.compile(r"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?", re.I)),
    ("private key material", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("GitHub personal token", re.compile(r"\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")),
    ("OpenAI-style secret key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b")),
]
TEXT_SUFFIXES = {".json", ".jsonld", ".md", ".txt", ".xml", ".html", ".csv"}


def iter_files(paths: list[Path]):
    for path in paths:
        if not path.exists():
            continue
        if path.is_file():
            yield path
            continue
        for candidate in sorted(path.rglob("*")):
            if candidate.is_file() and candidate.suffix.lower() in TEXT_SUFFIXES:
                yield candidate


def _private_visibility_locations(value, location: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        if value.get("visibility") == "private":
            found.append(location)
        for key, child in value.items():
            found.extend(_private_visibility_locations(child, f"{location}.{key}"))
    elif isinstance(value, list):
        for idx, child in enumerate(value):
            found.extend(_private_visibility_locations(child, f"{location}[{idx}]"))
    return found


def check_file(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        return [f"{path}: unreadable public-machine text: {exc}"]

    for label, pattern in TEXT_PATTERNS:
        if pattern.search(text):
            errors.append(f"{path}: contains {label}")

    if path.suffix.lower() in {".json", ".jsonld"}:
        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            errors.append(f"{path}: invalid JSON: {exc}")
        else:
            for location in _private_visibility_locations(value):
                errors.append(f"{path}: private visibility present at {location}")

    return errors


def check_paths(paths: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in iter_files(paths):
        errors.extend(check_file(path))
    return errors


def main() -> int:
    ap = argparse.ArgumentParser(description="Check future public Starsilk machine exports for obvious private/local state")
    ap.add_argument("paths", nargs="+", help="Public machine file or directory paths to scan")
    args = ap.parse_args()

    paths = [Path(raw) for raw in args.paths]
    missing = [str(path) for path in paths if not path.exists()]
    if missing:
        for path in missing:
            print(f"ERROR: requested scan path does not exist: {path}", file=sys.stderr)
        return 1

    errors = check_paths(paths)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    scanned = sum(1 for _ in iter_files(paths))
    print(f"Public-boundary check OK: {scanned} text/machine file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
