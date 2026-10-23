import path from 'node:path';
import { createElement, type ReactElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import type {
  IndexHtmlTransformContext,
  Plugin,
  ResolvedConfig,
  ViteDevServer,
} from 'vite';
import { createServer } from 'vite';
import { type EntryLocale, htmlEntry } from './html-entry.ts';

// TimelineCanvas.tsx's mount effect pins .peopleLane's scroll to its bottom
// (fame-priority rows sit there, axis-adjacent) and centers .scrollContainer on
// DEFAULT_VIEWPORT_START_YEAR, but the prerendered HTML paints both at scroll
// 0, so hydration's corrections would be the first time either scrolls,
// visibly jumping painted marks (measured CLS ~0.29 under 2x CPU throttle;
// .scrollContainer alone jumped ~21,000px on a 390px viewport). This
// parser-blocking inline script runs the same corrections before first paint
// (like an early dark-mode class toggle), so hydration's effects are no-ops
// paint-wise. Safe pre-hydration: both values are pure functions of the same
// default-filter dataset and REFERENCE_PIXELS_PER_YEAR the prerender uses, and
// critical-css.ts inlines the layout rules (.peopleLane, .bottomAlign,
// .scrollContainer), so scrollHeight/clientWidth are correct when it runs.
// scrollContainerTargetLeft comes from the same buildXScale the client calls,
// so the two can't drift; the clamp against the real scrollWidth/clientWidth
// stays client-side in the script, since only the browser knows clientWidth.
//
// .peopleLane/.conflictsMilestonesLane are themselves position: sticky with
// their own overflow-x: hidden scrollLeft (TimelineCanvas.module.css); on the
// client, mirrorLaneScrollLeft keeps that in lockstep with .scrollContainer.
// Unset here, both lanes' content sits at scrollLeft 0, the start of the
// timeline, until hydration's mount effect mirrors it, so the earliest items
// (e.g. Homer in People) flash through the pre-hydration paint.
//
// The Viewport Range heading is prerendered against FALLBACK_VIEWPORT_WIDTH_PX,
// so its end year would only correct after hydration measures the real
// clientWidth. The same script rewrites it from the real clientWidth
// (mirroring TimelineCanvas's scale.invert(scrollLeft) and
// scale.invert(scrollLeft + clientWidth)); the element opts out of hydration
// text-mismatch checks (ViewportRange.tsx) so React keeps this value until its
// mount effect lands the same one. Only CE years are formatted: the default
// window never reaches BCE.
function pinScrollScript(
  scrollContainerTargetLeft: number,
  defaultStartYear: number,
  pixelsPerYear: number,
): string {
  return `<script>(function(){
var pl=document.querySelector('[class*="peopleLane"]');
var cm=document.querySelector('[class*="conflictsMilestonesLane"]');
var sc=document.querySelector('[class*="scrollContainer"]');
var vr=document.querySelector('[class*="viewportRange"]');
var plScrollHeight=pl&&pl.scrollHeight;
var scMax=sc&&sc.scrollWidth-sc.clientWidth;
var target=Math.max(0,Math.min(${scrollContainerTargetLeft},scMax));
if(pl)pl.scrollTop=plScrollHeight;
if(pl)pl.scrollLeft=target;
if(cm)cm.scrollLeft=target;
if(sc)sc.scrollLeft=target;
if(vr&&sc){
var startYear=${defaultStartYear}+(target-${scrollContainerTargetLeft})/${pixelsPerYear};
var endYear=startYear+sc.clientWidth/${pixelsPerYear};
vr.textContent=Math.round(startYear)+' \\u2013 '+Math.round(endYear);
}
})()</script>`;
}

// A throwaway Vite SSR module graph for one entry's render, reusing the real
// build's resolved css/resolve config (web/docs/adr/0013) so CSS-Module class
// hashes match the build output. Called once per HTML entry, so each entry
// gets isolated module instances and no Paraglide locale state leaks between
// them.
async function withSsrServer<T>(
  locale: EntryLocale,
  resolvedConfig: ResolvedConfig,
  render: (server: ViteDevServer) => Promise<T>,
): Promise<T> {
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
    // Must land before any module that reads getLocale() at import time
    // (locale-datasets.ts's localeDatasetsPromise, config/routes.ts) evaluates.
    runtime.overwriteGetLocale(() => locale);
    return await render(server);
  } finally {
    await server.close();
  }
}

async function renderToHtml(element: ReactElement): Promise<string> {
  // renderToReadableStream, not renderToStaticMarkup/renderToString: the
  // timeline's tree still has real <Suspense> boundaries even though
  // initialDatasets makes the top one a no-op here — the two lazy-loaded
  // panels (AboutPanel/DetailPanel) each trigger a real dynamic import(),
  // which only a streaming SSR API actually waits for (renderToString
  // renders their `fallback` immediately and logs a "does not support
  // Suspense" warning; renderToStaticMarkup skips hydration markers
  // entirely). Awaiting `allReady` blocks until every boundary — including
  // those two — has its real content, matching what hydrateRoot expects.
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

// Renders <App initialDatasets={...} />. PeopleLane's/
// ConflictsMilestonesLane's own lazy-initialized dangerouslySetInnerHTML
// (mark-shape-html.ts) already puts real default-state marks in the output;
// there's no separate markup computation or graft step here.
async function renderDefaultViewportHtml(
  locale: EntryLocale,
  resolvedConfig: ResolvedConfig,
): Promise<{
  appHtml: string;
  scrollContainerTargetLeft: number;
  defaultStartYear: number;
  pixelsPerYear: number;
}> {
  return withSsrServer(locale, resolvedConfig, async (server) => {
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
    return {
      appHtml: await renderToHtml(
        createElement(App, { initialDatasets: datasets }),
      ),
      scrollContainerTargetLeft: scale(DEFAULT_VIEWPORT_START_YEAR),
      defaultStartYear: DEFAULT_VIEWPORT_START_YEAR,
      pixelsPerYear: REFERENCE_PIXELS_PER_YEAR,
    };
  });
}

// The landing page loads no datasets, so its prerender is the whole page.
async function renderLandingHtml(
  locale: EntryLocale,
  resolvedConfig: ResolvedConfig,
): Promise<string> {
  return withSsrServer(locale, resolvedConfig, async (server) => {
    const { LandingPage } = await server.ssrLoadModule(
      path.resolve(resolvedConfig.root, 'src/app/landing/index.ts'),
    );
    return renderToHtml(createElement(LandingPage));
  });
}

export function prerenderDefaultViewportPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig;
  return {
    name: 'o-tempora:prerender-default-viewport',
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config;
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx: IndexHtmlTransformContext) {
        if (!ctx.bundle) return html;
        const { locale, kind } = htmlEntry(ctx.path);
        if (kind === 'landing') {
          const landingHtml = await renderLandingHtml(locale, resolvedConfig);
          return html.replace(
            '<div id="root"></div>',
            `<div id="root">${landingHtml}</div>`,
          );
        }
        const {
          appHtml,
          scrollContainerTargetLeft,
          defaultStartYear,
          pixelsPerYear,
        } = await renderDefaultViewportHtml(locale, resolvedConfig);
        return html.replace(
          '<div id="root"></div>',
          `<div id="root">${appHtml}</div>${pinScrollScript(scrollContainerTargetLeft, defaultStartYear, pixelsPerYear)}`,
        );
      },
    },
  };
}
