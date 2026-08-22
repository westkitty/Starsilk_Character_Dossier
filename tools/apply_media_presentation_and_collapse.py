#!/usr/bin/env python3
"""Media presentation normalization + default-collapsed dossier sections
(media coverage + presentation correction pass).

Two independent, idempotent transforms applied to docs/index.html:

1. CSS normalization for reference/archival images (UX-042): the plain
   content images inside .reference-record and .embedded-ref figures had
   no width/height/object-fit rule at all (only the interactive attachment
   stages and the standalone media-vault gallery did), so they rendered at
   native pixel size -- wildly inconsistent across entries. Adds a coherent
   sizing rule (preserve aspect ratio, sane max-height, no stretch/squash)
   plus a real grid for .embedded-grid, which previously had no layout
   rule and just stacked figures as full-width blocks.

2. Default-collapsed page sections (UX-043): every top-level dossier page
   (character folio, Drakken kind, peripheral entry, lore page, etc.) is
   wrapped in a native <details class="page-disclosure"> with its existing
   .page-title promoted to <summary>, reusing the same disclosure pattern,
   chevron affordance and enhance() open/close animation already used for
   the nav index and media-vault shelves. Collapsed by default; the cover
   page is left untouched (always visible, per spec). A small addition to
   the existing hashchange handling expands the containing page and
   scrolls to it when an in-page anchor or the initial page load targets
   a currently-collapsed section.

Does NOT regenerate docs/ from the offline archive HTML -- edits the
existing generated site in place, exactly like the other tools/*.py passes.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"

CSS_MARKER = "/* Media presentation normalization (media coverage + presentation correction pass) */"

CSS_ADDITION = """
/* Media presentation normalization (media coverage + presentation correction pass) */
.embedded-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem;align-items:start}
.reference-record>img,.embedded-ref>img{display:block;width:100%;height:auto;max-height:36rem;object-fit:contain;background:#03060a;border-radius:2px}
.embedded-ref.wide-card{grid-column:1/-1}
.embedded-ref.wide-card>img{max-height:28rem}
@media(max-width:700px){.reference-record>img,.embedded-ref>img{max-height:24rem}}

/* Default-collapsed dossier sections */
details.page-disclosure{border:0}
details.page-disclosure>summary.page-title{cursor:pointer;list-style:none;position:relative;padding-right:2.5rem}
details.page-disclosure>summary.page-title::-webkit-details-marker{display:none}
details.page-disclosure>summary.page-title::marker{content:""}
details.page-disclosure>summary.page-title:focus-visible{outline:2px solid var(--thread);outline-offset:6px}
.page-chevron{position:absolute;right:0;top:.4rem;width:1rem;height:1rem;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .32s cubic-bezier(.16,1,.3,1);opacity:.65;color:var(--accent,var(--thread))}
details.page-disclosure[open]>summary.page-title .page-chevron{transform:rotate(-135deg)}
@media print{details.page-disclosure{display:block!important}details.page-disclosure>summary.page-title{display:grid!important}details.page-disclosure>summary.page-title .page-chevron{display:none!important}}
""".rstrip("\n")

DIV_TAG_RE = re.compile(r"<(/?)div\b[^>]*>")
# Permissive: matches every top-level page section boundary, id or not (e.g. the
# id-less closing "footer" section), so next-section / closing-tag lookups never
# overshoot into a neighboring section.
SECTION_BOUNDARY_RE = re.compile(r'<section class="page([^"]*)"[^>]*>')
# Strict: only sections with an addressable id are candidates for collapsing.
SECTION_ID_RE = re.compile(r'\bid="([a-zA-Z0-9_-]+)"')


def find_matching_div_end(html: str, start_idx: int) -> int:
    """start_idx is right after the opening '<div ...>' tag's '>'.
    Returns the index right after the matching closing '</div>'."""
    depth = 1
    for m in DIV_TAG_RE.finditer(html, start_idx):
        if m.group(1) == "/":
            depth -= 1
            if depth == 0:
                return m.end()
        else:
            depth += 1
    raise ValueError("no matching </div> found")


def apply_css(html: str) -> str:
    if CSS_MARKER in html:
        return html
    return html.replace("</style>", CSS_ADDITION + "\n</style>", 1)


def apply_collapse(html: str) -> str:
    if 'details class="page-disclosure"' in html:
        return html

    opens = list(SECTION_BOUNDARY_RE.finditer(html))
    edits = []  # (start, end, replacement), applied back-to-front
    collapsed_count = 0

    OPEN_TAG = '<div class="page-title">'

    for i, m in enumerate(opens):
        classes = m.group(1)
        id_m = SECTION_ID_RE.search(m.group(0))
        sid = id_m.group(1) if id_m else f"(no-id, folio tag at {m.start()})"
        if "cover" in classes.split() or id_m is None:
            continue

        tag_end = m.end()
        title_m = re.match(r"\s*" + re.escape(OPEN_TAG), html[tag_end:])
        if not title_m:
            print(f"WARNING: no immediate .page-title found for section id={sid}; leaving uncollapsed.")
            continue
        # Absolute offsets of the matched "<div class=\"page-title\">" open tag itself.
        open_tag_start = tag_end + title_m.end() - len(OPEN_TAG)
        open_tag_end = tag_end + title_m.end()
        try:
            title_close_end = find_matching_div_end(html, open_tag_end)
        except ValueError:
            print(f"WARNING: unmatched .page-title div for section id={sid}; leaving uncollapsed.")
            continue
        title_close_start = title_close_end - len("</div>")

        next_open_start = opens[i + 1].start() if i + 1 < len(opens) else len(html)
        section_close = html.rfind("</section>", tag_end, next_open_start)
        if section_close == -1:
            print(f"WARNING: no closing </section> found for id={sid}; leaving uncollapsed.")
            continue

        # 1. Replace the opening "<div class="page-title">" with a details+summary wrapper.
        edits.append((open_tag_start, open_tag_end,
                      '<details class="page-disclosure"><summary class="page-title">'
                      '<span class="page-chevron" aria-hidden="true"></span>'))
        # 2. Replace .page-title's own matching closing "</div>" with "</summary>".
        edits.append((title_close_start, title_close_end, "</summary>"))
        # 3. Close the details element right before the section's closing tag.
        edits.append((section_close, section_close, "</details>"))
        collapsed_count += 1

    edits.sort(key=lambda e: e[0], reverse=True)
    out = html
    for start, end, repl in edits:
        out = out[:start] + repl + out[end:]
    print(f"Default-collapsed {collapsed_count} page sections (of {len(opens)} total; cover left open).")
    return out


HASH_JS_MARKER = "// Default-collapsed section anchor handling"

HASH_JS = """
  // Default-collapsed section anchor handling
  (function(){
    function expandContaining(id){
      var target = document.getElementById(id);
      if(!target) return null;
      // The id usually lives on the section element, which is the *parent*
      // of its page-disclosure details (added right after the opening tag)
      // -- so look at direct children first, then fall back to ancestors
      // for ids that land on something nested inside a details element.
      var page = target.querySelector(':scope > details.page-disclosure') || target.closest('details.page-disclosure');
      if(page && !page.open) page.open = true;
      return target;
    }
    function handleHash(){
      if(!location.hash || location.hash.length < 2) return;
      var id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch(e) { id = location.hash.slice(1); }
      var target = expandContaining(id);
      if(!target) return;
      // Opening a details element changes layout below it, and on initial
      // page load the browser also attempts its own (pre-open, so wrong)
      // native jump-to-fragment scroll around the same time -- a plain
      // single smooth scrollIntoView() loses that race and gets cut short.
      // Jump instantly, once synchronously and once again shortly after
      // (after any native attempt and layout have settled), so whichever
      // runs last lands in the right place.
      var jump = function(){ target.scrollIntoView({block:'start', behavior:'auto'}); };
      jump();
      requestAnimationFrame(jump);
      setTimeout(jump, 80);
    }
    window.addEventListener('hashchange', handleHash);
    handleHash();

    // Printing a closed native details element renders nothing for its collapsed
    // content in every current browser engine, regardless of any authored
    // "display:block!important" override on its children (the suppression
    // happens below the CSS cascade, not through an overridable display
    // value) -- so the print stylesheet's rule alone cannot make collapsed
    // page content printable. Force every page open for the duration of the
    // print job instead, and restore whatever was open beforehand after.
    var wasOpenBeforePrint = null;
    window.addEventListener('beforeprint', function(){
      var pages = document.querySelectorAll('details.page-disclosure');
      wasOpenBeforePrint = Array.prototype.map.call(pages, function(d){ return d.open; });
      pages.forEach(function(d){ d.open = true; });
    });
    window.addEventListener('afterprint', function(){
      if(!wasOpenBeforePrint) return;
      var pages = document.querySelectorAll('details.page-disclosure');
      pages.forEach(function(d, i){ d.open = wasOpenBeforePrint[i]; });
      wasOpenBeforePrint = null;
    });
  })();
"""


def apply_hash_js(html: str) -> str:
    if HASH_JS_MARKER in html:
        return html
    # Deliberately NOT added to the enhance() animated-disclosure list: page
    # sections rely on plain native <details> open/close (instant, always
    # correct, zero extra JS) rather than the WAAPI-driven height animation
    # used for nav-group/media-shelf. That keeps 127 page toggles cheap and
    # sidesteps coupling page-level collapse to an animation subsystem that
    # exists for small chrome-y disclosures, not full-page content blocks.
    if "</script>\n</body></html>" not in html:
        print("WARNING: end-of-body script anchor not found; anchor-expand handling not added.")
        return html
    html = html.replace("</script>\n</body></html>", HASH_JS + "</script>\n</body></html>", 1)
    return html


def main() -> int:
    if not INDEX.exists():
        print(f"ERROR: {INDEX} not found", file=sys.stderr)
        return 1
    html = INDEX.read_text(encoding="utf-8")
    html = apply_css(html)
    html = apply_collapse(html)
    html = apply_hash_js(html)
    INDEX.write_text(html, encoding="utf-8")
    print(f"Wrote {INDEX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
