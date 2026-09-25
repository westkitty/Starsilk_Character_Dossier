from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DOCS = ROOT / "docs"

ALLOWED_CONTRADICTION = {"unresolved","intentional-tension","superseded","perspective-conflict","source-conflict","resolved"}
ALLOWED_CAUSAL = {"required","triggered","enabled","provoked","contributed-to","contested"}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def stable_ids():
    return {item["id"] for item in load(SRC / "content" / "sections.json")["sections"]}


def test_r1_contradiction_observatory_is_explicit_and_incomplete_by_design():
    data = load(SRC / "records" / "deep-systems.json")
    assert "incomplete by design" in data["authority_note"].lower()
    assert data["contradiction_records"]
    ids = stable_ids()
    for item in data["contradiction_records"]:
        assert item["status"] in ALLOWED_CONTRADICTION
        assert item["claims"] and item["affected_stable_ids"]
        assert set(item["affected_stable_ids"]) <= ids
        for claim in item["claims"]:
            source = ROOT / claim["source"]["path"]
            assert source.exists()


def test_r2_semantic_edges_are_authored_and_separate_from_observed_mentions():
    source = load(SRC / "records" / "deep-systems.json")
    records = load(DOCS / "records" / "records.json")
    ids = stable_ids()
    assert source["semantic_edges"]
    assert "authored-semantic-edge" in records["evidence_classes"]
    assert "observed-xref" in records["evidence_classes"]
    for edge in source["semantic_edges"]:
        assert edge["source"] in ids and edge["target"] in ids
        assert edge["certainty"] == "direct-authored"
        assert (ROOT / edge["source_evidence"]["path"]).exists()
    assert len(source["semantic_edges"]) < 20


def test_r3_global_command_palette_is_shared_and_keyboard_addressable():
    partial = (SRC / "templates" / "_global_tools.html.j2").read_text(encoding="utf-8")
    global_js = (SRC / "templates" / "global-tools.js").read_text(encoding="utf-8")
    root = (SRC / "templates" / "shell.html.j2").read_text(encoding="utf-8")
    nav = (SRC / "templates" / "_museum_nav.html.j2").read_text(encoding="utf-8")
    assert 'global-tools.js' in partial
    assert 'id="ssCommandDialog"' in global_js
    assert 'e.ctrlKey||e.metaKey' in global_js
    assert 'e.shiftKey' in global_js
    assert 'e.key.toLowerCase()==="k"' in global_js
    for label in ("Discover","Records / Deep Systems","Relationships","Canon Inspector","Chronology","WorldsVault","Film Vault","Witness Engine","Revision Chamber"):
        assert label in global_js
    assert '_global_tools.html.j2' in root
    assert '_global_tools.html.j2' not in nav
    for name in ('discovery','museum','tours','chronology','worldsvault','records'):
        surface = (SRC / 'templates' / f'{name}.html.j2').read_text(encoding='utf-8')
        assert '_global_tools.html.j2' in surface


def test_r4_temporal_lens_preserves_unknown_state():
    global_js = (SRC / "templates" / "global-tools.js").read_text(encoding="utf-8")
    js = (SRC / "templates" / "records.js").read_text(encoding="utf-8")
    assert 'id="ssTemporalLens"' in global_js
    assert 'starsilk-temporal-lens' in global_js
    assert 'starsilk:temporal-lens' in global_js
    assert 'unknown temporal state remains visible' in js
    assert '!(r[6]||[]).length' in js


def test_r5_structured_change_history_and_unknown_history_state():
    deep = load(SRC / "records" / "deep-systems.json")
    js = (SRC / "templates" / "records-deep.js").read_text(encoding="utf-8")
    assert deep["canon_deltas"]
    assert 'What changed?' in js
    assert 'unknown history, not proof of no change' in js
    for item in deep["canon_deltas"]:
        assert item["delta_class"] in {"added-fact","correction","retcon","terminology-lock","visual-lock-change","relationship-change","superseded"}
        assert "recorded_at" in item


def test_r6_claim_level_evidence_trace_retains_evidence_class_and_source_pointer():
    records = load(DOCS / "records" / "records.json")
    js = (SRC / "templates" / "records-deep.js").read_text(encoding="utf-8")
    assert 'Why is this here?' in js
    for record in records["records"]:
        for refs in record["categories"].values():
            for ref in refs:
                assert ref["evidence_class"]
                assert ref["source_pointer"]


def test_r7_causality_loom_requires_authored_evidence_not_order():
    deep = load(SRC / "records" / "deep-systems.json")
    assert deep["causal_edges"]
    assert any("Chronological adjacency is never sufficient" in rule for rule in deep["rules"])
    for edge in deep["causal_edges"]:
        assert edge["kind"] in ALLOWED_CAUSAL
        assert edge["certainty"] == "direct-authored"
        assert edge["source_claim_ids"]
        assert all(cid.startswith("C") for cid in edge["source_claim_ids"])
        assert (ROOT / edge["source_evidence"]["path"]).exists()


def test_r8_visual_generation_packets_are_source_bounded():
    records = load(DOCS / "records" / "records.json")
    assert records["records"]
    for record in records["records"]:
        packet = record["visual_packet"]
        assert packet["schema"] == "starsilk-visual-generation-packet/1"
        assert packet["stable_id"] == record["stable_id"]
        assert packet["source"].startswith("src/content/sections/")
        assert isinstance(packet["related_media_ids"], list)
        assert "Do not infer visual properties" in packet["rule"]


def test_r9_drakken_morphology_atlas_preserves_unknown_axes():
    records = load(DOCS / "records" / "records.json")
    drakken = [r for r in records["records"] if r["drakken_morphology"]]
    assert len(drakken) >= 50
    for record in drakken:
        m = record["drakken_morphology"]
        assert m["archetype"]
        for key in ("body_topology","locomotion","scale","environmental_mechanism"):
            assert m[key] == "unknown"
    template = (SRC / "templates" / "records.html.j2").read_text(encoding="utf-8")
    assert "Drakken comparative morphology" in template


def test_r10_research_trails_are_local_exportable_and_noncanonical():
    js = (SRC / "templates" / "records-deep.js").read_text(encoding="utf-8")
    template = (SRC / "templates" / "records.html.j2").read_text(encoding="utf-8")
    assert 'starsilk-research-trail/v1' in js
    assert 'starsilk-research-trail.json' in js
    assert 'starsilk-research-trail.md' in js
    assert 'Reader-created trail. Stable IDs and evidence links only; not canon.' in js
    assert "Stored only in this browser" in template


def test_generated_deep_source_is_exact_derivative():
    assert (DOCS / "records" / "deep-systems.json").read_bytes() == (SRC / "records" / "deep-systems.json").read_bytes()
    assert (DOCS / "records" / "deep-systems.schema.json").read_bytes() == (SRC / "schema" / "deep-systems.schema.json").read_bytes()


def test_browser_command_palette_temporal_lens_and_deep_tools(page, local_server):
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    page.keyboard.press("Control+Shift+K")
    dialog = page.locator("#ssCommandDialog")
    assert dialog.evaluate("el => el.open")
    page.locator("#ssCommandQuery").fill("Codec")
    assert page.locator("#ssCommandResults a", has_text="Codec").count() >= 1
    page.locator("#ssTemporalLens").select_option("modern")
    page.locator("#ssCommandClose").click()

    page.goto(f"{local_server}/records/")
    page.wait_for_selector("#record-codec")
    assert "temporal lens modern" in page.locator("#recordStatus").inner_text()
    page.wait_for_selector("#semanticList .deep-item")
    assert page.locator("#semanticList").inner_text().strip()
    assert page.locator("#contradictionList").inner_text().strip()
    assert page.locator("#causalityList").inner_text().strip()
    assert page.locator("#morphCompare table").count() == 1

    page.locator("#trailQuestion").fill("Trace Codec authority")
    page.locator("#record-codec [data-trail-add='codec']").click()
    assert "Codec" in page.locator("#trailList").inner_text()
    page.locator("#record-codec details", has_text="Why is this here?").first.click()
    assert "authored-record" in page.locator("#record-codec").text_content()
