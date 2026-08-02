import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // shared/features/widgets are intentionally empty placeholder layers until
    // Unit 4+ adds real slices; a slice with no references is expected here.
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Layer-root index.ts is normally invalid FSD (public APIs belong to slices,
    // not layers) — scoped exception for these three placeholder files only.
    // Remove this override once Unit 4+ replaces them with real slices.
    files: ['src/features/index.ts', 'src/shared/index.ts', 'src/widgets/index.ts'],
    rules: {
      'fsd/no-layer-public-api': 'off',
    },
  },
]);
