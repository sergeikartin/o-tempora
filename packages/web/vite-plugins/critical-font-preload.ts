import type { IndexHtmlTransformContext, Plugin } from 'vite';
import { type EntryKind, htmlEntry } from './html-entry.ts';

type BundleOutput = NonNullable<IndexHtmlTransformContext['bundle']>[string];
type Asset = Extract<BundleOutput, { type: 'asset' }>;

// Preload only the font variants used in the prerendered first viewport.
const CRITICAL_TIMELINE_FONT_PATTERN =
  /^assets\/(?:archivo-latin-(?:400|600|700)|archivo-latin-ext-400|fraunces-latin-600)-normal-.*\.woff2$/;

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
