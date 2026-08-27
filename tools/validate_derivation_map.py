#!/usr/bin/env python3
"""Validate the Starsilk source-of-truth derivation map.

The derivation map is topology authority only. It records which declared
sources feed which build entrypoints and which generated surfaces they own; it
does not create lore, canon, relationship, or media identity.
"""
from __future__ import annotations

import argparse
import glob
import json
import re
import shlex
from collections import defaultdict, deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAPH_FILE = ROOT / "src" / "system" / "derivation-map.json"
PROJECTION_FILE = ROOT / "src" / "system" / "DERIVATION_GRAPH.md"
BUILD_SH = ROOT / "tools" / "build.sh"

ALLOWED_ROLES = {
    "authoritative",
    "derived",
    "generated",
    "mirror",
    "evidence",
    "cache",
    "deprecated",
    "unknown",
}
ALLOWED_NODE_TYPES = {
    "source",
    "external",
    "generator",
    "output",
    "validator",
    "orchestrator",
    "helper",
}
ALLOWED_EDGE_KINDS = {
    "governs",
    "input_to",
    "generates",
    "validates",
    "invokes",
    "references",
}
DERIVATION_EDGE_KINDS = {"input_to", "generates"}


def load_graph(path: Path = GRAPH_FILE) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _matches(root: Path, pattern: str) -> list[Path]:
    return [Path(value) for value in glob.glob(str(root / pattern), recursive=True)]


def extract_pipeline_entrypoints(build_text: str) -> list[str]:
    """Return unique Python entrypoints actually invoked through $PY in build.sh."""
    found: list[str] = []
    seen: set[str] = set()
    for line in build_text.splitlines():
        if "$PY" not in line:
            continue
        for match in re.findall(r"(?:build|tools)/[A-Za-z0-9_.-]+\.py", line):
            if match not in seen:
                seen.add(match)
                found.append(match)
    return found


def extract_public_boundary_targets(build_text: str) -> list[str]:
    lines = build_text.splitlines()
    for index, raw in enumerate(lines):
        if "tools/check_public_boundary.py" not in raw or "$PY" not in raw:
            continue
        parts = [raw.strip()]
        cursor = index
        while parts[-1].rstrip().endswith("\\"):
            parts[-1] = parts[-1].rstrip()[:-1].rstrip()
            cursor += 1
            if cursor >= len(lines):
                raise ValueError("unterminated check_public_boundary.py command in tools/build.sh")
            parts.append(lines[cursor].strip())
        tokens = shlex.split(" ".join(parts))
        try:
            script_index = tokens.index("tools/check_public_boundary.py")
        except ValueError as exc:
            raise ValueError("could not parse check_public_boundary.py command in tools/build.sh") from exc
        return tokens[script_index + 1 :]
    raise ValueError("tools/build.sh does not invoke tools/check_public_boundary.py")


def _derivation_cycle(nodes: list[dict], edges: list[dict]) -> list[str] | None:
    adjacency: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        if edge.get("kind") in DERIVATION_EDGE_KINDS:
            adjacency[edge["from"]].append(edge["to"])

    state: dict[str, int] = {node["id"]: 0 for node in nodes}
    stack: list[str] = []

    def visit(node_id: str) -> list[str] | None:
        state[node_id] = 1
        stack.append(node_id)
        for target in adjacency.get(node_id, []):
            if state.get(target, 0) == 0:
                cycle = visit(target)
                if cycle:
                    return cycle
            elif state.get(target) == 1:
                start = stack.index(target)
                return stack[start:] + [target]
        stack.pop()
        state[node_id] = 2
        return None

    for node_id in list(state):
        if state[node_id] == 0:
            cycle = visit(node_id)
            if cycle:
                return cycle
    return None


def validate_graph(data: dict, root: Path = ROOT, build_text: str | None = None) -> list[str]:
    errors: list[str] = []

    if data.get("schema") != "starsilk-derivation-map/1":
        errors.append("schema must be starsilk-derivation-map/1")
    if data.get("project_id") != "starsilk-character-dossier":
        errors.append("project_id must be starsilk-character-dossier")

    nodes = data.get("nodes")
    edges = data.get("edges")
    coverage = data.get("coverage")
    if not isinstance(nodes, list) or not nodes:
        return errors + ["nodes must be a non-empty list"]
    if not isinstance(edges, list) or not edges:
        return errors + ["edges must be a non-empty list"]
    if not isinstance(coverage, dict):
        return errors + ["coverage must be an object"]

    node_ids: list[str] = []
    node_by_id: dict[str, dict] = {}
    for index, node in enumerate(nodes):
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id:
            errors.append(f"node #{index} has no non-empty id")
            continue
        if node_id in node_by_id:
            errors.append(f"duplicate node id: {node_id}")
            continue
        node_ids.append(node_id)
        node_by_id[node_id] = node
        if node.get("role") not in ALLOWED_ROLES:
            errors.append(f"node {node_id} has unsupported role {node.get('role')!r}")
        if node.get("node_type") not in ALLOWED_NODE_TYPES:
            errors.append(f"node {node_id} has unsupported node_type {node.get('node_type')!r}")
        if not isinstance(node.get("label"), str) or not node["label"].strip():
            errors.append(f"node {node_id} has no label")
        if not isinstance(node.get("scope"), str) or not node["scope"].strip():
            errors.append(f"node {node_id} has no scope")
        paths = node.get("paths")
        if not isinstance(paths, list) or not paths or not all(isinstance(value, str) and value for value in paths):
            errors.append(f"node {node_id} must declare non-empty paths")
            continue
        if node.get("required_present", True):
            for pattern in paths:
                if not _matches(root, pattern):
                    errors.append(f"node {node_id} path pattern has no repository match: {pattern}")

    edge_ids: set[str] = set()
    incoming_generate: dict[str, int] = defaultdict(int)
    outgoing_generate: dict[str, int] = defaultdict(int)
    for index, edge in enumerate(edges):
        edge_id = edge.get("id")
        if not isinstance(edge_id, str) or not edge_id:
            errors.append(f"edge #{index} has no non-empty id")
            continue
        if edge_id in edge_ids:
            errors.append(f"duplicate edge id: {edge_id}")
        edge_ids.add(edge_id)
        source = edge.get("from")
        target = edge.get("to")
        if source not in node_by_id:
            errors.append(f"edge {edge_id} references missing source node: {source}")
        if target not in node_by_id:
            errors.append(f"edge {edge_id} references missing target node: {target}")
        if edge.get("kind") not in ALLOWED_EDGE_KINDS:
            errors.append(f"edge {edge_id} has unsupported kind {edge.get('kind')!r}")
        evidence = edge.get("evidence")
        if not isinstance(evidence, list) or not evidence or not all(isinstance(value, str) and value for value in evidence):
            errors.append(f"edge {edge_id} must declare evidence paths")
        else:
            for evidence_path in evidence:
                if not (root / evidence_path).exists():
                    errors.append(f"edge {edge_id} evidence path does not exist: {evidence_path}")
        if edge.get("kind") == "generates" and source in node_by_id and target in node_by_id:
            incoming_generate[target] += 1
            outgoing_generate[source] += 1

    for node in nodes:
        node_id = node.get("id")
        if node.get("role") == "generated" and incoming_generate.get(node_id, 0) == 0:
            errors.append(f"generated node {node_id} has no incoming generates edge")
        if node.get("node_type") == "generator" and outgoing_generate.get(node_id, 0) == 0:
            errors.append(f"generator node {node_id} has no outgoing generates edge")

    cycle = _derivation_cycle(nodes, edges)
    if cycle:
        errors.append("derivation cycle detected: " + " -> ".join(cycle))

    root_owners: dict[str, list[str]] = defaultdict(list)
    for node in nodes:
        for owned_root in node.get("roots", []):
            if not isinstance(owned_root, str) or not owned_root:
                errors.append(f"node {node.get('id')} has an invalid root entry")
                continue
            root_owners[owned_root].append(node["id"])
    for owned_root, owners in sorted(root_owners.items()):
        if len(owners) > 1:
            errors.append(f"generated root {owned_root} has multiple owners: {', '.join(owners)}")

    if build_text is None:
        build_path = root / coverage.get("pipeline_source", "tools/build.sh")
        if not build_path.exists():
            errors.append(f"pipeline source does not exist: {build_path.relative_to(root)}")
            return errors
        build_text = build_path.read_text(encoding="utf-8")

    pipeline_entrypoints = extract_pipeline_entrypoints(build_text)
    declared_entrypoints: dict[str, list[str]] = defaultdict(list)
    for node in nodes:
        if node.get("node_type") not in {"generator", "validator"}:
            continue
        for path in node.get("paths", []):
            if path.endswith(".py") and "*" not in path:
                declared_entrypoints[path].append(node["id"])

    for entrypoint in pipeline_entrypoints:
        owners = declared_entrypoints.get(entrypoint, [])
        if not owners:
            errors.append(f"build pipeline entrypoint is absent from derivation map: {entrypoint}")
        elif len(owners) > 1:
            errors.append(f"build pipeline entrypoint has multiple graph owners: {entrypoint} -> {owners}")
    for node in nodes:
        if node.get("node_type") != "generator":
            continue
        exact_scripts = [path for path in node.get("paths", []) if path.endswith(".py") and "*" not in path]
        for entrypoint in exact_scripts:
            if entrypoint not in pipeline_entrypoints:
                errors.append(f"graph generator is not invoked by tools/build.sh: {entrypoint} ({node['id']})")

    try:
        observed_boundary = extract_public_boundary_targets(build_text)
    except ValueError as exc:
        errors.append(str(exc))
        observed_boundary = []
    expected_boundary = coverage.get("public_boundary_targets")
    if not isinstance(expected_boundary, list) or not all(isinstance(value, str) and value for value in expected_boundary):
        errors.append("coverage.public_boundary_targets must be a string list")
        expected_boundary = []
    if observed_boundary != expected_boundary:
        errors.append(
            "public-boundary target list differs from derivation map: "
            f"build.sh={observed_boundary!r} map={expected_boundary!r}"
        )

    for target in expected_boundary:
        owners = root_owners.get(target, [])
        if len(owners) != 1:
            errors.append(f"public-boundary target must have exactly one graph owner: {target} -> {owners}")
        elif node_by_id[owners[0]].get("role") not in {"generated", "evidence"}:
            errors.append(f"public-boundary target {target} is not owned by a generated/evidence node")

    return errors


def _safe_mermaid_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]", "_", value)


def _safe_label(value: str) -> str:
    return value.replace("\"", "'").replace("[", "(").replace("]", ")")


def stale_risk_rows(data: dict) -> list[tuple[str, list[str]]]:
    nodes = data["nodes"]
    node_by_id = {node["id"]: node for node in nodes}
    adjacency: dict[str, set[str]] = defaultdict(set)
    for edge in data["edges"]:
        if edge["kind"] in DERIVATION_EDGE_KINDS:
            adjacency[edge["from"]].add(edge["to"])

    rows: list[tuple[str, list[str]]] = []
    for node in nodes:
        if node.get("node_type") not in {"source", "external"} or node.get("role") not in {"authoritative", "evidence"}:
            continue
        seen: set[str] = set()
        queue = deque(adjacency.get(node["id"], set()))
        generated: set[str] = set()
        while queue:
            current = queue.popleft()
            if current in seen:
                continue
            seen.add(current)
            target = node_by_id[current]
            if target.get("role") == "generated":
                generated.add(target["label"])
            queue.extend(adjacency.get(current, set()))
        if generated:
            rows.append((node["label"], sorted(generated)))
    return rows


def render_projection(data: dict) -> str:
    lines = [
        "# Starsilk Source-of-Truth Derivation Graph",
        "",
        "> GENERATED from `src/system/derivation-map.json` by `tools/validate_derivation_map.py`.",
        "> Do not hand-edit this projection. It maps authority topology; it is not lore or canon authority.",
        "",
        "## Coverage",
        "",
        data["coverage"]["scope"],
        "",
        "## Nodes",
        "",
        "| ID | Role | Type | Repository paths | Scope |",
        "| --- | --- | --- | --- | --- |",
    ]
    for node in data["nodes"]:
        paths = "<br>".join(f"`{path}`" for path in node["paths"])
        scope = node["scope"].replace("|", "\\|")
        lines.append(f"| `{node['id']}` | {node['role']} | {node['node_type']} | {paths} | {scope} |")

    lines.extend(["", "## Mermaid", "", "```mermaid", "flowchart LR"])
    for node in data["nodes"]:
        mid = _safe_mermaid_id(node["id"])
        label = _safe_label(f"{node['label']}\\n{node['role']} / {node['node_type']}")
        lines.append(f'    {mid}["{label}"]')
    for edge in data["edges"]:
        source = _safe_mermaid_id(edge["from"])
        target = _safe_mermaid_id(edge["to"])
        kind = _safe_label(edge["kind"])
        lines.append(f"    {source} -->|{kind}| {target}")
    lines.extend(["```", "", "## Stale-risk summary", ""])
    for label, outputs in stale_risk_rows(data):
        lines.append(f"- **{label}** -> " + ", ".join(outputs))
    lines.extend(
        [
            "",
            "## Integrity rules",
            "",
            "- Every graph edge carries repository evidence.",
            "- Every generated node has a declared generator.",
            "- Derivation edges must remain acyclic.",
            "- Every Python entrypoint invoked by `tools/build.sh` must have exactly one graph node.",
            "- Every `tools/check_public_boundary.py` target must have exactly one generated/evidence owner.",
            "- The checked-in Mermaid/table projection must byte-match this JSON graph.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-projection", action="store_true", help="rewrite the deterministic Markdown projection")
    args = parser.parse_args()

    try:
        data = load_graph()
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: cannot load {GRAPH_FILE}: {exc}")
        return 1

    errors = validate_graph(data)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    projection = render_projection(data)
    if args.write_projection:
        PROJECTION_FILE.parent.mkdir(parents=True, exist_ok=True)
        PROJECTION_FILE.write_text(projection, encoding="utf-8")
        print(f"WROTE {PROJECTION_FILE.relative_to(ROOT)}")
    else:
        if not PROJECTION_FILE.exists():
            print(f"ERROR: {PROJECTION_FILE.relative_to(ROOT)} is missing; run with --write-projection")
            return 1
        current = PROJECTION_FILE.read_text(encoding="utf-8")
        if current != projection:
            print(
                f"ERROR: {PROJECTION_FILE.relative_to(ROOT)} is stale; "
                "run python3 tools/validate_derivation_map.py --write-projection"
            )
            return 1

    print(f"DERIVATION_MAP_OK nodes={len(data['nodes'])} edges={len(data['edges'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
