"""Shared fixtures for the Starsilk Compendium test suite."""
import http.server
import re
import socketserver
import threading
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Adds HTTP Range support (206 Partial Content), which Python's stock
    http.server lacks. Real production hosting (GitHub Pages / Fastly)
    supports Range requests; without it here, Chromium reports a
    degenerate empty `video.seekable` range even for a fully-buffered
    local video, which would make any test of actual seek behavior
    (e.g. the hero video's tail-loop) meaningless against this dev server."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DOCS), **kwargs)

    def log_message(self, format, *args):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        range_header = self.headers.get("Range")
        if not range_header or not Path(path).is_file():
            return super().send_head()

        file_size = Path(path).stat().st_size
        m = re.match(r"bytes=(\d*)-(\d*)", range_header)
        if not m or not (m.group(1) or m.group(2)):
            return super().send_head()

        start_s, end_s = m.group(1), m.group(2)
        if start_s == "":
            length = min(int(end_s), file_size)
            start, end = file_size - length, file_size - 1
        else:
            start = int(start_s)
            end = min(int(end_s), file_size - 1) if end_s else file_size - 1
        if start >= file_size or start > end:
            self.send_error(416, "Requested Range Not Satisfiable")
            return None

        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        ctype = self.guess_type(path)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._range = (start, end)
        return f

    def copyfile(self, source, outputfile):
        if hasattr(self, "_range"):
            start, end = self._range
            remaining = end - start + 1
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
            return
        super().copyfile(source, outputfile)


class QuietThreadingServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        pass


@pytest.fixture(scope="session", autouse=True)
def local_server():
    """Serve docs/ over a multithreaded HTTP server for browser tests."""
    server = QuietThreadingServer(("127.0.0.1", 0), QuietHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.1)
    yield f"http://127.0.0.1:{port}"
    server.shutdown()


VISUAL_BASELINES = Path(__file__).resolve().parent / "visual_baselines"


def assert_matches_baseline(png_bytes: bytes, name: str, max_diff_ratio: float = 0.05):
    """Hand-rolled screenshot-regression comparison (pytest-playwright's
    Python API has no built-in to_have_screenshot() -- that's a JS
    @playwright/test-only feature). Baselines live in
    tests/visual_baselines/; if one doesn't exist yet it's created from
    this run (bootstrap) and the check passes. Delete/replace a baseline
    deliberately after an intentional design change."""
    from io import BytesIO

    from PIL import Image, ImageChops

    VISUAL_BASELINES.mkdir(parents=True, exist_ok=True)
    baseline_path = VISUAL_BASELINES / name
    current = Image.open(BytesIO(png_bytes)).convert("RGB")

    if not baseline_path.exists():
        current.save(baseline_path)
        return

    baseline = Image.open(baseline_path).convert("RGB")
    if baseline.size != current.size:
        diff_path = VISUAL_BASELINES / f"FAILED-{name}"
        current.save(diff_path)
        raise AssertionError(
            f"{name}: baseline size {baseline.size} != current size {current.size} "
            f"(viewport/layout changed -- update the baseline deliberately if intended). "
            f"Current render saved to {diff_path} for inspection."
        )

    diff = ImageChops.difference(baseline, current)
    bbox = diff.getbbox()
    if bbox is None:
        return
    hist = diff.convert("L").histogram()
    # Antialiasing/minor rendering noise shows up as small per-pixel deltas;
    # only count pixels that differ meaningfully (luma delta > 24) as real.
    changed_pixels = sum(hist[24:])
    total_pixels = current.size[0] * current.size[1]
    ratio = changed_pixels / total_pixels
    if ratio > max_diff_ratio:
        diff_path = VISUAL_BASELINES / f"FAILED-{name}"
        current.save(diff_path)
        raise AssertionError(
            f"{name}: {ratio:.2%} of pixels differ from baseline (threshold {max_diff_ratio:.0%}). "
            f"Current render saved to {diff_path} for inspection."
        )


def fresh_server():
    """A standalone (non-fixture) server instance, for tests that need
    request-log isolation from the rest of the suite."""
    server = QuietThreadingServer(("127.0.0.1", 0), QuietHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    time.sleep(0.1)
    return server, f"http://127.0.0.1:{port}"
