# Observability

## Error reporting

Use `logError()` for errors. It logs locally and sends errors to GlitchTip through `@sentry/react` when monitoring is enabled. `ErrorBoundary` catches timeline render crashes, and `validateEntries()` reports each dataset row rejected for a missing ID/name or non-finite year. Search index and deferred Detail Level load failures report the dataset or level.

Set `VITE_GLITCHTIP_DSN` to enable reporting. The deploy workflow supplies the repo secret at build time. One DSN covers both locales. `main.tsx` initializes monitoring before rendering and samples every error. Umami handles Web Vitals.

## Analytics

Use `trackEvent()` with low-cardinality properties such as lane or filter value. Keep entity names, IDs and Slugs out of event data. Every event and property counts toward Umami’s monthly quota.

The HTML entries load Umami directly. The dev server strips the script to suppress automatic pageview and vitals beacons. `trackEvent()` also exits in dev or when Umami has yet to load.

| Event | Properties | Trigger |
|---|---|---|
| `zoom` | `method` (button, key, pinch, wheel), `direction` (in, out), `period` | One completed zoom action |
| `pan` | `period` | 500 ms after the last scroll event in a pan |
| `data_depth_change` | `level` | Detail Level changes |
| `filter_toggle` | `filter`, `value` | Toggle a filter value |
| `help_open` | `via` (link, key) | Help button or `?` |
| `about_open` | | About opens |
| `entity_view` | `entityType` | Mark click, Search pick or Connection |
| `search_jump` | `entityType` | Search pick |
| `selection_open_link` | | Entity Link resolves on arrival or through browser history |
| `landing_curiosity_select` | `curiosity`, `method` (chip, stepper) | Visitor picks a Curiosity |
| `landing_cta_click` | `curiosity` | Landing CTA click |

`period` is the viewport center’s century bucket, such as “1800s” or “3rd century BCE.” `curiosity` is an ID from the fixed Curiosity list. `landing_curiosity_select` records a visitor’s chip or stepper action. Opening a Curiosity from the Landing Page hash emits no selection event.

In `TimelineCanvas.tsx`, `skipNextPanTrackRef` skips the scroll event caused by initial positioning or zoom recentering, keeping those writes out of the pan debounce.
