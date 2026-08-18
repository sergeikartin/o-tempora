Type: task
Status: resolved

# Monitoring: Sentry account + SDK integration

## Question

No error monitoring exists today (audit confirmed: no Sentry/GlitchTip/error-tracking package anywhere in `packages/web`). Sergei chose Sentry's free tier (chart-the-map grilling session) for client-side error capture ahead of a genuine public launch.

This is a task, not a pure decision — it's blocked on manual work (a human has to create the account) before the integration can be judged:

- **HITL**: Sergei signs up for a Sentry account and creates a project, producing a DSN.
- **AFK** (once the DSN exists): add `@sentry/react`, initialize it in `src/main.tsx` (or wherever the app root mounts), scope it to catch render/runtime errors, and confirm a deliberately-thrown test error shows up in the Sentry dashboard.

Resolve/record on completion: where the DSN/project lives (for future reference), sample rate chosen, and whether it's wired separately per language build (`en`/`ru`) or shared across both.

## Comments

AFK side is done ahead of the DSN existing, so wiring in the real one is a one-line config change, not a code change:

- `@sentry/react` added; `src/shared/lib/init-monitoring.ts` calls `Sentry.init()` from `main.tsx` only when `VITE_SENTRY_DSN` is set (empty in dev today — no-op). `sampleRate: 1` (capture every error; no performance tracing, nothing to sample down for this app).
- `src/shared/lib/log-error.ts`'s `logError()` is the one funnel (console + Sentry) — a React `ErrorBoundary` around `TimelineCanvas` and `locale-datasets.ts`'s pipeline-output shape check both call it, and neither needed to change when Sentry was added behind them.
- One DSN, shared across `en`/`ru` — they're one JS bundle, not a per-language build (`docs/deployment.md`).
- `docs/config-variables.md` has the full writeup.

## Answer

HITL step done: Sergei created the Sentry account/project and added the DSN as the `VITE_SENTRY_DSN` GitHub repo secret (read by `.github/workflows/deploy.yml`). A redeploy baked it into the production bundle, confirmed present in the built JS asset. End-to-end verification: a deliberately-thrown uncaught error on the live `otempora.info` site showed up in the Sentry dashboard.

DSN/project: Sergei's Sentry account (free tier), DSN stored only as the `VITE_SENTRY_DSN` GitHub repo secret — not itself sensitive (a Sentry DSN is meant to ship in client bundles; it only allows submitting events, not reading them), so no other storage needed. Sample rate: `sampleRate: 1` (capture every error, no performance tracing). Wiring: one DSN/one Sentry.init(), shared across both `en`/`ru` — they're one JS bundle, not a per-language build.
