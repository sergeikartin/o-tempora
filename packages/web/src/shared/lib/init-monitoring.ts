import * as Sentry from '@sentry/react';

// GlitchTip speaks the Sentry ingestion protocol, so the @sentry/react SDK
// works unmodified — only the DSN points at GlitchTip instead of Sentry.
// No-op until VITE_GLITCHTIP_DSN is set (docs/config-variables.md). Sentry's
// default GlobalHandlers integration already installs window.onerror and
// unhandledrejection listeners once initialized, so nothing here duplicates
// that wiring by hand. Web Vitals/page-behavior tracking is Umami's job
// (track-event.ts) — this is errors and crashes only, so no tracing
// integration or tracesSampleRate here.
export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_GLITCHTIP_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Traffic here is low enough that 100% error capture won't meaningfully
    // touch the free tier's quota; revisit if that changes.
    sampleRate: 1,
  });
}
