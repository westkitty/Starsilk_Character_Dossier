# Forensic uplift ledger — 2026-09-15

## Final auditable slate

Scope is an additive, browser-local Reader Workbench on the generated root Compendium. It operates only on existing stable section IDs and rendered same-document cross-reference anchors. It creates no lore, canon, semantic relationships, account, server, dependency, telemetry, or runtime network request. Production source is `src/templates/shell.html.j2` + `src/templates/style.css` + `src/templates/reader-workbench.js`, injected by `build/generate.py` into `docs/index.html`.

Every row below owns one observable behavior. Rows are intentionally exclusive: no control, state transition, presentation affordance, or implementation boundary is credited to a second category. `PINNED CI VERIFIED — MERGE/LIVE PENDING` means the production path passed local proof and authoritative GitHub Actions run `35031504532`; only protected merge and live Pages verification remain.

### UI / UX — 20

- UIUX-01 — labelled root Workbench opener | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-02 — named Workbench heading and close control | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-03 — grouped current, find, reading, preferences, route, Atlas, and data panels | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-04 — polite live region for action and import outcomes | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-05 — current-record visual summary with title and stable ID | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-06 — compact metadata chips for local counts | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-07 — document-position progress bar | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-08 — responsive bottom-sheet layout at phone widths | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-09 — every Workbench button, including list actions, has a 44px minimum target | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-10 — keyboard-visible focus treatment | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-11 — disabled boundary controls have a distinct disabled state | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-12 — selected preference buttons expose pressed state | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-13 — font scale presentation applies to the root document | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-14 — line-leading presentation applies to the root document | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-15 — focus-reading presentation de-emphasizes surrounding chrome | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-16 — high-contrast presentation projects readable root variables | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-17 — compact-record presentation reduces supported record spacing | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-18 — concise browser-local privacy notice | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-19 — visible guidance copy names keyboard control and local boundary | PINNED CI VERIFIED — MERGE/LIVE PENDING
- UIUX-20 — Workbench and opener are excluded from print | PINNED CI VERIFIED — MERGE/LIVE PENDING

### Primary interaction — 20

- GAME-01 — open the Workbench from root controls | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-02 — close the Workbench with its close control | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-03 — Ctrl/Cmd+K toggles the Workbench and transfers focus | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-04 — Escape closes the Workbench and returns focus to its opener | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-05 — resume a preserved prior-session destination | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-06 — advance to the next stable source record | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-07 — return to the previous stable source record | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-08 — choose a genuinely random different stable record where an alternative exists | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-09 — open a stable search result | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-10 — open a direct Thread Atlas citation destination | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-11 — open the left comparison destination | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-12 — open the right comparison destination | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-13 — assign the current record as comparison left | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-14 — assign the current record as comparison right | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-15 — swap comparison sides | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-16 — clear the comparison pair | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-17 — choose a font-size preference | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-18 — choose a line-leading preference | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-19 — toggle focus-reading preference | PINNED CI VERIFIED — MERGE/LIVE PENDING
- GAME-20 — toggle high-contrast or compact-record preference | PINNED CI VERIFIED — MERGE/LIVE PENDING

### Backend / technical — 20

- BACK-01 — versioned local state contract | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-02 — stable-ID allowlist derived from rendered root sections | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-03 — malformed local-storage JSON falls back to a safe default state | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-04 — version mismatch resets to the safe default schema | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-05 — imported and persisted ID lists are deduplicated | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-06 — queue and saved-record lists are capped at 48 IDs | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-07 — recent history is capped at 24 ID/timestamp entries | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-08 — visit counters are numeric, positive, and capped | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-09 — persisted state contains IDs, counters, and preferences rather than dossier prose or media | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-10 — localStorage read failure uses in-memory defaults | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-11 — localStorage write failure continues in-memory and exposes its local-only fallback | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-12 — import requires Reader Workbench schema version 1 | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-13 — accepted imports sanitize before storage | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-14 — hostile external or unknown IDs are rejected from every state field | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-15 — every record action validates the same stable-ID allowlist before navigation | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-16 — generated stable links retain current origin/path and encoded fragment only | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-17 — Thread Atlas derives only direct rendered in-section hash anchors | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-18 — Thread Atlas removes duplicate/self/invalid citation targets | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-19 — storage events rehydrate an open Workbench from its local-state key | PINNED CI VERIFIED — MERGE/LIVE PENDING
- BACK-20 — debounced scroll rendering avoids synchronous update churn without a fetch path | PINNED CI VERIFIED — MERGE/LIVE PENDING

### Quality of life — 20

- QOL-01 — quick local record search by stable ID, title, or group | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-02 — record inventory total | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-03 — current outgoing-citation total | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-04 — current visited-citation total | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-05 — current unvisited-citation total | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-06 — explicit next-unvisited-citation action | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-07 — explicit jump-to-current-record action | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-08 — explicit back-to-top action | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-09 — open the first queued record | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-10 — open the next queued record relative to the current queue position | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-11 — open the previous queued record relative to the current queue position | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-12 — move one queued record up | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-13 — move one queued record down | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-14 — reverse the reading route | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-15 — clear saved records without clearing route/history/preferences | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-16 — clear recent history without clearing route/saved/preferences | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-17 — reset visit counters without clearing other local state | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-18 — copy the route as title plus stable-link lines | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-19 — copy the comparison pair as title plus stable-link lines | PINNED CI VERIFIED — MERGE/LIVE PENDING
- QOL-20 — copy the current Thread Atlas as stable-ID evidence lines | PINNED CI VERIFIED — MERGE/LIVE PENDING

### Features — 20

- FEAT-01 — local reading-route list | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-02 — add current record to the route | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-03 — remove one record from the route | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-04 — clear the route without clearing other reader state | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-05 — local saved-record list | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-06 — save or unsave the current record | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-07 — local recent-path list | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-08 — remove one recent-path entry | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-09 — current-record visit counter | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-10 — comparison-pair summary card | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-11 — browser-local state export | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-12 — browser-local state import | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-13 — sanitized import-result count summary | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-14 — export schema/version and no-prose explanation | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-15 — dismissible and restorable Workbench guidance | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-16 — active-preference summary | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-17 — safe empty-route navigation feedback | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-18 — safe no-search-results feedback | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-19 — safe empty-Atlas and exhausted-Atlas feedback | PINNED CI VERIFIED — MERGE/LIVE PENDING
- FEAT-20 — clear all Workbench local data | PINNED CI VERIFIED — MERGE/LIVE PENDING

### Additional WOW improvement

- WOW-01 — Thread Atlas is a current-record, evidence-bounded navigator: it lists only the direct same-document cross-reference targets physically rendered in that record, labels local visited/unvisited state, provides the next unvisited citation action, and copies a stable-ID evidence list. It does not construct a graph of other records or infer relationship semantics. | PINNED CI VERIFIED — MERGE/LIVE PENDING

## Verification state before protected-branch delivery

`tests/test_forensic_uplift.py` exercises hostile state and import sanitization, same-origin request auditing, storage failure fallback, queue/saved/recent/comparison operations, prior-session resume, keyboard/guidance/preferences, search and live counts, copy/export surfaces without prose leakage, exact Atlas xref boundaries and next-unvisited navigation, 375×812 layout/touch targets, and reduced-motion scrolling. Local Chromium focused coverage is **6/6 passed**. Representative local Firefox and WebKit journeys are **12/12 passed on each browser**.

A CI-like copy with the intentionally uncommitted `media/source/` excluded passed `./tools/build.sh`, `./tools/build.sh --check`, strict validation, public-boundary validation (**576 files**), and derivation-map validation (**42 nodes / 92 edges**); strict validation reported **16 canon locks / 0 violations**, **36 Drakken art assertions / 0 failures**, and **213 manifest-backed published media files with 0 manifest errors**. The complete local Chromium suite reached **236 passed / 1 skipped**; its six remaining local-only failures were four screenshot comparisons against Linux-pinned references plus two Git-ignore tests caused by running the copied tree without `.git`. The two Git-ignore tests then passed **2/2** in the real repository. No visual baseline was refreshed.

Authoritative GitHub Actions run `35031504532` is green: pinned Linux Chromium **242 passed / 1 skipped**, Firefox **12 passed**, WebKit **12 passed**, Operational State freshness closed against base `5537f411354e3a3e83849f8c369cc628d4e5faaf`, and the public-boundary gate again passed 576 files. Only protected merge and live Pages verification remain.
