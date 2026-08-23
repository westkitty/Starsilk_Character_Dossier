#!/usr/bin/env python3
"""Add a top-of-content control bar to the Web Edition: Expand all /
Collapse all buttons for the default-collapsed page sections, a content
search box that finds and opens matching sections regardless of collapsed
state, and a toggle to hide/show the fixed left index sidebar.

The sidebar's own "Filter dossier" search only ever filtered nav *links* --
useful for finding a section by name, but blind to the actual dossier text
now that page bodies default to collapsed. This adds a second, independent
search that scans real section content and expands/highlights matches.
The sidebar toggle exists because hiding the sidebar would otherwise hide
its search box along with it -- the new controls live outside the sidebar
so they stay reachable regardless of its visibility.

Depends on apply_media_presentation_and_collapse.py having already run
(needs details.page-disclosure to exist). Idempotent: safe to re-run.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"

CSS_MARKER = "/* Top-of-content controls (expand/collapse all, content search, sidebar toggle) */"

CSS_ADDITION = """
/* Top-of-content controls (expand/collapse all, content search, sidebar toggle) */
.page-controls{position:sticky;top:0;z-index:15;display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;padding:.75rem var(--page-pad);background:rgba(5,7,13,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid #213145}
@media(min-width:951px){.page-controls{padding-left:clamp(18rem,20vw,22rem)}}
html.sidebar-collapsed .page-controls{padding-left:var(--page-pad)}
html.sidebar-collapsed .index{display:none}
@media(min-width:951px){html.sidebar-collapsed .page{padding-left:var(--page-pad)}}
.page-controls button{min-height:44px;padding:.5rem 1rem;background:#102234;border:1px solid #2b4966;color:#d9f3ff;border-radius:4px;font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;flex:0 0 auto}
.page-controls button:hover,.page-controls button:focus-visible{background:#16324e;border-color:var(--thread);outline:none}
.page-controls-search{display:flex;align-items:center;gap:.5rem;flex:1 1 14rem;min-width:10rem}
.page-controls-search input{width:100%;min-height:44px;padding:.5rem .75rem;background:#0a121c;border:1px solid #223347;color:#e6f3fb;border-radius:4px;font-size:.85rem}
.page-controls-search input:focus-visible{outline:2px solid var(--thread);outline-offset:1px}
#contentSearchStatus{font-size:.72rem;color:#8fa8b8;white-space:nowrap;flex:0 0 auto}
details.page-disclosure.search-match{outline:2px solid var(--thread);outline-offset:3px;border-radius:2px}
@media(max-width:700px){.page-controls{padding-left:var(--page-pad)!important}.page-controls button{flex:1 1 auto}}
""".rstrip("\n")

HTML_MARKER = 'id="expandAllBtn"'

CONTROLS_HTML = (
    '<div class="page-controls">'
    '<button type="button" id="expandAllBtn">Expand all</button>'
    '<button type="button" id="collapseAllBtn">Collapse all</button>'
    '<button type="button" id="sidebarToggle" aria-expanded="true" aria-controls="index">Hide index</button>'
    '<div class="page-controls-search">'
    '<label for="contentSearch" class="visually-hidden">Search dossier content</label>'
    '<input type="search" id="contentSearch" placeholder="Search dossier content&#8230;" '
    'aria-label="Search dossier content" autocomplete="off"/>'
    '<span id="contentSearchStatus" role="status" aria-live="polite"></span>'
    '</div>'
    '</div>'
)

JS_MARKER = "// Top-of-content controls: expand/collapse all, content search, sidebar toggle"

CONTROLS_JS = """
  // Top-of-content controls: expand/collapse all, content search, sidebar toggle
  (function(){
    var expandAllBtn = document.getElementById('expandAllBtn');
    var collapseAllBtn = document.getElementById('collapseAllBtn');
    if(expandAllBtn){
      expandAllBtn.addEventListener('click', function(){
        document.querySelectorAll('details.page-disclosure').forEach(function(d){ d.open = true; });
      });
    }
    if(collapseAllBtn){
      collapseAllBtn.addEventListener('click', function(){
        document.querySelectorAll('details.page-disclosure').forEach(function(d){ d.open = false; });
      });
    }

    var sidebarToggle = document.getElementById('sidebarToggle');
    if(sidebarToggle){
      var STORAGE_KEY = 'starsilk-sidebar-collapsed';
      var setCollapsed = function(collapsed){
        document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
        sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
        sidebarToggle.textContent = collapsed ? 'Show index' : 'Hide index';
        try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch(e){}
      };
      sidebarToggle.addEventListener('click', function(){
        setCollapsed(!document.documentElement.classList.contains('sidebar-collapsed'));
      });
      var initial = false;
      try { initial = localStorage.getItem(STORAGE_KEY) === '1'; } catch(e){}
      if(initial) setCollapsed(true);
    }

    var searchInput = document.getElementById('contentSearch');
    if(searchInput){
      var status = document.getElementById('contentSearchStatus');
      var pages = Array.prototype.slice.call(document.querySelectorAll('main#mainContent > section.page[id]'))
        .filter(function(p){ return !p.classList.contains('cover'); });
      var matches = [];
      var matchIndex = -1;

      var clearHighlights = function(){
        pages.forEach(function(p){
          var d = p.querySelector(':scope > details.page-disclosure');
          if(d) d.classList.remove('search-match');
        });
      };

      var runSearch = function(q){
        clearHighlights();
        matches = [];
        matchIndex = -1;
        if(!q){ if(status) status.textContent = ''; return; }
        var needle = q.toLowerCase();
        pages.forEach(function(p){
          if(p.textContent.toLowerCase().indexOf(needle) !== -1){
            var d = p.querySelector(':scope > details.page-disclosure');
            if(d){
              d.open = true;
              d.classList.add('search-match');
            }
            matches.push(p);
          }
        });
        if(status){
          status.textContent = matches.length
            ? matches.length + ' section' + (matches.length === 1 ? '' : 's') + ' match \\u2014 Enter to jump'
            : 'No matches';
        }
      };

      var goToMatch = function(dir){
        if(!matches.length) return;
        matchIndex = (matchIndex + dir + matches.length) % matches.length;
        matches[matchIndex].scrollIntoView({block:'start', behavior:'auto'});
      };

      var debounceTimer;
      searchInput.addEventListener('input', function(){
        clearTimeout(debounceTimer);
        var q = searchInput.value.trim();
        debounceTimer = setTimeout(function(){ runSearch(q); }, 120);
      });
      searchInput.addEventListener('keydown', function(e){
        if(e.key === 'Enter'){
          e.preventDefault();
          goToMatch(e.shiftKey ? -1 : 1);
        }
      });
    }
  })();
"""


def apply_css(html: str) -> str:
    if CSS_MARKER in html:
        return html
    return html.replace("</style>", CSS_ADDITION + "\n</style>", 1)


def apply_print_hide(html: str) -> str:
    old = '.index,#menuToggle,.skip-link,.asset-toolbar,#brandkit-watermark,video,.media-video,input,.visually-hidden{display:none!important}'
    if ".index,.page-controls," in html:
        return html
    if old not in html:
        print("WARNING: print hide-list rule not found; .page-controls will show up in print.")
        return html
    new = old.replace(
        ".index,#menuToggle,",
        ".index,.page-controls,#menuToggle,",
    )
    return html.replace(old, new, 1)


def apply_html(html: str) -> str:
    if HTML_MARKER in html:
        return html
    anchor = '<main id="mainContent" tabindex="-1">'
    if anchor not in html:
        print("WARNING: <main id=\"mainContent\"> anchor not found; controls bar not inserted.")
        return html
    return html.replace(anchor, anchor + CONTROLS_HTML, 1)


def apply_js(html: str) -> str:
    if JS_MARKER in html:
        return html
    tail = "</script>\n</body></html>"
    if tail not in html:
        print("WARNING: end-of-body script anchor not found; controls JS not added.")
        return html
    return html.replace(tail, CONTROLS_JS + tail, 1)


def main() -> int:
    if not INDEX.exists():
        print(f"ERROR: {INDEX} not found", file=sys.stderr)
        return 1
    html = INDEX.read_text(encoding="utf-8")
    if 'details class="page-disclosure"' not in html:
        print("ERROR: no page-disclosure sections found; run apply_media_presentation_and_collapse.py first.", file=sys.stderr)
        return 1
    html = apply_css(html)
    html = apply_print_hide(html)
    html = apply_html(html)
    html = apply_js(html)
    INDEX.write_text(html, encoding="utf-8")
    print(f"Wrote {INDEX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
