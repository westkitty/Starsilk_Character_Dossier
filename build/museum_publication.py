#!/usr/bin/env python3
"""Generate the Phase 4 museum-object model and human media viewer.

Museum objects are deterministic derivatives of docs/asset-manifest.json.
The published media filename remains the provenance identity; the museum
object ID is its filename with only the final extension removed. Descriptive
labels, match status, context, and provenance never replace that identity.

The generated docs/objects/ tree is disposable publication output. Canonical
original media remains outside Git in media/source/ and this generator never
regenerates or mutates media binaries.

Usage: python3 build/museum_publication.py [--check]
  --check   render the complete object publication in memory and fail if the
            committed docs/objects/ tree differs or has missing/extra files.
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
OBJECT_DIR = DOCS_DIR / "objects"
MANIFEST_FILE = DOCS_DIR / "asset-manifest.json"
TEMPLATES_DIR = ROOT / "src" / "templates"
SCHEMA_FILE = ROOT / "src" / "schema" / "museum-object-index.schema.json"
AUTHORITY_FILE = ROOT / "src" / "museum" / "AUTHORITY.md"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
PROJECT_ID = "starsilk-character-dossier"
PROJECT_NAME = "Starsilk Compendium"


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def object_id(filename: str) -> str:
    if not filename or filename != Path(filename).name or "/" in filename or "\\" in filename:
        raise RuntimeError(f"unsafe or missing published media filename: {filename!r}")
    suffix = Path(filename).suffix
    if not suffix:
        raise RuntimeError(f"published media filename has no extension: {filename}")
    value = filename[: -len(suffix)]
    if not value:
        raise RuntimeError(f"published media filename has no stable stem: {filename}")
    return value


def object_url(value: str) -> str:
    return f"{SITE_BASE}objects/#{value}"


def media_url(filename: str) -> str:
    return f"{SITE_BASE}assets/media/{filename}"


def entity_url(section_id: str) -> str:
    return f"{SITE_BASE}entities/{section_id}/"


def media_kind(mime_type: str) -> str:
    if mime_type.startswith("image/"):
        return "image"
    if mime_type.startswith("video/"):
        return "video"
    return "other"


def build_records(manifest: dict) -> list[dict]:
    assets = manifest.get("assets")
    if not isinstance(assets, list):
        raise RuntimeError("asset manifest has no assets array")
    declared_count = manifest.get("unique_binary_assets")
    if declared_count != len(assets):
        raise RuntimeError(
            f"asset manifest count mismatch: unique_binary_assets={declared_count!r}, assets={len(assets)}"
        )

    seen_filenames: set[str] = set()
    seen_ids: set[str] = set()
    records: list[dict] = []

    for asset in assets:
        filename = asset.get("filename")
        value = object_id(filename)
        if filename in seen_filenames:
            raise RuntimeError(f"duplicate published media filename: {filename}")
        if value in seen_ids:
            raise RuntimeError(f"museum object ID collision after extension removal: {value}")
        seen_filenames.add(filename)
        seen_ids.add(value)

        mime_type = asset.get("mime_type")
        if not isinstance(mime_type, str) or not mime_type:
            raise RuntimeError(f"museum object {value} has no MIME type")

        contexts = []
        raw_contexts = asset.get("contexts", [])
        if not isinstance(raw_contexts, list):
            raise RuntimeError(f"museum object {value} contexts must be an array")
        for context in raw_contexts:
            section_id = context.get("section_id")
            if not isinstance(section_id, str) or not section_id:
                raise RuntimeError(f"museum object {value} has a context without section_id")
            alt = context.get("alt")
            if alt is not None and not isinstance(alt, str):
                raise RuntimeError(f"museum object {value} context alt must be string or null")
            contexts.append(
                {
                    "section_id": section_id,
                    "alt": alt,
                    "entity_url": entity_url(section_id),
                }
            )

        unknowns = []
        if not asset.get("logical_identity"):
            unknowns.append("No logical identity is authored for this published media object.")
        if not contexts:
            unknowns.append("No published section context is attached to this media object.")
        elif any(context["alt"] is None for context in contexts):
            unknowns.append("One or more published contexts have no authored alt text.")

        record = {
            "object_id": value,
            "filename": filename,
            "canonical_url": object_url(value),
            "media_url": media_url(filename),
            "media_kind": media_kind(mime_type),
            "mime_type": mime_type,
            "sha256": asset.get("sha256"),
            "bytes": asset.get("bytes"),
            "source": {
                "filename": asset.get("source_filename"),
                "sha256": asset.get("source_sha256"),
                "bytes": asset.get("source_bytes"),
            },
            "logical_identity": asset.get("logical_identity"),
            "match_status": asset.get("match_status"),
            "provenance": asset.get("provenance"),
            "contexts": contexts,
            "evidence": {
                "class": "published-media-provenance",
                "source_ref": "docs/asset-manifest.json",
                "source_key": filename,
                "identity_basis": "Published filename with its final extension removed.",
            },
            "unknowns": unknowns,
        }
        records.append(record)

    return records


def build_index(manifest: dict) -> dict:
    records = build_records(manifest)
    return {
        "schema": "starsilk-museum-object-index/1",
        "schema_url": f"{SITE_BASE}objects/schema.json",
        "project_id": PROJECT_ID,
        "canonical_url": f"{SITE_BASE}objects/objects.json",
        "human_index": f"{SITE_BASE}objects/",
        "source_manifest": f"{SITE_BASE}asset-manifest.json",
        "identity_rule": "object_id is the published media filename with only its final file extension removed",
        "record_count": len(records),
        "records": records,
        "interpretation_rules": [
            "The published filename remains the media provenance identity; object_id is a deterministic URL-safe view of that identity.",
            "logical_identity, match_status, provenance, and context are descriptive manifest evidence and never replace object identity.",
            "A context proves published placement in a Compendium section only; it does not establish a richer semantic relationship.",
            "Null or absent descriptive fields remain unknown and must not be inferred from filenames, imagery, or adjacent lore.",
        ],
    }


def render_outputs() -> dict[str, str]:
    if not MANIFEST_FILE.exists():
        raise RuntimeError("docs/asset-manifest.json is missing")
    manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    index = build_index(manifest)

    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    template = env.get_template("museum.html.j2")
    base_css = (TEMPLATES_DIR / "style.css").read_text(encoding="utf-8").rstrip()
    museum_css = (TEMPLATES_DIR / "museum.css").read_text(encoding="utf-8").rstrip()

    return {
        "index.html": template.render(
            project_name=PROJECT_NAME,
            object_count=index["record_count"],
            canonical_url=f"{SITE_BASE}objects/",
            json_url=f"{SITE_BASE}objects/objects.json",
        ),
        "museum.css": base_css + "\n\n" + museum_css + "\n",
        "museum.js": (TEMPLATES_DIR / "museum.js").read_text(encoding="utf-8").rstrip() + "\n",
        "objects.json": json_text(index),
        "schema.json": SCHEMA_FILE.read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": AUTHORITY_FILE.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual_files() -> set[str]:
    if not OBJECT_DIR.exists():
        return set()
    return {
        path.relative_to(OBJECT_DIR).as_posix()
        for path in OBJECT_DIR.rglob("*")
        if path.is_file()
    }


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors: list[str] = []
    expected_files = set(outputs)
    actual = actual_files()
    if actual != expected_files:
        missing = sorted(expected_files - actual)
        extra = sorted(actual - expected_files)
        if missing:
            errors.append("missing generated museum files: " + ", ".join(missing))
        if extra:
            errors.append("unexpected generated museum files: " + ", ".join(extra))

    for relative, expected in outputs.items():
        path = OBJECT_DIR / relative
        if not path.exists():
            continue
        try:
            current = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated museum output docs/objects/{relative}: {exc}")
            continue
        if current != expected:
            errors.append(f"generated museum output differs: docs/objects/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if OBJECT_DIR.exists():
        shutil.rmtree(OBJECT_DIR)
    for relative, content in outputs.items():
        path = OBJECT_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if generated museum publication differs from committed docs output")
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: museum publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} museum object outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
