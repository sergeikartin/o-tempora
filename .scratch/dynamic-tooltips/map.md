# Dynamic tooltips

## Destination

A spec — covering both `packages/web` and `packages/data-pipeline` — for rich, on-demand tooltips on People/Wars & Conflicts/Events & Inventions entries: resolving the interaction model (hover vs. click), image sourcing and delivery strategy, and content layout. Ready to hand to `/implement` afterward; this map does not execute the build itself.

## Notes

- Domain: `packages/web`'s `widgets/timeline-canvas` (currently plain-text native SVG `<title>` hover tooltips, one precomputed `tooltip: string` per rendered item — see `map-to-items.ts`, `PeopleLane.tsx`/`WarsLane.tsx`/`EventsLane.tsx`) + `packages/data-pipeline` (would gain an `image` field if research finds a viable source).
- Default skills: `/grilling` + `/domain-modeling`. Ticket "Prototype the tooltip interaction & layout" additionally uses `/prototype`. Ticket "Research image sourcing" is resolved by a `/research` subagent.
- Settled during charting (not tickets — direct scope calls, recorded here rather than as "Decisions so far" since no ticket produced them):
  - The "no runtime data fetching" architecture principle (`packages/web/CLAUDE.md`) governs entity *data* (names/dates/descriptions from Wikidata/Pantheon), not images. An image URL string can live in the static JSON bundle; the actual bytes load lazily via a normal `<img src>` when a tooltip renders — no violation.
  - No image available → omit the image slot entirely. No placeholder graphic.
  - One global tooltip instance app-wide, repositioned/repopulated per hovered/clicked entry — not one instance per entity.
  - Keep the Wikipedia link (`wikipediaUrl` already exists on every `TimelineEntry`).
  - Descriptions are already short in the published data (avg 44–55 chars, max 245, across `people.json`/`wars.json`/`discoveries.json`) — no truncation decision needed.
  - Discoveries have no month data at all (hand-curated source is year-only) — only People and Wars & Conflicts entries can ever show month granularity.
  - `Person.reignPeriods` exists in the data but is currently **completely unused on the frontend** — not rendered as a visual accent line despite `docs/active-context.md` describing one (that description is stale/inaccurate). This effort is reign periods' first real frontend usage.
  - Performance work here is independent of the in-progress initial-load/progressive-loading effort (`docs/active-context.md`'s "In Progress" section) — different code path (per-hover cost vs. initial page load), no sequencing needed.
  - `id` on `War`/`WarEvent`/`Discovery` is already the Wikidata QID. `Person`'s exposed `id` is a Pantheon id, but the pipeline internally retains a `wd_id` per person (already used for reign-period enrichment) — usable for an image-lookup pass.

## Decisions so far

- [Research image sourcing](issues/01-research-image-sourcing.md) — P18 image coverage is high for both in-scope lanes (People 99.02%, Discoveries 89.26%, full-corpus live SPARQL), Commons' `Special:FilePath?width=` hotlink pattern works directly on the SPARQL-returned URI, and licensing is a real per-file mix (PD vs. CC BY/BY-SA) requiring a scope call on attribution handling.
- [Prototype the tooltip interaction & layout](issues/02-prototype-tooltip-interaction.md) — click-to-open, viewport-docked side drawer (Variant C) won over a hover popover and a click-to-pin mark-anchored card, live-compared on the real app (`prototype/dynamic-tooltips-tooltip-interaction`, not merged): decoupling the tooltip from the clicked mark's screen position avoids the click-to-pin variant's "goes stale on pan" failure mode entirely, and affords a roomier layout (full-width image banner, no space pressure on multi-entry reign-period lists). Dismiss: ×/Escape/click-away/click-a-different-mark.
- [Finalize the tooltip spec](issues/03-finalize-tooltip-spec.md) — wrote `spec.md`, the map's destination artifact: settled licensing (fetch & show attribution when required, via a new per-file Commons `imageinfo` pass and `imageAttribution` field, rather than restricting to PD-only), kept `partOfWarName` as its own content row, confirmed the `image` field's raw-URI-plus-frontend-`?width=` shape, and locked in the prototype's delegated-listener click-wiring as the recommended real-implementation architecture.

## Not yet specified

(none — every branch is resolved; see `spec.md`, this map's destination artifact)

## Out of scope

- Actual implementation (component code, pipeline changes) — this map produces a spec only.
- Coordinating with or sequencing after the in-progress initial-load performance effort.
- ~~Images for the Wars & Conflicts lane, for now~~ — **reversed 2026-08-08** on the Wars & Conflicts taxonomy restructure map (`.scratch/wars-conflicts-taxonomy/map.md`), same day this call was made. That map now owns image sourcing for Wars & Conflicts (tickets "Research P18/Commons image coverage...", "Wire P18/Commons image enrichment...", "Render images for Wars & Conflicts in the entity detail drawer") and is updating this map's `spec.md` §3.3/§4.2/§6 accordingly. Original rationale, for history: "Research image sourcing" was already running when this landed and had been redirected to drop the wars.json portion of its investigation.
