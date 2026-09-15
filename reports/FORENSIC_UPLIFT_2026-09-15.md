# Forensic uplift ledger — 2026-09-15

## Final auditable slate

Scope is an additive, browser-local Reader Workbench on the generated root Compendium. It operates only on existing stable section IDs and rendered same-document cross-reference anchors. It creates no lore, canon, semantic relationships, account, server, dependency, telemetry, or runtime network request. Production source is `src/templates/shell.html.j2` + `src/templates/style.css` + `src/templates/reader-workbench.js`, injected by `build/generate.py` into `docs/index.html`.

Every row below owns one observable behavior. Rows are intentionally exclusive: no control, state transition, presentation affordance, or implementation boundary is credited to a second category. `VERIFIED COMPLETE` means the production path passed local proof, protected PR CI, protected merge, main CI, and exact live Pages byte-parity proof recorded below.

### UI / UX — 20

- UIUX-01 — labelled root Workbench opener | VERIFIED COMPLETE
- UIUX-02 — named Workbench heading and close control | VERIFIED COMPLETE
- UIUX-03 — grouped current, find, reading, preferences, route, Atlas, and data panels | VERIFIED COMPLETE
- UIUX-04 — polite live region for action and import outcomes | VERIFIED COMPLETE
- UIUX-05 — current-record visual summary with title and stable ID | VERIFIED COMPLETE
- UIUX-06 — compact metadata chips for local counts | VERIFIED COMPLETE
- UIUX-07 — document-position progress bar | VERIFIED COMPLETE
- UIUX-08 — responsive bottom-sheet layout at phone widths | VERIFIED COMPLETE
- UIUX-09 — every Workbench button, including list actions, has a 44px minimum target | VERIFIED COMPLETE
- UIUX-10 — keyboard-visible focus treatment | VERIFIED COMPLETE
- UIUX-11 — disabled boundary controls have a distinct disabled state | VERIFIED COMPLETE
- UIUX-12 — selected preference buttons expose pressed state | VERIFIED COMPLETE
- UIUX-13 — font scale presentation applies to the root document | VERIFIED COMPLETE
- UIUX-14 — line-leading presentation applies to the root document | VERIFIED COMPLETE
- UIUX-15 — focus-reading presentation de-emphasizes surrounding chrome | VERIFIED COMPLETE
- UIUX-16 — high-contrast presentation projects readable root variables | VERIFIED COMPLETE
- UIUX-17 — compact-record presentation reduces supported record spacing | VERIFIED COMPLETE
- UIUX-18 — concise browser-local privacy notice | VERIFIED COMPLETE
- UIUX-19 — visible guidance copy names keyboard control and local boundary | VERIFIED COMPLETE
- UIUX-20 — Workbench and opener are excluded from print | VERIFIED COMPLETE

### Primary interaction — 20

- GAME-01 — open the Workbench from root controls | VERIFIED COMPLETE
- GAME-02 — close the Workbench with its close control | VERIFIED COMPLETE
- GAME-03 — Ctrl/Cmd+K toggles the Workbench and transfers focus | VERIFIED COMPLETE
- GAME-04 — Escape closes the Workbench and returns focus to its opener | VERIFIED COMPLETE
- GAME-05 — resume a preserved prior-session destination | VERIFIED COMPLETE
- GAME-06 — advance to the next stable source record | VERIFIED COMPLETE
- GAME-07 — return to the previous stable source record | VERIFIED COMPLETE
- GAME-08 — choose a genuinely random different stable record where an alternative exists | VERIFIED COMPLETE
- GAME-09 — open a stable search result | VERIFIED COMPLETE
- GAME-10 — open a direct Thread Atlas citation destination | VERIFIED COMPLETE
- GAME-11 — open the left comparison destination | VERIFIED COMPLETE
- GAME-12 — open the right comparison destination | VERIFIED COMPLETE
- GAME-13 — assign the current record as comparison left | VERIFIED COMPLETE
- GAME-14 — assign the current record as comparison right | VERIFIED COMPLETE
- GAME-15 — swap comparison sides | VERIFIED COMPLETE
- GAME-16 — clear the comparison pair | VERIFIED COMPLETE
- GAME-17 — choose a font-size preference | VERIFIED COMPLETE
- GAME-18 — choose a line-leading preference | VERIFIED COMPLETE
- GAME-19 — toggle focus-reading preference | VERIFIED COMPLETE
- GAME-20 — toggle high-contrast or compact-record preference | VERIFIED COMPLETE

### Backend / technical — 20

- BACK-01 — versioned local state contract | VERIFIED COMPLETE
- BACK-02 — stable-ID allowlist derived from rendered root sections | VERIFIED COMPLETE
- BACK-03 — malformed local-storage JSON falls back to a safe default state | VERIFIED COMPLETE
- BACK-04 — version mismatch resets to the safe default schema | VERIFIED COMPLETE
- BACK-05 — imported and persisted ID lists are deduplicated | VERIFIED COMPLETE
- BACK-06 — queue and saved-record lists are capped at 48 IDs | VERIFIED COMPLETE
- BACK-07 — recent history is capped at 24 ID/timestamp entries | VERIFIED COMPLETE
- BACK-08 — visit counters are numeric, positive, and capped | VERIFIED COMPLETE
- BACK-09 — persisted state contains IDs, counters, and preferences rather than dossier prose or media | VERIFIED COMPLETE
- BACK-10 — localStorage read failure uses in-memory defaults | VERIFIED COMPLETE
- BACK-11 — localStorage write failure continues in-memory and exposes its local-only fallback | VERIFIED COMPLETE
- BACK-12 — import requires Reader Workbench schema version 1 | VERIFIED COMPLETE
- BACK-13 — accepted imports sanitize before storage | VERIFIED COMPLETE
- BACK-14 — hostile external or unknown IDs are rejected from every state field | VERIFIED COMPLETE
- BACK-15 — every record action validates the same stable-ID allowlist before navigation | VERIFIED COMPLETE
- BACK-16 — generated stable links retain current origin/path and encoded fragment only | VERIFIED COMPLETE
- BACK-17 — Thread Atlas derives only direct rendered in-section hash anchors | VERIFIED COMPLETE
- BACK-18 — Thread Atlas removes duplicate/self/invalid citation targets | VERIFIED COMPLETE
- BACK-19 — storage events rehydrate an open Workbench from its local-state key | VERIFIED COMPLETE
- BACK-20 — debounced scroll rendering avoids synchronous update churn without a fetch path | VERIFIED COMPLETE

### Quality of life — 20

- QOL-01 — quick local record search by stable ID, title, or group | VERIFIED COMPLETE
- QOL-02 — record inventory total | VERIFIED COMPLETE
- QOL-03 — current outgoing-citation total | VERIFIED COMPLETE
- QOL-04 — current visited-citation total | VERIFIED COMPLETE
- QOL-05 — current unvisited-citation total | VERIFIED COMPLETE
- QOL-06 — explicit next-unvisited-citation action | VERIFIED COMPLETE
- QOL-07 — explicit jump-to-current-record action | VERIFIED COMPLETE
- QOL-08 — explicit back-to-top action | VERIFIED COMPLETE
- QOL-09 — open the first queued record | VERIFIED COMPLETE
- QOL-10 — open the next queued record relative to the current queue position | VERIFIED COMPLETE
- QOL-11 — open the previous queued record relative to the current queue position | VERIFIED COMPLETE
- QOL-12 — move one queued record up | VERIFIED COMPLETE
- QOL-13 — move one queued record down | VERIFIED COMPLETE
- QOL-14 — reverse the reading route | VERIFIED COMPLETE
- QOL-15 — clear saved records without clearing route/history/preferences | VERIFIED COMPLETE
- QOL-16 — clear recent history without clearing route/saved/preferences | VERIFIED COMPLETE
- QOL-17 — reset visit counters without clearing other local state | VERIFIED COMPLETE
- QOL-18 — copy the route as title plus stable-link lines | VERIFIED COMPLETE
- QOL-19 — copy the comparison pair as title plus stable-link lines | VERIFIED COMPLETE
- QOL-20 — copy the current Thread Atlas as stable-ID evidence lines | VERIFIED COMPLETE

### Features — 20

- FEAT-01 — local reading-route list | VERIFIED COMPLETE
- FEAT-02 — add current record to the route | VERIFIED COMPLETE
- FEAT-03 — remove one record from the route | VERIFIED COMPLETE
- FEAT-04 — clear the route without clearing other reader state | VERIFIED COMPLETE
- FEAT-05 — local saved-record list | VERIFIED COMPLETE
- FEAT-06 — save or unsave the current record | VERIFIED COMPLETE
- FEAT-07 — local recent-path list | VERIFIED COMPLETE
- FEAT-08 — remove one recent-path entry | VERIFIED COMPLETE
- FEAT-09 — current-record visit counter | VERIFIED COMPLETE
- FEAT-10 — comparison-pair summary card | VERIFIED COMPLETE
- FEAT-11 — browser-local state export | VERIFIED COMPLETE
- FEAT-12 — browser-local state import | VERIFIED COMPLETE
- FEAT-13 — sanitized import-result count summary | VERIFIED COMPLETE
- FEAT-14 — export schema/version and no-prose explanation | VERIFIED COMPLETE
- FEAT-15 — dismissible and restorable Workbench guidance | VERIFIED COMPLETE
- FEAT-16 — active-preference summary | VERIFIED COMPLETE
- FEAT-17 — safe empty-route navigation feedback | VERIFIED COMPLETE
- FEAT-18 — safe no-search-results feedback | VERIFIED COMPLETE
- FEAT-19 — safe empty-Atlas and exhausted-Atlas feedback | VERIFIED COMPLETE
- FEAT-20 — clear all Workbench local data | VERIFIED COMPLETE

### Additional WOW improvement

- WOW-01 — Thread Atlas is a current-record, evidence-bounded navigator: it lists only the direct same-document cross-reference targets physically rendered in that record, labels local visited/unvisited state, provides the next unvisited citation action, and copies a stable-ID evidence list. It does not construct a graph of other records or infer relationship semantics. | VERIFIED COMPLETE

## Verification state before protected-branch delivery

`tests/test_forensic_uplift.py` exercises hostile state and import sanitization, same-origin request auditing, storage failure fallback, queue/saved/recent/comparison operations, prior-session resume, keyboard/guidance/preferences, search and live counts, copy/export surfaces without prose leakage, exact Atlas xref boundaries and next-unvisited navigation, 375×812 layout/touch targets, and reduced-motion scrolling. Local Chromium focused coverage is **6/6 passed**. Representative local Firefox and WebKit journeys are **12/12 passed on each browser**.

A CI-like copy with the intentionally uncommitted `media/source/` excluded passed `./tools/build.sh`, `./tools/build.sh --check`, strict validation, public-boundary validation (**576 files**), and derivation-map validation (**42 nodes / 92 edges**); strict validation reported **16 canon locks / 0 violations**, **36 Drakken art assertions / 0 failures**, and **213 manifest-backed published media files with 0 manifest errors**. The complete local Chromium suite reached **236 passed / 1 skipped**; its six remaining local-only failures were four screenshot comparisons against Linux-pinned references plus two Git-ignore tests caused by running the copied tree without `.git`. The two Git-ignore tests then passed **2/2** in the real repository. No visual baseline was refreshed.

Authoritative PR CI run `35031829035` is green, and PR #64 merged at `1828b0f1cff57b9107cc548b5fa49deba6139839`. Main CI run `35032076500` then passed the full pinned Chromium suite plus Firefox/WebKit; Pages publish run `35032076495`, Pages deployment run `35032090194`, and Build Provenance succeeded for the same merge. A cache-busted live fetch proved exact byte parity for `docs/index.html` (`c0eea9e3a0412ed0f9c5f78e08cf1061ec10d2d861d1fb9925209dd187380811`) and `docs/service-worker.js` (`c87b3dd810d93256296c265872048904cffa4d5357988e7008f3c7cfeb74c304`) and exposed `readerWorkbenchToggle`, `readerWorkbench`, `Thread Atlas`, and `starsilk-reader-workbench/v1` on the live Pages root. This uplift is VERIFIED COMPLETE.
