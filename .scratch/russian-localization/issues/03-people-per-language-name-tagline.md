# 03 — People: per-language name (new fetch) + tagline

**What to build:** People gets a brand-new Wikidata-label fetch pass, keyed by the existing `wd_id` column, replacing Pantheon's CSV `name` column as the field's source — plus a Russian binding added to the existing tagline enrichment query. Output: `people.json` + `people.ru.json`, same shape/fallback guarantees as Conflicts/Milestones.

**Blocked by:** 01

**Status:** done

**Status:** ready-for-agent

- [ ] A new batched, `wd_id`-keyed SPARQL enrichment pass fetches `rdfs:label` in both `en` and `ru` for every People row. This entirely replaces Pantheon's CSV `name` column as the source of the `name` field — People has no such fetch today (its only existing Wikidata pass is `tagline` + image).
- [ ] The existing People tagline enrichment query gains a parallel Russian binding, same pattern as Conflicts/Milestones (ticket 01/02).
- [ ] Pipeline output produces `people.json` + `people.ru.json` with the same entity set and per-field fallback guarantees established in ticket 01.
- [ ] Pipeline tests cover the new label fetch pass (label present, label missing, malformed response) and fallback behavior, mirroring ticket 01's coverage.
- [ ] No re-validation of the spec's Pantheon-vs-Wikidata name spot check is required here — this ticket proceeds on that already-accepted tradeoff (names now reflect Wikidata's current state, not Pantheon's snapshot date).
