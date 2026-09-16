#!/usr/bin/env python3
"""One-shot source/state patch for the Revision Chamber feature branch.

This helper is removed by the bootstrap workflow after applying the bounded
changes and regenerating docs/. It is not part of the final PR surface.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent if Path(__file__).parts[-3:-1] == ('.github', 'scripts') else Path.cwd()


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one patch target, found {count}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def patch_generate() -> None:
    path = ROOT / "build" / "generate.py"
    replace_once(
        path,
        'CANON_DIR = ROOT / "src" / "canon"\n',
        'CANON_DIR = ROOT / "src" / "canon"\nCHRONOLOGY_FILE = ROOT / "src" / "chronology" / "events.json"\n',
    )
    marker = '\n\ndef render_site() -> str:\n'
    insert = r'''


def build_revision_data(sections: list) -> dict:
    """Build the browser-local evidence substrate for speculative canon planning.

    This intentionally reuses the Witness stable-record and machine-lock index,
    then adds only authored chronology event evidence. It is a planning
    derivative and must never be interpreted as complete canon authority.
    """
    witness = build_witness_data(sections)
    chronology = json.loads(CHRONOLOGY_FILE.read_text(encoding="utf-8"))
    source_record = chronology.get("source_record", {})
    events = []
    for event in chronology.get("events", []):
        temporal = event.get("temporal", {})
        event_id = event.get("event_id")
        if not event_id or not event.get("label"):
            continue
        events.append({
            "event_id": event_id,
            "label": event.get("label"),
            "source_heading": event.get("source_heading"),
            "source_ref": source_record.get("path"),
            "canonical_url": f"{CANONICAL_URL}chronology/#event-{event_id}",
            "temporal": {
                "certainty": temporal.get("certainty", "unknown"),
                "exact_authored_marker": temporal.get("exact_authored_marker"),
                "relative_marker": temporal.get("relative_marker"),
                "duration": temporal.get("duration"),
                "before_event_ids": list(temporal.get("before_event_ids", [])),
                "after_event_ids": list(temporal.get("after_event_ids", [])),
            },
        })
    return {
        "schema": "starsilk-revision-data/1",
        "authority_note": (
            "Speculative planning derivative only. Zero machine-lock conflicts "
            "never means canon-compatible; human canon judgment remains required."
        ),
        "base_url": CANONICAL_URL,
        "records": witness["records"],
        "locks": witness["locks"],
        "events": events,
        "canon_lock_source": "src/canon/invariants.json",
        "chronology_source": source_record.get("path", "src/chronology/events.json"),
    }
'''
    text = path.read_text(encoding="utf-8")
    if marker not in text:
        raise RuntimeError("generate.py: render_site marker not found")
    path.write_text(text.replace(marker, insert + marker, 1), encoding="utf-8")
    replace_once(
        path,
        '    witness_engine_js = (TEMPLATES_DIR / "witness-engine.js").read_text(encoding="utf-8")\n    witness_data_b64 = base64.b64encode(json.dumps(build_witness_data(sections), ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii")\n    museum_stats = load_museum_stats(sections)\n',
        '    witness_engine_js = (TEMPLATES_DIR / "witness-engine.js").read_text(encoding="utf-8")\n    witness_data_b64 = base64.b64encode(json.dumps(build_witness_data(sections), ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii")\n    revision_chamber_js = (TEMPLATES_DIR / "revision-chamber.js").read_text(encoding="utf-8")\n    revision_data_b64 = base64.b64encode(json.dumps(build_revision_data(sections), ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii")\n    museum_stats = load_museum_stats(sections)\n',
    )
    replace_once(
        path,
        '        witness_engine_js=witness_engine_js,\n        witness_data_b64=witness_data_b64,\n        footer_folio="27",\n',
        '        witness_engine_js=witness_engine_js,\n        witness_data_b64=witness_data_b64,\n        revision_chamber_js=revision_chamber_js,\n        revision_data_b64=revision_data_b64,\n        footer_folio="27",\n',
    )


def patch_shell() -> None:
    path = ROOT / "src" / "templates" / "shell.html.j2"
    css_anchor = '@media print{.witness-engine,#witnessEngineToggle{display:none!important}}\n/* Preserve the HTML hidden contract even when component CSS sets display. */'
    revision_css = r'''@media print{.witness-engine,#witnessEngineToggle{display:none!important}}
/* Root-only Revision Chamber: speculative realities, never authority. */
.witness-engine-head-actions{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:flex-end}
.revision-chamber{position:fixed;z-index:96;inset:0;overflow:auto;background:radial-gradient(circle at 12% 2%,rgba(42,103,143,.2),transparent 27rem),radial-gradient(circle at 92% 90%,rgba(69,30,91,.18),transparent 30rem),#04060b;color:#eaf5fb;padding:0 clamp(1rem,3vw,2.4rem) 2rem}
.revision-chamber[hidden]{display:none!important}.revision-head{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 0;border-bottom:1px solid #2c4152;background:rgba(4,6,11,.96);backdrop-filter:blur(14px)}.revision-head h2{margin:.1rem 0 0;font-size:clamp(1.9rem,4vw,3.5rem);letter-spacing:-.05em}.revision-chamber button,.revision-file-label,.revision-chamber input,.revision-chamber select{min-height:44px}.revision-chamber button,.revision-file-label{border:1px solid #35536a;border-radius:4px;background:#102334;color:#eaf5fb;font:700 .74rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.055em;text-transform:uppercase}.revision-chamber button{padding:.58rem .82rem;cursor:pointer}.revision-chamber button:hover,.revision-chamber button:focus-visible,.revision-file-label:focus-within{border-color:var(--thread);background:#17344b;outline:2px solid var(--thread);outline-offset:2px}.revision-chamber button:disabled{opacity:.45;cursor:not-allowed}.revision-boundary{max-width:83rem;margin:1rem 0;color:#adc2cf;font-size:.84rem}.revision-status{min-height:1.45rem;color:var(--thread2);font:700 .76rem/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.revision-grid{display:grid;grid-template-columns:minmax(15rem,.72fr) minmax(20rem,1.08fr) minmax(23rem,1.35fr);gap:1rem;align-items:start}.revision-pane{min-width:0;border:1px solid #263c4c;background:rgba(8,17,26,.94);padding:1rem}.revision-pane h3{margin:.3rem 0 1rem;font-size:1.05rem}.revision-baseline{border:1px solid #53616c;background:#0d1319;padding:.75rem;margin-bottom:.7rem}.revision-baseline strong,.revision-baseline span{display:block}.revision-baseline strong{font:800 .75rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.revision-baseline span{margin-top:.25rem;color:#94a8b5;font-size:.76rem}.revision-branches{display:grid;gap:.45rem}.revision-branch{display:grid!important;width:100%;gap:.25rem;text-align:left!important;text-transform:none!important;letter-spacing:0!important}.revision-branch strong{font:800 .8rem/1.25 ui-monospace,SFMono-Regular,Menlo,monospace}.revision-branch span{color:#9eb3c0;font-size:.73rem;font-weight:400}.revision-branch.is-active{border-color:#59d9ff!important;background:#133147!important;box-shadow:inset 3px 0 #59d9ff}.revision-actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem}.revision-actions>*{flex:1 1 9rem}.revision-file-label{display:inline-flex;align-items:center;justify-content:center;padding:.58rem .82rem;cursor:pointer}.revision-file-label input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%)}.revision-field{display:grid;gap:.35rem;margin-bottom:.75rem}.revision-field>span,.revision-compare-control>span{color:#91a8b6;font:700 .7rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.08em}.revision-chamber input,.revision-chamber select,.revision-chamber textarea{width:100%;box-sizing:border-box;border:1px solid #35536a;border-radius:4px;background:#02060a;color:#eaf5fb;padding:.72rem;font:400 .88rem/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.revision-chamber textarea{min-height:19rem;resize:vertical}.revision-chamber input:focus-visible,.revision-chamber select:focus-visible,.revision-chamber textarea:focus-visible{outline:2px solid var(--thread);outline-offset:2px}.revision-compare-control{display:grid;gap:.35rem;margin-top:1rem;padding-top:1rem;border-top:1px solid #263c4c}.revision-verdict{border:1px solid #314a5d;padding:.85rem;margin-bottom:.8rem}.revision-verdict strong{display:block;margin:.25rem 0;font:900 .9rem/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.055em}.revision-verdict p{margin:.25rem 0 0;color:#b6c8d2;font-size:.8rem}.revision-verdict.is-blocked{border-left:5px solid #ff6b6b}.revision-verdict.is-blocked strong{color:#ff9090}.revision-verdict.is-human{border-left:5px solid #e4bd68}.revision-verdict.is-human strong{color:#f1ce83}.revision-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.45rem}.revision-counts span{border:1px solid #263c4c;background:#0a151f;padding:.55rem;font:700 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}.revision-counts b{display:block;margin-top:.2rem;color:#fff;font-size:1.15rem}.revision-blast-note{color:#8fa8b8;font-size:.78rem}.revision-sacrifice-banner{margin:1rem 0;padding:1rem;border:1px solid #795671;background:linear-gradient(120deg,rgba(104,40,72,.24),rgba(14,30,44,.5))}.revision-sacrifice-banner h3{margin:.3rem 0}.revision-sacrifice-banner p{margin:.3rem 0;color:#c7b8c4}.revision-impact-group{border-top:1px solid #263c4c;padding-top:.8rem;margin-top:.8rem}.revision-impact-group h4{margin:0 0 .45rem;font-size:.86rem}.revision-impact-group ul{margin:.35rem 0;padding-left:1.2rem}.revision-impact-group li{margin:.42rem 0;color:#d7e3e9;font-size:.78rem;overflow-wrap:anywhere}.revision-impact-group code{color:#bfeaff}.revision-impact-group a{color:var(--thread)}.revision-empty-line,.revision-empty{color:#8fa8b8;font-size:.8rem}.revision-conflict{list-style:'⚠  '}.revision-comparison{margin:1rem 0 0;border:1px solid #2c4152;background:rgba(8,17,26,.96);padding:1rem}.revision-comparison[hidden]{display:none!important}.revision-comparison header h3{margin:.3rem 0}.revision-comparison header p{color:#a8bdc9}.revision-compare-row{border-top:1px solid #263c4c;padding-top:.8rem;margin-top:.8rem}.revision-compare-row h4{margin:0 0 .5rem}.revision-compare-row>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem}.revision-compare-row article{border:1px solid #263c4c;background:#09131d;padding:.65rem;min-width:0}.revision-compare-row article>span:first-child{display:block;color:#99b0be;font:700 .68rem/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.06em}.revision-compare-row ul{padding-left:1rem;margin:.5rem 0 0}.revision-compare-row li{font-size:.76rem;overflow-wrap:anywhere}.revision-none{display:block;margin-top:.5rem;color:#738997;font-size:.76rem}
@media(max-width:1150px){.revision-grid{grid-template-columns:minmax(15rem,.72fr) 1.28fr}.revision-consequence-pane{grid-column:1/-1}}
@media(max-width:700px){.revision-chamber{padding:0 .75rem 1rem}.revision-head{align-items:flex-start}.revision-grid{grid-template-columns:1fr}.revision-consequence-pane{grid-column:auto}.revision-chamber textarea{min-height:38vh}.revision-counts{grid-template-columns:1fr 1fr}.revision-compare-row>div{grid-template-columns:1fr}.revision-actions>*{flex:1 1 10rem}}
@media print{.revision-chamber{display:none!important}}
/* Preserve the HTML hidden contract even when component CSS sets display. */'''
    replace_once(path, css_anchor, revision_css)
    replace_once(
        path,
        '<div class="reader-workbench-head-actions"><button type="button" id="readerToWitness">Witness engine</button><button type="button" id="readerWorkbenchClose" aria-label="Close Reader Workbench">Close</button></div>',
        '<div class="reader-workbench-head-actions"><button type="button" id="readerToWitness">Witness engine</button><button type="button" id="readerToRevision">Revision Chamber</button><button type="button" id="readerWorkbenchClose" aria-label="Close Reader Workbench">Close</button></div>',
    )
    replace_once(
        path,
        '<header class="witness-engine-head"><div><span class="eyebrow">Canon compile desk</span><h2 id="witnessEngineHeading">Witness Engine</h2></div><button type="button" id="witnessEngineClose" aria-label="Close Witness Engine">Close</button></header>',
        '<header class="witness-engine-head"><div><span class="eyebrow">Canon compile desk</span><h2 id="witnessEngineHeading">Witness Engine</h2></div><div class="witness-engine-head-actions"><button type="button" id="witnessToRevision">Fork into Revision Chamber</button><button type="button" id="witnessEngineClose" aria-label="Close Witness Engine">Close</button></div></header>',
    )
    revision_markup = r'''<aside id="revisionChamber" class="revision-chamber" aria-labelledby="revisionChamberHeading" aria-describedby="revisionChamberBoundary" hidden>
<header class="revision-head"><div><span class="eyebrow">Speculative canon planning</span><h2 id="revisionChamberHeading">Revision Chamber</h2></div><button type="button" id="revisionChamberClose" aria-label="Close Revision Chamber">Close</button></header>
<p id="revisionChamberBoundary" class="revision-boundary"><strong>Plan the rewrite. Do not touch reality.</strong> Speculative branches exist only in browser memory. The Chamber can expose machine-lock collisions and source-backed review surfaces; it cannot prove complete canon compatibility, create semantic relationships, write the repository, or promote anything into canon.</p>
<div id="revisionStatus" class="revision-status" role="status" aria-live="polite"></div>
<div class="revision-grid">
<section class="revision-pane" aria-labelledby="revisionRealitiesHeading"><span class="eyebrow">01 / Realities</span><h3 id="revisionRealitiesHeading">Fork without consequence</h3><div class="revision-baseline"><strong>Current Canon</strong><span>Immutable baseline · never edited here</span></div><div id="revisionBranchList" class="revision-branches"></div><div class="revision-actions"><button type="button" id="revisionNewBranch">Fork reality</button></div><label class="revision-compare-control"><span>Compare active reality against</span><select id="revisionCompareTarget" aria-label="Comparison reality"></select></label><button type="button" id="revisionCompareBtn">Compare realities</button></section>
<section class="revision-pane" aria-labelledby="revisionMutationHeading"><span class="eyebrow">02 / Mutation desk</span><h3 id="revisionMutationHeading">What are you willing to make true?</h3><label class="revision-field"><span>Reality name</span><input id="revisionBranchName" maxlength="80" autocomplete="off"/></label><label class="revision-field"><span>Proposed canon change</span><textarea id="revisionProposal" maxlength="300000" spellcheck="true" placeholder="Write the reality change you want to test…"></textarea></label><div class="revision-actions"><button type="button" id="revisionAnalyze">Analyze reality</button><button type="button" id="revisionSacrifice">What would I have to sacrifice?</button></div><div class="revision-actions"><button type="button" id="revisionDuplicate">Duplicate reality</button><button type="button" id="revisionDelete">Discard reality</button></div><div class="revision-actions"><label class="revision-file-label" for="revisionImport">Import workspace<input id="revisionImport" type="file" accept=".json,application/json"/></label><button type="button" id="revisionExportBranch">Export reality</button><button type="button" id="revisionExportWorkspace">Export all realities</button></div><p class="revision-empty">Nothing here persists automatically. Reloading destroys the workspace unless you explicitly export it.</p></section>
<section class="revision-pane revision-consequence-pane" aria-labelledby="revisionConsequencesHeading"><span class="eyebrow">03 / Consequences</span><h3 id="revisionConsequencesHeading">Known blast radius</h3><div id="revisionConsequences"><div class="revision-empty"><p>Analyze a speculative reality to map only the evidence the archive can prove is touched.</p></div></div><div class="revision-actions"><button type="button" id="revisionCopyPacket">Copy change packet</button></div></section>
</div>
<section id="revisionComparison" class="revision-comparison" aria-label="Reality comparison" hidden></section>
</aside>
<script>window.STARSILK_REVISION_DATA=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob("{{ revision_data_b64 }}"),function(c){return c.charCodeAt(0);})));</script>
<script>
{{ revision_chamber_js }}
</script>
'''
    replace_once(path, '<script src="offline-client.js"></script>', revision_markup + '<script src="offline-client.js"></script>')


def patch_cross_browser() -> None:
    path = ROOT / "tests" / "test_cross_browser.py"
    text = path.read_text(encoding="utf-8")
    if "test_revision_chamber_speculative_journey" in text:
        return
    addition = r'''


def test_revision_chamber_speculative_journey(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html#codec")
    page.locator("#readerWorkbenchToggle").click()
    page.locator("#readerToRevision").click()
    expect(page.locator("#revisionChamber")).to_be_visible()
    page.locator("#revisionProposal").fill("Codec establishes the mauve theorem.")
    page.locator("#revisionAnalyze").click()
    expect(page.locator("#revisionConsequences")).to_contain_text("HUMAN DECISION REQUIRED")
    expect(page.locator("#revisionConsequences")).to_contain_text("Known blast radius only")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.keyboard.press("Escape")
    expect(page.locator("#revisionChamber")).to_be_hidden()
'''
    path.write_text(text.rstrip() + addition + "\n", encoding="utf-8")


def patch_state() -> None:
    path = ROOT / "OPERATIONAL_STATE.md"
    text = path.read_text(encoding="utf-8")
    if "revision: 36" in text and "Revision 36:" in text:
        return
    if "revision: 35" not in text:
        raise RuntimeError("Operational State: expected revision 35")
    text = text.replace("revision: 35", "revision: 36", 1)
    invariant_76 = "76. The root Witness Engine is a browser-memory-only evidence compiler over existing stable records and machine-enforced canon locks. Draft text is never canon/content/relationship authority and must not be persisted, transmitted, or promoted by compilation. Exact source-phrase matches establish only the matched phrase; unmatched assertions remain `source-local` or `unknown`, and absence from `src/canon/invariants.json` must never be interpreted as non-canon or false.\n"
    invariant_77 = "77. The root Revision Chamber is a browser-memory-only speculative planning surface over existing stable-record evidence, machine-enforced canon locks, authored chronology-event evidence, and rendered observed-xref evidence. A branch, comparison, export, or zero-conflict result never creates canon/content/chronology/relationship authority. `BLOCKED BY MACHINE LOCK` means only that an explicit applicable machine prohibition matched; otherwise the verdict remains `HUMAN DECISION REQUIRED`. Blast-radius output is a provable subset of touched evidence and review surfaces, never a complete canon dependency graph. Observed xrefs remain `mentions` only. The Chamber has no repository-write or canon-promotion action; durability requires explicit user export.\n"
    if invariant_76 not in text:
        raise RuntimeError("Operational State: invariant 76 target not found")
    text = text.replace(invariant_76, invariant_76 + invariant_77, 1)
    old_pending = "- None. Witness Engine is merged, published, and live-edge verified. Museum + AI remains complete at Phase 12 of 12; Witness Engine is post-program capability work, not Phase 13."
    new_pending = "- Revision Chamber implementation is staged as post-program capability work. Protected PR CI, merge, exact Pages publication, and live-edge proof remain pending. Museum + AI remains complete at Phase 12 of 12; this is not Phase 13."
    if old_pending not in text:
        raise RuntimeError("Operational State: pending target not found")
    text = text.replace(old_pending, new_pending, 1)
    log = "- Revision 36: added the post-program Revision Chamber as a root-only browser-memory speculative canon-planning surface. It supports ephemeral named reality branches, Witness-draft forking, machine-lock collision detection, authored chronology touchpoints, observed-xref mention touchpoints, deterministic authority/derivative review surfaces, explicit 'What would I have to sacrifice?' packets, branch-vs-branch/current-canon comparison, and explicit JSON export/import without automatic persistence. A zero-conflict proposal always remains `HUMAN DECISION REQUIRED`; only explicit machine prohibitions yield `BLOCKED BY MACHINE LOCK`. No action can canonize, write the repository, infer semantic relationships, or treat the machine-lock subset as complete canon. Protected PR CI, merge, and live Pages proof remain pending; no Phase 13 was created."
    text = text.rstrip() + "\n" + log + "\n"
    path.write_text(text, encoding="utf-8")


def main() -> None:
    patch_generate()
    patch_shell()
    patch_cross_browser()
    patch_state()


if __name__ == "__main__":
    main()
