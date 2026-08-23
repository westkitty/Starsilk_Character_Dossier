#!/usr/bin/env python3
"""Generate the source-backed Phase 10 WorldsVault topology explorer."""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
OUTPUT_DIR = DOCS_DIR / "worldsvault"
TEMPLATES_DIR = ROOT / "src" / "templates"
SOURCE_FILE = ROOT / "src" / "worldsvault" / "topology.json"
AUTHORITY_FILE = ROOT / "src" / "worldsvault" / "AUTHORITY.md"
SCHEMA_FILE = ROOT / "src" / "schema" / "worldsvault-topology.schema.json"
PROJECT_ID = "starsilk-character-dossier"
PROJECT_NAME = "Starsilk Compendium"

sys.path.insert(0, str(ROOT / "build"))
import machine_publication as machine  # noqa: E402


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def public_source(source: dict) -> dict:
    return source | {
        "canonical_url": machine.entity_permalink(source["stable_id"]),
        "legacy_url": machine.legacy_anchor(source["stable_id"]),
    }


def build_model() -> dict:
    source = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    if source.get("schema") != "starsilk-worldsvault-topology-source/1":
        raise RuntimeError("unsupported WorldsVault topology source schema")
    policy, node_specs, edge_specs = source.get("status_policy"), source.get("nodes"), source.get("edges")
    if not isinstance(policy, dict) or not isinstance(node_specs, list) or not isinstance(edge_specs, list):
        raise RuntimeError("topology source needs status_policy, nodes, and edges")
    if policy != {"visibility": "public", "canon_status": "unknown", "spoiler_level": "unknown"}:
        raise RuntimeError("topology status policy must keep public visibility and unknown canon/spoiler status")

    node_ids: set[str] = set()
    nodes: list[dict] = []
    node_unknowns = [
        "No authored coordinates, distances, directions, route geometry, or complete spatial extent is published for this node.",
        "The layout field is non-canonical rendering order only and does not state cosmic position.",
        "Per-node canon status and spoiler level are not authored.",
    ]
    for spec in node_specs:
        required = {"node_id", "label", "node_class", "identity_status", "source", "layout"}
        if set(spec) != required or not isinstance(spec["source"], dict) or not isinstance(spec["layout"], dict):
            raise RuntimeError("every topology node must declare exact source and layout fields")
        node_id = spec["node_id"]
        if not isinstance(node_id, str) or not node_id or node_id in node_ids:
            raise RuntimeError(f"invalid or duplicate topology node ID: {node_id!r}")
        if spec["identity_status"] not in {"existing-authored-stable-id", "publication-derived"}:
            raise RuntimeError(f"invalid identity status for {node_id}")
        layout = spec["layout"]
        if set(layout) != {"rendering_group", "rendering_order", "coordinate_status"} or layout["coordinate_status"] != "non-canonical rendering order only":
            raise RuntimeError(f"topology layout must be explicitly non-canonical for {node_id}")
        if {"x", "y", "latitude", "longitude", "distance", "direction"} & set(layout):
            raise RuntimeError(f"spatial precision is forbidden in topology layout for {node_id}")
        node_ids.add(node_id)
        nodes.append(spec | {"canonical_url": machine.canonical(f"worldsvault/#node-{node_id}"), "source": public_source(spec["source"]), "certainty": "direct-authored", "status": policy, "unknowns": node_unknowns})

    edge_ids: set[str] = set()
    edges: list[dict] = []
    edge_unknowns = [
        "This direct relation does not establish coordinates, distance, direction, route geometry, extent, chronology, or additional membership.",
        "Per-edge canon status and spoiler level are not authored.",
    ]
    for spec in edge_specs:
        required = {"edge_id", "source", "target", "relation", "source_evidence"}
        if set(spec) != required or not isinstance(spec["source_evidence"], dict):
            raise RuntimeError("every topology edge must declare direct source evidence")
        if spec["edge_id"] in edge_ids or spec["source"] not in node_ids or spec["target"] not in node_ids or spec["source"] == spec["target"]:
            raise RuntimeError(f"invalid topology edge: {spec.get('edge_id')!r}")
        expected_id = f"{spec['relation']}--{spec['source']}--{spec['target']}"
        if spec["edge_id"] != expected_id:
            raise RuntimeError(f"edge ID is not deterministic: {spec['edge_id']!r}")
        edge_ids.add(spec["edge_id"])
        edges.append(spec | {"relation_class": "direct-authored-topology", "canonical_url": machine.canonical(f"worldsvault/#edge-{spec['edge_id']}"), "source_evidence": public_source(spec["source_evidence"]), "certainty": "direct-authored", "status": policy, "unknowns": edge_unknowns})

    return {
        "schema": "starsilk-worldsvault-topology/1",
        "schema_url": machine.canonical("machine/schema/v1/worldsvault-topology.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": machine.canonical("worldsvault/worldsvault.json"),
        "human_url": machine.canonical("worldsvault/"),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes": nodes,
        "edges": edges,
        "unknowns": [
            "The authored source does not provide a complete cosmic map, coordinates, distances, directions, route geometry, or system extent.",
            "Thirty WorldsVault template display labels exist in authored source, but they are not all promoted to permanent authored IDs or positioned in a map.",
            "The existing 136 mentions / observed-xref edges remain a distinct citation graph and are not topology relations.",
        ],
        "interpretation_rules": [
            "Every node and edge cites a direct authored source statement; generated topology never outranks that source.",
            "Publication-derived IDs are deterministic display-label derivatives, not newly authored permanent identities.",
            "Layout is non-canonical rendering order only. It never encodes or exports cosmic coordinates or spatial precision.",
            "Visibility, canon status, spoiler level, and certainty remain separate fields. Public source visibility does not establish canon status.",
        ],
    }


def build_markdown(model: dict) -> str:
    lines = ["# WorldsVault cosmic topology", "", "Generated source-backed topology derivative; not a second canon authority.", ""]
    lines += [f"- Nodes: {model['node_count']}", f"- Direct semantic edges: {model['edge_count']}", "- Existing observed xref graph: 136 `mentions` / `observed-xref` edges, unchanged and not topology evidence.", ""]
    lines += ["## Nodes", ""]
    for node in model["nodes"]:
        lines += [f"### {node['label']}", "", f"- Publication node ID: `{node['node_id']}` ({node['identity_status']})", f"- Class: {node['node_class']}", f"- Deep link: {node['canonical_url']}", f"- Source: {node['source']['canonical_url']} — {node['source']['heading']}", f"- Layout: {node['layout']['coordinate_status']}", f"- Status: visibility={node['status']['visibility']}; canon={node['status']['canon_status']}; spoiler={node['status']['spoiler_level']}", ""]
    lines += ["## Direct authored topology edges", ""]
    labels = {node['node_id']: node['label'] for node in model['nodes']}
    for edge in model["edges"]:
        lines += [f"### {labels[edge['source']]} — {edge['relation']} — {labels[edge['target']]}", "", f"- Publication edge ID: `{edge['edge_id']}`", f"- Deep link: {edge['canonical_url']}", f"- Evidence: {edge['source_evidence']['canonical_url']} — {edge['source_evidence']['heading']}", f"- Certainty: {edge['certainty']}", ""]
    lines += ["## Unknowns and boundary", ""] + [f"- {item}" for item in model["unknowns"]] + [""]
    return "\n".join(lines)


def render_outputs() -> dict[str, str]:
    model = build_model()
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
    return {
        "index.html": env.get_template("worldsvault.html.j2").render(project_name=PROJECT_NAME, canonical_url=machine.canonical("worldsvault/"), model=model),
        "worldsvault.css": (TEMPLATES_DIR / "worldsvault.css").read_text(encoding="utf-8").rstrip() + "\n",
        "worldsvault.js": (TEMPLATES_DIR / "worldsvault.js").read_text(encoding="utf-8").rstrip() + "\n",
        "worldsvault.json": json_text(model),
        "worldsvault.md": build_markdown(model),
        "schema.json": SCHEMA_FILE.read_text(encoding="utf-8").rstrip() + "\n",
        "AUTHORITY.md": AUTHORITY_FILE.read_text(encoding="utf-8").rstrip() + "\n",
    }


def actual_files() -> set[str]:
    return {path.relative_to(OUTPUT_DIR).as_posix() for path in OUTPUT_DIR.rglob("*") if path.is_file()} if OUTPUT_DIR.exists() else set()


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors = []
    if actual_files() != set(outputs): errors.append("generated WorldsVault file set differs from expected output")
    for relative, expected in outputs.items():
        path = OUTPUT_DIR / relative
        if not path.exists() or path.read_text(encoding="utf-8") != expected: errors.append(f"generated WorldsVault output differs: docs/worldsvault/{relative}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(); parser.add_argument("--check", action="store_true")
    args, unknown = parser.parse_known_args()
    if unknown: print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr); return 2
    try: outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError, jinja2.TemplateError) as exc: print(f"ERROR: WorldsVault publication generation failed: {exc}", file=sys.stderr); return 1
    if args.check:
        errors = check_outputs(outputs)
        if errors: print("\n".join(f"ERROR: {error}" for error in errors), file=sys.stderr); return 1
        print(f"OK: {len(outputs)} WorldsVault outputs match generator output."); return 0
    if OUTPUT_DIR.exists(): shutil.rmtree(OUTPUT_DIR)
    for relative, content in outputs.items():
        path = OUTPUT_DIR / relative; path.parent.mkdir(parents=True, exist_ok=True); path.write_text(content, encoding="utf-8"); print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")
    return 0


if __name__ == "__main__": raise SystemExit(main())
