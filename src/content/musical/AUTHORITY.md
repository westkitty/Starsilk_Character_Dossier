# Starsilk — The Musical / Score Room

This is a **supplemental musical-production notebook**, published at `/musical/` within the Starsilk Compendium. It is not a second canon source.

## Authority

- The authoritative character prose and stable identities remain in `src/content/sections/` and `src/content/sections.json`.
- Machine-checked canon locks remain in `src/canon/invariants.json`.
- The musical notebook's laws/cast/history are production summaries; where they conflict with authoritative Compendium records, the latter govern.
- A status marked **LOCKED** inside the musical notebook represents the dated production document's own assertion; it does **not** silently amend the repository's machine canon locks.
- Score cue assignments, staging notes, lyric treatments, and song revisions are **WORKSHOP/DRAFT** and must not become in-universe assertions.
- Audio/manifest filenames and counts recorded by the notebook are **source-reported archive leads**, not independent verification by the Compendium's media-provenance system.
- Explicit unknowns, contradictions, and superseded interpretations remain visible for editorial decisions. In particular, the notebook contains a Kyle/Kail staging question and potentially inconsistent Shardling-event timing.

## Publication

`src/content/musical/index.html` is the authored offline-capable single-file presentation. The normal `build/generate.py` build copies it and this note to `docs/musical/`; `--check` enforces byte equality. `docs/` is generated release output, never content authority.

The page uses inline CSS/JavaScript and requires no third-party runtime, account, external font, or media download. Its Compendium links resolve on same-origin GitHub Pages; the standalone page still displays offline when saved locally.

Future proposals must be reviewed against canonical source records before any assertion is promoted.
