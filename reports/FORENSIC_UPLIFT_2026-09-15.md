# Forensic uplift ledger — 2026-09-15

## Final auditable slate

Scope is an additive, browser-local Reader Workbench on the generated root Compendium. It operates only on existing stable section IDs and rendered same-document cross-reference anchors. It creates no lore, canon, semantic relationships, account, server, dependency, telemetry, or runtime network request. Production source is `src/templates/shell.html.j2` + `src/templates/style.css` + `src/templates/reader-workbench.js`, injected by `build/generate.py` into `docs/index.html`.

Every row below owns one observable behavior. Rows are intentionally exclusive: no control, state transition, presentation affordance, or implementation boundary is credited to a second category. `LOCAL VERIFIED — PINNED CI PENDING` means the production path has passed the local Mac/browser and CI-like static evidence listed below; the authoritative pinned Linux CI jobs and protected-branch delivery are still pending.

### UI / UX — 20

- UIUX-01 — labelled root Workbench opener | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-02 — named Workbench heading and close control | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-03 — grouped current, find, reading, preferences, route, Atlas, and data panels | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-04 — polite live region for action and import outcomes | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-05 — current-record visual summary with title and stable ID | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-06 — compact metadata chips for local counts | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-07 — document-position progress bar | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-08 — responsive bottom-sheet layout at phone widths | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-09 — every Workbench button, including list actions, has a 44px minimum target | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-10 — keyboard-visible focus treatment | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-11 — disabled boundary controls have a distinct disabled state | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-12 — selected preference buttons expose pressed state | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-13 — font scale presentation applies to the root document | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-14 — line-leading presentation applies to the root document | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-15 — focus-reading presentation de-emphasizes surrounding chrome | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-16 — high-contrast presentation projects readable root variables | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-17 — compact-record presentation reduces supported record spacing | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-18 — concise browser-local privacy notice | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-19 — visible guidance copy names keyboard control and local boundary | LOCAL VERIFIED — PINNED CI PENDING
- UIUX-20 — Workbench and opener are excluded from print | LOCAL VERIFIED — PINNED CI PENDING

### Primary interaction — 20

- GAME-01 — open the Workbench from root controls | LOCAL VERIFIED — PINNED CI PENDING
- GAME-02 — close the Workbench with its close control | LOCAL VERIFIED — PINNED CI PENDING
- GAME-03 — Ctrl/Cmd+K toggles the Workbench and transfers focus | LOCAL VERIFIED — PINNED CI PENDING
- GAME-04 — Escape closes the Workbench and returns focus to its opener | LOCAL VERIFIED — PINNED CI PENDING
- GAME-05 — resume a preserved prior-session destination | LOCAL VERIFIED — PINNED CI PENDING
- GAME-06 — advance to the next stable source record | LOCAL VERIFIED — PINNED CI PENDING
- GAME-07 — return to the previous stable source record | LOCAL VERIFIED — PINNED CI PENDING
- GAME-08 — choose a genuinely random different stable record where an alternative exists | LOCAL VERIFIED — PINNED CI PENDING
- GAME-09 — open a stable search result | LOCAL VERIFIED — PINNED CI PENDING
- GAME-10 — open a direct Thread Atlas citation destination | LOCAL VERIFIED — PINNED CI PENDING
- GAME-11 — open the left comparison destination | LOCAL VERIFIED — PINNED CI PENDING
- GAME-12 — open the right comparison destination | LOCAL VERIFIED — PINNED CI PENDING
- GAME-13 — assign the current record as comparison left | LOCAL VERIFIED — PINNED CI PENDING
- GAME-14 — assign the current record as comparison right | LOCAL VERIFIED — PINNED CI PENDING
- GAME-15 — swap comparison sides | LOCAL VERIFIED — PINNED CI PENDING
- GAME-16 — clear the comparison pair | LOCAL VERIFIED — PINNED CI PENDING
- GAME-17 — choose a font-size preference | LOCAL VERIFIED — PINNED CI PENDING
- GAME-18 — choose a line-leading preference | LOCAL VERIFIED — PINNED CI PENDING
- GAME-19 — toggle focus-reading preference | LOCAL VERIFIED — PINNED CI PENDING
- GAME-20 — toggle high-contrast or compact-record preference | LOCAL VERIFIED — PINNED CI PENDING

### Backend / technical — 20

- BACK-01 — versioned local state contract | LOCAL VERIFIED — PINNED CI PENDING
- BACK-02 — stable-ID allowlist derived from rendered root sections | LOCAL VERIFIED — PINNED CI PENDING
- BACK-03 — malformed local-storage JSON falls back to a safe default state | LOCAL VERIFIED — PINNED CI PENDING
- BACK-04 — version mismatch resets to the safe default schema | LOCAL VERIFIED — PINNED CI PENDING
- BACK-05 — imported and persisted ID lists are deduplicated | LOCAL VERIFIED — PINNED CI PENDING
- BACK-06 — queue and saved-record lists are capped at 48 IDs | LOCAL VERIFIED — PINNED CI PENDING
- BACK-07 — recent history is capped at 24 ID/timestamp entries | LOCAL VERIFIED — PINNED CI PENDING
- BACK-08 — visit counters are numeric, positive, and capped | LOCAL VERIFIED — PINNED CI PENDING
- BACK-09 — persisted state contains IDs, counters, and preferences rather than dossier prose or media | LOCAL VERIFIED — PINNED CI PENDING
- BACK-10 — localStorage read failure uses in-memory defaults | LOCAL VERIFIED — PINNED CI PENDING
- BACK-11 — localStorage write failure continues in-memory and exposes its local-only fallback | LOCAL VERIFIED — PINNED CI PENDING
- BACK-12 — import requires Reader Workbench schema version 1 | LOCAL VERIFIED — PINNED CI PENDING
- BACK-13 — accepted imports sanitize before storage | LOCAL VERIFIED — PINNED CI PENDING
- BACK-14 — hostile external or unknown IDs are rejected from every state field | LOCAL VERIFIED — PINNED CI PENDING
- BACK-15 — every record action validates the same stable-ID allowlist before navigation | LOCAL VERIFIED — PINNED CI PENDING
- BACK-16 — generated stable links retain current origin/path and encoded fragment only | LOCAL VERIFIED — PINNED CI PENDING
- BACK-17 — Thread Atlas derives only direct rendered in-section hash anchors | LOCAL VERIFIED — PINNED CI PENDING
- BACK-18 — Thread Atlas removes duplicate/self/invalid citation targets | LOCAL VERIFIED — PINNED CI PENDING
- BACK-19 — storage events rehydrate an open Workbench from its local-state key | LOCAL VERIFIED — PINNED CI PENDING
- BACK-20 — debounced scroll rendering avoids synchronous update churn without a fetch path | LOCAL VERIFIED — PINNED CI PENDING

### Quality of life — 20

- QOL-01 — quick local record search by stable ID, title, or group | LOCAL VERIFIED — PINNED CI PENDING
- QOL-02 — record inventory total | LOCAL VERIFIED — PINNED CI PENDING
- QOL-03 — current outgoing-citation total | LOCAL VERIFIED — PINNED CI PENDING
- QOL-04 — current visited-citation total | LOCAL VERIFIED — PINNED CI PENDING
- QOL-05 — current unvisited-citation total | LOCAL VERIFIED — PINNED CI PENDING
- QOL-06 — explicit next-unvisited-citation action | LOCAL VERIFIED — PINNED CI PENDING
- QOL-07 — explicit jump-to-current-record action | LOCAL VERIFIED — PINNED CI PENDING
- QOL-08 — explicit back-to-top action | LOCAL VERIFIED — PINNED CI PENDING
- QOL-09 — open the first queued record | LOCAL VERIFIED — PINNED CI PENDING
- QOL-10 — open the next queued record relative to the current queue position | LOCAL VERIFIED — PINNED CI PENDING
- QOL-11 — open the previous queued record relative to the current queue position | LOCAL VERIFIED — PINNED CI PENDING
- QOL-12 — move one queued record up | LOCAL VERIFIED — PINNED CI PENDING
- QOL-13 — move one queued record down | LOCAL VERIFIED — PINNED CI PENDING
- QOL-14 — reverse the reading route | LOCAL VERIFIED — PINNED CI PENDING
- QOL-15 — clear saved records without clearing route/history/preferences | LOCAL VERIFIED — PINNED CI PENDING
- QOL-16 — clear recent history without clearing route/saved/preferences | LOCAL VERIFIED — PINNED CI PENDING
- QOL-17 — reset visit counters without clearing other local state | LOCAL VERIFIED — PINNED CI PENDING
- QOL-18 — copy the route as title plus stable-link lines | LOCAL VERIFIED — PINNED CI PENDING
- QOL-19 — copy the comparison pair as title plus stable-link lines | LOCAL VERIFIED — PINNED CI PENDING
- QOL-20 — copy the current Thread Atlas as stable-ID evidence lines | LOCAL VERIFIED — PINNED CI PENDING

### Features — 20

- FEAT-01 — local reading-route list | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-02 — add current record to the route | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-03 — remove one record from the route | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-04 — clear the route without clearing other reader state | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-05 — local saved-record list | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-06 — save or unsave the current record | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-07 — local recent-path list | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-08 — remove one recent-path entry | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-09 — current-record visit counter | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-10 — comparison-pair summary card | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-11 — browser-local state export | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-12 — browser-local state import | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-13 — sanitized import-result count summary | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-14 — export schema/version and no-prose explanation | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-15 — dismissible and restorable Workbench guidance | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-16 — active-preference summary | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-17 — safe empty-route navigation feedback | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-18 — safe no-search-results feedback | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-19 — safe empty-Atlas and exhausted-Atlas feedback | LOCAL VERIFIED — PINNED CI PENDING
- FEAT-20 — clear all Workbench local data | LOCAL VERIFIED — PINNED CI PENDING

### Additional WOW improvement

- WOW-01 — Thread Atlas is a current-record, evidence-bounded navigator: it lists only the direct same-document cross-reference targets physically rendered in that record, labels local visited/unvisited state, provides the next unvisited citation action, and copies a stable-ID evidence list. It does not construct a graph of other records or infer relationship semantics. | LOCAL VERIFIED — PINNED CI PENDING

## Verification state before protected-branch delivery

`tests/test_forensic_uplift.py` exercises hostile state and import sanitization, same-origin request auditing, storage failure fallback, queue/saved/recent/comparison operations, prior-session resume, keyboard/guidance/preferences, search and live counts, copy/export surfaces without prose leakage, exact Atlas xref boundaries and next-unvisited navigation, 375×812 layout/touch targets, and reduced-motion scrolling. Local Chromium focused coverage is **6/6 passed**. Representative local Firefox and WebKit journeys are **12/12 passed on each browser**.

A CI-like copy with the intentionally uncommitted `media/source/` excluded passed `./tools/build.sh`, `./tools/build.sh --check`, strict validation, public-boundary validation (**576 files**), and derivation-map validation (**42 nodes / 92 edges**); strict validation reported **16 canon locks / 0 violations**, **36 Drakken art assertions / 0 failures**, and **213 manifest-backed published media files with 0 manifest errors**. The complete local Chromium suite reached **236 passed / 1 skipped**; its six remaining local-only failures were four screenshot comparisons against Linux-pinned references plus two Git-ignore tests caused by running the copied tree without `.git`. The two Git-ignore tests then passed **2/2** in the real repository. No visual baseline was refreshed.

The only remaining proof gate is the repository's authoritative protected-branch CI: pinned Playwright Linux Chromium full-suite plus Firefox/WebKit jobs, followed by merge and live Pages verification.
