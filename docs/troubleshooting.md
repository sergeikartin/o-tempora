# Troubleshooting

<!-- Known issues and proven solutions. Empty until the first real issue is logged here — do not pre-populate with speculative content. Root-caused, non-obvious bugs and their fixes belong here; day-to-day implementation history lives in git log. -->

## A conflict's start date is wrong / earlier than expected (e.g. shows a date decades or centuries off)

**Symptom:** a `Conflict`'s `period.start.year` in `conflicts.json` doesn't match its own `description` field, or is later than its `period.end.year`.

**Root cause:** `conflicts-enrichment.ts`'s SPARQL query resolves `?date` from Wikidata via `COALESCE(?startTime, ?pointInTime)` — P580 (start time) preferred, P585 (point in time) as fallback. Before this was fixed, the COALESCE order was reversed (P585 preferred over P580). Because Conflicts entries already carry an explicit start/end range, an item's P585 is often unrelated or much coarser-precision than its real P580 start date, so preferring it silently produced wrong start years — e.g. Wars of the Roses resolved to `1500` (P585, century precision) instead of `1455` (P580, day precision); the American Civil War resolved to `1865` (its own *end* year) instead of `1861`.

**Fix:** prefer `?startTime` over `?pointInTime` in the COALESCE (and the matching precision COALESCE), then re-run just the Conflicts lane — `npm run fetch --workspace packages/data-pipeline -- --lane=conflicts` — from the repo root (or, for a narrower re-run of only this one enrichment stage, `npx tsx src/fetch/fetch-conflicts-enrichment.ts` from `packages/data-pipeline`), followed by `npm run build-data` and `npm run publish-data`. See `packages/data-pipeline/src/fetch/queries/conflicts-enrichment.ts` and ADR `packages/data-pipeline/docs/adr/0009-wars-sourced-from-curated-list-plus-container-nesting.md`.

**If it recurs:** re-running the enrichment fetch pulls live Wikidata data, so a newly-added curated conflict could surface the same P580-vs-P585 mismatch pattern again if a future edit reintroduces a COALESCE preferring P585 first. Spot-check any new conflict's resolved `year` against its `description` text before publishing.

## Console shows "Hydration failed because the server rendered HTML didn't match the client" (dev server only)

**Symptom:** every `npm run dev` page load logs a React hydration-mismatch error naming `<App><h1 className="_srOnly...">` as the diff, even though the same page is clean under `npm run build && npm run preview`.

**Root cause:** `vite-plugins/prerender-default-viewport.ts` only runs `apply: 'build'`, so the dev server's `index.html` always ships a genuinely empty `<div id="root"></div>` — there's no prerendered markup to reconcile against. `main.tsx` used to call `hydrateRoot()` unconditionally, which throws this exact mismatch against an empty container and silently falls back to a full client render.

**Fix:** `main.tsx` now checks `rootElement.hasChildNodes()` — `hydrateRoot()` only when there's real prerendered markup (prod/preview builds), `createRoot().render()` otherwise (dev server). Same rendered result either way, no console error.

**Unrelated but adjacent:** if the whole page renders blank (not just a console error), check whether `index.html`'s Umami `<script>` tag is stuck `pending` in the Network panel — it used to be `defer`, which shares one ordered execution queue with the non-`async` module script loading `main.tsx` (HTML spec behavior), so a stalled/blocked analytics request (ad-blocker, offline sandbox, CDN outage) prevented the app from ever hydrating. It's `async` now, decoupled from app startup.
