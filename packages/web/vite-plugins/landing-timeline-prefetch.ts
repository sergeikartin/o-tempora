import type { IndexHtmlTransformContext, Plugin } from 'vite';
import { eagerDetailChunkLocale } from './eager-detail-modulepreload.ts';
import { htmlEntry } from './html-entry.ts';

type Bundle = NonNullable<IndexHtmlTransformContext['bundle']>;
type BundleOutput = Bundle[string];
type Chunk = Extract<BundleOutput, { type: 'chunk' }>;

// An HTML entry's chunk has the HTML file itself as its facade module; Vite
// drops that stub from the output, so only what it imports is prefetchable.
const TIMELINE_ENTRY_HTML: Record<'en' | 'ru', RegExp> = {
  en: /(?<![\\/]ru)[\\/]timeline[\\/]index\.html$/,
  ru: /[\\/]ru[\\/]timeline[\\/]index\.html$/,
};

function staticImportClosure(bundle: Bundle, entry: Chunk): Chunk[] {
  const seen = new Set<string>();
  const chunks: Chunk[] = [];
  const visit = (chunk: Chunk) => {
    if (seen.has(chunk.fileName)) return;
    seen.add(chunk.fileName);
    chunks.push(chunk);
    for (const imported of chunk.imports) {
      const next = bundle[imported];
      if (next?.type === 'chunk') visit(next);
    }
  };
  visit(entry);
  return chunks;
}

// The landing pages ship no timeline code or data (docs/adr/0007), so the
// timeline's entry chunk, its static imports, its stylesheets and this
// locale's eagerly-loaded datasets are listed here as JSON instead; the
// landing's own script (app/landing/prefetch-timeline.ts) turns them into
// `<link rel="prefetch">` tags only once the visitor hovers, focuses or
// touches the call-to-action. Anything the landing itself already loads is
// left out.
export function landingTimelinePrefetchPlugin(): Plugin {
  return {
    name: 'o-tempora:landing-timeline-prefetch',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return [];
        const { locale, kind } = htmlEntry(ctx.path);
        if (kind !== 'landing') return [];
        const bundle = ctx.bundle;
        const chunks = Object.values(bundle).filter(
          (output): output is Chunk => output.type === 'chunk',
        );
        const timelineEntry = chunks.find(
          (chunk) =>
            chunk.isEntry &&
            chunk.facadeModuleId !== null &&
            TIMELINE_ENTRY_HTML[locale].test(chunk.facadeModuleId),
        );
        if (!timelineEntry) return [];

        const alreadyLoaded = new Set<string>();
        if (ctx.chunk) {
          for (const chunk of staticImportClosure(bundle, ctx.chunk)) {
            alreadyLoaded.add(chunk.fileName);
            for (const css of chunk.viteMetadata?.importedCss ?? []) {
              alreadyLoaded.add(css);
            }
          }
        }

        const scripts = [
          ...staticImportClosure(bundle, timelineEntry).filter(
            (chunk) => chunk !== timelineEntry,
          ),
          ...chunks.filter((chunk) => eagerDetailChunkLocale(chunk) === locale),
        ];
        const styles = scripts.flatMap((chunk) => [
          ...(chunk.viteMetadata?.importedCss ?? []),
        ]);
        const assets: { href: string; as: string; fileName: string }[] = [
          ...scripts.map((chunk) => ({
            href: `/${chunk.fileName}`,
            as: 'script',
            fileName: chunk.fileName,
          })),
          ...styles.map((fileName) => ({
            href: `/${fileName}`,
            as: 'style',
            fileName,
          })),
        ];
        const entries: { href: string; as?: string }[] = [
          { href: locale === 'ru' ? '/ru/timeline/' : '/timeline/' },
          ...assets
            .filter(({ fileName }) => !alreadyLoaded.has(fileName))
            .map(({ href, as }) => ({ href, as })),
        ];

        return [
          {
            tag: 'script',
            injectTo: 'head' as const,
            attrs: { type: 'application/json', id: 'timeline-prefetch' },
            children: JSON.stringify(entries),
          },
        ];
      },
    },
  };
}
