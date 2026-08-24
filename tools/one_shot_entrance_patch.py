#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent

cover = '''<div class="hero-video-wrap"><video class="hero-video" autoplay muted playsinline preload="auto" poster="assets/media/09e2837c1e2a76bc1fadccc2.jpg" aria-hidden="true"><source src="assets/media/b3015054b3726a97adbc4a5c.mp4" type="video/mp4"/></video><div class="hero-video-fade"></div></div><div class="eyebrow">The all can be rewritten</div><h1 id="coverTitle" class="cover-title" data-default-title="Starsilk Compendium">Starsilk Compendium</h1><div class="edition-label">Web Edition</div><p class="cover-thesis">Reality has a substrate.</p><p class="deck">Starsilk is the programmable filament running through the all: executable cosmological matter that can rewrite reality itself. Pull it from the heart of a star and the star collapses. Write into it correctly and reality obeys.</p><p class="cover-consequence">Everything in this Compendium follows from what mortals, gods, empires, and survivors did once they learned that.</p><nav class="cover-entry-paths" aria-label="Begin exploring Starsilk"><a href="#world"><b>Begin with the universe</b><span>Starsilk, Macros, the Notebook Program, and what a star becomes when its filament is pulled.</span></a><a href="#shard-god"><b>Meet the characters</b><span>Shard-God Tiger, Codec, Dao, Kail, Marcel, Jazen, and the people caught in their systems.</span></a><a href="#beyond-wall"><b>Cross the Siege Wall</b><span>The Drakken, the war, the black-hole quarantine, and what survived on the far side.</span></a></nav>'''
(root / 'src/content/sections/cover.body.html').write_text(cover, encoding='utf-8')

shell_path = root / 'src/templates/shell.html.j2'
shell = shell_path.read_text(encoding='utf-8')
replacements = [
    (
        '<meta name="description" content="Starsilk Compendium — the Starsilk canon dossier: principal and peripheral character folios, the Drakken register, WorldsVault, and supporting lore material, plus faceted discovery, an entity index, a relationship observatory, a canon inspector, curated tours, and chronology."/>',
        '<meta name="description" content="Starsilk Compendium — a source-backed canon archive for a universe where reality has a programmable substrate: characters, wars, Drakken, WorldsVault, visual locks, and the systems that bind them."/>'
    ),
    (
        '<meta property="og:description" content="Principal and peripheral character dossiers, the Drakken register, canon chronology, and WorldsVault reference material, plus discovery, entities, relationships, canon, and tours."/>',
        '<meta property="og:description" content="A source-backed canon archive for a universe where reality is programmable: characters, wars, Drakken, WorldsVault, visual locks, and cosmological systems."/>'
    ),
    (
        '<meta name="twitter:description" content="Principal and peripheral character dossiers, the Drakken register, canon chronology, and WorldsVault reference material, plus discovery, entities, relationships, canon, and tours."/>',
        '<meta name="twitter:description" content="A source-backed canon archive for a universe where reality is programmable: characters, wars, Drakken, WorldsVault, visual locks, and cosmological systems."/>'
    ),
]
for old, new in replacements:
    if old not in shell:
        raise RuntimeError(f'missing shell marker: {old[:60]}')
    shell = shell.replace(old, new, 1)

entrance = '''{% if section.id == 'world' %}<div class="museum-entrance archive-junction" data-museum-shell="unified">
<section class="museum-hero archive-junction-shell" aria-labelledby="museum-hero-heading">
<div class="archive-junction-copy"><div class="eyebrow">Archive access</div><h2 id="museum-hero-heading">Choose a lens.</h2><p>The Compendium remains one canon record. These views expose the same material by identity, chronology, relation, media, and topology without inventing what the source does not say.</p></div>
<div class="museum-module-grid archive-lens-grid">
<a class="museum-module archive-lens" href="discover/"><span class="museum-module-eyebrow">Discover</span><h3>Search the record</h3><p>Filter stable records and source-backed excerpts.</p></a>
<a class="museum-module archive-lens" href="entities/"><span class="museum-module-eyebrow">Entities</span><h3>Open a folio</h3><p>Stable permalinks for every authored top-level record.</p></a>
<a class="museum-module archive-lens" href="objects/"><span class="museum-module-eyebrow">Objects</span><h3>See the evidence</h3><p>Published visual and media objects with provenance.</p></a>
<a class="museum-module archive-lens" href="relationships/"><span class="museum-module-eyebrow">Relationships</span><h3>Follow the references</h3><p>Only the cross-links the Compendium actually contains.</p></a>
<a class="museum-module archive-lens" href="canon/"><span class="museum-module-eyebrow">Canon</span><h3>Inspect the locks</h3><p>Machine-enforced protections for selected established facts.</p></a>
<a class="museum-module archive-lens" href="tours/"><span class="museum-module-eyebrow">Tours</span><h3>Take a route</h3><p>Curated paths plus private browser-local collections.</p></a>
<a class="museum-module archive-lens" href="chronology/"><span class="museum-module-eyebrow">Chronology</span><h3>Trace what happened</h3><p>Authored events, durations, and explicit unknowns.</p></a>
<a class="museum-module archive-lens" href="worldsvault/"><span class="museum-module-eyebrow">WorldsVault</span><h3>Read the topology</h3><p>Directly sourced cosmic relations without invented geography.</p></a>
</div>
<section class="museum-data-strip archive-machine-row" aria-labelledby="museum-data-heading"><div><div class="eyebrow">Machine access</div><h2 id="museum-data-heading">The same record, structured.</h2><p>Deterministic derivatives and orientation files for tools that need the Compendium without a visual interface.</p></div><div class="museum-data-links"><a href="agents/AGENT_GUIDE.md">Agent guide</a><a href="machine/index.json">Machine index</a><a href="llms.txt">llms.txt</a><a href="sitemap.xml">Sitemap</a></div></section>
<details class="archive-stats"><summary>Collection statistics</summary><dl class="museum-hero-stats" aria-label="Collection totals"><div><dt>Compendium records</dt><dd>{{ museum_stats.record_count }}</dd></div><div><dt>Published media objects</dt><dd>{{ museum_stats.object_count }}</dd></div><div><dt>Cross-referenced links</dt><dd>MUSEUM_LINK_COUNT_PLACEHOLDER</dd></div><div><dt>Chronology events</dt><dd>{{ museum_stats.event_count }}</dd></div><div><dt>Curated tours</dt><dd>{{ museum_stats.tour_count }}</dd></div><div><dt>Machine-enforced canon locks</dt><dd>{{ museum_stats.canon_lock_count }}</dd></div></dl></details>
</section>
</div>{% endif %}'''
pat = re.compile(r"\{% if section\.id == 'cover' %\}<div class=\"museum-entrance\" data-museum-shell=\"unified\">.*?</div>\{% endif %\}", re.S)
shell, n = pat.subn(entrance, shell, count=1)
if n != 1:
    raise RuntimeError(f'expected one old museum entrance block, replaced {n}')
shell_path.write_text(shell, encoding='utf-8')

app_path = root / 'src/templates/app.js'
app = app_path.read_text(encoding='utf-8')
marker = "  // ---------------------------------------------------------------------\n  // Hero video: autoplay, then loop just the tail\n  // ---------------------------------------------------------------------\n"
if marker not in app:
    raise RuntimeError('hero video marker missing in app.js')
if 'YOUR SKY IS BUILT FROM YOUR DEAD.' in app:
    raise RuntimeError('canon intrusion block already present')
intrusion = r'''  // ---------------------------------------------------------------------
  // Sparse canon intrusion: the archive briefly yields to the universe.
  // This is intentionally one substitution, not a repeated strobe. Under
  // reduced motion the same interruption is held steady instead of flashed.
  // ---------------------------------------------------------------------
  (function(){
    var title = document.getElementById('coverTitle');
    if(!title) return;
    var defaultTitle = title.getAttribute('data-default-title') || title.textContent;
    var quotes = [
      'YOUR SKY IS BUILT FROM YOUR DEAD.',
      "STARS DON'T BURN. THEY SURRENDER.",
      'SOLIDARITY, NOT SUPPLICATION.'
    ];
    var lastIndex = -1;
    var count = 0;
    var timer = null;
    var restoreTimer = null;
    var FIRST_MIN = 35000;
    var FIRST_SPAN = 10000;
    var NEXT_MIN = 38000;
    var NEXT_SPAN = 17000;
    var HOLD_MS = reduceMotion ? 1200 : 90;

    function pickIndex(){
      if(count === 0) return 0;
      if(quotes.length < 2) return 0;
      var idx = Math.floor(Math.random() * quotes.length);
      if(idx === lastIndex) idx = (idx + 1) % quotes.length;
      return idx;
    }
    function restore(){
      title.textContent = defaultTitle;
      title.classList.remove('is-canon-intrusion');
    }
    function schedule(first){
      clearTimeout(timer);
      var base = first ? FIRST_MIN : NEXT_MIN;
      var span = first ? FIRST_SPAN : NEXT_SPAN;
      timer = setTimeout(showIntrusion, base + Math.floor(Math.random() * span));
    }
    function showIntrusion(){
      if(document.hidden){
        schedule(false);
        return;
      }
      var idx = pickIndex();
      lastIndex = idx;
      count += 1;
      title.textContent = quotes[idx];
      title.classList.add('is-canon-intrusion');
      clearTimeout(restoreTimer);
      restoreTimer = setTimeout(function(){
        restore();
        schedule(false);
      }, HOLD_MS);
    }
    document.addEventListener('visibilitychange', function(){
      if(document.hidden){
        clearTimeout(timer);
        clearTimeout(restoreTimer);
        restore();
      } else {
        schedule(false);
      }
    });
    schedule(true);
  })();

'''
app_path.write_text(app.replace(marker, intrusion + marker, 1), encoding='utf-8')

style_path = root / 'src/templates/style.css'
style = style_path.read_text(encoding='utf-8')
if '/* Starsilk-first threshold:' in style:
    raise RuntimeError('entrance style block already present')
additions = r'''

/* Starsilk-first threshold: lore premise before archive machinery. */
.cover-title{min-height:clamp(2.2rem,7vw,7rem)}
.cover-title.is-canon-intrusion{color:#ff4054;font:900 clamp(.9rem,3.6vw,3.6rem)/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.045em;text-transform:uppercase;white-space:nowrap;max-width:none;text-shadow:0 0 18px rgba(255,64,84,.24)}
.cover-thesis{font:500 clamp(1.45rem,3.2vw,2.6rem)/1.1 ui-serif,Georgia,serif;color:#f4f8fa;margin:0 0 .75rem;max-width:28rem}
.cover-consequence{max-width:43rem;color:#90a8b8;font-size:clamp(.95rem,1.45vw,1.08rem);margin:1rem 0 0}
.cover-entry-paths{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin:2rem 0 0;max-width:64rem}
.cover-entry-paths a{display:flex;flex-direction:column;gap:.35rem;min-height:8.5rem;padding:1rem 1.05rem;background:#09131e;border:1px solid #23394b;border-top:2px solid #2b829a;text-decoration:none;color:#d9eef6}
.cover-entry-paths a:hover,.cover-entry-paths a:focus-visible{border-color:var(--thread);background:#0c1b29;outline:2px solid transparent}
.cover-entry-paths b{font:800 .78rem/1.25 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--thread2)}
.cover-entry-paths span{font-size:.86rem;line-height:1.45;color:#9fb1bf}
.cover .cover-thesis,.cover .cover-consequence,.cover .cover-entry-paths{animation:coverTextIn .5s ease-out .85s both}

/* Archive systems remain fully discoverable, but only after the reader has
   encountered the first cosmology folio. This is a junction, not a second hero. */
.archive-junction{border-top:1px solid #101927;border-bottom:1px solid #101927;background:#060a11}
.archive-junction .museum-hero{padding:clamp(2.2rem,5vw,4rem) var(--page-pad);display:grid;gap:1.4rem}
.archive-junction-copy{max-width:48rem}
.archive-junction-copy h2{font-size:clamp(2rem,4vw,3.6rem);line-height:.95;letter-spacing:-.035em;margin:.45rem 0 .8rem}
.archive-junction-copy p{max-width:43rem;color:#9fb1bf;margin:0}
.archive-junction .museum-module-grid{grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:1px;background:#182636;border:1px solid #182636;border-radius:0;overflow:hidden}
.archive-junction .museum-module{border:0;border-radius:0;background:#09111b;min-height:8rem;padding:1rem;transform:none}
.archive-junction .museum-module:hover,.archive-junction .museum-module:focus-visible{background:#0d1a28;transform:none;box-shadow:inset 0 0 0 1px var(--thread)}
.archive-junction .museum-module h3{font-size:1rem}
.archive-junction .museum-data-strip{margin:0;padding:1rem 1.1rem;border-radius:0;background:#0a1019}
.archive-junction .museum-data-strip h2{font-size:1.05rem}
.archive-stats{border-top:1px solid #1d2b3a;padding-top:.2rem}
.archive-stats summary{cursor:pointer;width:fit-content;padding:.55rem 0;color:#7f97a8;font:700 .72rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase}
.archive-stats summary:hover,.archive-stats summary:focus-visible{color:var(--thread);outline:none}
.archive-stats .museum-hero-stats{margin-top:.6rem}

@media(max-width:700px){.cover-entry-paths{grid-template-columns:1fr}.cover-entry-paths a{min-height:0}.archive-junction .museum-hero{padding-left:var(--page-pad);padding-right:var(--page-pad)}.cover-title.is-canon-intrusion{font-size:clamp(.82rem,3.7vw,1rem);letter-spacing:.02em}}
@media(prefers-reduced-motion: reduce){.cover .cover-thesis,.cover .cover-consequence,.cover .cover-entry-paths{animation:none;opacity:1;transform:none}.cover-title.is-canon-intrusion{text-shadow:none}}
@media print{.cover .cover-thesis,.cover .cover-consequence,.cover .cover-entry-paths{animation:none;opacity:1;transform:none}.archive-junction{display:none!important}}
'''
style_path.write_text(style.rstrip() + additions + '\n', encoding='utf-8')

(root / 'tests/test_entrance_intrusion.py').write_text(r'''import re
from pathlib import Path

from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def test_starsilk_first_cover_and_archive_placement():
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    assert "Reality has a substrate." in html
    assert "Starsilk is the programmable filament running through the all" in html
    assert "Six principal character dossiers" not in html
    assert "One Compendium.<br/>Nine ways in." not in html
    assert html.index('id="cover"') < html.index('id="world"') < html.index('class="museum-entrance archive-junction"') < html.index('id="chronology"')
    for href in ('#world', '#shard-god', '#beyond-wall'):
        assert f'href="{href}"' in html


def test_archive_junction_preserves_every_major_system():
    html = (DOCS / "index.html").read_text(encoding="utf-8")
    for system in ("discover", "entities", "objects", "relationships", "canon", "tours", "chronology", "worldsvault"):
        assert f'href="{system}/"' in html
    assert 'class="museum-data-strip archive-machine-row"' in html
    assert '<summary>Collection statistics</summary>' in html


def test_canon_intrusion_runtime(page: Page, local_server):
    page.add_init_script("""() => {
      const realSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (fn, delay, ...args) => {
        if (delay >= 35000) return realSetTimeout(fn, 20, ...args);
        if (delay === 90) return realSetTimeout(fn, 1500, ...args);
        return realSetTimeout(fn, delay, ...args);
      };
    }""")
    page.goto(f"{local_server}/index.html")
    title = page.locator("#coverTitle")
    expect(title).to_have_text("YOUR SKY IS BUILT FROM YOUR DEAD.", timeout=2500)
    expect(title).to_have_class(re.compile(r"\bis-canon-intrusion\b"))
    color = title.evaluate("el => getComputedStyle(el).color")
    assert color.startswith("rgb(") and color != "rgb(237, 247, 251)"
    expect(title).to_have_text("Starsilk Compendium", timeout=4500)
    expect(title).not_to_have_class(re.compile(r"\bis-canon-intrusion\b"))


def test_canon_intrusion_reduced_motion_is_steady(page: Page, local_server):
    page.emulate_media(reduced_motion="reduce")
    page.add_init_script("""() => {
      const realSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (fn, delay, ...args) => {
        if (delay >= 35000) return realSetTimeout(fn, 20, ...args);
        if (delay === 1200) return realSetTimeout(fn, 2500, ...args);
        return realSetTimeout(fn, delay, ...args);
      };
    }""")
    page.goto(f"{local_server}/index.html")
    title = page.locator("#coverTitle")
    expect(title).to_have_text("YOUR SKY IS BUILT FROM YOUR DEAD.", timeout=2500)
    page.wait_for_timeout(500)
    expect(title).to_have_text("YOUR SKY IS BUILT FROM YOUR DEAD.")
    assert title.evaluate("el => getComputedStyle(el).textShadow") == "none"
''', encoding='utf-8')
