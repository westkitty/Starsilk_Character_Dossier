#!/usr/bin/env python3
"""Generate deterministic faceted discovery and AI context-packet derivatives.

Phase 7 adds a public discovery surface without replacing the existing root
Compendium search. Every result and packet is derived from established section,
navigation, manifest, and observed-xref authorities. Generated discovery files
are convenience derivatives, never a second canon or relationship authority.

Usage: python3 build/discovery_publication.py [--check]
  --check   render every owned output in memory and fail if committed output
            differs or if docs/discover contains extra/missing files.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import shutil
import sys
from pathlib import Path

import jinja2
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
DISCOVER_DIR = DOCS_DIR / "discover"
TEMPLATES_DIR = ROOT / "src" / "templates"
DISCOVERY_SOURCE_DIR = ROOT / "src" / "discovery"
SCHEMA_DIR = ROOT / "src" / "schema"
NAV_FILE = ROOT / "src" / "content" / "nav.json"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
PROJECT_ID = "starsilk-character-dossier"
PROJECT_NAME = "Starsilk Compendium"

sys.path.insert(0, str(ROOT / "build"))
import generate  # noqa: E402
import machine_publication as machine  # noqa: E402

EXCERPT_LIMIT = 320
UNLISTED_GROUP_VALUE = "__unlisted__"


def normalized_text(fragment: str | None) -> str:
    if not fragment:
        return ""
    soup = BeautifulSoup(fragment, "html.parser")
    for node in soup(["script", "style"]):
        node.decompose()
    return " ".join(soup.stripped_strings)


def mechanical_excerpt(text: str, limit: int = EXCERPT_LIMIT) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    clipped = text[: limit + 1]
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return clipped.rstrip(" ,;:-") + "…"


def load_nav_groups() -> tuple[dict[str, str], list[str]]:
    payload = json.loads(NAV_FILE.read_text(encoding="utf-8"))
    by_id: dict[str, str] = {}
    order: list[str] = []
    for group in payload.get("groups", []):
        label = group.get("label")
        if not isinstance(label, str) or not label:
            continue
        order.append(label)
        for link in group.get("links", []):
            stable_id = link.get("id")
            if isinstance(stable_id, str) and stable_id:
                if stable_id in by_id:
                    raise RuntimeError(f"stable ID appears in multiple authored navigation groups: {stable_id}")
                by_id[stable_id] = label
    return by_id, order


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def result_record(section, record: dict, nav_group: str | None) -> dict:
    source_text = normalized_text(section.body_html)
    excerpt = mechanical_excerpt(source_text)
    archetype = section.attrs.get("data-archetype") if getattr(section, "attrs", None) else None
    if not isinstance(archetype, str) or not archetype:
        archetype = None
    return {
        "stable_id": record["stable_id"],
        "display_label": record["display_label"],
        "canonical_url": record["canonical_url"],
        "legacy_url": machine.legacy_anchor(record["stable_id"]),
        "result_class": record["object_type"],
        "navigation_group": nav_group,
        "archetype": archetype,
        "excerpt": excerpt,
        "excerpt_source_ref": f"src/content/sections/{record['stable_id']}.body.html",
        "has_media": bool(record["related_media_ids"]),
        "media_count": len(record["related_media_ids"]),
        "context_packet_url": machine.canonical(f"discover/packets/{record['stable_id']}.json"),
    }


def build_facets(results: list[dict], nav_order: list[str]) -> dict:
    class_counts = Counter(item["result_class"] for item in results)
    group_counts = Counter(item["navigation_group"] for item in results if item["navigation_group"])
    unlisted_count = sum(1 for item in results if item["navigation_group"] is None)
    archetype_counts = Counter(item["archetype"] for item in results if item["archetype"])
    media_count = sum(1 for item in results if item["has_media"])

    return {
        "result_class": [
            {"value": value, "count": class_counts[value]}
            for value in sorted(class_counts)
        ],
        "navigation_group": [
            {"value": label, "count": group_counts[label]}
            for label in nav_order
            if group_counts[label]
        ] + ([{"value": UNLISTED_GROUP_VALUE, "label": "Not in authored navigation", "count": unlisted_count}] if unlisted_count else []),
        "archetype": [
            {"value": value, "count": archetype_counts[value]}
            for value in sorted(archetype_counts)
        ],
        "media": [
            {"value": "with-media", "count": media_count},
            {"value": "without-media", "count": len(results) - media_count},
        ],
    }


def build_context_packet(section, record: dict, result: dict, relationships: dict) -> dict:
    stable_id = record["stable_id"]
    outgoing = list(relationships.get("outgoing", {}).get(stable_id, []))
    incoming = list(relationships.get("backlinks", {}).get(stable_id, []))
    unknowns = list(record.get("unknowns", []))
    if result["navigation_group"] is None:
        unknowns.append("This stable record is not assigned to an authored src/content/nav.json navigation group.")
    return {
        "schema": "starsilk-ai-context-packet/1",
        "schema_url": machine.canonical("machine/schema/v1/context-packet.schema.json"),
        "project_id": PROJECT_ID,
        "packet_kind": "entity-context",
        "packet_url": result["context_packet_url"],
        "stable_id": stable_id,
        "display_label": record["display_label"],
        "canonical_url": record["canonical_url"],
        "legacy_url": machine.legacy_anchor(stable_id),
        "result_class": result["result_class"],
        "navigation_group": result["navigation_group"],
        "archetype": result["archetype"],
        "excerpt": result["excerpt"],
        "excerpt_source_ref": result["excerpt_source_ref"],
        "visibility": record["visibility"],
        "canon_status": record["canon_status"],
        "spoiler_level": record["spoiler_level"],
        "related_media_ids": list(record["related_media_ids"]),
        "observed_relationships": {
            "kind": "mentions",
            "evidence_class": "observed-xref",
            "outgoing_stable_ids": outgoing,
            "incoming_stable_ids": incoming,
        },
        "source_refs": list(record["source_refs"]),
        "unknowns": unknowns,
        "authority_note": "Compact generated convenience packet. Canon/content authority remains the cited authored source; observed relationships prove mentions only; generated excerpts are mechanical source projections, not new canon prose.",
    }


def build_markdown(results: list[dict]) -> str:
    lines = [
        f"# {PROJECT_NAME} — faceted discovery index",
        "",
        f"Human discovery: {machine.canonical('discover/')}",
        f"JSON discovery index: {machine.canonical('discover/discovery.json')}",
        f"Context packet register: {machine.canonical('discover/context-packets.json')}",
        f"Authority: {machine.canonical('discover/AUTHORITY.md')}",
        "",
        "This is a deterministic discovery derivative. Result class is structural publication metadata, excerpts are mechanical source projections, and search/facet inclusion does not create or negate canon facts.",
        "",
        "| Stable ID | Label | Result class | Navigation group | Media | Context packet |",
        "|---|---|---|---|---:|---|",
    ]
    for item in results:
        label = item["display_label"].replace("|", "\\|")
        group = (item["navigation_group"] or "—").replace("|", "\\|")
        lines.append(
            f"| `{item['stable_id']}` | {label} | `{item['result_class']}` | {group} | {item['media_count']} | {item['context_packet_url']} |"
        )
    return "\n".join(lines) + "\n"


def render_outputs() -> dict[str, str]:
    rename_map = generate.load_media_rename_map()
    sections = generate.load_sections(rename_map)
    manifest = machine.load_manifest()
    records = machine.build_entity_records(sections, manifest)
    relationships = machine.build_relationships()
    if len(sections) != len(records):
        raise RuntimeError("section/entity record cardinality mismatch")

    nav_by_id, nav_order = load_nav_groups()
    results = [
        result_record(section, record, nav_by_id.get(record["stable_id"]))
        for section, record in zip(sections, records)
    ]
    facets = build_facets(results, nav_order)
    packets = [
        build_context_packet(section, record, result, relationships)
        for section, record, result in zip(sections, records, results)
    ]

    discovery_index = {
        "schema": "starsilk-discovery-index/1",
        "schema_url": machine.canonical("machine/schema/v1/discovery-index.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": machine.canonical("discover/discovery.json"),
        "human_url": machine.canonical("discover/"),
        "record_count": len(results),
        "result_semantics": "Structural, source-derived discovery metadata only; result inclusion/ranking is not canon authority.",
        "facets": facets,
        "records": results,
    }
    packet_index = {
        "schema": "starsilk-ai-context-packet-index/1",
        "schema_url": machine.canonical("machine/schema/v1/context-packet-index.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": machine.canonical("discover/context-packets.json"),
        "packet_count": len(packets),
        "packet_pattern": machine.canonical("discover/packets/<stable-id>.json"),
        "packets": [
            {
                "stable_id": packet["stable_id"],
                "display_label": packet["display_label"],
                "packet_url": packet["packet_url"],
                "canonical_url": packet["canonical_url"],
            }
            for packet in packets
        ],
        "authority_note": "Index of generated convenience packets; cited authored sources remain authority.",
    }

    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=True,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    template = env.get_template("discovery.html.j2")
    html = template.render(
        project_name=PROJECT_NAME,
        canonical_url=machine.canonical("discover/"),
        results=results,
        facets=facets,
        unlisted_group_value=UNLISTED_GROUP_VALUE,
    )

    outputs: dict[str, str] = {
        "index.html": html,
        "discovery.css": (TEMPLATES_DIR / "discovery.css").read_text(encoding="utf-8").rstrip() + "\n",
        "discovery.js": (TEMPLATES_DIR / "discovery.js").read_text(encoding="utf-8").rstrip() + "\n",
        "discovery.json": json_text(discovery_index),
        "discovery.md": build_markdown(results),
        "context-packets.json": json_text(packet_index),
        "schema.json": (SCHEMA_DIR / "discovery-index.schema.json").read_text(encoding="utf-8").rstrip() + "\n",
        "context-packet.schema.json": (SCHEMA_DIR / "context-packet.schema.json").read_text(encoding="utf-8").rstrip() + "\n",
        "context-packet-index.schema.json": (SCHEMA_DIR / "context-packet-index.schema.json").read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": (DISCOVERY_SOURCE_DIR / "AUTHORITY.md").read_text(encoding="utf-8").rstrip() + "\n",
    }
    for packet in packets:
        outputs[f"packets/{packet['stable_id']}.json"] = json_text(packet)
    return outputs


def actual_files() -> set[str]:
    if not DISCOVER_DIR.exists():
        return set()
    return {
        path.relative_to(DISCOVER_DIR).as_posix()
        for path in DISCOVER_DIR.rglob("*")
        if path.is_file()
    }


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors: list[str] = []
    expected = set(outputs)
    actual = actual_files()
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        if missing:
            errors.append("missing generated discovery files: " + ", ".join(missing))
        if extra:
            errors.append("unexpected generated discovery files: " + ", ".join(extra))
    for relative, expected_text in outputs.items():
        path = DISCOVER_DIR / relative
        if not path.exists():
            continue
        try:
            current = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated discovery output docs/discover/{relative}: {exc}")
            continue
        if current != expected_text:
            errors.append(f"generated discovery output differs: docs/discover/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if DISCOVER_DIR.exists():
        shutil.rmtree(DISCOVER_DIR)
    for relative, content in outputs.items():
        path = DISCOVER_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="Fail if generated discovery publication differs from committed docs output")
    args, unknown = ap.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError) as exc:
        print(f"ERROR: discovery publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} discovery outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
