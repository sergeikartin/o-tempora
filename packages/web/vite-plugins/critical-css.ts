import Beasties from 'beasties';
import type { IndexHtmlTransformContext, Plugin } from 'vite';

type BundleOutput = NonNullable<IndexHtmlTransformContext['bundle']>[string];
type Asset = Extract<BundleOutput, { type: 'asset' }>;

function assetSource(asset: Asset): string {
  return typeof asset.source === 'string'
    ? asset.source
    : Buffer.from(asset.source).toString('utf-8');
}

// Beasties decides what's "critical" by checking which selectors match
// elements in the HTML it's given — but this app's build-time HTML is a
// bare CSR shell (`<div id="root"></div>`, nothing rendered into it yet), so
// every class selector fails that check and would otherwise get dropped
// wholesale, keeping only bare-tag/`:root` rules. container.clientWidth is
// measured synchronously in a useLayoutEffect (TimelineCanvas.tsx) — before
// the browser's first paint, so it runs before a deferred (non-critical)
// stylesheet could ever have loaded over the network. The layout rules that
// measurement depends on (`.wrapper` / `.scrollContainer`,
// TimelineCanvas.module.css) must therefore be force-included via
// `allowRules` rather than left to the DOM-presence heuristic. CSS Modules
// mangles these to `._wrapper_<hash>_<n>` / `._scrollContainer_<hash>_<n>`
// (hash is per-source-file, not per-build), hence the prefix match instead
// of the literal class name.
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
          logLevel: 'warn',
        });
        // Beasties normally resolves stylesheet hrefs against real files on
        // disk (fs.readFile). The build hasn't written dist/ yet at this
        // point in Vite's pipeline — transformIndexHtml runs against the
        // in-memory bundle — so pull the CSS straight from ctx.bundle
        // instead, keyed by the same fileName Rollup already emitted it
        // under (always forward-slashed, per Rollup's OutputAsset contract,
        // regardless of host OS).
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
