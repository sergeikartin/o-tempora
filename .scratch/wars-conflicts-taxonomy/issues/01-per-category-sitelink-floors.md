# Per-category sitelink fame-tier floors

Type: grilling
Status: resolved

## Question

Today one shared floor table (`FAME_TIER_MIN_SITELINKS_WARS` in `transform/score.ts`: generalPublic≥100, educated≥50, specialist≥30) applies uniformly across every event type, and `MIN_SITELINKS=30` (`fetch/queries/min-sitelinks.ts`) mirrors the specialist floor at fetch time. The map's destination replaces this with a **per-category** floor table, one set of thresholds per `ConflictCategory` value, because the types have wildly different noise profiles at the same floor.

Real sitelink-count distributions gathered live this session (Wikidata, `sitelinks >= 30` unless noted):

| Category | QID | n≥100 | n≥50 | n≥30 | n≥20 | max |
|---|---|---|---|---|---|---|
| war | Q198 | 36 | 163 | 316 | – | 175 |
| battle | Q178561 | 1 | 104 | 463 | – | 108 |
| siege | Q188055 | 0 | 15 | 94 | – | 80 |
| military-operation | Q645883 | 19 | 39 | 90 | – | 175 |
| revolution | Q10931 | 9 | 37 | 55 | – | 193 |
| rebellion | Q124734 | 1 | 25 | 89 | – | 112 |
| coup-d'état | Q45382 | 0 | 7 | 20 | 53 | 76 |
| war-of-independence | Q1006311 | 1 | 7 | 16 | 17 | 114 |
| peace-treaty | Q625298 | 1 | 25 | 90 | 161 | 135 |
| armistice | Q107706 | 0 | 2 | 5 | 10 | 52 |

Note: war/battle/siege/military-operation/revolution/rebellion rows come from the existing `data/raw/events-historical.raw.json` corpus (already floor-30-filtered at fetch time, so n≥30 == total fetched — true population above 30 sitelinks isn't visible from this file alone, only n≥50/n≥100 are trustworthy cuts within it). coup-d'état/war-of-independence/peace-treaty/armistice come from fresh unbucketed COUNT/list probes against the live query service.

Decide, per category, the fetch-time floor (feeds ticket "Split fetch into per-category queries") and the score-time specialist/educated/generalPublic floors (feeds ticket "Per-category floor tables in score.ts"). The goal is trimming battle/siege/peace-treaty-style long tails (hundreds of obscure items) while not over-pruning already-small categories like coup-d'état/war-of-independence/armistice down to near-nothing.

## Answer

Grilled live, with a research subagent pulling finer live-Wikidata histograms (direct `wdt:P31`, sitelink thresholds 20-100) than the coarse table this ticket opened with, since 20/30/50/100 wasn't enough resolution to see e.g. battle's real tail shape.

**Decision: flat floors across every surviving category** — fetch floor = specialist floor = 70, educated = 90, generalPublic = 100, for all of them. No per-category tuning: population-size differences between categories (battle's 16 at specialist vs. coup-d'état's 1) are accepted as real signal about how much genuinely notable material Wikidata holds for each event type, not something to correct for by loosening thin categories' floors. Near-empty upper tiers (siege/coup-d'état both 0 at educated/generalPublic) are explicitly fine — the tier system stays uniform even where a category barely populates it.

| Category | fetch = specialist | educated | generalPublic | population (specialist/educated/generalPublic) |
|---|---|---|---|---|
| war | 70 | 90 | 100 | 40 / 19 / 10 |
| battle | 70 | 90 | 100 | 16 / 2 / 1 |
| siege | 70 | 90 | 100 | 2 / 0 / 0 |
| military-operation | 70 | 90 | 100 | 7 / 4 / 4 |
| revolution | 70 | 90 | 100 | 11 / 7 / 6 |
| rebellion | 70 | 90 | 100 | 5 / 1 / 1 |
| coup-d'état | 70 | 90 | 100 | 1 / 0 / 0 |
| war-of-independence | 70 | 90 | 100 | 3 / 1 / 1 |
| peace-treaty | 70 | 90 | 100 | 6 / 2 / 1 |

**Armistice (`Q107706`) is dropped from `ConflictCategory` entirely**, not floor-tuned — at the flat-70 floor it returns 0 items at every tier (not just "sparse" like siege/coup-d'état, which still clear >0 at specialist), and no threshold down to 20 sitelinks yields more than 10 candidates worldwide. An enum value that can never carry data is a scope call, not a floor call. This drops the taxonomy from 10 categories to 9 and ripples into two other tickets (rename/expand and region-mapping), updated accordingly.

Feeds: "Split fetch into per-category queries" (fetch floors above) and "Per-category floor tables in score.ts" (specialist/educated/generalPublic above).
