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
SECTION_OPEN_RE = re.compile(r'<section\b[^>]*\bid="([a-zA-Z0-9_-]+)"[^>]*>')
CLASS_ATTR_RE = re.compile(r'\bclass=(?P<quote>["\'])(?P<value>.*?)(?P=quote)', re.IGNORECASE)
HREF_ATTR_RE = re.compile(r'\bhref=(?P<quote>["\'])(?P<value>.*?)(?P=quote)', re.IGNORECASE)
ID_ATTR_RE = re.compile(r'\bid=(?P<quote>["\'])(?P<value>.*?)(?P=quote)', re.IGNORECASE)
DATA_SOURCE_RE = re.compile(r'\bdata-xref-source=', re.IGNORECASE)
DATA_TARGET_RE = re.compile(r'\bdata-xref-target=', re.IGNORECASE)


def xref_anchor_id(source_id: str, target_id: str) -> str:
    """Stable publication identity for one physical source->target xref."""
    return f"xref-{source_id}--{target_id}"


def _append_tag_attributes(tag: str, attributes: list[tuple[str, str]]) -> str:
    if not attributes:
        return tag
    end = "/>" if tag.rstrip().endswith("/>") else ">"
    position = tag.rfind(end)
    if position < 0:
        return tag
    prefix = tag[:position].rstrip()
    suffix = tag[position:]
    additions = "".join(f' {name}="{value}"' for name, value in attributes)
    return prefix + additions + suffix


def annotate_xref_evidence(full_html: str) -> str:
    """Give every published xref link a stable, addressable evidence anchor.

    This normalizes both links auto-inserted in the current build and xref-link
    markup already present in authored fragments. Physical evidence identity is
    based on the nearest containing section. The relationship graph may project
    that same physical link through ancestor section subtrees, so more than one
    graph edge can legitimately cite the same evidence anchor.
    """
    tokens = TAG_SPLIT_RE.split(full_html)
    section_stack: list[str | None] = []
    physical_counts: dict[tuple[str, str], int] = {}
    out: list[str] = []

    for token in tokens:
        if not token or token[0] != "<":
            out.append(token)
            continue

        match = TAG_NAME_RE.match(token)
        if not match:
            out.append(token)
            continue

        tagname = match.group(1).lower()
        is_close = token.startswith("</")

        if tagname == "section":
            if is_close:
                if section_stack:
                    section_stack.pop()
            else:
                section_match = SECTION_OPEN_RE.match(token)
                section_stack.append(section_match.group(1) if section_match else None)
            out.append(token)
            continue

        if tagname != "a" or is_close:
            out.append(token)
            continue

        class_match = CLASS_ATTR_RE.search(token)
        href_match = HREF_ATTR_RE.search(token)
        classes = class_match.group("value").split() if class_match else []
        href = href_match.group("value") if href_match else ""
        if "xref-link" not in classes or not href.startswith("#") or len(href) == 1:
            out.append(token)
            continue

        physical_source = next((section_id for section_id in reversed(section_stack) if section_id), None)
        target = href[1:]
        if not physical_source:
            out.append(token)
            continue

        key = (physical_source, target)
        physical_counts[key] = physical_counts.get(key, 0) + 1
        ordinal = physical_counts[key]
        generated_id = xref_anchor_id(physical_source, target)
        if ordinal > 1:
            generated_id = f"{generated_id}--{ordinal}"

        additions: list[tuple[str, str]] = []
        if not ID_ATTR_RE.search(token):
            additions.append(("id", generated_id))
        if not DATA_SOURCE_RE.search(token):
            additions.append(("data-xref-source", physical_source))
        if not DATA_TARGET_RE.search(token):
            additions.append(("data-xref-target", target))
        out.append(_append_tag_attributes(token, additions))

    return "".join(out)


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
                    sm = SECTION_OPEN_RE.match(tok)
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
            piece_out.append(f'<a href="#{sid}" class="xref-link">{name}</a>')
            linked_in_section.add((current_section_id, sid))
            linked_count += 1
            remaining = remaining[e:]
        out.append("".join(piece_out))

    result = annotate_xref_evidence("".join(out))
    return result, linked_count
