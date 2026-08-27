# Config Variables

<!-- Configuration variables reference (env vars, feature flags, tunable constants). -->

## `packages/web` locale resolution

Locale is resolved at runtime, not selected by build mode (`packages/web/docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`). Paraglide's `strategy: ['url', 'baseLocale']` (`packages/web/vite.config.ts`) reads the request path — `/` resolves to English (the base locale), `/ru/*` to Russian — using Paraglide's default URL pattern, no custom `urlPatterns` needed. `src/app/locale-datasets.ts` reads that resolved locale via `getLocale()` and dynamically imports the matching `packages/shared-types/src/data/{people,conflicts,milestones}.tier0(.ru)?.json` files eagerly (gating first paint), so a given page load only ever fetches one language's Tier 0 payload; the `.tier1` siblings load separately, deferred to idle time (or on demand — see Payload Tier below).

## `packages/web`/`packages/data-pipeline` Payload Tier

Each lane's Output stage (`packages/data-pipeline/src/output/`) splits its dataset into `<lane>.tier0.json` and `<lane>.tier1.json` (plus `.ru` siblings) by `TIER_0_FAME_SCORE_FLOOR` (`packages/shared-types`, People 88/Conflicts 82/Milestones 82) — see `CONTEXT.md`'s Payload Tier entry and `docs/adr/0004-payload-tier-split-defers-low-fame-data.md`. `src/app/locale-datasets.ts` loads Tier 0 eagerly (unchanged Suspense contract) and Tier 1 via a second dynamic import deferred to idle time, skipped on a save-data/slow (`slow-2g`/`2g`) connection until `requestTier1Load()` is called explicitly — Deep Cut's control does this itself. `src/app/use-merged-datasets.ts` concatenates Tier 1 into Tier 0 once it resolves; which tier an entry shipped in never affects whether it renders, only the client-side Fame Score filter does.

There's a single `project.inlang/` config directory (`baseLocale: "en"`, `locales: ["en", "ru"]`) compiled by the Paraglide Vite plugin into `src/shared/paraglide/` (gitignored). Because `tsc -b` doesn't run Vite plugins, `npm run typecheck`/`build`/`dev`/`test` each run a `paraglide-js compile` prestep (`npm run paraglide:compile`) so the generated output exists on disk first.

## `packages/web` feature flags

`src/shared/lib/feature-flags/`'s `hasFeatureFlag(name)` checks for a URL query param of that name — no build config or persistence, since these gate developer-only debug UI rather than user-facing behavior. `?fameFilters=1` reveals the raw numeric fame-score inputs (`FameScoreFilters`, otherwise hidden) in the sidebar's Data Depth section, alongside the always-visible Mainstream/Deep Cut preset switch — for tuning `FAME_SCORE_BOUNDS` without a local dev server.

## `packages/web` monitoring (GlitchTip) and analytics (Umami)

Errors and page behavior are split across two services:

- **GlitchTip** — JS errors and crashes, via the `@sentry/react` SDK (GlitchTip speaks the Sentry ingestion protocol, so the SDK works unmodified — only the DSN points elsewhere).
- **Umami** — visitors, page behavior, and Core Web Vitals. Loaded as a static `<script>` tag directly in `index.html`/`ru/index.html` (not env-configured), and driven from app code through `src/shared/lib/track-event.ts`'s `trackEvent()`. `vite.config.ts`'s `strip-umami-script-dev` plugin strips that tag on the dev server, so it never loads (and never auto-fires its own pageview/vitals beacons) locally — `trackEvent()`'s `DEV` no-op only covers app-triggered events, not Umami's own auto-tracking.

`VITE_GLITCHTIP_DSN` (`packages/web/.env.example`) is the only monitoring config. Unset — the default in local dev — `src/shared/lib/init-monitoring.ts`'s `initMonitoring()` is a no-op, and `logError()` (`src/shared/lib/log-error.ts`) still logs to the console. Set, `main.tsx` initializes Sentry with `sampleRate: 1` (capture every error) before the app renders — no tracing integration, since Web Vitals is Umami's job here, not GlitchTip's. One DSN, shared across both the `en` and `ru` builds — they're one JS bundle (`docs/deployment.md`), not split per language. In CI, the deploy workflow reads it from the `VITE_GLITCHTIP_DSN` repo secret and passes it to the build step, since Vite bakes `VITE_*` env vars in at build time.

Every error funnels through `logError()` — a React `ErrorBoundary` (`src/shared/ui/ErrorBoundary.tsx`) around `TimelineCanvas` catches render-time crashes, and `locale-datasets.ts`'s `validateEntries()` calls it per dropped entry when pipeline output fails a basic shape check (missing id/name, non-finite date) — so no call site needs to know whether GlitchTip is actually configured.

Every product event funnels through `trackEvent()` — a no-op in dev and whenever the Umami script hasn't loaded, so call sites never need to guard for that. Umami counts each event and each property on it toward its monthly quota, so event data stays low-cardinality buckets (category, lane, filter name) — never a per-entity name or id.

Zoom and pan are gesture-bound, not frame-bound: `TimelineCanvas.tsx` fires one `zoom` event (`{ method: 'button' | 'pinch', direction: 'in' | 'out', period }`) per discrete zoom action — a button click or a completed pinch gesture, both already naturally single events. Pan has no equivalent discrete trigger (drag, touch swipe, trackpad scroll, and Minimap's rect-drag/track-jump all end up as a stream of native `scroll` events on the timeline's scroll container), so its `pan` event (`{ period }`) is debounced instead: the scroll listener resets a 500ms timer on every scroll event and fires once the timer actually elapses, collapsing an entire gesture — however long — into a single event. The two scrollLeft writes that aren't user panning (initial mount positioning, zoom's re-centering) set a one-shot `skipNextPanTrackRef` flag immediately before writing, so the `scroll` event they trigger doesn't restart or count toward that debounce.

`period` is the viewport-center year's century bucket (`shared/lib/date/format-year.ts`'s `centuryBoundaryForYear`, e.g. `"1800s"`, `"3rd century BCE"`) — a few dozen values across the whole timeline, low-cardinality enough for Umami's per-property quota while still saying roughly what era the user was looking at.
