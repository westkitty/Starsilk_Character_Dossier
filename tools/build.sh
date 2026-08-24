#!/usr/bin/env bash
set -euo pipefail

# Starsilk Compendium — Authoritative Build Pipeline
#
#   versioned canonical source (src/content/, src/templates/)
#     -> build/generate.py              (deterministic Compendium -> docs/index.html)
#     -> build/machine_publication.py   (deterministic public machine derivatives)
#     -> build/relationship_publication.py (observed-xref relationship observatory)
#     -> build/canon_publication.py     (machine-enforced canon lock inspector)
#     -> build/discovery_publication.py (faceted discovery + AI context packets)
#     -> build/tour_publication.py      (curated tours + browser-local library shell)
#     -> build/chronology_publication.py (source-backed chronology explorer)
#     -> build/worldsvault_publication.py (source-backed cosmic topology explorer)
#     -> build/entity_publication.py    (deterministic stable entity permalink pages)
#     -> build/museum_publication.py    (manifest-derived museum object model/viewer)
#     -> build/offline_publication.py   (narrow installable shell + metadata cache)
#     -> build/validate.py              (parsed-DOM structural + canon-invariant gate)
#     -> tools/check_public_boundary.py (public derivative privacy/locality gate)
#     -> GitHub Pages (main / docs)
#
# docs/index.html, docs/machine/, docs/relationships/, docs/canon/, docs/discover/, docs/tours/, docs/chronology/, docs/worldsvault/, docs/entities/, docs/objects/, and the root offline shell files are
# disposable generated output. Every run rebuilds them from declared source
# authority; none may become a second canon source of truth.
#
# Published media (docs/assets/media/, docs/asset-manifest.json) is itself
# committed, generated output -- regenerating it from media/source/ is a
# separate, opt-in, much slower step (media/source/ holds large canonical
# originals and is intentionally *not* committed; see .gitignore and
# README.md), analogous to how this project has always treated its giant
# offline-archive source file.
#
# Usage:
#   ./tools/build.sh                    Render the Compendium, machine layer,
#                                        entity permalinks, museum objects +
#                                        strict validation.
#   ./tools/build.sh --regenerate-media  Also re-derive docs/assets/media/ +
#                                        docs/asset-manifest.json from
#                                        media/source/ (requires that
#                                        directory to exist locally; slow).
#   ./tools/build.sh --check             Do not write generated publication;
#                                        fail if generator output would differ
#                                        from what is already committed.

REGENERATE_MEDIA=false
CHECK_ONLY=false

for arg in "$@"; do
    case "$arg" in
        --regenerate-media)
            REGENERATE_MEDIA=true
            ;;
        --check)
            CHECK_ONLY=true
            ;;
        --help|-h)
            echo "Usage: ./tools/build.sh [--regenerate-media] [--check]"
            exit 0
            ;;
        *)
            echo "ERROR: unknown option: $arg" >&2
            echo "Usage: ./tools/build.sh [--regenerate-media] [--check]" >&2
            exit 1
            ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PY="python3"
if [ -x ".venv/bin/python3" ]; then
    PY=".venv/bin/python3"
fi

echo "======================================================================"
echo "STARSILK COMPENDIUM — BUILD PIPELINE"
echo "======================================================================"

if [ "$REGENERATE_MEDIA" = true ]; then
    echo "-> Media pipeline: source -> optimized web derivatives (--regenerate-media)..."
    if [ ! -d "media/source" ]; then
        echo "ERROR: media/source/ not found. It holds large canonical originals and is" >&2
        echo "       intentionally not committed to Git (see README.md); populate it locally" >&2
        echo "       before requesting a media regeneration." >&2
        exit 1
    fi
    "$PY" build/media_pipeline.py
else
    if [ ! -f "docs/asset-manifest.json" ]; then
        echo "ERROR: docs/asset-manifest.json missing. Run with --regenerate-media first" >&2
        echo "       (requires media/source/ locally), or restore it from Git." >&2
        exit 1
    fi
fi

if [ "$CHECK_ONLY" = true ]; then
    echo "-> Generating (in-memory) and checking docs/index.html..."
    "$PY" build/generate.py --check
    echo "-> Generating (in-memory) and checking public machine publication..."
    "$PY" build/machine_publication.py --check
    echo "-> Generating (in-memory) and checking Relationship Observatory..."
    "$PY" build/relationship_publication.py --check
    echo "-> Generating (in-memory) and checking Canon Inspector..."
    "$PY" build/canon_publication.py --check
    echo "-> Generating (in-memory) and checking faceted discovery + AI context packets..."
    "$PY" build/discovery_publication.py --check
    echo "-> Generating (in-memory) and checking curated tours + local library shell..."
    "$PY" build/tour_publication.py --check
    echo "-> Generating (in-memory) and checking source-backed chronology explorer..."
    "$PY" build/chronology_publication.py --check
    echo "-> Generating (in-memory) and checking source-backed WorldsVault topology explorer..."
    "$PY" build/worldsvault_publication.py --check
    echo "-> Generating (in-memory) and checking stable entity permalinks..."
    "$PY" build/entity_publication.py --check
    echo "-> Generating (in-memory) and checking museum object publication..."
    "$PY" build/museum_publication.py --check
    echo "-> Generating (in-memory) and checking installable offline shell..."
    "$PY" build/offline_publication.py --check
    echo "-> Generating (in-memory) and checking agent evaluation + final integration..."
    "$PY" build/agent_publication.py --check
else
    echo "-> Generating docs/index.html from src/content/ + src/templates/..."
    "$PY" build/generate.py
    echo "-> Generating public machine publication from declared authority..."
    "$PY" build/machine_publication.py
    echo "-> Generating Relationship Observatory from observed xref evidence..."
    "$PY" build/relationship_publication.py
    echo "-> Generating Canon Inspector from machine validation authority..."
    "$PY" build/canon_publication.py
    echo "-> Generating faceted discovery + AI context packets from established authority..."
    "$PY" build/discovery_publication.py
    echo "-> Generating curated stable-ID tours + local library shell..."
    "$PY" build/tour_publication.py
    echo "-> Generating source-backed chronology explorer..."
    "$PY" build/chronology_publication.py
    echo "-> Generating source-backed WorldsVault topology explorer..."
    "$PY" build/worldsvault_publication.py
    echo "-> Generating stable entity permalinks from declared authority..."
    "$PY" build/entity_publication.py
    echo "-> Generating museum object model/viewer from published media provenance..."
    "$PY" build/museum_publication.py
    echo "-> Generating narrow installable offline shell and metadata cache..."
    "$PY" build/offline_publication.py
    echo "-> Generating agent evaluation + final integration certificate..."
    "$PY" build/agent_publication.py
fi

echo "-> Running strict validation gate..."
"$PY" build/validate.py --strict

echo "-> Running public derivative boundary gate..."
"$PY" tools/check_public_boundary.py docs/machine docs/llms.txt docs/sitemap.xml docs/relationships docs/canon docs/discover docs/tours docs/chronology docs/worldsvault docs/entities docs/objects docs/manifest.webmanifest docs/service-worker.js docs/offline-client.js docs/offline.html docs/offline.css docs/agents

echo "======================================================================"
echo "BUILD COMPLETED SUCCESSFULLY"
echo "======================================================================"
