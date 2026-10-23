# Troubleshooting

<!-- Root-caused, non-obvious bugs and their fixes. Do not pre-populate with speculative content. -->

## A conflict's start date is wrong (decades or centuries off)

**Symptom:** a `Conflict`'s `period.start.year` in `conflicts.json` doesn't match its own `description`, or is later than its `period.end.year`.

**Root cause:** Conflicts already carry an explicit start/end range, so a Wikidata item's P585 (point in time) is often unrelated to, or far coarser than, its real P580 (start time). `conflicts-enrichment.ts`'s SPARQL resolves `?date` via `COALESCE(?startTime, ?pointInTime)` — P580 first, P585 as fallback — and preferring P585 yields wrong start years (e.g. Wars of the Roses `1500` at century precision instead of `1455`; American Civil War `1865`, its end year, instead of `1861`).

**Fix:** keep `?startTime` ahead of `?pointInTime` in the COALESCE (and the matching precision COALESCE), then re-run the Conflicts lane — `npm run fetch --workspace packages/data-pipeline -- --lane=conflicts` from the repo root (or `npx tsx src/fetch/fetch-conflicts-enrichment.ts` from `packages/data-pipeline` to re-run only this enrichment stage) — followed by `npm run build-data` and `npm run publish-data`. See `packages/data-pipeline/src/fetch/queries/conflicts-enrichment.ts` and `packages/data-pipeline/docs/adr/0009-wars-sourced-from-curated-list-plus-container-nesting.md`.

**If it recurs:** the enrichment fetch pulls live Wikidata data, so a newly added curated conflict can surface the same P580-vs-P585 mismatch. Spot-check a new conflict's resolved `year` against its `description` before publishing.

## Console shows "Hydration failed because the server rendered HTML didn't match the client" (dev server only)

**Symptom:** a React hydration-mismatch error naming `<App><h1 className="_srOnly...">` on every `npm run dev` page load, though the same page is clean under `npm run build && npm run preview`.

**Root cause:** `vite-plugins/prerender-default-viewport.ts` only runs on build (`apply: 'build'`), so the dev server's `index.html` has an empty `<div id="root"></div>`, and `hydrateRoot()` against an empty container throws this mismatch.

**Fix:** `main.tsx` calls `hydrateRoot()` only when `rootElement.hasChildNodes()` (prod/preview builds) and `createRoot().render()` otherwise (dev server).

**Adjacent:** if the whole page renders blank (not just a console error), check whether `index.html`'s Umami `<script>` is stuck `pending` in the Network panel. It must stay `async`: a `defer` script shares one ordered execution queue with the module script that loads `main.tsx` (HTML spec), so a stalled analytics request (ad-blocker, offline sandbox, CDN outage) would block hydration.
