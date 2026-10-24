Status: ready-for-agent

# Map-style pan and zoom

Spec: `../spec.md` section 5. Independent of the other tickets.

## Scope
- Ctrl/Cmd+wheel and trackpad pinch zoom under the cursor via the ADR-0008 transform path; `pixelsPerYear` commits once after the gesture settles. Prevent browser page zoom on those events only.
- Plain wheel still scrolls lane rows; Shift+wheel or horizontal wheel pans.
- Mouse-drag inertia, stopping at the pan bounds, off under `prefers-reduced-motion`.
- Keyboard: ←/→ pan (~10%, Shift ~50%), `+`/`=`/`-` zoom, document-level, ignored in text fields, radio groups and open modals. Help lists the keys.
- Rewrite the "wheel-zoom deliberately not wired" line in `docs/timeline-rendering.md` to current behaviour; no ADR.

## Acceptance
- [ ] Zooming under the cursor keeps the year under it fixed.
- [ ] No per-tick mark re-render during wheel zoom (same frame-cost bar as pinch).
- [ ] Arrow keys don't fight the Detail Level radio group or Search input.
- [ ] Inertia never overshoots the pan bounds; disabled with reduced motion.
- [ ] The scroll regions are keyboard-focusable and `scrollable-region-focusable` is removed from `packages/web/scripts/a11y-baseline.json`; `npm run a11y --workspace packages/web` passes.
