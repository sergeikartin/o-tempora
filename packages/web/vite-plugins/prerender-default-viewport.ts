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

// Match the client’s initial scroll positions before first paint to prevent
// a visible jump on hydration. Critical CSS makes the scroll geometry available.
//
// Mirror the main scroll offset into the sticky lanes so their first paint uses
// the same window. Derive the heading from the browser’s real width because
// the prerender only has a fallback width. The default span stays in CE.
function pinScrollScript(
  scrollContainerTargetLeft: number,
  defaultStartYear: number,
  pixelsPerYear: number,
): string {
  return `<script>(function(){
var pl=document.querySelector('[class*="peopleLane"]');
var cm=document.querySelector('[class*="conflictsMilestonesLane"]');
var sc=document.querySelector('[class*="scrollContainer"]');
var vr=document.querySelector('[class*="focusRange"]');
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
  // Streaming SSR supports the timeline’s Suspense boundaries and produces hydratable markup.
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

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
