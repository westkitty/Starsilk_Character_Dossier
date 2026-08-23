"""Cross-reference entity linking: auto-links named-entity mentions
(principal characters, Drakken kinds, peripheral characters) to their own
dossier entry wherever they're used in other entries' prose.

Operates on a token stream (text vs. tags), never on tag attributes, so it
can never insert markup inside a quoted attribute value. This is the same
algorithm tools/add_cross_reference_links.py used against the legacy
mutate-in-place pipeline, ported to run once during generation against
in-memory section content instead of being re-applied idempotently against
already-published HTML.
"""
import re

NAME_DENYLIST = {"Mother"}
TAG_SPLIT_RE = re.compile(r"(<[^>]+>)")
TAG_NAME_RE = re.compile(r"</?([a-zA-Z0-9]+)")
SKIP_TAGS = {"script", "style", "a", "h1", "h2", "h3", "summary", "title"}
H2_RE = re.compile(r"<h2>(.*?)</h2>", re.DOTALL)


def xref_anchor_id(source_id: str, target_id: str) -> str:
    """Stable publication identity for one generated source->target xref."""
    return f"xref-{source_id}--{target_id}"


def collect_entities(sections: list) -> dict:
    """id -> display name, for character-page sections with a resolvable name."""
    entities = {}
    for sec in sections:
        if "character-page" not in sec["classes"].split():
            continue
        title_html = sec.get("title_html") or ""
        h2m = H2_RE.search(title_html)
        if not h2m:
            continue
        name = re.sub(r"<[^>]+>", "", h2m.group(1)).strip()
        if not name or name in NAME_DENYLIST:
            continue
        entities[sec["id"]] = name
    return entities


def link_full_document(full_html: str, entities: dict) -> str:
    """Insert xref links across the whole assembled document, honoring
    top-level <section id="..."> boundaries as the "current entity" scope
    so an entity never links to itself within its own section."""
    by_length = sorted(entities.items(), key=lambda kv: len(kv[1]), reverse=True)
    patterns = [(sid, name, re.compile(r"\b" + re.escape(name) + r"\b")) for sid, name in by_length]

    section_open_re = re.compile(r'<section\b[^>]*\bid="([a-zA-Z0-9_-]+)"[^>]*>')

    tokens = TAG_SPLIT_RE.split(full_html)
    current_section_id = None
    skip_stack = []
    linked_in_section = set()
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
                if tagname == "section" and not is_close:
                    sm = section_open_re.match(tok)
                    if sm:
                        current_section_id = sm.group(1)
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
            best = None
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
            anchor_id = xref_anchor_id(current_section_id, sid)
            piece_out.append(
                f'<a id="{anchor_id}" href="#{sid}" class="xref-link" '
                f'data-xref-source="{current_section_id}" data-xref-target="{sid}">{name}</a>'
            )
            linked_in_section.add((current_section_id, sid))
            linked_count += 1
            remaining = remaining[e:]
        out.append("".join(piece_out))

    result = "".join(out)
    return result, linked_count
