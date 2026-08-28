import type { IndexHtmlTransformContext, Plugin } from 'vite';

type BundleOutput = NonNullable<IndexHtmlTransformContext['bundle']>[string];
type Asset = Extract<BundleOutput, { type: 'asset' }>;

// These are the specific family/subset/weight combinations that actually
// render above the fold on first paint, now that the default viewport
// prerenders (docs/adr/0013-prerender-default-viewport-for-lcp.md):
// - archivo-latin 400/700: digits (year-axis ticks) and English UI chrome.
// - archivo-latin-ext 400: accented People-lane names within the default
//   viewport (e.g. "Frédéric Chopin").
// - archivo-latin 600 / fraunces-latin 600: Sidebar's `.heading`/
//   `.headerTitle`, present on first paint on both layouts.
// Archivo/Fraunces ship no Cyrillic subset (Cyrillic text falls back to the
// `sans-serif` system font — global.css), so preloading vietnamese/Cyrillic
// subsets, or weights nothing above the fold uses, would fetch bytes first
// paint never needs.
const CRITICAL_FONT_PATTERN =
  /^assets\/(?:archivo-latin-(?:400|600|700)|archivo-latin-ext-400|fraunces-latin-600)-normal-.*\.woff2$/;

export function criticalFontPreloadPlugin(): Plugin {
  return {
    name: 'o-tempora:critical-font-preload',
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
