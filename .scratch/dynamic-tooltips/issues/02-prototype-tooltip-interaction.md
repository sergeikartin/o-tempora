Type: prototype
Status: resolved

## Question

Build a rough, reactable prototype of the tooltip UI to settle:

- **Trigger**: hover vs. click to reveal. `docs/product-scope.md` states a "click an entry for a tooltip" target UX, but the current build is hover-only (native SVG `<title>`). Richer content — especially a clickable Wikipedia link living inside the tooltip — changes the calculus versus a plain hover label. Decide deliberately.
- **Positioning architecture**: how a custom HTML tooltip overlay positions itself against D3-rendered SVG marks (People lifespan lines, Wars & Conflicts lines/dots, Events & Inventions dots) inside `TimelineCanvas`'s pannable/scrollable container. Portal vs. absolutely-positioned div; coordinate transform from SVG-space to screen-space; behavior while the container is being dragged/panned.
- **Dismiss behavior**: click-away, Escape key, close button — whichever fits the chosen trigger.
- **Per-entity-type content layout**:
  - People: image slot (use a placeholder block if the image-sourcing research ticket hasn't resolved yet), short description, lifetime years/months, reign periods (title + dates) when present, Wikipedia link.
  - Wars & Conflicts / Events & Inventions: short description, year + month when available, Wikipedia link.

Link the prototype as an asset from this ticket when resolving it.

## Answer

Prototype: three variants mounted on the real running app against real data, switchable via `?variant=A|B|C`, wired through one shared delegated `pointerover`/`click` listener in `TimelineCanvas` keyed off `data-entity-id`/`data-entity-type` attributes added to each Lane's marks (avoids repeating d3 `.on()` wiring three times over). Captured on the throwaway branch `prototype/dynamic-tooltips-tooltip-interaction` (commit `0a21ce3`), not merged — per the map's destination this map produces a spec, not shipped code, so nothing from the prototype lands on `dev`.

**Winner: Variant C — click-to-open, viewport-docked side drawer.**

- **Trigger**: click (not hover) — settles the trigger question the map flagged as open. Matches `docs/product-scope.md`'s originally-stated "click" UX.
- **Positioning**: no coordinate math against the clicked mark at all — the drawer always docks to the viewport's right edge regardless of which mark was clicked or the timeline's current scroll/pan position. This was the deciding factor over Variant B (click-to-pin, anchored to the mark's `getBoundingClientRect()` at click-time): B's anchor goes stale the moment the user pans while it's open, since it's never recomputed; C sidesteps that failure mode entirely by not anchoring to the mark's position in the first place.
- **Dismiss**: close (×) button, Escape key, clicking a different mark (swaps content), **and** clicking anywhere else outside the drawer — confirmed after live comparison (initially built as x/Escape/new-mark only; outside-click added afterward once C won, see `VariantC.tsx`'s `useEffect` in the captured commit).
- **Content layout**: full-width image banner at the top (when an image exists — omitted entirely otherwise, per the map's settled "omit the slot" decision), name, date line, description, a bulleted reign-period list (title + dates) for People when present, and a Wikipedia link styled as a button. Verified live against Napoleon (5 reign periods, real Commons portrait) and Otto von Bismarck (4 reign periods, no image) — both rendered cleanly with no overflow pressure, which the richer/roomier drawer layout affords compared to A/B's tighter popover space.
- Verified against a Discovery too (Internet, 1969) — year-only date line rendered correctly (Discoveries never carry month data), full-width image banner from a real Commons P18 URL.

**Rejected**:
- **Variant A (hover popover)**: fastest to scan, but was built with no hover-intent delay (fires instantly on `pointerover`) — flagged as a real gap if hover were chosen, not resolved here since A wasn't picked. Content must also stay compact since it vanishes the instant the pointer leaves, which cramps the reign-period list for people with several entries (workable but tight, e.g. Napoleon's 5).
- **Variant B (click-to-pin)**: rejected specifically for the stale-anchor-on-pan problem described above.

**Carries into "Finalize the tooltip spec"**: the drawer's positioning architecture needs no SVG-to-screen coordinate transform at all (a real implementation gets to skip that complexity entirely) — worth stating explicitly in the final spec as a reason C is also the cheaper build, not just the more robust one. Hover-intent-delay tuning is moot now that the trigger is click, not hover.
