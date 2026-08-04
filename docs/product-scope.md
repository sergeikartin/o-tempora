# Product Scope

<!-- Product scope and UX decisions. Read before making a scope or UX call. -->

World History Timeline: a read-only, continuously zoomable visualization of world history (~800 BCE-present, extendable to 3000 BCE), inspired by Map of Contemporaries / Wait But Why's "Horizontal History." Three lanes: **People** (birth-death range bars), **Wars & Conflicts** (wars as range bars, battles/treaties as points, linked to their parent war when known), **Events & Inventions** (points). All data hardcoded ahead of time — People from Pantheon 2.0, Wars & Conflicts/Events & Inventions from Wikidata — no accounts, no editing, no live fetching.

**Goals:** help users see whose lives overlapped in time; make the shape of history visually intuitive; no login/setup friction; ship a well-scoped v1 (connections, comparison mode, and a map view are deferred, not abandoned).

**Core flow:** opens on the 1800s (100-year window) at the default fame tier → pan/zoom map-style, bounded to a 10-250 year window (no "see all history" view) → adjust the fame tier (Pantheon's HPI for People, Wikidata sitelinks for Wars & Conflicts/Events & Inventions) and occupation/region filters (combined with AND) → click an entry for a tooltip (name, dates, description, Wikipedia link).

**In scope:** pan/zoom timeline, three lanes, fame-tier selector, occupation filter, region filter (tag-based, not a map), click-to-view tooltip, read-only.

**Out of scope (v1):** connections between people, a literal map view, any write functionality, live data fetching, search outside the current fame tier, rich per-entry content (video/notes/articles).

**Success criteria:** smooth pan/zoom with the full default dataset; correct stacking in dense periods; filters/fame-tier update without lag; accurate detail tooltips; correct BCE/CE rendering; dataset populated for the top 200 people plus a comparable set of events before launch.
