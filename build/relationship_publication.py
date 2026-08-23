#!/usr/bin/env python3
"""Generate the deterministic public Relationship Observatory.

Phase 5 publishes only observed Compendium xref evidence. It does not infer
semantic relationships. The complete docs/relationships/ tree is disposable
generated output owned by this script.

Usage: python3 build/relationship_publication.py [--check]
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import jinja2
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
RELATIONSHIP_DIR = DOCS_DIR / "relationships"
INDEX_HTML = DOCS_DIR / "index.html"
TEMPLATES_DIR = ROOT / "src" / "templates"
SOURCE_DIR = ROOT / "src" / "relationships"
PROJECT_ID = "starsilk-character-dossier"

sys.path.insert(0, str(ROOT / "build"))
import generate  # noqa: E402
import machine_publication as machine  # noqa: E402


def edge_id(source_id: str, target_id: str) -> str:
    return f"mention--{source_id}--{target_id}"


def source_ref(source_id: str) -> str:
    return f"src/content/sections/{source_id}.body.html"


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def evidence_link_for_edge(soup: BeautifulSoup, source: str, target: str):
    """Resolve one exact physical xref that proves an existing graph edge.

    The established graph treats an xref anywhere in a source section subtree
    as observed evidence for that source. Nested/ancestor source records can
    therefore share the same physical xref. We preserve that v1 behavior and
    cite the first qualifying rendered xref in document order.
    """
    source_section = soup.find("section", id=source)
    if source_section is None:
        raise RuntimeError(f"relationship source section {source!r} is missing from docs/index.html")
    matches = source_section.find_all("a", class_="xref-link", href=f"#{target}")
    if not matches:
        raise RuntimeError(f"observed graph edge {source!r} -> {target!r} has no qualifying rendered xref evidence")
    link = matches[0]
    evidence_anchor = link.get("id")
    if not evidence_anchor:
        raise RuntimeError(f"qualifying xref for {source!r} -> {target!r} lacks a stable evidence anchor")
    if link.get("data-xref-target") != target:
        raise RuntimeError(f"evidence anchor {evidence_anchor!r} lost target identity for {target!r}")
    if not link.get("data-xref-source"):
        raise RuntimeError(f"evidence anchor {evidence_anchor!r} lacks physical source identity")
    return link


def build_model() -> tuple[dict, dict[str, str], dict[str, list[dict]], dict[str, list[dict]]]:
    if not INDEX_HTML.exists():
        raise RuntimeError("docs/index.html is missing; run build/generate.py first")

    rename_map = generate.load_media_rename_map()
    sections = generate.load_sections(rename_map)
    manifest = machine.load_manifest()
    records = machine.build_entity_records(sections, manifest)
    labels = {record["stable_id"]: record["display_label"] for record in records}
    known_ids = set(labels)
    graph = machine.build_relationships()
    soup = BeautifulSoup(INDEX_HTML.read_text(encoding="utf-8"), "lxml")

    relationships: list[dict] = []
    outgoing_by_id: dict[str, list[dict]] = {stable_id: [] for stable_id in labels}
    incoming_by_id: dict[str, list[dict]] = {stable_id: [] for stable_id in labels}

    for relation in graph.get("relationships", []):
        source = relation.get("source")
        target = relation.get("target")
        if source not in known_ids or target not in known_ids:
            raise RuntimeError(f"observed xref references unauthored top-level record: {source!r} -> {target!r}")
        if relation.get("kind") != "mentions" or relation.get("evidence_class") != "observed-xref":
            raise RuntimeError(f"unsupported relationship semantics for {source!r} -> {target!r}")

        link = evidence_link_for_edge(soup, source, target)
        evidence_anchor = link["id"]
        item = {
            "edge_id": edge_id(source, target),
            "source": source,
            "target": target,
            "kind": "mentions",
            "evidence_class": "observed-xref",
            "canonical_url": machine.canonical(f"relationships/#{edge_id(source, target)}"),
            "source_url": machine.entity_permalink(source),
            "target_url": machine.entity_permalink(target),
            "source_ref": source_ref(source),
            "public_evidence_url": machine.canonical(f"#{evidence_anchor}"),
            "observed_href": f"#{target}",
        }
        relationships.append(item)
        outgoing_by_id[source].append(item)
        incoming_by_id[target].append(item)

    relationships.sort(key=lambda item: (item["source"], item["target"]))
    for values in outgoing_by_id.values():
        values.sort(key=lambda item: (labels[item["target"]].casefold(), item["target"]))
    for values in incoming_by_id.values():
        values.sort(key=lambda item: (labels[item["source"]].casefold(), item["source"]))

    entities = []
    for record in records:
        stable_id = record["stable_id"]
        entities.append(
            {
                "stable_id": stable_id,
                "display_label": record["display_label"],
                "canonical_url": record["canonical_url"],
                "observatory_url": machine.canonical(f"relationships/#entity-{stable_id}"),
                "outgoing_count": len(outgoing_by_id[stable_id]),
                "incoming_count": len(incoming_by_id[stable_id]),
            }
        )

    connected_count = sum(1 for item in entities if item["outgoing_count"] or item["incoming_count"])
    model = {
        "schema": "starsilk-relationship-observatory/1",
        "schema_url": machine.canonical("machine/schema/v1/relationship-observatory.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": machine.canonical("relationships/"),
        "relationship_graph_url": machine.canonical("machine/relationships.json"),
        "entity_count": len(entities),
        "connected_entity_count": connected_count,
        "relationship_count": len(relationships),
        "entities": entities,
        "relationships": relationships,
        "unknowns": [
            "Observed xref mentions do not establish semantic relationship meaning beyond reference.",
            "The established v1 graph is a section-subtree projection, so multiple ancestor/source edges can cite the same physical rendered xref evidence.",
            "No friendship, hostility, kinship, allegiance, ownership, authorship, causation, chronology, location, or membership relation is inferred.",
            "Unauthored chronology-event and WorldsVault record identities remain outside this relationship model.",
        ],
    }
    if model["relationship_count"] != graph.get("relationship_count"):
        raise RuntimeError("observatory relationship count diverged from the existing observed graph")
    if model["entity_count"] != len(records):
        raise RuntimeError("observatory entity count diverged from authored top-level records")
    return model, labels, outgoing_by_id, incoming_by_id


def build_markdown(model: dict, labels: dict[str, str], outgoing_by_id: dict[str, list[dict]], incoming_by_id: dict[str, list[dict]]) -> str:
    lines = [
        "# Starsilk Compendium — Relationship Observatory",
        "",
        f"Canonical: {model['canonical_url']}",
        f"JSON: {machine.canonical('relationships/relationships.json')}",
        f"Underlying observed graph: {model['relationship_graph_url']}",
        f"Authority: {machine.canonical('relationships/AUTHORITY.md')}",
        "",
        "Every edge is `mentions / observed-xref`. Source -> target means only that the source section subtree contains the generated cross-reference to the target. No stronger semantic relationship is implied.",
        "",
        f"Published records: {model['entity_count']}  ",
        f"Connected records: {model['connected_entity_count']}  ",
        f"Observed edges: {model['relationship_count']}",
        "",
    ]
    for entity in model["entities"]:
        stable_id = entity["stable_id"]
        lines.extend(
            [
                f"## {entity['display_label']} (`{stable_id}`)",
                "",
                f"Entity: {entity['canonical_url']}  ",
                f"Observatory deep link: {entity['observatory_url']}  ",
                f"Outgoing observed mentions: {entity['outgoing_count']}  ",
                f"Incoming observed mentions: {entity['incoming_count']}",
                "",
                "### Outgoing observed mentions",
                "",
            ]
        )
        outgoing = outgoing_by_id[stable_id]
        if outgoing:
            for edge in outgoing:
                lines.append(
                    f"- [{labels[edge['target']]}]({edge['target_url']}) (`{edge['target']}`) — `mentions / observed-xref` — [edge]({edge['canonical_url']}) — [published xref evidence]({edge['public_evidence_url']}) — source `{edge['source_ref']}`"
                )
        else:
            lines.append("- None observed.")
        lines.extend(["", "### Incoming observed mentions", ""])
        incoming = incoming_by_id[stable_id]
        if incoming:
            for edge in incoming:
                lines.append(
                    f"- [{labels[edge['source']]}]({edge['source_url']}) (`{edge['source']}`) — [edge]({edge['canonical_url']}) — source `{edge['source_ref']}`"
                )
        else:
            lines.append("- None observed.")
        lines.append("")
    lines.extend(
        [
            "## Interpretation boundary",
            "",
            "The observatory preserves citation direction and exact xref evidence only. The established graph treats xrefs within a source section subtree as evidence for that source, so several source edges can share one physical xref anchor. Semantic relationship meaning remains unknown unless a separate explicit authority is introduced in a later phase.",
        ]
    )
    return "\n".join(lines).rstrip() + "\n"


def render_outputs() -> dict[str, str]:
    model, labels, outgoing_by_id, incoming_by_id = build_model()
    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=False,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    template = env.get_template("relationships.html.j2")
    base_css = (TEMPLATES_DIR / "style.css").read_text(encoding="utf-8").rstrip()
    relationship_css = (TEMPLATES_DIR / "relationships.css").read_text(encoding="utf-8").rstrip()
    authority = (SOURCE_DIR / "AUTHORITY.md").read_text(encoding="utf-8").rstrip() + "\n"

    return {
        "index.html": template.render(
            canonical_url=model["canonical_url"],
            entities=model["entities"],
            relationships=model["relationships"],
            connected_count=model["connected_entity_count"],
            labels=labels,
            outgoing_by_id=outgoing_by_id,
            incoming_by_id=incoming_by_id,
        ),
        "relationships.css": base_css + "\n\n" + relationship_css + "\n",
        "relationships.json": json_text(model),
        "relationships.md": build_markdown(model, labels, outgoing_by_id, incoming_by_id),
        "AUTHORITY.md": authority,
    }


def actual_files() -> set[str]:
    if not RELATIONSHIP_DIR.exists():
        return set()
    return {
        path.relative_to(RELATIONSHIP_DIR).as_posix()
        for path in RELATIONSHIP_DIR.rglob("*")
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
            errors.append("missing generated relationship files: " + ", ".join(missing))
        if extra:
            errors.append("unexpected generated relationship files: " + ", ".join(extra))
    for relative, expected_text in outputs.items():
        path = RELATIONSHIP_DIR / relative
        if not path.exists():
            continue
        try:
            current = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated relationship output docs/relationships/{relative}: {exc}")
            continue
        if current != expected_text:
            errors.append(f"generated relationship output differs: docs/relationships/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if RELATIONSHIP_DIR.exists():
        shutil.rmtree(RELATIONSHIP_DIR)
    for relative, content in outputs.items():
        path = RELATIONSHIP_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Fail if generated relationship publication differs from committed docs output")
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2
    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc:
        print(f"ERROR: relationship publication generation failed: {exc}", file=sys.stderr)
        return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} relationship publication outputs match generator output.")
        return 0
    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
