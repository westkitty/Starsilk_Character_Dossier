# Starsilk chronology authority boundary

`src/chronology/events.json` is a Phase 9 source-backed event index. It records only labels, headings, exact temporal markers, explicit relative relations, and an authored duration that are recoverable from `src/content/sections/chronology.body.html`, whose existing stable source record is `chronology` and whose authored source key is `five-phase-canon-chronology`.

The source body remains the authority for prose. This index and every `docs/chronology/` file are deterministic derivatives, not a second canon prose database.

## Identity and time

`event_id` is a Phase 9 publication identity established from a direct authored event label. It is not inferred from page position, a fabricated date, or an implied causal relationship. Every event points back to the existing `chronology` record and its source heading.

`absolute_date` is null unless an authored absolute date exists. An exact authored marker (for example `Year 121`) remains text in its authored relative system; it is not converted into a universal calendar. `before_event_ids` and `after_event_ids` appear only for relationships directly stated in the source. An absent relationship is unknown, not a license to use the source list order as chronology.

## Independent status dimensions

Visibility, canon status, spoiler level, and temporal certainty are independent fields. The existing source record is public, so event visibility is public. No event-level structured canon or spoiler metadata is authored; both values are `unknown`. Public publication does not establish canon, and unknown does not mean speculative.

The human explorer filters only rendered cards in the current browser view. It never writes, changes, or omits status fields from `chronology.json`.
