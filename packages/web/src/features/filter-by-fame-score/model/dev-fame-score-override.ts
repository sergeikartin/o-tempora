import type { FameScoreValues } from './useFameScoreFilters';

declare global {
  interface Window {
    __setFameScoreFloors?: (values: Partial<FameScoreValues>) => void;
  }
}

let devSetter: ((values: Partial<FameScoreValues>) => void) | undefined;

// Dev-console-only escape hatch
// (docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md): sets
// arbitrary per-lane Fame Score floors via
// `__setFameScoreFloors({ people: 85 })`. Vite inlines `import.meta.env.DEV`
// as `false` in production, so the minifier strips this whole block,
// including the `window` assignment.
if (import.meta.env.DEV) {
  window.__setFameScoreFloors = (values) => devSetter?.(values);
}

// Wires the override into useFameScoreFilters' state setter; no-op in
// production.
export function registerDevFameScoreOverride(
  setter: (values: Partial<FameScoreValues>) => void,
): void {
  if (import.meta.env.DEV) devSetter = setter;
}
