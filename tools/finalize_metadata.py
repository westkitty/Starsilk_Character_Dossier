#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
MANIFEST = DOCS / "asset-manifest.json"
INDEX = DOCS / "index.html"

def main():
    if not MANIFEST.exists():
        print("Manifest not found.")
        return
        
    data = json.loads(MANIFEST.read_text())
    
    # UX-032: Scrub provenance
    for asset in data.get("assets", []):
        if "provenance" in asset:
            if "origin" in asset["provenance"]:
                del asset["provenance"]["origin"]
                
    # UX-033: Update final index size
    if INDEX.exists():
        data["generated_index_size_bytes"] = INDEX.stat().st_size
        
    MANIFEST.write_text(json.dumps(data, indent=2))
    print("Metadata finalized and scrubbed.")

if __name__ == "__main__":
    main()
