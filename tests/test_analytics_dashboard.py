import json
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
ANALYTICS = DOCS / "analytics"
SITE_BASE = "https://westkitty.github.io/Starsilk_Character_Dossier/"
EXPECTED_FILES = {"index.html", "analytics.css", "analytics.js", "analytics.json", "analytics.md", "AUTHORITY.md"}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_analytics_is_exact_build_owned_and_deterministic():
    actual = {path.relative_to(ANALYTICS).as_posix() for path in ANALYTICS.rglob("*") if path.is_file()}
    assert actual == EXPECTED_FILES
    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert '"$PY" build/analytics_publication.py --check' in build
    assert build.count("build/analytics_publication.py") >= 3
    proc = subprocess.run([sys.executable, "build/analytics_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "analytics outputs match generator output" in proc.stdout


def test_sample_dataset_is_coherent_and_internally_consistent():
    source = read_json(ROOT / "src/analytics/dashboard.json")
    model = read_json(ANALYTICS / "analytics.json")
    assert model["schema"] == "starsilk-analytics-dashboard/1"
    assert model["audience"] == "fans"
    assert model["data_kind"] == "illustrative-sample"
    assert model["canonical_url"] == SITE_BASE + "analytics/"
    assert model["data_url"] == SITE_BASE + "analytics/analytics.json"
    assert model["generated_from"] == {
        "source": "src/analytics/dashboard.json",
        "seed": source["sample_data"]["seed"],
        "generator": "build/analytics_publication.py",
    }
    assert model["day_count"] == source["sample_data"]["days"] == 180
    assert model["end_date"] == source["sample_data"]["end_date"] == "2026-09-09"

    rows = model["daily"]
    assert len(rows) == 180
    for first, second in zip(rows, rows[1:]):
        assert (date.fromisoformat(second["date"]) - date.fromisoformat(first["date"])).days == 1
    seg_ids = [seg["id"] for seg in model["segments"]]
    assert [seg["id"] for seg in source["segments"]] == seg_ids
    for row in rows:
        assert set(row["by_segment"]) == set(seg_ids)
        assert sum(seg["visits"] for seg in row["by_segment"].values()) == row["visits"]
        assert sum(seg["readers"] for seg in row["by_segment"].values()) == row["readers"]
        assert sum(seg["dwell_sec"] for seg in row["by_segment"].values()) == row["dwell_sec"]
        assert sum(seg["completions"] for seg in row["by_segment"].values()) == row["completions"]
        assert len(row["by_folio"]) == len(model["folios"])
        assert sum(row["by_folio"]) == row["visits"]
        assert 0 < row["readers"] <= row["visits"]

    # Affinity favorites are exact; other cells stay in the declared jitter band.
    sample = source["sample_data"]
    by_seg = {seg["id"]: seg for seg in source["segments"]}
    for seg_id, affinities in model["affinity"].items():
        favorite = by_seg[seg_id]["favorite_collection"]
        for folio, value in zip(source["folios"], affinities):
            if folio["collection"] == favorite:
                assert value == sample["affinity_favorite"]
            else:
                assert sample["affinity_other"] <= value <= sample["affinity_other"] + sample["affinity_jitter"]

    # Every folio link target resolves on disk.
    for folio in model["folios"]:
        assert folio["rel"].startswith("../")
        target = (ANALYTICS / folio["rel"] / "index.html").resolve()
        assert target.is_file(), f"folio link target missing: {folio['id']} -> {folio['rel']}"

    # Declared event spikes land inside the window and lift traffic.
    median = sorted(row["visits"] for row in rows)[len(rows) // 2]
    for event in model["events"]:
        day = date.fromisoformat(event["date"])
        window = [row for row in rows if abs((date.fromisoformat(row["date"]) - day).days) <= event["span"]]
        assert window and max(row["visits"] for row in window) > median * 1.3


def test_dashboard_labels_sample_data_and_loads_no_remote_resources():
    html = (ANALYTICS / "index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    assert "Sample data" in soup.get_text()
    assert "illustrative sample data" in soup.get_text().lower()
    assert soup.find("body").get("data-museum-shell") == "unified"
    assert soup.find("header", class_="museum-nav") is not None
    for tag, attr in (("script", "src"), ("img", "src"), ("link", "href")):
        for el in soup.find_all(tag):
            value = el.get(attr) or ""
            if tag == "link" and el.get("rel") == ["canonical"]:
                assert value == SITE_BASE + "analytics/"
                continue
            assert not value.startswith(("http://", "https://")), f"remote resource: {value}"
            if value and not value.startswith(("#", "../", "mailto:")):
                assert (ANALYTICS / value).is_file(), f"missing local asset: {value}"
    assert "analytics.json" in html and "analytics.js" in html and "analytics.css" in html


def test_dashboard_dom_has_required_controls():
    soup = BeautifulSoup((ANALYTICS / "index.html").read_text(encoding="utf-8"), "html.parser")
    for control_id in ("anaTheme", "anaStatus", "anaFrom", "anaTo", "anaApply", "anaReset", "anaSegment",
                       "lineLegend", "lineChart", "barChart", "donutChart", "donutLegend",
                       "folioSearch", "folioCollection", "folioExport", "folioCount", "folioBody"):
        assert soup.find(id=control_id) is not None, f"missing #{control_id}"
    for kpi in ("visits", "readers", "dwell", "completions"):
        card = soup.select_one(f'.ana-kpi[data-kpi="{kpi}"]')
        assert card is not None
        assert card.select_one(".ana-kpi-value") is not None
        assert card.select_one(".ana-delta") is not None
        assert card.select_one(".ana-kpi-spark") is not None
    presets = [btn.get("data-preset") for btn in soup.select(".ana-segmented button[data-preset]")]
    assert presets == ["7d", "30d", "90d", "all"]
    sorts = [btn.get("data-sort") for btn in soup.select("th button[data-sort]")]
    assert sorts == ["folio", "views", "readers", "dwell", "completion", "trend"]
    assert soup.find("html").get("data-theme") == "dark"


def test_dashboard_javascript_parses():
    node = shutil.which("node")
    if node is None:
        import pytest
        pytest.skip("node unavailable")
    proc = subprocess.run([node, "--check", str(ANALYTICS / "analytics.js")], text=True, capture_output=True)
    assert proc.returncode == 0, proc.stderr


def test_dashboard_filters_update_every_view_and_theme_toggles(page, local_server):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto(f"{local_server}/analytics/")
    expect(page.locator("#anaStatus")).to_contain_text("Updated:")
    expect(page.locator("#anaStatus")).to_contain_text("30 days")
    visits_before = page.locator('.ana-kpi[data-kpi="visits"] .ana-kpi-value').inner_text()
    assert visits_before not in ("", "—")
    assert page.locator("#folioBody tr").count() == 14
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    page.locator("#anaSegment").select_option("archivists")
    expect(page.locator("#anaStatus")).to_contain_text("Archivists")
    expect(page.locator('.ana-kpi[data-kpi="visits"] .ana-kpi-value')).not_to_have_text(visits_before)

    page.locator('.ana-segmented button[data-preset="7d"]').click()
    expect(page.locator("#anaStatus")).to_contain_text("7 days")

    page.locator('th button[data-sort="folio"]').click()
    expect(page.locator("#folioBody tr").first).to_contain_text("Abyssoriel")
    page.locator("#folioSearch").fill("dao")
    expect(page.locator("#folioBody tr")).to_have_count(1)
    expect(page.locator("#folioCount")).to_contain_text("Showing 1 of 14 folios")

    page.locator("#anaTheme").click()
    assert page.evaluate("document.documentElement.getAttribute('data-theme')") == "light"
    page.locator("#anaTheme").click()
    assert page.evaluate("document.documentElement.getAttribute('data-theme')") == "dark"
