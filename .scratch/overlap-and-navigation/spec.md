# Overlap, chrome and navigation

Terms are defined in `CONTEXT.md`: **Selection**, **Span Band**, **Overlap Band**, **Entity Link**, **Top Bar**, **Filters Panel**, **Scrubber**.

## Goal

The product's job is "who lived at the same time as whom". Today overlap is only implied by vertical alignment, the floating sidebar covers a quarter of a 1440px canvas, phones have no sense of where they are in time, pan/zoom lacks map-style affordances, and the landing CTA hands off to a view where the Curiosity's overlap is hard to see.

## Decisions

### 1. Overlap
- A **Selection** is up to 4 entities. A plain click or Search pick replaces it. Shift/Ctrl/Cmd-click or the panel's "Add to comparison" button toggles a member; at 4, further adds are ignored and the button is disabled with an "Up to 4" note.
- Each member gets a **Span Band** across all lanes: Period = band, PointInTime = hairline. Selection state only: no hover, no dimming or emphasis of other Marks, no connection lines.
- With two or more members, the shared span is an **Overlap Band** (stronger tone, ~4px minimum width). A PointInTime counts only if inside every Period. No shared span draws nothing.
- The detail panel with one member is unchanged. With two or more it lists every member in short form (lane swatch, name, dates with month, tagline, Wikipedia link, ×; no image or description), in selection order, under a one-line overlap summary computed with the Overlap Band's own function ("Overlap: Feb – Apr 1955" / "No shared span"; wording must suit conflicts and milestones, and Russian). Closing the panel clears the Selection.
- Members hidden by Detail Level or filters stay in the Selection: their band stays, the entry notes it is hidden by filters, × removes it.
- Phones: a Selection opens the sheet at a peek height (~40vh max) so the lanes and bands stay visible. A single entity keeps the 80vh sheet.

### 2. Entity Link and landing handoff
- `?e=<slug>` is repeatable, in selection order, capped at 4 (extras ignored). Slugs resolve through the existing progressive level loading, raising the Detail Level as far as the least famous needs; unresolved slugs are dropped.
- First selection from empty pushes a history entry; adding/removing while a Selection is open replaces it; closing replaces. The language switch carries all slugs.
- Opening an Entity Link fits the viewport to the union of the spans (+~10% padding, clamped to 50–250 years) against the uncovered canvas (excluding the 340px desktop drawer). Clicks, Search picks and later selection changes centre only and keep zoom.
- The landing CTA links to all of the shown Curiosity's marks as one Selection. The figure's per-mark links open only their own mark.
- The Curiosity test that asserts the first mark contains the overlap is removed.

### 3. Chrome
- **Top Bar** (Search, Detail Level, Filters button with active-filter count, Help) replaces the floating sidebar at every width. The Viewport Range heading stays in its own strip below; zoom +/- stay overlaid on its corner for non-touch pointers. About and the language switch stay in Help.
- **Filters Panel** holds Occupation Domain, Region and Conflicts & Milestones: popover on desktop, bottom sheet at ≤960px. The left drawer, its scrim and toggle are removed.

### 4. Phones
- A 24px **Scrubber** (century ticks, viewport thumb, tap to jump, drag thumb to pan, position only) mounts exactly where the Minimap is omitted (`useIsMobileViewport()`). The numeric Viewport Range stays.

### 5. Pan and zoom
- Ctrl/Cmd+wheel and trackpad pinch (ctrl+wheel events) zoom anchored under the cursor, using the ADR-0008 transform path (commit `pixelsPerYear` once after the gesture settles). Plain wheel keeps scrolling lane rows. Shift+wheel or horizontal wheel pans.
- Pinch keeps its midpoint anchor; zoom buttons and +/- keys anchor at the viewport centre.
- Mouse-drag pan gets inertia and stops at the pan bounds; touch and trackpad keep native momentum; `prefers-reduced-motion` disables it.
- Keyboard: ←/→ pan ~10% of the viewport (~50% with Shift); `+`/`=`/`-` zoom. Document-level handler, ignored in text fields, radio groups (Detail Level) and open modals. Help lists the keys.

## Out of scope
Pairwise connection lines, dimming or ranking of unselected marks, a Search "add" button, a picker-chosen default viewport for bare `/timeline/` (stays 1740–1860, prerendered), changing the 50-year minimum zoom, viewport/filters in the URL.

## ADRs (written with the code)
- Root: Selection is a set; overlap is drawn as bands, not connections (reopens the "who overlapped" scope call).
- Web: URL carries a Selection set and arrival fits it (supersedes `0015`).
- Web: chrome split into Top Bar and Filters Panel; drawer removed (supersedes the drawer and minimap-omitted parts of `0008`).

## Docs to update in the same work
`PRODUCT.md`, `docs/product-scope.md`, `DESIGN.md`, `docs/timeline-rendering.md`, `docs/observability.md` (selection events), and every stale "sidebar" mention in `CONTEXT.md` and the living docs.

## Tickets
1. `issues/01-selection-and-overlap-bands.md`
2. `issues/02-top-bar-and-filters-panel.md`
3. `issues/03-phone-scrubber.md`
4. `issues/04-map-style-pan-and-zoom.md`
