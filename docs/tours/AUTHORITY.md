# Starsilk curated tours and browser-local library — authority boundary

`docs/tours/` is generated Phase 8 publication. It is an editorial navigation and browser-local convenience surface, not canon/content authority, chronology authority, relationship authority, or a server-side user database.

Authority remains upstream:

1. `src/tours/tours.json` owns only the stable curated-tour IDs and their binding to an existing authored navigation group.
2. `src/content/nav.json` owns the ordered stable-record membership of those navigation groups.
3. Existing section authority owns record identity and display content; `/entities/<stable-id>/` remains the canonical human record destination.
4. Generated `docs/tours/tours.json` and HTML are disposable derivatives.

## Tour semantics

- A tour is an editorial route through existing stable Compendium records.
- Tour order is navigation order only. It does not assert chronology, causality, importance, faction membership, kinship, or any other semantic relationship.
- Tour stops contain stable IDs and links, not duplicated canon prose. Canon facts remain in the cited record authority.
- Missing records, dates, semantic relationships, coordinates, and other unauthored facts remain unknown rather than being filled for tour convenience.

## Browser-local library semantics

The human `/tours/` page may use `localStorage` to keep bookmarks, recent openings, local history, tour progress, and user-named collections in that browser profile.

- no account or sign-in is required;
- no analytics, telemetry, beacon, or server write is used;
- local collection names and local history are not published in generated files;
- user-authored collection names are never serialized into public URLs by the Phase 8 client;
- a bookmark, collection, recent item, history entry, or completion mark is user preference/state only and is never canon evidence;
- clearing site storage removes the persistent local library; if storage is unavailable, the page falls back to session-memory behavior without exporting that state.

If a generated tour conflicts with its cited navigation or record authority, the generated tour is wrong and must be regenerated or repaired.
