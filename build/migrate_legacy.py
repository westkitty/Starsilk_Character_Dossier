#!/usr/bin/env python3
"""ONE-TIME migration: extract structured, versioned content source from the
current authoritative docs/index.html (the Web Edition visual/content
baseline) into src/content/.

This is NOT part of the normal build. It exists to bootstrap the new
source-of-truth (src/content/sections/*.html + sections.json) from the
already-vetted, already-tested current output, so canon prose is preserved
byte-for-byte rather than re-typed or re-derived. Re-run only if you
deliberately want to re-seed src/content/ from a hand-edited docs/index.html
(not expected in normal operation -- normally you edit src/content/ directly
and run build/generate.py).

Extraction is done via raw string slicing on the existing document (matching
section boundaries the same way tools/apply_media_presentation_and_collapse.py
already did), never via an HTML parser that could reserialize and subtly
alter attribute quoting/whitespace/self-closing tags -- byte-for-byte
fidelity to current canon text is the whole point.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEGACY_INDEX = ROOT / "docs" / "index.html"
CONTENT_DIR = ROOT / "src" / "content"
SECTIONS_DIR = CONTENT_DIR / "sections"

SECTION_OPEN_RE = re.compile(r'<section\s+class="page([^"]*)"((?:\s+[a-zA-Z0-9_:-]+(?:="[^"]*")?)*)\s*>')
ID_RE = re.compile(r'\bid="([a-zA-Z0-9_-]+)"')

DISCLOSURE_OPEN = '<details class="page-disclosure"><summary class="page-title"><span class="page-chevron" aria-hidden="true"></span>'
SUMMARY_CLOSE = "</summary>"
DETAILS_CLOSE = "</details>"


def extract_attrs(attr_str: str) -> dict:
    attrs = {}
    for m in re.finditer(r'([a-zA-Z0-9_:-]+)(?:="([^"]*)")?', attr_str):
        key, val = m.group(1), m.group(2)
        if key:
            attrs[key] = val if val is not None else ""
    return attrs


def main() -> int:
    if not LEGACY_INDEX.exists():
        print(f"ERROR: {LEGACY_INDEX} not found", file=sys.stderr)
        return 1

    html = LEGACY_INDEX.read_text(encoding="utf-8")
    SECTIONS_DIR.mkdir(parents=True, exist_ok=True)

    opens = list(SECTION_OPEN_RE.finditer(html))
    records = []

    for i, m in enumerate(opens):
        page_classes = m.group(1).strip()
        rest_attrs_str = m.group(2)
        tag_end = m.end()
        next_start = opens[i + 1].start() if i + 1 < len(opens) else len(html)
        section_close = html.rfind("</section>", tag_end, next_start)
        if section_close == -1:
            print(f"WARNING: no closing </section> for section #{i}; skipping", file=sys.stderr)
            continue

        inner = html[tag_end:section_close].lstrip()
        attrs = extract_attrs(rest_attrs_str)
        sid = attrs.get("id")
        if not sid:
            print(f"WARNING: section #{i} (classes={page_classes!r}) has no id; skipping", file=sys.stderr)
            continue

        classes = ("page" + (" " + page_classes if page_classes else "")).strip()

        title_html = None
        body_html = inner

        if inner.startswith(DISCLOSURE_OPEN):
            after_open = inner[len(DISCLOSURE_OPEN):]
            summary_close_idx = after_open.find(SUMMARY_CLOSE)
            if summary_close_idx == -1:
                print(f"WARNING: {sid}: no </summary> found; storing raw inner", file=sys.stderr)
            else:
                title_html = after_open[:summary_close_idx]
                rest = after_open[summary_close_idx + len(SUMMARY_CLOSE):].rstrip()
                if rest.endswith(DETAILS_CLOSE):
                    rest = rest[: -len(DETAILS_CLOSE)]
                else:
                    print(f"WARNING: {sid}: body does not end with </details>", file=sys.stderr)
                body_html = rest

        other_attrs = {k: v for k, v in attrs.items() if k != "id"}

        rec = {
            "id": sid,
            "classes": classes,
            "attrs": other_attrs,
            "has_disclosure": title_html is not None,
        }
        records.append(rec)

        (SECTIONS_DIR / f"{sid}.body.html").write_text(body_html, encoding="utf-8")
        if title_html is not None:
            (SECTIONS_DIR / f"{sid}.title.html").write_text(title_html, encoding="utf-8")

    (CONTENT_DIR / "sections.json").write_text(
        json.dumps({"sections": records}, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Migrated {len(records)} sections to {SECTIONS_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
