# 04 — Remove the old 9-query per-category Wikidata scan

Type: task
Status: open
Blocked by: 03

## Question

Once the curated-plus-enrichment path (tickets 02–03) is live and builds clean, remove the superseded Wars sourcing code and data:

- `src/fetch/fetch-historical-events.ts` and its wiring in `src/fetch/index.ts`.
- `src/fetch/queries/historical-events.ts` (+ `historical-events.test.ts`) — including `CONFLICT_CATEGORY_QUERIES`, `BAR_RENDERED_TYPE_QIDS`, and the nine `*_TYPE_QID` constants. Confirm nothing else references `BAR_RENDERED_TYPE_QIDS` before deleting (ticket 03 should have already removed its only real call site in `buildWars`).
- `src/transform/event-type-categories.ts` (the per-category Q-ID → `ConflictCategory` map, no longer needed once Fetch stops producing per-category rows).
- `src/transform/group-rows.ts` (+ `group-rows.test.ts`) — confirm Discoveries/People don't also depend on this before deleting; if they do, this ticket only removes Wars' call site, not the module.
- The nine per-category raw files: `data/raw/events-{war,battle,siege,military-operation,revolution,rebellion,coup-d-etat,war-of-independence,peace-treaty}.raw.json`.
- `dedupeFirstById`'s Wars call site in `src/transform/index.ts` (Discoveries never needed it — curated data has no cross-category collision problem to dedupe). Keep the function itself only if something else still calls it; otherwise remove it too.
- The per-`ConflictCategory` sitelink-floor logic in `src/transform/score.ts` for Wars (curated data needs no floor, same as Discoveries — already hand-vetted by the curator).
- `packages/data-pipeline/CLAUDE.md`: update the overview line, Stack table, and Data Pipeline's Fetch/Score/Tag steps to describe Wars & Conflicts as curated-list-plus-enrichment sourced, not a 9-query Wikidata candidate scan — mirrors how the Discoveries migration's own "remove old fetch" ticket updated this file.

## Answer
