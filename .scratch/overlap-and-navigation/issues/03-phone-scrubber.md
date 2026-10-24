Status: resolved
Blocked by: 02

# Phone Scrubber

Spec: `../spec.md` section 4. Blocked by 02 because the phone chrome layout (bar, Filters sheet) fixes the vertical budget.

## Scope
- 24px strip: century ticks (reuse the Minimap's tick strip logic), viewport thumb, tap to jump, drag thumb to pan; position only.
- Mounts under `useIsMobileViewport()`, i.e. exactly where the Minimap is omitted; the numeric Viewport Range stays.
- Update `DESIGN.md` and `docs/timeline-rendering.md`; touch-target size to be checked on the thumb.

## Acceptance
- [x] Thumb tracks pan and pinch live without re-rendering marks per frame.
- [x] Tap and drag move the viewport; clamped to the pan bounds.
- [x] Not shown on desktop or wide tablets.
- [x] Does not collide with the Selection peek sheet.
