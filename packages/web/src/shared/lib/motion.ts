// Reads a --motion-duration-* custom property once and caches it, since a
// per-call getComputedStyle read is a forced-reflow source once called from
// a per-frame/per-render code path. The cache is only invalidated when
// prefers-reduced-motion actually changes (global.css collapses every
// --motion-duration-* token to near-zero under that media query).
const durationCacheMs = new Map<string, number>();
let reducedMotionQuery: MediaQueryList | undefined;

function invalidateDurationCache() {
  durationCacheMs.clear();
}

function parseCssDurationMs(raw: string): number {
  if (raw.endsWith('ms')) return Number.parseFloat(raw);
  if (raw.endsWith('s')) return Number.parseFloat(raw) * 1000;
  return 0;
}

export function motionDurationMs(token: string): number {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !reducedMotionQuery
  ) {
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionQuery.addEventListener('change', invalidateDurationCache);
  }

  const cached = durationCacheMs.get(token);
  if (cached !== undefined) return cached;

  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  const ms = parseCssDurationMs(raw);
  durationCacheMs.set(token, ms);
  return ms;
}
