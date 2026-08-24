#!/usr/bin/env python3
"""Generate the deterministic public machine-publication layer.

The machine layer is a source-backed derivative, never a second canon prose
authority. Phase 3 promotes existing top-level section identities to stable
human permalinks while preserving their legacy Compendium anchors and adds a
per-record JSON/Markdown alternative for every authored section ID.

The entire docs/machine/ directory is generated output owned by this script.
Top-level docs/llms.txt and docs/sitemap.xml are also owned by this script.

Usage: python3 build/machine_publication.py [--check]
  --check   render every owned output in memory and fail if committed output
            differs or if the generated machine directory has extra/missing
            files.
"""
from __future__ import annotations

import argparse
import html
import json
import shutil
import sys
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
MACHINE_DIR = DOCS_DIR / "machine"
SCHEMA_DIR = ROOT / "src" / "schema"
MACHINE_SOURCE_DIR = ROOT / "src" / "machine"
INDEX_HTML = DOCS_DIR / "index.html"
MANIFEST_FILE = DOCS_DIR / "asset-manifest.json"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
PROJECT_ID = "starsilk-character-dossier"
PROJECT_NAME = "Starsilk Compendium"

sys.path.insert(0, str(ROOT / "build"))
sys.path.insert(0, str(ROOT))
import generate  # noqa: E402
from tools.build_relationship_graph import build_graph  # noqa: E402
from tools.validate_metadata_contract import validate_record  # noqa: E402

SCHEMA_FILES = (
    "metadata-record.schema.json",
    "machine-publication-index.schema.json",
    "entity-index.schema.json",
    "relationship-graph.schema.json",
    "relationship-observatory.schema.json",
    "canon-lock-register.schema.json",
    "discovery-index.schema.json",
    "context-packet.schema.json",
    "context-packet-index.schema.json",
    "tour-index.schema.json",
    "chronology-index.schema.json",
    "worldsvault-topology.schema.json",
    "agent-evaluation.schema.json",
)


def canonical(relative: str = "") -> str:
    return urljoin(SITE_BASE, relative)


def entity_permalink(stable_id: str) -> str:
    return canonical(f"entities/{stable_id}/")


def legacy_anchor(stable_id: str) -> str:
    return f"{SITE_BASE}#{stable_id}"


def entity_json_url(stable_id: str) -> str:
    return canonical(f"machine/entities/{stable_id}.json")


def entity_markdown_url(stable_id: str) -> str:
    return canonical(f"machine/entities/{stable_id}.md")


def json_text(value: object) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n"


def load_manifest() -> dict:
    return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))


def section_label(section) -> str:
    source = section.title_html or section.body_html
    soup = BeautifulSoup(source, "html.parser")
    heading = soup.find(["h2", "h1", "h3"])
    if heading:
        label = " ".join(heading.stripped_strings)
        if label:
            return label
    return section.id


def structural_type(section) -> str:
    classes = set(section.classes.split())
    if "character-page" in classes:
        return "character-section"
    if "chronology-page" in classes:
        return "chronology-section"
    if "material-page" in classes:
        return "material-section"
    if "source-text" in classes:
        return "source-section"
    if "asset-bank" in classes:
        return "archive-section"
    if "media-vault-page" in classes:
        return "media-vault-section"
    return "section"


def media_by_section(manifest: dict) -> dict[str, list[str]]:
    mapping: dict[str, set[str]] = {}
    for asset in manifest.get("assets", []):
        media_id = asset.get("filename")
        if not media_id:
            continue
        for context in asset.get("contexts", []):
            section_id = context.get("section_id")
            if section_id:
                mapping.setdefault(section_id, set()).add(media_id)
    return {key: sorted(values) for key, values in mapping.items()}


def build_entity_records(sections: list, manifest: dict) -> list[dict]:
    media_map = media_by_section(manifest)
    records: list[dict] = []
    for section in sections:
        title_path = f"src/content/sections/{section.id}.title.html"
        body_path = f"src/content/sections/{section.id}.body.html"
        source_refs = [
            {
                "path": "src/content/sections.json",
                "anchor": section.id,
                "kind": "authoritative-content",
            },
            {"path": body_path, "kind": "authoritative-content"},
        ]
        if section.title_html is not None:
            source_refs.append({"path": title_path, "kind": "authoritative-content"})

        evidence = [
            {
                "class": "authoritative-content",
                "source_ref": body_path,
                "note": "Published prose/content authority for this section.",
            }
        ]
        related_media = media_map.get(section.id, [])
        if related_media:
            evidence.append(
                {
                    "class": "published-media-provenance",
                    "source_ref": "docs/asset-manifest.json",
                    "note": "Related media IDs are manifest filenames attached to this section by published context.",
                }
            )

        record = {
            "stable_id": section.id,
            "object_type": structural_type(section),
            "display_label": section_label(section),
            "aliases": [],
            "canonical_url": entity_permalink(section.id),
            "source_refs": source_refs,
            "visibility": "public",
            "canon_status": "unknown",
            "spoiler_level": "major",
            "related_media_ids": related_media,
            "evidence": evidence,
            "unknowns": [
                "Per-section canon status is not authored by the current source model.",
                "Per-section spoiler classification is not authored; major is a conservative publication default.",
                "object_type describes the published section structure and is not an ontological claim about the subject.",
            ],
        }
        errors = validate_record(record)
        if errors:
            raise RuntimeError(f"metadata record {section.id} invalid: {'; '.join(errors)}")
        records.append(record)
    return records


def build_relationships() -> dict:
    graph = build_graph(INDEX_HTML)
    graph["source"] = SITE_BASE
    for relation in graph.get("relationships", []):
        if relation.get("kind") != "mentions":
            raise RuntimeError(f"unsupported inferred relationship kind: {relation.get('kind')}")
        relation["evidence_class"] = "observed-xref"
    return graph


MARKDOWN_BLOCKS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "figcaption", "dt", "dd", "th", "td", "pre"}
MARKDOWN_CONTAINERS = {"div", "article", "section", "aside"}


def markdown_blocks(body_html: str) -> list[str]:
    """Produce a readable loss-minimizing text projection of authored HTML."""
    soup = BeautifulSoup(body_html, "html.parser")
    blocks: list[str] = []
    for node in soup.find_all(True):
        if node.name in MARKDOWN_BLOCKS:
            if node.find_parent(MARKDOWN_BLOCKS):
                continue
            text = " ".join(node.stripped_strings)
            if not text:
                continue
            if node.name.startswith("h") and len(node.name) == 2 and node.name[1].isdigit():
                blocks.append(f"{'#' * int(node.name[1])} {text}")
            elif node.name == "li":
                blocks.append(f"- {text}")
            elif node.name == "blockquote":
                blocks.append(f"> {text}")
            elif node.name == "figcaption":
                blocks.append(f"*Media note: {text}*")
            elif node.name == "dt":
                blocks.append(f"**{text}**")
            elif node.name == "dd":
                blocks.append(text)
            elif node.name in {"th", "td"}:
                blocks.append(text)
            elif node.name == "pre":
                blocks.append(f"```\n{text}\n```")
            else:
                blocks.append(text)
            continue

        if node.name in MARKDOWN_CONTAINERS:
            if node.find(MARKDOWN_BLOCKS) or node.find(MARKDOWN_CONTAINERS):
                continue
            text = " ".join(node.stripped_strings)
            if text:
                blocks.append(text)

    if not blocks:
        fallback = " ".join(soup.stripped_strings)
        if fallback:
            blocks.append(fallback)
    return blocks


def build_compendium_markdown(sections: list, records: list[dict]) -> str:
    by_id = {record["stable_id"]: record for record in records}
    lines = [
        f"# {PROJECT_NAME} — machine Markdown edition",
        "",
        f"Canonical site: {SITE_BASE}",
        f"Human entity index: {canonical('entities/')}",
        f"Machine index: {canonical('machine/index.json')}",
        f"Authority: {canonical('machine/AUTHORITY.md')}",
        "",
        "This is a deterministic text alternative generated from the authoritative section fragments in source order. It preserves authored text while omitting visual page layout. Canon status remains explicitly unknown where the source model does not author one.",
        "",
    ]
    for section in sections:
        record = by_id[section.id]
        lines.extend(
            [
                f"## {record['display_label']}",
                "",
                f"Stable ID: `{section.id}`  ",
                f"Canonical: {record['canonical_url']}  ",
                f"Legacy Compendium location: {legacy_anchor(section.id)}  ",
                f"Machine JSON: {entity_json_url(section.id)}  ",
                f"Machine Markdown: {entity_markdown_url(section.id)}  ",
                f"Source: `src/content/sections/{section.id}.body.html`",
                "",
            ]
        )
        if record["related_media_ids"]:
            lines.append("Related published media IDs: " + ", ".join(f"`{item}`" for item in record["related_media_ids"]))
            lines.append("")
        blocks = markdown_blocks(section.body_html)
        if blocks:
            lines.extend(blocks)
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def build_entities_markdown(records: list[dict]) -> str:
    lines = [
        f"# {PROJECT_NAME} — entity index",
        "",
        "This index addresses existing published sections by their stable section IDs. Canonical URLs are first-class human permalink pages; the original Compendium anchors remain valid legacy locations. Structural type is not an ontological claim. Relationship semantics remain `mentions` unless an explicit semantic authority is added later.",
        "",
        "| Stable ID | Label | Structural type | Canon status | Media | Canonical |",
        "|---|---|---|---|---:|---|",
    ]
    for record in records:
        label = record["display_label"].replace("|", "\\|")
        lines.append(
            f"| `{record['stable_id']}` | {label} | `{record['object_type']}` | `{record['canon_status']}` | {len(record['related_media_ids'])} | {record['canonical_url']} |"
        )
    return "\n".join(lines) + "\n"


def build_entity_markdown(section, record: dict, relationships: dict, labels: dict[str, str]) -> str:
    stable_id = record["stable_id"]
    outgoing = [item for item in relationships.get("outgoing", {}).get(stable_id, []) if item in labels]
    incoming = [item for item in relationships.get("backlinks", {}).get(stable_id, []) if item in labels]
    lines = [
        f"# {record['display_label']}",
        "",
        f"Stable ID: `{stable_id}`  ",
        f"Canonical: {record['canonical_url']}  ",
        f"Legacy Compendium location: {legacy_anchor(stable_id)}  ",
        f"Machine JSON: {entity_json_url(stable_id)}  ",
        f"Structural type: `{record['object_type']}`  ",
        f"Canon status: `{record['canon_status']}`  ",
        f"Spoiler level: `{record['spoiler_level']}`",
        "",
        f"Source: `src/content/sections/{stable_id}.body.html`",
        "",
    ]
    if record["related_media_ids"]:
        lines.append("## Related published media")
        lines.append("")
        lines.extend(f"- `{item}`" for item in record["related_media_ids"])
        lines.append("")
    if outgoing:
        lines.append("## Observed mentions")
        lines.append("")
        lines.extend(f"- [{labels[item]}]({entity_permalink(item)}) — `{item}`" for item in outgoing)
        lines.append("")
    if incoming:
        lines.append("## Mentioned by")
        lines.append("")
        lines.extend(f"- [{labels[item]}]({entity_permalink(item)}) — `{item}`" for item in incoming)
        lines.append("")
    lines.extend(["## Published source content", ""])
    lines.extend(markdown_blocks(section.body_html))
    return "\n".join(lines).rstrip() + "\n"


def public_urls(records: list[dict]) -> list[str]:
    paths = [
        "llms.txt",
        "sitemap.xml",
        "machine/index.json",
        "machine/entities.json",
        "machine/relationships.json",
        "machine/project.jsonld",
        "machine/compendium.md",
        "machine/entities.md",
        "machine/AUTHORITY.md",
        "relationships/",
        "relationships/relationships.json",
        "relationships/relationships.md",
        "relationships/AUTHORITY.md",
        "canon/",
        "canon/canon-locks.json",
        "canon/canon-locks.md",
        "canon/schema.json",
        "canon/AUTHORITY.md",
        "discover/",
        "discover/discovery.json",
        "discover/discovery.md",
        "discover/context-packets.json",
        "discover/schema.json",
        "discover/context-packet.schema.json",
        "discover/context-packet-index.schema.json",
        "discover/AUTHORITY.md",
        "tours/",
        "tours/tours.json",
        "tours/schema.json",
        "tours/AUTHORITY.md",
        "chronology/",
        "chronology/chronology.json",
        "chronology/chronology.md",
        "chronology/schema.json",
        "chronology/AUTHORITY.md",
        "worldsvault/",
        "worldsvault/worldsvault.json",
        "worldsvault/worldsvault.md",
        "worldsvault/schema.json",
        "worldsvault/AUTHORITY.md",
        "agents/AGENT_GUIDE.md",
        "agents/evaluation.json",
        "agents/evaluation.md",
        "agents/integration.json",
        "agents/schema.json",
    ] + [f"machine/schema/v1/{name}" for name in SCHEMA_FILES]
    urls = [SITE_BASE] + [canonical(path) for path in paths] + [canonical("entities/")]
    for record in records:
        stable_id = record["stable_id"]
        urls.extend(
            [
                record["canonical_url"],
                entity_json_url(stable_id),
                entity_markdown_url(stable_id),
                canonical(f"discover/packets/{stable_id}.json"),
            ]
        )
    if len(urls) != len(set(urls)):
        raise RuntimeError("duplicate public URL generated")
    return urls


def build_project_index(records: list[dict], relationship_count: int) -> dict:
    schema_urls = {name.removesuffix(".schema.json"): canonical(f"machine/schema/v1/{name}") for name in SCHEMA_FILES}
    return {
        "schema": "starsilk-machine-publication/1",
        "schema_url": canonical("machine/schema/v1/machine-publication-index.schema.json"),
        "project_id": PROJECT_ID,
        "name": PROJECT_NAME,
        "canonical_url": SITE_BASE,
        "endpoints": {
            "entity_index": canonical("machine/entities.json"),
            "relationships": canonical("machine/relationships.json"),
            "canon_inspector": canonical("canon/"),
            "canon_lock_register": canonical("canon/canon-locks.json"),
            "discovery": canonical("discover/"),
            "discovery_index": canonical("discover/discovery.json"),
            "context_packet_index": canonical("discover/context-packets.json"),
            "tours": canonical("tours/"),
            "tour_index": canonical("tours/tours.json"),
            "chronology": canonical("chronology/"),
            "chronology_index": canonical("chronology/chronology.json"),
            "worldsvault": canonical("worldsvault/"),
            "worldsvault_topology": canonical("worldsvault/worldsvault.json"),
            "agent_guide": canonical("agents/AGENT_GUIDE.md"),
            "agent_evaluation": canonical("agents/evaluation.json"),
            "agent_integration": canonical("agents/integration.json"),
            "jsonld": canonical("machine/project.jsonld"),
            "compendium_markdown": canonical("machine/compendium.md"),
            "entity_markdown": canonical("machine/entities.md"),
            "authority": canonical("machine/AUTHORITY.md"),
            "orientation": canonical("llms.txt"),
            "sitemap": canonical("sitemap.xml"),
        },
        "schemas": schema_urls,
        "record_count": len(records),
        "relationship_count": relationship_count,
        "public_urls": public_urls(records),
        "source_authority": [
            "src/content/sections/*.title.html",
            "src/content/sections/*.body.html",
            "src/content/sections.json",
            "src/content/nav.json",
            "src/canon/invariants.json",
            "src/tours/tours.json",
            "src/chronology/events.json",
            "src/worldsvault/topology.json",
            "docs/asset-manifest.json",
        ],
        "unknowns": [
            "Chronology event publication IDs are source-backed Phase 9 derivatives; absolute dates and unsupported relationships remain unknown.",
            "WorldsVault topology publication IDs are deterministic source-label derivatives; they are not authored permanent identities.",
            "WorldsVault coordinates, distances, directions, route geometry, and complete spatial extent remain unauthored.",
            "Semantic relations beyond observed xref mentions remain unauthored.",
        ],
    }


def build_jsonld(records: list[dict]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": canonical("#starsilk-compendium"),
        "identifier": PROJECT_ID,
        "name": PROJECT_NAME,
        "url": SITE_BASE,
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


def build_llms_text(index: dict) -> str:
    e = index["endpoints"]
    return f"""# {PROJECT_NAME}\n\n> Public, deterministic, source-backed machine orientation for the Starsilk Compendium. Generated derivatives never outrank repository authority.\n\nCanonical site: {SITE_BASE}\nHuman entity index: {canonical('entities/')}\nHuman entity permalink pattern: {canonical('entities/<stable-id>/')}\nPer-entity JSON pattern: {canonical('machine/entities/<stable-id>.json')}\nPer-entity Markdown pattern: {canonical('machine/entities/<stable-id>.md')}\nMachine index: {canonical('machine/index.json')}\nEntity index: {e['entity_index']}\nCompendium Markdown: {e['compendium_markdown']}\nEntity Markdown: {e['entity_markdown']}\nObserved relationship graph: {e['relationships']}\nHuman relationship observatory: {canonical('relationships/')}\nRelationship Observatory JSON: {canonical('relationships/relationships.json')}\nRelationship Observatory Markdown: {canonical('relationships/relationships.md')}\nHuman Canon Inspector: {e['canon_inspector']}\nCanon lock register JSON: {e['canon_lock_register']}\nCanon lock register Markdown: {canonical('canon/canon-locks.md')}\nHuman faceted discovery: {e['discovery']}\nDiscovery JSON index: {e['discovery_index']}\nAI context packet register: {e['context_packet_index']}\nAI context packet pattern: {canonical('discover/packets/<stable-id>.json')}\nHuman curated tours and local library: {e['tours']}\nCurated tour JSON index: {e['tour_index']}\nAgent reference guide: {e['agent_guide']}\nVendor-neutral agent evaluation fixtures: {e['agent_evaluation']}\nFinal integration certificate: {e['agent_integration']}\nJSON-LD: {e['jsonld']}\nAuthority and evidence rules: {e['authority']}\nVersioned schemas: {canonical('machine/schema/v1/')}\nSitemap: {e['sitemap']}\n\nInterpretation rules:\n- Stable IDs are existing published section IDs; do not replace them with display labels.\n- Canonical entity URLs use `/entities/<stable-id>/`; legacy `/#<stable-id>` Compendium anchors remain valid public locations.\n- `canon_status: unknown` means the current source model does not author a per-section status.\n- `spoiler_level: major` is a conservative publication default, not a canon fact.\n- Relationship kind `mentions` with evidence class `observed-xref` proves reference only; do not infer friend/enemy/parent/creator/causal semantics.\n- The Canon Inspector exposes only a machine-enforced validation subset from `src/canon/invariants.json`; it is not complete canon, and absence from its register does not imply non-canon status.\n- Faceted discovery and AI context packets are generated convenience derivatives: result classes remain structural, excerpts are mechanical source projections, and packet fields never outrank cited source authority.\n- Curated tours are editorial stable-ID navigation only; browser-local bookmarks, recent/history, progress, and user-named collections are not published, are not canon evidence, and private local text is not serialized into public URLs.\n- Missing event IDs, WorldsVault IDs, dates, coordinates, and semantic relations remain unknown until explicitly authored.\n- Agent evaluation fixtures test evidence discipline; they are not lore authority and do not require any model vendor.\n"""


def build_sitemap(urls: list[str]) -> str:
    body = "\n".join(f"  <url><loc>{html.escape(url)}</loc></url>" for url in urls)
    return f"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n{body}\n</urlset>\n"


def render_outputs() -> dict[str, str]:
    if not INDEX_HTML.exists():
        raise RuntimeError("docs/index.html is missing; run build/generate.py first")
    if not MANIFEST_FILE.exists():
        raise RuntimeError("docs/asset-manifest.json is missing")

    rename_map = generate.load_media_rename_map()
    sections = generate.load_sections(rename_map)
    manifest = load_manifest()
    records = build_entity_records(sections, manifest)
    relationships = build_relationships()
    labels = {record["stable_id"]: record["display_label"] for record in records}
    index = build_project_index(records, relationships.get("relationship_count", 0))

    entity_index = {
        "schema": "starsilk-entity-index/1",
        "schema_url": canonical("machine/schema/v1/entity-index.schema.json"),
        "project_id": PROJECT_ID,
        "canonical_url": canonical("machine/entities.json"),
        "record_count": len(records),
        "records": records,
    }

    outputs = {
        "machine/index.json": json_text(index),
        "machine/entities.json": json_text(entity_index),
        "machine/relationships.json": json_text(relationships),
        "machine/project.jsonld": json_text(build_jsonld(records)),
        "machine/compendium.md": build_compendium_markdown(sections, records),
        "machine/entities.md": build_entities_markdown(records),
        "machine/AUTHORITY.md": (MACHINE_SOURCE_DIR / "AUTHORITY.md").read_text(encoding="utf-8").rstrip() + "\n",
        "llms.txt": build_llms_text(index).rstrip() + f"\nHuman interactive chronology: {index['endpoints']['chronology']}\nChronology JSON index: {index['endpoints']['chronology_index']}\n- Chronology event IDs are source-backed publication identifiers. Exact authored markers remain in their authored system; null absolute dates, unknown canon status, and unknown spoiler level must not be filled by filters or inference.\nHuman WorldsVault cosmic topology explorer: {index['endpoints']['worldsvault']}\nWorldsVault topology JSON: {index['endpoints']['worldsvault_topology']}\n- WorldsVault publication IDs are deterministic source-label derivatives, not authored permanent identities. Topology layout is non-canonical rendering order only; coordinates, distances, directions, route geometry, and unsupported semantic relations remain unknown.\n",
        "sitemap.xml": build_sitemap(index["public_urls"]),
    }
    for section, record in zip(sections, records):
        stable_id = record["stable_id"]
        outputs[f"machine/entities/{stable_id}.json"] = json_text(record)
        outputs[f"machine/entities/{stable_id}.md"] = build_entity_markdown(section, record, relationships, labels)
    for name in SCHEMA_FILES:
        outputs[f"machine/schema/v1/{name}"] = (SCHEMA_DIR / name).read_text(encoding="utf-8").rstrip() + "\n"
    return outputs


def machine_actual_files() -> set[str]:
    if not MACHINE_DIR.exists():
        return set()
    return {
        path.relative_to(DOCS_DIR).as_posix()
        for path in MACHINE_DIR.rglob("*")
        if path.is_file()
    }


def check_outputs(outputs: dict[str, str]) -> list[str]:
    errors: list[str] = []
    expected_machine = {path for path in outputs if path.startswith("machine/")}
    actual_machine = machine_actual_files()
    if actual_machine != expected_machine:
        missing = sorted(expected_machine - actual_machine)
        extra = sorted(actual_machine - expected_machine)
        if missing:
            errors.append("missing generated machine files: " + ", ".join(missing))
        if extra:
            errors.append("unexpected generated machine files: " + ", ".join(extra))

    for relative, expected in outputs.items():
        path = DOCS_DIR / relative
        if not path.exists():
            errors.append(f"missing generated output: docs/{relative}")
            continue
        try:
            actual = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            errors.append(f"unreadable generated output docs/{relative}: {exc}")
            continue
        if actual != expected:
            errors.append(f"generated output differs: docs/{relative}")
    return errors


def write_outputs(outputs: dict[str, str]) -> None:
    if MACHINE_DIR.exists():
        shutil.rmtree(MACHINE_DIR)
    for relative, content in outputs.items():
        path = DOCS_DIR / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"Wrote {path.relative_to(ROOT)} ({len(content):,} bytes)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="Fail if generated machine publication differs from committed docs output")
    args, unknown = ap.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2

    try:
        outputs = render_outputs()
    except (OSError, json.JSONDecodeError, RuntimeError) as exc:
        print(f"ERROR: machine publication generation failed: {exc}", file=sys.stderr)
        return 1

    if args.check:
        errors = check_outputs(outputs)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print(f"OK: {len(outputs)} machine/publication outputs match generator output.")
        return 0

    write_outputs(outputs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
