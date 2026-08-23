#!/usr/bin/env python3
"""Lazy-load embedded reference/gallery videos so they don't download on
every page load regardless of visibility.

Bug this fixes: <video preload="metadata"> elements that live inside a
closed <details> (i.e. every collapsed page section, plus media-vault
shelves) still get eagerly fetched in full by Chromium on page load --
confirmed against the live site: every such video request came back as
`Range: bytes=0-` (the whole file), not a small metadata-only range. A
hidden/display:none <video> apparently can't run the browser's normal
"just read enough to get duration/dimensions" optimization, so
preload="metadata" behaves like preload="auto" for anything the user
hasn't opened yet. On this dossier that means ~76MB of video the user may
never even scroll to gets pulled down before the page is interactive --
directly at odds with a fast, smooth first paint.

Fix: strip the real src (on <video src="..."> and on child <source
src="...">) into a data-lazy-src placeholder for every non-hero,
non-watermark video, and restore it -- then call video.load() -- only
when the <details> containing it is actually opened. At that point the
element is genuinely visible/laid out, so the browser's normal metadata
preload behavior applies correctly.

Idempotent: safe to re-run (checks a marker before editing).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"

MARKER = "data-lazy-src"
JS_MARKER = "// Lazy-load collapsed videos on open"

# Excludes: #brandkit-watermark (no static src; JS-managed lifecycle
# already handles it) and .hero-video (meant to start loading immediately).
VIDEO_TAG_RE = re.compile(r'<video\b(?![^>]*\bid="brandkit-watermark")(?![^>]*\bclass="hero-video")[^>]*>')
SRC_ATTR_RE = re.compile(r'\bsrc="([^"]+)"')
SOURCE_TAG_RE = re.compile(r'<source\b[^>]*>')

JS_ADDITION = """
  // Lazy-load collapsed videos on open
  (function(){
    function activate(scope){
      scope.querySelectorAll('video[data-lazy-src]').forEach(function(v){
        v.src = v.getAttribute('data-lazy-src');
        v.removeAttribute('data-lazy-src');
        v.load();
      });
      scope.querySelectorAll('source[data-lazy-src]').forEach(function(s){
        s.src = s.getAttribute('data-lazy-src');
        s.removeAttribute('data-lazy-src');
        var v = s.closest('video');
        if(v) v.load();
      });
    }
    // Deliberately NOT also activating already-open details on initial load:
    // media-shelf elements default open in their *own* markup, but that
    // doesn't mean they're actually visible -- they're routinely nested
    // inside a still-closed page-disclosure, which hides them via
    // display:none regardless of their own open state. Relying only on the
    // 'toggle' event (which fires whether .open was set by a real click or
    // by JS, e.g. Expand All or anchor-navigation auto-open) means a video
    // only activates once something has genuinely just become visible.
    // When an ancestor page-disclosure opens, activate(d) below finds and
    // activates any already-open nested shelf's videos too, since
    // querySelectorAll searches all descendants regardless of depth.
    //
    // Belt and suspenders: browsers can fire 'toggle' for a <details open>
    // that was simply parsed with that attribute already present (observed
    // directly, reproducibly, for the statically-open media-shelf elements
    // -- not just a theoretical concern), even though its own containing
    // page-disclosure is still closed and hides it. Native <details>
    // hiding of non-summary content is NOT plain CSS display:none as far
    // as offsetParent is concerned -- offsetParent came back non-null for
    // a shelf confirmed (via closest()) to have a closed ancestor, so that
    // check doesn't work here. Walk the ancestor chain explicitly instead:
    // not truly visible if any containing <details> (there's exactly one
    // level of this in practice: page-disclosure) is closed.
    document.querySelectorAll('details').forEach(function(d){
      d.addEventListener('toggle', function(){
        if(d.open && !d.closest('details:not([open])')) activate(d);
      });
    });
  })();
"""


def convert_video_tag(tag: str) -> str:
    """Move a direct src="..." on <video ...> to data-lazy-src, if present."""
    m = SRC_ATTR_RE.search(tag)
    if not m:
        return tag
    return tag[:m.start()] + f'data-lazy-src="{m.group(1)}"' + tag[m.end():]


def convert_source_tag(tag: str) -> str:
    m = SRC_ATTR_RE.search(tag)
    if not m:
        return tag
    return tag[:m.start()] + f'data-lazy-src="{m.group(1)}"' + tag[m.end():]


def apply_html(html: str) -> str:
    if MARKER in html:
        return html

    out = []
    pos = 0
    converted = 0
    for vm in VIDEO_TAG_RE.finditer(html):
        out.append(html[pos:vm.start()])
        video_tag = vm.group(0)
        if "src=" in video_tag:
            video_tag = convert_video_tag(video_tag)
            converted += 1
        out.append(video_tag)
        pos = vm.end()

        # If this <video> has no src of its own, its child <source> tags
        # (up to the closing </video>) carry the real src instead.
        close_idx = html.find("</video>", pos)
        if close_idx != -1 and "src=" not in video_tag:
            segment = html[pos:close_idx]
            new_segment = SOURCE_TAG_RE.sub(lambda sm: convert_source_tag(sm.group(0)), segment)
            if new_segment != segment:
                converted += 1
            out.append(new_segment)
            pos = close_idx

    out.append(html[pos:])
    print(f"Lazy-load: converted {converted} video element(s) to load-on-open.")
    return "".join(out)


def apply_js(html: str) -> str:
    if JS_MARKER in html:
        return html
    tail = "</script>\n</body></html>"
    if tail not in html:
        print("WARNING: end-of-body script anchor not found; lazy-load JS not added.")
        return html
    return html.replace(tail, JS_ADDITION + tail, 1)


def main() -> int:
    if not INDEX.exists():
        print(f"ERROR: {INDEX} not found", file=sys.stderr)
        return 1
    html = INDEX.read_text(encoding="utf-8")
    html = apply_html(html)
    html = apply_js(html)
    INDEX.write_text(html, encoding="utf-8")
    print(f"Wrote {INDEX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
