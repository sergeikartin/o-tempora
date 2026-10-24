Status: ready-for-agent
Blocked by: 02

# Phone Scrubber

Spec: `../spec.md` section 4. Blocked by 02 because the phone chrome layout (bar, Filters sheet) fixes the vertical budget.

## Scope
- 24px strip: century ticks (reuse the Minimap's tick strip logic), viewport thumb, tap to jump, drag thumb to pan; position only.
- Mounts under `useIsMobileViewport()`, i.e. exactly where the Minimap is omitted; the numeric Viewport Range stays.
- Update `DESIGN.md` and `docs/timeline-rendering.md`; touch-target size to be checked on the thumb.

## Acceptance
- [ ] Thumb tracks pan and pinch live without re-rendering marks per frame.
- [ ] Tap and drag move the viewport; clamped to the pan bounds.
- [ ] Not shown on desktop or wide tablets.
- [ ] Does not collide with the Selection peek sheet.
