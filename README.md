# Starsilk Character Dossier

The Starsilk canon dossier: principal and peripheral character folios, the
Drakken register, WorldsVault, and supporting lore material.

## Offline Archive Edition vs. Web Edition

This project has two forms:

- **Offline Archive Edition** — `starsilk_character_dossier.html`, a single
  huge HTML file (~590 MB) with every image and video embedded directly as
  base64 data URIs. This is the original working file. It is **intentionally
  excluded from Git** (see `.gitignore`) because it far exceeds what a Git
  repository or GitHub Pages should carry, and because repeated media was
  embedded redundantly at every point of use.
- **Web Edition** — [`docs/`](docs/), a normal static site: one `index.html`
  plus externalized, deduplicated media files under `docs/assets/media/`.
  This is what's published to GitHub Pages. It preserves the dossier's
  content and internal anchor navigation as closely as possible; only the
  delivery mechanism for media changed.

## How media extraction works

`docs/index.html` is generated from `starsilk_character_dossier.html`, never
hand-edited. Every embedded `data:image/...;base64,...` and
`data:video/...;base64,...` payload is decoded, hashed with SHA-256, and
written once to `docs/assets/media/<hash>.<ext>`. Identical media reused
across multiple dossier entries (e.g. a Drakken reference image cited in
several sections) is stored once and referenced by every place that uses it.
`docs/asset-manifest.json` records each unique asset (hash, MIME type,
filename, byte size, reference count).

## Regenerate the Web Edition

```bash
python3 tools/extract_embedded_media.py
```

Requires `starsilk_character_dossier.html` to be present locally (it is not
in Git — keep your own copy).

## Validate

```bash
python3 tools/validate_web_edition.py
```

Checks for duplicate IDs, broken anchors, missing local assets, leftover
data URIs, local-machine path leaks, section/media counts, and canon
sanity checks (William absent, 170-year Blood Eclipse War chronology).
Writes `docs/qa-report.txt`.

## Preview locally

```bash
python3 -m http.server 4173 --directory docs
```

Then open http://127.0.0.1:4173/

## Public site

https://westkitty.github.io/Starsilk_Character_Dossier/

Served via GitHub Pages from `main` / `/docs`.
