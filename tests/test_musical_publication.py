"""Musical / Score Room source, publication and authority invariants."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/content/musical/index.html"
PUBLISHED = ROOT / "docs/musical/index.html"
AUTHORITY = ROOT / "src/content/musical/AUTHORITY.md"


def test_musical_page_is_deterministic_published_derivative():
    assert SOURCE.is_file() and PUBLISHED.is_file()
    assert SOURCE.read_bytes() == PUBLISHED.read_bytes()
    assert AUTHORITY.read_bytes() == (ROOT / "docs/musical/AUTHORITY.md").read_bytes()


def test_musical_is_discoverable_from_primary_compendium():
    source_shell = (ROOT / "src/templates/shell.html.j2").read_text(encoding="utf-8")
    index = (ROOT / "docs/index.html").read_text(encoding="utf-8")
    assert source_shell.count('href="musical/"') == 1
    assert index.count('href="musical/"') == 1
    assert '<h3>Follow the score</h3>' in index


def test_musical_has_local_navigation_offline_runtime_and_boundary():
    html = SOURCE.read_text(encoding="utf-8")
    assert '<main id="app"' in html
    assert 'href="../"' in html
    assert 'href="../canon/"' in html
    assert 'href="../records/"' in html
    assert 'href="AUTHORITY.md"' in html
    assert 'id="compendium-musical-frame"' in html
    assert 'A production notebook:' in html
    assert not re.search(r'<script\\b[^>]*\\bsrc\\s*=', html, flags=re.I)
    assert not re.search(r'<iframe\\b', html, flags=re.I)
    assert "Kyle" in html and "Kail" in html
    assert "Starbinding" in html and "Shardlings" in html
    assert "The Score" in html and "Archive & Audio" in html


def test_musical_not_assigned_canonical_section_identity():
    section_json = (ROOT / "src/content/sections.json").read_text(encoding="utf-8")
    assert '"id": "musical"' not in section_json
    authority = AUTHORITY.read_text(encoding="utf-8")
    assert "not a second canon source" in authority
    assert "not independent verification" in authority
