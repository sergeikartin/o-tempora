import Beasties from 'beasties';
import type { IndexHtmlTransformContext, Plugin } from 'vite';

type BundleOutput = NonNullable<IndexHtmlTransformContext['bundle']>[string];
type Asset = Extract<BundleOutput, { type: 'asset' }>;

function assetSource(asset: Asset): string {
  return typeof asset.source === 'string'
    ? asset.source
    : Buffer.from(asset.source).toString('utf-8');
}

// Beasties decides what's critical by matching selectors against elements in
// the HTML it's given. This plugin runs after the prerender, so #root holds the
// real default-viewport markup, but the rules TimelineCanvas's measurement
// depends on are force-included anyway: container.clientWidth is measured
// synchronously in a useLayoutEffect (TimelineCanvas.tsx) before first paint,
// before a deferred stylesheet could load, so `.wrapper`/`.scrollContainer`
// (TimelineCanvas.module.css) go in via `allowRules`, independent of which
// marks happen to be prerendered. CSS Modules mangles them to
// `._wrapper_<hash>_<n>` (hash per source file, not per build), hence the
// prefix match.
const CRITICAL_TIMELINE_LAYOUT_SELECTORS = [
  /^\._wrapper_/,
  /^\._scrollContainer_/,
];

export function criticalCssPlugin(): Plugin {
  return {
    name: 'o-tempora:critical-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const beasties = new Beasties({
          path: '/',
          publicPath: '/',
          preload: 'media',
          allowRules: CRITICAL_TIMELINE_LAYOUT_SELECTORS,
          // The @font-face rules otherwise live only in the deferred
          // stylesheet, so the preloaded fonts wouldn't be wired to any
          // family until after first paint.
          inlineFonts: true,
          logLevel: 'warn',
        });
        // Beasties normally reads stylesheets from disk, but dist/ isn't written yet
        // (transformIndexHtml runs against the in-memory bundle), so take the CSS from
        // ctx.bundle by the fileName Rollup emitted it under (always forward-slashed,
        // per Rollup's OutputAsset contract).
        beasties.readFile = (filename: string) => {
          const key = filename.replace(/\\/g, '/').replace(/^\/+/, '');
          const output = bundle[key];
          if (output?.type !== 'asset') {
            throw new Error(
              `o-tempora:critical-css: no bundled stylesheet for "${filename}"`,
            );
          }
          return assetSource(output);
        };
        return await beasties.process(html);
      },
    },
  };
}
