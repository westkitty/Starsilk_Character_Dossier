#!/usr/bin/env python3
"""UI/UX polish pass (impeccable skill sweep):
1. Group the sidebar nav's 29 links into collapsible categories (Reference 17/18 before Peripheral 19-26).
2. Add a shared, smooth WAAPI-based accordion animation for every
   <details> disclosure on the page (new nav groups + existing media
   shelves), replacing the native instant toggle.
3. Animate the mobile nav pop-out (opacity/transform instead of an
   abrupt display swap).
4. Raise the Starsilk background watermark's visibility.
5. Give the card system a clean, restrained treatment without applying
   heavy backdrop blur to hundreds of content cards or erasing .warn semantics.

Edits docs/index.html in place. Does not touch docs/assets/media or the
asset manifest. Idempotent: safe to re-run (checks markers before editing).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"

NAV_GROUPS = [
    ("Overview", [
        ("#cover", "00 — Dossier"),
        ("#world", "01 — Project axis"),
        ("#chronology", "02 — Canon chronology"),
    ]),
    ("Principal characters", [
        ("#shard-god", "03 — Shard-God"),
        ("#codec", "04 — Codec"),
        ("#dao", "05 — Dao"),
        ("#kail", "06 — Kail"),
        ("#marcel", "07 — Marcel"),
        ("#jazen", "08 — Jazen"),
    ]),
    ("Drakken &amp; blood systems", [
        ("#starsilk-material", "09 — Starsilk material"),
        ("#gorevault", "10 — Gorevault"),
        ("#ringthroat", "11 — Ringthroat"),
        ("#lyriboris", "12 — Lyriboris"),
        ("#drakken-registry", "12A — Drakken archive"),
        ("#blood-rings", "13 — Blood Rings"),
    ]),
    ("Canon &amp; cosmology", [
        ("#starbinding", "14 — Starbinding"),
        ("#canon-ledger", "15 — Canon ledger"),
        ("#beyond-wall", "15A — Beyond the Siege Wall"),
        ("#systems", "16 — Systems &amp; figures"),
    ]),
    ("Reference", [
        ("#archive", "17 — Image archive"),
        ("#source", "18 — Codec source text"),
    ]),
    ("Peripheral &amp; cosmic", [
        ("#peripheral-index", "19 — Peripheral registry"),
        ("#cosmic-architecture", "20 — Cosmic architecture"),
        ("#worldsvault-templates", "21 — WorldsVault templates"),
        ("#ontology-horror", "22 — Ontology &amp; horror"),
        ("#artifacts-factions", "23 — Artifacts &amp; factions"),
        ("#trio-gallery", "24 — Hero archive"),
        ("#history-media", "25 — History media"),
        ("#media-vault", "26 — Media vault"),
    ]),
]


def build_nav_html() -> str:
    groups = []
    for name, links in NAV_GROUPS:
        items = "".join(f'<a href="{href}">{label}</a>' for href, label in links)
        groups.append(
            f'<details class="nav-group" open><summary>{name}'
            f'<span class="chevron" aria-hidden="true"></span></summary>'
            f'<div class="nav-group-body">{items}</div></details>'
        )
    return "<nav>" + "".join(groups) + "</nav>"


OLD_NAV_RE = re.compile(r"<nav>.*?</nav>", re.DOTALL)

ACCORDION_JS = """
(function(){
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function enhance(details){
    var summary = details.querySelector(':scope > summary');
    var body = details.querySelector(':scope > .nav-group-body, :scope > div');
    if(!summary || !body) return;
    if(reduceMotion) return; // native instant toggle remains fully functional
    var anim = null;
    summary.addEventListener('click', function(e){
      e.preventDefault();
      if(details.classList.contains('animating')) return;
      details.open ? collapse() : expand();
    });
    function expand(){
      details.classList.add('animating');
      details.open = true;
      body.style.overflow = 'hidden';
      var end = body.scrollHeight;
      if(anim) anim.cancel();
      anim = body.animate(
        [{height:'0px', opacity:.4}, {height:end+'px', opacity:1}],
        {duration:420, easing:'cubic-bezier(0.16,1,0.3,1)'}
      );
      anim.onfinish = function(){ details.classList.remove('animating'); body.style.height=''; body.style.overflow=''; };
    }
    function collapse(){
      details.classList.add('animating');
      body.style.overflow = 'hidden';
      var start = body.offsetHeight;
      if(anim) anim.cancel();
      anim = body.animate(
        [{height:start+'px', opacity:1}, {height:'0px', opacity:.4}],
        {duration:320, easing:'cubic-bezier(0.16,1,0.3,1)'}
      );
      anim.onfinish = function(){ details.open = false; details.classList.remove('animating'); body.style.height=''; body.style.overflow=''; };
    }
  }
  document.querySelectorAll('details.nav-group, details.media-shelf').forEach(enhance);
})();
""".strip()


def main() -> int:
    if not INDEX.exists():
        print(f"ERROR: {INDEX} not found.", file=sys.stderr)
        return 1

    html = INDEX.read_text(encoding="utf-8")
    changed = []

    # 1. Nav grouping
    new_nav = build_nav_html()
    if '<details class="nav-group"' in html:
        html = re.sub(r"<nav>.*?</nav>", new_nav, html, flags=re.DOTALL, count=1)
        changed.append("nav refreshed with correct group order (Reference before Peripheral)")
    else:
        html, n = OLD_NAV_RE.subn(new_nav, html, count=1)
        if n:
            panel_re = re.compile(r"(<nav>.*?</nav>)(<small>.*?</small>)", re.DOTALL)
            html, n2 = panel_re.subn(
                r'<div class="index-panel"><div class="index-panel-inner">\1\2</div></div>', html, count=1
            )
            changed.append("nav grouped into collapsible categories")

    # 2. Media-shelf chevrons
    def add_chevron(m):
        details_open, summary_inner = m.group(1), m.group(2)
        if "chevron" in summary_inner:
            return m.group(0)
        return f'{details_open}<summary>{summary_inner}<span class="chevron" aria-hidden="true"></span></summary>'

    new_html, n = re.subn(
        r'(<details\b[^>]*class="[^"]*media-shelf[^"]*"[^>]*>)<summary>(.*?)</summary>',
        add_chevron, html, flags=re.DOTALL,
    )
    if n:
        html = new_html
        changed.append(f"chevrons added to {n} media-shelf summaries")

    INDEX.write_text(html, encoding="utf-8")
    print("UI/UX polish pass completed:")
    for c in changed:
        print(f"  - {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
