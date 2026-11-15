# 03 — Shared BCE/CE year-formatting utility, wired into the Year Axis and tooltips

**What to build:** Every year shown to the user displays with BCE/CE formatting ("500 BCE"/"100 CE") instead of a plain signed integer, via one shared formatting utility used at every call site — not duplicated per call site. This covers the Year Axis's tick labels and every tooltip template in `map-to-items.ts` (`mapPeople`/`mapWars`'s `${startYear}–${endYear}` strings, plus the reign-period tooltip). Internal `startYear`/`endYear` representation (signed integer, BCE negative) is unchanged everywhere else — this is presentation-only.

**Blocked by:** None — can start immediately.

Status: resolved

- [x] A single shared year-formatting utility renders a signed year as "N BCE" or "N CE", with tests covering the BCE/CE boundary (year 0/1) and both signs.
- [x] `YearAxis.tsx`'s `tickFormat` uses the shared utility instead of `String(year)`.
- [x] `mapPeople` and reign-period tooltip years use the shared utility, including open-ended cases. `mapWars` and `mapDiscoveries` had no year interpolation to convert (documented in `2495ac2`).
- [x] No call site duplicates BCE/CE formatting logic inline.
- [x] `packages/web/docs/code-conventions.md`'s Timeline Rendering section documents the shared formatting utility and where it's used.
- [ ] `npm run typecheck --workspace packages/web` and `npm run test --workspace packages/web` pass, including updated fixtures/assertions in `map-to-items.test.ts` that expect BCE/CE-formatted tooltip strings.

## Comments

Tracker reconciliation (2026-11-15): Implemented in `2495ac2`, which widened and republished the datasets, added the shared formatter and updated tests/docs. The original acceptance list describes that historical implementation; the current Detail Level system and localized year formatting supersede its tier names and explicit CE suffix (`b8445a1`, `42cab59`).

The command-run checkbox is left unchecked: no result is recorded here, and tracker cleanup did not rerun application checks. The formatter and its boundary tests are present; the historical tooltip implementation has since been replaced by the detail panel.
