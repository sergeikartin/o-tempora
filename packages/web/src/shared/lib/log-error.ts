import { captureException } from '@sentry/react';

// The one funnel every call site logs errors through, so swapping or
// reconfiguring the monitoring backend never touches call sites — safe to
// call whether or not Sentry.init() ran (see init-monitoring.ts). Named
// import deliberately, not `import * as Sentry` — see init-monitoring.ts's
// comment on why a dynamic import here would cost far more than it saves.
export function logError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  console.error(error, context);
  captureException(error, context ? { extra: context } : undefined);
}
