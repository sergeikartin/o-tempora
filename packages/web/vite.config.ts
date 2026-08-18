import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

const SHARED_DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../shared-types/src/data');

// Build-time language selector (docs/config-variables.md): `vite build
// --mode ru` bundles the Russian lane dataset files
// (packages/shared-types/src/data/*.ru.json — pipeline-generated, same
// shape as the English files with per-field English fallback already
// baked in) instead of English; any other mode (dev server, tests, a bare
// `vite build`) bundles English, the app's default. This is a build-time
// fork producing two independent static outputs, not a runtime language
// switch (russian-localization spec's Out of Scope) — App.tsx's own
// `import ... from '@same-sky/shared-types/src/data/people.json'` (and
// the conflicts/milestones equivalents) stays completely unchanged; only
// which concrete file each of those three specifiers resolves to differs
// per build.
export default defineConfig(({ mode }) => {
  const suffix = mode === 'ru' ? '.ru' : '';
  // The two builds are deployed as independent static outputs under the
  // same domain — English at the root, every other locale at its own
  // `/<locale>/` subpath (docs/deployment.md, docs/adr/0003) — so only the
  // Russian build's asset URLs need rooting at a subpath; English's stay
  // rooted at '/', same as dev/vitest which never pass a custom mode.
  const base = mode === 'ru' ? '/ru/' : '/';
  return {
    base,
    plugins: [
      react(),
      // Each Language Build's locale is fixed at compile time via its own
      // project.inlang.{en,ru} config directory (docs/adr/0005), the same
      // mode branch as the data-file alias above — no runtime locale
      // switching, so strategy is pinned to the compiled baseLocale only.
      paraglideVitePlugin({
        project: mode === 'ru' ? './project.ru.inlang' : './project.en.inlang',
        outdir: './src/shared/paraglide',
        strategy: ['baseLocale'],
        emitTsDeclarations: true,
      }),
    ],
    resolve: {
      alias: [
        {
          find: '@same-sky/shared-types/src/data/people.json',
          replacement: path.join(SHARED_DATA_DIR, `people${suffix}.json`),
        },
        {
          find: '@same-sky/shared-types/src/data/conflicts.json',
          replacement: path.join(SHARED_DATA_DIR, `conflicts${suffix}.json`),
        },
        {
          find: '@same-sky/shared-types/src/data/milestones.json',
          replacement: path.join(SHARED_DATA_DIR, `milestones${suffix}.json`),
        },
      ],
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/setup-tests.ts'],
    },
  };
});
