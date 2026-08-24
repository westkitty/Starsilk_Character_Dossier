#!/usr/bin/env python3
"""Deterministic Web Edition generator.

versioned canonical source (src/content/, src/templates/)
  -> this generator
  -> generated docs/ (index.html, asset-manifest.json already written by
     build/media_pipeline.py)
  -> build/validate.py
  -> GitHub Pages

docs/index.html is disposable, regenerable output. Nothing here mutates an
existing docs/index.html in place -- every run rebuilds it from src/content/
and src/templates/ from scratch, so there is no possible "partially
transformed" intermediate state and no script-ordering hazard.

Usage: python3 build/generate.py [--check]
  --check   Do not write docs/index.html; instead render into memory and
            fail (exit 1) if it differs from what's already on disk. Used
            by CI to prove the checked-in docs/ matches its declared
            sources (release-gate requirement: build from source, diff
            against committed output, fail on divergence).
"""
import argparse
import html as html_lib
import json
import re
import shutil
import sys
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = ROOT / "src" / "content"
SECTIONS_DIR = CONTENT_DIR / "sections"
TEMPLATES_DIR = ROOT / "src" / "templates"
DOCS_DIR = ROOT / "docs"
MANIFEST_FILE = DOCS_DIR / "asset-manifest.json"
VISUAL_COVERAGE_FILE = CONTENT_DIR / "visual-coverage.json"
CANON_DIR = ROOT / "src" / "canon"

CANONICAL_URL = "https://westkitty.github.io/Starsilk_Character_Dossier/"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import xref  # noqa: E402


def load_manifest() -> dict:
    if not MANIFEST_FILE.exists():
        return {"assets": []}
    return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))


def load_media_rename_map() -> dict:
    manifest = load_manifest()
    return {
        a["source_filename"]: a["filename"]
        for a in manifest.get("assets", [])
        if a.get("source_filename") and a["source_filename"] != a["filename"]
    }


def rewrite_media_refs(html: str, rename_map: dict) -> str:
    if not html or not rename_map:
        return html
    for old, new in rename_map.items():
        if old == new:
            continue
        html = html.replace(f"assets/media/{old}", f"assets/media/{new}")
    return html


def body_has_visible_image(body_html: str) -> bool:
    """Return True when authored body HTML already contains a visible img src.

    Legacy attachment placeholders often contain hidden <img> nodes with no src;
    those must not count as visual coverage.
    """
    for match in re.finditer(r"<img\b[^>]*>", body_html or "", flags=re.IGNORECASE):
        tag = match.group(0)
        if re.search(r"\bhidden(?:\s|=|/|>)", tag, flags=re.IGNORECASE):
            continue
        src_match = re.search(r"\bsrc\s*=\s*([\"'])(.*?)\1", tag, flags=re.IGNORECASE | re.DOTALL)
        if src_match and src_match.group(2).strip():
            return True
    return False


def load_visual_coverage() -> dict[str, dict]:
    """Load authored fallback visual placements and resolve them to published media.

    This file is editorial placement authority only. Binary identity/provenance
    remains docs/asset-manifest.json. Context placement never becomes evidence
    that a depicted figure is the named section subject.
    """
    if not VISUAL_COVERAGE_FILE.exists():
        return {}

    data = json.loads(VISUAL_COVERAGE_FILE.read_text(encoding="utf-8"))
    if data.get("schema") != "starsilk-visual-coverage/1":
        raise RuntimeError("visual-coverage.json has an unexpected schema")

    section_data = json.loads((CONTENT_DIR / "sections.json").read_text(encoding="utf-8"))
    section_records = {record["id"]: record for record in section_data.get("sections", [])}
    manifest = load_manifest()
    manifest_by_source = {
        asset.get("source_filename"): asset
        for asset in manifest.get("assets", [])
        if asset.get("source_filename")
    }

    resolved: dict[str, dict] = {}
    for index, placement in enumerate(data.get("placements", [])):
        sections = placement.get("sections")
        source_filename = placement.get("source_filename")
        role = placement.get("role")
        title = placement.get("title")
        alt = placement.get("alt")
        note = placement.get("note")

        if not isinstance(sections, list) or not sections or not all(isinstance(v, str) and v for v in sections):
            raise RuntimeError(f"visual coverage placement #{index} has invalid sections")
        if role not in {"identity", "context"}:
            raise RuntimeError(f"visual coverage placement #{index} has invalid role {role!r}")
        if not all(isinstance(value, str) and value.strip() for value in (source_filename, title, alt, note)):
            raise RuntimeError(f"visual coverage placement #{index} is missing required text/source fields")

        asset = manifest_by_source.get(source_filename)
        if not asset:
            raise RuntimeError(
                f"visual coverage placement #{index} references source media absent from asset manifest: {source_filename}"
            )
        if not str(asset.get("mime_type", "")).startswith("image/"):
            raise RuntimeError(f"visual coverage placement #{index} is not an image: {source_filename}")
        published_filename = asset.get("filename")
        if not published_filename:
            raise RuntimeError(f"visual coverage placement #{index} has no published media filename")
        published_path = DOCS_DIR / "assets" / "media" / published_filename
        if not published_path.exists():
            raise RuntimeError(f"visual coverage published media is missing: {published_filename}")

        for section_id in sections:
            if section_id not in section_records:
                raise RuntimeError(f"visual coverage placement references unknown section: {section_id}")
            if section_id in resolved:
                raise RuntimeError(f"visual coverage section is assigned more than once: {section_id}")

            classes = set(str(section_records[section_id].get("classes", "")).split())
            if role == "context" and "character-page" in classes:
                language = f"{alt} {note}".lower()
                if "not a portrait" not in language:
                    raise RuntimeError(
                        f"context placement for character section {section_id} must explicitly state 'not a portrait'"
                    )

            resolved[section_id] = {
                "source_filename": source_filename,
                "published_filename": published_filename,
                "role": role,
                "title": title.strip(),
                "alt": alt.strip(),
                "note": note.strip(),
            }

    return resolved


def render_visual_coverage_figure(section_id: str, placement: dict) -> str:
    role = html_lib.escape(placement["role"], quote=True)
    title = html_lib.escape(placement["title"])
    alt = html_lib.escape(placement["alt"], quote=True)
    note = html_lib.escape(placement["note"])
    filename = html_lib.escape(placement["published_filename"], quote=True)
    sid = html_lib.escape(section_id, quote=True)
    return (
        f'\n<div class="ref-grid visual-coverage-fallback" data-visual-coverage="fallback" '
        f'data-coverage-section="{sid}">'
        f'<figure class="reference-record visual-coverage-record" data-coverage-role="{role}">'
        f'<div class="image-stage"><img loading="lazy" decoding="async" alt="{alt}" '
        f'src="assets/media/{filename}"/></div>'
        f'<figcaption><b>{title}</b><span>{note}</span></figcaption>'
        f'</figure></div>\n'
    )


DISCLOSURE_OPEN = '<details class="page-disclosure"><summary class="page-title"><span class="page-chevron" aria-hidden="true"></span>'
SUMMARY_CLOSE = "</summary>"
DETAILS_CLOSE = "</details>"


class Section:
    def __init__(self, record: dict, title_html: str | None, body_html: str, coverage_html: str = ""):
        self.id = record["id"]
        self.classes = record["classes"]
        self.attrs = record.get("attrs", {})
        self.has_disclosure = record.get("has_disclosure", False)
        self.title_html = title_html
        self.body_html = body_html
        self.coverage_html = coverage_html

    def opening_tag(self) -> str:
        attr_str = "".join(f' {k}="{v}"' if v != "" else f" {k}" for k, v in self.attrs.items())
        return f'<section class="{self.classes}" id="{self.id}"{attr_str}>'

    def rendered_body_html(self) -> str:
        return self.body_html + self.coverage_html

    def render(self) -> str:
        rendered_body = self.rendered_body_html()
        if not self.has_disclosure:
            return f"{self.opening_tag()}{rendered_body}</section>"
        return (
            f"{self.opening_tag()}{DISCLOSURE_OPEN}{self.title_html}{SUMMARY_CLOSE}"
            f"{rendered_body}{DETAILS_CLOSE}</section>"
        )


def load_sections(rename_map: dict) -> list:
    data = json.loads((CONTENT_DIR / "sections.json").read_text(encoding="utf-8"))
    coverage = load_visual_coverage()
    sections = []
    missing_coverage = []
    for rec in data["sections"]:
        sid = rec["id"]
        body_html = (SECTIONS_DIR / f"{sid}.body.html").read_text(encoding="utf-8")
        body_html = rewrite_media_refs(body_html, rename_map)
        coverage_html = ""
        if not body_has_visible_image(body_html):
            placement = coverage.get(sid)
            if placement is None:
                missing_coverage.append(sid)
            else:
                coverage_html = render_visual_coverage_figure(sid, placement)
        title_html = None
        if rec.get("has_disclosure"):
            title_html = (SECTIONS_DIR / f"{sid}.title.html").read_text(encoding="utf-8")
            title_html = rewrite_media_refs(title_html, rename_map)
        sections.append(Section(rec, title_html, body_html, coverage_html))

    if missing_coverage:
        raise RuntimeError(
            "authored top-level sections without a visible image or fallback placement: "
            + ", ".join(missing_coverage)
        )
    return sections


WATERMARK_CLIPS_SOURCE = [
    "bd9b6b141f0f2d11fadea67a.mp4",
    "c629ce1b298593185fb64c6d.mp4",
    "2867ab757325a18d4e86e47d.mp4",
    "3e601797a3fa7815a7f18566.mp4",
    "299d5b833f56bb9fe42f0eb2.mp4",
    "8fc2775c8783e4c873a72558.mp4",
]


def build_app_js(rename_map: dict) -> str:
    template = (TEMPLATES_DIR / "app.js").read_text(encoding="utf-8")
    clips = [rename_map.get(f, f) for f in WATERMARK_CLIPS_SOURCE]
    clips_literal = json.dumps([f"assets/media/{c}" for c in clips], indent=2)
    old_block = re.search(r"var clips = \[.*?\];", template, re.DOTALL)
    if not old_block:
        raise RuntimeError("app.js: watermark clip list marker not found")
    return template[: old_block.start()] + f"var clips = {clips_literal};" + template[old_block.end():]


def find_og_image(rename_map: dict) -> str | None:
    poster_source = "09e2837c1e2a76bc1fadccc2.jpg"
    published = rename_map.get(poster_source, poster_source)
    p = DOCS_DIR / "assets" / "media" / published
    if p.exists():
        return CANONICAL_URL.rstrip("/") + "/assets/media/" + published
    return None


def load_museum_stats(sections: list) -> dict:
    """Unified-museum hero statistics, derived from existing authoritative
    source/generated-derivative data -- never hand-maintained, so they can't
    drift from what the rest of the build actually publishes."""
    manifest = load_manifest()
    tours = json.loads((ROOT / "src" / "tours" / "tours.json").read_text(encoding="utf-8"))
    events = json.loads((ROOT / "src" / "chronology" / "events.json").read_text(encoding="utf-8"))
    invariants = json.loads((CANON_DIR / "invariants.json").read_text(encoding="utf-8"))
    return {
        "record_count": len(sections),
        "object_count": len(manifest.get("assets", [])),
        "event_count": len(events.get("events", events) if isinstance(events, dict) else events),
        "tour_count": len(tours.get("tours", tours) if isinstance(tours, dict) else tours),
        "canon_lock_count": len(invariants.get("document_locks", [])) + len(invariants.get("section_locks", [])),
    }


def render_site() -> str:
    rename_map = load_media_rename_map()
    sections = load_sections(rename_map)
    nav = json.loads((CONTENT_DIR / "nav.json").read_text(encoding="utf-8"))
    style_css = (TEMPLATES_DIR / "style.css").read_text(encoding="utf-8")
    app_js = build_app_js(rename_map)
    museum_stats = load_museum_stats(sections)

    entities = xref.collect_entities([
        {"id": s.id, "classes": s.classes, "title_html": s.title_html} for s in sections
    ])

    env = jinja2.Environment(
        loader=jinja2.FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=False,
        trim_blocks=False,
        lstrip_blocks=False,
    )
    template = env.get_template("shell.html.j2")
    html = template.render(
        nav_groups=nav["groups"],
        sections=sections,
        style_css=style_css,
        app_js=app_js,
        footer_folio="27",
        canonical_url=CANONICAL_URL,
        og_image_url=find_og_image(rename_map),
        museum_stats=museum_stats,
    )

    html, linked_count = xref.link_full_document(html, entities)
    html = html.replace("MUSEUM_LINK_COUNT_PLACEHOLDER", str(linked_count))
    print(f"Cross-reference links: {len(entities)} entities indexed, {linked_count} links inserted.", file=sys.stderr)
    return html


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="Fail if generated output differs from docs/index.html")
    args, unknown = ap.parse_known_args()
    if unknown:
        print(f"ERROR: unknown argument(s): {' '.join(unknown)}", file=sys.stderr)
        return 2

    if not MANIFEST_FILE.exists():
        print("ERROR: docs/asset-manifest.json not found. Run build/media_pipeline.py first.", file=sys.stderr)
        return 1

    try:
        html = render_site()
    except (OSError, json.JSONDecodeError, RuntimeError) as exc:
        print(f"ERROR: site generation failed: {exc}", file=sys.stderr)
        return 1

    index_file = DOCS_DIR / "index.html"
    if args.check:
        if not index_file.exists():
            print(f"ERROR: {index_file} does not exist; nothing to check against.", file=sys.stderr)
            return 1
        current = index_file.read_text(encoding="utf-8")
        if current != html:
            print("ERROR: generated output differs from committed docs/index.html "
                  "(the checked-in site and generator have diverged).", file=sys.stderr)
            return 1
        rights_src = ROOT / "RIGHTS.md"
        rights_docs = DOCS_DIR / "RIGHTS.md"
        if rights_src.exists():
            if not rights_docs.exists() or rights_docs.read_text(encoding="utf-8") != rights_src.read_text(encoding="utf-8"):
                print("ERROR: docs/RIGHTS.md does not match RIGHTS.md.", file=sys.stderr)
                return 1
        print("OK: docs/index.html matches generator output.")
        return 0

    index_file.write_text(html, encoding="utf-8")
    print(f"Wrote {index_file} ({len(html):,} bytes)")

    rights_src = ROOT / "RIGHTS.md"
    if rights_src.exists():
        shutil.copy2(rights_src, DOCS_DIR / "RIGHTS.md")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
