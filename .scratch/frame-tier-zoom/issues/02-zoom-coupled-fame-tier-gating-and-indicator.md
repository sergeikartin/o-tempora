# 02 — Zoom-coupled Fame Tier gates entity density, with a read-only indicator

**What to build:** Zooming the timeline automatically gates entity density by Fame Tier — no manual selector. Three contiguous `pixelsPerYear`-derived viewport bands (CORE 500↔150y, NOTABLE 150↔50y, EXHAUSTIVE 50↔10y) map 1:1 onto the existing `generalPublic`/`educated`/`specialist` Fame Tier values (`packages/web/docs/adr/0002-fame-tier-drives-zoom.md`). All three lanes — People, Wars & Conflicts, Events & Inventions — filter client-side against each entry's existing `fameScore` field for the active tier's threshold. A read-only label near the zoom controls shows the active tier (CORE/NOTABLE/EXHAUSTIVE). This supersedes Unit 9 (`features/filter-by-fame-tier`) outright — no user-facing manual fame control ships.

**Blocked by:** [[01-widen-pipeline-output-to-specialist-floor]] — the wider dataset has to exist before NOTABLE/EXHAUSTIVE tiers have anything extra to reveal.

**Status:** ready-for-agent

- [ ] `ZOOM_MAX_YEARS` widens from 250 to 500 in `shared/config/viewport.ts`; new Fame Tier boundary constants live alongside it.
- [ ] A pure derivation from `pixelsPerYear` (or the visible-years it implies) to the active Fame Tier value, covering all three bands and their boundaries, with tests.
- [ ] People, Wars & Conflicts, and Events & Inventions each render only entries whose `fameScore` clears the active tier's threshold (`FAME_TIER_MIN_HPI` for People, `FAME_TIER_MIN_SITELINKS_WARS`/`_DISCOVERIES` for Wars/Events) — verified by zooming through all three bands and confirming density steps up at each threshold, not just at the extremes.
- [ ] The People lane's fixed 4:1:1 flex ratio is unchanged across all tiers — no layout reflow on tier change.
- [ ] A read-only Fame Tier indicator (CORE/NOTABLE/EXHAUSTIVE) renders near the zoom controls, with no click/interaction affordance, and updates live as the user zooms.
- [ ] `docs/active-context.md`'s Unit 9 entry is confirmed closed/removed (already reflected in the working tree — verify it stays that way, don't reintroduce a manual selector).
- [ ] `packages/web/docs/code-conventions.md`'s Timeline Rendering section documents the Fame Tier derivation + filtering.
- [ ] `npm run typecheck --workspace packages/web`, `npm run test --workspace packages/web`, and `npm run lint --workspace packages/web` pass.
