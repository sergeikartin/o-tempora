# 20 — Discoveries & Inventions: Wikidata reliability fixes

**What to build:** A live pipeline Fetch run for Discoveries & Inventions completes reliably against the Wikidata Query Service, without the crash or the failure modes documented in the most recent broken run.

**Blocked by:** 18 — Output: split into wars.json/discoveries.json (this ticket's output target is `discoveries.json`).

**Status:** ready-for-agent

- [ ] `runSparqlQuery` retries HTTP 502/503/504 with exponential backoff, in addition to the existing 429 handling.
- [ ] The Discoveries & Inventions fetch function wraps each of its query calls in try/catch, matching the existing per-bucket/per-batch pattern used elsewhere, so one failed query no longer crashes the whole Fetch run.
- [ ] The client-side request timeout is raised toward Wikidata's documented 60-second hard deadline.
- [ ] The historical-events and inventions query builders gain era-bucketing (a `[minYear, maxYearExclusive)` parameter and matching date filter), and the fetch loop iterates over buckets.
- [ ] A live re-run of the Discoveries & Inventions fetch completes end to end and produces `discoveries.json`, verified manually (not a mocked-network unit test).
