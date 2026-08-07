# 08 — Regenerate, publish, and verify discoveries.json end to end

Type: task
Status: resolved
Blocked by: 04, 05, 06, 07

## Question

Run the full pipeline (`npm run fetch`, `npm run build-data`, `npm run publish-data` — `packages/data-pipeline`) to produce and publish the new `discoveries.json` from the curated + enriched source. Confirm in the running app (`npm run dev` in `packages/web`, real browser check — not just typecheck) that:

- Events & Inventions lane renders all published curated events as points, correctly colored by the new `DiscoveryCategory` palette.
- The sidebar's recalibrated fame-score floor (ticket "05 — Recalibrate FAME_SCORE_BOUNDS.discoveries") behaves sensibly — moving the slider shows/hides curated events as expected.
- No regressions in People or Wars & Conflicts lanes (unaffected by this map, but sharing `TimelineCanvas.tsx`/`options.ts`).

This is the ticket that reaches the map's destination — closing it means `discoveries.json` is live from the curated source.

## Answer

Ran `fetch-events-enrichment.ts` (targeted, not the full `npm run fetch` — no need to re-fetch Pantheon/reigns/wars) against live Wikidata: all 121 QIDs resolved in 3 batches, 0 enrichment failures. `npm run build-data` produced `discoveries.json` with 121/121 kept, 0 dropped. `npm run publish-data` copied it into `packages/shared-types` (only `discoveries.json` changed there — `people.json`/`wars.json` untouched, confirmed via `git status`).

Verified in a real running `npm run dev` + Playwright: Events & Inventions lane renders all 121 curated events as points (Arc lamp, Telephone, Bicycle, Computer, Internet, ARPANET, etc.), each colored by the new `DISCOVERY_CATEGORY_COLORS` palette (ticket 01). Raised the sidebar's Events & Inventions floor from the default 25 to 200 and confirmed it correctly narrowed the visible set to only the highest-sitelink events (Telephone, Bicycle, Car, Computer, Internet — all ≥200). People and Wars & Conflicts lanes render unchanged (same bars/markers/colors as before this map). Only console message was an unrelated favicon 404.
