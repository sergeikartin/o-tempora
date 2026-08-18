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
    // Read-only app with no user-triggered actions worth tracing — capture
    // every error, skip performance monitoring entirely.
    sampleRate: 1,
  });
}
