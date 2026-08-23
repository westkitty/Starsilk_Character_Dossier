# Museum object authority

The Starsilk Compendium museum-object layer is a deterministic public view over existing published-media provenance. It is not a new canon database and it does not authorize new lore.

## Identity

- `docs/asset-manifest.json` remains the published-media provenance ledger.
- A museum object's stable `object_id` is the manifest `filename` with only the final file extension removed.
- The complete manifest `filename` remains the underlying published-media identity and source key.
- `logical_identity` is a descriptive manifest field when present. It is not a replacement identifier.
- `match_status` and `provenance` preserve the manifest's evidentiary description. They are not canon-status fields.
- A context proves that the media was published in the named Compendium section. It does not prove a richer semantic relationship.
- Missing logical identity, alt text, context, provenance, or other descriptive evidence remains unknown. Do not infer it from the image, filename, neighboring records, or lore familiarity.

## Publication and viewer

- `build/museum_publication.py` owns the generated `docs/objects/` tree.
- `docs/objects/objects.json` is a disposable derivative of `docs/asset-manifest.json` and must remain reproducible from it.
- The human museum lives at `/objects/`; individual object deep links use `/objects/#<object-id>`.
- The collection list loads metadata only. Media bytes are requested only after a reader selects or deep-links an individual object.
- A selected object creates one viewer media element. Do not preload adjacent objects or build hidden image/video carousels.
- Images and videos share the same object model. Video never autoplays in the museum viewer.
- The fullscreen presentation is an accessible viewport dialog. Browser Fullscreen API entry is optional and user-triggered only.
- Closing the viewer removes its media element so video/download activity does not continue invisibly.

## Source-media boundary

- `media/source/` contains canonical originals and remains intentionally outside the production Git repository.
- Phase 4 does not regenerate, replace, commit, or claim new backup coverage for canonical originals.
- Existing published derivatives in `docs/assets/media/` are consumed as-is.

## IIIF decision

Static IIIF is **not adopted in Phase 4**. The current collection is already a compact static mix of optimized raster images and MP4 video, and the requested viewer can operate directly on those published derivatives. Adding IIIF now would require additional derivative/tiling infrastructure and distribution surfaces without a current deep-zoom, region-annotation, or interoperability requirement. Re-evaluate IIIF only if a later museum requirement actually needs those capabilities.
