import { defineConfig } from 'vitest/config';

// The Cartographer builds to fully static assets (GitHub Pages friendly):
// relative `base` so it can be served from any subpath, no CDN deps at runtime.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Keep the embeddable viewer chunk separable from the full editor so a
        // future dossier page can import only the viewer without the authoring UI.
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('/src/viewer/')) return 'viewer';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
  },
});
