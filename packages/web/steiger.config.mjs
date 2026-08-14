import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  {
    // src/shared/paraglide is Paraglide's compiled message-catalog output
    // (docs/adr/0005) — generated per Language Build, not a hand-authored
    // FSD segment.
    ignores: ['src/shared/paraglide/**'],
  },
  ...fsd.configs.recommended,
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
