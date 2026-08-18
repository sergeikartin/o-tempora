import * as Sentry from '@sentry/react';

// No-op until VITE_SENTRY_DSN is set (docs/config-variables.md) — lets the
// logError()/ErrorBoundary plumbing ship ahead of the Sentry account being
// created (a separate, human, one-time step). Sentry's default
// GlobalHandlers integration already installs window.onerror and
// unhandledrejection listeners once initialized, so nothing here duplicates
// that wiring by hand.
export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // Capture every error and pageload transaction (the latter is how
    // Sentry gets Web Vitals — LCP/CLS/INP/TTFB — with no separate setup).
    // Traffic here is low enough that 100% tracing won't meaningfully touch
    // the free tier's separate, smaller span quota; revisit if that changes.
    sampleRate: 1,
    tracesSampleRate: 1,
  });
}
