import json
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def test_offline_publication_is_deterministic_build_owned_and_small():
    proc = subprocess.run([sys.executable, "build/offline_publication.py", "--check"], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "6 offline museum outputs match generator output" in proc.stdout

    build = (ROOT / "tools/build.sh").read_text(encoding="utf-8")
    assert "build/offline_publication.py" in build
    assert "docs/service-worker.js" in build

    config = json.loads((ROOT / "src/offline/config.json").read_text(encoding="utf-8"))
    assert config["schema"] == "starsilk-offline-museum/1"
    assert config["media_policy"] == "on-demand-never-service-worker-cached"
    assert len(config["precache"]) == len(set(config["precache"]))
    assert all(not item.startswith("/") and "assets/media" not in item for item in config["precache"])
    assert sum((DOCS / ("index.html" if item == "." else item)).stat().st_size for item in config["precache"]) < 2_000_000


def test_install_metadata_root_controls_and_worker_keep_media_on_demand():
    root = BeautifulSoup((DOCS / "index.html").read_text(encoding="utf-8"), "lxml")
    manifest_link = root.select_one("link[rel='manifest']")
    assert manifest_link and manifest_link["href"] == "manifest.webmanifest"
    assert root.select_one("#offlineCacheClear")
    status = root.select_one("#offlineStatus")
    assert status and status.get("role") == "status" and status.get("aria-live") == "polite"
    assert root.select_one("script[src='offline-client.js']")

    manifest = json.loads((DOCS / "manifest.webmanifest").read_text(encoding="utf-8"))
    assert manifest["start_url"] == manifest["scope"] == "./"
    assert manifest["display"] == "standalone"
    assert manifest["icons"] == [{"src": "offline-icon.svg", "sizes": "192x192", "type": "image/svg+xml", "purpose": "any maskable"}]

    client = (DOCS / "offline-client.js").read_text(encoding="utf-8")
    worker = (DOCS / "service-worker.js").read_text(encoding="utf-8")
    assert "register('service-worker.js', {scope: './'})" in client
    assert "CLEAR_STARSILK_OFFLINE_CACHE" in client
    assert "clearButton.disabled = true" in client
    assert "MEDIA_PATH" in worker and "isPublishedMedia(request)" in worker
    assert "assets/media" not in worker.split("const PRECACHE", 1)[1].split("const OFFLINE_FALLBACK", 1)[0]
    assert "cache.put" not in worker
    assert "caches.match(OFFLINE_FALLBACK)" in worker
    assert "fetch(request).catch" in worker


def test_offline_shell_populates_without_media_and_can_be_cleared(page: Page, local_server):
    page.goto(f"{local_server}/index.html")
    page.wait_for_function("""async () => {
        const registration = await navigator.serviceWorker.ready;
        return Boolean(registration.active);
    }""")
    cache_state = page.evaluate("""async () => {
        const names = await caches.keys();
        const owned = names.filter((name) => name.startsWith('starsilk-offline-shell-'));
        const requests = await (await caches.open(owned[0])).keys();
        return {owned, urls: requests.map((request) => request.url)};
    }""")
    assert len(cache_state["owned"]) == 1
    assert len(cache_state["urls"]) == len(json.loads((ROOT / "src/offline/config.json").read_text(encoding="utf-8"))["precache"])
    assert not any("/assets/media/" in url for url in cache_state["urls"])

    page.locator("#offlineCacheClear").click()
    expect(page.locator("#offlineStatus")).to_contain_text("Offline cache cleared")
    page.wait_for_function("""async () => {
        return (await caches.keys()).filter((name) => name.startsWith('starsilk-offline-shell-')).length === 0;
    }""")


def test_offline_navigation_uses_the_explicit_fallback(page: Page, local_server):
    page.goto(f"{local_server}/index.html")
    page.wait_for_function("""async () => {
        const registration = await navigator.serviceWorker.ready;
        return Boolean(registration.active);
    }""")
    page.context.set_offline(True)
    try:
        page.goto(f"{local_server}/", wait_until="domcontentloaded")
        expect(page.locator("#cover h1")).to_have_text("Starsilk Compendium")
        page.goto(f"{local_server}/unavailable-while-offline", wait_until="domcontentloaded")
        expect(page.locator("h1")).to_have_text("The archive is not reachable right now.")
        expect(page.locator("a[href='index.html']")).to_be_visible()
    finally:
        page.context.set_offline(False)
