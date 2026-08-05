# 03 — Shared BCE/CE year-formatting utility, wired into the Year Axis and tooltips

**What to build:** Every year shown to the user displays with BCE/CE formatting ("500 BCE"/"100 CE") instead of a plain signed integer, via one shared formatting utility used at every call site — not duplicated per call site. This covers the Year Axis's tick labels and every tooltip template in `map-to-items.ts` (`mapPeople`/`mapWars`'s `${startYear}–${endYear}` strings, plus the reign-period tooltip). Internal `startYear`/`endYear` representation (signed integer, BCE negative) is unchanged everywhere else — this is presentation-only.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A single shared year-formatting utility renders a signed year as "N BCE" or "N CE", with tests covering the BCE/CE boundary (year 0/1) and both signs.
- [ ] `YearAxis.tsx`'s `tickFormat` uses the shared utility instead of `String(year)`.
- [ ] `map-to-items.ts`'s `mapPeople` tooltip (including the "present"/open-ended case), `mapWars` tooltip, and the reign-period tooltip (including its "(end unknown)" case) all use the shared utility instead of raw interpolated numbers.
- [ ] No call site duplicates BCE/CE formatting logic inline.
- [ ] `packages/web/docs/code-conventions.md`'s Timeline Rendering section documents the shared formatting utility and where it's used.
- [ ] `npm run typecheck --workspace packages/web` and `npm run test --workspace packages/web` pass, including updated fixtures/assertions in `map-to-items.test.ts` that expect BCE/CE-formatted tooltip strings.
