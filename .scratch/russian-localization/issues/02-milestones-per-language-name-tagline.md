# 02 — Milestones: per-language name + tagline

**What to build:** The same treatment as ticket 01, applied to Milestones — `milestones.json` + `milestones.ru.json`, Wikidata-sourced `name` (en+ru) and a Russian `tagline` binding, with per-field English fallback.

**Blocked by:** 01

**Status:** done

**Status:** ready-for-agent

- [ ] Milestones' curated `name` field is no longer read by the pipeline; `name` is fetched from Wikidata's `rdfs:label` for both `en` and `ru`, via the same batched per-QID SPARQL enrichment pass already used for `tagline`/sitelinks.
- [ ] `tagline` gains a parallel Russian binding, same pattern as Conflicts (ticket 01).
- [ ] Pipeline output produces `milestones.json` + `milestones.ru.json` with the same shape and fallback guarantees established in ticket 01.
- [ ] The existing curated file's hand-typed `name` values are left on disk, unused, not deleted.
- [ ] Pipeline tests mirror ticket 01's coverage (Russian present / missing-falls-back-to-English / identical entity sets) for Milestones.
