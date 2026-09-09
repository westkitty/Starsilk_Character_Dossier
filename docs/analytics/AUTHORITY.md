# Starsilk fan analytics dashboard authority

`dashboard.json` declares a fan-facing **sample-data** analytics dashboard. It
is presentation/configuration authority only: audience, segments, collections,
folio rows, and the deterministic sample-data generation parameters consumed by
`build/analytics_publication.py`.

- Every number on the dashboard is **illustrative sample data**, generated
  deterministically from the declared seed. Nothing is measured, tracked, or
  collected from real readers, and nothing here is canon, relationship,
  chronology, or media-provenance evidence.
- The dashboard links to existing stable records (`/entities/<stable-id>/`,
  `/tours/`) for fan convenience. Those links reuse established identities;
  they do not create new entities or relocate authority.
- Client-side aggregation rules (range sums, segment shares, folio affinity
  weighting, trend deltas) are deterministic functions of the published
  `analytics.json` and only change the current rendered view.
- Generated outputs under `docs/analytics/` are disposable.
  `build/analytics_publication.py --check` must reproduce them byte-for-byte.
- The page loads no third-party network resources and stores only a
  browser-local theme preference. There is no analytics tracking on the
  analytics page.
