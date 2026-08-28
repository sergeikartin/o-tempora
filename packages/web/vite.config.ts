import { paraglideVitePlugin } from '@inlang/paraglide-js';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { criticalCssPlugin } from './vite-plugins/critical-css.ts';
import { criticalFontPreloadPlugin } from './vite-plugins/critical-font-preload.ts';
import { eagerDetailModulePreloadPlugin } from './vite-plugins/eager-detail-modulepreload.ts';
import { prerenderDefaultViewportPlugin } from './vite-plugins/prerender-default-viewport.ts';

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
    // trackEvent() (track-event.ts) already no-ops app-triggered events in
    // dev, but Umami's script auto-fires its own pageview/web-vitals beacons
    // on load regardless — strip the tag so dev traffic never reaches it.
    {
      name: 'strip-umami-script-dev',
      apply: 'serve',
      transformIndexHtml: (html) =>
        html.replace(/\s*<script[^>]*\bumami\b[^>]*><\/script>/, ''),
    },
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/shared/paraglide',
      strategy: ['url', 'baseLocale'],
      emitTsDeclarations: true,
    }),
    eagerDetailModulePreloadPlugin(),
    criticalFontPreloadPlugin(),
    // Between font preload and critical CSS: the latter's Beasties pass
    // (critical-css.ts) needs the real, class-bearing default-viewport
    // markup already rendered into #root to decide what's critical, not the
    // bare <div id="root"></div> shell.
    prerenderDefaultViewportPlugin(),
    criticalCssPlugin(),
  ],
  build: {
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        ru: 'ru/index.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
