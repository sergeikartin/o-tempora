---
status: accepted
---

# Default viewport prerenders at build time; the client hydrates and adopts it

## Context

`docs/deployment.md` documents today's build as a bare CSR shell: nothing renders into `index.html`/`ru/index.html` until JS boots, React mounts, and — for the two lanes — D3 runs its first `.join()`. ADR 0012 already traced most of a ~5.9s LCP to the Year Axis specifically and got it down to ~4.1-4.4s by moving tick rendering out of the DOM entirely; that fix didn't touch the fact that literally nothing paints before JS executes.

A `/grilling` session (prompted by "is static HTML rendering possible, e.g. with a fixed pixel-per-year ratio?") worked through whether, and how, to prerender real content into the build output. The fixed-pixel-per-year framing turned out to be the wrong lever: every mark's `x1`/`x2` comes from `xScale`, whose range is the *full pannable width* (`PAN_MIN_YEAR` to present at the live `pixelsPerYear`), not the visitor's screen width — `container.clientWidth` (the one genuinely runtime-only, device-dependent number) only affects where the initial `scrollLeft` centers, not where any mark sits. The real blocker is that `PeopleLane`/`ConflictsMilestonesLane` create their marks imperatively inside a client-only `useLayoutEffect` (`PeopleLane.tsx:110-311`) — React SSR never runs effects, so naively server-rendering the existing component tree would still emit empty `<g class="people" />` groups. `YearAxis.tsx`, by contrast, is already plain JSX with no D3 involvement — its ruler is CSS custom properties and its decade labels are an ordinary `{labels.map(...)}`.

The session also confirmed `map-to-items.ts`/`options.ts` (row lookup/compaction of the pipeline-precomputed `TimelineEntry.row` field — `docs/adr/0005-row-assignment-moves-to-the-pipeline.md` — plus x/y layout and label geometry) never touch `document`/`window`/`getBoundingClientRect` — they're pure functions of plain numbers, so no headless-DOM shim (jsdom/linkedom) is needed to reproduce their output in Node.

## Decision

Prerender the **default viewport's first paint only** — `DEFAULT_VIEWPORT_START_YEAR`–`DEFAULT_VIEWPORT_END_YEAR` at the default fame-score floors, for both `index.html` and `ru/index.html` — into the build output. Everything after first paint (pan, zoom, filters, search, tooltip, Minimap) stays exactly as it is today: live, client-side, JS-driven. Continuous zoom itself is untouched; only the one fixed opening view gets baked in.

A new build step (alongside `vite-plugins/tier0-modulepreload.ts`/`critical-font-preload.ts`/`critical-css.ts`), run once per locale/HTML entry:

- For the two D3-owned lanes: calls the existing pure layout functions to compute `layout[]` for the default state, then templates real `<g class="d3-person">` markup from it. That template and `PeopleLane`'s/`ConflictsMilestonesLane`'s `enter` branch both consume **one shared shape descriptor** (element/class/attr list, no bound values) — a single definition of what a mark's DOM looks like, not two hand-written implementations kept in sync by convention.
- For the Year Axis: plain `renderToStaticMarkup(<YearAxis ... />)` — no special-casing, since it's already ordinary JSX.
- The Minimap is not prerendered — it's a secondary/overview element, not the LCP-critical content.
- The build step reads its default state from the same constants (`DEFAULT_VIEWPORT_START_YEAR`/`DEFAULT_VIEWPORT_END_YEAR`, `FAME_SCORE_BOUNDS[...].default`, etc.) `App.tsx` already initializes React state from, rather than duplicating those numbers.

On the client, `main.tsx` switches from `createRoot` to `hydrateRoot`. This is safe for the D3-owned subtree specifically because `<g className="people" />` (and its Conflicts/Milestones equivalent) declares zero JSX children — React's hydration only reconciles children it declared, so whatever's already in the DOM there survives untouched, the same pattern any React app uses to embed a third-party imperative library under a ref. `PeopleLane`'s/`ConflictsMilestonesLane`'s D3 `.join()` key function is taught to adopt the prerendered `.d3-person` nodes on first run (matching via the `data-entity-id` attribute already present in the prerendered markup, falling back from the usual bound-`__data__` key when there's none yet) instead of treating them as `enter`.

Filters, search, and the detail tooltip are explicitly out of scope — they're continuous/combinable runtime state (ADR 0003) that ADR 0004 already established can't be meaningfully precomputed even for the Minimap's much narrower Row Depth profile.

## Why

**Fixed pixel-per-year was the wrong target.** The framing in the original question assumed variable zoom was what made the canvas unrenderable statically. It isn't — row identity is pipeline-precomputed data, not a client-side packing pass (`docs/adr/0005-row-assignment-moves-to-the-pipeline.md`), x-position is a pure function of year and the *chosen* `pixelsPerYear` (any one value is equally prerenderable), and the pannable width at any realistic ratio is well under browser div-width limits. What actually blocks static rendering is architectural (D3 owns the marks imperatively, outside JSX), not the zoom mechanic — so dropping continuous zoom, which would also contradict CLAUDE.md's framing of the product as "continuously zoomable," was never necessary.

**Reusing the pure layout functions, not a headless browser.** They're already confirmed DOM-free, so a Node build step can call them directly and get byte-identical output to what the client would compute for the same state — no jsdom, no Playwright screenshot pipeline, no second implementation of the layout math to drift out of sync.

**One shared shape descriptor for the lanes, not two hand-synced templates.** Once the client adopts prerendered nodes, the build-time templater and the client join's `enter` branch must agree exactly on the mark's DOM shape for the join's `update` selectors (`.select('.d3-hit')`, `.select('.d3-line-ring-outer')`, etc.) to find the right nodes. A small, static list of 5 child elements is cheap to collapse into one definition and removes the drift risk entirely, rather than trusting a test to keep catching it.

**True hydration over a static-twin-and-swap.** A separate non-React static element, swapped for the live canvas once ready, avoids ever touching React's hydration model — but costs a visible cutover moment and duplicated markup in the page. Hydration has no such seam and, because the D3-owned `<g>` declares no JSX children, isn't a novel or fragile use of `hydrateRoot` — it's the same pattern any React app uses to host an imperative library.

**Year Axis needs none of the lane machinery.** It was already plain JSX before this decision — `renderToStaticMarkup` on the existing component is sufficient, with no shared descriptor or adoption logic to write.

**Both locales from the start.** The build already emits two symmetric Rollup entries sharing one entity set (ADR 0009); the prerender mechanism above is locale-agnostic once it's fed the right locale's text and dataset. Shipping only English first would be a special case needing its own justification, not the default.

## Considered Options

**Rasterized screenshot (Playwright) as the initial paint**, swapped for the live SVG once JS boots. Rejected: an image isn't real text/DOM (worse for accessibility and less honest for LCP than actual content), and it adds a headless-browser step to the build to keep in sync with the live default view — the pure-function approach makes that sync automatic instead.

**Static twin element, swapped on ready**, instead of true hydration. Rejected in Why above — no seam or duplicate-DOM cost with hydration, and the safety property it would buy (avoiding hydration-mismatch risk) already holds for the D3-owned subtree by construction.

**Two hand-written implementations of the mark's DOM shape** (build-time template + client `enter` branch), guarded by a test asserting structural equivalence. Rejected: a shared descriptor makes the two structurally identical by construction, for a small enough shape that extracting it costs little.

**Extend static prerendering to the Minimap's default-state ridge.** Rejected: it's not LCP-critical, and porting its log-scaled Row Depth math into the build step for a secondary/overview element isn't worth the added surface.

**English-only prerender for v1, Russian deferred.** Rejected: the mechanism is already locale-agnostic given the existing per-entry build, so scoping it down to one locale would be extra asymmetry, not less work.

## Consequences

- `main.tsx` moves from `createRoot` to `hydrateRoot` — any future change to the React-rendered shell (Sidebar, filters, DetailPanel, etc.) must keep its first-render output deterministic and consistent with whatever initial state the build step seeds, or it reopens hydration-mismatch warnings outside the D3-owned subtrees this decision already accounts for.
- A new Node build step (and the shared shape-descriptor module it and the two lanes both import) joins `vite-plugins/tier0-modulepreload.ts`/`critical-font-preload.ts`/`critical-css.ts` in `packages/web/vite-plugins/`.
- `PeopleLane.tsx`'s and `ConflictsMilestonesLane.tsx`'s D3 join key functions gain a fallback path for adopting pre-existing, unbound DOM nodes via `data-entity-id`, in addition to their normal keyed-by-bound-data matching.
- Re-trace LCP after this ships to confirm the lane marks (rather than JS bundle parse/boot time, font loading, or something else) were actually the remaining bottleneck post-ADR-0012 — this decision helps regardless of the exact LCP element, since it moves first paint ahead of any JS execution, but the size of the win isn't measured yet.
- Filters, search, tooltip, zoom UI, and the Minimap are all unaffected — this decision only changes what's present in the HTML at first paint, not any interaction.
