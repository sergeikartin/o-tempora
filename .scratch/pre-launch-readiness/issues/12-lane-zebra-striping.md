Type: task
Status: done

# Replace lane gridlines with zebra striping

## What to build

Resolved via `/grill-with-docs`. The lane area's faint decade-interval vertical gridlines (`.gridlineLayer`/`.gridline` in `TimelineCanvas.module.css`, currently a hardcoded-hex `linear-gradient` at `DECADE_STEP_YEARS` spacing) are replaced by a subtle alternating-background-band ("zebra striping") treatment.

- [x] Bands are vertical, at a 25-year interval, phase-aligned to round years — same BCE/CE phase-split convention the codebase already uses for tick/gridline rendering (see `BCE_DECADE_TICK_PHASE_OFFSET_YEARS`/`DECADE_TICK_PHASE_OFFSET_YEARS` for the existing pattern; introduce an analogous 25-year constant rather than reusing the decade one).
- [x] Same footprint as the `.gridlineLayer` it replaces: one layer painted behind row content, spanning the full scroll-container height across both lanes, full pannable width. Purely decorative (`pointer-events: none`).
- [x] Tint alternates using existing background tokens (e.g. `--color-bg-base`/`--color-bg-surface`) — no new hue introduced. Subtle enough to read as ambient structure, not as dark columns; agent has latitude on the exact token/opacity pairing within that constraint.
- [x] The old `.gridline`/`.gridlineLayer` hardcoded-hex rule and its `DECADE_STEP_YEARS`-driven gridline sizing are removed.
- [x] Per the repo's "no hardcoded hex" convention (`.claude/rules/css.md`), the new styling uses `var(--token)` throughout — this also covers wiring real tokens for the *other* pre-existing hardcoded hex values already in `TimelineCanvas.module.css`, `YearAxis.module.css`, and `Minimap.module.css` (most already matched an existing token exactly — e.g. `#e0d3ac` → `--color-border-subtle`, `#6b6046` → `--color-text-secondary`). Three new tokens were added to `global.css`/`design-tokens.md`, preserving current hex: `--color-border-emphasis` (`#837757`, `YearAxis`'s century tick) and `--color-bg-axis` (`#ebddbd`, `YearAxis`'s ruler background), plus `--color-conflict` (`#8c2d2b`) — needed once `Minimap.module.css`'s `.eventsArea` fill turned out to have no CSS-side token at all (only a JS constant, `CONFLICT_COLOR`, used for the lanes' own D3-set SVG attrs).
- [x] `npm run typecheck --workspace packages/web`, `npm run test --workspace packages/web`, and `npm run lint --workspace packages/web` pass.

Implemented: also converted the `rgba(...)` alpha-blended colors (viewport-rect, tooltip shadow) to `color-mix(in srgb, var(--token) X%, transparent)`, same "derive from an existing token, no new hue" principle. Verified visually in-browser — bands read as a calm, low-contrast texture, not stripes.
