# Sprite Foundry

A self-contained, browser-based workstation for AI-assisted 2D sprite production:
generate a master character, decompose it into directions/animations/frames, repair and
normalize the result, slice sheets, pack atlases, and export engine-ready assets —
with full provenance, versioning, and project persistence.

Everything runs as plain ES modules in the browser (no build step), backed by a
zero-dependency Node server that serves the static app **and** proxies AI image
requests so API keys never reach shipped client code.

## Run

```bash
cd sprite-foundry
cp .env.example .env   # optional — only needed for server-side OpenAI
npm start              # http://localhost:4173
```

No dependencies are required to serve the app. `npm start` runs `node server.mjs`.

| Env var | Effect |
| --- | --- |
| `PORT` | Port (default `4173`) |
| `OPENAI_API_KEY` | Enables the **OpenAI (server)** provider with `gpt-image-1` |
| `OPENAI_MODEL` | Override the model (default `gpt-image-1`) |

Without `OPENAI_API_KEY`, the app still runs; the server provider is marked
**unavailable — reason shown** in the provider panel, and browser-direct providers
(see below) can be used instead.

## Test

```bash
npm test          # node --test tests/  (no network; deterministic)
npm run check     # syntax validation of server + all app modules
```

The suite covers ZIP/GIF/APNG byte-level serialization and parsing, the ZIP reader
(including CRC-corruption detection), PNG chunk validation, smart slicing (row-aware
region detection), grid slicing, packer geometry (trim/sourceOffset, overlap rejection,
reconstruction round-trips), genome/mirroring warnings, skeleton pose generation,
project `.spriteproject` round-trips, and a jsdom boot smoke-test that clicks through
all six stages.

## Providers

Image generation is abstracted behind a provider registry with honest capability
probing. The built-in providers:

1. **OpenAI (server)** — `gpt-image-1` through `server.mjs` (`/api/generate`,
   `/api/edit`, `/api/inpaint`, `/api/between`). Key lives only in `.env` on the
   server. Supports background-transparent requests, edits, inpainting.
2. **Pollinations.ai (browser)** — free, keyless generate-only endpoint; raster
   API → transparency is **marked unavailable**; edit/inbetween/between are marked
   unavailable in the UI with the reason.
3. **OpenAI direct (browser, ephemeral key)** — for local-only use; a key typed here
   is kept in `sessionStorage` only and the UI shows a security warning. This is a
   documented convenience for local work, not the recommended deployment mode.

Any capability a provider lacks is disabled in the UI with the reason visible —
nothing is faked. Generation results carry lineage records (provider, operation,
prompt, model, seed, cost-if-reported) that persist in the project file.

Note: the six-stage pipeline and all post-processing (repair, slicing, packing,
export) work fully offline — only the actual AI calls need a provider.

## The six stages

| Stage | Purpose |
| --- | --- |
| **CREATE** | Describe the character → style preset compose → generate candidate(s) → master approval, character genome (asymmetry, palette, anatomy), multi-view generation for other directions, reference library, upload. |
| **MOTION** | Pose-space blueprint per animation: key poses via Skeleton/Key poses generator or AI, bridge frames ("in-betweens") via AI conditioned on neighbors, per-direction sequence preview. |
| **FRAMES** | The assembly floor: per-frame status (empty/draft/rejected/approved), background removal (color-key + flood fill), upscaling, repair tools (stray-pixel dust, color snap, halo trim), frame conversion, versions & rollback, flip-aware mirroring with genome asymmetry warnings, stability metrics (bbox drift, centroid drift, pixel-diff heat), QA panel. |
| **SLICE** | Import a sheet → grid slicing (columns/rows or cell size, offsets, spacing), smart slicing (connected regions, auto rows), per-slice metadata (name/pivot/direction/frame index/tags), manual rectangle tool, import into animations. |
| **PACK** | Combine approved frames into a texture sheet: grid or binary-tree atlas modes, trim transparent borders (exports `sourceSize`/`trimRect`/`sourceOffset` so alignment is reconstructible), padding, border, edge extrusion, power-of-two, rotation, max size, metadata in Sprite Foundry / Aseprite / Phaser formats, placement-overlap validation, reconstruction proof dialog. |
| **EXPORT** | GIF (real GIF89a with LZW, validated by re-parse: signature + frame count), APNG (acTL/fcTL/fdAT/IEND, validated), PNG sequence ZIP, individual PNGs, sheet + metadata shortcuts, `.spriteproject` save/open, autosave to localStorage. |

**A frame is a frame.** Generated, uploaded, sliced, or AI-produced frames share a
single representation `{ id, imageId, status, tags, lineage, versions, … }`; origin is
metadata (`frame.source`), never a different code path.

## Architecture

```
sprite-foundry/
├── server.mjs                 zero-dep static server + OpenAI proxy + /api/capabilities
├── package.json               start / test / check scripts, jsdom (dev only)
├── .env.example               OPENAI_API_KEY, PORT, OPENAI_MODEL
├── app/
│   ├── index.html             stage rail + rail panels + canvas + timeline shell
│   ├── css/app.css            restrained dark theme, desktop-first, responsive
│   └── js/
│       ├── lib/               pure, dependency-free, Node-testable modules
│       │   ├── util.js        ids, events, bytes, clamp, LRU cache…
│       │   ├── img.js         RGBA pixel ops (fill, blit, crop, diff, flood fill…)
│       │   ├── quantize.js    median-cut palette quantization
│       │   ├── model.js       project schema, genome, blueprints, poses, mirror map
│       │   ├── skeleton.js    pose seeds + interpolation (deterministic)
│       │   ├── filters.js     bg removal, upscale, dust, color snap, halo trim…
│       │   ├── repair.js      project/animation QA validation
│       │   ├── gif.js         GIF89a writer (LZW) AND reader (parse/validate)
│       │   ├── apng.js        APNG writer + validator
│       │   ├── zip.js         ZIP writer/reader (stored + deflate via (De)CompressionStream)
│       │   ├── meta.js        .spriteproject serialize/validate/enumerate
│       │   └── pack.js        grid + atlas packers, sheet metadata (3 schema exporters)
│       ├── image-serializers.js  PNG encode/decode (browser canvas; Node poly entries)
│       ├── browser.js         browser-only glue (canvas↔ImageData, file pickers, imports)
│       ├── imgstore.js        IndexedDB image blob store (+ in-memory fallback)
│       ├── store.js           project state, undo/redo, frame/version mutations
│       ├── providers.js       provider registry, capability probing, job queue
│       ├── genops.js          generation/edit/inbetween orchestration + lineage
│       ├── exporters.js       GIF/APNG/ZIP/PNG sequence/export assembly + validation
│       ├── main.js            app boot, stage shell, project tree, dialogs, autosave
│       └── ui/
│           ├── components.js  form/dialog/toast primitives (no framework)
│           ├── canvasView.js  canvas rendering, onion-skin/ghost/trail overlays
│           ├── timeline.js    frame strip + transport + keyboard shortcuts
│           └── stages/        create.js motion.js frames.js slice.js pack.js exportStage.js
└── tests/                     node --test suite (pure-logic + jsdom boot smoke)
```

### Design rules

- **No build step.** Native ES modules; `npm install` is only needed to run tests.
- **Pure core.** Everything under `app/js/lib/` plus `store.js`/`providers.js`/
  `genops.js`/`exporters.js` avoids touching the DOM and runs under Node — that is
  what the tests exercise.
- **Honest UI.** Unavailable capabilities are disabled *with the reason shown*;
  unrepaired-but-questionable content is warnable, not silently blocked; mirroring
  asymmetric characters warns from genome fields, never silently mirrors text.
- **Undo/redo covers local edits** (frame content, versions, statuses, deletions,
  slice imports…). It does not, and cannot, claim to rewind remote AI calls.
- **Persistence** is layered: images and the project live in IndexedDB; autosave
  debounces to localStorage; `.spriteproject` is the portable interchange (JSON +
  base64 PNGs, versioned, migration hook `MIGRATIONS`).

## Keyboard

`←/→` frame selection · `Space` play/pause · `G` onion-skin · `A/D` cycle directions ·
`Del` delete frame · `Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z` undo/redo · `1..6` jump to stage.

## Rejected/approved workflow

Frames and candidates carry explicit statuses: `empty → draft → approved`,
plus `rejected`. Export only ships **approved** or **draft** frames — rejected frames
never leak into GIFs, atlases, or ZIPs (the export target summary shows exactly what
will ship).
