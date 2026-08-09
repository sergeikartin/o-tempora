# Prototype: D3 People-lane rendering

Type: prototype
Status: built, reacted to (ticket 02 decided D3), captured to branch `prototype/d3-people-lane-ticket-01` and reverted from `dev` per the `/prototype` skill's capture step

## Question

Build a rough, throwaway D3 prototype of the People lane, rendered against real Pantheon data, to react to as a concrete alternative to vis-timeline. It should demonstrate:

- Custom lifespan-bar height and color (not vis-timeline's default item styling).
- Custom color for reign-period overlays.
- Correct stacking/collision handling on initial load — no overlapping items, names stay visible (the pain point currently blocking Unit 5 under vis-timeline).
- Panning via native browser horizontal scroll (zoom mechanism itself is out of scope — the existing +/- button behavior is assumed to carry over unchanged, whichever library wins).

Use the `/prototype` skill. Link the prototype as an asset on this ticket when done — it doesn't need to be production-quality or wired into the app, just concrete enough for the map's ticket 02 to react to and compare against current vis-timeline behavior.

## Prototype asset

Built as sub-shape A (mounted on the real People lane, real Pantheon `people.json`, not a standalone route) — a binary `vis-timeline` vs. `d3` switch rather than the skill's default 3 variants, per the map's "binary comparison only" standing preference.

- **Run it:** `git checkout prototype/d3-people-lane-ticket-01`, `npm install` (picks up `d3`/`@types/d3`), `npm run dev --workspace packages/web`, then open `http://localhost:5173/?peopleRenderer=d3` (or omit the param / use `?peopleRenderer=vis-timeline` for current behavior). A floating bottom-center switcher (dev-only, `import.meta.env.DEV`-gated) flips between the two with `←`/`→` or click; the URL param stays in sync.
- **Files** (all under `packages/web/src/widgets/timeline-canvas/`, all prototype-marked in a header comment): `prototype-people-lane-d3.tsx` + `.module.css` (the D3 renderer), `prototype-switcher.tsx` + `.module.css` (the variant switcher), plus a small conditional-render change to `TimelineCanvas.tsx`/`TimelineCanvas.module.css` to host both. `d3`/`@types/d3` added to `packages/web/package.json` for this.
- **What it demonstrates**, verified visually (headless Chrome screenshots) and against real data:
  - Custom lifespan-bar height (16px) and fill color, keyed off `OccupationDomain` (mirrors `design-tokens.md`'s Occupation Domain Palette, inlined since Unit 5 hasn't wired those as CSS custom properties yet).
  - Reign periods render as a solid colored stripe along the bar's bottom edge (mirrors `color-accent-selected`), replacing vis-timeline's neutral dashed border.
  - Correct stacking on load via a greedy interval-graph row assignment (sort by `startYear`, place in the first row that clears with a 5-year buffer, else open a new row) — no overlapping bars, no hidden names. Real data (`people.json`, 49 rows) needs 11 rows. Confirmed against the actual bug: the current vis-timeline view shows Napoleon's dashed reign-period overlay overlapping/obscuring Thomas Jefferson's and Fyodor Dostoevsky's name text in the same stacked row; the D3 view keeps every row visually separated with full names readable.
  - Panning via native browser horizontal scroll: the lane is a plain `overflow-x: auto` container over a wide SVG (full `PAN_MIN_DATE`–today domain at 8px/year ≈ 38k px), no custom drag/`rangechange` sync needed for this lane. Zoom is genuinely out of scope here (per the ticket) — the D3 lane doesn't respond to the existing +/- buttons.
- **Not covered / known gaps** (deliberately, per prototype scope): no zoom; colors/tooltips are prototype-inlined, not the real token pipeline; a person with no `endYear` (e.g. a still-living figure) renders a 1-year-wide sliver, same widening convention `map-to-items.ts` already uses for vis-timeline, not a new issue; Wars & Conflicts / Events & Inventions lanes are untouched, still vis-timeline only, in both switcher states.
- **Status:** ticket 02 decided D3 (`packages/web/docs/adr/0001-d3-over-vis-timeline.md`) — this prototype is the real migration's intended starting point. Captured on branch `prototype/d3-people-lane-ticket-01` and reverted out of `dev`'s working tree per the `/prototype` skill's capture step; the D3-migration follow-on effort (see `docs/active-context.md`) should branch from/merge this rather than starting cold.
