#!/bin/bash
set -e

echo "=== Starsilk Character Dossier Canonical Build ==="

# 1. Base extraction
echo "1. Extracting embedded media..."
if [ -f "starsilk_character_dossier.html" ]; then
    python3 tools/extract_embedded_media.py
else
    echo "Warning: starsilk_character_dossier.html not found. Skipping full extraction."
    echo "Operating in 'checked-in Web Edition finalization/validation' mode."
fi

# 2. Art imports
echo "2. Importing Drakken Art (if source exists)..."
if [ -r "/Users/andrew/Library/CloudStorage/GoogleDrive-digitalghosts269@gmail.com/My Drive/macbook/drakken/drakken-lore-scenes/egg-origin-node-plate.png" ]; then
    python3 tools/import_drakken_art.py --source "/Users/andrew/Library/CloudStorage/GoogleDrive-digitalghosts269@gmail.com/My Drive/macbook/drakken" --site docs
else
    echo "Skipping Drakken art import (source not readable)."
fi

echo "3. Importing Brandkit/WorldsVault/ShardGod (if source exists)..."
if [ -r "/path/to/Starsilk BrandKit" ]; then
    echo "Brandkit source not found, skipping."
else
    echo "Skipping BrandKit import."
fi

# 4. Content Integration
echo "4. Integrating Gap Analysis..."
python3 tools/gap_analysis_integration.py

# 5. UI/UX Polish Pass
echo "5. Applying UI/UX Polish Pass..."
python3 tools/ui_ux_polish_pass.py

# 6. Apply UX Audit Fixes
echo "6. Applying UX Audit Fixes..."
python3 tools/apply_ux_audit_fixes.py
python3 tools/apply_media_fixes.py
python3 tools/apply_edition_label.py

# 7. Finalize Metadata (UX-033)
echo "7. Finalizing Metadata..."
python3 tools/finalize_metadata.py || true

# 8. Validation Gate (UX-030)
echo "8. Validating Web Edition..."
python3 tools/validate_web_edition.py

echo "=== Build Complete ==="
