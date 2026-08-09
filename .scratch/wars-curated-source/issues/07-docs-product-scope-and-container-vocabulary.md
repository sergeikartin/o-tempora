# 07 — Docs: product-scope corrections, Container vocabulary, palette cleanup

Type: task
Status: open
Blocked by: 01, 03

## Question

- `docs/product-scope.md`: correct "Wars & Conflicts (wars as range bars, battles/treaties as points, linked to their parent war when known)" — the `partOfWarName` mechanism it describes was already removed (see `.scratch/wars-conflicts-taxonomy/map.md`); rewrite to describe the real `parentId`/Container model. Also correct "Wars & Conflicts... from Wikidata" — no longer fully accurate once sourced from a curated list plus Wikidata enrichment (mirror how the Discoveries line already reads, if it was adjusted during that migration).
- `packages/web/docs/design-tokens.md`: remove the `battle`/`siege`/`peace-treaty` rows from the Conflict Category Palette table (War/Military operation/Revolution/Rebellion/Coup d'état/War of independence stay). Update the palette's intro paragraph if it references "27 colors total" or similar counts that no longer hold after the shrink.
- Root `CONTEXT.md` and `packages/data-pipeline/CONTEXT.md` (if present) — same "linked to parent war"/"from Wikidata" correction as `product-scope.md`, applied wherever they restate the same claims.
- New ADR recording this migration, mirroring [ADR 0008](../../packages/data-pipeline/docs/adr/0008-discoveries-sourced-from-curated-list-not-wikidata-query.md)'s shape: `packages/data-pipeline/docs/adr/0009-wars-sourced-from-curated-list-plus-container-nesting.md`. Record the decision to source Wars from a curated QID list enriched from Wikidata (not curator-authored description/dates, unlike Discoveries), the six-value category shrink, and the `parentId`/Container nesting model — and explicitly note where this diverges from Discoveries' precedent (no reusable bootstrap/source-merge tooling, no curator-authored description/dates) so a future reader doesn't assume full parity between the two migrations.
- Record "Container" (a top-level, parent-less `War` that other rows can nest under) as project vocabulary — either in the new ADR above or `packages/data-pipeline/docs/code-conventions.md`, wherever this repo's other domain terms of this kind already live.

## Answer
