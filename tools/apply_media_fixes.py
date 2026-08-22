#!/usr/bin/env python3
import re
from pathlib import Path

INDEX = Path(__file__).resolve().parent.parent / "docs" / "index.html"

def main():
    content = INDEX.read_text(encoding="utf-8")

    # UX-026: Add decoding="async" to images that have loading="lazy"
    content = content.replace('loading="lazy"', 'loading="lazy" decoding="async"')

    # UX-027: Watermark lifecycle
    # We remove the autoplay and src from the <video> tag, and rely on the script to initialize it.
    
    old_watermark_html = r'<video id="brandkit-watermark" autoplay muted playsinline aria-hidden="true" src="assets/media/bd9b6b141f0f2d11fadea67a.mp4"></video><script>\(function\(\)\{var v=document.getElementById\("brandkit-watermark"\);var clips=\["assets/media/bd9b6b141f0f2d11fadea67a.mp4", "assets/media/c629ce1b298593185fb64c6d.mp4", "assets/media/2867ab757325a18d4e86e47d.mp4", "assets/media/3e601797a3fa7815a7f18566.mp4", "assets/media/299d5b833f56bb9fe42f0eb2.mp4", "assets/media/8fc2775c8783e4c873a72558.mp4"\];var i=0;v.addEventListener\("ended",function\(\)\{i=\(i\+1\)%clips.length;v.src=clips\[i\];v.play\(\).catch\(\{function\(\)\{\}\}\);\}\);\}\)\(\);</script>'

    # Let's use a regex to capture it since the clips array might be different if it was regenerated.
    pattern = r'<video id="brandkit-watermark"[^>]*></video><script>\(function\(\)\{var v=document\.getElementById\("brandkit-watermark"\);var clips=(\[.*?\]);var i=0;v\.addEventListener\("ended",function\(\)\{i=\(i\+1\)%clips\.length;v\.src=clips\[i\];v\.play\(\)\.catch\(function\(\)\{\}\);\}\);\}\)\(\);</script>'

    def repl(m):
        clips = m.group(1)
        return (
            '<video id="brandkit-watermark" muted playsinline aria-hidden="true"></video>'
            '<script>(function(){'
            'var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;'
            'var v=document.getElementById("brandkit-watermark");'
            f'var clips={clips};'
            'var i=0;'
            'if(!reduceMotion){'
            '  v.src=clips[0];'
            '  v.play().catch(function(){});'
            '  v.addEventListener("ended",function(){'
            '    i=(i+1)%clips.length;'
            '    v.src=clips[i];'
            '    v.play().catch(function(){});'
            '  });'
            '}'
            '})();</script>'
        )

    content = re.sub(pattern, repl, content)
    INDEX.write_text(content, encoding="utf-8")
    print("Media fixes applied.")

if __name__ == "__main__":
    main()
