import { defineConfig } from 'vite';

/**
 * Library build of the embeddable viewer seam.
 *
 *   npm run build:viewer   →  dist-viewer/starsilk-viewer.js  (+ .css, .d.ts-free)
 *
 * A Starsilk Character Dossier page can then do either of:
 *
 *   <script type="module" src="./cartographer/dist-viewer/starsilk-viewer.js"></script>
 *   <starsilk-starmap mode="viewer" src="./cartographer/data/starsilk-map.json"></starsilk-starmap>
 *
 * or
 *
 *   import { mountStarsilkStarmap } from './cartographer/dist-viewer/starsilk-viewer.js';
 *
 * CSS is emitted as a separate file on purpose: the viewer injects the same rules
 * into its own shadow root at runtime, so a host page never has to link them and
 * the Cartographer's styles never become global.
 */
export default defineConfig({
  build: {
    outDir: 'dist-viewer',
    emptyOutDir: true,
    target: 'es2020',
    lib: {
      entry: 'src/viewer/index.ts',
      formats: ['es'],
      fileName: () => 'starsilk-viewer.js',
    },
    rollupOptions: {
      // Three.js stays a real dependency of the bundle (no CDN, no globals), but
      // splitting it keeps the viewer chunk small and cacheable.
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
