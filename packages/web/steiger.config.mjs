import fsd from '@feature-sliced/steiger-plugin';
import { defineConfig } from 'steiger';

export default defineConfig([
  {
    // Paraglide generates this directory from the message catalogs.
    ignores: ['src/shared/paraglide/**'],
  },
  ...fsd.configs.recommended,
  {
    // Keep the D3 canvas internals together in a flat slice.
    files: ['src/widgets/timeline-canvas/**'],
    rules: {
      'fsd/no-segmentless-slices': 'off',
    },
  },
  {
    files: ['src/shared/types/**'],
    rules: {
      'fsd/segments-by-purpose': 'off',
    },
  },
]);
