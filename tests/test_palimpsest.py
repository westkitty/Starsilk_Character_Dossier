import json
import re
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_palimpsest_source_contract_uses_existing_stable_ids_only():
    experience = read_json(ROOT / "src/palimpsest/experience.json")
    section_ids = {item["id"] for item in read_json(ROOT / "src/content/sections.json")["sections"]}
    assert experience["schema"] == "starsilk-palimpsest-experience/1"
    assert experience["state_policy"] == "session-only-noncanonical"
    assert experience["editorial_claim"] == "Tiger saved us from the Drakken."
    phases = experience["phases"]
    assert len({phase["phase_id"] for phase in phases}) == len(phases)
    for phase in phases:
        assert phase["source_stable_ids"]
        assert set(phase["source_stable_ids"]) <= section_ids
    authority = (ROOT / "src/palimpsest/AUTHORITY.md").read_text(encoding="utf-8")
    assert "presentation system, not a canon database" in authority
    assert "visitor choice never changes canon" in authority
    assert "sessionStorage" in authority
    assert "analytics" in authority


def test_palimpsest_publication_is_deterministic_and_boundary_marked():
    proc = subprocess.run([sys.executable, "build/palimpsest_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "Palimpsest outputs match generator output" in proc.stdout
    out = DOCS / "palimpsest"
    assert {p.name for p in out.iterdir() if p.is_file()} == {
        "index.html", "palimpsest.css", "palimpsest.js", "experience.json", "schema.json", "AUTHORITY.md"
    }
    soup = BeautifulSoup((out / "index.html").read_text(encoding="utf-8"), "html.parser")
    assert soup.find("body", attrs={"data-palimpsest": "first-contact"}) is not None
    nav = soup.find("header", class_="museum-nav", attrs={"data-museum-shell": "unified"})
    assert nav is not None
    active = nav.find("a", attrs={"aria-current": "page"})
    assert active and active.get_text(strip=True) == "Palimpsest"
    for tag in soup.find_all("script", src=True):
        assert not tag["src"].startswith(("http://", "https://"))
    for tag in soup.find_all("link", href=True):
        if tag.get("rel") == ["canonical"]:
            continue
        assert not tag["href"].startswith(("http://", "https://"))


def test_palimpsest_browser_journey_has_no_morality_score(page: Page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/palimpsest/")
    expect(page.locator("h1")).to_have_text("Starsilk: Palimpsest")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    page.locator("#beginWitness").click()
    expect(page.locator("#phase-star-law")).to_be_visible()
    page.locator("#extractStar").click()
    expect(page.locator("#starEvidence")).to_be_visible()
    page.locator("#starEvidence [data-next='blood-ring']").click()

    page.locator("#ringFilter").fill("0")
    expect(page.locator("#ringEvidence")).to_be_visible()
    page.locator("#ringEvidence [data-next='nacreous']").click()
    expect(page.locator("#phase-nacreous")).to_contain_text("There is no morality score.")

    page.locator("[data-nacreous-choice='withhold']").click()
    expect(page.locator("#nacreousEvidence")).to_contain_text("CODEC AUTHORIZED")
    page.locator("#nacreousEvidence [data-next='siege-wall']").click()

    for _ in range(9):
        if page.locator("#wallEvidence").is_visible():
            break
        page.locator("#containButton").click()
    expect(page.locator("#wallEvidence")).to_be_visible()
    page.locator("#wallEvidence [data-next='beyond-wall']").click()

    page.locator("#timeSlider").fill("6")
    expect(page.locator("#contactFrame")).to_be_visible()
    page.locator("#receiveHail").click()
    expect(page.locator("#wordstreamMessage")).to_contain_text("AID?")
    page.locator("#beyondEvidence [data-next='witness-record']").click()

    expect(page.locator("#phase-witness-record")).to_be_visible()
    expect(page.locator("#witnessLedger")).to_contain_text("withhold")
    page.locator("[data-final-word='us']").click()
    expect(page.locator("#claimInspector")).to_contain_text("UNRESOLVED REFERENT")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


def test_palimpsest_restart_clears_session_witness_state(page: Page, local_server):
    page.goto(f"{local_server}/palimpsest/")
    page.locator("#beginWitness").click()
    page.locator("#extractStar").click()
    expect(page.locator("[data-rail='star-law']")).to_have_class(re.compile(r"\bis-witnessed\b"))
    page.locator("#restartWitness").click()
    expect(page.locator("#phase-claim")).to_be_visible()
    page.wait_for_function("sessionStorage.getItem('starsilk-palimpsest-session-v1') !== null")
    state = page.evaluate("JSON.parse(sessionStorage.getItem('starsilk-palimpsest-session-v1'))")
    assert state["witnessed"] == []
    assert state["phase"] == "claim"
