Labels: ready-for-agent

# Prerender the default viewport for LCP

## Problem Statement

Today the app is a bare CSR shell: nothing visible paints until JS loads, parses, React mounts, and — for the two D3-owned lanes — the first `.join()` runs. ADR 0012 already found and fixed the Year Axis's own contribution to this (a per-tick DOM/SVG node approach that dominated a ~5.9s LCP), getting it down to ~4.1-4.4s, but that fix didn't touch the underlying fact that a first-time visitor stares at an empty page until the whole JS boot sequence finishes. A user on a slow connection or a low-power device pays that entire cost before seeing a single Person or Conflict.

## Solution

The build emits real, visible content for the app's default opening view — the 1740-1860 window at the default Data Depth ("Mainstream") — directly into `index.html`/`ru/index.html`, so a visitor sees the actual timeline (People lifespans, Conflicts/Milestones marks, the Year Axis and its decade labels) the moment the HTML and CSS load, before any JS has run. Once JS does load, the app hydrates in place — the same visible marks become the live, fully interactive canvas, with no flash, no re-render, no visible handoff moment. Every interaction (pan, zoom, Search, filters, the detail tooltip, the Minimap) is unchanged: still entirely client-side, still exactly as responsive as it is today. Continuous zoom is untouched — this only changes what's already on screen at the very first paint, not how the user gets anywhere else from there.

## User Stories

1. As a first-time visitor on a slow connection, I want to see real timeline content as soon as the page's HTML/CSS arrive, so that I'm not staring at a blank page while JS downloads and boots.
2. As a first-time visitor on a fast connection, I want the transition from prerendered content to the fully interactive app to be invisible, so that I never see a flash, flicker, or re-layout as JS takes over.
3. As a mobile visitor on a low-power device, I want first paint to not depend on JS execution finishing, so that the app feels fast even before React/D3 have had a chance to run.
4. As a visitor with JavaScript blocked or failing to load, I want to still see the default view's real content (names, dates, the Year Axis), so that the page isn't a blank screen even though I understand it won't be interactive.
5. As a screen reader user arriving before JS has finished loading, I want the default view's real text content to already be in the DOM, so that assistive technology has something meaningful to announce immediately.
6. As an English-locale visitor, I want the prerendered default view in my language, so that first paint isn't showing me content in the wrong locale that then swaps.
7. As a Russian-locale visitor (`/ru/`), I want the same prerendered-first-paint benefit as the English page, so that neither locale is treated as second-class.
8. As a user who immediately pans, zooms, or changes a filter before JS has finished hydrating, I want that first interaction to work correctly once hydration completes, so that a fast interaction doesn't land in a broken or inconsistent state.
9. As a user who searches, filters, or clicks a mark right after the page loads, I want the hydrated app to behave identically to how the fully-loaded app behaves today, so that prerendering hasn't quietly changed any interactive behavior.
10. As a developer maintaining the two D3-owned lanes (`PeopleLane`, `ConflictsMilestonesLane`), I want the prerendered markup and the live client join to be generated from one shared definition of a mark's DOM shape, so that the two can't silently drift out of structural agreement.
11. As a developer maintaining the Year Axis, I want its prerendered markup to come from rendering the same component used live, so that there's no second, hand-written implementation of its output to keep in sync.
12. As a developer, I want the build-time default-state dataset to come from the same build-time-bundled JSON the live app already uses, so that prerendered content can never show different entities or text than the live app would for the same state.
13. As a developer, I want the build-time default state (viewport years, fame-score floors) to be read from the same constants `App.tsx` already initializes its own state from, so that there's no second, hand-duplicated copy of those defaults to fall out of sync.
14. As a developer, I want a test that fails if the build step's output stops matching what the live components would render for the same fixture, so that a future change to `PeopleLane`, `ConflictsMilestonesLane`, or `YearAxis` can't silently break the prerendered output without a test catching it.
15. As a developer, I want the Minimap, Search, filters, and detail tooltip left completely alone by this change, so that the scope of this effort stays bounded to first paint only.
16. As a maintainer investigating a future LCP regression, I want a real before/after LCP trace of this change, so that the win is measured rather than assumed.

## Implementation Decisions

- **Scope of what's prerendered:** the People Lane, the Conflicts+Milestones Lane, and the Year Axis (both its CSS ruler and its decade-number labels), all for the default viewport (`DEFAULT_VIEWPORT_START_YEAR`-`DEFAULT_VIEWPORT_END_YEAR`) at the default Fame Score floors ("Mainstream" Data Depth). The Minimap, Search, filters, and the detail tooltip are explicitly untouched — no build-time work, no behavior change.
- **Mechanism, lanes:** a new build step calls the app's existing pure layout functions (the ones that compute each mark's row and x/y position — already confirmed to have no dependency on `document`/`window`/DOM measurement) against the build-time-bundled default-state dataset, and generates the resulting mark markup from **one shared shape descriptor** — a single definition of a person/conflict/milestone mark's DOM structure (which child elements, in which order, with which classes and data attributes) consumed by both the build step's templater and the live client join's `enter` branch. This eliminates having two hand-written implementations of "what a mark looks like" that could drift apart.
- **Mechanism, Year Axis:** rendered via React's static server-rendering (`renderToStaticMarkup` or equivalent) directly against the existing `YearAxis` component and the default-state props — no hand-templating, since it's already plain JSX with no imperative DOM ownership.
- **Mechanism, the rest of the shell:** the app's dataset currently resolves through a module-scope promise (`localeDatasetsPromise`) built on a dynamic `import()` and runtime locale detection — both awkward to reproduce faithfully outside a browser. Rather than depending on that runtime path, the composition that owns the dataset needs a way to be handed an already-resolved default-state dataset (built from directly, statically importing the same build-time-bundled tier0 JSON the live app uses) so the build step can render the full component tree down to — and including — the wrapper elements around each lane and the `<svg>` elements themselves, with the two D3-owned mark subtrees grafted in from the shared-descriptor templater above. This is what makes the *whole* path from the page root down to each mark real, prerendered markup, not just the leaf nodes — necessary for the client to be able to adopt any of it at all.
- **Client integration:** the app's root mount switches from a plain client render to React's hydration entry point, so the prerendered DOM survives the client's first commit instead of being discarded and rebuilt. This is compatible with the D3-owned lane subtrees specifically because those container elements declare no JSX children of their own — the same pattern any React app uses to host a third-party imperative library under a ref, not a novel or fragile use of hydration.
- **Mark adoption:** on first run, each lane's D3 join is taught to recognize the prerendered mark elements already in the DOM (matched via the entity-id data attribute every mark already carries for click/hover wiring) and treat them as an update rather than a fresh insert, so nothing is destroyed and recreated on mount.
- **Locale scope:** both `index.html` and `ru/index.html` get this treatment from the start — the mechanism above is locale-agnostic once it's given the right locale's dataset and message catalog, and the build already produces both HTML entries symmetrically (one shared JS/CSS bundle, per-entry HTML).
- **What does not change:** continuous zoom, pan, Search, the fame-score/occupation/region filters, the detail tooltip, and the Minimap all stay exactly as they are today — entirely client-side, entirely unaffected by this work. The default state's numbers (viewport years, fame-score floors) are read at build time from the same source `App.tsx` already initializes from, not duplicated.

## Testing Decisions

- A good test here checks external behavior — the HTML the build step actually produces, and whether the live components render the same structure for the same input — not the internals of how the templater assembles strings.
- Primary seam: the new build step's output-generating function, called directly against a fixture (a small, fixed default-state dataset), the same way the existing `vite-plugins/critical-css.ts` and `vite-plugins/tier0-modulepreload.ts` are tested today — invoking the function/hook directly against a fabricated input, with no real `vite build` and no browser. Two things get asserted from that one seam:
  1. The output contains real content for the fixture (e.g. a known person's name and dates appear as text), not an empty shell.
  2. The output's structure for a mark matches what rendering `PeopleLane`/`ConflictsMilestonesLane` live (via the existing RTL-based component tests, e.g. `PeopleLane.test.tsx`) produces for the same fixture — proving the shared shape descriptor is actually shared, not just claimed to be.
- The Year Axis needs a lighter version of the same check: that build-time `renderToStaticMarkup` output for a fixture matches the existing live-rendered `YearAxis.test.tsx` output for the same props.
- Out of scope for new tests: anything about interactive behavior after hydration (pan/zoom/Search/filters/tooltip) — those are already covered by existing tests and this change doesn't alter their behavior, only what's present before they run.

## Out of Scope

- Dropping or altering continuous zoom, or any other change to the product's zoom/pan model.
- Prerendering any state other than the single default viewport/Data Depth combination — no prerendering per zoom level, per filter combination, or per search query.
- Prerendering the Minimap.
- Any change to Search, filters (Fame Score, Occupation Domain, Region), or the detail tooltip's behavior.
- Making the app functional with JavaScript disabled beyond the static first paint — panning, zooming, filtering, searching, and opening the detail tooltip all still require JS, as today.
- SEO-specific work (structured data, meta tags, sitemaps) — this effort is scoped to LCP only, though real crawlable content landing in the initial HTML is an incidental side effect.

## Further Notes

- The original framing of this idea ("would a fixed pixel-per-year ratio make static rendering possible?") turned out not to be the real blocker. Row position already comes from pipeline-precomputed data, not a client-side packing pass, and mark x-position is a function of year and pixels-per-year across the *entire* pannable range — not the visitor's screen width — so any single fixed ratio is equally prerenderable at any zoom level. The actual blocker is architectural: the two lanes' marks are created by D3 imperatively inside a client-only effect, which never runs during any form of server/build-time rendering. This spec addresses that directly rather than by changing the zoom model.
- After shipping, re-trace LCP to confirm the lane marks (rather than JS bundle parse/boot time, web font loading, or something else already addressed) were actually the remaining bottleneck — this change helps regardless of the exact LCP element, since it moves first paint ahead of JS execution entirely, but the size of the win isn't measured yet.
- See `packages/web/docs/adr/0013-prerender-default-viewport-for-lcp.md` for the full architectural rationale and the options considered and rejected (a rasterized screenshot instead of real markup, a static-twin-and-swap instead of hydration, two hand-synced mark templates instead of a shared descriptor, English-only for v1).
