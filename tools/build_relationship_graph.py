#!/usr/bin/env python3
"""Build a deterministic entity relationship graph from the published Compendium.

The graph is derived from the xref links already emitted by build/xref.py, so it
records relationships the site can actually prove instead of inventing semantic
edges. Output is JSON on stdout unless --out is supplied.
"""
import argparse
import json
import sys
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INDEX = ROOT / "docs" / "index.html"


def build_graph(index_path: Path) -> dict:
    soup = BeautifulSoup(index_path.read_text(encoding="utf-8"), "lxml")
    entities = {}
    for section in soup.find_all("section", id=True):
        if "character-page" not in (section.get("class") or []):
            continue
        heading = section.find("h2")
        if heading:
            entities[section["id"]] = " ".join(heading.stripped_strings)

    edges = set()
    for section in soup.find_all("section", id=True):
        source = section["id"]
        for link in section.find_all("a", class_="xref-link", href=True):
            href = link["href"]
            if href.startswith("#"):
                target = href[1:]
                if target in entities and target != source:
                    edges.add((source, target))

    incoming = {eid: [] for eid in entities}
    outgoing = {eid: [] for eid in entities}
    for source, target in sorted(edges):
        outgoing.setdefault(source, []).append(target)
        incoming.setdefault(target, []).append(source)

    return {
        "schema": "starsilk-entity-relationships/1",
        "source": str(index_path),
        "entity_count": len(entities),
        "relationship_count": len(edges),
        "entities": [{"id": eid, "name": entities[eid]} for eid in sorted(entities)],
        "relationships": [
            {"source": source, "target": target, "kind": "mentions"}
            for source, target in sorted(edges)
        ],
        "backlinks": {eid: incoming.get(eid, []) for eid in sorted(entities)},
        "outgoing": {eid: outgoing.get(eid, []) for eid in sorted(entities)},
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Build Starsilk entity relationship JSON")
    ap.add_argument("--index", default=str(DEFAULT_INDEX))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    index_path = Path(args.index)
    if not index_path.exists():
        print(f"ERROR: {index_path} not found", file=sys.stderr)
        return 1

    graph = build_graph(index_path)
    payload = json.dumps(graph, indent=2, sort_keys=True) + "\n"
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(payload, encoding="utf-8")
        print(f"Wrote {out}: {graph['entity_count']} entities, {graph['relationship_count']} relationships")
    else:
        sys.stdout.write(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
