#!/usr/bin/env python3
"""Generate deterministic human entity permalink pages.

Every page is derived from existing top-level section authority, published-media
provenance, and observed cross-reference evidence. The generated docs/entities/
tree is disposable publication output; stable identity remains the section ID.

Usage: python3 build/entity_publication.py [--check]
  --check   render the complete entity tree in memory and fail if committed
            output differs or if generated files are missing/extra.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit

import jinja2
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
ENTITY_DIR = DOCS_DIR / "entities"
TEMPLATES_DIR = ROOT / "src" / "templates"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
PROJECT_NAME = "Starsilk Compendium"

sys.path.insert(0, str(ROOT / "build"))
import generate  # noqa: E402
import machine_publication as machine  # noqa: E402


def is_external_or_special(url: str) -> bool:
    if not url:
        return True
    parsed = urlsplit(url)
    return bool(parsed.scheme or parsed.netloc or url.startswith("/") or url.startswith("data:"))


def rewrite_relative_url(url: str) -> str:
    if is_external_or_special(url) or url.startswith("#"):
        return url
    if url.startswith("./"):
        url = url[2:]
    return "../../" + url


def rewrite_fragment(fragment: str | None, stable_ids: set[str]) -> str:
    if not fragment:
        return ""
    soup = BeautifulSoup(fragment, "html.parser")
    local_ids = {node.get("id") for node in soup.find_all(id=True)}

    for link in soup.find_all("a", href=True):
        href = link["href"]
        if href.startswith("#"):
            target = href[1:]
            if target in local_ids:
                continue
            if target in stable_ids:
                link["href"] = f"../{target}/"
            elif target:
                link["href"] = f"../../#{target}"
        elif not is_external_or_special(href):
            link["href"] = rewrite_relative_url(href)

    for tag in soup.find_all(True):
        for attr in ("src", "poster"):
            value = tag.get(attr)
            if value and not is_external_or_special(value):
                tag[attr] = rewrite_relative_url(value)
        srcset = tag.get("srcset")
        if srcset:
            rewritten = []
            # Split only on a comma followed by whitespace -- the actual
            # candidate separator per the srcset grammar. A plain
            # srcset.split(",") would also tear apart any data: URI
            # candidate at its mandatory "base64," comma, since that comma
            # is never followed by whitespace.
            for candidate in re.split(r",\s+", srcset.strip()):
                parts = candidate.strip().split()
                if not parts:
                    continue
                parts[0] = rewrite_relative_url(parts[0])
                rewritten.append(" ".join(parts))
            tag["srcset"] = ", ".join(rewritten)

    return str(soup)


def public_classes(section) -> str:
    classes = [name for name in section.classes.split() if name != "page"]
    return " ".join(classes)


def manifest_assets(manifest: dict) -> dict[str, dict]:
    return {asset["filename"]: asset for asset in manifest.get("assets", []) if asset.get("filename")}


def related_media(record: dict, assets: dict[str, dict]) -> list[dict]:
    items = []
    for media_id in record["related_media_ids"]:
        asset = assets.get(media_id, {})
        contexts = [
            context for context in asset.get("contexts", [])
            if context.get("section_id") == record["stable_id"]
        ]
        alt = next((context.get("alt") for context in contexts if context.get("alt")), None)
        items.append(
            {
                "id": media_id,
                "url": f"../../assets/media/{media_id}",
                "mime_type": asset.get("mime_type", "unknown"),
                "alt": alt or media_id,
                "is_image": str(asset.get("mime_type", "")).startswith("image/"),
            }
        )
    return items


def relationship_items(stable_id: str, graph: dict, labels: dict[str, str], direction: str) -> list[dict]:
    key = "outgoing" if direction == "outgoing" else "backlinks"
    values = graph.get(key, {}).get(stable_id, [])
    return [
        {"stable_id": item, "label": labels[item], "url": f"../{item}/"}
        for item in values
        if item in labels
    ]


def page_jsonld(record: dict) -> str:
    stable_id = record["stable_id"]
    payload = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": record["canonical_url"],
        "identifier": stable_id,
        "name": record["display_label"],
        "url": record["canonical_url"],
        "sameAs": machine.legacy_anchor(stable_id),
        "isPartOf": {
            "@type": "CreativeWork",
            "@id": SITE_BASE,
            "name": PROJECT_NAME,
            "url": SITE_BASE,
        },
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True).replace("</", "<\\/")


def index_jsonld(records: list[dict]) -> str:
    payload = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": machine.canonical("entities/"),
        "identifier": "starsilk-entity-index",
        "name": f"{PROJECT_NAME} entity index",
        "url": machine.canonical("entities/"),
        "hasPart": [
            {
                "@type": "CreativeWork",
                "@id": record["canonical_url"],
                "identifier": record["stable_id"],
                "name": record["display_label"],
                "url": record["canonical_url"],
            }
            for record in records
        ],
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True).replace("</", "<\\/")


def render_outputs() -> dict[str, str]:
    rename_map = generate.load_media_rename_map()
    sections = generate.load_sections(rename_map)
    manifest = machine.load_manifest()
    records = machine.build_entity_records(sections, manifest)
    graph = machine.build_relationships()
    labels = {record["stable_id"]: record["display_label"] for record in records}
    record_by_id = {record["stable_id"]: record for record in records}
    assets = manifest_assets(manifest)
    stable_ids = set(record_by_id)

    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=False,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    template = env.get_template("entity.html.j2")
    base_css = (TEMPLATES_DIR / "style.css").read_text(encoding="utf-8").rstrip()
    entity_css = (TEMPLATES_DIR / "entity.css").read_text(encoding="utf-8").rstrip()

    outputs: dict[str, str] = {
        "entity.css": base_css + "\n\n" + entity_css + "\n",
        "index.html": template.render(
            mode="index",
            project_name=PROJECT_NAME,
            canonical_url=machine.canonical("entities/"),
            records=records,
            jsonld=index_jsonld(records),
        ),
    }

    for section in sections:
        record = record_by_id[section.id]
        outputs[f"{section.id}/index.html"] = template.render(
            mode="record",
            project_name=PROJECT_NAME,
            record=record,
            canonical_url=record["canonical_url"],
            legacy_url=machine.legacy_anchor(section.id),
            json_url=machine.entity_json_url(section.id),
            markdown_url=machine.entity_markdown_url(section.id),
            public_classes=public_classes(section),
            title_html=rewrite_fragment(section.title_html, stable_ids),
            body_html=rewrite_fragment(section.body_html, stable_ids),
            media=related_media(record, assets),
            outgoing=relationship_items(section.id, graph, labels, "outgoing"),
            incoming=relationship_items(section.id, graph, labels, "incoming"),
            jsonld=page_jsonld(record),
        )
    return outputs


def actual_files() -> set[str]:
    if not ENTITY_DIR.exists():
        return set()
    return {
        path.relative_to(ENTITY_DIR).as_posix()
        for path in ENTITY_DIR.rglob("*")
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
            errors.append("missing generated entity files: " + ", ".join(missing))
        if extra:
            errors.append("unexpected generated entity files: " + ", ".join(extra))
    for relative, expected in outputs.items():
        path = ENTITY_DIR / relative
        if not path.exists():
            continue
        try:
            current = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated entity output docs/entities/{relative}: {exc}")
            continue
        if current != expected:
            errors.append(f"generated entity output differs: docs/entities/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if ENTITY_DIR.exists():
        shutil.rmtree(ENTITY_DIR)
    for relative, content in outputs.items():
        path = ENTITY_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if generated entity publication differs from committed docs output")
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: entity publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} entity permalink outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
