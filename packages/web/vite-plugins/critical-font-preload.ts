import type { IndexHtmlTransformContext, Plugin } from 'vite';

type BundleOutput = NonNullable<IndexHtmlTransformContext['bundle']>[string];
type Asset = Extract<BundleOutput, { type: 'asset' }>;

// Only the "latin" @fontsource/archivo subset covers what actually renders
// above the fold on first paint: digits (year-axis ticks use Archivo on
// both locale pages) and the English UI chrome text. Archivo ships no
// Cyrillic subset (Cyrillic text falls back to the `sans-serif` system
// font — global.css), so preloading latin-ext/vietnamese subsets here
// would fetch bytes first paint never uses.
const CRITICAL_FONT_PATTERN =
  /^assets\/archivo-latin-(?:400|700)-normal-.*\.woff2$/;

export function criticalFontPreloadPlugin(): Plugin {
  return {
    name: 'same-sky:critical-font-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        return Object.values(ctx.bundle)
          .filter((output): output is Asset => output.type === 'asset')
          .filter((asset) => CRITICAL_FONT_PATTERN.test(asset.fileName))
          .map((asset) => ({
            tag: 'link',
            injectTo: 'head-prepend' as const,
            attrs: {
              rel: 'preload',
              href: `/${asset.fileName}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
          }));
      },
    },
  };
}
