---
status: accepted
---

# Events & Inventions sources from a hand-curated list instead of a Wikidata SPARQL scan

The original Discoveries source (`inventions.ts`) ran a P575-only ("point in time") SPARQL candidate scan, the same corpus-scan pattern Wars & Conflicts still uses. In practice it produced junk top entries ("Brazil", "Antarctica") with no reliable signal to classify what actually counts as a discovery or invention — Wikidata has no equivalent of Wars' `wd:Q198` type filter for this lane. Rather than trying to harden the query, Discoveries switched to a checked-in, curator-verified list (`data/raw/events-curated.raw.json`, ~121 entries with `name`/`year`/`category`/`description`) as ground truth, backfilled with a batched per-QID SPARQL enrichment pass (`fetch-events-enrichment.ts`) for `sitelinks`/`wikipediaUrl`/`country`/image — the same secondary-enrichment pattern People uses over Pantheon.

Consequences: `Category` (Wars' Wikidata-derived taxonomy) dropped `"invention"`; a new disjoint `DiscoveryCategory` (`packages/shared-types`) replaces it for `Discovery.category`, tagged by straight passthrough of the curator's own value rather than a Wikidata Q-ID lookup table. Score also dropped Discoveries' specialist-floor ranking filter entirely (sort-only, no minimum) — the curated set is already hand-vetted, so the sidebar's user-facing fame-score floor is this lane's only density control, not a pipeline-side one.
