# 02 — Blended fameScore + wiring into transform/output

**What to build:** The pure sitelinks+pageviews blend formula from [ADR 0010](../../../packages/data-pipeline/docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md), wired end-to-end through Transform and Output so Wars & Discoveries' `fameScore` is the blended value instead of raw sitelinks, plus the corresponding sidebar filter bounds update. See [the spec](../spec.md) for full context. This ticket does not depend on ticket 01's real fetch code — the raw pageviews file's shape is already pinned by the spec (`{ wars: Record<id, number>, discoveries: Record<id, number> }`), so build and test against a synthetic fixture matching that shape.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] A new pure scoring function computes `fameScore = round(0.60 * S_sitelinks + 0.40 * S_pageviews)` with `S_sitelinks`/`S_pageviews` log-normalized and clamped per the ADR's exact formula, alongside the existing People-lane scoring function in the same module, with the formula's constants (350, 200,000,000, 0.60, 0.40, the 7-language basket, the 4-year window) recorded as inline comments next to it.
- [x] The old raw-sitelinks-only ranking function is removed once both its call sites migrate to the new blend function.
- [x] `transformWars`/`transformDiscoveries` load the new pageviews raw file (same loading convention as the existing image-attribution file) and pass each row's sitelinks + summed pageviews into the new blend function in place of the old ranking call.
- [x] Output's Wars/Discoveries builders read `fameScore` from the row's already-blended value instead of raw sitelinks, while the existing "drop row if sitelinks unresolved" gate is unchanged — it still keys on sitelinks specifically, not the blended score, so a pageviews-fetch failure degrades a row's score rather than dropping it.
- [x] The sidebar's Wars/Discoveries fame-score filter bounds move from their current lane-specific raw-sitelink ranges to the shared 1–100 range with a default of 75, per the ADR's documented consequence.
- [x] The blend function has direct unit test coverage: known sitelinks/pageviews pairs producing the documented formula's output, both components' clamp-at-100 edges, a missing/zero-pageviews input still producing a valid score from sitelinks alone, descending sort order, and no-floor behavior (every row kept).
- [x] Transform-level tests cover a row's final `fameScore` matching the blend function's output for that row's sitelinks/pageviews pair, using a synthetic pageviews fixture.
- [x] Output-level tests cover the built entry's `fameScore` equaling the row's already-blended input (not re-derived from sitelinks), and confirm the sitelinks-unresolved drop still fires regardless of a nonzero blended score.

## Comments

Implemented: `computeFameScore`/`rankByFameScore` in `src/transform/score.ts` (replacing `rankBySitelinks`), `TaggedWar`/`TaggedDiscovery` gained `fameScore`, `transform/index.ts` loads `data/raw/pageviews.raw.json` and feeds `{sitelinks, pageviews}` into `rankByFameScore`, `write-datasets.ts`'s `buildWars`/`buildDiscoveries` read `row.fameScore` (drop gate still keys on `row.sitelinks`), `FAME_SCORE_BOUNDS.wars`/`.discoveries` moved to `{min:1, max:100, default:75}`. New tests in `score.test.ts`, `write-datasets.test.ts`, and a new `transform/index.test.ts` (fs-mocked fixtures). Typecheck and full test suite (data-pipeline + web) pass.
