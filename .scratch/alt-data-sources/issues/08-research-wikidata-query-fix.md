Type: research
Status: resolved

## Question

What's actually causing the Wikidata Query Service failures documented in `CLAUDE-activeContext.md` (widespread 502s/timeouts across most era buckets during the most recent Fetch re-run, plus an uncaught crash in `fetch-events.ts`'s `fetchEvents` on the first-page case)? Look at the existing query builders in `packages/data-pipeline/fetch/queries/` and the paginated SPARQL client. Research Wikidata Query Service best practices/limits (timeout thresholds, query complexity limits, recommended batching) and identify concrete, low-risk redesign options for the query/pagination/retry strategy that would apply to whatever stays on live SPARQL (Wars outside 1600-1973, Events & Inventions unless Vetustas fully replaces it).

## Context

This is the concrete follow-through on the "cook the query, don't switch to a bulk dump" decision — see [Wikidata reliability approach](../issues/04-wikidata-reliability-approach.md).

## Answer

Full findings: [research/wikidata-query-fix.md](../research/wikidata-query-fix.md).

Two independent problems, not one:

1. **The crash** — `fetch-events.ts`'s `fetchEvents()` has no try/catch around either `fetchAllPages` call (`fetch-events.ts:17-31`), unlike `fetchPeople()` and `fetchReigns()` which both already guard per-bucket/per-batch. Straightforward missing-error-handling bug.
2. **The 502s/timeouts** — ambient, documented WDQS instability (Blazegraph deadlocks, per WMF's own runbook), not something guaranteed fixable by rewriting queries. But the codebase's retry logic (`wikidata-client.ts:20-48`) only retries HTTP 429, never 502/503/504 — exactly the error class WMF's own guidance says to retry with exponential backoff. That gap is the highest-leverage fix. Also found: the client's 30s timeout is half of Wikidata's documented 60s hard deadline, so some "failures" are self-inflicted early aborts.

Query shapes already follow most WMF optimization guidance (fixed-value predicates, no `ORDER BY`, no `SERVICE wikibase:label`, no unbounded transitive walks); the main gap is high `OPTIONAL`-clause counts (6-7 per query) and that the events/inventions queries have no era-bucketing at all, unlike people.

**Redesign options, priority order:** (1) retry 502/503/504 with exponential backoff, (2) add the missing try/catch in `fetchEvents`, (3) raise client timeout toward 60s, (4) era-bucket the events queries like people already are, (5) add the missing inter-bucket delay in `fetch-people.ts`, (6) reduce `OPTIONAL` clause count via a split core/enrichment query. Off-peak scheduling explicitly not recommended (no official guidance supports it).
