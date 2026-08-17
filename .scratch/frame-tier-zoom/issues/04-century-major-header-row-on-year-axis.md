# 04 — Century major-header row on the Year Axis

**What to build:** The Year Axis gains a second, major header row above the existing minor-tick row, showing computed century boundaries (e.g. "1800s," "3rd century BCE") arithmetically derived from the visible year range — no curated named-epoch dataset, and named epochs (Antiquity, Renaissance, etc.) stay explicitly deferred. The minor-tick row keeps D3's default `axisBottom` tick algorithm, retuned to target 60–80px label spacing instead of its current spacing. The axis stays in its current position between the People and Wars & Conflicts lanes — not moved to the top, no sticky/position:fixed.

**Blocked by:** [[03-shared-bce-ce-year-formatting-utility]] — century labels like "3rd century BCE" reuse the same BCE/CE-ness logic as the shared formatting utility.

**Status:** superseded

**Superseded by:** `.scratch/pre-launch-readiness/issues/13-minimap-century-marks.md`, resolved via `/grill-with-docs`. Century marks land on the Minimap (top-edge tick strip) instead of a new header row on `YearAxis` — also predates the later decision to reduce `YearAxis` from three instances to one (`.scratch/pre-launch-readiness/issues/03-axis-duplication.md`) and the "Wars & Conflicts"/lane-rename that made this ticket's lane names stale.

- [ ] A new header row renders above `YearAxis`'s existing minor-tick row, showing uniform century boundaries computed from the visible/total year range (no hardcoded epoch list).
- [ ] Century labels use BCE/CE-consistent phrasing (e.g. "1800s" for CE centuries, "3rd century BCE" style for BCE centuries) and share logic with [[03-shared-bce-ce-year-formatting-utility]]'s utility rather than reimplementing BCE/CE detection.
- [ ] Minor-tick spacing is retuned to target 60–80px between labels (`TARGET_TICK_SPACING_PX` or equivalent), verified at a couple of representative `pixelsPerYear` values.
- [ ] The Year Axis's position (between People and Wars & Conflicts lanes) and lack of sticky/fixed positioning are unchanged.
- [ ] `packages/web/docs/code-conventions.md`'s Timeline Rendering section documents the major header row and the retuned tick spacing.
- [ ] `npm run typecheck --workspace packages/web` and `npm run test --workspace packages/web` pass.
