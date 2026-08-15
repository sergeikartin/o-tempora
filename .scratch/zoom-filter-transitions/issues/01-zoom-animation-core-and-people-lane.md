# 01 — Zoom animation core: transform math, rAF driver, deferred state commit

**What to build:** The animation engine for the `+`/`−` zoom buttons — pure transform/counter-scale math, a `requestAnimationFrame` interpolation driver with interrupt/retarget, and the deferred `pixelsPerYear`/`scrollLeft` state-commit pattern that avoids the scroll-clamp race documented in this feature's spec history — wired up end-to-end on `PeopleLane` only, to prove the mechanism before extending it to the rest of the canvas.

**Blocked by:** None — can start immediately

**Status:** done

- [x] New pure functions (in `options.ts`, alongside `clampPixelsPerYear`/`pixelsPerYearBounds`) compute: (a) the wrapping `<g>`'s `translate`/`scale` values for a given interpolated `pixelsPerYear` relative to the animation's start state and the anchor (center) year, and (b) the label/dot counter-scale value for that same interpolated `pixelsPerYear`.
- [x] Zoom-button click starts a `requestAnimationFrame` loop (or `d3.timer`) that computes `d3.interpolateNumber(startPixelsPerYear, targetPixelsPerYear)` eased via `d3.easeCubicInOut`, over a fixed duration longer than `--motion-duration-base` (target ~300-400ms, tune as needed).
- [x] Each tick writes the computed `transform` attribute directly to `PeopleLane`'s wrapping `<g>` and each visible label/dot's counter-scale `transform`, via direct D3 `.attr()` calls — no React state changes mid-animation, no per-mark x/y attribute recompute, no row-assignment recompute.
- [x] `PeopleLane` re-centers on the year at viewport center, matching current button behavior exactly (no cursor-anchoring).
- [x] At the end of the animation, the real `pixelsPerYear` state commits exactly once; `scrollLeft` is applied via a `useLayoutEffect` keyed on the state that actually drives DOM width — never in the same step that changes `pixelsPerYear` — and the group's `transform` resets to identity in the same commit.
- [x] Mount's default-viewport positioning logic is untouched and remains a separate mechanism from this zoom-recenter logic (do not unify them).
- [x] A second zoom-button click while an animation is in flight cancels the current `requestAnimationFrame` loop and starts a new one from the current interpolated `pixelsPerYear`, not the original start or the stale target.
- [x] Zooming to the minimum (10 visible years) or maximum (250 visible years) bound animates and clamps correctly, matching today's instant-zoom clamping behavior.
- [x] `options.test.ts` covers the new pure transform/counter-scale functions.
- [x] `TimelineCanvas.test.tsx`'s existing zoom tests still pass; new cases cover: final `PeopleLane` rendered positions match the target `pixelsPerYear` after the animation resolves, and a second click mid-animation retargets to the correct final end-state.
- [x] Manually verified in the running dev app (Chrome DevTools MCP or equivalent) that `PeopleLane` marks and labels visibly glide smoothly on zoom, not snap — sample a mark's rendered position at intervals during the transition, as done for the fade/row-shift work.
- [x] `packages/web` typechecks, lints, and its test suite passes.

## Comments

Implemented as specified. One deviation worth noting: the label counter-scale ended up not needing an anchor-coordinate parameter — each mark's `.module.css` already declares (or now declares) `transform-box: fill-box`/`transform-origin` at its natural anchor (the same mechanism the existing hover-grow feature uses), so `zoomAnimationCounterScaleAttr` is just a bare `scale(1/sx, 1)`, computed and applied via the CSS cascade rather than JS translate/anchor math. See spec.md's Update 6 for the full account, including a real one-frame flash bug (unrelated to this ticket's own scope, but found and fixed during this ticket's manual verification step) — root-caused to a pre-existing scroll-mirroring lag on the sticky lanes.
