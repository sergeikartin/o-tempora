# 08 — Domain docs, ADR, and product-scope rollout update

**What to build:** Project docs are brought up to date with the shipped Russian-localization feature — scope doc, domain glossary, ADR history, and pipeline docs.

**Blocked by:** 07

**Status:** done

- [ ] `docs/product-scope.md`'s "In scope" list and success criteria are updated to include the Russian build as part of v1 (not a deferred/out-of-scope item), including a defined Russian-dataset-completeness bar (the spec left this open — e.g. whether "top 200 people" applies per-language or the English set is the floor).
- [ ] Root `CONTEXT.md` gains glossary entries for the new domain concepts this feature introduced (e.g. the per-language dataset split, per-field fallback resolution), following the existing glossary entries' format and `_Avoid_` convention.
- [ ] A new ADR records: retiring curator-typed `name` for Conflicts/Milestones in favor of Wikidata's `rdfs:label`; switching People's `name` off Pantheon's CSV onto the same source; and the new `ru.wikipedia.org` live dependency alongside the existing `en.wikipedia.org` one.
- [ ] `packages/data-pipeline/CLAUDE.md`'s pipeline description and stack table are updated to reflect the new fetch passes (per-language labels, per-language tagline, Russian Wikipedia extracts) and the new dependency.
