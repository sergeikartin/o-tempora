Labels: ready-for-agent

# Mobile-friendly layout: collapsible sidebar, bottom-sheet detail panel, touch pinch-to-zoom

## Problem Statement

`docs/product-scope.md` has never taken a position on mobile/touch — it's absent from both the in-scope and out-of-scope lists, and `.scratch/sidebar-filters-legend/map.md` explicitly flagged it as "unexamined; unclear whether the app targets narrow viewports at all today." The viewport meta tag is present (`packages/web/index.html:5`), but there is exactly one media query anywhere in `src` (`global.css:41`'s `prefers-reduced-motion`) — no width-based responsive behavior exists.

The desktop layout is a fixed three-column flex row at `height: 100vh` (`App.tsx:51`, `App.module.css`'s `.layout`): a 220px-wide `Sidebar` (`Sidebar.module.css:3`), the flexible `TimelineCanvas`, and a 340px `DetailPanel` (`DetailPanel.module.css:6`) that slides in from the right via `transform: translateX`. On a ~360-390px phone, the sidebar alone would consume over half the width. Several interactions are also explicitly gated to `pointerType === 'mouse'` and do nothing on touch today: drag-to-pan (`TimelineCanvas.tsx:393`), and `Minimap`'s hover tooltip and click-to-jump (`Minimap.tsx:123,169`) — panning itself still works on touch via native scroll-by-swipe on `.scrollContainer`, which is why the drag handler was gated off in the first place (see its surrounding comment).

## Solution

A baseline "usable, not broken" mobile experience — not a parallel mobile-native redesign — targeting phone widths down to ~360-390px, both orientations (portrait as the optimized default), verified via manual browser-devtools responsive-mode spot-checks rather than new test infrastructure.

Below a new `MOBILE_BREAKPOINT_PX` width threshold:

1. **Sidebar becomes a collapsible drawer**, closed by default, opened via a floating toggle button (top-left of the canvas, mirroring the existing top-right zoom-controls overlay). Opens as a dimming overlay on top of the canvas, not a layout push. Auto-closes if the detail panel opens.
2. **Detail panel becomes a bottom sheet** — same overlay component, same open/close mechanism, just anchored to the bottom edge (`translateY`) instead of the right edge (`translateX`), sized to fit the narrow width instead of a fixed 340px column.
3. **The minimap is dropped entirely** (not rendered) — it's the one component whose primary features (hover tooltip, click-to-jump) are mouse-only today, and removing it also reclaims vertical space. No replacement for cross-timeline jump navigation; users navigate via pan + zoom, mitigated by (4).
4. **The default zoom level starts more zoomed-in** on narrow viewports, so first paint isn't a cramped, zoomed-out view.
5. **The page allows normal vertical scroll** on mobile instead of staying clipped to `100vh`.

Independent of width, keyed off input capability (`pointer: coarse`):

6. **The `+`/`-` zoom buttons are hidden on touch**, replaced by **pinch-to-zoom** — the one deliberate exception to "no new interaction paradigms," since a visually-interactive zoom control that silently does nothing on touch reads as broken. Pinch is minimal: scale-only, centered on the pinch midpoint, no momentum. It reuses the existing zoom-animation architecture (`options.ts`'s `zoomAnimationGroupTransform` / `TimelineCanvas.tsx`'s `applyZoomAnimationTick`) rather than re-rendering marks per frame, and commits `pixelsPerYear` exactly once at gesture end, the same single-commit pattern the buttons already use. Desktop mouse users keep the buttons unchanged.

## User Stories

1. As a phone user (~360-390px wide) opening the app, I want the sidebar, canvas, and detail panel to all fit the screen without a fixed-width column pushing content off-screen, so that the app is usable at all on my device.
2. As a phone user, I want the filter sidebar to start closed and be reachable via a visible toggle button, so that the timeline gets the full screen width by default.
3. As a phone user, I want tapping the drawer toggle to open the sidebar as a dimmed overlay on top of the canvas, and tapping outside it (or the toggle again) to close it, so that filtering doesn't require a permanent, space-consuming column.
4. As a phone user, I want to tap a lane item and see its detail panel slide up from the bottom of the screen, fitting the screen width, so that I don't need to scroll a narrow off-screen-anchored panel.
5. As a phone user with the filter drawer open, I want tapping a lane item to close the drawer automatically as the detail panel opens, so that the two overlays never compete for the same space.
6. As a phone user, I want to pan the timeline the same way I already can — one-finger swipe — unchanged from today, so that basic navigation doesn't require learning anything new.
7. As a phone user, I want to pinch with two fingers on the timeline to zoom in and out, so that I have a touch-native way to change the zoom level now that the buttons are gone on my device.
8. As a phone user pinching to zoom, I want the point between my fingers to stay fixed under them as the timeline scales, so that zooming feels anchored to where I'm looking rather than jumping to some other point in time.
9. As a mouse/desktop user, I want the existing `+`/`-` zoom buttons to keep working exactly as they do today, so that this change doesn't affect my experience at all.
10. As a phone user, I want the minimap track (with its hover tooltip and click-to-jump) to simply not appear, rather than appear but not respond to my taps, so that I never encounter a control that looks interactive but silently does nothing.
11. As a phone user, I want the app to open already reasonably zoomed in, so that the initial view is legible rather than a wide, cramped slice of history rendered into a third of a desktop's width.
12. As a phone user, I want to scroll the page vertically if the sidebar/canvas content doesn't all fit in one screen height, so that content isn't clipped or force-scrolled inside a fixed-height box that's too short for a phone viewport.
13. As a user rotating my phone to landscape, I want the layout to keep working (same drawer/bottom-sheet/pinch behavior), so that landscape isn't a broken or unsupported state.
14. As a tablet user (≥ the mobile breakpoint), I want the existing desktop layout — sidebar column, side-anchored detail panel, minimap, zoom buttons — so that this change only affects genuinely narrow viewports.
15. As a maintainer, I want the mobile/touch breakpoint and pointer-capability checks expressed as small, reusable, testable units (a shared viewport hook; existing `pointerType`-gating conventions), so that mobile behavior can be verified without a real device.
16. As a maintainer, I want pinch-to-zoom to reuse the existing zoom-animation transform mechanism rather than driving `pixelsPerYear` state per touchmove, so that pinching doesn't reintroduce the 250-530ms/frame per-mark re-render cost that a prior full-re-render zoom attempt already ran into (per `options.ts`'s comment above `ZoomAnimationTransform`).
17. As a low-vision user relying on OS/browser pinch-to-zoom to magnify the page, I want that native zoom to keep working everywhere except the timeline canvas itself, so that intercepting the gesture for app-level zoom doesn't remove an existing accessibility affordance from the rest of the page.

## Implementation Decisions

**Breakpoint & capability detection:**
- New `shared/lib/viewport.ts`: `MOBILE_BREAKPOINT_PX` (proposed starting value: `640`, chosen to cover phones in both orientations while leaving tablets on the desktop layout — tunable during implementation) and `useIsMobileViewport(): boolean`, subscribing to `window.matchMedia(\`(max-width: ${MOBILE_BREAKPOINT_PX}px)\`)` the same way `shared/lib/motion.ts` already subscribes to the `prefers-reduced-motion` query (construct once, `addEventListener('change', …)`, return current `.matches`).
- Touch-capability (buttons vs. pinch) is a separate axis from the width breakpoint — a `@media (pointer: coarse)` CSS check, not JS state, since it doesn't affect what's rendered, only which zoom-control affordance is visible. A wide touch tablet keeps the desktop layout but still gets pinch instead of buttons.

**Sidebar → drawer (`widgets/sidebar`):**
- `App.tsx` adds `const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false)`, threaded to `Sidebar` (open state + close callback) and to `TimelineCanvas` (toggle button), the same prop-drilling shape already used for `fameScoreValues`/`selectedDomains`/etc.
- `Sidebar.module.css` gets a `@media (max-width: 640px)` block overriding `.sidebar`: `position: fixed; inset: 0 auto 0 0; z-index: 50; transform: translateX(-100%);` plus `.sidebar.open { transform: translateX(0); }`, transitioning via the existing `--motion-duration-base`/`--motion-easing` tokens — mirrors `DetailPanel.module.css`'s existing `.panel`/`.panel.open` transform-toggle pattern exactly, just sliding from the left instead of the right.
- A new `.backdrop` (`position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 49`), rendered only when the drawer is open and only under the mobile breakpoint, closes the drawer on click/tap.
- New toggle button in `TimelineCanvas.module.css` (`.drawerToggle`: `position: absolute; top: 8px; left: 8px; z-index: 1`), styled like the existing `.zoomControls` buttons, rendered only when `useIsMobileViewport()` is true.
- Opening the detail panel (the existing `selectEntity` callback from `useSelectedEntity`, wired in `App.tsx:71`) also calls `setIsFilterDrawerOpen(false)`, so only one overlay is ever open at once.

**Detail panel → bottom sheet (`widgets/detail-panel`):**
- `DetailPanel.module.css` gets a `@media (max-width: 640px)` block (declared after the base `.panel`/`.panel.open` rules so it wins the cascade) overriding: `top: auto; left: 0; right: 0; width: 100%; max-height: 80vh; border-left: none; border-top: 1px solid var(--color-border-subtle); border-radius: var(--radius-md) var(--radius-md) 0 0; transform: translateY(100%);` and `.panel.open { transform: translateY(0); }` — same component, same `open` class toggle, only the axis and dimensions change.

**Minimap removal (`widgets/timeline-canvas`):**
- `TimelineCanvas.tsx` conditionally renders `<Minimap ... />` only when `!useIsMobileViewport()`. Panning itself has no dependency on `Minimap` — it drives `onScrollLeftJump`/hover display only, while pan is native scroll + (mouse-only) drag on `.scrollContainer` — so omitting it doesn't regress any other interaction.

**Zoom buttons vs. pinch-to-zoom (`widgets/timeline-canvas`):**
- `TimelineCanvas.module.css`: `.zoomControls { @media (pointer: coarse) { display: none; } }`.
- Pinch tracking is added to the same `.scrollContainer` element the mouse drag-pan handlers are already on, via a new pointer-tracking ref (`Map<pointerId, {x, y}>`, separate from the existing single-pointer `dragStartRef`), engaging only once two concurrent non-mouse pointers are down (mirrors the existing `event.pointerType !== 'mouse'` gate on `handlePointerDown`, just inverted — mouse drag and touch pinch never both engage for the same gesture).
- On the second pointer's `pointerdown`: record the initial two-point distance, the committed `pixelsPerYear`, and `centerYear = scale.invert(pinchMidpointClientX + scrollLeft)` — the same technique `zoom()` (`TimelineCanvas.tsx:567`) already uses to compute the viewport-center year for button-zoom, just centered on the pinch midpoint instead.
- On each subsequent `pointermove`: recompute the live two-point distance, derive `currentPixelsPerYear = clampPixelsPerYear(startPixelsPerYear * (currentDistance / startDistance), clientWidthPx)`, and feed it straight into the existing `applyZoomAnimationTick(zoomAnimationGroupTransform({ startPixelsPerYear, currentPixelsPerYear, minYear: MIN_YEAR, centerYear, scrollLeftStart, clientWidthPx }))` — the same cheap group-transform path the button-zoom's rAF `tick()` already uses, so marks scale visually without a full per-mark re-render for the whole gesture (per `options.ts`'s comment on `ZoomAnimationTransform`: a full re-render measured at 250-530ms/frame at this app's density).
- On the second-to-last pointer's `pointerup`/`pointercancel` (gesture end): commit exactly once via `setPixelsPerYear(currentPixelsPerYear)`, the same single-commit-at-gesture-end pattern the button-zoom's `tick()` already performs at `t === 1`. There's no discrete "zoom step" list in this codebase to snap to — `ZOOM_STEP` (`options.ts:200`) is a relative ±20% multiplier applied per button click, not a set of fixed stops — so "minimal, no momentum" here concretely means: the gesture's own live distance ratio is what commits, once, clamped by the existing `clampPixelsPerYear` bounds, with no elastic overshoot and no invented quantization.
- `.scrollContainer` gets `touch-action: pan-x` (scoped to this element only, not page-wide) — keeps native single-finger horizontal swipe-to-scroll working exactly as it does today, while stopping the browser from intercepting two-finger gestures as native page pinch-zoom, so the pointer events above actually receive both touches. Everywhere else on the page (drawer, bottom sheet, their text) keeps native pinch-zoom available as an accessibility fallback, since nothing there sets `touch-action`.

**Default zoom on mobile (`widgets/timeline-canvas/options.ts`):**
- `defaultPixelsPerYear(viewportWidthPx)` (`options.ts:228`) currently derives its result from the fixed `DEFAULT_VISIBLE_YEARS` regardless of viewport width — meaning a narrow phone shows the same year range as desktop, just rendered smaller and denser, not actually "more zoomed in." Parameterize it with a `visibleYears` argument (defaulting to `DEFAULT_VISIBLE_YEARS`), and pass a new, smaller `MOBILE_DEFAULT_VISIBLE_YEARS` constant when `useIsMobileViewport()` is true, so the mobile first paint genuinely shows fewer years at a legible density. Exact value left to implementation/visual QA.

**Vertical scroll (`app/App.module.css`):**
- `.layout`'s `height: 100vh` becomes `min-height: 100vh` under the mobile breakpoint (allowing the page to grow taller than the viewport and scroll normally) rather than clipping content — the desktop `height: 100vh` behavior is unchanged above the breakpoint.

## Testing Decisions

- **`useIsMobileViewport`**: unit-tested by mocking `window.matchMedia` the same way `TimelineCanvas.reduced-motion.test.tsx` already does for `prefers-reduced-motion` (a `beforeAll` stub keyed on `query.includes(...)`) — assert it reflects `.matches` and updates on a dispatched `change` event.
- **Pinch-to-zoom math** (distance → `pixelsPerYear`, midpoint → `centerYear`): extracted as pure functions alongside `zoomIn`/`zoomOut` in `options.ts` so they're unit-testable without simulating real multi-touch pointer events — given a start/current two-point distance and bounds, assert the clamped output value; given a midpoint client position, assert the resolved `centerYear`.
- **`TimelineCanvas.test.tsx`**: extend with two-pointer `fireEvent.pointerDown`/`pointerMove`/`pointerUp` sequences (`pointerType: 'touch'`) asserting `pixelsPerYear` commits once, at gesture end, to the expected clamped value — mirroring how the existing button-zoom tests likely already assert post-animation committed state. A parallel case confirms a single mouse pointer still only drives drag-to-pan, never pinch.
- **`Sidebar.test.tsx` / new drawer tests**: render at/under the mobile breakpoint (mock `matchMedia` to force `useIsMobileViewport()` true), assert closed-by-default, toggle opens/closes via the button and via backdrop click, and that `.open`'s class/`transform` state matches.
- **`DetailPanel.test.tsx`**: extend to assert the mobile media-query block doesn't change the existing open/close behavior contract (same `open` prop, same class toggle) — CSS-level positioning differences aren't asserted in RTL (jsdom doesn't apply media queries), so this stays a behavioral, not visual, test.
- **`TimelineCanvas.test.tsx`**: assert `Minimap` doesn't render when `useIsMobileViewport()` is mocked true, and does when false.
- No new end-to-end, visual-regression, or Playwright device-emulation tests — not an existing pattern in this repo, and out of scope per the grilling session's verification decision (manual devtools spot-checks instead).

## Out of Scope

- Any gesture input beyond pinch-to-zoom (no two-finger pan-while-pinching, no swipe gestures, no long-press).
- Removing/changing the `+`/`-` buttons for mouse/desktop users — they're untouched.
- Playwright device-emulation test infrastructure (none exists today; verification for this pass is manual devtools spot-checks).
- Any substitute for the minimap's cross-timeline jump navigation on mobile (accepted tradeoff, mitigated by the more-zoomed-in mobile default).
- Tablet-specific layout tuning beyond "falls back to the desktop layout above the breakpoint."
- Retuning `MOBILE_BREAKPOINT_PX`/`MOBILE_DEFAULT_VISIBLE_YEARS` beyond a reasonable starting value — left to visual QA during implementation.
- A dedicated mobile header/toolbar — the drawer toggle is a floating overlay specifically to avoid introducing new page chrome.

## Further Notes

- Resolves the gap `.scratch/sidebar-filters-legend/map.md` flagged under "Not yet specified": "Sidebar responsive/mobile behavior — unexamined; unclear whether the app targets narrow viewports at all today."
- `docs/product-scope.md` should gain a short mobile/device-support line once this ships, mirroring how it already cites `.scratch/russian-localization/spec.md` for the language-build decision.
- Worth a new ADR under `packages/web/docs/adr/` once implemented, documenting two decisions future readers will otherwise have to reconstruct: (1) reusing the button-zoom's transform-based animation architecture for pinch rather than driving `pixelsPerYear` per touchmove, and (2) splitting "layout breakpoint" (width-based) from "input capability" (`pointer: coarse`-based) as two independent axes rather than one.
- `ZOOM_STEP`/`clampPixelsPerYear`/`pixelsPerYearBounds` (`options.ts`) are reused as-is for pinch's clamping — no new bounds are introduced for touch.
