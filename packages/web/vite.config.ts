import { paraglideVitePlugin } from '@inlang/paraglide-js';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Locale is resolved at runtime from the URL, not forked at build time
// (docs/adr/0009 supersedes 0005's baseLocale-only strategy): English is
// unprefixed at the domain root, Russian lives at `/ru/*`
// (docs/deployment.md, docs/adr/0003) — Paraglide's default url-pattern
// (no custom `urlPatterns` needed) already resolves exactly that scheme,
// falling back to the base locale for any unrecognized first path segment.
// `ru/index.html` is a second Rollup input so one `vite build` emits both
// `dist/index.html` and `dist/ru/index.html`, sharing the same JS/CSS
// chunks — see `App.tsx`'s `locale-datasets.ts` for the per-locale dynamic
// data imports that keep each page load's payload single-language.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/shared/paraglide',
      strategy: ['url', 'baseLocale'],
      emitTsDeclarations: true,
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        ru: 'ru/index.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setup-tests.ts'],
  },
});
