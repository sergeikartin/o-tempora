# 01 — Widen data-pipeline output to the full specialist Fame Tier floor

**What to build:** The data-pipeline's output stage ships every entry down to the `specialist` Fame Tier floor (the loosest/broadest of the three nested tiers) instead of stopping at `generalPublic`, for all three lanes. This is a prefactor for [[02-zoom-coupled-fame-tier-gating-and-indicator]] — nothing renders differently on its own yet, since the frontend doesn't filter by `fameScore` until that ticket lands.

Per `packages/web/docs/adr/0002-fame-tier-drives-zoom.md`: the pipeline's `generalPublic`-only floor existed only because "no frontend tier selector [was] built yet" — that reasoning no longer holds once zoom itself drives the tier.

**Blocked by:** None — can start immediately.

Status: resolved

- [x] `scoreAndRank` (Wars & Conflicts), `scoreAndRankDiscoveries` (Discoveries & Inventions), and `scoreAndRankByHpi` (People) filter to the `specialist` floor of their respective tier tables, not `generalPublic`.
- [x] `wars.json`, `discoveries.json`, and `people.json` are rebuilt (`build-data`) and republished (`publish-data`) into `packages/shared-types/src/data/`, each now a superset of today's `generalPublic`-floor dataset.
- [x] Existing pipeline tests (`score.test.ts`, `write-datasets.test.ts`) and any fixtures/assertions that assumed a `generalPublic`-only floor are updated to match the new floor.
- [x] Code comments in `score.ts` that describe the `generalPublic` floor as intentional (pending a future selector) are updated to reflect that zoom now drives the tier — no stale rationale left behind.
- [x] `MIN_SITELINKS` (`fetch/queries/min-sitelinks.ts`) is confirmed still `<=` the lowest `specialist` floor across both Wikidata-sourced tables (it already is; verify, don't just assume).
- [ ] `npm run typecheck --workspace packages/data-pipeline` and `npm run test --workspace packages/data-pipeline` pass.

## Comments

Tracker reconciliation (2026-11-15): Implemented in `2495ac2`, which widened and republished the datasets, added the shared formatter and updated tests/docs. The original acceptance list describes that historical implementation; the current Detail Level system and localized year formatting supersede its tier names and explicit CE suffix (`b8445a1`, `42cab59`).

The command-run checkbox is left unchecked: no result is recorded here, and tracker cleanup did not rerun application checks. It is historical verification scope, not a request to restore the retired Fame Tier implementation.
