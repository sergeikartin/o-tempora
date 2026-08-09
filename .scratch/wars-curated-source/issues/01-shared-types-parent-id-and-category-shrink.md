# 01 — shared-types: `parentId` and `ConflictCategory` shrink

Type: task
Status: resolved

## Question

In `packages/shared-types/src/index.ts`:

- Shrink `CONFLICT_CATEGORIES`/`ConflictCategory` from nine values to six: `war`, `war-of-independence`, `revolution`, `rebellion`, `coup-d-etat`, `military-operation`. Remove `battle`, `siege`, `peace-treaty` entirely (not deprecated/left unused) — mirrors how Discoveries dropped `"invention"` from the old shared `Category` enum during its migration.
- Add optional `parentId?: string` to both `War` and `WarEvent`. Always resolves to another curated row's `id`, and that row is always a `War` (a Container or a level-2 sub-war), never a `WarEvent` — enforced at Output (ticket 03), not by the type itself.
- Update both interfaces' doc comments — `War`'s current comment ties bar-rendering to `BAR_RENDERED_TYPE_QIDS`/Wikidata `?type` claims, which is retired by this effort (see ticket 03); rewrite to describe the enrichment-driven shape rule instead.

Downstream, `tsc` will force every `ConflictCategory`-keyed color map/switch to be updated for the shrink:

- `packages/web/src/widgets/timeline-canvas/options.ts`'s `CONFLICT_CATEGORY_COLORS` — remove the three dropped categories' entries.
- `packages/web/src/widgets/timeline-canvas/options.test.ts` — update/remove any assertions referencing the dropped categories.
- Search for any other exhaustive `ConflictCategory` switch/map site (`grep -rn "ConflictCategory" packages/web packages/data-pipeline`) and confirm each compiles clean after the shrink — don't rely on `tsc` alone to find every site, some may be string-keyed objects that fail silently rather than at compile time.

Doc updates (`design-tokens.md`, `CONTEXT.md`, `product-scope.md`) for the removed categories are ticket 07's job, not this one — keep this ticket to types + compiler-forced code sites.

## Answer

`packages/shared-types/src/index.ts`: `CONFLICT_CATEGORIES` shrunk to the six values; `War`/`WarEvent` both gained optional `parentId?: string`, doc comments rewritten to describe the enrichment-driven shape rule (retiring the `BAR_RENDERED_TYPE_QIDS` reference) and the Container/nesting contract. `packages/web/src/widgets/timeline-canvas/options.ts`'s `CONFLICT_CATEGORY_COLORS` lost the three dropped categories' entries (24 colors total now, not 27); `tsc -b` confirmed no other compile-time site needed updating. `options.test.ts` needed no changes — it already iterates `CONFLICT_CATEGORIES` generically. `packages/web` typecheck and the `options.test.ts`/`WarsLane.test.ts` suites (18 tests) pass clean.
