#!/usr/bin/env python3
"""UI/UX polish pass (impeccable skill sweep):
1. Group the sidebar nav's 29 links into collapsible categories.
2. Add a shared, smooth WAAPI-based accordion animation for every
   <details> disclosure on the page (new nav groups + existing media
   shelves), replacing the native instant toggle.
3. Animate the mobile nav pop-out (opacity/transform instead of an
   abrupt display swap).
4. Raise the Starsilk background watermark's visibility.
5. Give the card system a purposeful glassmorphic treatment (translucent
   + backdrop-blur, cyan-glass edges, unified elevation) so the now more
   visible watermark reads through panels.

Edits docs/index.html in place. Does not touch docs/assets/media or the
asset manifest. Idempotent: safe to re-run (checks markers before editing).
"""
import re
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
    ("Reference", [
        ("#archive", "17 — Image archive"),
        ("#source", "18 — Codec source text"),
    ]),
]


def build_nav_html():
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
    html = INDEX.read_text(encoding="utf-8")
    changed = []

    # 1. Nav grouping, wrapped in a grid-rows animated panel for the mobile
    #    pop-out (grid-template-rows animates cleanly; max-height does not).
    if 'class="nav-group"' not in html:
        new_nav = build_nav_html()
        html, n = OLD_NAV_RE.subn(new_nav, html, count=1)
        assert n == 1, "nav block not found/replaced"
        panel_re = re.compile(r"(<nav>.*?</nav>)(<small>.*?</small>)", re.DOTALL)
        html, n2 = panel_re.subn(
            r'<div class="index-panel"><div class="index-panel-inner">\1\2</div></div>', html, count=1
        )
        assert n2 == 1, "nav/small panel wrap failed"
        changed.append("nav grouped into collapsible categories")
    else:
        print("Nav already grouped; skipping.")

    # 2. Media-shelf chevrons (retrofit existing shelves) -------------------
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

    # 3. Accordion JS --------------------------------------------------------
    if "details.nav-group, details.media-shelf" not in html:
        html = html.replace("</body>", f"<script>{ACCORDION_JS}</script></body>", 1)
        changed.append("accordion animation script added")
    else:
        print("Accordion script already present; skipping.")

    # 4. CSS additions ---------------------------------------------------------
    css_additions = []

    # Watermark visibility bump.
    if "opacity:.1;pointer-events:none;z-index:0" in html:
        html = html.replace(
            "opacity:.1;pointer-events:none;z-index:0",
            "opacity:.24;pointer-events:none;z-index:0", 1
        )
        changed.append("watermark opacity raised .1 -> .24")

    if ".nav-group{" not in html:
        css_additions.append(
            ".nav-group{border:0;border-top:1px solid rgba(120,220,238,.14)}"
            ".nav-group:first-child{border-top:0}"
            ".nav-group>summary{cursor:pointer;list-style:none;display:flex;align-items:center;"
            "justify-content:space-between;gap:.5rem;padding:.6rem .8rem;"
            "font:800 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;"
            "letter-spacing:.1em;text-transform:uppercase;color:#8fb4c4}"
            ".nav-group>summary::-webkit-details-marker{display:none}"
            ".nav-group>summary:hover{color:#dff9ff}"
            ".nav-group .chevron{width:.55rem;height:.55rem;border-right:1.5px solid currentColor;"
            "border-bottom:1.5px solid currentColor;transform:rotate(45deg);"
            "transition:transform .32s cubic-bezier(.16,1,.3,1);flex:0 0 auto;opacity:.7}"
            ".nav-group[open]>summary .chevron{transform:rotate(-135deg)}"
            ".nav-group-body{display:grid;overflow:hidden;padding:0 .45rem .35rem}"
        )

    if ".media-shelf .chevron{" not in html:
        css_additions.append(
            ".media-shelf>summary{gap:.5rem}"
            ".media-shelf .chevron{width:.6rem;height:.6rem;border-right:1.5px solid currentColor;"
            "border-bottom:1.5px solid currentColor;transform:rotate(45deg);"
            "transition:transform .32s cubic-bezier(.16,1,.3,1);flex:0 0 auto;opacity:.75;margin-left:.35rem}"
            ".media-shelf[open]>summary .chevron{transform:rotate(-135deg)}"
        )

    if "/* mobile nav pop-out */" not in html:
        # Height is driven by JS (WAAPI, same technique as the accordion) via
        # the toggle-listener patch below -- NOT a CSS transition, which the
        # detector correctly flags as layout-thrashing for height/max-height.
        css_additions.append(
            "@media(max-width:950px){"
            "#brandkit-watermark{opacity:.16}"
            ".index-panel{height:0;overflow:hidden;pointer-events:none}"
            ".index-panel-inner{opacity:0;transform:translateY(-6px);"
            "transition:opacity .3s ease,transform .34s cubic-bezier(.16,1,.3,1)}"
            ".index-panel-inner nav,.index-panel-inner small{overflow:auto;max-height:70vh}"
            ".index.open .index-panel{height:auto;pointer-events:auto}"
            ".index.open .index-panel-inner{opacity:1;transform:translateY(0)}"
            "}/* mobile nav pop-out */"
        )

    # 3.5 Replace the plain class-toggle mobile-nav listener with a
    #     WAAPI-height-animated version (mirrors the accordion technique).
    old_toggle = "toggle.addEventListener('click',()=>index.classList.toggle('open'));"
    if old_toggle in html:
        new_toggle = (
            "toggle.addEventListener('click',()=>{"
            "var panel=document.querySelector('.index-panel');"
            "var inner=document.querySelector('.index-panel-inner');"
            "if(!panel||!inner){index.classList.toggle('open');return;}"
            "var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;"
            "var opening=!index.classList.contains('open');"
            "if(reduceMotion){index.classList.toggle('open');return;}"
            "if(panel.__anim) panel.__anim.cancel();"
            "if(opening){"
            "index.classList.add('open');"
            "var end=inner.scrollHeight;"
            "panel.style.overflow='hidden';"
            "panel.__anim=panel.animate([{height:'0px'},{height:end+'px'}],{duration:360,easing:'cubic-bezier(0.16,1,0.3,1)'});"
            "inner.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'cubic-bezier(0.16,1,0.3,1)'});"
            "panel.__anim.onfinish=function(){panel.style.height='';panel.style.overflow='';};"
            "}else{"
            "var start=panel.offsetHeight;"
            "panel.style.overflow='hidden';"
            "panel.__anim=panel.animate([{height:start+'px'},{height:'0px'}],{duration:280,easing:'cubic-bezier(0.16,1,0.3,1)'});"
            "panel.__anim.onfinish=function(){index.classList.remove('open');panel.style.height='';panel.style.overflow='';};"
            "}"
            "});"
        )
        html = html.replace(old_toggle, new_toggle, 1)
        changed.append("mobile nav toggle upgraded to WAAPI height animation")

    if "/* glass card system */" not in html:
        css_additions.append(
            "/* glass card system */"
            ".dossier-entry,.reference-record,.embedded-ref,.template-record,.lore-record,"
            ".media-item,.system-entry,.canon-law,.media-shelf,.peripheral-index-grid a,"
            ".source-text details,.warn,.media-note,.media-figure,.asset-toolbar,.index{"
            "background:rgba(11,20,32,.52);"
            "-webkit-backdrop-filter:blur(18px) saturate(1.4);"
            "backdrop-filter:blur(18px) saturate(1.4);"
            "border-color:rgba(120,220,238,.18);"
            "box-shadow:inset 0 1px 0 rgba(180,235,255,.07),0 20px 48px rgba(0,0,0,.32);"
            "transition:background-color .35s ease,border-color .35s ease}"
            ".peripheral-index-grid a:hover,.peripheral-index-grid a:focus-visible{"
            "background:rgba(16,28,42,.62);border-color:rgba(120,220,238,.4)}"
            "@media print{.dossier-entry,.reference-record,.embedded-ref,.template-record,"
            ".lore-record,.media-item,.system-entry,.canon-law,.media-shelf,"
            ".peripheral-index-grid a,.source-text details,.warn,.media-note,.media-figure,"
            ".asset-toolbar,.index{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}"
        )

    if css_additions:
        html = html.replace("</style>", "".join(css_additions) + "</style>", 1)
        changed.append(f"{len(css_additions)} CSS blocks added (nav groups, chevrons, mobile pop-out, glass cards)")

    INDEX.write_text(html, encoding="utf-8")
    print("Changes applied:")
    for c in changed:
        print(f"  - {c}")
    if not changed:
        print("  (none — already up to date)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
