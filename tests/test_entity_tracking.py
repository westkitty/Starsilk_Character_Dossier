import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check_ignored(relative: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "check-ignore", "-q", relative],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )


def test_generated_entity_permalink_paths_are_not_git_ignored():
    sections = json.loads((ROOT / "src/content/sections.json").read_text(encoding="utf-8"))["sections"]
    ids = [section["id"] for section in sections]
    for stable_id in ids:
        result = check_ignored(f"docs/entities/{stable_id}/index.html")
        assert result.returncode == 1, f"stable permalink path is ignored: {stable_id}"


def test_local_offline_archive_directory_remains_ignored():
    result = check_ignored("archive/offline-source.html")
    assert result.returncode == 0
