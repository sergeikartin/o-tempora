import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

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
  // The two builds are deployed as independent static outputs
  // subpath-addressed under the same domain (docs/deployment.md) — asset
  // URLs baked into each build's own index.html/JS must be rooted at that
  // build's own subpath, not the domain root. Only set for an explicit
  // `--mode en`/`--mode ru` build (build:en/build:ru); the dev server and
  // vitest never pass a custom mode, so they keep serving from '/'.
  const base = mode === 'en' || mode === 'ru' ? `/${mode}/` : '/';
  return {
    base,
    plugins: [react()],
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
