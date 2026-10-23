import { useSyncExternalStore } from 'react';

// 3x Sidebar.module.css's 320px .sidebar width, so the desktop column never
// exceeds a third of the viewport before flipping to the drawer layout.
export const MOBILE_BREAKPOINT_PX = 960;

const mobileQuery = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`;

// jsdom doesn't implement matchMedia, so tests that don't stub it fall back
// to a non-mobile snapshot instead of throwing.
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

// Always false: the prerender (vite-plugins/prerender-default-viewport.ts,
// ADR 0013) assumes desktop, so the first hydration pass must too, even on a
// narrow device; reading the real width would mismatch and throw. The real
// value follows in a normal re-render via the subscription.
function getServerSnapshot(): boolean {
  return false;
}

// getServerSnapshot is required for React's SSR entry points
// (renderToReadableStream, used by the prerender plugin); without it React
// suspends the whole tree.
export function useIsMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
