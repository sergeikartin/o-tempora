# 03 — Conflicts visibility toggle

**What to build:** A single "Conflicts" pill (no color swatch) in the sidebar's "Conflicts & Milestones" section (create it if not already present). It starts pressed/active — Conflicts visible, matching today's behavior. Clicking it hides every Conflict from the timeline; clicking again restores them (subject to whatever Region/Fame Score filters are already active).

**Blocked by:** None — can start immediately

**Status:** done

- [x] New pure function `filterByVisibility<T>(items, visible)` added alongside the other filter functions in `map-to-items.ts` — returns items unchanged when `visible` is `true`, `[]` otherwise.
- [x] New `features/filter-conflicts-visibility/` slice: `model/useConflictsVisibility.ts` (`useState<boolean>` defaulting `true` + toggle setter) and `ui/ConflictsVisibilityToggle.tsx` (single plain pill, no swatch, `aria-pressed={conflictsVisible}`, visible label "Conflicts" — see this ticket's Comments for one accessibility-name adjustment).
- [x] The pill renders pressed/active by default — first page load shows every Conflict, unchanged from today.
- [x] Clicking the pill hides every Conflict; clicking again restores them.
- [x] Wired into `TimelineCanvas.tsx`'s Conflicts `useMemo` chain: fame floor → `filterByRegion` → `filterByVisibility`.
- [x] `App.tsx` lifts `useConflictsVisibility()` and threads state/setter to `Sidebar` and `TimelineCanvas`.
- [x] `Sidebar.tsx` renders a "Conflicts & Milestones" section containing `ConflictsVisibilityToggle` (section created jointly with ticket 02, landed in the same unit of work).
- [x] Toggling Conflicts visibility has no effect on Milestones or People — verified via manual smoke test in the dev app.
- [x] Combines via AND with Region and Fame Score — hiding then reshowing Conflicts still respects any active Region filter (filter chain composition).
- [x] New pure function is unit tested: `true` passes items through unchanged, `false` returns an empty array.
- [x] New Sidebar UI is component-tested (RTL): renders pressed by default, clicking fires the right callback, renders unpressed when `conflictsVisible` is `false`.
- [x] Toggling resets to the default (visible) on page reload (session-only, no persistence) — plain `useState`, no persistence wired.
- [x] `packages/web` typecheck, lint, and test suite pass.

## Comments

Implemented 2026-08-12, together with tickets 01 and 02 in one unit of work (see ticket 04's integration notes).

One deviation from the ticket text: the button's *visible* text is the plain "Conflicts" the ticket calls for, but its `aria-label` is `"Toggle Conflicts visibility"`, not bare `"Conflicts"`. Reason: the Data Depth section's fame-score input for Conflicts (`<label><span>Conflicts</span><input aria-label="Minimum fame score for Conflicts" /></label>`) resolves to the same bare accessible name `"Conflicts"` via its wrapping `<label>`, so two controls in the same sidebar would share one accessible name — ambiguous for `getByLabelText`-style queries and for screen-reader users navigating by name. Visible/pressed-state behavior is unchanged from spec.

**Follow-up (2026-08-12, same day):** the user asked to reverse this ticket's inverted-default/toggle-switch design and instead make the pill "behave like other pills," and separately asked for a color swatch. Both implemented — see `spec.md`'s "Amendment" section at the top for the full rationale. Net effect on this ticket's items above:
- The pill now starts **unpressed** (still Conflicts-visible by default — same end-user outcome, opposite `aria-pressed` polarity) and uses the same `pill`/`pillActive` border-style CSS every other filter pill uses, not the filled `DataDepthSwitch`-style swap.
- `aria-label` changed again, from `"Toggle Conflicts visibility"` to `"Filter by Conflicts"` — matches every other pill's `"Filter by X"` convention now that the pill no longer needs a bespoke label to dodge the collision described above (a `"Filter by X"` name never collided with the fame-score input's bare `"Conflicts"` to begin with).
- The pill gained a `CONFLICT_COLOR` swatch, reversing this ticket's "no swatch" item. `CONFLICT_COLOR` moved from `widgets/timeline-canvas/options.ts` to `shared/config/conflict-color.ts` to make it reachable from this `features/` slice (mirrors ticket 01's `MILESTONE_CATEGORY_GROUP_COLORS` move).
- `ConflictsVisibilityToggle.test.tsx` and `Sidebar.test.tsx` updated accordingly; full suite (213 tests), typecheck, lint, and Steiger boundaries re-verified green, and the change was re-smoke-tested live in the dev app.

**Follow-up 2 (2026-08-12, same day, supersedes Follow-up 1's whole approach):** the user clarified further that the entire "Conflicts & Milestones" section should be one multi-select filter like Region/Occupation Domain, not a separate Conflicts control (however styled) sitting next to ticket 02's group pills. This ticket's `features/filter-conflicts-visibility/` slice — `useConflictsVisibility`, `ConflictsVisibilityToggle`, both its CSS and test files — was **deleted outright**. "Conflicts" is now just one more pill inside `features/filter-conflicts-milestones/`'s `ConflictsMilestonesFilters` component (ticket 02's slice, itself renamed/expanded — see its Comments), toggled via the same shared `ConflictsMilestonesFilterValue[]` array and `useConflictsMilestonesFilter` hook every other value in that list uses. The pure function `filterByVisibility<T>(items, visible: boolean)` was likewise replaced by `filterConflictsByFilterValues<T>(items, selectedValues: ConflictsMilestonesFilterValue[])`, keyed on whether `'conflicts'` is present in the shared selection rather than taking its own independent boolean. See `spec.md`'s "Amendment 2" for the full rationale and `TimelineCanvas.tsx`'s single `selectedConflictsMilestonesValues` prop for the wiring.
