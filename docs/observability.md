# Observability

<!-- Error tracking and product analytics: setup, and conventions for adding new tracked events. -->

## `packages/web` monitoring (GlitchTip) and analytics (Umami)

Errors and page behavior are split across two services:

- **GlitchTip** — JS errors and crashes, via the `@sentry/react` SDK (GlitchTip speaks the Sentry ingestion protocol, so the SDK works unmodified — only the DSN points elsewhere).
- **Umami** — visitors, page behavior, and Core Web Vitals. Loaded as a static `<script>` tag directly in `index.html`/`ru/index.html` (not env-configured), and driven from app code through `src/shared/lib/track-event.ts`'s `trackEvent()`. `vite.config.ts`'s `strip-umami-script-dev` plugin strips that tag on the dev server, so it never loads (and never auto-fires its own pageview/vitals beacons) locally — `trackEvent()`'s `DEV` no-op only covers app-triggered events, not Umami's own auto-tracking.

`VITE_GLITCHTIP_DSN` (`packages/web/.env.example`) is the only monitoring config. Unset — the default in local dev — `src/shared/lib/init-monitoring.ts`'s `initMonitoring()` is a no-op, and `logError()` (`src/shared/lib/log-error.ts`) still logs to the console. Set, `main.tsx` initializes Sentry with `sampleRate: 1` (capture every error) before the app renders — no tracing integration, since Web Vitals is Umami's job here, not GlitchTip's. One DSN serves both locales — they share one JS bundle (`docs/deployment.md`). In CI, the deploy workflow reads it from the `VITE_GLITCHTIP_DSN` repo secret and passes it to the build step, since Vite bakes `VITE_*` env vars in at build time.

## Error funnel

Every error funnels through `logError()` — a React `ErrorBoundary` (`src/shared/ui/ErrorBoundary.tsx`) around `TimelineCanvas` catches render-time crashes, and `locale-datasets.ts`'s `validateEntries()` calls it per dropped entry when pipeline output fails a basic shape check (missing id/name, non-finite date) — so no call site needs to know whether GlitchTip is actually configured.

## Event funnel and taxonomy

Every product event funnels through `trackEvent()` — a no-op in dev and whenever the Umami script hasn't loaded, so call sites never need to guard for that. Umami counts each event and each property on it toward its monthly quota, so event data stays low-cardinality buckets (category, lane, filter name) — never a per-entity name or id.

Zoom and pan are gesture-bound, not frame-bound: `TimelineCanvas.tsx` fires one `zoom` event (`{ method: 'button' | 'key' | 'pinch' | 'wheel', direction: 'in' | 'out', period }`) per discrete zoom action — a button click, a `+`/`-` key press, a completed touch pinch, or a wheel zoom once it settles, each already a single event. Pan has no equivalent discrete trigger (drag, touch swipe, trackpad scroll, and Minimap's rect-drag/track-jump all end up as a stream of native `scroll` events on the timeline's scroll container), so its `pan` event (`{ period }`) is debounced instead: the scroll listener resets a 500ms timer on every scroll event and fires once the timer actually elapses, collapsing an entire gesture — however long — into a single event. The two scrollLeft writes that aren't user panning (initial mount positioning, zoom's re-centering) set a one-shot `skipNextPanTrackRef` flag immediately before writing, so the `scroll` event they trigger doesn't restart or count toward that debounce.

`period` is the viewport-center year's century bucket (`shared/lib/date/format-year.ts`'s `centuryBoundaryForYear`, e.g. `"1800s"`, `"3rd century BCE"`) — a few dozen values across the whole timeline, low-cardinality enough for Umami's per-property quota while still saying roughly what era the user was looking at.

The timeline's Help panel fires `help_open` (`{ via: 'link' | 'key' }`) when a visitor opens it from the Top Bar's Help button or the `?` key.

The **Selection** (`features/select-timeline-entity/model/useSelection.ts`) fires `entity_view` (`{ entityType }`, a click or a Search pick replacing the Selection) and `selection_open_link` (an Entity Link resolving on arrival). Neither carries a slug or id.

The landing page (`packages/web/src/app/landing/`) fires two events, each carrying `curiosity` (one of the fixed set of Curiosity ids, so a few dozen values at most): `landing_curiosity_select` (`{ curiosity, method: 'chip' | 'stepper' }`, on a visitor's pick — not when the hash opens one on load) and `landing_cta_click` (`{ curiosity }`, the call-to-action).
