Type: grilling
Status: resolved

# Data depth: collapse three tiers to two

## Question

`shared/config/viewport.ts`'s `DATA_DEPTH_LEVELS` currently defines three presets over the per-lane fame-score floors (`FAME_SCORE_LANES`: people/conflicts/milestones):

- `curated`: people≥90, conflicts≥82, milestones≥82 (== today's launch defaults, `FAME_SCORE_BOUNDS.default`)
- `expanded`: 85/70/70
- `full`: 80/1/1

Sergei wants two tiers, not three, but (chart-the-map grilling session) picked "fresh 2-level split" over keeping either existing pair as-is — the replacement values aren't decided.

Resolve:
- The two tiers' ids/labels (`taxonomy.data-depth.*` message keys) and their per-lane numeric floors.
- Whether `curated`'s values (today's app defaults) are preserved as one of the two tiers, or the defaults themselves are also up for revision.
- Update `DataDepthSwitch.tsx`'s rendering (currently maps `DATA_DEPTH_LEVELS` generically, so no code change needed there beyond the config) and `matchDataDepthLevel`'s tests/fixtures that assume three levels.

## Resolution (2026-08-18 grill-with-docs session)

Two tiers, `Mainstream` / `Deep Cut` (`Мейнстрим` / `Для знатоков`):

- `mainstream`: people 88, conflicts 82, milestones 82 — becomes the new launch default (`FAME_SCORE_BOUNDS.people.default` moved 90 → 88 to match; conflicts/milestones defaults were already 82).
- `deep-cut`: people 80, conflicts 64, milestones 55.

Implemented in `shared/config/viewport.ts`, `DataDepthSwitch.tsx`'s tests, `messages/{en,ru}.json`, and `CONTEXT.md`'s Data Depth glossary entry.
