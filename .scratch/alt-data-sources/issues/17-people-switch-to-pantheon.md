# 17 — People: switch to Pantheon

**What to build:** Regenerating the People dataset pulls from Pantheon 2.0 instead of Wikidata — a downloaded, checked-in raw CSV snapshot maps into `Person` records with occupation-domain and UN-region tagging and HPI-based fame tiers, and the old Wikidata-based People fetch path is removed.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A download script fetches Pantheon's 2025 Person Dataset (public, unauthenticated `.csv.bz2`), decompresses it, and writes the plain CSV as a raw snapshot checked into git (not the compressed `.bz2`), matching the existing raw-file convention (precedent: the existing `people.raw.json` raw snapshot is already 24MB committed at HEAD, so this isn't a departure in scale).
- [ ] A typed raw-row shape for the Pantheon CSV (covering the columns actually consumed) is validated at the Fetch boundary before Transform touches it.
- [ ] `OccupationDomain` (8 values) and `UnRegion` (22 UN M49 sub-regions) types are added to shared-types; `Person.category`/`occupationTags` are replaced by a single `occupationDomain` field, and `Person.regionTags` retypes to `UnRegion[]`.
- [ ] A hardcoded `bplace_country`/`dplace_country` → `UnRegion` lookup table, built from a one-time call to Pantheon's `/country` endpoint, joins on ISO country code rather than raw country-name strings.
- [ ] `Person.fameScore` is populated directly from Pantheon's `hpi` field; a new `FAME_TIER_MIN_HPI` constant (90/85/75) applies People-lane fame tiers, independent of the existing sitelink-based constant (which continues to apply to Wars/Discoveries).
- [ ] Regenerating `people.json` end to end (download → fetch → transform → output) produces real Pantheon-sourced entries with correct occupation domain, region tags, and fame tier for a handful of spot-checked known figures.
- [ ] The old Wikidata-based People fetch code (query builder, fetch loop, era-bucketing) is deleted as dead code.
- [ ] A data-license notice records CC BY-SA 4.0 attribution for Pantheon-derived fields, citing Yu et al. 2016.
- [ ] Fixture-based unit tests cover the Pantheon-row-to-`Person` mapping (normal row, BCE year, unmapped occupation, unmapped country) and the HPI tier-nesting behavior — no network I/O in tests.
