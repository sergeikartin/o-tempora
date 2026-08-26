import { useSyncExternalStore } from 'react';

// Chosen to cover phones in both orientations while leaving tablets on the
// desktop layout — tunable, see .scratch/mobile-responsive-layout/spec.md.
export const MOBILE_BREAKPOINT_PX = 640;

const mobileQuery = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`;

// Guards the same way motion.ts's motionDurationMs does — jsdom (the test
// environment) doesn't implement matchMedia at all, so tests that don't
// explicitly stub it (most of this codebase's) fall back to a stable
// non-mobile snapshot instead of throwing.
function hasMatchMedia(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  );
}

function subscribe(onChange: () => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mediaQueryList = window.matchMedia(mobileQuery);
  mediaQueryList.addEventListener('change', onChange);
  return () => mediaQueryList.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia(mobileQuery).matches;
}

// Always false, deliberately never reading a real matchMedia value — the
// prerender step (vite-plugins/prerender-default-viewport.ts) always builds
// its default-state layout assuming desktop (ADR 0013), so the client's
// first hydration pass must assume the same, even on an actually-narrow
// device. Reusing getSnapshot here would read the *real* browser width
// during that first pass and mismatch the server's fixed assumption,
// throwing a hydration error — React reconciles the real value in a normal
// follow-up render right after, via the subscription below.
function getServerSnapshot(): boolean {
  return false;
}

// Subscribes to the width breakpoint via useSyncExternalStore — the
// React-idiomatic way to read a live value from a browser API (matchMedia)
// outside React's own state, without the cascading-render risk of setting
// state from inside an effect body. A third (getServerSnapshot) argument is
// required for React's SSR entry points (renderToReadableStream, used by
// vite-plugins/prerender-default-viewport.ts) — omitting it makes React
// suspend the whole tree instead of rendering.
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
