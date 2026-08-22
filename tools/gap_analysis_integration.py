#!/usr/bin/env python3
"""Integrate the approved portions of the "Gap Analysis" lore document into
the existing Web Edition. Purely additive: every change is a brand-new
<article>/<li> inserted next to matching existing content. No existing text
node is edited, reworded, or removed.

Excluded per explicit user direction:
  - The Root Permission Scarf mechanic (Kail's scarf overriding his speech).
  - The "121 years" alternate war-duration reading (170 years is locked).
  - The CapCut production checklist (production workflow, not story canon).

Idempotent: each insertion checks a unique marker before applying.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"


def insert_after(html, anchor, new_html, marker):
    if marker in html:
        return html, False
    idx = html.find(anchor)
    if idx == -1:
        raise RuntimeError(f"anchor not found: {anchor[:80]!r}")
    idx += len(anchor)
    return html[:idx] + new_html + html[idx:], True


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    changed = []

    # A. Allkept — Manifestation cycle + Null-description trap ---------------
    anchor = ('The horror is the destruction of the right to remain oneself, '
              'not cynical malice disguised as affection.</li></ul></article>')
    new = (
        '<article class="dossier-entry" data-gap-note="allkept-cycle"><h3>Manifestation cycle</h3>'
        '<ol class="step-list">'
        '<li><span><b>Transmission through retelling:</b> the pattern moves between minds when a host describes the experience, forcing the listener to allocate memory space to it.</span></li>'
        '<li><span><b>Compulsive rendering:</b> infected minds feel motor pressure to draw, carve or paint the entity, sketching a possible body from private fear.</span></li>'
        '<li><span><b>Ambiguous perception:</b> the resulting art is perceptually unstable; different observers see incompatible forms shaped by their own dread.</span></li>'
        '<li><span><b>Consensus as birth:</b> when observers compare notes and agree on one form, that agreement edits the entity into stability and lets it enter ordinary space.</span></li>'
        '<li><span><b>Recursive human conversion:</b> the original transmitter becomes perceptually unresolved; witnesses can no longer agree on their appearance.</span></li>'
        '<li><span><b>New instance formation:</b> once consensus re-forms around the unstable human, that person becomes a new Allkept instance.</span></li>'
        '</ol></article>'
        '<article class="dossier-entry"><h3>Null-description trap</h3>'
        '<p>Refusing to describe Allkept does not stop consensus from forming. Agreeing a subject is “indescribable” is still a shared descriptive value once two minds mean the same thing by it — the agreement satisfies the consensus requirement and can trigger embodiment through shared nullity. Protective silence can therefore become a conversion vector rather than a defense.</p></article>'
    )
    html, did = insert_after(html, anchor, new, 'data-gap-note="allkept-cycle"')
    if did:
        changed.append("Allkept: manifestation cycle + null-description trap")

    # B1. Macro-script catalog extension --------------------------------------
    anchor = ('<b>ENF-0 / Echo-Null:</b> counters Umbral command hijacks; '
              'disorients friendlies and causes sensory fatigue.</li>')
    new = (
        '<li data-gap-note="scripts-ext"><b>MBP-2 / Marrow-Bleach:</b> denatures gestation nodes and ovaries; leaves toxic residuals and biosphere drift.</li>'
        '<li><b>GSE-4 / Gravity-Shear:</b> localized micro-gravity stress; failure produces unpredictable landslides.</li>'
        '<li><b>SD-8 / Seismic Dowel:</b> fissures Telluric plates via penetrators; can open unintended sink zones.</li>'
        '<li><b>VA-9 / Vitrify-Anchor:</b> Pyric anneal used to seal biological structures; leaves toxic vapors and a permanent hazard.</li>'
        '<li><b>BFR-11 / Bioforge-Rend:</b> tears bio-metal composites apart at their joints; active shards persist after the strike.</li>'
        '<li><b>NSM-6 / Null-Surge Matrix:</b> disrupts spawn signaling and hatch cycles; carries sentient neurochemistry side-effects.</li>'
        '<li><b>CC-12 / Cleansing Cascade:</b> combines CBF, MBP and VA to render a region unrecoverable; the failure mode is permanent environmental scarring.</li>'
    )
    html, did = insert_after(html, anchor, new, 'data-gap-note="scripts-ext"')
    if did:
        changed.append("Macro-script catalog: MBP-2 through CC-12 added")

    # B2. Tiger Cults faction ---------------------------------------------------
    anchor = ('<b>Free Runners:</b> civilians and syndicate operators navigating '
              'volatile frontier spaces.</li>')
    new = ('<li data-gap-note="tiger-cults"><b>Tiger Cults:</b> zealot ship-strippers who negotiate with no one, '
           'often leaving the terminal message: “Stars don’t burn, they surrender.”</li>')
    html, did = insert_after(html, anchor, new, 'data-gap-note="tiger-cults"')
    if did:
        changed.append("Institutions: Tiger Cults added")

    # B3. Field valuation & authentication (new aside card) --------------------
    anchor = ('mirrors the setting’s recurring terror—solving a memory-borne '
              'threat by attacking the people carrying memory.</p></article>')
    new = (
        '<article class="dossier-entry" data-gap-note="valuation"><h3>Field valuation &amp; authentication</h3>'
        '<ul>'
        '<li><b>Inert Starsilk Thread (com-04):</b> ~800 CR pristine, 250–350 CR degraded. Macro-resonance test: exposed to a low-level data packet, genuine thread absorbs the signal and its weight changes as it processes the memory; counterfeit nylon stays static or melts.</li>'
        '<li><b>Blood Ring Glass (com-05):</b> ~1,500 CR pristine, 600–700 CR degraded. Polarization check: a UV laser traps in recursive loops inside the genuine material; volcanic obsidian just refracts cleanly or cracks.</li>'
        '<li><b>NiAlBu Witness Shards (com-06):</b> ~2,500 CR pristine, ~1,000 CR degraded. Code-dream audio check: a true shard emits a non-repeating acoustic signature of weeping and ticking; a cleanly repeating loop marks a scrubbed Data Loom fake.</li>'
        '</ul></article>'
    )
    html, did = insert_after(html, anchor, new, 'data-gap-note="valuation"')
    if did:
        changed.append("Artifacts & factions: field valuation & authentication card added")

    # C1. Nacreous VI invasion case study (cosmic-architecture main stack) -----
    anchor = ('<article class="dossier-entry"><h3>Digital Geode</h3><p>NiAlBu’s unrendered prison. '
              'Tiger binds the living god in a condition where ordinary death is unavailable and forces '
              'recursive witness to Wordstreamer’s murder. The prison preserves a captive consciousness; '
              'it does not make death generally reversible.</p></article>')
    new = (
        '<article class="dossier-entry" data-gap-note="nacreous-case"><h3>Nacreous VI — invasion case study</h3>'
        '<p>Before its later status as a Level 3 remnant, Nacreous VI fell to a coordinated Pantheon-of-Arrival '
        'assault combining three of the five Drakken ecological theses: Pyric strains salted the air with iron and '
        'steamed the oceans, Aqueous strains reversed rivers and folded the coastline into new seas, and Telluric '
        'strains rearranged the crust into incubatory strata for further Eggs. The devastation this campaign left '
        'behind is the same wreckage Codec later works within at Leth Quarter to stabilize the First Dirt.</p></article>'
        '<article class="dossier-entry" data-gap-note="niAlBu-binding"><h3>NiAlBu’s binding architecture</h3>'
        '<p>Within the Digital Geode, NiAlBu is held head-down inside an inverted hexagonal aperture — a posture '
        'that demotes an autonomous member of the primordial order into a fixed structural component of Tiger’s '
        'architecture, rather than merely confining him.</p></article>'
    )
    html, did = insert_after(html, anchor, new, 'data-gap-note="nacreous-case"')
    if did:
        changed.append("Cosmic architecture: Nacreous VI case study + NiAlBu binding architecture added")

    # D. Blood Rings — field terminology (additive aside note) -----------------
    # Locate the "Functions" list closing inside blood-rings specifically.
    br_section = re.search(r'<section\b[^>]*id="blood-rings".*?(?=<section\b)', html, re.DOTALL)
    if br_section and 'data-gap-note="blood-terms"' not in br_section.group(0):
        target = ('Optional fortress functions: anchor points, nests, signal structures, '
                   'kill corridors or defensive latticework.</li></ul></article>')
        if target in br_section.group(0):
            insertion = (
                '<article class="dossier-entry" data-gap-note="blood-terms"><h3>Field terminology</h3>'
                '<p class="subtle">Frontline slang for the same infrastructure: individual fragments are called '
                '“wound jewels,” and the ring’s function as a running scoreboard of conquest is called the '
                '“Kill Metronome.”</p></article>'
            )
            new_section = br_section.group(0).replace(target, target + insertion, 1)
            if new_section != br_section.group(0):
                html = html[:br_section.start()] + new_section + html[br_section.end():]
                changed.append("Blood Rings: field terminology (wound jewels / Kill Metronome) added")

    # E. Systems — Codified Waves / Hookshot wartime logistics -----------------
    anchor = ('<h3>Hookshot Network</h3><p>Connection-based travel infrastructure. Tension, latching, '
              'route availability and ship preparedness matter as much as destination.</p></article>')
    new = (
        '<article class="system-entry" data-gap-note="codified-waves"><h3>Codified Waves</h3>'
        '<p>Wartime deployment doctrine built on the Hookshot Network’s blink gates — lines of ships latch, '
        'tension and move as a single unit across stabilized manifolds, letting the Administration land artillery '
        'and supply at stellar distance regardless of Drakken atmospheric rewrites underway on the ground.</p></article>'
    )
    html, did = insert_after(html, anchor, new, 'data-gap-note="codified-waves"')
    if did:
        changed.append("Systems: Codified Waves (Hookshot wartime logistics) added")

    INDEX.write_text(html, encoding="utf-8")
    print("Changes applied:")
    for c in changed:
        print(f"  - {c}")
    if not changed:
        print("  (none — already up to date)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
