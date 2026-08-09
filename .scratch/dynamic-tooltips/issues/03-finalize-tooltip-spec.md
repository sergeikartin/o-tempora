Type: grilling
Blocked by: 01, 02
Status: resolved

## Question

Write the final tooltip spec, ready to hand to `/implement`, combining "Research image sourcing"'s findings and "Prototype the tooltip interaction & layout"'s outcome:

- Exact content template per entity type (People / War / WarEvent / Discovery), including how reign periods render when a person has more than one.
- The on-demand/lazy-loading approach: single global tooltip component, content built from the already-in-memory hovered/clicked entity — no upfront per-item tooltip string precomputation (unlike today's `tooltip: string` field in `map-to-items.ts`) — image bytes lazy via `<img src>`.
- The new `image` field's shape (`packages/shared-types`) and the `packages/data-pipeline` wiring plan to populate it.
- Remaining edge cases surfaced by the prototype or research: hover-intent/debounce delay, exact dismiss behavior, any licensing/attribution text the image research turned up.

## Answer

Full spec written to `.scratch/dynamic-tooltips/spec.md`. Remaining open decisions settled in this session:

- **Licensing/attribution**: fetch and store it, don't restrict to PD-only. A new `imageAttribution?: string` field on `TimelineEntry`, populated from a batched Commons `imageinfo`/`extmetadata` API pass (a *second*, per-file API — distinct from the Wikidata SPARQL enrichment that resolves `image` itself) whenever a license requires it; shown as a small credit line under the image banner only when present.
- **partOfWarName**: kept, as its own "Part of: X" row for War/WarEvent — same information today's plain-text tooltip already surfaces, just laid out as a row instead of concatenated into one string.
- **`image` field shape**: confirmed as researched — raw P18 `Special:FilePath` URI stored verbatim, frontend appends `?width=` at render time.
- **Click-wiring architecture**: keep the prototype's delegated-listener + `data-entity-id`/`data-entity-type` mechanism for the real implementation, stated explicitly in the spec so it isn't rediscovered from scratch.

This closes the map — every ticket is resolved and `spec.md` is the destination artifact. See `map.md`'s Decisions-so-far for the final index entry.