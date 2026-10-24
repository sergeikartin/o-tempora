import type { IndexHtmlTransformContext, Plugin } from 'vite';
import { type EntryKind, htmlEntry } from './html-entry.ts';

type BundleOutput = NonNullable<IndexHtmlTransformContext['bundle']>[string];
type Asset = Extract<BundleOutput, { type: 'asset' }>;

// These are the specific family/subset/weight combinations that actually
// render above the fold on first paint, now that the default viewport
// prerenders (docs/adr/0013-prerender-default-viewport-for-lcp.md):
// - archivo-latin 400/700: digits (year-axis ticks) and English UI chrome.
// - archivo-latin-ext 400: accented People-lane names within the default
//   viewport (e.g. "Frédéric Chopin").
// - archivo-latin 600 / fraunces-latin 600: the lane captions and the Viewport
//   Range heading (plus the Top Bar wordmark on desktop), present on first
//   paint.
// Archivo/Fraunces ship no Cyrillic subset (Cyrillic text falls back to the
// `sans-serif` system font — global.css), so preloading vietnamese/Cyrillic
// subsets, or weights nothing above the fold uses, would fetch bytes first
// paint never needs.
const CRITICAL_TIMELINE_FONT_PATTERN =
  /^assets\/(?:archivo-latin-(?:400|600|700)|archivo-latin-ext-400|fraunces-latin-600)-normal-.*\.woff2$/;

// The landing page's headline (Fraunces 600) and body/nav text (Archivo 400)
// are all it renders above the fold.
const CRITICAL_LANDING_FONT_PATTERN =
  /^assets\/(?:archivo-latin-400|fraunces-latin-600)-normal-.*\.woff2$/;

const CRITICAL_FONT_PATTERN_BY_KIND: Record<EntryKind, RegExp> = {
  timeline: CRITICAL_TIMELINE_FONT_PATTERN,
  landing: CRITICAL_LANDING_FONT_PATTERN,
};

export function criticalFontPreloadPlugin(): Plugin {
  return {
    name: 'o-tempora:critical-font-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        const pattern = CRITICAL_FONT_PATTERN_BY_KIND[htmlEntry(ctx.path).kind];
        return Object.values(ctx.bundle)
          .filter((output): output is Asset => output.type === 'asset')
          .filter((asset) => pattern.test(asset.fileName))
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
