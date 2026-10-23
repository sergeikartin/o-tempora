Type: task
Status: ready-for-agent

Polish of the canvas itself, independent of the layout decision. Marks stay thin bars with labels above; do not touch row assignment or density. Clipping caused by the sidebar overlapping the canvas, and the Detail Level control's own look, are solved by the layout (tickets 09–10), not here.

## Do

- No label clipped mid-word at the canvas edges that the canvas itself controls (right edge, lane tops/bottoms); labels that run off a viewport edge fade or truncate cleanly rather than cutting.
- Chrome and label text at least 12 px where it is chrome rather than data; contrast fixed on axis ticks, century label and lane labels (axe `color-contrast`).
- Consistent hover, selection (ink halo, ADR 0014) and keyboard focus states across marks, controls and the Minimap.
- Gentle motion on pan, zoom and filter changes only, never decorative; everything respects `prefers-reduced-motion`.
- Review the Viewport Range heading, Year Axis and Minimap typography against `DESIGN.md` and tighten spacing and rhythm.
- Screenshot before/after at 1440×900 and 390×844 in both locales; owner reviews.

Acceptance: no visual regressions in the prerender (ADR 0013); LCP and CLS no worse.
Docs: `packages/web/docs/design-tokens.md` and `DESIGN.md` if any token changes; ADR only if a mark behaviour decision is reversed.
