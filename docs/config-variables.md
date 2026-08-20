# Config Variables

<!-- Configuration variables reference (env vars, feature flags, tunable constants). -->

## `packages/web` locale resolution

Locale is resolved at runtime, not selected by build mode (`docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`). Paraglide's `strategy: ['url', 'baseLocale']` (`packages/web/vite.config.ts`) reads the request path — `/` resolves to English (the base locale), `/ru/*` to Russian — using Paraglide's default URL pattern, no custom `urlPatterns` needed. `src/app/locale-datasets.ts` reads that resolved locale via `getLocale()` and dynamically imports the matching `packages/shared-types/src/data/{people,conflicts,milestones}(.ru)?.json` files, so a given page load only ever fetches one language's dataset.

There's a single `project.inlang/` config directory (`baseLocale: "en"`, `locales: ["en", "ru"]`) compiled by the Paraglide Vite plugin into `src/shared/paraglide/` (gitignored). Because `tsc -b` doesn't run Vite plugins, `npm run typecheck`/`build`/`dev`/`test` each run a `paraglide-js compile` prestep (`npm run paraglide:compile`) so the generated output exists on disk first.

## `packages/web` monitoring (GlitchTip) and analytics (Umami)

Errors and page behavior are split across two services:

- **GlitchTip** — JS errors and crashes, via the `@sentry/react` SDK (GlitchTip speaks the Sentry ingestion protocol, so the SDK works unmodified — only the DSN points elsewhere).
- **Umami** — visitors, page behavior, and Core Web Vitals. Loaded as a static `<script>` tag directly in `index.html`/`ru/index.html` (not env-configured), and driven from app code through `src/shared/lib/track-event.ts`'s `trackEvent()`.

`VITE_GLITCHTIP_DSN` (`packages/web/.env.example`) is the only monitoring config. Unset — the default in local dev — `src/shared/lib/init-monitoring.ts`'s `initMonitoring()` is a no-op, and `logError()` (`src/shared/lib/log-error.ts`) still logs to the console. Set, `main.tsx` initializes Sentry with `sampleRate: 1` (capture every error) before the app renders — no tracing integration, since Web Vitals is Umami's job here, not GlitchTip's. One DSN, shared across both the `en` and `ru` builds — they're one JS bundle (`docs/deployment.md`), not split per language. In CI, the deploy workflow reads it from the `VITE_GLITCHTIP_DSN` repo secret and passes it to the build step, since Vite bakes `VITE_*` env vars in at build time.

Every error funnels through `logError()` — a React `ErrorBoundary` (`src/shared/ui/ErrorBoundary.tsx`) around `TimelineCanvas` catches render-time crashes, and `locale-datasets.ts`'s `validateEntries()` calls it per dropped entry when pipeline output fails a basic shape check (missing id/name, non-finite date) — so no call site needs to know whether GlitchTip is actually configured.

Every product event funnels through `trackEvent()` — a no-op in dev and whenever the Umami script hasn't loaded, so call sites never need to guard for that. Umami counts each event and each property on it toward its monthly quota, so event data stays low-cardinality buckets (category, lane, filter name) — never a per-entity name or id.

Zoom and pan are gesture-bound, not frame-bound: `TimelineCanvas.tsx` fires one `zoom` event (`{ method: 'button' | 'pinch', direction: 'in' | 'out', period }`) per discrete zoom action — a button click or a completed pinch gesture, both already naturally single events. Pan has no equivalent discrete trigger (drag, touch swipe, trackpad scroll, and Minimap's rect-drag/track-jump all end up as a stream of native `scroll` events on the timeline's scroll container), so its `pan` event (`{ period }`) is debounced instead: the scroll listener resets a 500ms timer on every scroll event and fires once the timer actually elapses, collapsing an entire gesture — however long — into a single event. The two scrollLeft writes that aren't user panning (initial mount positioning, zoom's re-centering) set a one-shot `skipNextPanTrackRef` flag immediately before writing, so the `scroll` event they trigger doesn't restart or count toward that debounce.

`period` is the viewport-center year's century bucket (`shared/lib/format-year.ts`'s `centuryBoundaryForYear`, e.g. `"1800s"`, `"3rd century BCE"`) — a few dozen values across the whole timeline, low-cardinality enough for Umami's per-property quota while still saying roughly what era the user was looking at.
