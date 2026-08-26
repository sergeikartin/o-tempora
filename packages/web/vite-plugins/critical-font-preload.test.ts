import type { IndexHtmlTransformContext } from 'vite';
import { expect, test } from 'vitest';
import { criticalFontPreloadPlugin } from './critical-font-preload';

type Bundle = NonNullable<IndexHtmlTransformContext['bundle']>;

function asset(fileName: string) {
  return {
    type: 'asset' as const,
    fileName,
    originalFileName: null,
    originalFileNames: [],
    source: '',
    name: undefined,
    names: [],
  };
}

function chunk(fileName: string) {
  return {
    type: 'chunk' as const,
    fileName,
    facadeModuleId: null,
    name: fileName,
    isEntry: true,
    isDynamicEntry: false,
    moduleIds: [],
    exports: [],
    modules: {},
    imports: [],
    dynamicImports: [],
    code: '',
    map: null,
    sourcemapFileName: null,
    preliminaryFileName: fileName,
  };
}

const bundle = {
  'assets/archivo-latin-400-normal-abc.woff2': asset(
    'assets/archivo-latin-400-normal-abc.woff2',
  ),
  'assets/archivo-latin-700-normal-def.woff2': asset(
    'assets/archivo-latin-700-normal-def.woff2',
  ),
  'assets/archivo-latin-500-normal-yzz.woff2': asset(
    'assets/archivo-latin-500-normal-yzz.woff2',
  ),
  'assets/archivo-latin-600-normal-ghi.woff2': asset(
    'assets/archivo-latin-600-normal-ghi.woff2',
  ),
  'assets/archivo-latin-ext-400-normal-jkl.woff2': asset(
    'assets/archivo-latin-ext-400-normal-jkl.woff2',
  ),
  'assets/archivo-latin-ext-600-normal-jkm.woff2': asset(
    'assets/archivo-latin-ext-600-normal-jkm.woff2',
  ),
  'assets/archivo-vietnamese-400-normal-mno.woff2': asset(
    'assets/archivo-vietnamese-400-normal-mno.woff2',
  ),
  'assets/archivo-latin-400-normal-pqr.woff': asset(
    'assets/archivo-latin-400-normal-pqr.woff',
  ),
  'assets/fraunces-latin-600-normal-stu.woff2': asset(
    'assets/fraunces-latin-600-normal-stu.woff2',
  ),
  'assets/fraunces-latin-ext-600-normal-stv.woff2': asset(
    'assets/fraunces-latin-ext-600-normal-stv.woff2',
  ),
  'assets/main-vwx.js': chunk('assets/main-vwx.js'),
  // The real rolldown output types are opaque native handles that plain
  // fixtures can't satisfy structurally; this plugin only ever reads the
  // plain fields above, so the cast is safe for a test double.
} as unknown as Bundle;

type PreloadTag = {
  attrs: {
    href: string;
    rel: string;
    as: string;
    type: string;
    crossorigin: string;
  };
};

function preloadedFontTags(transformBundle: Bundle | undefined) {
  const plugin = criticalFontPreloadPlugin();
  const hook = plugin.transformIndexHtml;
  if (!hook || typeof hook === 'function') {
    throw new Error('expected an object-form transformIndexHtml hook');
  }
  const handler = hook.handler as unknown as (
    html: string,
    ctx: IndexHtmlTransformContext,
  ) => PreloadTag[];
  return handler('', {
    path: '/index.html',
    filename: '/index.html',
    bundle: transformBundle,
  } as IndexHtmlTransformContext);
}

test('preloads the latin 400/600/700, latin-ext 400, and fraunces-latin 600 woff2 files', () => {
  const hrefs = preloadedFontTags(bundle)
    .map((tag) => tag.attrs.href)
    .sort();
  expect(hrefs).toEqual([
    '/assets/archivo-latin-400-normal-abc.woff2',
    '/assets/archivo-latin-600-normal-ghi.woff2',
    '/assets/archivo-latin-700-normal-def.woff2',
    '/assets/archivo-latin-ext-400-normal-jkl.woff2',
    '/assets/fraunces-latin-600-normal-stu.woff2',
  ]);
});

test('sets font preload attributes required to avoid a double fetch', () => {
  const [tag] = preloadedFontTags(bundle).filter((t) =>
    t.attrs.href.includes('400'),
  );
  expect(tag?.attrs).toMatchObject({
    rel: 'preload',
    as: 'font',
    type: 'font/woff2',
    crossorigin: '',
  });
});

test('returns nothing when no bundle is present (dev server)', () => {
  expect(preloadedFontTags(undefined)).toEqual([]);
});
