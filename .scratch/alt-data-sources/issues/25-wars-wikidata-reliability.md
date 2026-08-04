# 25 — Wars & Conflicts: Wikidata reliability fixes and live re-fetch

**What to build:** A live pipeline Fetch run for Wars & Conflicts completes reliably against the Wikidata Query Service and publishes a real `wars.json` — the CDB90 hybrid plan is fully abandoned (see [24 — Wars source: reopened, Wikidata-only](24-wars-source-reopen-wikidata-only.md)), so Wars stays on the existing `historical-events.ts` query, full history, no date-range carve-out.

**Blocked by:** 20 — Discoveries & Inventions: Wikidata reliability fixes. Ticket 20 lands the shared `wikidata-client.ts` fixes (502/503/504 retry with exponential backoff, raised client timeout) that this ticket reuses rather than reimplementing — both lanes are fetched via the same `fetchEvents()` function and the same client.

**Status:** ready-for-agent

- [ ] `fetchEvents()`'s historical-events call (the Wars & Conflicts side, `buildHistoricalEventsQuery`) is wrapped in its own try/catch, matching the existing per-bucket/per-batch pattern and the fix already landed for the inventions call in ticket 20, so one failed query can't crash the whole Fetch run.
- [ ] `buildHistoricalEventsQuery` gains the same `[minYear, maxYearExclusive)` era-bucketing parameter and date filter that `buildPeopleQuery` already has (and that ticket 20 adds to `buildInventionsQuery`), and `fetch-events.ts`'s wars call loops over buckets the same way.
- [ ] No date-range exclusion is added to the query — full history, no CDB90 carve-out (confirms ticket 21's planned 1600-1973 exclusion is correctly dropped, not just deferred).
- [ ] A live re-run of the Wars & Conflicts fetch completes end to end and produces `wars.json`, verified manually (not a mocked-network unit test) — spot-check that the published output actually contains a mix of wars, battles, treaties, and revolutions at the current `MIN_SITELINKS` floor, not just wars.
- [ ] `publish-data` is run and `packages/shared-types/src/data/wars.json` is verified against real fetched data (record count, spot-checked entries), not fixtures alone.
