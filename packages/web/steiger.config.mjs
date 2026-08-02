import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // features/ is still an intentionally empty placeholder layer until
    // Unit 6+ adds real slices; a slice with no references is expected here.
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Layer-root index.ts is normally invalid FSD (public APIs belong to slices,
    // not layers) — scoped exception for this one remaining placeholder file.
    // Remove this override once Unit 6+ replaces features/ with real slices.
    files: ['src/features/index.ts'],
    rules: {
      'fsd/no-layer-public-api': 'off',
    },
  },
  {
    // widgets/timeline-canvas is a single-purpose slice per code-standards.md's
    // Timeline Rendering rules (all vis-timeline config in one place, flat
    // files, no internal segment subfolders) — the installed ruleset expects
    // segment subfolders (ui/, lib/, etc.) inside every slice, which this
    // spec deliberately doesn't use.
    files: ['src/widgets/timeline-canvas/**'],
    rules: {
      'fsd/no-segmentless-slices': 'off',
    },
  },
  {
    // shared/config has no index.ts per the spec's file shape (a single
    // viewport.ts constants file) — scoped exception, same rationale as the
    // shared/index.ts removal: no barrel file for a single-file segment.
    files: ['src/shared/config/**'],
    rules: {
      'fsd/public-api': 'off',
    },
  },
  {
    // "types" is a generic/structural segment name the installed ruleset
    // flags on principle (name-by-purpose, not by-content) — but
    // shared/types/ is the name code-standards.md already fixed on, not a
    // decision made in this unit.
    files: ['src/shared/types/**'],
    rules: {
      'fsd/segments-by-purpose': 'off',
    },
  },
]);
