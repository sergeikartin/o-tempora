// Debug-only toggles read straight from the URL (e.g. ?fameFilters=1) — no
// build config or persistence needed for a flag nobody but a developer
// reaches for, matching this app's no-backend, no-accounts shape.
export function hasFeatureFlag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(name);
}
