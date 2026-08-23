# Starsilk offline museum publication authority

`config.json` declares a deliberately narrow, deterministic offline cache for
the public site. It is delivery configuration, not canon authority.

- The cache contains the root reading shell, its installation metadata, and
  public JSON indexes only.
- `docs/assets/media/` is always on demand. The service worker neither
  precaches it nor places responses from that path into Cache Storage.
- The worker is registered with the repository-relative `./` scope. It cannot
  claim any parent GitHub Pages path.
- A visible root-page control clears every cache owned by the Starsilk offline
  worker. Registration, cache-population, and clear failures leave ordinary
  network browsing available and are exposed in the status region.
- Generated outputs are disposable. `build/offline_publication.py --check`
  must reproduce them byte-for-byte.
