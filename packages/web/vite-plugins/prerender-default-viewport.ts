import path from 'node:path';
import { createElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import type { IndexHtmlTransformContext, Plugin, ResolvedConfig } from 'vite';
import { createServer } from 'vite';

type Locale = 'en' | 'ru';

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
): Promise<string> {
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

    const [{ App }, { localeDatasetsPromise }] = await Promise.all([
      server.ssrLoadModule(
        path.resolve(resolvedConfig.root, 'src/app/App.tsx'),
      ),
      server.ssrLoadModule(
        path.resolve(resolvedConfig.root, 'src/app/locale-datasets.ts'),
      ),
    ]);
    const datasets = await localeDatasetsPromise;

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
    return await new Response(stream).text();
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
        const appHtml = await renderDefaultViewportHtml(locale, resolvedConfig);
        return html.replace(
          '<div id="root"></div>',
          `<div id="root">${appHtml}</div>`,
        );
      },
    },
  };
}
