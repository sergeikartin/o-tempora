Type: grilling
Status: resolved

# Region handling: what's actually unsatisfying

## Question

`shared/config/region.ts` already has a deliberate 6-value `Region` mapping from People's 22-value UN sub-region taxonomy (built in a prior grill-with-docs session, 2026-08-12 — see `region.ts:1-51`), with two documented best-fit approximations: Central Asia folded into Middle East, all of Oceania folded into East Asia. `CONTEXT.md` and `.scratch/sidebar-filters-legend/spec.md` already flag revisiting the Region value set itself as out of scope for that prior effort.

Sergei flagged "better region handling" on the punch list but, when asked directly what's wrong with it (chart-the-map grilling session), wasn't sure yet — chose "need to look together" rather than picking a specific complaint.

Resolve, working from the actual running app (not just the code) with Sergei:
- Is this a data/taxonomy complaint (the approximations themselves), a UI/filter-behavior complaint (how region pills look or combine with other filters in the sidebar), or something else entirely (e.g. a specific person/conflict visibly misclassified)?
- Once the actual complaint is identified, whether it's in scope for this launch or belongs in `docs/product-scope.md`'s Out-of-scope / a future effort.

## Answer

Landed on a data/taxonomy complaint: the two approximations (Central Asia folded into Middle East, Oceania folded into East Asia) plus the coarseness of the 6-value scheme itself. Sergei's call: override the original split-into-two-schemes decision (`.scratch/alt-data-sources/issues/13-region-taxonomy-mapping.md`) and unify `Region`/`UnRegion` onto one 22-value UN M49 scheme applied across all three lanes, in scope for this launch, implemented same-session. Investigation also surfaced an independent bug worth fixing in the same pass: `region-categories.ts` (Conflicts/Milestones' Wikidata Q-ID → region table) was missing 52 country Q-IDs entirely — not a taxonomy-coarseness issue, just an incomplete maintenance pass — closed as part of the rewrite. Sidebar's Region filter row now renders 22 pills instead of 6, using the existing flat wrapped-row layout (no new UI component).
