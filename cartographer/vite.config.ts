import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

// The Cartographer builds to fully static assets (GitHub Pages friendly):
// relative `base` so it can be served from any subpath, no CDN deps at runtime.

/**
 * `data/` holds authored datasets (the generated demonstration plate). Vite only
 * copies `public/`, so ship the JSON alongside the build explicitly — an embedded
 * viewer fetches it with a relative URL.
 */
function copyDataPlugin(): Plugin {
  return {
    name: 'starsilk-copy-data',
    apply: 'build',
    async closeBundle() {
      const from = resolve('data');
      const to = resolve('dist/data');
      await mkdir(to, { recursive: true });
      for (const file of await readdir(from)) {
        if (file.endsWith('.json')) await copyFile(resolve(from, file), resolve(to, file));
      }
    },
  };
}
export default defineConfig({
  base: './',
  plugins: [copyDataPlugin()],
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 4096,
    rollupOptions: {
      // index.html is the authoring tool; viewer.html is the embed test page.
      input: {
        main: resolve('index.html'),
        viewer: resolve('viewer.html'),
      },
      output: {
        // `three` is split out for caching and the viewer entry stays tiny. A
        // genuinely separable embed bundle is `npm run build:viewer` (library
        // mode), which a dossier page imports on its own.
        advancedChunks: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
            { name: 'viewer', test: /src[\\/]viewer[\\/]/ },
            { name: 'app', test: /src[\\/](app|core|render|styles)[\\/]/ },
          ],
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
