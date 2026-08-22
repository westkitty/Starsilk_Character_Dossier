#!/usr/bin/env python3
"""Art-integration pass #2: add the brand-kit background watermark, match
WorldsVault planetary-template art by exact name, and add additional
Shard-God Tiger archival plates from the local Drive sources.

Does NOT regenerate docs/ from the offline archive HTML -- edits the
existing generated site in place, exactly like import_drakken_art.py.

Usage:
  python3 tools/import_brandkit_worldsvault_shardgod.py \
    --brandkit "/path/to/Starsilk BrandKit" \
    --planetary "/path/to/Starsilk_PlanetaryTemplates" \
    --shardgod "/path/to/shard-god" \
    --site docs
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EXT_MAP = {"png": "png", "jpeg": "jpg", "jpg": "jpg", "webp": "webp", "gif": "gif", "mp4": "mp4"}

# --------------------------------------------------------------------------
# Brand-kit background watermark: several Starsilk-strand loops, cycled by
# a small inline script. All verified as the same on-brand cyan-strand
# motion graphic on black (no unrelated content).
# --------------------------------------------------------------------------
BRANDKIT_CLIPS = [
    "grok_video_2026-04-10-03-54-13.mp4",
    "grok_video_2026-04-10-03-54-18.mp4",
    "grok_video_2026-04-10-03-58-55.mp4",
    "grok_video_2026-04-10-04-00-45.mp4",
    "grok_video_2026-04-10-04-05-16.mp4",
    "grok_video_2026-04-10-04-08-17.mp4",
]

# --------------------------------------------------------------------------
# WorldsVault: exact-name matches only. Verified visually against each
# template's canon description; sequential codec_s## numbering (s53=XX
# through s63=XXX) independently corroborates the ordering. Templates with
# no confident source (Cumulon II, Altostratus V, Stratiform V) are
# deliberately omitted -- no guessing by category/visual similarity.
# --------------------------------------------------------------------------
WORLDSVAULT_MAP = {
    "Syrrian IV": "codec_worldsvault_board01_panel006_syrrian-four-islands.png",
    "Nimbus III": "codec_worldsvault_board01_panel007_nimbus-three-glows.png",
    "Cirrus I": "run 5/consolidated/worldsvault_board03_panel025_cirrus-one.png",
    "Nimbostrata VI": "run 5/consolidated/worldsvault_board03_panel026_nimbostrata-six.png",
    "Altocirrus I": "codec_s34_altocirrus_mirrored_dawn.png",
    "Nimbocastor II": "codec_s35_nimbocastor_singing_storms.png",
    "Stratus III": "codec_s36_stratus_quartz_towers.png",
    "Contrail XX": "codec_s53_contrail_frozen_desert.png",
    "Fogbank XXI": "codec_s54_fogbank_mirror_haze.png",
    "Vaporous XXII": "codec_s55_vaporous_solid_seas.png",
    "Spindrift XXIII": "codec_s56_spindrift_wind_nations.png",
    "Anemone XXIV": "codec_s57_anemone_coral_clouds.png",
    "Nacreous VI / XXV": "codec_s58_nacreous_pearl_memory_rain.png",
    "Mistline XXVI": "codec_s59_mistline_breath_continents.png",
    "Halitus XXVII": "codec_s60_halitus_ice_oceans_storms.png",
    "Prismatic XXVIII": "codec_s61_prismatic_color_alive.png",
    "Driftveil XXIX": "codec_s62_driftveil_static_hymns.png",
    "Cirrulite XXX": "codec_s63_cirrulite_language_rings.png",
}
WORLDSVAULT_UNMATCHED = ["Cumulon II", "Altostratus V", "Stratiform V"]

# --------------------------------------------------------------------------
# Shard-God: additional archival plates. Every candidate was visually
# checked against the visual-identity lock (single tail, digitigrade, no
# cape, obsidian/cyan) before inclusion. Images with unconfirmed extra
# iconography (masked crowd figures, glitching human overlays) were
# deliberately excluded as speculative rather than locked canon.
# --------------------------------------------------------------------------
SHARDGOD_PLATES = [
    {
        "file": "grok-ff7b1fc0-7614-4238-909e-b59dfdbaf6a9.jpg",
        "label": "Full Turnaround — Front / Back / Side / Materials",
        "alt": "Shard-God Tiger front, back and side turnaround with claw detail, crystal spike detail and material swatches.",
    },
    {
        "file": "grok-6f1864c0-0a0a-4709-8c2e-e9818b455e40.jpg",
        "label": "Expression and Pose Studies",
        "alt": "Shard-God Tiger expression studies (roaring, calm predatory, snarling, energy blast, weary, furious) and pose studies (crouch ready, lunging attack, rearing up, walking stalk).",
    },
    {
        "file": "media__1785455749265.png",
        "label": "Close Portrait Study",
        "alt": "Shard-God Tiger close portrait study showing obsidian skin, cyan crystalline spines and glowing fissures.",
    },
    {
        "file": "storyboard_img_1767211973693.png",
        "label": "Meridian Station — Structural Breach",
        "alt": "Shard-God Tiger prying open a Meridian Station wall panel amid sparks and smoke.",
    },
]


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def ext_for(path: Path) -> str:
    suffix = path.suffix.lstrip(".").lower()
    return EXT_MAP.get(suffix, suffix or "bin")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--brandkit", required=True)
    ap.add_argument("--planetary", required=True)
    ap.add_argument("--shardgod", required=True)
    ap.add_argument("--site", default="docs")
    args = ap.parse_args()

    brandkit_root = Path(args.brandkit)
    planetary_root = Path(args.planetary)
    shardgod_root = Path(args.shardgod)
    site_root = ROOT / args.site
    media_dir = site_root / "assets" / "media"
    index_path = site_root / "index.html"
    manifest_path = site_root / "asset-manifest.json"

    manifest = json.loads(manifest_path.read_text())
    assets_by_hash = {a["sha256"]: a for a in manifest["assets"]}
    existing_filenames = {a["filename"] for a in manifest["assets"]}
    html = index_path.read_text(encoding="utf-8")

    stats = {"copied": 0, "reused": 0, "missing": []}

    def import_file(src: Path, category: str, identity: str):
        if not src.exists():
            stats["missing"].append(str(src))
            return None
        digest = sha256_of(src)
        if digest in assets_by_hash:
            stats["reused"] += 1
            return assets_by_hash[digest]
        ext = ext_for(src)
        hash24 = digest[:24]
        filename = f"{hash24}.{ext}"
        suffix = 0
        while filename in existing_filenames:
            suffix += 1
            filename = f"{hash24}-{suffix}.{ext}"
        shutil.copy2(src, media_dir / filename)
        mime = f"video/{ext}" if ext == "mp4" else f"image/{ext if ext != 'jpg' else 'jpeg'}"
        asset = {
            "sha256": digest, "mime_type": mime, "filename": filename, "bytes": src.stat().st_size,
            "reference_count": 0, "contexts": [], "logical_identity": identity,
            "match_status": "exact", "provenance": {"source_basename": src.name, "source_category": category,
                                                       "origin": "MacBook Google Drive / macbook"},
        }
        assets_by_hash[digest] = asset
        manifest["assets"].append(asset)
        existing_filenames.add(filename)
        stats["copied"] += 1
        return asset

    # ---- 1. Brand-kit watermark ----
    if 'id="brandkit-watermark"' not in html:
        clip_assets = []
        for name in BRANDKIT_CLIPS:
            a = import_file(brandkit_root / name, "brandkit-watermark", "Starsilk strand loop")
            if a:
                clip_assets.append(a["filename"])
        if clip_assets:
            sources_js = json.dumps([f"assets/media/{f}" for f in clip_assets])
            watermark_html = (
                f'<video id="brandkit-watermark" autoplay muted playsinline aria-hidden="true" '
                f'src="assets/media/{clip_assets[0]}"></video>'
                f'<script>(function(){{var v=document.getElementById("brandkit-watermark");'
                f'var clips={sources_js};var i=0;'
                f'v.addEventListener("ended",function(){{i=(i+1)%clips.length;v.src=clips[i];v.play().catch(function(){{}});}});'
                f'}})();</script>'
            )
            html = html.replace("<body>\n", "<body>\n" + watermark_html + "\n", 1)
            css_addition = (
                "#brandkit-watermark{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;"
                "opacity:.1;pointer-events:none;z-index:0}"
                "@media (prefers-reduced-motion: reduce){#brandkit-watermark{display:none}}"
            )
            html = html.replace("</style>", css_addition + "</style>", 1)
            print(f"Brand-kit watermark: {len(clip_assets)} clips wired in.")
    else:
        print("Brand-kit watermark already present; skipping.")

    # ---- 2. WorldsVault template art ----
    matched, unmatched_hits = 0, 0
    for name, rel in WORLDSVAULT_MAP.items():
        asset = import_file(planetary_root / rel, "worldsvault-template", name)
        if not asset:
            continue
        pattern = re.compile(
            r'(<article class="template-record"><b>' + re.escape(name) + r'</b><span>.*?</span>)(</article>)'
        )
        if f'data-worldsvault-image="{asset["filename"]}"' in html:
            continue
        thumb = (
            f'<img class="template-thumb" data-worldsvault-image="{asset["filename"]}" '
            f'loading="lazy" decoding="async" src="assets/media/{asset["filename"]}" '
            f'alt="{name} — WorldsVault template archival plate."/>'
        )
        new_html, n = pattern.subn(lambda m: thumb + m.group(1) + m.group(2), html, count=1)
        if n:
            html = new_html
            matched += 1
        else:
            print(f"WARNING: template-record for '{name}' not found/already modified.")
    if matched and ".template-thumb{" not in html:
        css_addition = (
            ".template-record{display:flex;gap:.6rem;align-items:flex-start}"
            ".template-thumb{width:3.4rem;height:3.4rem;object-fit:cover;border:1px solid #213649;flex:0 0 auto;background:#000}"
        )
        html = html.replace("</style>", css_addition + "</style>", 1)
    print(f"WorldsVault: {matched} templates matched with art; "
          f"{len(WORLDSVAULT_UNMATCHED)} left unmatched (no exact source found): {WORLDSVAULT_UNMATCHED}")

    # ---- 3. Shard-God additional archival plates ----
    shelf_id = "media-shardgod-additional"
    if f'id="{shelf_id}"' not in html:
        figures = []
        for plate in SHARDGOD_PLATES:
            asset = import_file(shardgod_root / plate["file"], "shardgod-additional", plate["label"])
            if not asset:
                continue
            figures.append(
                f'<figure class="reference-record media-item"><div class="image-stage">'
                f'<img loading="lazy" decoding="async" src="assets/media/{asset["filename"]}" alt="{plate["alt"]}"></div>'
                f'<figcaption><strong>Shard-God — {plate["label"]}</strong>'
                f'<span>Additional archival plate; current one-tail, no-cape and controlled-behavior locks remain authoritative.</span>'
                f'</figcaption></figure>'
            )
        if figures:
            new_shelf = (
                f'<details class="media-shelf" id="{shelf_id}"><summary>Shard-God — additional archival plates '
                f'<span>{len(figures)} images</span></summary><div class="ref-grid media-ref-grid">'
                + "".join(figures) + "</div></details>"
            )
            marker = 'id="media-orbital-shardgod-06"'
            idx = html.find(marker)
            if idx != -1:
                end_of_shelf = html.find("</details>", idx)
                if end_of_shelf != -1:
                    insert_at = end_of_shelf + len("</details>")
                    html = html[:insert_at] + new_shelf + html[insert_at:]
                    print(f"Shard-God: added {len(figures)} additional plates in new shelf.")
                else:
                    print("WARNING: could not find closing </details> for shard-god shelf.")
            else:
                print("WARNING: media-orbital-shardgod-06 anchor not found; Shard-God plates imported but not placed.")
    else:
        print("Shard-God additional shelf already present; skipping.")

    index_path.write_text(html, encoding="utf-8")

    # ---- Recompute reference counts ----
    # Counts src="assets/media/..." attributes AND quoted "assets/media/..."
    # string literals (covers the watermark's JS clip-rotation array too).
    ref_counts = {}
    for m in re.finditer(r'"assets/media/([^"]+)"', html):
        fn = m.group(1)
        ref_counts[fn] = ref_counts.get(fn, 0) + 1
    for asset in manifest["assets"]:
        asset["reference_count"] = ref_counts.get(asset["filename"], asset.get("reference_count", 0))
    manifest["unique_binary_assets"] = len(manifest["assets"])
    manifest["total_unique_binary_size_bytes"] = sum(a["bytes"] for a in manifest["assets"])
    manifest_path.write_text(json.dumps(manifest, indent=2))

    print(f"\nStats: copied={stats['copied']}, reused={stats['reused']}, missing={len(stats['missing'])}")
    for m in stats["missing"]:
        print(f"  MISSING: {m}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
