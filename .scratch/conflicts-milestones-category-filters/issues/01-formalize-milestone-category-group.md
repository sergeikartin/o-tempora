# 01 — Formalize Milestone Category Group as a shared type

**What to build:** A single canonical `MilestoneCategoryGroup` type + leaf-to-group lookup, shared between the timeline's existing color logic and the upcoming Milestone Category Group filter (ticket 02), replacing the grouping that today exists only as three unexported local color constants. No user-visible change — the timeline's Milestone colors stay pixel-identical.

**Blocked by:** None — can start immediately

**Status:** done

- [x] `packages/shared-types` exports a new `MilestoneCategoryGroup` type with exactly 3 kebab-case values: `knowledge-culture`, `technology-industry`, `society-governance`.
- [x] `packages/shared-types` exports `MILESTONE_CATEGORY_TO_GROUP: Record<MilestoneCategory, MilestoneCategoryGroup>` covering all 20 `MilestoneCategory` values, matching the group assignments already documented in `docs/design-tokens.md`'s Milestone Category Palette table.
- [x] `MILESTONE_CATEGORY_GROUP_COLORS: Record<MilestoneCategoryGroup, string>` holds the same 3 hexes (`#4B4597` / `#008456` / `#BC8118`) previously only available as unexported local constants — deviation from spec below.
- [x] `options.ts`'s existing `MILESTONE_CATEGORY_COLORS` export is derived by composing `MILESTONE_CATEGORY_TO_GROUP` with `MILESTONE_CATEGORY_GROUP_COLORS` — its public shape and every value stay unchanged (still one hex per `MilestoneCategory`, still exactly 3 distinct hexes).
- [x] `ConflictsMilestonesLane.tsx` and every other existing consumer of `MILESTONE_CATEGORY_COLORS` needed no code changes — timeline rendering is pixel-identical before and after.
- [x] New `shared/config/milestone-category-group.ts` exports `MILESTONE_CATEGORY_GROUP_LABELS: Record<MilestoneCategoryGroup, string>` (`"Knowledge & Culture"`, `"Technology & Industry"`, `"Society & Governance"`), re-exported from `shared/config`'s barrel.
- [x] `MILESTONE_CATEGORY_TO_GROUP` is unit tested for full coverage — every one of the 20 `MilestoneCategory` values asserted to resolve to its documented group.
- [x] `options.test.ts`'s existing `MILESTONE_CATEGORY_COLORS` tests are updated (not left referencing removed private constants) to assert the same public facts via the new derivation.
- [x] `packages/shared-types` and `packages/web` typecheck, lint, and test suite pass.

## Comments

Implemented 2026-08-12. One deviation from the ticket's literal wording: `MILESTONE_CATEGORY_GROUP_COLORS` lives in `packages/web/src/shared/config/milestone-category-group.ts`, **not** exported from `widgets/timeline-canvas/options.ts` as the ticket originally specified. Reason: ticket 02's `MilestoneCategoryGroupFilters` pill component (a `features/` slice) needs the swatch colors, and mini-FSD's layer rule (`shared → features → widgets → app`) forbids `features/` importing from `widgets/`. Moved the color map to `shared/config`, mirroring the existing `DOMAIN_COLORS` precedent (`occupation-domain-colors.ts`, which lives in `shared/config` for the identical reason — both a widget and a feature need it). `options.ts` now imports `MILESTONE_CATEGORY_GROUP_COLORS` from `shared/config` to derive `MILESTONE_CATEGORY_COLORS`, rather than defining it locally. Public behavior and all values are unchanged from what the ticket specified.

**Follow-up (2026-08-12, same day):** the same move was later applied to `CONFLICT_COLOR` for the identical reason, once ticket 03's Conflicts pill also gained a color swatch — see ticket 03's Comments and `spec.md`'s Amendment section. It now lives in `shared/config/conflict-color.ts` instead of `options.ts`.
