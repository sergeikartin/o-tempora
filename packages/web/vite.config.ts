import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  // No SPA fallback: unknown paths must 404 like GitHub Pages does, not
  // resolve to index.html.
  appType: 'mpa',
  plugins: [
    react(),
    // GitHub Pages serves dist/404.html for unknown paths; Vite's preview
    // server only returns an empty 404, so mirror Pages here.
    {
      name: 'o-tempora:preview-404-page',
      configurePreviewServer(server) {
        const outDir = resolve(server.config.build.outDir);
        const page404 = resolve(outDir, '404.html');
        return () => {
          // Runs after the html-fallback rewrite (`/ru/` → `/ru/index.html`)
          // but before index.html serving, so only unresolved paths 404.
          server.middlewares.use((req, res, next) => {
            const { pathname } = new URL(req.url ?? '/', 'http://localhost');
            if (
              existsSync(resolve(outDir, `.${decodeURIComponent(pathname)}`))
            ) {
              return next();
            }
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(readFileSync(page404));
          });
        };
      },
    },
    // trackEvent() (track-event.ts) already no-ops app-triggered events in
    // dev, but Umami's script auto-fires its own pageview/web-vitals beacons
    // on load regardless — strip the tag so dev traffic never reaches it.
    {
      name: 'strip-umami-script-dev',
      apply: 'serve',
      transformIndexHtml: (html) =>
        html.replace(/\s*<script[^>]*\bumami\b[^>]*><\/script>/, ''),
    },
    // The above-fold text is prerendered and its fonts are preloaded
    // (critical-font-preload.ts), so briefly holding text invisible beats
    // painting the system fallback and swapping it a moment later.
    {
      name: 'o-tempora:font-display-block',
      enforce: 'pre',
      transform(code, id) {
        if (!/@fontsource\/[^?]+\.css/.test(id)) return null;
        return code.replaceAll('font-display: swap', 'font-display: block');
      },
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
