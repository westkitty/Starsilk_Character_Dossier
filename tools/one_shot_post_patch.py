#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parent.parent

style = root / "src/templates/style.css"
style.write_text(style.read_text(encoding="utf-8").rstrip() + "\n", encoding="utf-8")

test = root / "tests/test_entrance_intrusion.py"
text = test.read_text(encoding="utf-8")
open_wrapper = 'f"""() => {{\n'
close_wrapper = '        }}"""\n    )'
if open_wrapper not in text or close_wrapper not in text:
    raise RuntimeError("intrusion test init-script wrapper markers missing")
text = text.replace(open_wrapper, 'f"""\n', 1)
text = text.replace(close_wrapper, '        """\n    )', 1)
test.write_text(text, encoding="utf-8")

app = root / "src/templates/app.js"
source = app.read_text(encoding="utf-8")
old = """    var i = 0;
    var coverHidden = false;
    var tabHidden = document.hidden;
    function sync(){
      if(tabHidden || coverHidden){ v.pause(); }
      else { v.play().catch(function(){}); }
    }
    v.src = clips[0];
    sync();
    v.addEventListener('ended', function(){
      i = (i + 1) % clips.length;
      v.src = clips[i];
      sync();
    });
    document.addEventListener('visibilitychange', function(){
      tabHidden = document.hidden;
      sync();
    });
    var cover = document.getElementById('cover');
    if(cover && 'IntersectionObserver' in window){
      var coverObserver = new IntersectionObserver(function(entries){
        coverHidden = entries[0].intersectionRatio > 0.6;
        sync();
      }, {threshold: [0, 0.6, 1.0]});
      coverObserver.observe(cover);
    }
"""
new = """    var i = 0;
    var heroBanner = document.querySelector('.hero-video-wrap');
    var coverDominant = !!heroBanner && 'IntersectionObserver' in window;
    var tabHidden = document.hidden;
    function sync(){
      if(tabHidden || coverDominant){ v.pause(); }
      else { v.play().catch(function(){}); }
    }
    v.src = clips[0];
    sync();
    v.addEventListener('ended', function(){
      i = (i + 1) % clips.length;
      v.src = clips[i];
      sync();
    });
    document.addEventListener('visibilitychange', function(){
      tabHidden = document.hidden;
      sync();
    });
    if(heroBanner && 'IntersectionObserver' in window){
      var coverObserver = new IntersectionObserver(function(entries){
        var entry = entries[0];
        coverDominant = entry.isIntersecting && entry.intersectionRatio > 0.25;
        sync();
      }, {threshold: [0, 0.25, 1.0]});
      coverObserver.observe(heroBanner);
    }
"""
if old not in source:
    raise RuntimeError("watermark cover-dominance block missing")
app.write_text(source.replace(old, new, 1), encoding="utf-8")
