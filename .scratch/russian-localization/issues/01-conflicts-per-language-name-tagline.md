# 01 — Conflicts: per-language name + tagline (foundation)

**What to build:** The data pipeline produces `conflicts.json` + `conflicts.ru.json`, with `name` switched from curator-typed text to Wikidata's `rdfs:label` (fetched in both `en` and `ru`) and `tagline` extended with a Russian binding alongside the existing English one — each field falling back to English when the Russian value doesn't resolve. This establishes the parallel-output-file and per-field-fallback pattern the rest of this feature reuses.

**Blocked by:** None — can start immediately

**Status:** done

- [ ] Conflicts' curated `name` field is no longer read by the pipeline; `name` is fetched from Wikidata's `rdfs:label` for both `en` and `ru`, via the same batched per-QID SPARQL enrichment pass already used for `tagline`/sitelinks.
- [ ] `tagline`'s existing English-only SPARQL binding gains a parallel Russian binding, same query shape.
- [ ] Pipeline output for Conflicts produces two parallel JSON files (English, Russian) with identical entity sets (same drop/inclusion rules as today) and an unchanged `TimelineEntry`/`Conflict`/`ConflictEvent` shape.
- [ ] Fallback resolution (Russian value if present, else English) happens in the pipeline at output time and is baked into the Russian file — not resolved at runtime.
- [ ] The existing curated file's hand-typed `name` values are left on disk, unused, not deleted.
- [ ] Pipeline tests cover: Russian name/tagline present, Russian name/tagline missing (falls back to English), and both output files sharing the same entity set.
