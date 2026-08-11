# 01 — Rename `description` → `tagline` everywhere (no behavior change)

**What to build:** The field holding Wikidata's short one-line subtitle text is renamed from `description` to `tagline` across the whole system — the data pipeline, the shared type definitions, and the web app. This is a pure rename: no entity's data source changes, and the running app looks identical to a user before and after. It exists to make the following tickets (live-fetching Discoveries' tagline, and adding a genuinely new `description` field) land as clean, unconfused changes rather than overloading one field name with two meanings mid-migration.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] The field is named `tagline` (not `description`) consistently across the data pipeline's fetch, transform, and output stages, the shared type definitions, and the web app's rendering layer.
- [x] People, Wars & Conflicts, and Discoveries all keep their *current* tagline source unchanged — live Wikidata fetch for People/Wars, hand-curated text for Discoveries. Sourcing changes are explicitly out of scope for this ticket.
- [x] The detail panel renders exactly the same text as before this change — no visible difference in the running app.
- [x] Any drop-reason/validation messaging that referenced "missing description" now reads "missing tagline" (or equivalent), consistent with the rename.
- [x] All existing tests referencing the old field name are updated and passing; typecheck passes across both workspaces.

## Answer

Renamed the field end to end, no behavior change:

- **shared-types**: `TimelineEntry.description` → `TimelineEntry.tagline`.
- **People**: `fetch-descriptions.ts`/`queries/descriptions.ts` → `fetch-taglines.ts`/`queries/taglines.ts` (`buildDescriptionsQuery` → `buildTaglinesQuery`, `fetchDescriptions` → `fetchTaglines`); raw output `people-descriptions.raw.json` → `people-taglines.raw.json`; SPARQL binding `?description` → `?tagline` (the underlying `schema:description` predicate is unchanged — that's Wikidata's own property name, not this app's field name).
- **Wars**: `queries/wars-enrichment.ts`'s `?description` binding → `?tagline`; `EnrichedWar.description` → `tagline` throughout `fetch-wars-enrichment.ts`.
- **Discoveries**: `CuratedEvent`/`EnrichedEvent.description` → `tagline` in `fetch-events-enrichment.ts`; still hand-curated, sourcing unchanged — only the field name moved. The curated file's own per-event key (`events-curated.raw.json`) was renamed `description` → `tagline` to match (its list-level `meta.description` is a different, unrelated field and was left alone).
- **Transform/Output**: `TaggedPerson`/`TaggedWar`/`TaggedDiscovery.description` → `tagline` in `transform/index.ts`; `write-datasets.ts`'s validation/build functions renamed accordingly, drop-reason strings "missing description" → "missing tagline".
- **Web**: `DrawerContent.description` → `tagline` in `build-drawer-content.ts`; `DetailPanel.tsx` now reads `content.tagline`. The CSS class was deliberately left named `.description` — ticket 04 repurposes that existing body-text style for the new `description` field and adds a distinct new style for the tagline subtitle, so renaming it here would just be churn.
- **Published data**: `packages/shared-types/src/data/{people,wars,discoveries}.json` and the pipeline's checked-in `data/raw/*.raw.json` fixtures were transformed in place (key rename, values untouched) rather than re-fetched live, since this ticket is a pure rename with no sourcing change.

Verified: `typecheck` passes in `data-pipeline` and `web`; 131 pipeline tests and 125 web tests pass; `npm run lint --workspace packages/web` is clean; manually confirmed in the running dev app that Muhammad's detail panel still renders the same tagline text as before.
