# Wars & Conflicts taxonomy restructure

Label: wayfinder:map

## Destination

A restructured Wars & Conflicts pipeline, implemented and shipped with fresh data: categorization split into 9 type-specific SPARQL queries (war, battle, siege, military-operation, revolution, rebellion, coup-d'état, war-of-independence, peace-treaty), each with its own raw output file and its own tuned sitelink floor instead of one shared table; retagged onto a renamed `ConflictCategory` taxonomy (replacing `Category`, dropping the unused science/politics/art/philosophy/exploration/religion values); war and war-of-independence both render as range bars, everything else as points; generic "treaty" and generic "historical event" dropped entirely; `partOfWarName` removed from both War and WarEvent. Wars & Conflicts also gains `image`/`imageAttribution` (P18 + Commons enrichment, mirroring the People/Discoveries pattern), reversing the "no images for Wars & Conflicts" call made mid-effort on the Dynamic tooltips map — that call stood until 2026-08-08, when this map's user redrew the destination to include it. Ships as landed code plus a fresh live fetch/build/publish of Wars & Conflicts data (`npm run fetch`/`build-data`/`publish-data` for this lane).

## Notes

- **Domain**: `packages/data-pipeline` (fetch → transform → output stages, Wars & Conflicts lane only) + `packages/shared-types` (War/WarEvent/ConflictCategory contract) + `packages/web` (WarsLane.tsx fill color, detail-panel). Read `packages/data-pipeline/CLAUDE.md` + its `docs/` before touching fetch/transform/output. People and Discoveries & Inventions lanes are untouched by this effort.
- **This effort carries execution** — overriding wayfinder's plan-only default. Resolving a ticket means landing the code, not just writing up a decision. The final ticket runs the live pipeline and commits fresh output data.
- **Wikidata Q-IDs already confirmed live this session** (via `wbsearchentities` + SPARQL COUNT probes) — no need to re-research whether these classes exist:
  - Kept: war `Q198`, battle `Q178561`, siege `Q188055`, military-operation `Q645883`, revolution `Q10931`, rebellion `Q124734`, coup-d'état `Q45382`, war-of-independence `Q1006311`, peace-treaty `Q625298`.
  - Dropped: generic treaty `Q131569` (peace-treaty `Q625298` split out instead), generic historical-event `Q13418847`, declaration-of-war `Q334516` (only 1 item worldwide clears sitelinks≥20 — no real yield), armistice `Q107706` (0 items at the flat specialist floor of 70, and no threshold down to 20 sitelinks yields more than 10 candidates worldwide — decided while resolving "Per-category sitelink fame-tier floors").
- Existing color-palette methodology (hue-optimized against every existing People/Domain + Wars color) is precedented at `.scratch/events-inventions-curated-source/issues/01-discovery-category-color-palette.md` — follow the same approach for new ConflictCategory colors rather than re-deriving one.
- Use `/grilling` for the floor-tuning ticket. No `/domain-modeling` expected beyond what's already settled, unless a ticket surfaces new terminology worth recording.
- **Image sourcing for Wars & Conflicts** reuses the mechanism the Dynamic tooltips map already researched and shipped for People/Discoveries — `.scratch/dynamic-tooltips/research/image-sourcing.md` (P18 + `Special:FilePath?width=`, licensing-dependent Commons `imageinfo` attribution pass) and `.scratch/dynamic-tooltips/spec.md` §4 (field shape, wiring pattern). Don't re-derive the mechanism, only re-run the coverage estimate — Wars & Conflicts was explicitly excluded from that original research.

## Decisions so far

- [Per-category sitelink fame-tier floors](issues/01-per-category-sitelink-floors.md) — flat fetch=specialist=70/educated=90/generalPublic=100 across all 9 categories, no per-category tuning; armistice dropped from the taxonomy entirely (0 items at any usable floor).
- [Rename Category to ConflictCategory and expand to the 9-value taxonomy](issues/02-rename-expand-conflict-category.md) — landed: `Category`→`ConflictCategory`, 7 old values→9 new kebab-case ones, 9 new hue-optimized colors, `design-tokens.md`/`CONTEXT.md` updated. Type/contract/color layer only — `event-type-categories.ts`'s actual tagging logic (and its resulting 4 `tsc` errors) stays as-is for "Retag events onto ConflictCategory 1:1" to resolve.
- [Research P18/Commons image coverage for the new Wars & Conflicts categories](issues/10-research-wars-image-coverage.md) — 97.8% P18 coverage (89/91) at the specialist floor across all 9 categories; 36% of imaged items need attribution (vs. People/Discoveries' precedent), split across genuine modern press photos, Bundesarchiv's WWII donation, and modern maps/collages of old wars; recommend extending the 9 per-category SPARQL queries directly with `OPTIONAL wdt:P18`, no standalone pass.
- **Dedupe cross-category entities, first-occurrence-wins by category priority** — surfaced while running [the live pipeline](issues/09-run-pipeline-publish.md): a Wikidata item can carry more than one `instance of` claim (e.g. the 2022 Russo-Ukrainian escalation is both `war` and `military-operation`), so splitting the fetch into 9 independent per-category queries (unlike the old single combined query) let such an item clear more than one category and appear twice in `wars.json` under two different categories/shapes — 5 of the initial 89 items. Not anticipated by any of the 12 original tickets. Fixed with `transform/index.ts`'s `dedupeFirstById`, tiebroken by `CONFLICT_CATEGORY_QUERIES`' own order (war-family categories before political ones) — dropped the final count to 84.
- Ships as landed: all 12 tickets resolved, live pipeline run end-to-end, fresh data published and committed (2026-08-08).

## Not yet specified

- Whether the Wars & Conflicts lane needs a category legend/filter UI now that it has 9 colors instead of 2 (today `Category` only drives WarsLane.tsx fill color — no legend or filter reads it anywhere). Not sharp enough to ticket until the real per-category-floored data is live and the visual density can actually be judged.

## Out of scope

- Properly modeling multi-phase parent conflicts (the Crusades, Cold War proxy wars, etc.) as an umbrella over multiple sub-periods. Surfaced while deciding to drop `partOfWarName` (a single flat parent-name string misrepresents these); ruled out as its own future effort, not part of this taxonomy restructure.
- Armistice as a `ConflictCategory` value — surfaced while resolving [Per-category sitelink fame-tier floors](issues/01-per-category-sitelink-floors.md); at any floor that keeps every other category's methodology consistent, armistice yields 0-10 items worldwide. Dropped from the taxonomy rather than special-cased.
