Type: grilling
Status: open

# Region handling: what's actually unsatisfying

## Question

`shared/config/region.ts` already has a deliberate 6-value `Region` mapping from People's 22-value UN sub-region taxonomy (built in a prior grill-with-docs session, 2026-08-12 — see `region.ts:1-51`), with two documented best-fit approximations: Central Asia folded into Middle East, all of Oceania folded into East Asia. `CONTEXT.md` and `.scratch/sidebar-filters-legend/spec.md` already flag revisiting the Region value set itself as out of scope for that prior effort.

Sergei flagged "better region handling" on the punch list but, when asked directly what's wrong with it (chart-the-map grilling session), wasn't sure yet — chose "need to look together" rather than picking a specific complaint.

Resolve, working from the actual running app (not just the code) with Sergei:
- Is this a data/taxonomy complaint (the approximations themselves), a UI/filter-behavior complaint (how region pills look or combine with other filters in the sidebar), or something else entirely (e.g. a specific person/conflict visibly misclassified)?
- Once the actual complaint is identified, whether it's in scope for this launch or belongs in `docs/product-scope.md`'s Out-of-scope / a future effort.
