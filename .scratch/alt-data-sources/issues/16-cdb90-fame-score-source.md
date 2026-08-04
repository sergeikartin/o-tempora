Type: grilling
Status: superseded by [24 — Wars source: reopened, Wikidata-only](24-wars-source-reopen-wikidata-only.md)

## Question

CDB90-sourced wars/battles have no sitelink data, and the pipeline's `FAME_TIER_MIN_SITELINKS` fame-tier system (`generalPublic: 100, educated: 50, specialist: 30`) applies to `wars.json` unchanged (the Output-stage split doesn't touch fame scoring — see [Split Wars/Events output](15-split-wars-events-output.md)). CDB90's DBpedia crosswalk (usable to look up a matching Wikidata entity's sitelinks) is only 62.7% filled overall, dropping to 37.7% for 20th-century wars.

How should CDB90 entries get a `fameScore`? Candidates raised so far:
1. A flat, fixed score at the `specialist` floor for every CDB90 entry (simple, no per-entry lookup, treats CDB90's ~600-battle curated list as uniformly "at least notable").
2. A DBpedia→Wikidata sitelink lookup for the ~63% of entries that have one, with a flat fallback for the rest (more accurate, but reintroduces a live Wikidata dependency for this specific lookup and more implementation complexity).

## Context

Surfaced while writing [the spec synthesizing this map](../spec.md) — not covered by any of the first 15 resolved tickets. Blocks any Wars-lane CDB90 implementation ticket drafted via `/to-tickets` (specifically ticket 21, "Wars: CDB90 hybrid integration").

## Answer

Flat score, not a DBpedia→Wikidata sitelink lookup — avoids reintroducing a live Wikidata dependency for only partial (63%) coverage, and CDB90's own curation already does the "is this notable" filtering fame tiers exist to approximate.

**Value: `fameScore = 100`** (the `generalPublic` floor), not 30 (`specialist`) as originally recommended — corrected because tiers nest the opposite way from what "visible at every tier" requires: `specialist` (floor 30) is the broadest/most-inclusive set, `generalPublic` (floor 100) is the narrowest. A score of 30 would only surface CDB90 entries once a viewer filters down to `specialist`; 100 guarantees every CDB90 entry is visible regardless of which fame tier is active — matching the intent that CDB90's curated list should always be visible, not tier-gated. The list can be expanded/re-scored later if deemed necessary, but that's a future decision, not part of this one.
