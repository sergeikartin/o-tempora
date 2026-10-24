Status: resolved

# Selection, Span/Overlap Bands, multi-entry panel, Entity Link set, landing CTA

Spec: `../spec.md` sections 1 and 2.

## Scope
- Selection state (up to 4, ordered) replacing the single selected entity; click / Search pick replace, modifier-click and the panel button toggle.
- Span Bands (Period band, PointInTime hairline) behind marks across all lanes; Overlap Band with ~4px minimum width, from one pure function shared with the panel's overlap line.
- Detail panel: unchanged for one member; short-form list + overlap line for two or more; hidden-by-filters note; phone peek-height sheet.
- Entity Link: repeatable `?e=`, cap 4, progressive loading to the least famous slug, push/replace rules, language switch carries all slugs, arrival fit against the uncovered canvas.
- Landing CTA opens all marks of the shown Curiosity; per-mark links open one mark; drop the "first mark contains the overlap" Curiosity test.
- Tracked selection events; accessible description for the bands; Russian strings.
- ADRs: root (Selection set, bands not connections) and web (supersedes `0015`). Update `PRODUCT.md`, `docs/product-scope.md`, `CONTEXT.md`, `docs/timeline-rendering.md`, `docs/observability.md`.

## Acceptance
- [x] Einstein + Jobs Entity Link shows both bands, a visible Overlap Band, and "Overlap: Feb – Apr 1955" (or the agreed wording).
- [x] A fifth add is ignored; the button is disabled with the cap note.
- [x] A selected mark filtered out stays in the Selection and is marked hidden.
- [x] Back from a multi-member Selection closes the panel in one step.
- [x] On a 390px phone the lanes and bands remain visible above the peek sheet.
- [ ] `typecheck`, `test`, `lint`, `lint:boundaries` pass; axe clean at the three launch viewports in both locales.

## Comments

- The `typecheck`, `test`, `lint` and `lint:boundaries` checks pass. axe at 1440×900, 768×1024 and 390×844 in `/` and `/ru/` reports nothing from the new UI; the three violations it still reports (`region` on the sr-only `h1`, `scrollable-region-focusable` on the scroll containers, `color-contrast` on one century label at 1440) are the same on a bare `/timeline/` with no Selection, so the "axe clean" box is left unchecked. Keyboard focus for the scroll regions belongs with ticket 04.
- "Add to comparison" is a floating button on the timeline (shown while a Selection is open) that arms the next mark pick to add rather than replace (the touch route to Shift-click); the spec left what the button toggles open. Comparison members show a 44px thumbnail.
- The panel's overlap wording is "Overlap: Feb – Apr 1955" / "No shared span".
- While a Selection is open on desktop the scroll width grows by the 340px drawer, as empty space past the present, so spans near today can be centred clear of the drawer.
- The "first mark contains the overlap" Curiosity test named in the scope does not exist in `curiosities.test.ts`; a test that every Curiosity fits in one Selection (at most four marks) was added instead.
