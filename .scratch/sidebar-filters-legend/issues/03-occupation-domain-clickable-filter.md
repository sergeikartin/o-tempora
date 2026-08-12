# 03 — Occupation Domain becomes a clickable filter

**What to build:** Clicking a Legend pill toggles that Occupation Domain in or out of an active filter set for the People lane. Multiple domains can be active at once (a person matching any active domain stays visible); with no domains active, People is unfiltered by domain. This combines with AND against the existing fame-score floor — a person must clear both to stay visible.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Each Legend pill is an interactive toggle (clickable/keyboard-operable, `aria-pressed` or equivalent), not decorative-only.
- [x] An active pill is visually distinguishable from an inactive one (not relying on the domain color swatch alone).
- [x] Selecting zero domains shows the full People lane, unfiltered by domain (existing fame-floor filtering still applies).
- [x] Selecting one or more domains shows only people whose `occupationDomain` matches at least one selected domain (OR across selections).
- [x] The domain filter combines with the existing fame-score floor via AND — a person must pass both to be visible.
- [x] Conflicts and Milestones are unaffected — this field doesn't exist on those lanes.
- [x] New pure function (alongside the existing `filterByFameScore`) is unit tested: empty selection returns items unchanged, non-empty selection keeps only matching items, OR semantics across multiple selected domains.
- [x] New Sidebar UI is component-tested (RTL): renders pills reflecting given active domains, clicking a pill fires the right callback with the right domain.
- [x] Selecting domains resets on page reload (session-only state, no persistence) — same as the existing fame-score filter.
- [x] `packages/web` typecheck, lint, and test suite pass.

## Answer

Legend pills in `Sidebar` are now real `<button>` toggles (moved into a new `features/filter-by-occupation-domain` slice — `model/useOccupationDomainFilter.ts` owns the `selectedDomains: OccupationDomain[]` set and a toggle setter; `ui/OccupationDomainFilters.tsx` renders them, active state shown via `aria-pressed` plus a border/background style change, not swatch color alone).

`filterByOccupationDomain<T extends { occupationDomain: OccupationDomain }>(items, selectedDomains)` added alongside `filterByFameScore` in `map-to-items.ts`; empty selection returns items unchanged, non-empty keeps items whose domain is in the selected set (OR). Wired into `TimelineCanvas.tsx`'s existing People `useMemo` chain (fame floor → domain filter), state lifted in `App.tsx` and passed to both `Sidebar` and `TimelineCanvas`.

Verified: `packages/web` typecheck, lint, `lint:boundaries` (Steiger), and the full test suite (196 tests total across all of tickets 03–05) all pass; manually confirmed in the running dev app that toggling a domain pill narrows the People lane correctly while Conflicts/Milestones stay unaffected.
