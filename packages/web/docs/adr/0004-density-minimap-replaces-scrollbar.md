---
status: accepted
---

# Minimap replaces the scrollbar

## Context

The timeline canvas has a custom scrollbar (`TimelineCanvas.tsx`) that shows viewport position and extent but carries no information about content density. Row Depth (how many vertical rows a lane needs to render without overlap) varies enormously across history — a handful of rows in antiquity, dozens in the Industrial and Digital eras — but nothing surfaces that ahead of time. A user panning from 1000 CE toward 1900 CE has no warning that doing so will require sweeping down through 30 rows once they get there. No Row Depth data exists anywhere today: `assignRows` computes it live, client-side, in pixel space, keyed to whatever `pixelsPerYear` the user is currently zoomed to.

## Decision

Replace the scrollbar entirely with an SVG area-sparkline ("Minimap") spanning the full pannable range (`PAN_MIN_DATE` to present). It draws two series as a mirrored ridge — People's Row Depth above a center baseline, Conflicts+Milestones' inverted below it — each height log-scaled so low-density eras stay visually non-flat against high-density ones. Row Depth for the Minimap is computed entirely client-side from the already-loaded lane JSON (no new data-pipeline artifact), reusing `assignRows`' packing approach but run once across the whole domain at a fixed Reference Scale (`defaultPixelsPerYear()`, i.e. the app's default 120-year opening view) rather than the user's live zoom. It recomputes on every fame-score filter change with no debounce, so it always reflects the currently fame-filtered item set. It keeps the scrollbar's interaction model — click anywhere jumps the viewport there, dragging an overlaid translucent rectangle pans — and adds a hover tooltip with exact date/Row-Depth numbers per series, to recover the precision the log scale deliberately compresses away. The component grows to roughly 48-64px tall, versus the scrollbar's ~8-12px.

## Why

An overview is only useful if it's the thing the user is already looking at — bolting a second, separate density strip next to the existing scrollbar would mean two controls competing for the same "where am I / where should I go" job. Folding the density signal into the same control the user already scrolls with means there's nothing extra to learn, and no risk of the two disagreeing (e.g. a static profile showing 30 rows for a region the user has fame-filtered down to 5). Client-side computation was the only option that could stay truthful to the live fame filter; anything precomputed in the data pipeline would already be wrong the moment a user touched a slider.

## Considered Options

**Heatmap/color-intensity strip** instead of a shaped profile. Rejected: color has no natural equivalent of a two-series split, and no equivalent of a "scale" the way height does — recovering "how much denser is X than Y" from color alone is much harder than from shape.

**Literal thumbnail rendering** (miniature individual items, like a code editor's minimap — a name this ADR's own chosen component has since taken over, see `CONTEXT.md`'s Minimap entry). Rejected: expensive to render at ~4,000 items across the full range, and the app is pure SVG/D3 today with no canvas element — this would force adding one just for this feature.

**Non-linear ("fisheye") scrollbar track**, where dense eras get proportionally more horizontal track space instead of overlaying a density chart on a linear one. Rejected: it would make click-to-jump position no longer map predictably to a year, undermining the one thing a scrollbar needs to keep.

**Precompute the profile in the data pipeline** as a new JSON artifact, consistent with how `packages/shared-types/src/data/*.json` is normally generated. Rejected: the profile has to react to the fame-score filters, which are runtime-only client state the pipeline can't see — a precomputed profile would be stale the instant a user adjusted a filter.

**Overlaid (shared-baseline, alpha-blended) or stacked (cumulative) two-series rendering**, instead of a mirrored ridge. Rejected: both make it harder to read either series' true individual shape — overlaid needs color-blending to disambiguate overlap, stacked requires mentally subtracting from a cumulative total to recover one series.

## Consequences

- The scrollbar's `trackRef`/thumb implementation, drag handlers, and click-to-jump handler in `TimelineCanvas.tsx` are removed and replaced by the new component; `pixelsPerYear`/`scrollLeft` state stays, now driven from the new control instead.
- Row Depth for the Minimap is a distinct computation from `assignRows`' live per-render call — same packing logic, different (fixed) scale input and full-domain scope instead of viewport-scoped.
- The Minimap's domain is the app's actual pannable range (`PAN_MIN_DATE`, `packages/web/src/shared/config/viewport.ts`) to present, not the full historical data extent some records reach. Extending `PAN_MIN_DATE` itself is a separate, unmade decision.
- Vertical space given to the canvas shrinks by roughly 40-50px versus the old scrollbar, trading main-canvas real estate for the density signal.
