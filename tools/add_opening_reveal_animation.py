#!/usr/bin/env python3
"""Make the hero video the first thing visible on load: the sidebar index,
the top-of-content controls bar, and the cover's text/badges start
invisible and fade + rise into place only once the video actually begins
playing (or a short safety timeout elapses, so a blocked/failed autoplay
never leaves the site looking broken).

Mechanism (progressive enhancement, no flash of unstyled content):
1. An inline script -- the very first thing inside <body>, before
   anything else parses -- synchronously adds a "pre-reveal" class to
   <html>. Because it runs before the browser has painted anything past
   it, there's no flash of the sidebar/toolbar/title before they hide.
   If JS is disabled, this script never runs, so nothing ever hides --
   the page just renders normally with no animation. That's why this is
   a separate tiny inline script rather than the class being baked
   statically into the HTML.
2. CSS hides/offsets those elements only while html.pre-reveal is
   present, and defines the transition back to normal (with a slight
   stagger for polish) for when the class is removed.
3. An end-of-body script waits for the hero video's 'playing' event (or
   an 'error' fallback, or a ~1.2s timeout, whichever comes first) and
   removes html.pre-reveal, triggering the reveal transition.
4. prefers-reduced-motion: content is never actually hidden in that case
   (CSS override keeps it at full opacity even while html.pre-reveal is
   present) -- respects the existing site-wide reduced-motion contract.

If there's no hero video (e.g. this ran before add_hero_video_and_rebrand.py,
or that script was skipped because the source file wasn't available), the
end-of-body script just falls straight to the safety timeout, so the site
still reveals itself normally after a brief moment rather than depending
on a video that doesn't exist.

Idempotent: safe to re-run (checks a marker before editing).
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"

CSS_MARKER = "/* Opening reveal: hero video first, then the rest of the site */"
CSS_ADDITION = """
/* Opening reveal: hero video first, then the rest of the site */
#index,.cover .eyebrow,.cover h1,.cover .edition-label,.cover .deck,.cover .cover-rule,.cover .tag-row{opacity:1;transform:translateY(0);transition:opacity .6s cubic-bezier(.16,1,.3,1),transform .6s cubic-bezier(.16,1,.3,1)}
.page-controls{opacity:1;transition:opacity .6s cubic-bezier(.16,1,.3,1)}
html.pre-reveal #index,html.pre-reveal .cover .eyebrow,html.pre-reveal .cover h1,html.pre-reveal .cover .edition-label,html.pre-reveal .cover .deck,html.pre-reveal .cover .cover-rule,html.pre-reveal .cover .tag-row{opacity:0;transform:translateY(14px);transition:none}
html.pre-reveal .page-controls{opacity:0;transition:none}
html:not(.pre-reveal) .page-controls{transition-delay:.05s}
html:not(.pre-reveal) #index{transition-delay:.1s}
html:not(.pre-reveal) .cover .eyebrow{transition-delay:.12s}
html:not(.pre-reveal) .cover h1{transition-delay:.18s}
html:not(.pre-reveal) .cover .edition-label{transition-delay:.28s}
html:not(.pre-reveal) .cover .deck{transition-delay:.34s}
html:not(.pre-reveal) .cover .cover-rule{transition-delay:.42s}
html:not(.pre-reveal) .cover .tag-row{transition-delay:.48s}
@media(prefers-reduced-motion: reduce){html.pre-reveal #index,html.pre-reveal .page-controls,html.pre-reveal .cover .eyebrow,html.pre-reveal .cover h1,html.pre-reveal .cover .edition-label,html.pre-reveal .cover .deck,html.pre-reveal .cover .cover-rule,html.pre-reveal .cover .tag-row{opacity:1;transform:none}}
""".rstrip("\n")

EARLY_SCRIPT_MARKER = "pre-reveal-gate"
EARLY_SCRIPT = '<script data-role="pre-reveal-gate">document.documentElement.classList.add(\'pre-reveal\');</script>'

LATE_JS_MARKER = "// Opening reveal: show the rest of the site once the hero video is playing"
LATE_JS = """
  // Opening reveal: show the rest of the site once the hero video is playing
  (function(){
    var html = document.documentElement;
    if(!html.classList.contains('pre-reveal')) return;
    var revealed = false;
    function reveal(){
      if(revealed) return;
      revealed = true;
      html.classList.remove('pre-reveal');
    }
    // Let the video play alone a beat longer before the rest of the site
    // fades in, on top of however long it took to actually start playing.
    var EXTRA_DELAY_MS = 1000;
    function delayedReveal(){ setTimeout(reveal, EXTRA_DELAY_MS); }
    var heroVideo = document.querySelector('.hero-video');
    if(heroVideo){
      heroVideo.addEventListener('playing', delayedReveal, {once:true});
      heroVideo.addEventListener('error', delayedReveal, {once:true});
    }
    // Safety net: never block the site open for more than ~1.2s (plus the
    // same extra beat above) even if autoplay is blocked, the video errors
    // silently, there is no hero video at all, or 'playing' never fires.
    setTimeout(reveal, 1200 + EXTRA_DELAY_MS);
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) reveal();
  })();
"""


def apply_css(html: str) -> str:
    if CSS_MARKER in html:
        return html
    return html.replace("</style>", CSS_ADDITION + "\n</style>", 1)


def apply_early_script(html: str) -> str:
    if EARLY_SCRIPT_MARKER in html:
        return html
    anchor = "<body>"
    if anchor not in html:
        print("WARNING: <body> tag not found; pre-reveal gate not added.")
        return html
    return html.replace(anchor, anchor + "\n" + EARLY_SCRIPT, 1)


def apply_late_js(html: str) -> str:
    if LATE_JS_MARKER in html:
        return html
    tail = "</script>\n</body></html>"
    if tail not in html:
        print("WARNING: end-of-body script anchor not found; reveal-trigger JS not added.")
        return html
    return html.replace(tail, LATE_JS + tail, 1)


def main() -> int:
    if not INDEX.exists():
        print(f"ERROR: {INDEX} not found", file=sys.stderr)
        return 1
    html = INDEX.read_text(encoding="utf-8")
    html = apply_css(html)
    html = apply_early_script(html)
    html = apply_late_js(html)
    INDEX.write_text(html, encoding="utf-8")
    print(f"Wrote {INDEX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
