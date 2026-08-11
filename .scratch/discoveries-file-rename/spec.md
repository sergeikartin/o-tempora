Labels: backlog

# Rename Events & Inventions' curated file names from "events" to "discoveries"

## Problem Statement

The Events & Inventions lane's canonical public name is now "discoveries" (`.scratch/lane-scoped-fetch/spec.md`, root `CONTEXT.md`'s **Lane** entry) — matching the shipped output type/file (`Discovery`, `discoveries.json`, `DiscoveryCategory`). The pre-existing curated data files still carry the older "events" name: `data/raw/events-curated.raw.json` (the file a curator hand-edits to add a discovery) and `data/raw/events-curated-enriched.raw.json`.

## Solution

Rename the two curated data files only:
- `events-curated.raw.json` → `discoveries-curated.raw.json`
- `events-curated-enriched.raw.json` → `discoveries-curated-enriched.raw.json`

Update every reference to these two exact file paths (fetch stages, transform loaders, tests, ADRs, docs).

## Out of Scope

Deliberately narrow — this is a file-name-only rename, not a code-identifier rename:
- Code identifiers stay as-is: `fetchEventsEnrichment`, `CuratedEvent`, `EnrichedEvent`, `isCuratedEvent`, `validateEnrichedEventsFile`, the `events-enrichment.ts` query builder, etc. — none of these get renamed in this effort.
- No change to the `events` key name inside any in-memory or JSON object shape that isn't one of the two renamed files.

## Further Notes

Split out from `.scratch/lane-scoped-fetch/spec.md` per direct user steer during that spec's grilling session — worth doing, but deliberately not bundled into that effort's scope.
