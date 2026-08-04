# 21 — Wars: CDB90 hybrid integration

**Superseded by [24 — Wars source: reopened, Wikidata-only](24-wars-source-reopen-wikidata-only.md).** Never implemented — no code exists that needs unwinding. Replaced by [25 — Wars & Conflicts: Wikidata reliability fixes and live re-fetch](25-wars-wikidata-reliability.md).

**What to build (superseded):** `wars.json` combines CDB90-sourced wars and battles for 1600–1973 (with accurate war-level date ranges parsed directly from CDB90's data) with Wikidata-sourced wars for the rest of history, with no duplicate wars between the two sources.

**Blocked by:** 18 — Output: split into wars.json/discoveries.json. (Previously also blocked by wayfinder decision ticket [CDB90 fame-score source](16-cdb90-fame-score-source.md) — now resolved: flat `fameScore = 100` for every CDB90 entry.)

**Status:** superseded

- [ ] A download script fetches CDB90's `battles.csv` (public, unauthenticated) and writes it as a raw snapshot checked into git.
- [ ] A typed raw-row shape for the CDB90 CSV (covering only the columns consumed: `isqno`, `name`, `war4`, `dbpedia`) is validated at the Fetch boundary.
- [ ] War-level date ranges are parsed directly from the `war4` column's embedded `"War Name of START-END"` pattern, with the known truncated-year row (`"World War II of 1939-194"`) corrected.
- [ ] Individual CDB90 battles map to point `HistoricalEvent`s with `partOfWarName` linking to their parsed parent war, mirroring the existing Wikidata-sourced battle/treaty pattern.
- [ ] CDB90-sourced entries get a flat `fameScore` of 100 (the `generalPublic` floor), so the curated list is visible at every fame tier.
- [ ] The existing Wikidata Wars query excludes the 1600–1973 window CDB90 now covers, so the same historical war never appears twice in `wars.json`.
- [ ] A data-license notice records ODC-BY attribution for CDB90-derived fields.
- [ ] Regenerating `wars.json` end to end shows CDB90-sourced entries for 1600–1973 (e.g. the Thirty Years' War spans 1618–1648) and Wikidata-sourced entries outside that range, with no duplicates.
- [ ] Fixture-based unit tests cover the `war4`-parsing function (standard range, single-year, the known typo case) — no network I/O in tests.
