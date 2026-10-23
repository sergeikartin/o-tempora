import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { criticalCssPlugin } from './vite-plugins/critical-css.ts';
import { criticalFontPreloadPlugin } from './vite-plugins/critical-font-preload.ts';
import { eagerDetailModulePreloadPlugin } from './vite-plugins/eager-detail-modulepreload.ts';
import { landingTimelinePrefetchPlugin } from './vite-plugins/landing-timeline-prefetch.ts';
import { prerenderDefaultViewportPlugin } from './vite-plugins/prerender-default-viewport.ts';

// Locale is resolved at runtime from the URL, not forked at build time
// (web/docs/adr/0009): English is unprefixed at the domain root, Russian lives
// at `/ru/*`. Paraglide's default url pattern resolves that and falls back to
// the base locale for an unrecognized first path segment. Four HTML entries are
// Rollup inputs, so one `vite build` emits the landing pages (`/`, `/ru/`,
// loading `src/landing.tsx`) and timeline pages (`/timeline/`, `/ru/timeline/`,
// loading `src/main.tsx`), sharing JS/CSS chunks (docs/deployment.md,
// docs/adr/0007). `locale-datasets.ts` does the per-locale dynamic data
// imports that keep each timeline page load single-language.
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
    // trackEvent() (track-event.ts) no-ops app events in dev, but Umami's script
    // auto-fires its own pageview/web-vitals beacons on load, so strip the tag.
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
    landingTimelinePrefetchPlugin(),
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
        landing: 'index.html',
        landingRu: 'ru/index.html',
        timeline: 'timeline/index.html',
        timelineRu: 'ru/timeline/index.html',
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
