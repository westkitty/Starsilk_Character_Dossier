#!/usr/bin/env python3
"""One-shot Phase 5 integration patcher. Deleted by the generation workflow."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def replace_once(relative: str, old: str, new: str) -> None:
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{relative}: expected one replacement target, found {count}: {old!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched {relative}")


# Machine publication: publish the Phase 5 schema and declare the new public
# observatory/text surfaces without changing the existing v1 relationship graph.
replace_once(
    "build/machine_publication.py",
    '    "relationship-graph.schema.json",\n)',
    '    "relationship-graph.schema.json",\n    "relationship-observatory.schema.json",\n)',
)
replace_once(
    "build/machine_publication.py",
    '        "machine/AUTHORITY.md",\n    ] + [f"machine/schema/v1/{name}" for name in SCHEMA_FILES]',
    '        "machine/AUTHORITY.md",\n        "relationships/",\n        "relationships/relationships.json",\n        "relationships/relationships.md",\n        "relationships/AUTHORITY.md",\n    ] + [f"machine/schema/v1/{name}" for name in SCHEMA_FILES]',
)
replace_once(
    "build/machine_publication.py",
    "Observed relationship graph: {e['relationships']}\\nJSON-LD: {e['jsonld']}",
    "Observed relationship graph: {e['relationships']}\\nHuman relationship observatory: {canonical('relationships/')}\\nRelationship Observatory JSON: {canonical('relationships/relationships.json')}\\nRelationship Observatory Markdown: {canonical('relationships/relationships.md')}\\nJSON-LD: {e['jsonld']}",
)

# Entity publication: one discoverability link only. Existing relationship
# labels and target links remain untouched.
replace_once(
    "src/templates/entity.html.j2",
    '    <a href="{% if mode == \'record\' %}../../machine/entities.json{% else %}../machine/entities.json{% endif %}">Machine index</a>\n',
    '    <a href="{% if mode == \'record\' %}../../machine/entities.json{% else %}../machine/entities.json{% endif %}">Machine index</a>\n    <a href="{% if mode == \'record\' %}../../relationships/{% else %}../relationships/{% endif %}">Relationship observatory</a>\n',
)
replace_once(
    "src/templates/entity.html.j2",
    '    <div class="entity-actions" aria-label="Related publication"><a href="../objects/">Browse museum objects</a></div>',
    '    <div class="entity-actions" aria-label="Related publication"><a href="../objects/">Browse museum objects</a><a href="../relationships/">Relationship observatory</a></div>',
)

# Build ownership and public-boundary integration.
replace_once(
    "tools/build.sh",
    '#     -> build/machine_publication.py   (deterministic public machine derivatives)\n#     -> build/entity_publication.py    (deterministic stable entity permalink pages)',
    '#     -> build/machine_publication.py   (deterministic public machine derivatives)\n#     -> build/relationship_publication.py (observed-xref relationship observatory)\n#     -> build/entity_publication.py    (deterministic stable entity permalink pages)',
)
replace_once(
    "tools/build.sh",
    '# docs/index.html, docs/machine/, docs/entities/, and docs/objects/ are\n',
    '# docs/index.html, docs/machine/, docs/relationships/, docs/entities/, and docs/objects/ are\n',
)
replace_once(
    "tools/build.sh",
    '    echo "-> Generating (in-memory) and checking public machine publication..."\n    "$PY" build/machine_publication.py --check\n    echo "-> Generating (in-memory) and checking stable entity permalinks..."',
    '    echo "-> Generating (in-memory) and checking public machine publication..."\n    "$PY" build/machine_publication.py --check\n    echo "-> Generating (in-memory) and checking Relationship Observatory..."\n    "$PY" build/relationship_publication.py --check\n    echo "-> Generating (in-memory) and checking stable entity permalinks..."',
)
replace_once(
    "tools/build.sh",
    '    echo "-> Generating public machine publication from declared authority..."\n    "$PY" build/machine_publication.py\n    echo "-> Generating stable entity permalinks from declared authority..."',
    '    echo "-> Generating public machine publication from declared authority..."\n    "$PY" build/machine_publication.py\n    echo "-> Generating Relationship Observatory from observed xref evidence..."\n    "$PY" build/relationship_publication.py\n    echo "-> Generating stable entity permalinks from declared authority..."',
)
replace_once(
    "tools/build.sh",
    '"$PY" tools/check_public_boundary.py docs/machine docs/llms.txt docs/sitemap.xml docs/entities docs/objects',
    '"$PY" tools/check_public_boundary.py docs/machine docs/llms.txt docs/sitemap.xml docs/relationships docs/entities docs/objects',
)

# Machine-publication regressions must account for the newly declared public
# relationship URLs and the versioned observatory schema copy.
replace_once(
    "tests/test_machine_publication.py",
    '    "relationship-graph.schema.json",\n}',
    '    "relationship-graph.schema.json",\n    "relationship-observatory.schema.json",\n}',
)
replace_once(
    "tests/test_machine_publication.py",
    '        "machine/entities.md",\n        "machine/AUTHORITY.md",\n    } | {f"machine/schema/v1/{name}" for name in SCHEMAS}',
    '        "machine/entities.md",\n        "machine/AUTHORITY.md",\n        "relationships/",\n        "relationships/relationships.json",\n        "relationships/relationships.md",\n        "relationships/AUTHORITY.md",\n    } | {f"machine/schema/v1/{name}" for name in SCHEMAS}',
)
replace_once(
    "tests/test_machine_publication.py",
    '    assert SITE_BASE + "entities/" in llms\n    assert "/entities/<stable-id>/" in llms',
    '    assert SITE_BASE + "entities/" in llms\n    assert SITE_BASE + "relationships/" in llms\n    assert SITE_BASE + "relationships/relationships.json" in llms\n    assert SITE_BASE + "relationships/relationships.md" in llms\n    assert "/entities/<stable-id>/" in llms',
)

# Representative cross-browser proof for the public deep-link/evidence route.
cross_browser = ROOT / "tests/test_cross_browser.py"
text = cross_browser.read_text(encoding="utf-8")
marker = "def test_relationship_observatory_deep_link_journey"
if marker in text:
    raise RuntimeError("tests/test_cross_browser.py already contains Phase 5 journey")
text += '''\n\ndef test_relationship_observatory_deep_link_journey(page: Page, local_server):\n    page.set_viewport_size({"width": 1280, "height": 800})\n    edge_id = "mention--codec--dao"\n    page.goto(f"{local_server}/relationships/#{edge_id}")\n    edge = page.locator(f"#{edge_id}")\n    expect(edge).to_be_visible()\n    expect(edge).to_have_attribute("data-relationship", "mentions")\n    expect(edge).to_have_attribute("data-evidence-class", "observed-xref")\n    expect(page.locator("#entity-codec")).to_be_visible()\n    expect(edge.locator("a", has_text="Published xref evidence")).to_have_attribute(\n        "href",\n        "https://westkitty.github.io/Starsilk_Character_Dossier/#xref-codec--dao",\n    )\n\n'''
cross_browser.write_text(text, encoding="utf-8")
print("patched tests/test_cross_browser.py")
