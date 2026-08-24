import type { IndexHtmlTransformContext } from 'vite';
import { expect, test } from 'vitest';
import { criticalCssPlugin } from './critical-css';

type Bundle = NonNullable<IndexHtmlTransformContext['bundle']>;

function asset(fileName: string, source: string) {
  return {
    type: 'asset' as const,
    fileName,
    originalFileName: null,
    originalFileNames: [],
    source,
    name: undefined,
    names: [],
  };
}

// Mirrors what CSS Modules actually emits for TimelineCanvas.module.css's
// .wrapper/.scrollContainer (`._<local>_<perFileHash>_<n>`) plus one
// unrelated, non-critical class the DOM-presence heuristic should still be
// free to drop — proving allowRules force-includes only what it targets
// rather than beasties inlining the whole stylesheet.
const CSS = `
._wrapper_1hltw_1{flex-direction:column;flex:auto;height:100vh;display:flex}
._scrollContainer_1hltw_54{overflow-x:scroll;cursor:grab}
._drawerToggle_1hltw_10{position:absolute;top:8px}
`;

const bundle = {
  'assets/main-test.css': asset('assets/main-test.css', CSS),
} as unknown as Bundle;

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <link rel="stylesheet" crossorigin href="/assets/main-test.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

async function processedHtml(
  html: string,
  transformBundle: Bundle | undefined,
) {
  const plugin = criticalCssPlugin();
  const hook = plugin.transformIndexHtml;
  if (!hook || typeof hook === 'function') {
    throw new Error('expected an object-form transformIndexHtml hook');
  }
  const handler = hook.handler as unknown as (
    html: string,
    ctx: IndexHtmlTransformContext,
  ) => Promise<string>;
  return handler(html, {
    path: '/index.html',
    filename: '/index.html',
    bundle: transformBundle,
  } as IndexHtmlTransformContext);
}

test('force-includes the TimelineCanvas layout selectors container.clientWidth depends on', async () => {
  const result = await processedHtml(HTML, bundle);
  expect(result).toMatch(/<style>[^<]*\._wrapper_1hltw_1\{[^}]*height:100vh/);
  expect(result).toMatch(
    /<style>[^<]*\._scrollContainer_1hltw_54\{[^}]*overflow-x:scroll/,
  );
});

test('does not force-include unrelated selectors the DOM-presence heuristic would drop', async () => {
  const result = await processedHtml(HTML, bundle);
  const inlined = result.match(/<style>([^<]*)<\/style>/)?.[1] ?? '';
  expect(inlined).not.toContain('_drawerToggle_1hltw_10');
});

test('defers the original stylesheet instead of leaving it render-blocking', async () => {
  const result = await processedHtml(HTML, bundle);
  expect(result).toContain('media="print"');
  expect(result).toContain(
    '<noscript><link rel="stylesheet" crossorigin href="/assets/main-test.css"></noscript>',
  );
});

test('is a no-op when no bundle is present (dev server)', async () => {
  const result = await processedHtml(HTML, undefined);
  expect(result).toBe(HTML);
});
