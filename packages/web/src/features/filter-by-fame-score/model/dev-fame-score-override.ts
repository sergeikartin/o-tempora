import type { FameScoreValues } from './useFameScoreFilters';

declare global {
  interface Window {
    __setFameScoreFloors?: (values: Partial<FameScoreValues>) => void;
  }
}

let devSetter: ((values: Partial<FameScoreValues>) => void) | undefined;

// Dev-console-only escape hatch replacing the retired FameScoreFilters UI
// (docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md) — lets a
// developer set arbitrary per-lane Fame Score floors from the browser
// console (`__setFameScoreFloors({ people: 85 })`) without a production UI
// path. `import.meta.env.DEV` is a build-time constant Vite inlines as
// `false` in production, so the minifier removes this whole block —
// including the `window` assignment below — from the production bundle;
// verified via `npm run build` + grepping dist/ for `__setFameScoreFloors`.
if (import.meta.env.DEV) {
  window.__setFameScoreFloors = (values) => devSetter?.(values);
}

// Called once by useFameScoreFilters to wire the override into its state
// setter — a no-op in production, same reasoning as above.
export function registerDevFameScoreOverride(
  setter: (values: Partial<FameScoreValues>) => void,
): void {
  if (import.meta.env.DEV) devSetter = setter;
}
