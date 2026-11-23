# Timeline rendering

## Canvas and rows

- Keep layout, scales, item mapping and D3 rendering in `widgets/timeline-canvas/`. The lanes share one native horizontal scroll position and a clamped zoom scale. Each visual lane owns its vertical overflow.
- Use astronomical years for positions (year 0 is 1 BCE) and the shared BCE/CE formatter for display. Months appear in the details. The Focus Range and detail panel mark each approximate endpoint with “ca.” in English or “ок.” in Russian. Detail Level and filters control density while zoom changes the time scale.
- The pipeline greedily packs rows against the full dataset at the Reference Scale. It accounts for label widths in pixels. The web app keeps the assigned row identity and compacts visible rows. [Static row assignment](adr/0007-static-row-assignment-replaces-live-per-render-packing.md)
- Use literal marker classes for D3 joins and scope selectors to the owning lane’s SVG. CSS Module classes are styling hooks. Mark clicks resolve entities from the loaded dataset and open the detail panel.
- Period labels pin to the viewport’s left edge until their mark ends, stopping before the next mark in the row. Point labels sit by their dots. `usePinnedLabels` updates changed positions using the browser’s applied scroll offset.
- Lane edge fades use scroll and resize attributes for horizontal overflow and for rows above People or below Conflicts & Milestones. Keep the left caption strip solid.

## Axis and navigation

- The Year Axis uses CSS background gradients for ticks and windows decade labels out when spacing is too tight. The century tab, bold tick, lane seam and Minimap ticks share `--color-border-emphasis`. [Year Axis](adr/0012-year-axis-as-plain-css-ruler.md)
- The Focus Range above the lanes shows the selected span or the visible span. The Top Bar is in normal flow. The desktop detail panel starts below it and adds its width as pan space past the present, while the visible-year heading remains capped at today.
- Phones get a 24px Scrubber under the Focus Range in place of the desktop Minimap. Both use `centuryStripTicks`. A track tap eases to a year and dragging pans directly, clamped by the canvas. Reserve the slot on first paint and use the `ScrubberHandle` during animated zoom to update the thumb without rerendering marks. The thumb is at least 16px wide and its hit area extends upwards to 44px.

## Input

- Ctrl/Cmd+wheel and trackpad pinch zoom around the cursor through the same group transform as button and touch zoom. Marks use the starting scale until `pixelsPerYear` commits 150 ms after the last wheel step. The native non-passive listener suppresses page zoom for the zoom gesture.
- A plain wheel scrolls rows and Shift+wheel pans. Horizontal wheel/trackpad and touch swipes use native scrolling. Mouse drag coasts to the pan bounds unless reduced motion is enabled.
- Arrow keys pan a tenth of the viewport (half as far with Shift). `+`, `=` and `-` zoom around the center. The document handler skips text fields, selects, Detail Level and open modals. Each lane is focusable for keyboard row scrolling.

## Selection and navigation

- The Selection navigation module resolves Entity Links and Connections against the loaded dataset and requests deeper levels for missing targets. An Entity Link uses the first non-empty `e` parameter, raises Detail Level as needed and fits the span with 10% padding per side, within zoom bounds and clear of the desktop drawer. A slug absent from the dataset clears the Selection and its URL parameter.
- Mark clicks and Search picks keep zoom and add a history entry from a closed panel. Later picks and closing replace that entry. A Search pick keeps the current Selection while the required Detail Level loads, then raises the level if needed and pans to the mark. A Connection keeps the current Selection while its target loads, then pans to it, raises Detail Level if needed and pushes a new entry so Back restores the previous Selection. Another navigation or closing the panel supersedes a pending Search pick or Connection.
- People normally scrolls to its Year Axis edge when the visible rows change. A jump to a Person centers that mark vertically as the lane height settles.
- A Profile Anchor gives the one-based position of a Key Moment or Deep Fact. After loading, the panel highlights the passage and scrolls it into view. Selecting a different entity or closing clears the fragment. Browser history restores the anchor carried by the restored Entity Link. [Entity Links and Profile Anchors](adr/0021-entity-links-can-open-a-profile-passage.md)
