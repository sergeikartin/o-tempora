declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
    };
  }
}

// The one funnel every call site sends product events through, so swapping
// or reconfiguring the analytics backend never touches call sites — mirrors
// logError()/init-monitoring.ts. A no-op in dev (keeps local runs off
// Umami's servers, not just off the usage quota) and whenever the script
// hasn't loaded (ad blockers, a build without the script tag in index.html).
//
// Umami counts every event and every property on it toward the monthly
// event quota, so `data` must stay low-cardinality buckets (category, era,
// zoom tier) — never a per-entity name or id.
export function trackEvent(name: string, data?: Record<string, unknown>): void {
  if (import.meta.env.DEV) return;
  window.umami?.track(name, data);
}
