# 03 — Occupation Domain becomes a clickable filter

**What to build:** Clicking a Legend pill toggles that Occupation Domain in or out of an active filter set for the People lane. Multiple domains can be active at once (a person matching any active domain stays visible); with no domains active, People is unfiltered by domain. This combines with AND against the existing fame-score floor — a person must clear both to stay visible.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Each Legend pill is an interactive toggle (clickable/keyboard-operable, `aria-pressed` or equivalent), not decorative-only.
- [ ] An active pill is visually distinguishable from an inactive one (not relying on the domain color swatch alone).
- [ ] Selecting zero domains shows the full People lane, unfiltered by domain (existing fame-floor filtering still applies).
- [ ] Selecting one or more domains shows only people whose `occupationDomain` matches at least one selected domain (OR across selections).
- [ ] The domain filter combines with the existing fame-score floor via AND — a person must pass both to be visible.
- [ ] Conflicts and Milestones are unaffected — this field doesn't exist on those lanes.
- [ ] New pure function (alongside the existing `filterByFameScore`) is unit tested: empty selection returns items unchanged, non-empty selection keeps only matching items, OR semantics across multiple selected domains.
- [ ] New Sidebar UI is component-tested (RTL): renders pills reflecting given active domains, clicking a pill fires the right callback with the right domain.
- [ ] Selecting domains resets on page reload (session-only state, no persistence) — same as the existing fame-score filter.
- [ ] `packages/web` typecheck, lint, and test suite pass.
