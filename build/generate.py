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
CANON_DIR = ROOT / "src" / "canon"

CANONICAL_URL = "https://westkitty.github.io/Starsilk_Character_Dossier/"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import xref  # noqa: E402


def load_media_rename_map() -> dict:
    if not MANIFEST_FILE.exists():
        return {}
    manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
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


DISCLOSURE_OPEN = '<details class="page-disclosure"><summary class="page-title"><span class="page-chevron" aria-hidden="true"></span>'
SUMMARY_CLOSE = "</summary>"
DETAILS_CLOSE = "</details>"


class Section:
    def __init__(self, record: dict, title_html: str | None, body_html: str):
        self.id = record["id"]
        self.classes = record["classes"]
        self.attrs = record.get("attrs", {})
        self.has_disclosure = record.get("has_disclosure", False)
        self.title_html = title_html
        self.body_html = body_html

    def opening_tag(self) -> str:
        attr_str = "".join(f' {k}="{v}"' if v != "" else f" {k}" for k, v in self.attrs.items())
        return f'<section class="{self.classes}" id="{self.id}"{attr_str}>'

    def render(self) -> str:
        if not self.has_disclosure:
            return f"{self.opening_tag()}{self.body_html}</section>"
        return (
            f"{self.opening_tag()}{DISCLOSURE_OPEN}{self.title_html}{SUMMARY_CLOSE}"
            f"{self.body_html}{DETAILS_CLOSE}</section>"
        )


def load_sections(rename_map: dict) -> list:
    data = json.loads((CONTENT_DIR / "sections.json").read_text(encoding="utf-8"))
    sections = []
    for rec in data["sections"]:
        sid = rec["id"]
        body_html = (SECTIONS_DIR / f"{sid}.body.html").read_text(encoding="utf-8")
        body_html = rewrite_media_refs(body_html, rename_map)
        title_html = None
        if rec.get("has_disclosure"):
            title_html = (SECTIONS_DIR / f"{sid}.title.html").read_text(encoding="utf-8")
            title_html = rewrite_media_refs(title_html, rename_map)
        sections.append(Section(rec, title_html, body_html))
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


def render_site() -> str:
    rename_map = load_media_rename_map()
    sections = load_sections(rename_map)
    nav = json.loads((CONTENT_DIR / "nav.json").read_text(encoding="utf-8"))
    style_css = (TEMPLATES_DIR / "style.css").read_text(encoding="utf-8")
    app_js = build_app_js(rename_map)

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
    )

    html, linked_count = xref.link_full_document(html, entities)
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

    html = render_site()

    index_file = DOCS_DIR / "index.html"
    if args.check:
        if not index_file.exists():
            print("ERROR: docs/index.html does not exist; nothing to check against.", file=sys.stderr)
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
