#!/usr/bin/env python3
import re
from pathlib import Path
INDEX = Path(__file__).resolve().parent.parent / "docs" / "index.html"
def main():
    content = INDEX.read_text(encoding="utf-8")
    content = content.replace('</h1><p class="deck">', '</h1><div class="edition-label" style="font:700 0.8rem ui-monospace, SFMono-Regular, Menlo, monospace; color:var(--thread); text-transform:uppercase; letter-spacing:0.15em; margin-bottom:1.5rem;">Web Edition</div><p class="deck">')
    INDEX.write_text(content, encoding="utf-8")
if __name__ == "__main__": main()
