#!/usr/bin/env bash
set -euo pipefail

# Starsilk Character Dossier — Authoritative Build Pipeline (UX-029)
#
# Modes:
#   1. Default: Checked-in Web Edition finalization & validation
#      ./tools/build.sh
#
#   2. Full source rebuild (opt-in):
#      ./tools/build.sh --full-rebuild
#      Optional environment variables / flags for asset sources:
#        DRAKKEN_SOURCE_DIR="/path/to/drakken"
#        BRANDKIT_SOURCE_DIR="/path/to/brandkit"

MODE="finalize"
FULL_REBUILD=false

for arg in "$@"; do
    case "$arg" in
        --full-rebuild)
            FULL_REBUILD=true
            MODE="full"
            ;;
        --help|-h)
            echo "Usage: ./tools/build.sh [--full-rebuild]"
            exit 0
            ;;
    esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "======================================================================"
echo "STARSILK CHARACTER DOSSIER — CANONICAL BUILD PIPELINE"
echo "Mode: $MODE"
echo "======================================================================"

if [ "$FULL_REBUILD" = true ]; then
    echo "1. Full rebuild requested. Checking source dossier..."
    if [ ! -f "starsilk_character_dossier.html" ]; then
        echo "ERROR: starsilk_character_dossier.html not found. Cannot perform full source rebuild." >&2
        exit 1
    fi

    echo "2. Extracting embedded media from source HTML..."
    python3 tools/extract_embedded_media.py

    echo "3. Importing Drakken Art (if source is configured)..."
    DRAKKEN_SRC="${DRAKKEN_SOURCE_DIR:-}"
    if [ -n "$DRAKKEN_SRC" ]; then
        if [ -d "$DRAKKEN_SRC" ]; then
            python3 tools/import_drakken_art.py --source "$DRAKKEN_SRC" --site docs
        else
            echo "ERROR: DRAKKEN_SOURCE_DIR was specified but directory does not exist: $DRAKKEN_SRC" >&2
            exit 1
        fi
    else
        echo "   DRAKKEN_SOURCE_DIR is not configured; preserving existing extracted/imported assets."
    fi

    echo "4. Importing BrandKit / WorldsVault / ShardGod Art (if source is configured)..."
    BRANDKIT_SRC="${BRANDKIT_SOURCE_DIR:-}"
    if [ -n "$BRANDKIT_SRC" ]; then
        if [ -d "$BRANDKIT_SRC" ]; then
            python3 tools/import_brandkit_worldsvault_shardgod.py --source "$BRANDKIT_SRC" --site docs
        else
            echo "ERROR: BRANDKIT_SOURCE_DIR was specified but directory does not exist: $BRANDKIT_SRC" >&2
            exit 1
        fi
    else
        echo "   BRANDKIT_SOURCE_DIR is not configured; preserving existing extracted/imported assets."
    fi

    echo "5. Integrating Gap Analysis lore..."
    python3 tools/gap_analysis_integration.py

    echo "6. Applying UI/UX Polish Pass..."
    python3 tools/ui_ux_polish_pass.py
fi

echo "-> Applying UX audit fixes (UX-001 through UX-028)..."
python3 tools/apply_ux_audit_fixes.py

echo "-> Applying media presentation normalization and default-collapsed sections..."
python3 tools/apply_media_presentation_and_collapse.py

echo "-> Adding top-of-content controls (expand/collapse all, search, sidebar toggle)..."
python3 tools/add_page_controls.py

echo "-> Finalizing and scrubbing metadata (UX-032, UX-033)..."
python3 tools/finalize_metadata.py

echo "-> Running strict validation gate (UX-030)..."
python3 tools/validate_web_edition.py --strict

echo "======================================================================"
echo "BUILD COMPLETED SUCCESSFULLY"
echo "======================================================================"
