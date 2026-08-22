#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "docs" / "index.html"

def apply_fixes():
    if not INDEX.exists():
        print(f"Error: {INDEX} not found.")
        return 1

    content = INDEX.read_text(encoding="utf-8")
    
    # ---------------------------------------------------------
    # UX-009: Eliminate sidebar/content collision
    # ---------------------------------------------------------
    # In .page, change `clamp(var(--page-pad),19vw,20rem)` to `clamp(18rem, 21vw, 22rem)`
    # This guarantees at least 18rem of left padding, avoiding the 16rem sidebar.
    content = content.replace(
        'clamp(var(--page-pad),19vw,20rem)',
        'clamp(18rem,21vw,22rem)'
    )
    
    # ---------------------------------------------------------
    # UX-017, UX-018: Typography and contrast
    # ---------------------------------------------------------
    # ".65rem/.72rem uppercase/tracked metadata"
    # Find font-size:.65rem or .68rem or .72rem, change some colors if needed.
    # The audit says: "Raise metadata token luminance".
    # We can replace `#647888` (index small text) -> `#8fa3b2`
    content = content.replace('color:#647888', 'color:#8fa3b2')
    content = content.replace('color:#647c8d', 'color:#8fa3b2')
    content = content.replace('color:#667f90', 'color:#8ca0af')
    # Change microcopy tracking on narrow screens? Let's just bump the minimum font size to .72rem.
    content = content.replace('font-size:.65rem', 'font-size:.72rem')
    content = content.replace('font-size:.68rem', 'font-size:.72rem')
    content = content.replace('font:800 .65rem/', 'font:800 .72rem/')
    content = content.replace('font:800 .68rem/', 'font:800 .72rem/')
    content = content.replace('font:700 .65rem/', 'font:700 .72rem/')
    content = content.replace('font:700 .68rem/', 'font:700 .72rem/')

    INDEX.write_text(content, encoding="utf-8")
    print("Layout fixes applied.")
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(apply_fixes())
