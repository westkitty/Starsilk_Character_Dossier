"""Phase 12 final integration: prove the root Compendium is visibly and
functionally the unified Starsilk shell, not merely the old dossier-only
shell with a couple of extra links -- and that every major system remains
reachable, resolvable, and consistently marked as part of the same shell.
See MUSEUM_AI_ROADMAP.md (Phase 12) and OPERATIONAL_STATE.md.

The root page intentionally has no separate top navigation bar (removed
per direct maintainer feedback -- the sticky top bar is reader controls
only: expand/collapse/index/search). Root navigation to every system is
via the exploration cards, positioned right after the cover section.
"""
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

MAJOR_SYSTEMS = [
    "discover", "entities", "objects", "relationships",
    "canon", "tours", "chronology", "worldsvault",
]


def root_soup():
    return BeautifulSoup((DOCS / "index.html").read_text(encoding="utf-8"), "html.parser")


def test_root_body_carries_deterministic_unified_shell_marker():
    soup = root_soup()
    body = soup.find("body")
    assert body is not None
    assert body.get("data-museum-shell") == "unified"
    assert soup.find("div", class_="museum-entrance", attrs={"data-museum-shell": "unified"}) is not None


def test_root_has_no_separate_nav_bar():
    """The sticky top bar on root is reader controls only (expand/collapse/
    index/search) -- no separate unified-nav header, per direct maintainer
    feedback. Every system is still reachable via the exploration cards."""
    soup = root_soup()
    assert soup.find("header", class_="museum-nav") is None
    assert soup.find(id="offlineCacheClear") is None
    assert soup.find(id="offlineStatus") is None
    controls = soup.find("div", class_="page-controls")
    assert controls is not None
    for control_id in ("expandAllBtn", "collapseAllBtn", "sidebarToggle", "dossierSearch"):
        assert controls.find(id=control_id) is not None, f"page-controls missing #{control_id}"


def test_root_hero_exposes_exploration_cards_for_every_system():
    soup = root_soup()
    modules = soup.find("div", class_="museum-module-grid")
    assert modules is not None
    hrefs = {a.get("href") for a in modules.find_all("a", class_="museum-module", href=True)}
    for system in MAJOR_SYSTEMS:
        assert f"{system}/" in hrefs, f"root exploration cards are missing {system}/"
    # Visitor-facing copy, not project-management phase labels or "museum" branding.
    text = modules.get_text(" ", strip=True)
    assert "Phase " not in text
    assert "museum" not in text.lower()


def test_root_hero_copy_has_no_museum_branding():
    soup = root_soup()
    assert "museum" not in soup.title.get_text().lower()
    hero = soup.find("section", class_="museum-hero")
    assert hero is not None
    assert "museum" not in hero.get_text(" ", strip=True).lower()


def test_root_cover_appears_before_the_exploration_cards():
    """The animated cover ("Starsilk Compendium") leads; the exploration
    cards follow it, not the other way around."""
    soup = root_soup()
    main = soup.find("main", id="mainContent")
    cover = main.find(id="cover")
    entrance = main.find("div", class_="museum-entrance")
    assert cover is not None and entrance is not None
    # cover must precede entrance in document order
    assert list(main.descendants).index(cover) < list(main.descendants).index(entrance)


def test_root_data_ai_area_is_secondary_and_links_machine_publication():
    soup = root_soup()
    strip = soup.find("section", class_="museum-data-strip")
    assert strip is not None
    hrefs = {a.get("href") for a in strip.find_all("a", href=True)}
    assert "agents/AGENT_GUIDE.md" in hrefs
    assert "machine/index.json" in hrefs


def test_root_full_compendium_still_present_unabridged():
    soup = root_soup()
    assert soup.find("aside", id="index") is not None
    assert soup.find("main", id="mainContent") is not None
    for stable_id in ("cover", "codec", "dao", "drk-the-egg", "peripheral-index"):
        assert soup.find(id=stable_id) is not None, f"legacy stable id #{stable_id} is missing from the root Compendium"


def test_root_preserves_search_expand_collapse_and_archive_tools_controls():
    soup = root_soup()
    assert soup.find(id="dossierSearch") is not None
    assert soup.find(id="expandAllBtn") is not None
    assert soup.find(id="collapseAllBtn") is not None
    assert soup.find(id="modeToggle") is not None
    assert soup.find(id="copyImplementationPrompt") is not None


def test_root_hero_stats_are_derived_not_hand_maintained():
    """Every number in the hero's stat strip must trace to an authoritative
    source/generated file, never a hardcoded literal that can drift."""
    soup = root_soup()
    stats = {}
    for row in soup.select(".museum-hero-stats > div"):
        dt, dd = row.find("dt"), row.find("dd")
        stats[dt.get_text(strip=True)] = dd.get_text(strip=True)

    sections = json.loads((ROOT / "src" / "content" / "sections.json").read_text(encoding="utf-8"))
    assert stats["Compendium records"] == str(len(sections["sections"]))

    manifest = json.loads((DOCS / "asset-manifest.json").read_text(encoding="utf-8"))
    assert stats["Published media objects"] == str(len(manifest["assets"]))

    tours = json.loads((ROOT / "src" / "tours" / "tours.json").read_text(encoding="utf-8"))
    tour_list = tours.get("tours", tours) if isinstance(tours, dict) else tours
    assert stats["Curated tours"] == str(len(tour_list))

    events = json.loads((ROOT / "src" / "chronology" / "events.json").read_text(encoding="utf-8"))
    event_list = events.get("events", events) if isinstance(events, dict) else events
    assert stats["Chronology events"] == str(len(event_list))

    invariants = json.loads((ROOT / "src" / "canon" / "invariants.json").read_text(encoding="utf-8"))
    expected_locks = len(invariants.get("document_locks", [])) + len(invariants.get("section_locks", []))
    assert stats["Machine-enforced canon locks"] == str(expected_locks)

    # Cross-referenced links is only known after xref linking finishes;
    # it must not still contain its internal placeholder token.
    assert stats["Cross-referenced links"].isdigit()
    assert "PLACEHOLDER" not in (DOCS / "index.html").read_text(encoding="utf-8")


def test_every_major_system_target_resolves_on_disk():
    for system in MAJOR_SYSTEMS:
        assert (DOCS / system / "index.html").exists(), f"docs/{system}/index.html does not exist"


def test_every_major_system_page_carries_the_same_unified_shell_and_links_home():
    for system in MAJOR_SYSTEMS:
        html = (DOCS / system / "index.html").read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        header = soup.find("header", class_="museum-nav", attrs={"data-museum-shell": "unified"})
        assert header is not None, f"{system}/index.html is missing the unified nav"
        nav = header.find("nav", attrs={"aria-label": "Unified Starsilk Compendium navigation"})
        assert nav is not None
        home_link = nav.find("a", attrs={"href": "../"})
        assert home_link is not None and "Home" in home_link.get_text()
        active = nav.find("a", attrs={"aria-current": "page"})
        assert active is not None, f"{system}/index.html unified nav has no active marker"


def test_entity_record_pages_also_carry_the_unified_shell():
    html = (DOCS / "entities" / "codec" / "index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    header = soup.find("header", class_="museum-nav", attrs={"data-museum-shell": "unified"})
    assert header is not None
    home_link = header.find("a", attrs={"href": "../../"})
    assert home_link is not None


def test_no_external_runtime_dependency_in_shared_nav():
    for system in MAJOR_SYSTEMS:
        path = DOCS / system / "index.html"
        soup = BeautifulSoup(path.read_text(encoding="utf-8"), "html.parser")
        header = soup.find("header", class_="museum-nav")
        assert header is not None
        for a in header.find_all("a", href=True):
            assert not a["href"].startswith(("http://", "https://")), (
                f"unified nav in {path} links externally: {a['href']}"
            )


# ==============================================================================
# BROWSER JOURNEY (Chromium; representative journeys also run in
# tests/test_cross_browser.py across Firefox/WebKit)
# ==============================================================================

def test_unified_shell_desktop_journey(page: Page, local_server):
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{local_server}/index.html")
    expect(page.locator('[data-museum-shell="unified"]').first).to_be_visible()
    page.locator("a.museum-module[href='discover/']").click()
    expect(page).to_have_url(f"{local_server}/discover/")
    expect(page.locator('header.museum-nav[data-museum-shell="unified"]')).to_be_visible()
    page.locator(".museum-nav-links a[href='../']").first.click()
    expect(page).to_have_url(f"{local_server}/")


def test_unified_shell_mobile_layout_has_no_overflow(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/index.html")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    expect(page.locator(".page-controls")).to_be_visible()
    page.locator("#menuToggle").click()
    expect(page.locator("#index")).to_have_class(re.compile(r"\bopen\b"))
