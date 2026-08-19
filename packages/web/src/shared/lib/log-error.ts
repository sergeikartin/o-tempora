import * as Sentry from '@sentry/react';

// The one funnel every call site logs errors through, so swapping or
// reconfiguring the monitoring backend never touches call sites — safe to
// call whether or not Sentry.init() ran (see init-monitoring.ts).
export function logError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  console.error(error, context);
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
