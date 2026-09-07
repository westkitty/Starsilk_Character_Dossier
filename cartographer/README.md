# STARSiLK Temporal Cartographer

Standalone static authoring subsystem for the STARSiLK Character Dossier repository. It intentionally does not participate in the dossier's Python/Jinja `src/ -> docs/` publication pipeline and does not modify generated dossier output.

## Authority boundary

- Cartographer project JSON is authoritative only for Cartographer-authored spatial, visual, orbital, and historical map state.
- Existing STARSiLK canon authorities remain controlling for canon facts.
- Missing coordinates, dates, populations, relationships, or Siege Wall node counts stay unknown unless sourced.
- Demonstration coordinates must be marked `SCHEMATIC / NON-CANON POSITION`.
- The renderer derives Three.js objects from project JSON; Three.js objects are never persistent authority.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

The production build is static and uses relative asset paths for later GitHub Pages or embedded dossier deployment.
