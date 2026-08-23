#!/usr/bin/env bash
set -euo pipefail

# Starsilk Compendium — Authoritative Build Pipeline
#
#   versioned canonical source (src/content/, src/templates/)
#     -> build/generate.py        (deterministic template render -> docs/index.html)
#     -> build/validate.py        (parsed-DOM structural + canon-invariant gate)
#     -> GitHub Pages (main / docs)
#
# docs/index.html is disposable generated output. Every run rebuilds it from
# src/content/ + src/templates/ from scratch -- there is no in-place
# mutation and no script-ordering hazard between stages. This default mode
# needs nothing beyond what a fresh `git clone` already has.
#
# Published media (docs/assets/media/, docs/asset-manifest.json) is itself
# committed, generated output -- regenerating it from media/source/ is a
# separate, opt-in, much slower step (media/source/ holds large canonical
# originals and is intentionally *not* committed; see .gitignore and
# README.md), analogous to how this project has always treated its giant
# offline-archive source file.
#
# Usage:
#   ./tools/build.sh                    Render docs/index.html from src/content/
#                                        + strict validation. No large local
#                                        files required; safe from a fresh clone.
#   ./tools/build.sh --regenerate-media  Also re-derive docs/assets/media/ +
#                                        docs/asset-manifest.json from
#                                        media/source/ (requires that
#                                        directory to exist locally; slow).
#   ./tools/build.sh --check             Do not write docs/index.html; fail if
#                                        the generator's output would differ
#                                        from what's already committed
#                                        (release-gate / CI use).

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
    echo "-> Generating (in-memory) and checking against committed docs/index.html..."
    "$PY" build/generate.py --check
else
    echo "-> Generating docs/index.html from src/content/ + src/templates/..."
    "$PY" build/generate.py
fi

echo "-> Running strict validation gate..."
"$PY" build/validate.py --strict

echo "======================================================================"
echo "BUILD COMPLETED SUCCESSFULLY"
echo "======================================================================"
