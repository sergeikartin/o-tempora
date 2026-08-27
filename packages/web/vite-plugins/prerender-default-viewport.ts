import path from 'node:path';
import { createElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite';
import { createServer } from 'vite';

type Locale = 'en' | 'ru';

// TimelineCanvas.tsx's own mount effect pins .peopleLane's scroll to its
// bottom (fame-priority rows sit there, axis-adjacent) and centers
// .scrollContainer on DEFAULT_VIEWPORT_START_YEAR — but the prerendered HTML
// above always paints both at the browser's default scroll position (0), so
// without this, hydration's corrections are the *first* time either scroll
// happens, visibly jumping already-painted marks (a measured CLS ~0.29 under
// 2x CPU throttle — the dominant remaining contributor after
// .scratch/prerender-default-viewport/issues/06's pixelsPerYear fix;
// .scrollContainer's jump alone was ~21,000px on a 390px-wide viewport).
// Running the identical corrections here, synchronously, before the
// browser's first paint (a parser-blocking inline script, same FOUC-
// prevention timing trick as an early dark-mode class toggle) means
// hydration's own effects land on the same values and are a no-op paint-
// wise. Safe pre-hydration: both values are pure functions of the same
// default-filter dataset and REFERENCE_PIXELS_PER_YEAR the prerender above
// already renders with, and critical-css.ts inlines .peopleLane's/
// .bottomAlign's/.scrollContainer's layout rules (matched by Beasties'
// DOM-presence heuristic against this prerendered markup), so
// scrollHeight/clientWidth are already correct when this script runs.
// scrollContainerTargetLeft is computed here (not re-derived from a
// hardcoded formula) via the same buildXScale the client calls, so the two
// can never drift apart; .scrollContainer's own clamp against its real
// scrollWidth/clientWidth still runs client-side in the script below, since
// only the real browser knows a given visitor's clientWidth.
function pinScrollScript(scrollContainerTargetLeft: number): string {
  return `<script>(function(){
var pl=document.querySelector('[class*="peopleLane"]');
if(pl)pl.scrollTop=pl.scrollHeight;
var sc=document.querySelector('[class*="scrollContainer"]');
if(sc)sc.scrollLeft=Math.max(0,Math.min(${scrollContainerTargetLeft},sc.scrollWidth-sc.clientWidth));
})()</script>`;
}

// Spins up a throwaway Vite SSR module graph for exactly one locale's
// render — reusing the real build's resolved css/resolve config (ADR 0013)
// so CSS-Module class hashes match the real build's output — and renders
// <App initialDatasets={...} />. PeopleLane's/ConflictsMilestonesLane's own
// lazy-initialized dangerouslySetInnerHTML (mark-shape-html.ts) already puts
// real default-state marks in the output; there's no separate markup
// computation or graft step here. Called once per HTML entry
// (transformIndexHtml runs once per Rollup input), so English and Russian
// each get their own fully isolated module instances — no shared Paraglide
// locale state to leak between them.
async function renderDefaultViewportHtml(
  locale: Locale,
  resolvedConfig: ResolvedConfig,
): Promise<{ appHtml: string; scrollContainerTargetLeft: number }> {
  const server = await createServer({
    configFile: false,
    root: resolvedConfig.root,
    resolve: resolvedConfig.resolve,
    css: resolvedConfig.css,
    plugins: [(await import('@vitejs/plugin-react')).default()],
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
    logLevel: 'error',
  });
  try {
    const runtime = await server.ssrLoadModule(
      path.resolve(resolvedConfig.root, 'src/shared/paraglide/runtime.js'),
    );
    // Must land before locale-datasets.ts (below) evaluates — its
    // module-scope localeDatasetsPromise reads getLocale() once, at import
    // time.
    runtime.overwriteGetLocale(() => locale);

    const [
      { App },
      { localeDatasetsPromise },
      { buildXScale, REFERENCE_PIXELS_PER_YEAR },
      { DEFAULT_VIEWPORT_START_YEAR },
    ] = await Promise.all([
      server.ssrLoadModule(
        path.resolve(resolvedConfig.root, 'src/app/App.tsx'),
      ),
      server.ssrLoadModule(
        path.resolve(resolvedConfig.root, 'src/app/locale-datasets.ts'),
      ),
      server.ssrLoadModule(
        path.resolve(
          resolvedConfig.root,
          'src/widgets/timeline-canvas/options.ts',
        ),
      ),
      server.ssrLoadModule(
        path.resolve(resolvedConfig.root, 'src/shared/config/viewport.ts'),
      ),
    ]);
    const datasets = await localeDatasetsPromise;
    const { scale } = buildXScale(REFERENCE_PIXELS_PER_YEAR);
    const scrollContainerTargetLeft = scale(DEFAULT_VIEWPORT_START_YEAR);

    // renderToReadableStream, not renderToStaticMarkup/renderToString:
    // App.tsx's tree still has real <Suspense> boundaries even though
    // initialDatasets makes the top one a no-op here — the two lazy-loaded
    // panels (AboutPanel/DetailPanel) each trigger a real dynamic import(),
    // which only a streaming SSR API actually waits for (renderToString
    // renders their `fallback` immediately and logs a "does not support
    // Suspense" warning; renderToStaticMarkup skips hydration markers
    // entirely). Awaiting `allReady` blocks until every boundary — including
    // those two — has its real content, matching what hydrateRoot expects.
    const stream = await renderToReadableStream(
      createElement(App, { initialDatasets: datasets }),
    );
    await stream.allReady;
    const appHtml = await new Response(stream).text();
    return { appHtml, scrollContainerTargetLeft };
  } finally {
    await server.close();
  }
}

export function prerenderDefaultViewportPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;
  return {
    name: 'same-sky:prerender-default-viewport',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config;
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx: IndexHtmlTransformContext) {
        if (!ctx.bundle) return html;
        const locale: Locale = ctx.path.startsWith('/ru/') ? 'ru' : 'en';
        const { appHtml, scrollContainerTargetLeft } =
          await renderDefaultViewportHtml(locale, resolvedConfig);
        return html.replace(
          '<div id="root"></div>',
          `<div id="root">${appHtml}</div>${pinScrollScript(scrollContainerTargetLeft)}`,
        );
      },
    },
  };
}
