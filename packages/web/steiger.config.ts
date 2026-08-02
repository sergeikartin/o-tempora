import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // shared/features/widgets are intentionally empty placeholder layers until
    // Unit 4+ adds real slices; these two rules only make sense once slices exist.
    rules: {
      'fsd/insignificant-slice': 'off',
      'fsd/no-layer-public-api': 'off',
    },
  },
]);
