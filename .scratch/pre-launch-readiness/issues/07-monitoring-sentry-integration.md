Type: task
Status: open

# Monitoring: Sentry account + SDK integration

## Question

No error monitoring exists today (audit confirmed: no Sentry/GlitchTip/error-tracking package anywhere in `packages/web`). Sergei chose Sentry's free tier (chart-the-map grilling session) for client-side error capture ahead of a genuine public launch.

This is a task, not a pure decision — it's blocked on manual work (a human has to create the account) before the integration can be judged:

- **HITL**: Sergei signs up for a Sentry account and creates a project, producing a DSN.
- **AFK** (once the DSN exists): add `@sentry/react`, initialize it in `src/main.tsx` (or wherever the app root mounts), scope it to catch render/runtime errors, and confirm a deliberately-thrown test error shows up in the Sentry dashboard.

Resolve/record on completion: where the DSN/project lives (for future reference), sample rate chosen, and whether it's wired separately per language build (`en`/`ru`) or shared across both.
