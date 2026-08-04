Type: research
Status: superseded by [24 — Wars source: reopened, Wikidata-only](24-wars-source-reopen-wikidata-only.md)

## Question

Does CDB90 (https://github.com/jrnold/CDB90) expose war-level start/end dates directly, or only per-battle dates (the `time` column plus `war`/`cow_warno`/`cow_warname` grouping fields)? If only per-battle, is deriving a war's date range from the min/max battle date within that war group a reasonable approach given the app's Wars lane renders wars as range bars with battles/treaties as points linked to a parent war (`partOfWarName`)?

Also confirm: exact license terms for the derived/cleaned CSVs (repo states code is BSD-3-Clause, data is ODC-BY, original CDB90 data is public domain — verify this is redistribution-safe for a shipped static app) and whether the DBpedia links provide a usable crosswalk to anything the app needs.

## Context

Blocks: Wars-lane war-range-bar modeling for the CDB90-covered 1600-1973 segment — see [Wars source: CDB90 hybrid](../issues/02-wars-source-cdb90-hybrid.md).

## Answer

Full findings: [research/cdb90-war-ranges.md](../research/cdb90-war-ranges.md).

**Correction (found during ticket 09's grilling, not by the original research agent):** the "no war-level dates anywhere" conclusion below is wrong. `battles.csv`'s `war4` column ("new war classification... names are in the style of COW wars", type `string`) embeds a `War Name of START-END` or `War Name of YEAR` pattern in its actual string values — e.g. `"Franco-Prussian War of 1870-1871"`, `"Changkufeng War of 1938"`. Verified directly: populated for all 660 rows, 64 distinct wars, 63/64 cleanly regex-parseable for start/end year (one data-entry typo: `"World War II of 1939-194"`, missing the final digit). The original research agent read the schema's terse description without inspecting the actual values, and missed this. Native (year-precision) war-level ranges are available via `war4` parsing — no derivation from `battle_durations.csv` is needed after all. See [ticket 09](../issues/09-cdb90-war-range-derivation.md) for the resulting decision.

- **No war-level dates exist anywhere in CDB90.** `battles.csv`'s `time` column is a tactical boolean ("did defender's posture change over time?"), not a date — confirmed against the repo's own schema doc. Real per-battle datetimes live in a separate file, `data/battle_durations.csv` (ISO-8601, sub-day precision), joined via `isqno`.
- **Min/max-per-war derivation works but has real caveats.** 65 distinct wars (by free-text `war` field); 48 have multiple battles (derivation meaningful), 17 are single-battle (degenerates to a zero-width point, needs a fallback — e.g. pad by N months or render as a point instead of a range bar). Spot-checked derived ranges consistently *undershoot* the true historical war span (e.g. Thirty Years' War: derived 1620–1648 vs. actual 1618–1648) since CDB90 only catalogs major battles, not declaration/armistice dates.
- **License confirmed clean:** data under `data/` is ODC-BY (attribution required), original NTIS/DTIC source is public domain, no root `LICENSE` file (README + `datapackage.json` agree). No redistribution blocker — attribution credit is the only obligation.
- **DBpedia crosswalk confirmed live**, but per-battle only, not per-war: 62.7% of battles have a `dbpedia` URI (drops to 37.7% for WWI/WWII/Arab-Israeli wars), and `owl:sameAs` resolves correctly to real Wikidata entities (spot-checked on 2 samples). No war-level identifier or crosswalk exists in the dataset at all.
- **No separate wars table exists** anywhere in the repo (published or staging) — confirmed via full repo tree listing.
