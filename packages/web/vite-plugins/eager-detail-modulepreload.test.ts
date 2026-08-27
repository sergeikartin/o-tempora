import type { IndexHtmlTransformContext } from 'vite';
import { expect, test } from 'vitest';
import { eagerDetailModulePreloadPlugin } from './eager-detail-modulepreload';

type Bundle = NonNullable<IndexHtmlTransformContext['bundle']>;

function chunk(fileName: string, facadeModuleId: string | null) {
  return {
    type: 'chunk' as const,
    fileName,
    facadeModuleId,
    name: fileName,
    isEntry: false,
    isDynamicEntry: true,
    moduleIds: facadeModuleId ? [facadeModuleId] : [],
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

const bundle = {
  'assets/people.detail1-abc.js': chunk(
    'assets/people.detail1-abc.js',
    '/repo/packages/shared-types/src/data/people.detail1.json',
  ),
  'assets/conflicts.detail1-def.js': chunk(
    'assets/conflicts.detail1-def.js',
    '/repo/packages/shared-types/src/data/conflicts.detail1.json',
  ),
  'assets/milestones.detail2-ghi.js': chunk(
    'assets/milestones.detail2-ghi.js',
    '/repo/packages/shared-types/src/data/milestones.detail2.json',
  ),
  'assets/people.detail1.ru-jkl.js': chunk(
    'assets/people.detail1.ru-jkl.js',
    '/repo/packages/shared-types/src/data/people.detail1.ru.json',
  ),
  'assets/conflicts.detail2.ru-mno.js': chunk(
    'assets/conflicts.detail2.ru-mno.js',
    '/repo/packages/shared-types/src/data/conflicts.detail2.ru.json',
  ),
  'assets/milestones.detail1.ru-pqr.js': chunk(
    'assets/milestones.detail1.ru-pqr.js',
    '/repo/packages/shared-types/src/data/milestones.detail1.ru.json',
  ),
  'assets/people.detail3-stu.js': chunk(
    'assets/people.detail3-stu.js',
    '/repo/packages/shared-types/src/data/people.detail3.json',
  ),
  'assets/people.detail4-abc2.js': chunk(
    'assets/people.detail4-abc2.js',
    '/repo/packages/shared-types/src/data/people.detail4.json',
  ),
  'assets/main-vwx.js': chunk('assets/main-vwx.js', '/repo/src/main.tsx'),
  'assets/archivo-latin-400-normal-yz1.woff2': asset(
    'assets/archivo-latin-400-normal-yz1.woff2',
  ),
  // The real rolldown output types are opaque native handles that plain
  // fixtures can't satisfy structurally; this plugin only ever reads the
  // plain fields above, so the cast is safe for a test double.
} as unknown as Bundle;

type PreloadTag = { attrs: { href: string; rel: string; crossorigin: string } };

function preloadedHrefs(path: string, transformBundle: Bundle | undefined) {
  const plugin = eagerDetailModulePreloadPlugin();
  const hook = plugin.transformIndexHtml;
  if (!hook || typeof hook === 'function') {
    throw new Error('expected an object-form transformIndexHtml hook');
  }
  const handler = hook.handler as unknown as (
    html: string,
    ctx: IndexHtmlTransformContext,
  ) => PreloadTag[];
  const result = handler('', {
    path,
    filename: path,
    bundle: transformBundle,
  } as IndexHtmlTransformContext);
  return result.map((tag) => tag.attrs.href);
}

test('preloads only the EN level 1+2 chunks for the EN entry html, not level 3/4', () => {
  expect(preloadedHrefs('/index.html', bundle).sort()).toEqual([
    '/assets/conflicts.detail1-def.js',
    '/assets/milestones.detail2-ghi.js',
    '/assets/people.detail1-abc.js',
  ]);
});

test('preloads only the RU level 1+2 chunks for the RU entry html', () => {
  expect(preloadedHrefs('/ru/index.html', bundle).sort()).toEqual([
    '/assets/conflicts.detail2.ru-mno.js',
    '/assets/milestones.detail1.ru-pqr.js',
    '/assets/people.detail1.ru-jkl.js',
  ]);
});

test('returns nothing when no bundle is present (dev server)', () => {
  expect(preloadedHrefs('/index.html', undefined)).toEqual([]);
});

test('matches a chunk whose facadeModuleId uses Windows-style backslashes', () => {
  const windowsBundle = {
    'assets/people.detail1-abc.js': chunk(
      'assets/people.detail1-abc.js',
      'C:\\repo\\packages\\shared-types\\src\\data\\people.detail1.json',
    ),
  } as unknown as Bundle;
  expect(preloadedHrefs('/index.html', windowsBundle)).toEqual([
    '/assets/people.detail1-abc.js',
  ]);
});
