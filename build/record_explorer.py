#!/usr/bin/env python3
"""Deterministic cross-surface record explorer publication.

This module joins existing evidence by stable record ID. It never creates a
second canon/relationship/chronology/media authority and never infers stronger
semantics from co-occurrence.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = DOCS / "records"
SRC = ROOT / "src"
TEMPLATES = SRC / "templates"
SCHEMA = SRC / "schema" / "cross-surface-record-index.schema.json"
DEEP_SCHEMA = SRC / "schema" / "deep-systems.schema.json"
AUTHORITY = SRC / "records" / "AUTHORITY.md"
DEEP_SOURCE = SRC / "records" / "deep-systems.json"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
PROJECT_ID = "starsilk-character-dossier"
SCHEMA_ID = "starsilk-cross-surface-record-index/1"

sys.path.insert(0, str(ROOT / "build"))
import generate  # noqa: E402
import machine_publication as machine  # noqa: E402

EVIDENCE_CLASSES = (
    "authored-record",
    "manifest-related-media",
    "observed-xref",
    "authored-chronology",
    "machine-lock-reference",
    "derived-context-packet",
    "curated-tour-membership",
    "authored-worldsvault-reference",
    "authored-film-source-reference",
    "machine-alternative",
    "authored-semantic-edge",
    "contradiction-record",
    "canon-delta",
    "authored-causality",
)

CATEGORY_ORDER = (
    "Canon",
    "Timeline",
    "Mentions",
    "Media / Objects",
    "Tours",
    "Worlds",
    "Films",
    "Semantic Relationships",
    "Contradictions / Tensions",
    "Canon History",
    "Causality",
    "Machine / Source",
)

FACET_LABELS = (
    ("hasChronology", "Timeline"),
    ("hasRelationships", "Mentions"),
    ("hasMedia", "Media"),
    ("hasCanonLocks", "Canon locks"),
    ("hasTours", "Tours"),
    ("hasWorlds", "WorldsVault"),
    ("hasFilms", "Films"),
    ("hasSemantic", "Semantic"),
    ("hasContradictions", "Tensions"),
    ("hasHistory", "History"),
    ("hasCausality", "Causality"),
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def ref(label: str, url: str, evidence_class: str, source_pointer: str, **extra) -> dict:
    if evidence_class not in EVIDENCE_CLASSES:
        raise RuntimeError(f"unknown evidence class: {evidence_class}")
    item = {
        "label": label,
        "url": url,
        "evidence_class": evidence_class,
        "source_pointer": source_pointer,
    }
    item.update(extra)
    return item


def build_tour_memberships(labels: dict[str, str]) -> dict[str, list[dict]]:
    tours = load_json(SRC / "tours" / "tours.json").get("tours", [])
    nav = load_json(SRC / "content" / "nav.json").get("groups", [])
    tour_by_group = {item["navigation_group"]: item for item in tours}
    memberships: dict[str, list[dict]] = defaultdict(list)
    for group in nav:
        tour = tour_by_group.get(group.get("label"))
        if not tour:
            continue
        tour_id = tour["tour_id"]
        for link in group.get("links", []):
            stable_id = link.get("id")
            if stable_id not in labels:
                continue
            memberships[stable_id].append(ref(
                f"Tour: {group['label']}",
                f"{SITE_BASE}tours/#tour-{tour_id}",
                "curated-tour-membership",
                "src/tours/tours.json + src/content/nav.json",
                tour_id=tour_id,
            ))
    return memberships


def build_world_refs(labels: dict[str, str]) -> dict[str, list[dict]]:
    topology = load_json(SRC / "worldsvault" / "topology.json")
    refs: dict[str, list[dict]] = defaultdict(list)
    for node in topology.get("nodes", []):
        source = node.get("source") or {}
        stable_id = source.get("stable_id")
        if stable_id not in labels:
            continue
        refs[stable_id].append(ref(
            f"WorldsVault: {node['label']}",
            f"{SITE_BASE}worldsvault/#node-{node['node_id']}",
            "authored-worldsvault-reference",
            source.get("path") or "src/worldsvault/topology.json",
            node_id=node["node_id"],
            node_class=node.get("node_class"),
        ))
    return refs


def build_film_refs(labels: dict[str, str]) -> dict[str, list[dict]]:
    films = load_json(SRC / "films" / "films.json").get("films", [])
    refs: dict[str, list[dict]] = defaultdict(list)
    for film in films:
        for stable_id in film.get("source_stable_ids", []):
            if stable_id not in labels:
                continue
            refs[stable_id].append(ref(
                f"Film: {film['title']}",
                f"{SITE_BASE}films/#{film['film_id']}",
                "authored-film-source-reference",
                "src/films/films.json",
                film_id=film["film_id"],
                status=film.get("status", "unknown"),
            ))
    return refs


def build_lock_refs(labels: dict[str, str]) -> dict[str, list[dict]]:
    invariants = load_json(SRC / "canon" / "invariants.json")
    refs: dict[str, list[dict]] = defaultdict(list)
    for lock in invariants.get("section_locks", []):
        stable_id = lock.get("section")
        if stable_id not in labels:
            continue
        refs[stable_id].append(ref(
            f"Canon lock: {lock['description']}",
            f"{SITE_BASE}canon/#lock-{lock['id']}",
            "machine-lock-reference",
            "src/canon/invariants.json",
            lock_id=lock["id"],
        ))
    return refs


def build_chronology_refs(labels: dict[str, str]) -> dict[str, list[dict]]:
    chronology = load_json(SRC / "chronology" / "events.json")
    source = chronology.get("source_record") or {}
    stable_id = source.get("stable_id")
    refs: dict[str, list[dict]] = defaultdict(list)
    if stable_id not in labels:
        return refs
    source_pointer = source.get("path") or "src/chronology/events.json"
    for event in chronology.get("events", []):
        refs[stable_id].append(ref(
            f"Timeline: {event['label']}",
            f"{SITE_BASE}chronology/#event-{event['event_id']}",
            "authored-chronology",
            source_pointer,
            event_id=event["event_id"],
            temporal=event.get("temporal", {}),
        ))
    return refs


def build_relationship_refs(labels: dict[str, str]) -> dict[str, list[dict]]:
    graph = machine.build_relationships()
    refs: dict[str, list[dict]] = defaultdict(list)
    for edge in graph.get("relationships", []):
        source, target = edge.get("source"), edge.get("target")
        if source in labels and target in labels:
            edge_id = f"mention--{source}--{target}"
            common = {
                "edge_id": edge_id,
                "kind": edge.get("kind"),
                "target_stable_id": target,
                "source_stable_id": source,
            }
            refs[source].append(ref(
                f"Mentions {labels[target]}",
                f"{SITE_BASE}relationships/#{edge_id}",
                "observed-xref",
                f"src/content/sections/{source}.body.html",
                direction="outgoing",
                **common,
            ))
            refs[target].append(ref(
                f"Mentioned by {labels[source]}",
                f"{SITE_BASE}relationships/#{edge_id}",
                "observed-xref",
                f"src/content/sections/{source}.body.html",
                direction="incoming",
                **common,
            ))
    return refs


def build_deep_indexes(labels: dict[str, str]) -> tuple[dict[str, list[dict]], dict[str, list[dict]], dict[str, list[dict]], dict[str, list[dict]], dict]:
    deep = load_json(DEEP_SOURCE)
    semantic: dict[str, list[dict]] = defaultdict(list)
    contradictions: dict[str, list[dict]] = defaultdict(list)
    history: dict[str, list[dict]] = defaultdict(list)
    causality: dict[str, list[dict]] = defaultdict(list)

    for edge in deep.get("semantic_edges", []):
        source, target = edge.get("source"), edge.get("target")
        if source in labels and target in labels:
            for stable_id, direction, other in ((source, "outgoing", target), (target, "incoming", source)):
                semantic[stable_id].append(ref(
                    f"{edge.get('kind', 'related')} · {labels.get(other, other)}",
                    f"{SITE_BASE}records/#semantic-{edge['edge_id']}",
                    "authored-semantic-edge",
                    edge.get("source_evidence", {}).get("path", "src/records/deep-systems.json"),
                    edge_id=edge["edge_id"], direction=direction, relation=edge.get("kind"),
                    temporal=edge.get("temporal", {}), qualifiers=edge.get("qualifiers", []),
                ))

    for item in deep.get("contradiction_records", []):
        for stable_id in item.get("affected_stable_ids", []):
            if stable_id in labels:
                contradictions[stable_id].append(ref(
                    f"{item.get('status', 'unresolved')} · {item['label']}",
                    f"{SITE_BASE}records/#contradiction-{item['contradiction_id']}",
                    "contradiction-record",
                    "src/records/deep-systems.json",
                    contradiction_id=item["contradiction_id"], status=item.get("status"),
                ))

    for item in deep.get("canon_deltas", []):
        for stable_id in item.get("stable_ids", []):
            if stable_id in labels:
                history[stable_id].append(ref(
                    f"{item.get('delta_class', 'change')} · {item['label']}",
                    f"{SITE_BASE}records/#delta-{item['delta_id']}",
                    "canon-delta",
                    item.get("source_evidence", {}).get("path", "src/records/deep-systems.json"),
                    delta_id=item["delta_id"], delta_class=item.get("delta_class"),
                    recorded_at=item.get("recorded_at"),
                ))

    # Causality is event-level evidence. Attach it to the authored chronology
    # and Canon Ledger records without pretending event IDs are entity IDs.
    for edge in deep.get("causal_edges", []):
        for stable_id in ("chronology", "canon-ledger"):
            if stable_id in labels:
                causality[stable_id].append(ref(
                    f"{edge.get('kind', 'causal')} · {edge.get('source_event')} → {edge.get('target_event')}",
                    f"{SITE_BASE}records/#causal-{edge['edge_id']}",
                    "authored-causality",
                    edge.get("source_evidence", {}).get("path", "src/records/deep-systems.json"),
                    causal_edge_id=edge["edge_id"], relation=edge.get("kind"),
                    source_event=edge.get("source_event"), target_event=edge.get("target_event"),
                    source_claim_ids=edge.get("source_claim_ids", []),
                ))
    return semantic, contradictions, history, causality, deep


def build_index() -> dict:
    sections = generate.load_sections(generate.load_media_rename_map())
    manifest = machine.load_manifest()
    records = machine.build_entity_records(sections, manifest)
    labels = {record["stable_id"]: record["display_label"] for record in records}
    section_meta = {item["id"]: item for item in load_json(SRC / "content" / "sections.json").get("sections", [])}
    semantic, contradictions, history, causality, deep = build_deep_indexes(labels)

    relations = build_relationship_refs(labels)
    chronology = build_chronology_refs(labels)
    locks = build_lock_refs(labels)
    tours = build_tour_memberships(labels)
    worlds = build_world_refs(labels)
    films = build_film_refs(labels)

    compiled = []
    for record in records:
        stable_id = record["stable_id"]
        categories: dict[str, list[dict]] = {}

        if locks.get(stable_id):
            categories["Canon"] = locks[stable_id]
        if chronology.get(stable_id):
            categories["Timeline"] = chronology[stable_id]
        if relations.get(stable_id):
            categories["Mentions"] = relations[stable_id]
        if record.get("related_media_ids"):
            media_refs = []
            for filename in record["related_media_ids"]:
                object_id = Path(filename).stem
                media_refs.append(ref(
                    f"Museum object: {filename}",
                    f"{SITE_BASE}objects/#{object_id}",
                    "manifest-related-media",
                    "docs/asset-manifest.json",
                    media_id=filename,
                    object_id=object_id,
                ))
            categories["Media / Objects"] = media_refs
        if tours.get(stable_id):
            categories["Tours"] = tours[stable_id]
        if worlds.get(stable_id):
            categories["Worlds"] = worlds[stable_id]
        if films.get(stable_id):
            categories["Films"] = films[stable_id]
        if semantic.get(stable_id):
            categories["Semantic Relationships"] = semantic[stable_id]
        if contradictions.get(stable_id):
            categories["Contradictions / Tensions"] = contradictions[stable_id]
        if history.get(stable_id):
            categories["Canon History"] = history[stable_id]
        if causality.get(stable_id):
            categories["Causality"] = causality[stable_id]

        source_refs = record.get("source_refs", [])
        source_pointer = next((s.get("path") for s in source_refs if s.get("path", "").endswith(".body.html")), f"src/content/sections/{stable_id}.body.html")
        machine_source = [
            ref("Published source record", record["canonical_url"], "authored-record", source_pointer),
            ref("Context packet", f"{SITE_BASE}discover/packets/{stable_id}.json", "derived-context-packet", source_pointer),
            ref("Record JSON", machine.entity_json_url(stable_id), "machine-alternative", source_pointer),
            ref("Record Markdown", machine.entity_markdown_url(stable_id), "machine-alternative", source_pointer),
        ]
        categories["Machine / Source"] = machine_source
        categories = {name: categories[name] for name in CATEGORY_ORDER if name in categories and categories[name]}

        facets = {
            "hasChronology": bool(chronology.get(stable_id)),
            "hasRelationships": bool(relations.get(stable_id)),
            "hasMedia": bool(record.get("related_media_ids")),
            "hasCanonLocks": bool(locks.get(stable_id)),
            "hasTours": bool(tours.get(stable_id)),
            "hasWorlds": bool(worlds.get(stable_id)),
            "hasFilms": bool(films.get(stable_id)),
            "hasSemantic": bool(semantic.get(stable_id)),
            "hasContradictions": bool(contradictions.get(stable_id)),
            "hasHistory": bool(history.get(stable_id)),
            "hasCausality": bool(causality.get(stable_id)),
        }
        search_terms = [stable_id, record["display_label"], record["object_type"]]
        for name, items in categories.items():
            search_terms.append(name)
            search_terms.extend(item["label"] for item in items)
            search_terms.extend(item["evidence_class"] for item in items)

        meta = section_meta.get(stable_id, {})
        classes = meta.get("classes", "")
        archetype = (meta.get("attrs") or {}).get("data-archetype")
        temporal_tags = sorted({
            str(item.get("temporal", {}).get("era"))
            for item in deep.get("semantic_edges", [])
            if stable_id in (item.get("source"), item.get("target")) and item.get("temporal", {}).get("era")
        })
        visual_packet = {
            "schema": "starsilk-visual-generation-packet/1",
            "stable_id": stable_id,
            "display_label": record["display_label"],
            "source": source_pointer,
            "related_media_ids": list(record.get("related_media_ids", [])),
            "machine_locks": [item.get("lock_id") for item in locks.get(stable_id, [])],
            "authored_archetype": archetype,
            "immutable_or_locked": [item.get("label") for item in locks.get(stable_id, [])],
            "unknown_fields": ["anatomy/topology", "proportions", "palette", "materials", "costume/accessories", "silhouette"] if not locks.get(stable_id) else [],
            "rule": "Do not infer visual properties not established by source, media, or applicable machine locks.",
        }
        drakken = None
        if "drakken-page" in classes.split():
            drakken = {
                "archetype": archetype or "unknown",
                "body_topology": "unknown",
                "locomotion": "unknown",
                "scale": "unknown",
                "environmental_mechanism": "unknown",
                "source_status": "Only authored archetype metadata is structurally classified; other morphology axes remain unknown unless a reader follows the source record.",
            }
        compiled.append({
            "stable_id": stable_id,
            "display_label": record["display_label"],
            "canonical_url": record["canonical_url"],
            "object_type": record["object_type"],
            "source": {
                "path": source_pointer,
                "anchor": stable_id,
                "legacy_url": machine.legacy_anchor(stable_id),
            },
            "facets": facets,
            "categories": categories,
            "reference_count": sum(len(items) for items in categories.values()),
            "search_text": " ".join(search_terms),
            "unknowns": list(record.get("unknowns", [])),
            "temporal_tags": temporal_tags,
            "visual_packet": visual_packet,
            "drakken_morphology": drakken,
        })

    return {
        "schema": SCHEMA_ID,
        "project_id": PROJECT_ID,
        "canonical_url": SITE_BASE + "records/records.json",
        "human_url": SITE_BASE + "records/",
        "schema_url": SITE_BASE + "records/schema.json",
        "authority_url": SITE_BASE + "records/AUTHORITY.md",
        "record_count": len(compiled),
        "evidence_classes": list(EVIDENCE_CLASSES),
        "interpretation_rules": [
            "Every record is keyed by an existing stable top-level Compendium record ID.",
            "Evidence classes remain separate and never collapse into an inferred semantic graph.",
            "Observed-xref relationships remain mentions only.",
            "Chronology links exist only where authored chronology source identity names the record.",
            "Media links are manifest-backed context/provenance evidence and do not imply identity or relationships.",
            "WorldsVault and Film Vault links require explicit source-backed stable-record references.",
            "Machine-lock presence exposes an applicable validator lock and does not create canon approval.",
            "Unknown and unsupported categories remain absent rather than inferred.",
        ],
        "deep_systems": {
            "source": "src/records/deep-systems.json",
            "contradiction_count": len(deep.get("contradiction_records", [])),
            "semantic_edge_count": len(deep.get("semantic_edges", [])),
            "canon_delta_count": len(deep.get("canon_deltas", [])),
            "causal_edge_count": len(deep.get("causal_edges", [])),
            "rules": deep.get("rules", []),
        },
        "records": compiled,
    }


def json_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def render_outputs() -> dict[str, str]:
    index = build_index()
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(TEMPLATES)), autoescape=False)
    template = env.get_template("records.html.j2")
    object_types = sorted({record["object_type"] for record in index["records"]})
    facet_keys = [key for key, _label in FACET_LABELS]
    search_index = {
        "schema": "starsilk-cross-surface-record-search/1",
        "facet_keys": facet_keys,
        "records": [
            [r["stable_id"], r["display_label"], r["object_type"], sum((1 << i) for i, key in enumerate(facet_keys) if r["facets"][key]), r["reference_count"], (r.get("drakken_morphology") or {}).get("archetype", ""), r.get("temporal_tags", [])]
            for r in index["records"]
        ],
    }
    return {
        "index.html": template.render(
            canonical_url=SITE_BASE + "records/",
            object_types=object_types,
            facet_labels=FACET_LABELS,
        ),
        "records.css": (TEMPLATES / "records.css").read_text(encoding="utf-8"),
        "records.js": (TEMPLATES / "records.js").read_text(encoding="utf-8"),
        "records-deep.css": (TEMPLATES / "records-deep.css").read_text(encoding="utf-8"),
        "records-deep.js": (TEMPLATES / "records-deep.js").read_text(encoding="utf-8"),
        "search.json": json_text(search_index),
        "records.json": json_text(index),
        "schema.json": SCHEMA.read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": AUTHORITY.read_text(encoding="utf-8").rstrip() + "\n",
        "deep-systems.json": DEEP_SOURCE.read_text(encoding="utf-8").rstrip() + "\n",
        "deep-systems.schema.json": DEEP_SCHEMA.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual_files() -> set[str]:
    if not OUT.exists():
        return set()
    return {p.relative_to(OUT).as_posix() for p in OUT.rglob("*") if p.is_file()}


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors = []
    expected = set(outputs)
    actual = actual_files()
    if expected != actual:
        if expected - actual:
            errors.append("missing generated record explorer files: " + ", ".join(sorted(expected - actual)))
        if actual - expected:
            errors.append("unexpected generated record explorer files: " + ", ".join(sorted(actual - expected)))
    for rel, content in outputs.items():
        path = OUT / rel
        if path.exists() and path.read_text(encoding="utf-8") != content:
            errors.append(f"generated record explorer output differs: docs/records/{rel}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    for rel, content in outputs.items():
        path = OUT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        outputs = render_outputs()
    except Exception as exc:
        print(f"ERROR: record explorer generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            print("\n".join(f"ERROR: {e}" for e in errors), file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} record explorer outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
