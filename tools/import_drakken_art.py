#!/usr/bin/env python3
"""Import verified-exact Drakken archival artwork from the local Google Drive
source into the existing Web Edition (docs/index.html + docs/assets/media/),
following the strict identity-matching rules of the art-integration pass.

This tool does NOT regenerate docs/ from the offline archive HTML. It edits
the existing generated site in place.

Usage:
  python3 tools/import_drakken_art.py \
    --source "/Users/andrew/Library/CloudStorage/GoogleDrive-digitalghosts269@gmail.com/My Drive/macbook/drakken" \
    --site docs
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

EXT_MAP = {
    "png": "png", "jpeg": "jpg", "jpg": "jpg", "webp": "webp", "gif": "gif",
}

# --------------------------------------------------------------------------
# Verified exact-identity mapping. Paths are relative to the Drive source
# root. "primary" images become the gallery in filename order; "alternate"
# images (explicit numbered files that literally contain the strain name,
# or duplicate-package copies) are appended after primary images. Exact
# identity only -- see CRITICAL MATCHING LAW in the task brief.
# --------------------------------------------------------------------------
STRAIN_MAP = {
    "drk-the-egg": {
        "name": "The Egg",
        "primary": ["drakken-lore-scenes/egg-origin-node-plate.png"],
        "alternate": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-01-the-egg.png"],
    },
    "drk-magma-pleuron": {
        "name": "Magma Pleuron",
        "primary": ["magma-pleuron-concept-art.png", "magma-pleuron-profile-plate.png", "magma-pleuron-cinematic-wide.png"],
        "alternate": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-02-magma-pleuron.png"],
    },
    "drk-granithelion": {
        "name": "Granithelion",
        "primary": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-03-granithelion.png"],
        "alternate": [],
    },
    "drk-fault-tongue": {
        "name": "Fault-Tongue",
        "primary": ["fault-tongue-archival-plate.png"],
        "alternate": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-04-fault-tongue.png"],
    },
    "drk-obsidian-gul": {
        "name": "Obsidian Gul",
        "primary": ["obsidian-gul-archival-plate.png"],
        "alternate": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-05-obsidian-gul.png"],
    },
    "drk-tremorhound": {
        "name": "Tremorhound",
        "primary": ["tremorhound-archival-plate.png"],
        "alternate": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-06-tremorhound.png"],
    },
    "drk-glassspine": {
        "name": "Glassspine",
        "primary": ["glassspine-archival-concept.png", "glassspine-portrait-plate.png", "glassspine-shardway-panorama.png"],
        "alternate": [
            "drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-07-glassspine.png",
            "glasspine-06-ribbon-spine.png",
        ],
    },
    "drk-quarrymind": {
        "name": "Quarrymind",
        "primary": ["quarrymind-archival-plate.png"],
        "alternate": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-08-quarrymind.png"],
    },
    "drk-aerokarst": {
        "name": "Aerokarst",
        "primary": ["aerokarst-archival-plate.png"],
        "alternate": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-09-aerokarst.png"],
    },
    "drk-cloudmaw": {
        "name": "Cloudmaw",
        "primary": ["cloudmaw-archival-plate.png"],
        "alternate": ["drakken_all_images_so_far_complete_package/drakken_strains_01_10/drakken-10-cloudmaw.png"],
    },
    "drk-atmantid": {"name": "Atmantid", "primary": ["atmantid-archival-plate.png"], "alternate": []},
    "drk-weathernode": {"name": "Weathernode", "primary": ["weathernode-archival-plate.png"], "alternate": []},
    "drk-vortenbray": {"name": "Vortenbray", "primary": ["vortenbray-archival-plate.png"], "alternate": []},
    "drk-fumericus": {"name": "Fumericus", "primary": ["fumericus-archival-plate.png"], "alternate": []},
    "drk-skymourn": {
        "name": "Skymourn",
        "primary": ["skymourn-archival-plate.png"],
        "alternate": [
            "skymourn-01-archival-plate.png", "skymourn-02-bar-khel-overflight.png", "skymourn-03-portrait.png",
            "skymourn-04-climate-polarization.png", "skymourn-05-aftermath-snowfield.png",
            "skymourn-06-serpentine-archival.png", "skymourn-07-serpentine-over-city.png",
            "skymourn-08-serpentine-portrait.png", "skymourn-09-serpentine-climate-rift.png",
            "skymourn-10-serpentine-low-angle.png", "skymourn-11-dive-through-storm.png",
            "skymourn-12-horizontal-over-sea.png", "skymourn-13-perched-on-spire.png",
            "skymourn-14-emerging-from-cloudwall.png", "skymourn-15-overhead-maelstrom.png",
        ],
    },
    "drk-verdgorge": {"name": "Verdgorge", "primary": ["verdgorge-archival-plate.png"], "alternate": []},
    "drk-pollenvault": {"name": "Pollenvault", "primary": ["pollenvault-archival-plate.png"], "alternate": []},
    "drk-mycethron": {"name": "Mycethron", "primary": ["mycethron-archival-plate.png"], "alternate": []},
    "drk-raintaster": {"name": "Raintaster", "primary": ["raintaster-archival-plate.png"], "alternate": []},
    "drk-terragullet": {"name": "Terragullet", "primary": ["terragullet-archival-plate.png"], "alternate": []},
    "drk-petalnest": {"name": "Petalnest", "primary": ["petalnest-archival-plate.png"], "alternate": []},
    "drk-feralseed": {"name": "Feralseed", "primary": ["feralseed-archival-plate.png"], "alternate": []},
    "drk-solnexus": {"name": "Solnexus", "primary": ["solnexus-archival-plate.png"], "alternate": []},
    "drk-nullthorn": {"name": "Nullthorn", "primary": ["nullthorn-archival-plate.png"], "alternate": ["drakken-nullthorn.png"]},
    "lyriboris": {"name": "Lyriboris", "primary": ["lyriboris-archival-plate.png"], "alternate": []},
    "drk-helionth": {"name": "Helionth", "primary": ["helionth-archival-plate.png"], "alternate": []},
    "drk-umbrakrael": {"name": "Umbrakrael", "primary": ["umbrakrael-archival-plate.png"], "alternate": []},
    "drk-cinderverge": {"name": "Cinderverge", "primary": ["cinderverge-archival-plate.png"], "alternate": []},
    "drk-singularch": {"name": "Singularch", "primary": ["singularch-archival-plate.png"], "alternate": []},
    "drk-redacted-grin": {"name": "Redacted Grin", "primary": ["redacted-grin-archival-plate.png"], "alternate": []},
    "drk-spinal-loop": {"name": "Spinal Loop", "primary": ["spinal-loop-archival-plate.png"], "alternate": []},
    "cradle-exe": {"name": "Cradle.exe", "primary": ["cradle-exe-archival-plate.png"], "alternate": []},
    "foldhowl": {"name": "Foldhowl", "primary": ["foldhowl-archival-plate.png"], "alternate": []},
    "manifest-discord": {"name": "Manifest.Discord", "primary": ["manifest-discord-archival-plate.png"], "alternate": []},
    "drk-gloryfail": {"name": "Gloryfail", "primary": ["gloryfail-archival-plate.png"], "alternate": []},
    "drk-viral-bastion": {"name": "Viral Bastion", "primary": ["viral-bastion-archival-plate.png"], "alternate": []},
}

# Identities that keep their prior proxy image as a labeled SECONDARY entry
# (rather than dropping it) per explicit brief instructions.
KEEP_SECONDARY_PROXY = {
    "lyriboris": "Networked Drakken intelligence and resonant-system imagery — systems/incident reference used "
                 "for machine-breaking song logic context, not a portrait of Lyriboris.",
    "drk-umbrakrael": "Umbrakrael paired with Blood Ring imagery — historical/compositional reference, not the "
                      "direct strain archival plate.",
    "drk-granithelion": "Granithelion settling-day / monolithic-formation reference, retained as an additional "
                        "view alongside the archival plate.",
}

# incident art: file -> (target section id, display name, caption)
INCIDENT_MAP = [
    {
        "file": "drakken-lore-scenes/balmera-ridge-incident-plate.png",
        "section": "drk-the-egg",
        "name": "The Balmera Ridge Incident",
        "caption": "The Balmera Ridge Incident — lore-scene plate, specifically attached to the Egg's genesis/rogue-hatching continuity.",
    },
    {
        "file": "drakken-lore-scenes/deimos-vii-fracture-plate.png",
        "section": "drk-magma-pleuron",
        "name": "The Fracture of Deimos VII",
        "caption": "The Fracture of Deimos VII — incident plate, Magma Pleuron's canonical lore incident.",
    },
]

LORE_MAP = [
    {
        "file": "drakken-lore-scenes/blood-eclipse-war-overview-plate.png",
        "section": "chronology",
        "name": "Blood Eclipse War overview",
        "caption": "Blood Eclipse War overview — archival plate for the one-hundred-seventy-year conflict spanning this chronology.",
    },
    {
        "file": "drakken-lore-scenes/blood-rings-plate.png",
        "section": "blood-rings",
        "name": "Blood Rings",
        "caption": "Blood Rings — archival plate.",
    },
]

MOTHER_ITEM = {
    "file": "mother-origin-plate.png",
    "section": "mother",
    "name": "Mother — archival pre-coup origin visualization",
    "caption": "Mother — archival pre-coup origin visualization. Current canon text governs later state; Mother's "
               "exact physical condition after the anti-fascist coup remains unspecified.",
}


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
    ap.add_argument("--source", required=True, help="Path to the Drakken Drive art source folder")
    ap.add_argument("--site", default="docs", help="Path to the site root (default: docs)")
    args = ap.parse_args()

    source_root = Path(args.source)
    site_root = ROOT / args.site
    media_dir = site_root / "assets" / "media"
    index_path = site_root / "index.html"
    manifest_path = site_root / "asset-manifest.json"
    inventory_path = ROOT / "tools" / "drakken_art_inventory.json"

    if not source_root.is_dir():
        print(f"ERROR: source not found: {source_root}")
        return 1
    if not index_path.exists():
        print(f"ERROR: {index_path} not found")
        return 1

    manifest = json.loads(manifest_path.read_text())
    assets_by_hash = {a["sha256"]: a for a in manifest["assets"]}
    existing_filenames = {a["filename"] for a in manifest["assets"]}

    html = index_path.read_text(encoding="utf-8")

    stats = {
        "source_files_considered": 0,
        "exact_files_accepted": 0,
        "incident_files_accepted": 0,
        "new_unique_binaries_copied": 0,
        "existing_binaries_reused": 0,
        "ambiguous_files_skipped": 0,
        "missing_source_files": [],
    }
    inventory = []

    def resolve_asset(rel_path: str, category: str, identity: str, match_status: str):
        """Hash a source file, import if new, return manifest asset dict (or None if missing)."""
        stats["source_files_considered"] += 1
        src = source_root / rel_path
        entry = {
            "source_path": str(src),
            "basename": src.name,
            "category": category,
            "identity": identity,
            "match_status": match_status,
        }
        if not src.exists():
            entry["result"] = "missing"
            stats["missing_source_files"].append(str(src))
            inventory.append(entry)
            return None
        digest = sha256_of(src)
        size = src.stat().st_size
        entry["sha256"] = digest
        entry["bytes"] = size
        if digest in assets_by_hash:
            asset = assets_by_hash[digest]
            entry["result"] = "reused_existing_binary"
            entry["filename"] = asset["filename"]
            stats["existing_binaries_reused"] += 1
        else:
            ext = ext_for(src)
            hash24 = digest[:24]
            filename = f"{hash24}.{ext}"
            suffix = 0
            while filename in existing_filenames:
                suffix += 1
                filename = f"{hash24}-{suffix}.{ext}"
            shutil.copy2(src, media_dir / filename)
            asset = {
                "sha256": digest,
                "mime_type": f"image/{ext if ext != 'jpg' else 'jpeg'}",
                "filename": filename,
                "bytes": size,
                "reference_count": 0,
                "contexts": [],
                "logical_identity": identity,
                "match_status": match_status,
                "provenance": {
                    "source_basename": src.name,
                    "source_category": category,
                    "origin": "MacBook Google Drive / macbook/drakken",
                },
            }
            assets_by_hash[digest] = asset
            manifest["assets"].append(asset)
            existing_filenames.add(filename)
            entry["result"] = "copied_new_binary"
            entry["filename"] = filename
            stats["new_unique_binaries_copied"] += 1
        if match_status == "exact":
            stats["exact_files_accepted"] += 1
        elif match_status == "incident":
            stats["incident_files_accepted"] += 1
        inventory.append(entry)
        return asset

    # ---- Build strain galleries ----
    for section_id, spec in STRAIN_MAP.items():
        name = spec["name"]
        gallery_assets = []
        seen_hashes = set()
        for rel in spec["primary"] + spec["alternate"]:
            asset = resolve_asset(rel, "strain-exact", name, "exact")
            if asset and asset["sha256"] not in seen_hashes:
                seen_hashes.add(asset["sha256"])
                gallery_assets.append(asset)

        if not gallery_assets:
            print(f"WARNING: no resolvable exact art for {section_id} ({name}); leaving existing block untouched.")
            continue

        # Find this section's body to scope the replacement.
        sec_m = re.search(rf'<section\b[^>]*id="{re.escape(section_id)}"', html)
        if not sec_m:
            print(f"WARNING: section id={section_id} not found in index.html; skipping.")
            continue
        sec_start = sec_m.start()
        next_sec = re.search(r"<section\b", html[sec_start + 10:])
        sec_end = sec_start + 10 + next_sec.start() if next_sec else len(html)
        section_html = html[sec_start:sec_end]

        block_re = re.compile(
            r'<article class="dossier-entry" data-visual-ref="true"><h3>Visual reference</h3>'
            r'<figure class="embedded-ref"[^>]*data-drakken-image="' + re.escape(section_id) + r'".*?</figure></article>',
            re.DOTALL,
        )
        block_m = block_re.search(section_html)
        has_existing_block = bool(block_m)
        if not has_existing_block and f'data-drakken-image="{section_id}"' in section_html:
            print(f"{section_id}: visual-ref art already present (non-standard block); skipping.")
            continue

        figures = []
        for i, asset in enumerate(gallery_assets):
            label = f"{name} — archival plate" if i == 0 else f"{name} — alternate view {i}"
            figures.append(
                f'<figure class="embedded-ref" data-drakken-image="{section_id}">'
                f'<img alt="{name} archival plate." loading="lazy" src="assets/media/{asset["filename"]}"/>'
                f'<figcaption><b>{label}</b><span>Verified archival plate imported from the Drakken art archive.</span></figcaption>'
                f'</figure>'
            )

        secondary_note = KEEP_SECONDARY_PROXY.get(section_id)
        if secondary_note and has_existing_block:
            old_img_m = re.search(r'<img\b[^>]*src="([^"]+)"', block_m.group(0))
            if old_img_m:
                old_src = old_img_m.group(1)
                old_filename = old_src.rsplit("/", 1)[-1]
                already_included = any(a["filename"] == old_filename for a in gallery_assets)
                if not already_included:
                    figures.append(
                        f'<figure class="embedded-ref"><img alt="{name} secondary reference." loading="lazy" src="{old_src}"/>'
                        f'<figcaption><b>{name} — secondary reference</b><span>{secondary_note}</span></figcaption></figure>'
                    )

        if len(figures) == 1:
            new_block = (
                f'<article class="dossier-entry" data-visual-ref="true"><h3>Visual reference</h3>{figures[0]}</article>'
            )
        else:
            new_block = (
                f'<article class="dossier-entry" data-visual-ref="true"><h3>Archival visual references</h3>'
                f'<div class="embedded-grid">{"".join(figures)}</div></article>'
            )

        if has_existing_block:
            section_html_new = section_html[:block_m.start()] + new_block + section_html[block_m.end():]
        else:
            marker = '</div>\n    <aside'
            idx = section_html.rfind(marker)
            if idx == -1:
                print(f"WARNING: no visual-ref block and no insertion marker for {section_id}; skipping HTML edit (asset still imported).")
                continue
            section_html_new = section_html[:idx] + new_block + "\n    " + section_html[idx:]
        html = html[:sec_start] + section_html_new + html[sec_end:]
        # Recompute end offset shift for subsequent operations by re-finding on next loop (re.search each time), safe.

    # ---- Incident art: insert as an additional dossier-entry after existing visual-ref block ----
    for item in INCIDENT_MAP:
        asset = resolve_asset(item["file"], "incident", item["name"], "incident")
        if not asset:
            continue
        sec_m = re.search(rf'<section\b[^>]*id="{re.escape(item["section"])}"', html)
        if not sec_m:
            continue
        sec_start = sec_m.start()
        next_sec = re.search(r"<section\b", html[sec_start + 10:])
        sec_end = sec_start + 10 + next_sec.start() if next_sec else len(html)
        section_html = html[sec_start:sec_end]

        if f'data-incident-image="{item["file"]}"' in section_html:
            continue  # already inserted in a prior run

        figure = (
            f'<article class="dossier-entry" data-visual-ref="true" data-incident-image="{item["file"]}">'
            f'<h3>Incident reference</h3><figure class="embedded-ref">'
            f'<img alt="{item["name"]} incident plate." loading="lazy" src="assets/media/{asset["filename"]}"/>'
            f'<figcaption><b>{item["name"]}</b><span>{item["caption"]}</span></figcaption></figure></article>'
        )
        vref_m = re.search(
            r'<article class="dossier-entry" data-visual-ref="true"><h3>(?:Visual reference|Archival visual references)</h3>.*?</article>',
            section_html, re.DOTALL,
        )
        if vref_m:
            section_html_new = section_html[:vref_m.end()] + figure + section_html[vref_m.end():]
        else:
            section_html_new = section_html.replace("</div>\n    <aside", figure + "</div>\n    <aside", 1)
        html = html[:sec_start] + section_html_new + html[sec_end:]

    # ---- Lore / Mother art: insert into differently-structured sections ----
    def insert_before(html_text, section_id, marker, new_html, dedupe_key):
        if dedupe_key in html_text:
            return html_text
        sec_m = re.search(rf'<section\b[^>]*id="{re.escape(section_id)}"', html_text)
        if not sec_m:
            print(f"WARNING: section id={section_id} not found for lore/mother insertion.")
            return html_text
        sec_start = sec_m.start()
        next_sec = re.search(r"<section\b", html_text[sec_start + 10:])
        sec_end = sec_start + 10 + next_sec.start() if next_sec else len(html_text)
        section_html = html_text[sec_start:sec_end]
        idx = section_html.rfind(marker)
        if idx == -1:
            print(f"WARNING: insertion marker not found in section {section_id}.")
            return html_text
        section_html_new = section_html[:idx] + new_html + section_html[idx:]
        return html_text[:sec_start] + section_html_new + html_text[sec_end:]

    for item in LORE_MAP:
        asset = resolve_asset(item["file"], "lore", item["name"], "incident")
        if not asset:
            continue
        dedupe_key = f'data-lore-image="{item["file"]}"'
        new_html = (
            f'<article class="dossier-entry" data-visual-ref="true" data-lore-image="{item["file"]}">'
            f'<h3>Visual reference</h3><figure class="embedded-ref">'
            f'<img alt="{item["name"]} archival plate." loading="lazy" src="assets/media/{asset["filename"]}"/>'
            f'<figcaption><b>{item["name"]}</b><span>{item["caption"]}</span></figcaption></figure></article>'
        )
        html = insert_before(html, item["section"], "</div></section>", new_html, dedupe_key)

    mother_asset = resolve_asset(MOTHER_ITEM["file"], "origin", MOTHER_ITEM["name"], "incident")
    if mother_asset:
        dedupe_key = 'data-mother-image="mother-origin-plate.png"'
        new_html = (
            f'<article class="dossier-entry" data-visual-ref="true" data-mother-image="mother-origin-plate.png">'
            f'<h3>Visual reference</h3><figure class="embedded-ref">'
            f'<img alt="{MOTHER_ITEM["name"]}" loading="lazy" src="assets/media/{mother_asset["filename"]}"/>'
            f'<figcaption><b>Mother — archival pre-coup origin visualization</b><span>{MOTHER_ITEM["caption"]}</span></figcaption>'
            f'</figure></article>'
        )
        html = insert_before(html, "mother", "</div>\n    <aside", new_html, dedupe_key)

    # ---- Write index.html ----
    index_path.write_text(html, encoding="utf-8")

    # ---- Recompute reference counts from scratch (robust vs. manual bookkeeping) ----
    ref_counts = {}
    for m in re.finditer(r'src="assets/media/([^"]+)"', html):
        ref_counts[m.group(1)] = ref_counts.get(m.group(1), 0) + 1
    for asset in manifest["assets"]:
        asset["reference_count"] = ref_counts.get(asset["filename"], 0)
    manifest["total_data_uri_references"] = manifest.get("total_data_uri_references", 0)
    manifest["unique_binary_assets"] = len(manifest["assets"])
    manifest["total_unique_binary_size_bytes"] = sum(a["bytes"] for a in manifest["assets"])

    manifest_path.write_text(json.dumps(manifest, indent=2))
    inventory_path.write_text(json.dumps({"stats": stats, "files": inventory}, indent=2))

    print("\n--- Drakken art import summary ---")
    for k, v in stats.items():
        if k != "missing_source_files":
            print(f"{k}: {v}")
    if stats["missing_source_files"]:
        print(f"missing_source_files: {len(stats['missing_source_files'])}")
        for f in stats["missing_source_files"]:
            print(f"  - {f}")
    print(f"\nWrote {index_path}")
    print(f"Wrote {manifest_path}")
    print(f"Wrote {inventory_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
