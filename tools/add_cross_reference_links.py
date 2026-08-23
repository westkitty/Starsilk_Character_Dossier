#!/usr/bin/env python3
"""Auto-link named-entity mentions (principal characters, Drakken kinds,
peripheral characters) to their own dossier entry wherever they're used in
other entries' prose, so "when they're used" a reader can jump straight to
the article itself.

Safety model:
- Operates only on genuine text nodes (splits the document into a strict
  text/tag token stream), never on tag attributes -- a naive substring
  replace risks inserting markup inside a quoted alt="" or href="" value.
- Never links inside <script>, <style>, <a>, <h1>, <h2>, <h3>, <summary> or
  <title> content (headings/summaries are already the entity's own title;
  existing links are left alone).
- Never links an entity to itself within its own section.
- At most one link per (entity, section) pair, so a name mentioned five
  times in one folio doesn't turn into five blue links -- only the first
  mention per section becomes the link.
- Case-sensitive, whole-word/whole-phrase matching (regex \\b-bounded),
  longest name first, so "Kail's Mother" and "Mara -- Syrin-4" are matched
  as their own distinct entities before the shorter "Kail" / "Mara" get a
  chance to swallow part of the phrase.
- A small denylist excludes names that collide with common English words
  (e.g. "Mother" as a generic noun) where auto-linking would misfire more
  often than it would help.

Idempotent: safe to re-run (checks a marker before editing; entities that
already ended up linked -- e.g. by an earlier run, or already hand-linked
in the source -- are simply skipped since they're inside <a> already).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"

CSS_MARKER = "/* Cross-reference entity links */"

CSS_ADDITION = """
/* Cross-reference entity links */
.xref-link{color:var(--thread);text-decoration:underline;text-decoration-color:rgba(85,223,255,.4);text-underline-offset:.15em;transition:text-decoration-color .2s ease}
.xref-link:hover,.xref-link:focus-visible{text-decoration-color:var(--thread);outline:none}
""".rstrip("\n")

# Entity names that collide with common English words/phrases -- linking
# every capitalized occurrence would misfire too often to be useful.
NAME_DENYLIST = {"Mother"}

SECTION_OPEN_RE = re.compile(r'<section class="page([^"]*)"[^>]*>')
SECTION_ID_RE = re.compile(r'\bid="([a-zA-Z0-9_-]+)"')
TAG_SPLIT_RE = re.compile(r"(<[^>]+>)")
TAG_NAME_RE = re.compile(r"</?([a-zA-Z0-9]+)")
SKIP_TAGS = {"script", "style", "a", "h1", "h2", "h3", "summary", "title"}


def collect_entities(html: str) -> dict:
    """id -> display name, for every character-page section (principal /
    Drakken / peripheral), excluding index-and-concept pages that merely
    reuse the peripheral-page class without being a named entity."""
    entities = {}
    opens = list(SECTION_OPEN_RE.finditer(html))
    for i, m in enumerate(opens):
        classes = m.group(1).split()
        if "character-page" not in classes:
            continue
        idm = SECTION_ID_RE.search(m.group(0))
        if not idm:
            continue
        sid = idm.group(1)
        start = m.end()
        end = opens[i + 1].start() if i + 1 < len(opens) else len(html)
        body = html[start:end]
        h2m = re.search(r"<h2>(.*?)</h2>", body, re.DOTALL)
        if not h2m:
            continue
        name = re.sub(r"<[^>]+>", "", h2m.group(1)).strip()
        if not name or name in NAME_DENYLIST:
            continue
        entities[sid] = name
    return entities


def build_html(html: str) -> str:
    if 'class="xref-link"' in html:
        return html

    entities = collect_entities(html)
    # Longest name first, so multi-word/compound names win over a shorter
    # name that happens to be their prefix (e.g. "Kail's Mother" before "Kail").
    by_length = sorted(entities.items(), key=lambda kv: len(kv[1]), reverse=True)
    patterns = [(sid, name, re.compile(r"\b" + re.escape(name) + r"\b")) for sid, name in by_length]

    tokens = TAG_SPLIT_RE.split(html)
    current_section_id = None
    skip_stack = []
    linked_in_section = set()  # (section_id, entity_id)
    linked_count = 0
    out = []

    for tok in tokens:
        if not tok:
            continue
        if tok[0] == "<":
            out.append(tok)
            m = TAG_NAME_RE.match(tok)
            if m:
                tagname = m.group(1).lower()
                is_close = tok.startswith("</")
                # Only a top-level page="..." section changes context. Sections
                # don't nest except for e.g. canon-ledger's <section
                # class="lore-group"> blocks, which have no "page" class and
                # must NOT reset current_section_id to None -- text inside
                # them still belongs to the enclosing top-level page.
                if tagname == "section" and not is_close and 'class="page' in tok:
                    idm = SECTION_ID_RE.search(tok)
                    current_section_id = idm.group(1) if idm else None
                if tagname in SKIP_TAGS:
                    if is_close:
                        if skip_stack and skip_stack[-1] == tagname:
                            skip_stack.pop()
                    elif not tok.endswith("/>"):
                        skip_stack.append(tagname)
            continue

        if skip_stack or current_section_id is None or not tok.strip():
            out.append(tok)
            continue

        remaining = tok
        piece_out = []
        while True:
            best = None  # (start, end, sid, name)
            for sid, name, pat in patterns:
                if sid == current_section_id:
                    continue
                if (current_section_id, sid) in linked_in_section:
                    continue
                mm = pat.search(remaining)
                if mm and (best is None or mm.start() < best[0]):
                    best = (mm.start(), mm.end(), sid, name)
            if best is None:
                piece_out.append(remaining)
                break
            s, e, sid, name = best
            piece_out.append(remaining[:s])
            piece_out.append(f'<a href="#{sid}" class="xref-link">{name}</a>')
            linked_in_section.add((current_section_id, sid))
            linked_count += 1
            remaining = remaining[e:]
        out.append("".join(piece_out))

    print(f"Cross-reference links: {len(entities)} entities indexed, {linked_count} links inserted.")
    return "".join(out)


def apply_css(html: str) -> str:
    if CSS_MARKER in html:
        return html
    return html.replace("</style>", CSS_ADDITION + "\n</style>", 1)


def main() -> int:
    if not INDEX.exists():
        print(f"ERROR: {INDEX} not found", file=sys.stderr)
        return 1
    html = INDEX.read_text(encoding="utf-8")
    html = apply_css(html)
    html = build_html(html)
    INDEX.write_text(html, encoding="utf-8")
    print(f"Wrote {INDEX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
