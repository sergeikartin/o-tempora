# Product Scope

<!-- Product scope and UX decisions. Read before making a scope or UX call. -->

World History Timeline: a read-only, continuously zoomable visualization of world history (~800 BCE-present, extendable to 3000 BCE), inspired by Map of Contemporaries / Wait But Why's "Horizontal History." Three lanes: **People** (birth-death range bars), **Conflicts** (wars as range bars, single-date conflicts as points, optionally nested under a parent Conflict via `parentId` — see `CONTEXT.md`'s **Container**), **Milestones** (points, or range bars for a milestone with a known end date, e.g. a pandemic). All data hardcoded ahead of time — People from Pantheon 2.0, Conflicts and Milestones each a hand-curated list backfilled with a batched Wikidata SPARQL enrichment pass — no accounts, no editing, no live fetching.

**Goals:** help users see whose lives overlapped in time; make the shape of history visually intuitive; no login/setup friction; ship a well-scoped v1 (connections, comparison mode, and a map view are deferred, not abandoned).

**Core flow:** opens on the 1800s (100-year window) at the default Fame Tier → pan/zoom map-style, bounded to a 10-500 year window (no "see all history" view) → zooming crosses Fame Tier thresholds (CORE/NOTABLE/EXHAUSTIVE) that automatically gate entity density by fame (Pantheon's HPI for People, Wikidata sitelinks for Conflicts/Milestones — see `packages/web/docs/adr/0002-fame-tier-drives-zoom.md`) plus occupation/region filters (combined with AND) → click an entry for a tooltip (name, dates, description, Wikipedia link).

**In scope:** pan/zoom timeline, three lanes, zoom-coupled Fame Tier (auto, read-only indicator — no manual fame selector), occupation filter, region filter (tag-based, not a map), click-to-view tooltip, read-only.

**Out of scope (v1):** connections between people, a literal map view, any write functionality, live data fetching, search outside the current Fame Tier, rich per-entry content (video/notes/articles).

**Success criteria:** smooth pan/zoom with the full default dataset; correct stacking in dense periods; filters/Fame Tier update without lag; accurate detail tooltips; correct BCE/CE rendering; dataset populated for the top 200 people plus a comparable set of events before launch.
