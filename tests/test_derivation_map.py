from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


derivation = _load_module("validate_derivation_map", ROOT / "tools" / "validate_derivation_map.py")


def _graph() -> dict:
    return json.loads((ROOT / "src" / "system" / "derivation-map.json").read_text(encoding="utf-8"))


def test_derivation_map_matches_repository_and_build_pipeline():
    graph = _graph()
    assert derivation.validate_graph(graph, root=ROOT) == []


def test_derivation_projection_is_deterministic_and_current():
    graph = _graph()
    expected = derivation.render_projection(graph)
    actual = (ROOT / "src" / "system" / "DERIVATION_GRAPH.md").read_text(encoding="utf-8")
    assert actual == expected


def test_generated_nodes_cannot_be_orphaned():
    graph = _graph()
    graph["nodes"].append(
        {
            "id": "fixture.orphan",
            "label": "Fixture orphan",
            "role": "generated",
            "node_type": "output",
            "paths": ["docs/index.html"],
            "scope": "Regression fixture only.",
        }
    )
    errors = derivation.validate_graph(graph, root=ROOT)
    assert any("generated node fixture.orphan has no incoming generates edge" in error for error in errors)


def test_derivation_cycles_are_rejected():
    graph = _graph()
    graph["edges"].append(
        {
            "id": "fixture-cycle",
            "from": "root_out",
            "to": "content",
            "kind": "input_to",
            "evidence": ["build/generate.py"],
        }
    )
    errors = derivation.validate_graph(graph, root=ROOT)
    assert any("derivation cycle detected" in error for error in errors)


def test_new_build_entrypoint_requires_graph_coverage():
    graph = _graph()
    build_text = (ROOT / "tools" / "build.sh").read_text(encoding="utf-8")
    mutated = build_text.replace(
        '"$PY" build/validate.py --strict',
        '"$PY" build/undeclared_publication.py\n"$PY" build/validate.py --strict',
    )
    errors = derivation.validate_graph(copy.deepcopy(graph), root=ROOT, build_text=mutated)
    assert any("build/undeclared_publication.py" in error for error in errors)


def test_public_boundary_changes_require_graph_update():
    graph = _graph()
    build_text = (ROOT / "tools" / "build.sh").read_text(encoding="utf-8")
    mutated = build_text.replace(" docs/agents\n", " docs/agents docs/undeclared-public\n")
    errors = derivation.validate_graph(copy.deepcopy(graph), root=ROOT, build_text=mutated)
    assert any("public-boundary target list differs from derivation map" in error for error in errors)
