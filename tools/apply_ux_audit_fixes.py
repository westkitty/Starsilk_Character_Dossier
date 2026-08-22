#!/usr/bin/env python3
"""Authoritative, idempotent UX/UI audit repair script for Starsilk Character Dossier.
Implements findings UX-001 through UX-028:
- UX-001 / UX-004 / UX-005: Scoped attachment stages, remove duplicate wrapper focus stops, safe initialization.
- UX-002: Truthful 'Export HTML copy' labeling and companion media disclaimer.
- UX-003: Attachment data-loss model (confirm before clear, beforeunload warning, transient).
- UX-006: Accessible inline error on invalid file formats (PNG, JPEG, WebP, GIF only).
- UX-007: Accessible live status announcement (role="status" aria-live="polite") with truthful slot totals.
- UX-008: Desktop index viewport safety and scrolling.
- UX-009: 951-1366px sidebar collision elimination (>= 18rem page left-padding).
- UX-010: Mobile nav accessibility (aria-expanded, aria-controls, stable indexPanel ID).
- UX-011: Keyboard-accessible skip link targeting main.
- UX-012: ~44x44px touch targets on interactive controls.
- UX-013: Current location wayfinding (IntersectionObserver with aria-current="location").
- UX-014: Navigation order fix (Reference 17/18 before Peripheral 19-26).
- UX-015: Lightweight, local, keyboard-accessible quick find in index.
- UX-016: Complete prefers-reduced-motion handling (no smooth scroll, no WAAPI accordion, no watermark video autoplay).
- UX-017 / UX-018: Elevated metadata contrast (>= 4.5:1 ratio) and microtype repair (>= .72rem/.75rem).
- UX-019: Mobile focus management after navigation (closes menu, syncs aria-expanded, moves focus to section heading).
- UX-020: Preserved distinct warning semantics on .warn.
- UX-021: Backdrop blur compositing optimization (restrained to shell, opaque cards).
- UX-022: Complete print stylesheet using real project classes, black-on-white, expanded details.
- UX-023: Truthful Web Edition copy referencing companion media archive.
- UX-024: Removal of internal tooling jargon ("not mounted in this artifact session").
- UX-025: Subtle Web Edition identity badge.
- UX-026: Idempotent loading="lazy" and decoding="async" on content images.
- UX-027: Watermark video lifecycle (respects reduced-motion, pauses when document hidden).
- UX-028: Context-informed descriptive alt text improvements.

ORDERING NOTE: this script fully replaces the entire <style> block and every
<script> block trailing the brandkit watermark video (see the final re.sub
call below) with its own known set, rather than appending to what's there.
Anything added by a script that runs AFTER this one -- e.g.
apply_media_presentation_and_collapse.py's CSS additions and its
end-of-body anchor-expand/print-handling <script> -- will be silently
deleted if this script is re-run afterward. tools/build.sh's ordering
(this script, then apply_media_presentation_and_collapse.py, then
finalize_metadata.py) is the only sanctioned sequence; don't invoke this
script standalone on an already-fully-built docs/index.html.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
INDEX = DOCS / "index.html"

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


STYLESHEET = """
:root{--void:#05070d;--ink:#090d16;--panel:#0d1320;--panel2:#111927;--line:#27374b;--thread:#55dfff;--thread2:#a6efff;--red:#d95d6c;--yellow:#e4bd46;--green:#7dbf82;--scarf:#d94a54;--blue:#4ba7db;--silver:#c9d5df;--muted:#8fa8b8;--paper:#eef3f6;--black:#0a0c10;--page-pad:clamp(1.2rem,3vw,3.25rem)}
*{box-sizing:border-box}html{scroll-behavior:smooth;background:var(--void)}body{margin:0;background:var(--void);color:#edf7fb;font:16px/1.55 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit}button,input{font:inherit}::selection{background:#55dfff;color:#071018}
body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.42;background:radial-gradient(circle at 12% 18%,rgba(85,223,255,.11) 0 1px,transparent 1.8px),radial-gradient(circle at 78% 32%,rgba(255,255,255,.12) 0 1px,transparent 1.5px),radial-gradient(circle at 51% 73%,rgba(85,223,255,.08) 0 1px,transparent 1.3px);background-size:113px 113px,167px 167px,223px 223px}

/* Skip link (UX-011) */
.skip-link{position:fixed;top:-100px;left:1rem;z-index:9999;padding:.6rem 1.1rem;background:var(--thread);color:var(--void);font:700 .85rem/1.2 ui-sans-serif,system-ui,sans-serif;border-radius:4px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.6);transition:top .2s ease}
.skip-link:focus,.skip-link:focus-visible{top:1rem;outline:2px solid #fff}

/* Index shell & viewport safety (UX-008, UX-009, UX-012, UX-015, UX-021) */
.index{position:fixed;z-index:20;left:1rem;top:1rem;width:min(15rem,calc(100vw - 2rem));max-height:calc(100vh - 2rem);display:flex;flex-direction:column;background:rgba(5,7,13,.92);border:1px solid #213145;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 18px 50px rgba(0,0,0,.45)}
.index-head{display:flex;align-items:center;justify-content:space-between;padding:.72rem .8rem;border-bottom:1px solid #213145;flex:0 0 auto}
.index-head b{letter-spacing:.16em;text-transform:uppercase;font-size:.75rem;color:var(--thread2)}
#menuToggle{display:none;background:none;color:#fff;border:1px solid #31475c;border-radius:4px;padding:.35rem .6rem;min-height:44px;min-width:44px;align-items:center;justify-content:center;cursor:pointer}
.index-panel{overflow-y:auto;overscroll-behavior:contain;flex:1 1 auto}
.index-panel-inner{display:flex;flex-direction:column}
.index-search-wrap{padding:.45rem .6rem;border-bottom:1px solid rgba(120,220,238,.12)}
.index-search-wrap input{width:100%;padding:.45rem .6rem;min-height:36px;background:#080d16;border:1px solid #24384d;border-radius:4px;color:#edf7fb;font-size:.78rem;outline:none}
.index-search-wrap input:focus{border-color:var(--thread);box-shadow:0 0 0 1px var(--thread)}
.index-search-wrap input::placeholder{color:#6c8294}
.index nav{display:grid;padding:.35rem .45rem}
.index a{text-decoration:none;padding:.5rem .55rem;border-left:2px solid transparent;color:#9fb1bf;font-size:.82rem;min-height:38px;display:flex;align-items:center}
.index a:hover,.index a:focus{color:#fff;border-left-color:var(--thread);background:#0d1622}
.index a[aria-current="location"],.index a.active{color:var(--thread);border-left-color:var(--thread);background:rgba(85,223,255,.08);font-weight:700}
.index small{display:block;padding:.4rem .8rem .8rem;color:#8fa8b8;font-size:.72rem;flex:0 0 auto}
.visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}

/* Main page layout & sidebar clearance (UX-009) */
.page{position:relative;min-height:100vh;padding:var(--page-pad);display:flex;flex-direction:column;justify-content:center;border-bottom:1px solid #101927;isolation:isolate}
@media(min-width:951px){.page{padding-left:clamp(18rem,20vw,22rem)}}
.page:after{content:attr(data-folio);position:absolute;right:var(--page-pad);top:var(--page-pad);font:700 .75rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;color:#8fa8b8}

.cover{overflow:hidden;background:#07101b}
.cover:before{content:"";position:absolute;width:55vw;height:55vw;right:-13vw;top:-13vw;border:1px solid rgba(85,223,255,.22);border-radius:50%;box-shadow:0 0 0 4vw rgba(85,223,255,.018),0 0 0 9vw rgba(85,223,255,.012)}

/* Edition label (UX-025) */
.edition-label{display:inline-flex;align-items:center;padding:.25rem .6rem;background:rgba(85,223,255,.08);border:1px solid rgba(85,223,255,.3);border-radius:3px;font:700 .75rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.15em;text-transform:uppercase;color:var(--thread);margin-bottom:1.25rem;width:fit-content}

/* Typography, metadata luminance & microtype (UX-017, UX-018) */
.eyebrow{font:800 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.22em;text-transform:uppercase;color:var(--thread)}
h1,h2,h3,p{margin-top:0}
h1{font-size:clamp(4rem,9vw,8.5rem);line-height:.79;letter-spacing:-.075em;margin:.8rem 0 1.4rem;max-width:9ch}
h1 span{display:block;color:transparent;-webkit-text-stroke:1px #98bfd0;font-size:.58em;letter-spacing:-.04em}
.deck{max-width:46rem;font-size:clamp(1.05rem,2vw,1.45rem);color:#b7c8d3}
.cover-rule{width:min(42rem,80%);height:1px;background:var(--thread);margin:2rem 0;opacity:.65}
.tag-row{display:flex;flex-wrap:wrap;gap:.5rem}
.tag{border:1px solid #2a3d4d;padding:.35rem .55rem;font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em;color:#a9bbc8;background:#07111b}

.page-title{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2rem;align-items:end;border-bottom:1px solid #223245;padding-bottom:1.25rem;margin-bottom:1.5rem}
.page-title h2{font-size:clamp(2.5rem,6vw,5.5rem);line-height:.9;letter-spacing:-.055em;margin:.35rem 0 0}
.page-title .role{text-align:right;max-width:24rem;color:#9fb0bd;font-size:.9rem}
.character-code{font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase}

.tiger{--accent:#4fe6ff}
.codec{--accent:#59dfff}
.dao{--accent:var(--yellow)}
.kail{--accent:var(--scarf)}
.marcel{--accent:var(--green)}
.jazen{--accent:#ff7676}
.character-page .eyebrow,.character-page .character-code,.character-page h3{color:var(--accent)}
.character-page .page-title{border-bottom-color:color-mix(in srgb,var(--accent) 35%,#223245)}

.dossier-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(16rem,.85fr);gap:1rem;align-items:start}
.stack{display:grid;gap:1rem}

/* Content cards & opaque compositing (UX-021) */
.dossier-entry,.reference-record,.embedded-ref,.template-record,.lore-record,.media-item,.system-entry,.canon-law,.peripheral-index-grid a,.source-text details,.media-note,.media-figure{background:#0c1420;border:1px solid #223347;padding:1.05rem 1.1rem;box-shadow:0 12px 32px rgba(0,0,0,.22);transition:border-color .25s ease}
.dossier-entry h3{font:800 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.15em;margin:0 0 .75rem;color:var(--thread)}
.dossier-entry p:last-child,.dossier-entry ul:last-child{margin-bottom:0}
.dossier-entry ul{margin:.15rem 0 0;padding-left:1.1rem}
.dossier-entry li{margin:.28rem 0}
.quote{font:500 clamp(1.3rem,2.4vw,2rem)/1.25 ui-serif,Georgia,serif;border-left:2px solid var(--accent,var(--thread));padding:.3rem 0 .3rem 1rem;color:#f2f6f8}
.subtle{color:#a0b5c4}
.status{display:grid;grid-template-columns:auto 1fr;gap:.4rem .8rem;font-size:.84rem}
.status dt{font:700 .75rem/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em;color:#8fa8b8}
.status dd{margin:0;color:#d9e6ee}

.grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}
.ref-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.85rem}
.reference-record{margin:0;padding:.75rem}
.reference-record figcaption{padding-top:.55rem;font-size:.78rem;color:#8fa8b8;line-height:1.35}
.reference-record figcaption b{display:block;color:#d5e5f0;font-size:.82rem;margin-bottom:.15rem}

/* Attachment Stage & Accessible Native File Input (UX-001, UX-004, UX-005, UX-006) */
.image-stage{position:relative;background:#050a10;border:1px solid #1a2a3a;min-height:14rem;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:4px}
.image-stage img{display:block;width:100%;height:100%;max-height:60vh;object-fit:contain;background:#03060a}
.attachment-stage{border:1px dashed #28425a;cursor:pointer}
.attachment-stage:hover{border-color:var(--thread)}
.attachment-stage:focus-within{outline:2px solid var(--thread);border-color:var(--thread)}
.attachment-stage .asset-file{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;z-index:2}
.image-empty{display:grid;place-items:center;text-align:center;gap:.35rem;padding:1.25rem;color:#7890a2;pointer-events:none}
.asset-number{font:800 .75rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--thread);letter-spacing:.14em}
.image-empty strong{color:#e6f3fb;font-size:.88rem}
.image-empty span{font-size:.78rem;max-width:22ch;line-height:1.35}
.image-empty em{font-style:normal;font-size:.72rem;color:#5a7384}
.attachment-error{position:absolute;bottom:0;left:0;right:0;background:#350c12;color:#ff9fa9;border-top:1px solid #d94a54;padding:.4rem .6rem;font-size:.75rem;z-index:3;text-align:center}

/* Asset Toolbar (UX-002, UX-007, UX-012, UX-021) */
.asset-toolbar{position:sticky;bottom:1rem;display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;padding:.75rem 1rem;background:rgba(8,14,24,.92);border:1px solid #284058;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-radius:6px;box-shadow:0 12px 36px rgba(0,0,0,.45);margin-top:1.5rem}
.asset-toolbar button{min-height:44px;padding:.5rem 1rem;background:#102234;border:1px solid #2b4966;color:#d9f3ff;border-radius:4px;font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
.asset-toolbar button:hover,.asset-toolbar button:focus-visible{background:#16324e;border-color:var(--thread);outline:none}
#assetStatus{font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fa8b8;letter-spacing:.08em;text-transform:uppercase}

/* Preserved distinct Warning Semantics (UX-020) */
.warn{border-left:3px solid #e4bd46;background:#17140b;color:#e8dcb8;padding:.85rem 1.1rem;font-size:.85rem;line-height:1.45;margin-bottom:1rem}
.warn b{color:#ffdf70}

.timeline{display:grid;gap:1.25rem;border-left:1px solid #213247;padding-left:1.25rem;margin:.5rem 0 0 .5rem}
.phase{position:relative}
.phase:before{content:"";position:absolute;left:calc(-1.25rem - 4.5px);top:.35rem;width:8px;height:8px;border-radius:50%;background:var(--thread);box-shadow:0 0 10px var(--thread)}
.phase-meta{font:700 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--thread);margin-bottom:.25rem}
.phase h3{margin:0 0 .35rem;font-size:1.15rem}
.phase p{font-size:.9rem;color:#b4c6d2}

.peripheral-page{--accent:#70e7ff;justify-content:flex-start;padding-top:clamp(5rem,7vw,7rem)}
.peripheral-page .page-title{border-bottom-color:color-mix(in srgb,var(--accent) 36%,#223245)}
.peripheral-index-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;align-items:stretch}
.peripheral-index-grid a{display:block;text-decoration:none;color:#d9eef6;background:#09131e;border:1px solid #23394b;border-left:2px solid #2b829a;padding:.8rem .85rem;min-height:5.4rem}
.peripheral-index-grid a:hover,.peripheral-index-grid a:focus-visible{border-color:#54dff8;background:#0c1b29;outline:none}
.peripheral-index-grid b{display:block;color:#67e4fb;font:800 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.28rem}
.peripheral-index-grid span{font-size:.8rem;color:#a0b5c4;line-height:1.4}

.template-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem}
.template-record{background:#09121c;border:1px solid #213649;padding:.82rem .9rem;display:flex;gap:.6rem;align-items:flex-start}
.template-record b{display:block;color:#dff9ff;margin-bottom:.3rem}
.template-record span{color:#a0b5c4;font-size:.82rem;line-height:1.45}
.template-thumb{width:3.4rem;height:3.4rem;object-fit:cover;border:1px solid #213649;flex:0 0 auto;background:#000}

.media-stack{display:grid;gap:1rem;max-width:82rem}
.media-figure{margin:0;border:1px solid #284054;background:#07101a}
.media-figure img{display:block;width:100%;height:auto;max-height:85vh;object-fit:contain;background:#02060a}
.media-video{width:100%;max-height:78vh;display:block;background:#000}
.media-note{border-left:2px solid #d9a21b;background:#17140b;padding:.85rem 1rem;color:#d8c998;font-size:.84rem}
.gallery-wide .ref-grid{grid-template-columns:repeat(2,minmax(0,1fr));max-width:90rem}
.gallery-wide .image-stage{min-height:21rem}
.gallery-wide .image-stage img{display:block;width:100%;height:100%;max-height:70vh;object-fit:contain;background:#04070b}
.rule-list{columns:2;column-gap:2rem}
.rule-list li{break-inside:avoid}

.drakken-registry-page{--accent:#66e7ff}.drakken-registry-page h3,.drakken-registry-page .eyebrow{color:var(--accent)}
.drakken-page{--accent:#66e7ff}.drakken-page[data-archetype="genesis"]{--accent:#8ef4ff}.drakken-page[data-archetype="crust-binder"]{--accent:#c7ad7c}.drakken-page[data-archetype="atmos-engine"]{--accent:#a8e9ff}.drakken-page[data-archetype="seedcarrier"]{--accent:#88d59a}.drakken-page[data-archetype="fluxborne"]{--accent:#55cfe8}.drakken-page[data-archetype="orbital-wyrm"]{--accent:#a693ff}.drakken-page[data-archetype="civiformer"]{--accent:#e5a56a}.drakken-page[data-archetype="noosphere-cantor"]{--accent:#df86ff}.drakken-page[data-archetype="glitch-touched"]{--accent:#ff6fd0}

.media-vault-page{--accent:#54dfff;background:linear-gradient(180deg,#071018 0,#060b10 55%,#08090d 100%)}
.media-vault-page .page-title{border-bottom-color:rgba(84,223,255,.3)}
.media-shelf{margin:1rem 0 1.35rem;border:1px solid rgba(120,220,238,.22);background:rgba(2,11,17,.72);border-radius:14px;overflow:hidden}
.media-shelf>summary{cursor:pointer;list-style:none;padding:1rem 1.1rem;font:800 .82rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#b9f5ff;border-bottom:1px solid rgba(120,220,238,.14);display:flex;justify-content:space-between;gap:1rem;min-height:44px;align-items:center}
.media-shelf>summary::-webkit-details-marker{display:none}
.media-shelf>summary span{color:rgba(185,245,255,.55);font-weight:600;white-space:nowrap}
.media-shelf:not([open])>summary{border-bottom:0}
.media-ref-grid{padding:1rem;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}
.media-item{background:#04090e;border-color:rgba(110,220,240,.2);min-width:0}
.media-item .image-stage{min-height:220px;background:#010408}
.media-item img{width:100%;height:auto;max-height:680px;object-fit:contain;display:block}
.media-item video{display:block;width:100%;max-height:680px;background:#000;aspect-ratio:16/9;object-fit:contain}
.media-item figcaption{display:flex;flex-direction:column;gap:.35rem;padding:.8rem .9rem .95rem}
.media-item figcaption strong{font-size:.82rem;color:#d9fbff}
.media-item figcaption span{font-size:.75rem;line-height:1.45;color:rgba(215,244,250,.7)}
.blood-shelf{border-color:rgba(221,77,77,.28)}.blood-shelf>summary{color:#ffd0d0}
.drakken-shelf{border-color:rgba(134,198,150,.26)}.drakken-shelf>summary{color:#d9f3d5}
.media-index-note{margin-top:1rem}

#brandkit-watermark{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;opacity:.24;pointer-events:none;z-index:0}

.nav-group{border:0;border-top:1px solid rgba(120,220,238,.14)}
.nav-group:first-child{border-top:0}
.nav-group>summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.6rem .8rem;font:800 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8fb4c4;min-height:44px}
.nav-group>summary::-webkit-details-marker{display:none}
.nav-group>summary:hover{color:#dff9ff}
.nav-group .chevron{width:.55rem;height:.55rem;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);transition:transform .32s cubic-bezier(.16,1,.3,1);flex:0 0 auto;opacity:.7}
.nav-group[open]>summary .chevron{transform:rotate(-135deg)}
.nav-group-body{display:grid;overflow:hidden;padding:0 .45rem .35rem}
.media-shelf>summary{gap:.5rem}
.media-shelf .chevron{width:.6rem;height:.6rem;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg);transition:transform .32s cubic-bezier(.16,1,.3,1);flex:0 0 auto;opacity:.75;margin-left:.35rem}
.media-shelf[open]>summary .chevron{transform:rotate(-135deg)}

@media(max-width:1100px){.peripheral-index-grid,.template-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.peripheral-index-grid,.template-grid,.gallery-wide .ref-grid{grid-template-columns:1fr}.rule-list{columns:1}.gallery-wide .image-stage{min-height:14rem}}
@media(max-width:700px){.media-ref-grid{grid-template-columns:1fr}.media-shelf>summary{font-size:.74rem}.media-item .image-stage{min-height:160px}}

@media(max-width:950px){
  #menuToggle{display:inline-flex}
  .index{width:calc(100vw - 2rem);max-height:calc(100vh - 2rem)}
  .index a{min-height:44px}
  #brandkit-watermark{opacity:.16}
  .index-panel{height:0;overflow:hidden;pointer-events:none}
  .index-panel-inner{opacity:0;transform:translateY(-6px);transition:opacity .3s ease,transform .34s cubic-bezier(.16,1,.3,1)}
  .index-panel-inner nav,.index-panel-inner small{overflow:auto;max-height:70vh}
  .index.open .index-panel{height:auto;pointer-events:auto}
  .index.open .index-panel-inner{opacity:1;transform:translateY(0)}
}

/* Reduced Motion (UX-016) */
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:0.001ms!important;animation-iteration-count:1!important;transition-duration:0.001ms!important;scroll-behavior:auto!important}
  html{scroll-behavior:auto!important}
  #brandkit-watermark{display:none!important}
}

/* Print Stylesheet (UX-022) */
@media print{
  *,*::before,*::after{background:transparent!important;color:#000!important;box-shadow:none!important;text-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
  html,body{background:#fff!important;color:#111!important;font-size:11pt!important}
  .index,#menuToggle,.skip-link,.asset-toolbar,#brandkit-watermark,video,.media-video,input,.visually-hidden{display:none!important}
  .page{padding:1.5cm 1cm!important;min-height:auto!important;page-break-after:always;break-after:page}
  .cover{page-break-after:always;break-after:page}
  .dossier-entry,.reference-record,.template-record,.lore-record,.media-item,.system-entry,.canon-law{border:1px solid #ccc!important;background:#fff!important;break-inside:avoid;margin-bottom:1rem}
  .warn{border:1px solid #999!important;border-left:4px solid #333!important;background:#f9f9f9!important;color:#000!important}
  details{display:block!important}
  details:not([open])>*{display:block!important}
  details summary{display:none!important}
  img{max-width:100%!important;page-break-inside:avoid}
  a{text-decoration:underline!important}
  a[href^="#"]{text-decoration:none!important}
  .peripheral-index-grid,.template-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
""".strip()


WATERMARK_SCRIPT = """
(function(){
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var v = document.getElementById("brandkit-watermark");
  if (!v) return;
  var clips = [
    "assets/media/bd9b6b141f0f2d11fadea67a.mp4",
    "assets/media/c629ce1b298593185fb64c6d.mp4",
    "assets/media/2867ab757325a18d4e86e47d.mp4",
    "assets/media/3e601797a3fa7815a7f18566.mp4",
    "assets/media/299d5b833f56bb9fe42f0eb2.mp4",
    "assets/media/8fc2775c8783e4c873a72558.mp4"
  ];
  var i = 0;
  if (!reduceMotion) {
    v.src = clips[0];
    v.play().catch(function(){});
    v.addEventListener("ended", function(){
      i = (i + 1) % clips.length;
      v.src = clips[i];
      v.play().catch(function(){});
    });
    document.addEventListener("visibilitychange", function(){
      if (document.hidden) {
        v.pause();
      } else if (!reduceMotion) {
        v.play().catch(function(){});
      }
    });
  }
})();
""".strip()


MAIN_SCRIPT = """
(()=>{
  const index = document.getElementById('index');
  const toggle = document.getElementById('menuToggle');
  const searchInput = document.getElementById('dossierSearch');

  // Mobile menu toggle (UX-010)
  if (toggle && index) {
    toggle.addEventListener('click', () => {
      const panel = document.querySelector('.index-panel');
      const inner = document.querySelector('.index-panel-inner');
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const opening = !index.classList.contains('open');

      toggle.setAttribute('aria-expanded', opening ? 'true' : 'false');

      if (!panel || !inner || reduceMotion) {
        index.classList.toggle('open');
        return;
      }
      if (panel.__anim) panel.__anim.cancel();
      if (opening) {
        index.classList.add('open');
        const end = inner.scrollHeight;
        panel.style.overflow = 'hidden';
        panel.__anim = panel.animate([{height:'0px'},{height:end+'px'}], {duration:360, easing:'cubic-bezier(0.16,1,0.3,1)'});
        inner.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}], {duration:300, easing:'cubic-bezier(0.16,1,0.3,1)'});
        panel.__anim.onfinish = () => { panel.style.height=''; panel.style.overflow=''; };
      } else {
        const start = panel.offsetHeight;
        panel.style.overflow = 'hidden';
        panel.__anim = panel.animate([{height:start+'px'},{height:'0px'}], {duration:280, easing:'cubic-bezier(0.16,1,0.3,1)'});
        panel.__anim.onfinish = () => { index.classList.remove('open'); panel.style.height=''; panel.style.overflow=''; };
      }
    });
  }

  // Mobile nav link activation & focus management (UX-019)
  if (index) {
    index.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', () => {
        if (index.classList.contains('open')) {
          index.classList.remove('open');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
        const targetId = a.getAttribute('href').slice(1);
        if (targetId) {
          setTimeout(() => {
            const target = document.getElementById(targetId);
            if (target) {
              const heading = target.querySelector('h1, h2, h3, [tabindex]') || target;
              heading.setAttribute('tabindex', '-1');
              heading.focus();
            }
          }, 10);
        }
      });
    });
  }

  // Quick Find in Index (UX-015)
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      const groups = document.querySelectorAll('.index .nav-group');
      groups.forEach(group => {
        const links = group.querySelectorAll('.nav-group-body a');
        let matched = 0;
        links.forEach(link => {
          const text = link.textContent.toLowerCase();
          const href = (link.getAttribute('href') || '').toLowerCase();
          const match = !q || text.includes(q) || href.includes(q);
          link.style.display = match ? '' : 'none';
          if (match) matched++;
        });
        if (q) {
          group.style.display = matched > 0 ? '' : 'none';
          if (matched > 0) group.open = true;
        } else {
          group.style.display = '';
        }
      });
    });
  }

  // Current Location Wayfinding (UX-013)
  const navLinks = Array.from(document.querySelectorAll('.index nav a[href^="#"]'));
  const linkMap = new Map();
  navLinks.forEach(link => {
    const id = link.getAttribute('href').slice(1);
    if (id) linkMap.set(id, link);
  });
  const observedSections = Array.from(document.querySelectorAll('section[id], article[id]')).filter(sec => linkMap.has(sec.id));

  let activeId = null;
  if ('IntersectionObserver' in window && observedSections.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length > 0) {
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const targetId = visible[0].target.id;
        if (targetId && targetId !== activeId) {
          activeId = targetId;
          navLinks.forEach(l => {
            if (l.getAttribute('href') === `#${targetId}`) {
              l.setAttribute('aria-current', 'location');
              l.classList.add('active');
              const parentDetails = l.closest('details.nav-group');
              if (parentDetails && !parentDetails.open) parentDetails.open = true;
            } else {
              l.removeAttribute('aria-current');
              l.classList.remove('active');
            }
          });
        }
      }
    }, { rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.2, 0.5, 1.0] });

    observedSections.forEach(sec => observer.observe(sec));
  }

  // Scoped Attachment Bank Management (UX-001, UX-003, UX-004, UX-005, UX-006, UX-007)
  const stages = Array.from(document.querySelectorAll('.attachment-stage'));
  const assetStatus = document.getElementById('assetStatus');
  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

  const refresh = () => {
    const attached = stages.filter(s => {
      const img = s.querySelector('img');
      return img && !img.hidden && img.hasAttribute('src') && img.getAttribute('src');
    }).length;
    if (assetStatus) {
      assetStatus.textContent = `${attached} of ${stages.length} legacy reference slots filled`;
    }
  };

  function showInlineError(stage, msg) {
    let err = stage.querySelector('.attachment-error');
    if (!err) {
      err = document.createElement('div');
      err.className = 'attachment-error';
      err.setAttribute('role', 'alert');
      stage.appendChild(err);
    }
    err.textContent = msg;
    setTimeout(() => { if (err && err.parentNode) err.remove(); }, 6000);
  }

  function clearInlineError(stage) {
    const err = stage.querySelector('.attachment-error');
    if (err) err.remove();
  }

  function loadInto(stage, file) {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
      showInlineError(stage, 'Unsupported file format. Please attach a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    clearInlineError(stage);
    const reader = new FileReader();
    reader.onload = () => {
      const img = stage.querySelector('img');
      if (img) {
        img.src = reader.result;
        img.hidden = false;
      }
      const empty = stage.querySelector('.image-empty');
      if (empty) empty.hidden = true;
      refresh();
    };
    reader.readAsDataURL(file);
  }

  stages.forEach(stage => {
    const input = stage.querySelector('.asset-file');
    if (!input) return;
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        loadInto(stage, input.files[0]);
      }
    });
    stage.addEventListener('dragover', e => {
      e.preventDefault();
      stage.style.boxShadow = 'inset 0 0 0 2px #55dfff';
    });
    stage.addEventListener('dragleave', () => {
      stage.style.boxShadow = '';
    });
    stage.addEventListener('drop', e => {
      e.preventDefault();
      stage.style.boxShadow = '';
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        loadInto(stage, e.dataTransfer.files[0]);
      }
    });
  });

  // Clear Attached Images with Confirmation (UX-003, UX-004)
  const clearBtn = document.getElementById('clearImages');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const attachedCount = stages.filter(s => {
        const img = s.querySelector('img');
        return img && !img.hidden && img.hasAttribute('src') && img.getAttribute('src');
      }).length;

      if (attachedCount === 0) return;

      if (!window.confirm('Clear all attached reference images?')) return;

      stages.forEach(stage => {
        const img = stage.querySelector('img');
        if (img) {
          img.removeAttribute('src');
          img.hidden = true;
        }
        const empty = stage.querySelector('.image-empty');
        if (empty) empty.hidden = false;
        const input = stage.querySelector('.asset-file');
        if (input) input.value = '';
        clearInlineError(stage);
      });
      refresh();
    });
  }

  // Unload warning for transient attachments (UX-003)
  window.addEventListener('beforeunload', e => {
    const attachedCount = stages.filter(s => {
      const img = s.querySelector('img');
      return img && !img.hidden && img.hasAttribute('src') && img.getAttribute('src');
    }).length;
    if (attachedCount > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Export HTML copy (UX-002)
  const exportBtn = document.getElementById('exportEmbedded');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('.asset-file, .attachment-error, #clearImages, #exportEmbedded').forEach(n => n.remove());
      const tb = clone.querySelector('.asset-toolbar');
      if (tb) tb.remove();
      clone.querySelectorAll('.attachment-stage').forEach(s => {
        s.removeAttribute('tabindex');
        s.removeAttribute('role');
      });
      clone.querySelectorAll('.image-empty').forEach(n => {
        if (n.hidden) n.remove();
      });
      const blob = new Blob(['<!doctype html>', String.fromCharCode(10), clone.outerHTML], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'starsilk_character_dossier_copy.html';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  refresh();
})();
""".strip()


ACCORDION_SCRIPT = """
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


def apply_fixes() -> int:
    if not INDEX.exists():
        print(f"Error: {INDEX} not found.", file=sys.stderr)
        return 1

    content = INDEX.read_text(encoding="utf-8")

    # 1. Replace Stylesheet
    style_pattern = re.compile(r"<style>.*?</style>", re.DOTALL)
    content = style_pattern.sub(f"<style>\n{STYLESHEET}\n</style>", content, count=1)

    # 2. Skip Link and Main element (UX-011)
    content = re.sub(r'<a\b[^>]*class="skip-link"[^>]*>.*?</a>\s*', '', content)
    body_match = re.search(r"<body[^>]*>", content)
    if body_match:
        body_tag = body_match.group(0)
        skip_link = '<a href="#mainContent" class="skip-link">Skip to dossier content</a>\n'
        content = content.replace(body_tag, f"{body_tag}\n{skip_link}", 1)

    # Ensure <main> has id="mainContent" and tabindex="-1"
    content = re.sub(r'<main\b[^>]*>', '<main id="mainContent" tabindex="-1">', content, count=1)

    # 3. Watermark Video Tag (UX-027)
    watermark_re = re.compile(r'<video id="brandkit-watermark"[^>]*></video>', re.DOTALL)
    new_watermark = '<video id="brandkit-watermark" muted playsinline aria-hidden="true"></video>'
    if watermark_re.search(content):
        content = watermark_re.sub(new_watermark, content, count=1)

    # 4. Index Nav & Header (UX-008, UX-010, UX-014, UX-015)
    index_re = re.compile(r'<aside\b[^>]*class="index"[^>]*>.*?</aside>', re.DOTALL)
    nav_html = build_nav_html()
    new_index_html = (
        '<aside class="index" id="index">'
        '<div class="index-head"><b>Starsilk / Index</b>'
        '<button aria-label="Toggle dossier navigation" id="menuToggle" aria-expanded="false" aria-controls="indexPanel">Index</button>'
        '</div>'
        '<div class="index-panel" id="indexPanel">'
        '<div class="index-panel-inner">'
        '<div class="index-search-wrap">'
        '<label for="dossierSearch" class="visually-hidden">Filter dossier</label>'
        '<input type="search" id="dossierSearch" placeholder="Filter sections..." aria-label="Filter dossier sections" autocomplete="off"/>'
        '</div>'
        f'{nav_html}'
        '<small>Web Edition · Character pages are print-separated.</small>'
        '</div>'
        '</div>'
        '</aside>'
    )
    content = index_re.sub(new_index_html, content, count=1)

    # 5. Web Edition Badge in Cover (UX-025)
    content = re.sub(r'<div class="edition-label"[^>]*>.*?</div>\s*', '', content)
    content = content.replace(
        '</h1><p class="deck">',
        '</h1><div class="edition-label">Web Edition</div><p class="deck">'
    )

    # 6. Attachment Stage Boundary, Focus Fix & Accessible Status (UX-001, UX-004, UX-005, UX-007)
    def fix_reference_record(m: re.Match) -> str:
        block = m.group(0)
        if 'class="asset-file"' in block:
            block = re.sub(r'<div\b([^>]*)class="image-stage"([^>]*)>', r'<div\1class="image-stage attachment-stage"\2>', block)
            block = re.sub(r'\s*role="button"', '', block)
            block = re.sub(r'\s*tabindex="0"', '', block)
            block = re.sub(r'(<div\b[^>]*class="[^"]*attachment-stage[^"]*")[^>]*aria-label="[^"]*"', r'\1', block)
            block = re.sub(r'class="image-stage attachment-stage attachment-stage"', 'class="image-stage attachment-stage"', block)
        return block

    content = re.sub(r'<figure\b[^>]*class="reference-record"[^>]*>.*?</figure>', fix_reference_record, content, flags=re.DOTALL)

    # 7. Toolbar & Descriptive Text (UX-002, UX-007, UX-023, UX-024)
    content = content.replace(
        '<button id="exportEmbedded" type="button">Export self-contained copy</button>',
        '<button id="exportEmbedded" type="button">Export HTML copy</button>'
    )
    content = re.sub(
        r'<span id="assetStatus">.*?</span>',
        r'<span id="assetStatus" role="status" aria-live="polite">0 of 26 reference slots filled</span>',
        content
    )

    content = content.replace(
        'The current file now embeds the supplied Shard-God, Codec, Dao, Kail, Marcel and standalone Starsilk reference art directly on their relevant dossier pages. The historical archive below remains a separate attachment bank for older project imagery whose binaries are not mounted in this artifact session.',
        'The Web Edition includes canonical reference art and Media Vault archives located in the companion media directory. The historical archive below remains an interactive attachment bank for legacy references not currently included in the published media archive. Exported HTML copies reference the accompanying assets/media/ directory.'
    )
    content = content.replace(
        'the dossier contains an extensive embedded Media Vault plus the principal character and Starsilk reference sheets. The historical attachment bank below remains available only for older unmatched references not represented by the embedded archive.',
        'the dossier contains an extensive published Media Vault plus principal character and Starsilk reference sheets. The historical attachment bank below remains available for legacy reference slots.'
    )

    # 8. Idempotent Image loading="lazy" & decoding="async" (UX-026)
    def normalize_img(m: re.Match) -> str:
        tag = m.group(0)
        tag = re.sub(r'\s+loading="[^"]*"', '', tag)
        tag = re.sub(r'\s+decoding="[^"]*"', '', tag)
        tag = re.sub(r'<img\b', '<img loading="lazy" decoding="async"', tag)
        return tag

    content = re.sub(r'<img\b[^>]*>', normalize_img, content)

    # 9. Context-informed Alt Text Improvements (UX-028)
    ALT_REPLACEMENTS = {
        'alt="Gorevault Drakken dossier visual reference."': 'alt="Gorevault Drakken archival reference showing the massive crust-binding anatomy, carapace plates, and molten core vent structure."',
        'alt="Ringthroat Drakken dossier visual reference."': 'alt="Ringthroat Drakken archival reference detailing the segmented annular throat plates, atmospheric siphon vents, and kinetic ribcage structure."',
        'alt="Lyriboris archival plate."': 'alt="Lyriboris orbital wyrm archival plate showing planetary scale serpent coil, solar-sail mantle, and void-navigation crests."',
        'alt="Lyriboris secondary reference."': 'alt="Lyriboris secondary archival study illustrating celestial motion, gravitational wake distortions, and coronal fleece details."',
        'alt="The Egg archival plate."': 'alt="The Egg genesis origin node archival plate depicting the primordial crystalline core, dormant energy tendrils, and lithic shell."',
        'alt="The Balmera Ridge Incident incident plate."': 'alt="The Balmera Ridge Incident historical incident plate documenting the structural rupture and ground-zero energy discharge."',
        'alt="The Fracture of Deimos VII incident plate."': 'alt="The Fracture of Deimos VII incident plate illustrating orbital debris cascading across the lunar fracture zone."',
        'alt="Meridian Corridor"': 'alt="Meridian Corridor environment reference for Meridian Station interior."',
        'alt="Observation Viewport Room"': 'alt="Observation Viewport Room overlooking Virgil from Meridian Station."',
        'alt="Hydroponics Bay Intact"': 'alt="Hydroponics Bay intact state showing atmospheric growth vaults."',
        'alt="Hydroponics Bay Ruptured"': 'alt="Hydroponics Bay ruptured state following orbital decompression."',
        'alt="Cryogenics Chamber"': 'alt="Cryogenics Chamber preservation bank on Meridian Station."',
        'alt="Antenna Exterior Structure"': 'alt="Antenna Exterior Structure communications array on Meridian Station."',
        'alt="Docking Arm Destruction Site"': 'alt="Docking Arm Destruction Site showing severed umbilical trusses."',
        'alt="Hesh"': 'alt="Hesh visual landmark portrait from Meridian Station."',
        'alt="Mara"': 'alt="Mara visual landmark portrait from Meridian Station."',
        'alt="Rin"': 'alt="Rin visual landmark portrait from Meridian Station."',
        'alt="Kira"': 'alt="Kira visual landmark portrait from Meridian Station."',
        'alt="Jalen"': 'alt="Jalen visual landmark portrait from Meridian Station."',
        'alt="Safi"': 'alt="Safi visual landmark portrait from Meridian Station."',
    }
    for old_alt, new_alt in ALT_REPLACEMENTS.items():
        content = content.replace(old_alt, new_alt)

    # 10. Replace Scripts with clean, scoped scripts (UX-001, UX-003, UX-010, UX-013, UX-015, UX-016, UX-019, UX-027)
    # NOTE: the second re.sub below deletes ALL <script> blocks trailing the
    # watermark video, including any added by a later pipeline stage -- see
    # the module docstring's ORDERING NOTE. Must run before, never after,
    # apply_media_presentation_and_collapse.py.
    content = re.sub(
        r'<video id="brandkit-watermark"[^>]*></video>(?:\s*<script\b[^>]*>(?:(?!</script>).)*</script>)?',
        f'<video id="brandkit-watermark" muted playsinline aria-hidden="true"></video><script>\n{WATERMARK_SCRIPT}\n</script>',
        content,
        flags=re.DOTALL,
        count=1
    )

    content = re.sub(
        r'(?:\s*<script\b[^>]*>(?:(?!</script>).)*</script>)*\s*</body>',
        f'\n<script>\n{MAIN_SCRIPT}\n</script>\n<script>\n{ACCORDION_SCRIPT}\n</script>\n</body>',
        content,
        flags=re.DOTALL,
        count=1
    )

    INDEX.write_text(content, encoding="utf-8")
    print("UX audit fixes successfully applied to docs/index.html.")
    return 0


if __name__ == "__main__":
    sys.exit(apply_fixes())
