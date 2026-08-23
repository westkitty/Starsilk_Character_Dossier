#!/usr/bin/env python3
"""Rebrand the cover title ("STARSILK DOSSIER" -> "Starsilk Compendium",
keeping "Starsilk" itself unbroken as one word) and replace the cover's
decorative background with a looping hero video.

The hero video: autoplays muted (audio is stripped -- it isn't needed and
this also satisfies browser autoplay-without-user-gesture policy), fills
the cover section behind the title text, fades out at its edges via a
gradient + vignette overlay so it blends into the page's background color
rather than showing a hard rectangle, and once played through once, loops
only its last couple of seconds indefinitely (rather than restarting from
the top) so it settles into a short ambient cycle instead of replaying the
whole intro every ~10 seconds.

Usage: python3 tools/add_hero_video_and_rebrand.py [--source "/path/to/video.mp4"]
Defaults to ROOT / "starsilk header.mp4". Requires ffmpeg on PATH to strip
audio and extract a poster frame (falls back to using the source video
as-is, with audio muted only via the HTML attribute, and no poster, if
ffmpeg isn't available).

Idempotent: safe to re-run (checks a marker before editing).
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
INDEX = DOCS / "index.html"
MANIFEST = DOCS / "asset-manifest.json"
MEDIA_DIR = DOCS / "assets" / "media"

TITLE_MARKER = "<h1>Starsilk<span>Compendium</span></h1>"
HERO_MARKER = 'class="hero-video-wrap"'

CSS_MARKER = "/* Hero video header */"
CSS_ADDITION = """
/* Hero video header */
.hero-video-wrap{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.hero-video{width:100%;height:100%;object-fit:cover;display:block}
.hero-video-fade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,16,27,.3) 0%,rgba(7,16,27,.22) 35%,rgba(7,16,27,.6) 72%,#07101b 100%),radial-gradient(ellipse 75% 75% at 50% 45%,transparent 40%,rgba(7,16,27,.68) 100%)}
.cover .eyebrow,.cover h1,.cover .edition-label,.cover .deck,.cover .cover-rule,.cover .tag-row{position:relative;z-index:2}
@media(prefers-reduced-motion: reduce){.hero-video{display:none}.hero-video-wrap{background:#07101b}}
@media print{.hero-video-wrap{display:none!important}}
""".rstrip("\n")

JS_MARKER = "// Hero video: autoplay, then loop just the tail"
HERO_JS = """
  // Hero video: autoplay, then loop just the tail
  (function(){
    var heroVideo = document.querySelector('.hero-video');
    if(!heroVideo) return;
    var TAIL_SECONDS = 2.5;
    var loopToTail = function(){
      if(!heroVideo.duration || !isFinite(heroVideo.duration)) return;
      try { heroVideo.currentTime = Math.max(0, heroVideo.duration - TAIL_SECONDS); } catch(e){}
      var p = heroVideo.play();
      if(p && p.catch) p.catch(function(){});
    };
    heroVideo.addEventListener('ended', loopToTail);
    heroVideo.addEventListener('timeupdate', function(){
      if(heroVideo.duration && heroVideo.currentTime >= heroVideo.duration - 0.1) loopToTail();
    });
    if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      heroVideo.pause();
      heroVideo.removeAttribute('autoplay');
    }
  })();
"""

EXT_MAP = {"png": "png", "jpeg": "jpg", "jpg": "jpg", "mp4": "mp4"}


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def register_asset(manifest: dict, src: Path, contexts, mime_type: str) -> str:
    """Hash-copy src into docs/assets/media/ (dedup by hash) and return its filename."""
    assets_by_hash = {a["sha256"]: a for a in manifest["assets"]}
    existing_filenames = {a["filename"] for a in manifest["assets"]}
    digest = sha256_of(src)
    if digest in assets_by_hash:
        return assets_by_hash[digest]["filename"]
    ext = EXT_MAP.get(src.suffix.lstrip(".").lower(), src.suffix.lstrip("."))
    hash24 = digest[:24]
    filename = f"{hash24}.{ext}"
    suffix = 0
    while filename in existing_filenames:
        suffix += 1
        filename = f"{hash24}-{suffix}.{ext}"
    shutil.copy2(src, MEDIA_DIR / filename)
    manifest["assets"].append({
        "sha256": digest,
        "mime_type": mime_type,
        "filename": filename,
        "bytes": src.stat().st_size,
        "reference_count": 1,
        "contexts": contexts,
    })
    return filename


def prepare_video_assets(source_video: Path, work_dir: Path):
    """Returns (video_path, poster_path_or_None). Strips audio and extracts a
    poster frame via ffmpeg when available; otherwise uses the source as-is
    with no poster."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("WARNING: ffmpeg not found on PATH; using source video with audio intact "
              "(still muted via the HTML attribute) and no poster frame.")
        return source_video, None

    work_dir.mkdir(parents=True, exist_ok=True)
    no_audio = work_dir / "hero-noaudio.mp4"
    poster = work_dir / "hero-poster.jpg"

    r1 = subprocess.run(
        [ffmpeg, "-y", "-i", str(source_video), "-an", "-c:v", "copy", str(no_audio)],
        capture_output=True, text=True,
    )
    if r1.returncode != 0 or not no_audio.exists():
        print(f"WARNING: ffmpeg audio-strip failed ({r1.returncode}); using source video as-is.")
        no_audio = source_video

    r2 = subprocess.run(
        [ffmpeg, "-y", "-i", str(source_video), "-vf", "select=eq(n\\,0)", "-vframes", "1", "-q:v", "2", str(poster)],
        capture_output=True, text=True,
    )
    if r2.returncode != 0 or not poster.exists():
        print(f"WARNING: ffmpeg poster extraction failed ({r2.returncode}); no poster frame.")
        poster = None

    return no_audio, poster


def apply_css(html: str) -> str:
    if CSS_MARKER in html:
        return html
    return html.replace("</style>", CSS_ADDITION + "\n</style>", 1)


def apply_title_rename(html: str) -> str:
    if TITLE_MARKER in html:
        return html
    old_h1 = "<h1>STAR<span>SILK DOSSIER</span></h1>"
    if old_h1 not in html:
        print("WARNING: cover <h1> not found in expected form; title not renamed.")
        return html
    html = html.replace(old_h1, TITLE_MARKER, 1)
    old_title_tag = "<title>Starsilk — Character Dossier</title>"
    new_title_tag = "<title>Starsilk — Compendium</title>"
    if old_title_tag in html:
        html = html.replace(old_title_tag, new_title_tag, 1)
    return html


def apply_hero_markup(html: str, video_filename: str, poster_filename) -> str:
    if HERO_MARKER in html:
        return html
    anchor = '<section class="page cover" data-folio="00" id="cover">'
    if anchor not in html:
        print("WARNING: cover section opening tag not found; hero video not inserted.")
        return html
    poster_attr = f' poster="assets/media/{poster_filename}"' if poster_filename else ""
    video_html = (
        '<div class="hero-video-wrap">'
        f'<video class="hero-video" autoplay muted playsinline preload="auto"{poster_attr} aria-hidden="true">'
        f'<source src="assets/media/{video_filename}" type="video/mp4"/>'
        "</video>"
        '<div class="hero-video-fade"></div>'
        "</div>"
    )
    return html.replace(anchor, anchor + video_html, 1)


def apply_js(html: str) -> str:
    if JS_MARKER in html:
        return html
    tail = "</script>\n</body></html>"
    if tail not in html:
        print("WARNING: end-of-body script anchor not found; hero video loop JS not added.")
        return html
    return html.replace(tail, HERO_JS + tail, 1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=str(ROOT / "starsilk header.mp4"), help="Path to the source hero video")
    args = ap.parse_args()

    source_video = Path(args.source)
    if not INDEX.exists() or not MANIFEST.exists():
        print("ERROR: docs/index.html or docs/asset-manifest.json not found", file=sys.stderr)
        return 1

    html = INDEX.read_text(encoding="utf-8")

    # Only prepare/register media assets when the <video> markup still needs
    # inserting -- video_filename stays None otherwise, so apply_hero_markup
    # is skipped below. Deliberately NOT a single combined early-return: if
    # apply_ux_audit_fixes.py is re-run after this script (it fully rewrites
    # <style> and the trailing <script> blocks -- see its own ORDERING NOTE),
    # the body markup this script inserted survives untouched while its CSS
    # and JS get wiped. Each apply_* below checks its own marker
    # independently, so re-running this script self-heals that case instead
    # of seeing HERO_MARKER already in the body and skipping everything.
    video_filename = None
    poster_filename = None
    if HERO_MARKER not in html:
        if not source_video.exists():
            print(f"ERROR: source video not found: {source_video}", file=sys.stderr)
            return 1
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        video_path, poster_path = prepare_video_assets(source_video, ROOT / ".hero_video_work")
        video_filename = register_asset(
            manifest, video_path,
            contexts=[{"section_id": "cover", "alt": "Starsilk hero header — looping ambient background video."}],
            mime_type="video/mp4",
        )
        if poster_path:
            poster_filename = register_asset(
                manifest, poster_path,
                contexts=[{"section_id": "cover", "alt": "Starsilk hero header poster frame."}],
                mime_type="image/jpeg",
            )
        manifest["unique_binary_assets"] = len(manifest["assets"])
        manifest["total_unique_binary_size_bytes"] = sum(a["bytes"] for a in manifest["assets"])
        MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    html = apply_css(html)
    html = apply_title_rename(html)
    if video_filename:
        html = apply_hero_markup(html, video_filename, poster_filename)
    html = apply_js(html)
    INDEX.write_text(html, encoding="utf-8")

    work_dir = ROOT / ".hero_video_work"
    if work_dir.exists():
        shutil.rmtree(work_dir)

    print(f"Wrote {INDEX}")
    if video_filename:
        print(f"Hero video: assets/media/{video_filename}" + (f", poster assets/media/{poster_filename}" if poster_filename else " (no poster)"))
    else:
        print("Hero video markup already present; only re-checked CSS/JS/title markers.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
