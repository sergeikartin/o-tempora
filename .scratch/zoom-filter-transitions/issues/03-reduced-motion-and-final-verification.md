# 03 — Reduced motion, minimap correctness, and final verification

**What to build:** Close out the feature — respect `prefers-reduced-motion`, confirm the `MountainProfile` minimap stays correct (without animating itself), and do a full pass of edge-case and end-to-end verification across everything tickets 01-02 built.

**Blocked by:** 02

**Status:** done

- [x] When the resolved `--motion-duration-*` (via the existing `motionDurationMs` helper) is near-zero (`prefers-reduced-motion: reduce`), the zoom animation resolves to the final state on the next tick rather than running a full interpolation loop over a near-zero duration.
- [x] `MountainProfile`'s viewport-indicator rectangle is confirmed to reflect the correct, final `pixelsPerYear`/`scrollLeft` once an animation settles — it does not animate itself and must never show a stale or incorrect range after a zoom action, including immediately after an interrupted/retargeted animation.
- [x] Zooming near either end of the full timeline range (where a prior attempt's scroll-clamp race bug reproduced) is manually verified to land on the correct year — no off-by-hundreds-of-years regression.
- [x] `TimelineCanvas.test.tsx` covers the reduced-motion case: with `prefers-reduced-motion: reduce` mocked, a zoom-button click resolves to the target `pixelsPerYear` effectively immediately (no long-running animation).
- [x] Full manual verification pass in the running dev app (Chrome DevTools MCP): sample rendered positions of a mark, an axis tick, and the minimap indicator across a full zoom-in-then-zoom-out sequence, including an interrupted (double-clicked) animation, confirming smooth motion throughout and a correct final state every time.
- [x] This feature's spec (`.scratch/zoom-filter-transitions/spec.md`) status line is updated to reflect zoom animation as implemented, not "still unimplemented."
- [x] `packages/web` typechecks, lints, and its test suite passes; full repo CI-equivalent checks pass.

## Comments

Implemented as specified. Reduced motion needed no dedicated code path: `zoomAnimationDurationMs` scales the live `--motion-duration-base` token rather than a bare literal, so it collapses to near-zero automatically under `prefers-reduced-motion` the same way every other transition in the app does, and the tick loop already resolves in a frame or two once the duration is that small. Covered by an isolated test file (`TimelineCanvas.reduced-motion.test.tsx`, not a case inside `TimelineCanvas.test.tsx`) so it gets its own fresh `shared/lib/motion.ts` module cache rather than reusing whatever the main test file happens to cache first for `--motion-duration-base`. Manual verification (Chrome DevTools MCP) found and fixed one real bug outside this ticket's own listed scope, in code that predates this feature: a one-frame flash on every zoom commit, caused by the sticky lanes' scroll-mirroring only running from a throttled native `scroll` listener. See spec.md's Update 6.
