import type { IndexHtmlTransformContext, Plugin } from 'vite';
import { htmlEntry } from './html-entry.ts';

type BundleOutput = NonNullable<IndexHtmlTransformContext['bundle']>[string];
type Chunk = Extract<BundleOutput, { type: 'chunk' }>;

const EAGER_DETAIL_DATASET_PATTERN =
  /\/(?:people|conflicts|milestones)\.detail[12](\.ru)?\.json$/;

export function eagerDetailChunkLocale(chunk: Chunk): 'en' | 'ru' | null {
  // facadeModuleId isn't pre-normalized (Vite itself always runs it through
  // normalizePath() before comparing), so a Windows build would carry
  // backslashes here and silently fail to match a forward-slash pattern.
  const normalized = chunk.facadeModuleId?.replace(/\\/g, '/');
  const match = normalized?.match(EAGER_DETAIL_DATASET_PATTERN);
  if (!match) return null;
  return match[1] ? 'ru' : 'en';
}

// Detail Level 1+2 datasets (locale-datasets.ts) are dynamic-imported JSON
// emitted as their own content-hashed chunks, reached only through a runtime
// locale branch — not a statically-reachable literal import at the entry —
// so Vite's default modulepreload analysis can't see them. Each locale's
// timeline HTML gets only that locale's level 1+2 chunks preloaded (the
// landing pages load no datasets); the other
// locale's chunks would spend critical-path bandwidth on a page that never
// renders them.
export function eagerDetailModulePreloadPlugin(): Plugin {
  return {
    name: 'o-tempora:eager-detail-modulepreload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        const { locale, kind } = htmlEntry(ctx.path);
        if (kind !== 'timeline') return [];
        return Object.values(ctx.bundle)
          .filter((output): output is Chunk => output.type === 'chunk')
          .filter((chunk) => eagerDetailChunkLocale(chunk) === locale)
          .map((chunk) => ({
            tag: 'link',
            injectTo: 'head-prepend' as const,
            attrs: {
              rel: 'modulepreload',
              href: `/${chunk.fileName}`,
              crossorigin: '',
            },
          }));
      },
    },
  };
}
