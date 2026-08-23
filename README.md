# Starsilk Character Dossier

This repository publishes the **Starsilk Compendium**: principal and
peripheral character folios, the Drakken register, WorldsVault, and
supporting lore material. (The repository keeps its original name; the
public-facing site and documents refer to it as the Compendium.)

Public site: **https://westkitty.github.io/Starsilk_Character_Dossier/**
Served via GitHub Pages from `main` / `/docs`.

See [RIGHTS.md](RIGHTS.md) for reuse terms — there isn't an open license.

## Architecture

```
versioned canonical source           build/                  published output
─────────────────────────            ────────                ────────────────
src/content/sections/*.html    ┐
src/content/sections.json      ├─►  generate.py  ──────────►  docs/index.html
src/content/nav.json           │        │
src/templates/*.{j2,css,js}    ┘        │
                                         ▼
media/source/  (large, gitignored) media_pipeline.py ───────► docs/assets/media/
                (opt-in, --regenerate-media)                  docs/asset-manifest.json
                                                                     │
                                                                     ▼
                                                              build/validate.py
                                                             (parsed-DOM + canon
                                                              invariant gate)
```

`docs/index.html` is **generated output** — never hand-edited. Every build
re-renders it from `src/content/` (per-section HTML fragments + metadata)
through `src/templates/shell.html.j2` with [Jinja2](https://jinja.palletsprojects.com/).
Re-running the generator against unchanged sources reproduces the exact
same bytes (`./tools/build.sh --check` proves this; CI enforces it).

- **`src/content/sections/<id>.title.html` / `<id>.body.html`** — each
  dossier entry's title and body markup, preserved verbatim from the
  canon text (no prose was rewritten during the architecture migration).
- **`src/content/sections.json`** — the ordered list of sections with id,
  CSS classes, and any extra attributes (`data-folio`, `data-archetype`, …).
- **`src/content/nav.json`** — the sidebar's category groupings.
- **`src/templates/shell.html.j2`** — the page shell (head/style, sidebar,
  page-controls, section loop, closing scripts).
- **`src/templates/style.css`** / **`app.js`** — the site's CSS and
  JavaScript, included into the rendered page.
- **`src/canon/invariants.json`** — machine-readable canon locks (see
  below), checked by `build/validate.py`.
- **`build/media_pipeline.py`** — turns `media/source/` (large canonical
  originals) into optimized `docs/assets/media/` derivatives + manifest.
  Opt-in (`--regenerate-media`); the default build doesn't need it.
- **`build/migrate_legacy.py`** — the one-time script that originally
  populated `src/content/` from the prior hand-mutated `docs/index.html`.
  Not part of the normal build; kept for history/reference only.

### Why `media/source/` isn't committed

`media/source/` holds the large, pre-optimization canonical media (originally
~589 MB). Like the offline archive file below, that's more than a Git
repository should carry, so it's gitignored — the same convention this
project already used for its giant offline-archive source file. Every
published derivative's provenance (`source_filename`, `source_sha256`,
`source_bytes`) is permanently recorded in `docs/asset-manifest.json`, and
every original also remains recoverable, byte-for-byte, from Git history at
commits prior to the media-optimization pass (`git log -- docs/assets/media`).
A fresh clone can always regenerate `docs/index.html` from `src/content/`;
regenerating `docs/assets/media/` itself is only needed when adding or
changing canonical media, and requires `media/source/` locally.

### Offline Archive Edition

`starsilk_character_dossier.html` (~615 MB, every image/video embedded as
base64 data URIs) is the original all-in-one working file this project grew
from. It's intentionally excluded from Git for the same reason. Nothing in
the normal build reads it; `build/migrate_legacy.py` did, once, to bootstrap
`src/content/` and is not part of ordinary builds.

## Build

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/playwright install --with-deps chromium firefox webkit

./tools/build.sh                    # docs/index.html + strict validation
./tools/build.sh --regenerate-media # also re-derive docs/assets/media/ from
                                     # media/source/ (requires that directory)
./tools/build.sh --check            # fail if generator output would differ
                                     # from the committed docs/index.html
```

Unknown flags are rejected (exit non-zero), as is any validation failure —
the build never prints a warning and continues to "completed successfully."

System dependency for `--regenerate-media`: `ffmpeg` + `cwebp` on `PATH`
(`brew install ffmpeg webp` on macOS). Without them, that pass falls back to
publishing sources unchanged rather than failing outright.

## Validate

```bash
.venv/bin/python3 build/validate.py --strict
```

Parses `docs/index.html` with a real DOM (BeautifulSoup/lxml) rather than
regex-on-source-text, so a `<section>` string inside a JS comment can never
be miscounted as a real element. Checks duplicate ids, broken anchors,
broken local asset paths, local machine path leaks, unexpected external
runtime dependencies, section/media counts, `<summary>`/disclosure
semantics, JavaScript syntax, manifest↔disk consistency and provenance, and
every canon invariant in `src/canon/invariants.json`. Writes
`docs/qa-report.txt`.

## Canon invariants

`src/canon/invariants.json` is the machine-readable source of canon locks
(chronology, forbidden names, character-specific visual locks, section
counts, Drakken art identities). Extend that file when canon changes
intentionally — don't hand-add checks to `build/validate.py`.

## Test

```bash
.venv/bin/pytest tests/ -q                              # full suite (Chromium)
.venv/bin/pytest tests/test_cross_browser.py --browser firefox -q
.venv/bin/pytest tests/test_cross_browser.py --browser webkit -q
```

`tests/test_dossier.py` covers build/validator/media-provenance unit tests,
full interactive browser journeys (navigation, disclosures, search,
attachments, export, print, reduced motion), network-loading regression
tests (initial load / Expand All / search / print must never fetch the
video archive), and hand-rolled screenshot-regression checks against
`tests/visual_baselines/` (pytest-playwright's Python API has no built-in
screenshot assertion — see `tests/conftest.py::assert_matches_baseline`).
`tests/test_cross_browser.py` is a smaller, high-value journey set meant to
run once per engine.

## Portable release package

The in-page "Export HTML copy" button downloads the current page state but
still depends on a companion `assets/media/` directory to render canon
media — it says so on the button. For a genuinely self-contained archive:

```bash
python3 tools/package_release.py --out dist/starsilk-compendium.zip
```

## Preview locally

```bash
python3 -m http.server 4173 --directory docs
```

Then open http://127.0.0.1:4173/

## Google Sites embed

See [GOOGLE_SITES_EMBED.txt](GOOGLE_SITES_EMBED.txt). The published site
sends no `X-Frame-Options` / `frame-ancestors` header, so it embeds as a
Google Sites full-page embed as-is; nothing in the build should add either.

## CI

`.github/workflows/ci.yml` builds from source, proves the committed `docs/`
matches the generator's output, and runs the full test suite on Chromium
(inside the pinned official Playwright container, for reproducible
screenshot rendering) plus a representative journey set on Firefox and
WebKit.
